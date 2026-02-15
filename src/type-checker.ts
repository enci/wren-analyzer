import type {
  Module,
  Expr,
  Method,
  Body,
  VarStmt,
  ForStmt,
  ReturnStmt,
  AssignmentExpr,
  CallExpr,
  ClassStmt,
  TypeAnnotation,
  InfixExpr,
  PrefixExpr,
} from "./ast.js";
import { RecursiveVisitor, visitExpr, visitStmt } from "./visitor.js";
import type { Diagnostic } from "./types.js";
import { DiagnosticSeverity } from "./types.js";
import { getCoreRegistry } from "./core/core-registry.js";

// Type environment: a stack of scopes mapping variable names to type names.
// Tracks both explicitly declared types (annotations) and inferred types separately.
// Assignment checks only use declared types; method-existence checks use both.
class TypeEnvironment {
  private declaredScopes: Map<string, string>[] = [new Map()];
  private inferredScopes: Map<string, string>[] = [new Map()];

  push(): void {
    this.declaredScopes.push(new Map());
    this.inferredScopes.push(new Map());
  }

  pop(): void {
    this.declaredScopes.pop();
    this.inferredScopes.pop();
  }

  /** Register an explicitly annotated type (used for assignment checking). */
  setDeclared(name: string, typeName: string): void {
    this.declaredScopes[this.declaredScopes.length - 1]!.set(name, typeName);
    // Also set in inferred so method-existence can find it
    this.inferredScopes[this.inferredScopes.length - 1]!.set(name, typeName);
  }

  /** Register an inferred type (NOT used for assignment checking). */
  setInferred(name: string, typeName: string): void {
    this.inferredScopes[this.inferredScopes.length - 1]!.set(name, typeName);
  }

  /** Get explicitly declared type (for assignment checking). */
  getDeclared(name: string): string | null {
    for (let i = this.declaredScopes.length - 1; i >= 0; i--) {
      const scope = this.declaredScopes[i]!;
      if (scope.has(name)) return scope.get(name)!;
    }
    return null;
  }

  /** Get type (declared or inferred — for method-existence checking). */
  get(name: string): string | null {
    for (let i = this.inferredScopes.length - 1; i >= 0; i--) {
      const scope = this.inferredScopes[i]!;
      if (scope.has(name)) return scope.get(name)!;
    }
    return null;
  }
}

/**
 * A method set that tracks arities and return types per method name.
 * In Wren, `foo` (getter), `foo()` (zero-arg), and `foo(_)` (one-arg)
 * are distinct method signatures.
 * Arity -1 represents a getter (no parentheses).
 */
class MethodSet {
  // name → (arity → return type). Return type is null when not annotated.
  private methods = new Map<string, Map<number, string | null>>();

  add(name: string, arity: number, returnType: string | null = null): void {
    let arities = this.methods.get(name);
    if (!arities) {
      arities = new Map();
      this.methods.set(name, arities);
    }
    arities.set(arity, returnType);
  }

  /** Check if a method with this name exists at any arity. */
  has(name: string): boolean {
    return this.methods.has(name);
  }

  /** Check if a method with this exact name and arity exists. */
  hasArity(name: string, arity: number): boolean {
    const arities = this.methods.get(name);
    return arities !== undefined && arities.has(arity);
  }

  /** Get the set of known arities for a method name. */
  getArities(name: string): Set<number> | undefined {
    const inner = this.methods.get(name);
    if (!inner) return undefined;
    return new Set(inner.keys());
  }

  /**
   * Get the annotated return type for a specific method signature.
   * Returns `undefined` if the method/arity doesn't exist,
   * `null` if it exists but has no return type annotation,
   * or a type name string if annotated.
   */
  getReturnType(name: string, arity: number): string | null | undefined {
    const arities = this.methods.get(name);
    if (!arities) return undefined;
    if (!arities.has(arity)) return undefined;
    return arities.get(arity)!;
  }
}

/**
 * Registry of known class methods. Maps class name → method info.
 */
export interface ClassInfo {
  instanceMethods: MethodSet;
  staticMethods: MethodSet;
  superclass: string | null;
}

