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
} from "./ast.js";

export { RecursiveVisitor, visitExpr, visitStmt } from "./visitor.js";
export type { AstVisitor } from "./visitor.js";

import { Lexer } from "./lexer.js";
import { Parser } from "./parser.js";
import { Resolver } from "./resolver.js";
import { TypeChecker } from "./type-checker.js";
import { SourceFile } from "./source-file.js";
import type { Diagnostic, Span } from "./types.js";
import type { Module } from "./ast.js";

export interface AnalysisResult {
  module: Module;
  diagnostics: Diagnostic[];
}

/** Lightweight parse: lexer + parser only (no resolver/type-checker). */
export function parseOnly(source: string, path = "<input>"): AnalysisResult {
  const file = new SourceFile(path, source);
  const lexer = new Lexer(file);
  const parser = new Parser(lexer);
  const module = parser.parseModule();

  return { module, diagnostics: [...parser.diagnostics] };
}

/** Full analysis: lexer + parser + resolver + type-checker. */
export function analyze(source: string, path = "<input>"): AnalysisResult {
  const file = new SourceFile(path, source);
  const lexer = new Lexer(file);
  const parser = new Parser(lexer);
  const module = parser.parseModule();

  const diagnostics: Diagnostic[] = [...parser.diagnostics];

  const resolver = new Resolver(diagnostics);
  resolver.resolve(module);

  const typeChecker = new TypeChecker(diagnostics);
  typeChecker.check(module);

  return { module, diagnostics };
}
