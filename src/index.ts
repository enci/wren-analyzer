export { Lexer } from "./lexer.js";
export { Parser } from "./parser.js";
export { Resolver } from "./resolver.js";
export { TypeChecker } from "./type-checker.js";
export { SourceFile } from "./source-file.js";
export { TokenType } from "./token.js";
export type { Token } from "./token.js";
export type { Diagnostic, Span } from "./types.js";
export { DiagnosticSeverity } from "./types.js";
export { formatDiagnosticsJson, formatDiagnosticsPretty } from "./reporter.js";
export { ModuleResolver } from "./module-resolver.js";
export { buildClassRegistry } from "./type-checker.js";
export type { ClassInfo } from "./type-checker.js";

export type {
  Module,
  Expr,
  Stmt,
  ClassStmt,
  ImportStmt,
  FieldExpr,
  StaticFieldExpr,
  Method,
  Body,
  TypeAnnotation,
  Parameter,
  Node,
  VarStmt,
  ForStmt,
  BlockStmt,
  IfStmt,
  WhileStmt,
  CallExpr,
  NumExpr,
  StringExpr,
  BoolExpr,
  NullExpr,
  ListExpr,
  MapExpr,
} from "./ast.js";

export { RecursiveVisitor, visitExpr, visitStmt } from "./visitor.js";
export type { AstVisitor } from "./visitor.js";

import { Lexer } from "./lexer.js";
import { Parser } from "./parser.js";
import { Resolver } from "./resolver.js";
import { TypeChecker, buildClassRegistry } from "./type-checker.js";
import type { ClassInfo } from "./type-checker.js";
import { SourceFile } from "./source-file.js";
import { ModuleResolver } from "./module-resolver.js";
import type { Diagnostic } from "./types.js";
import type { Module, ImportStmt } from "./ast.js";

export interface AnalysisOptions {
  /**
   * Directories to search for imported modules.
   * Modules are resolved relative to the importing file first,
   * then by searching these paths in order.
   */
  searchPaths?: string[];
}

export interface AnalysisResult {
  module: Module;
  diagnostics: Diagnostic[];
}

/** Full analysis: lexer + parser + resolver + type-checker. */
export function analyze(
  source: string,
  path = "<input>",
  options?: AnalysisOptions,
): AnalysisResult {
  const file = new SourceFile(path, source);
  const lexer = new Lexer(file);
  const parser = new Parser(lexer);
  const module = parser.parseModule();

  const diagnostics: Diagnostic[] = [...parser.diagnostics];

  // Resolve imported modules if search paths are provided
  const importedClasses = new Map<string, ClassInfo>();
  const importedNames: string[] = [];

  if (options?.searchPaths && options.searchPaths.length > 0) {
    const moduleResolver = new ModuleResolver(options.searchPaths);
    resolveImports(
      module,
      path,
      moduleResolver,
      importedClasses,
      importedNames,
    );
  }

  const resolver = new Resolver(diagnostics);

  // Register imported class names before resolving so they don't get
  // flagged as undefined variables
  if (importedNames.length > 0) {
    resolver.registerImportedNames(importedNames);
  }

  resolver.resolve(module);

  const typeChecker = new TypeChecker(diagnostics);
  typeChecker.check(
    module,
    importedClasses.size > 0 ? importedClasses : undefined,
  );

  return { module, diagnostics };
}

/**
 * Collect top-level class names from a parsed module.
 */
function collectTopLevelNames(mod: Module): string[] {
  const names: string[] = [];
  for (const stmt of mod.statements) {
    if (stmt.kind === "ClassStmt") {
      names.push(stmt.name.text);
    }
    if (stmt.kind === "VarStmt") {
      names.push(stmt.name.text);
    }
  }
  return names;
}

/**
 * Parse a module source and build its class registry.
 */
function parseModule(source: string, path: string): Module | null {
  const file = new SourceFile(path, source);
  const lexer = new Lexer(file);
  const parser = new Parser(lexer);
  const mod = parser.parseModule();

  // If the imported module has parse errors, skip it
  if (parser.diagnostics.length > 0) return null;

  return mod;
}

/**
 * Resolve imports from the main module and collect class registries.
 * Handles both `import "mod" for Foo, Bar` (selective) and
 * `import "mod"` (bare — imports all top-level names).
 */
function resolveImports(
  module: Module,
  mainPath: string,
  moduleResolver: ModuleResolver,
  importedClasses: Map<string, ClassInfo>,
  importedNames: string[],
  visited = new Set<string>(),
): void {
  // Prevent circular imports
  visited.add(mainPath);

  for (const stmt of module.statements) {
    if (stmt.kind !== "ImportStmt") continue;
    const importStmt = stmt as ImportStmt;

    // Strip quotes from the path token text
    const moduleName = importStmt.path.text.replace(/^"|"$/g, "");

    const resolvedPath = moduleResolver.resolve(moduleName, mainPath);
    if (resolvedPath === null) continue;
    if (visited.has(resolvedPath)) continue;

    const source = moduleResolver.readModule(resolvedPath);
    if (source === null) continue;

    const importedModule = parseModule(source, resolvedPath);
    if (importedModule === null) continue;

    // Build class registry from the imported module
    const registry = buildClassRegistry(importedModule);

    // Collect top-level names from the imported module
    const topLevelNames = collectTopLevelNames(importedModule);

    if (importStmt.variables !== null) {
      // Selective import: import "mod" for Foo, Bar
      // Only import the named classes into the type-checker registry.
      // NOTE: The resolver already declares these names via visitImportStmt,
      // so we do NOT add them to importedNames (that would cause duplicates).
      for (const variable of importStmt.variables) {
        const name = variable.text;
        const classInfo = registry.get(name);
        if (classInfo && !importedClasses.has(name)) {
          importedClasses.set(name, classInfo);
        }
      }
    } else {
      // Bare import: import "mod"
      // Import all top-level names. These need to be registered in the
      // resolver since bare imports don't list variable names explicitly.
      for (const name of topLevelNames) {
        const classInfo = registry.get(name);
        if (classInfo && !importedClasses.has(name)) {
          importedClasses.set(name, classInfo);
        }
        importedNames.push(name);
      }
    }

    // Also import superclasses from the same module so the type-checker
    // can walk inheritance chains. For example, if we import Circle but
    // not Shape, we still need Shape's method info for inherited method checks.
    importSuperclasses(registry, importedClasses);

    // Recursively resolve imports from the imported module
    resolveImports(
      importedModule,
      resolvedPath,
      moduleResolver,
      importedClasses,
      importedNames,
      visited,
    );
  }
}

/**
 * Walk the superclass chain of all imported classes and ensure their
 * superclasses are also in the imported class registry.
 * This is needed so the type-checker can walk inheritance chains for
 * method resolution across module boundaries.
 */
function importSuperclasses(
  sourceRegistry: Map<string, ClassInfo>,
  importedClasses: Map<string, ClassInfo>,
): void {
  // Iterate until no more superclasses need to be added
  let changed = true;
  while (changed) {
    changed = false;
    for (const [, classInfo] of importedClasses) {
      if (classInfo.superclass && !importedClasses.has(classInfo.superclass)) {
        const superInfo = sourceRegistry.get(classInfo.superclass);
        if (superInfo) {
          importedClasses.set(classInfo.superclass, superInfo);
          changed = true;
        }
      }
    }
  }
}