// Infer the type of a literal expression. Returns null for complex expressions.
function inferType(expr: Expr): string | null {
  switch (expr.kind) {
    case "NumExpr":
      return "Num";
    case "StringExpr":
      return "String";
    case "BoolExpr":
      return "Bool";
    case "NullExpr":
      return "Null";
    case "ListExpr":
      return "List";
    case "MapExpr":
      return "Map";
    case "InterpolationExpr":
      return "String";
    default:
      return null;
  }
}

/**
 * Infer the type of an expression using literal analysis, environment lookup,
 * and method return type resolution from the class registry.
 */
function inferExprType(
  expr: Expr,
  env: TypeEnvironment,
  classRegistry: Map<string, ClassInfo> = new Map(),
  currentClassName: string | null = null,
  depth: number = 0,
): string | null {
  // Guard against excessively deep recursion in pathological ASTs
  if (depth > 10) return null;

  // Literal types
  const literal = inferType(expr);
  if (literal !== null) return literal;

  // Variable reference: look up in environment
  // In Wren, a bare identifier `foo` is parsed as CallExpr { receiver: null, name: "foo", arguments: null }
  if (
    expr.kind === "CallExpr" &&
    expr.receiver === null &&
    expr.arguments === null
  ) {
    return env.get(expr.name.text);
  }

  // Constructor call: Foo.new() → type is Foo
  if (expr.kind === "CallExpr" && expr.receiver !== null) {
    if (expr.name.text === "new") {
      const receiverName = getReceiverClassName(expr.receiver);
      if (receiverName) return receiverName;
    }
  }

  // Grouping: (expr)
  if (expr.kind === "GroupingExpr") {
    return inferExprType(expr.expression, env, classRegistry, currentClassName, depth + 1);
  }

  // Method call on a known-type receiver → look up return type in registry
  if (expr.kind === "CallExpr" && expr.receiver !== null) {
    const methodName = expr.name.text;
    const arity = expr.arguments === null ? -1 : expr.arguments.length;

    const receiverClassName = getReceiverClassName(expr.receiver);
    if (receiverClassName) {
      // Static call: Foo.bar()
      const cls = classRegistry.get(receiverClassName);
      if (cls) {
        const rt = cls.staticMethods.getReturnType(methodName, arity);
        if (rt) return rt;
      }
    } else {
      // Instance call: resolve receiver type, then look up return type
      const receiverType = inferReceiverType(
        expr.receiver, env, classRegistry, currentClassName, depth + 1,
      );
      if (receiverType) {
        const rt = lookupInstanceReturnType(receiverType, methodName, arity, classRegistry);
        if (rt) return rt;
      }
    }
  }

  // InfixExpr: operators are method calls on the left operand (arity 1)
  if (expr.kind === "InfixExpr") {
    const leftType = inferExprType(
      (expr as InfixExpr).left, env, classRegistry, currentClassName, depth + 1,
    );
    if (leftType) {
      const rt = lookupInstanceReturnType(leftType, (expr as InfixExpr).operator.text, 1, classRegistry);
      if (rt) return rt;
    }
  }

  // PrefixExpr: prefix operators are getters (arity -1), e.g. `-x`, `!x`, `~x`
  if (expr.kind === "PrefixExpr") {
    const operandType = inferExprType(
      (expr as PrefixExpr).right, env, classRegistry, currentClassName, depth + 1,
    );
    if (operandType) {
      const rt = lookupInstanceReturnType(operandType, (expr as PrefixExpr).operator.text, -1, classRegistry);
      if (rt) return rt;
    }
  }

  return null;
}

/**
 * Infer the type of a receiver expression (for method call type checking).
 * Supports `this`, variable references, literals, and chained method calls.
 */
function inferReceiverType(
  expr: Expr,
  env: TypeEnvironment,
  classRegistry: Map<string, ClassInfo>,
  currentClassName: string | null,
  depth: number = 0,
): string | null {
  // `this` → current class
  if (expr.kind === "ThisExpr") {
    return currentClassName;
  }

  // Variable reference
  if (
    expr.kind === "CallExpr" &&
    expr.receiver === null &&
    expr.arguments === null
  ) {
    return env.get(expr.name.text);
  }

  // Literal types
  const literal = inferType(expr);
  if (literal !== null) return literal;

  // Chained method call: infer through the full expression
  return inferExprType(expr, env, classRegistry, currentClassName, depth);
}

/**
 * Look up the return type of an instance method, walking the superclass chain.
 */
function lookupInstanceReturnType(
  typeName: string,
  methodName: string,
  arity: number,
  classRegistry: Map<string, ClassInfo>,
): string | null {
  let current: string | null = typeName;
  const visited = new Set<string>();

  while (current !== null) {
    if (visited.has(current)) break;
    visited.add(current);

    const cls = classRegistry.get(current);
    if (!cls) break;

    const rt = cls.instanceMethods.getReturnType(methodName, arity);
    if (rt !== undefined) return rt; // found (null = no annotation, string = type)

    current = cls.superclass;
  }

  // Fall back to Object (universal base)
  if (!visited.has("Object")) {
    const objectClass = classRegistry.get("Object");
    if (objectClass) {
      const rt = objectClass.instanceMethods.getReturnType(methodName, arity);
      if (rt !== undefined) return rt;
    }
  }

  return null;
}

/**
 * Extract the class name from a receiver expression (for Foo.new() patterns).
 * In Wren, `Foo` alone is CallExpr { receiver: null, name: "Foo", arguments: null }
 */
function getReceiverClassName(expr: Expr): string | null {
  if (
    expr.kind === "CallExpr" &&
    expr.receiver === null &&
    expr.arguments === null
  ) {
    if (/^[A-Z]/.test(expr.name.text)) {
      return expr.name.text;
    }
  }
  return null;
}

/**
 * Build a class registry from all ClassStmt nodes in the module.
 */
export function buildClassRegistry(module: Module): Map<string, ClassInfo> {
  const registry = new Map<string, ClassInfo>();

  for (const stmt of module.statements) {
    if (stmt.kind === "ClassStmt") {
      registerClass(registry, stmt);
    }
  }

  return registry;
}

function registerClass(
  registry: Map<string, ClassInfo>,
  cls: ClassStmt,
): void {
  const instanceMethods = new MethodSet();
  const staticMethods = new MethodSet();

  for (const method of cls.methods) {
    const name = method.name.text;
    // Arity: -1 for getters (no parens), otherwise parameter count
    const arity = method.parameters === null ? -1 : method.parameters.length;

    // Extract return type annotation. Constructors implicitly return the class.
    const annotatedReturnType = method.returnType
      ? method.returnType.name.text
      : null;
    const returnType =
      method.constructKeyword !== null ? cls.name.text : annotatedReturnType;

    if (method.staticKeyword !== null || method.constructKeyword !== null) {
      staticMethods.add(name, arity, returnType);
    } else {
      instanceMethods.add(name, arity, returnType);
    }

    // Setter variant: name= (registered in addition to the base name).
    // Also register the base name as a getter (arity -1) since setter syntax
    // `foo.bar = value` is parsed as a getter access on the LHS.
    if (method.isSetter) {
      const setterName = name + "=";
      if (method.staticKeyword !== null) {
        staticMethods.add(setterName, arity);
        staticMethods.add(name, -1);
      } else {
        instanceMethods.add(setterName, arity);
        instanceMethods.add(name, -1);
      }
    }
  }

  const superclass = cls.superclass ? cls.superclass.text : null;
  registry.set(cls.name.text, { instanceMethods, staticMethods, superclass });
}

// Core classes are now loaded from parsed Wren stub files (see core/stubs.ts).
// The getCoreRegistry() function returns a Map<string, ClassInfo> with full
// arity tracking — a strict upgrade over the previous Set<string> approach.

export class TypeChecker extends RecursiveVisitor {
  private env = new TypeEnvironment();
  private currentReturnType: string | null = null;
  private currentClassName: string | null = null;
  private classRegistry = new Map<string, ClassInfo>();
  readonly diagnostics: Diagnostic[];

  constructor(diagnostics: Diagnostic[]) {
    super();
    this.diagnostics = diagnostics;
  }

  check(
    node: Module,
    importedClasses?: Map<string, ClassInfo>,
  ): void {
    // Skip type-checking when the source has parse/resolve errors.
    // The AST is likely malformed and would produce nonsensical warnings.
    const hasErrors = this.diagnostics.some(
      (d) => d.severity === DiagnosticSeverity.Error,
    );
    if (hasErrors) return;

    // Pre-scan: build class registry from all ClassStmt in module
    this.classRegistry = buildClassRegistry(node);

    // Merge in classes from imported modules (imported first so local wins)
    if (importedClasses) {
      for (const [name, info] of importedClasses) {
        if (!this.classRegistry.has(name)) {
          this.classRegistry.set(name, info);
        }
      }
    }

    // Merge core classes (Object, Num, String, List, etc.) into the registry.
    // User-defined and imported classes take precedence.
    for (const [name, info] of getCoreRegistry()) {
      if (!this.classRegistry.has(name)) {
        this.classRegistry.set(name, info);
      }
    }

    this.visitModule(node);
  }

  // --- Class tracking ---

  override visitClassStmt(node: ClassStmt): void {
    const previousClassName = this.currentClassName;
    this.currentClassName = node.name.text;
    super.visitClassStmt(node);
    this.currentClassName = previousClassName;
  }

  // --- Variable declarations ---

  override visitVarStmt(node: VarStmt): void {
    // Register type annotation (explicit → used for assignment checks)
    if (node.typeAnnotation !== null) {
      this.env.setDeclared(node.name.text, node.typeAnnotation.name.text);
    } else if (node.initializer !== null) {
      // Infer type from initializer (inferred → only for method-existence checks)
      const initType = inferExprType(
        node.initializer, this.env, this.classRegistry, this.currentClassName,
      );
      if (initType !== null) {
        this.env.setInferred(node.name.text, initType);
      }
    }

    // Check initializer against annotation
    if (node.typeAnnotation !== null && node.initializer !== null) {
      const initType = inferType(node.initializer);
      if (initType !== null && initType !== node.typeAnnotation.name.text) {
        this.warn(
          `Variable '${node.name.text}' is declared as ${node.typeAnnotation.name.text} but initialized with a ${initType} value.`,
          node.initializer,
          "type-mismatch",
        );
      }
    }

    // Check: typed var with no initializer gets null
    if (
      node.typeAnnotation !== null &&
      node.initializer === null &&
      node.typeAnnotation.name.text !== "Null"
    ) {
      this.warn(
        `Variable '${node.name.text}' is declared as ${node.typeAnnotation.name.text} but has no initializer (defaults to Null).`,
        node.name,
        "type-mismatch",
      );
    }

    super.visitVarStmt(node);
  }

  // --- For loop variable ---

  override visitForStmt(node: ForStmt): void {
    if (node.typeAnnotation !== null) {
      this.env.push();
      this.env.setDeclared(node.variable.text, node.typeAnnotation.name.text);
      visitExpr(this, node.iterator);
      visitStmt(this, node.body);
      this.env.pop();
    } else {
      super.visitForStmt(node);
    }
  }

  // --- Assignments ---

  override visitAssignmentExpr(node: AssignmentExpr): void {
    // Check if target is a variable with a type annotation
    if (node.target.kind === "CallExpr" && node.target.receiver === null) {
      const varName = node.target.name.text;
      const declaredType = this.env.getDeclared(varName);
      if (declaredType !== null) {
        const valueType = inferType(node.value);
        if (valueType !== null && valueType !== declaredType) {
          this.warn(
            `Variable '${varName}' is declared as ${declaredType} but assigned a ${valueType} value.`,
            node.value,
            "type-mismatch",
          );
        }
      }
    }

    super.visitAssignmentExpr(node);
  }

  // --- Method calls: check method existence ---

  override visitCallExpr(node: CallExpr): void {
    if (node.receiver !== null) {
      this.checkMethodExists(node);
    }

    // Continue visiting children
    super.visitCallExpr(node);
  }

  private checkMethodExists(node: CallExpr): void {
    if (node.receiver === null) return;

    const methodName = node.name.text;
    // Arity: -1 for getter access (no parens), otherwise argument count
    const arity = node.arguments === null ? -1 : node.arguments.length;

    // Determine if this is a static call (PascalCase receiver) or instance call
    const receiverClassName = getReceiverClassName(node.receiver);

    if (receiverClassName) {
      // Static call: Foo.bar()
      this.checkStaticMethodExists(receiverClassName, methodName, arity, node);
    } else {
      // Instance call: resolve receiver type
      const receiverType = this.inferReceiverType(node.receiver);
      // Skip Null — variables initialized to null (var f = null) are almost
      // always reassigned later (e.g. to a Fn), so Null is too weak to warn on.
      if (receiverType && receiverType !== "Null") {
        this.checkInstanceMethodExists(receiverType, methodName, arity, node);
      }
    }
  }

  private checkStaticMethodExists(
    className: string,
    methodName: string,
    arity: number,
    node: CallExpr,
  ): void {
    // `attributes` is a universal static method available on every class.
    if (methodName === "attributes") return;

    // Look up in the unified registry (user-defined + imported + core)
    const cls = this.classRegistry.get(className);
    if (!cls) return; // Unknown class — could be from an import, don't warn

    if (!cls.staticMethods.has(methodName)) {
      this.warn(
        `Class '${className}' does not define a static method '${methodName}'.`,
        node.name,
        "unknown-method",
      );
    } else if (!cls.staticMethods.hasArity(methodName, arity)) {
      const arityDesc = arity === -1 ? "a getter" : `a method with ${arity} argument${arity === 1 ? "" : "s"}`;
      this.warn(
        `Class '${className}' defines '${methodName}' but not as ${arityDesc}.`,
        node.name,
        "wrong-arity",
      );
    }
  }

  private checkInstanceMethodExists(
    typeName: string,
    methodName: string,
    arity: number,
    node: CallExpr,
  ): void {
    // Walk the superclass chain (unified registry: user + imported + core).
    // Instance methods are inherited, so Bar inherits Foo's methods.
    let current: string | null = typeName;
    const visited = new Set<string>(); // guard against cycles

    let knownClass = false;
    // Track whether we found the name at any arity (for arity mismatch messages)
    let foundName = false;

    while (current !== null) {
      if (visited.has(current)) break;
      visited.add(current);

      const cls = this.classRegistry.get(current);
      if (!cls) break; // Reached a class we don't know about — stop walking

      knownClass = true;
      if (cls.instanceMethods.hasArity(methodName, arity)) return; // exact match
      if (cls.instanceMethods.has(methodName)) foundName = true;
      // Walk up to the superclass
      current = cls.superclass;
    }

    // Unknown type — could be from an import, don't warn
    if (!knownClass) return;

    // Exhausted the chain without finding the method.
    // Last check: Object's universal methods (toString, type, is)
    const objectClass = this.classRegistry.get("Object");
    if (objectClass && objectClass.instanceMethods.hasArity(methodName, arity)) return;
    if (objectClass && objectClass.instanceMethods.has(methodName)) foundName = true;

    if (foundName) {
      // The method name exists but not at the called arity
      const arityDesc = arity === -1 ? "a getter" : `a method with ${arity} argument${arity === 1 ? "" : "s"}`;
      this.warn(
        `Type '${typeName}' defines '${methodName}' but not as ${arityDesc}.`,
        node.name,
        "wrong-arity",
      );
    } else {
      this.warn(
        `Type '${typeName}' does not define an instance method '${methodName}'.`,
        node.name,
        "unknown-method",
      );
    }
  }

  /**
   * Infer the type of a receiver expression.
   */
  private inferReceiverType(expr: Expr): string | null {
    return inferReceiverType(
      expr, this.env, this.classRegistry, this.currentClassName,
    );
  }

  // --- Method return types ---

  override visitMethod(node: Method): void {
    const previousReturnType = this.currentReturnType;

    // Enter method scope
    this.env.push();

    // Register parameter types
    if (node.parameters !== null) {
      for (const param of node.parameters) {
        if (param.typeAnnotation !== null) {
          this.env.setDeclared(param.name.text, param.typeAnnotation.name.text);
        }
      }
    }

    // Track return type
    if (node.returnType !== null) {
      this.currentReturnType = node.returnType.name.text;
    } else {
      this.currentReturnType = null;
    }

    if (node.body !== null) {
      this.visitBody(node.body);
    }

    this.env.pop();
    this.currentReturnType = previousReturnType;
  }

  override visitBody(node: Body): void {
    this.env.push();

    // Register block parameter types
    if (node.parameters !== null) {
      for (const param of node.parameters) {
        if (param.typeAnnotation !== null) {
          this.env.setDeclared(param.name.text, param.typeAnnotation.name.text);
        }
      }
    }

    if (node.expression !== null) {
      // Single-expression body: check as implicit return
      if (this.currentReturnType !== null) {
        const exprType = inferType(node.expression);
        if (exprType !== null && exprType !== this.currentReturnType) {
          this.warn(
            `Method expects return type ${this.currentReturnType} but returns a ${exprType} value.`,
            node.expression,
            "type-mismatch",
          );
        }
      }
      visitExpr(this, node.expression);
    }

    if (node.statements !== null) {
      for (const stmt of node.statements) {
        visitStmt(this, stmt);
      }
    }

    this.env.pop();
  }

  override visitReturnStmt(node: ReturnStmt): void {
    if (this.currentReturnType !== null) {
      if (node.value !== null) {
        const valueType = inferType(node.value);
        if (valueType !== null && valueType !== this.currentReturnType) {
          this.warn(
            `Method expects return type ${this.currentReturnType} but returns a ${valueType} value.`,
            node.value,
            "type-mismatch",
          );
        }
      } else {
        // Bare return in a typed method: implicit null return
        if (this.currentReturnType !== "Null") {
          this.warn(
            `Method expects return type ${this.currentReturnType} but returns with no value (Null).`,
            node.keyword,
            "type-mismatch",
          );
        }
      }
    }

    super.visitReturnStmt(node);
  }

  // --- Helpers ---

  private warn(
    message: string,
    node: Expr | import("./token.js").Token,
    code: string,
  ): void {
    let spanStart: number;
    let spanLength: number;

    if ("kind" in node) {
      const span = exprSpan(node);
      spanStart = span.start;
      spanLength = span.length;
    } else {
      spanStart = node.start;
      spanLength = node.length;
    }

    this.diagnostics.push({
      message,
      severity: DiagnosticSeverity.Warning,
      span: { start: spanStart, length: spanLength },
      source: "wren-analyzer",
      code,
    });
  }
}

// Get a reasonable span for an expression node
function exprSpan(expr: Expr): { start: number; length: number } {
  switch (expr.kind) {
    case "NumExpr":
      return { start: expr.value.start, length: expr.value.length };
    case "StringExpr":
      return { start: expr.value.start, length: expr.value.length };
    case "BoolExpr":
      return { start: expr.value.start, length: expr.value.length };
    case "NullExpr":
      return { start: expr.value.start, length: expr.value.length };
    case "ListExpr":
      return {
        start: expr.leftBracket.start,
        length:
          expr.rightBracket.start +
          expr.rightBracket.length -
          expr.leftBracket.start,
      };
    case "MapExpr":
      return {
        start: expr.leftBrace.start,
        length:
          expr.rightBrace.start +
          expr.rightBrace.length -
          expr.leftBrace.start,
      };
    case "InterpolationExpr":
      return {
        start: expr.strings[0]!.start,
        length: expr.strings[0]!.length,
      };
    case "CallExpr":
      return { start: expr.name.start, length: expr.name.length };
    case "InfixExpr":
      return { start: expr.operator.start, length: expr.operator.length };
    case "PrefixExpr":
      return { start: expr.operator.start, length: expr.operator.length };
    case "AssignmentExpr":
      return { start: expr.equal.start, length: expr.equal.length };
    case "GroupingExpr":
      return { start: expr.leftParen.start, length: expr.leftParen.length };
    case "ConditionalExpr":
      return { start: expr.question.start, length: expr.question.length };
    case "SubscriptExpr":
      return {
        start: expr.leftBracket.start,
        length: expr.leftBracket.length,
      };
    case "SuperExpr":
      return expr.name
        ? { start: expr.name.start, length: expr.name.length }
        : { start: 0, length: 0 };
    case "ThisExpr":
      return { start: expr.keyword.start, length: expr.keyword.length };
    case "FieldExpr":
      return { start: expr.name.start, length: expr.name.length };
    case "StaticFieldExpr":
      return { start: expr.name.start, length: expr.name.length };
  }
}
