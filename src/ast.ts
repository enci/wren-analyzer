import type { Token } from "./token.js";

// Type annotation: `: TypeName`
export interface TypeAnnotation {
  name: Token; // the type name token (e.g. "Num", "String")
}

// Parameter with optional type annotation
export interface Parameter {
  name: Token;
  typeAnnotation: TypeAnnotation | null;
}

// --- Module ---

export interface Module {
  kind: "Module";
  statements: Stmt[];
}

// --- Expressions ---

export interface NumExpr {
  kind: "NumExpr";
  value: Token;
}

export interface StringExpr {
  kind: "StringExpr";
  value: Token;
}

export interface BoolExpr {
  kind: "BoolExpr";
  value: Token;
}

export interface NullExpr {
  kind: "NullExpr";
  value: Token;
}

export interface ThisExpr {
  kind: "ThisExpr";
  keyword: Token;
}

export interface FieldExpr {
  kind: "FieldExpr";
  name: Token;
}

export interface StaticFieldExpr {
  kind: "StaticFieldExpr";
  name: Token;
}

export interface ListExpr {
  kind: "ListExpr";
  leftBracket: Token;
  elements: Expr[];
  rightBracket: Token;
}

export interface MapEntry {
  key: Expr;
  value: Expr;
}

export interface MapExpr {
  kind: "MapExpr";
  leftBrace: Token;
  entries: MapEntry[];
  rightBrace: Token;
}

export interface InterpolationExpr {
  kind: "InterpolationExpr";
  strings: Token[];
  expressions: Expr[];
}

export interface GroupingExpr {
  kind: "GroupingExpr";
  leftParen: Token;
  expression: Expr;
  rightParen: Token;
}

export interface PrefixExpr {
  kind: "PrefixExpr";
  operator: Token;
  right: Expr;
}

export interface InfixExpr {
  kind: "InfixExpr";
  left: Expr;
  operator: Token;
  right: Expr;
}

export interface CallExpr {
  kind: "CallExpr";
  receiver: Expr | null;
  name: Token;
  arguments: Expr[] | null;
  blockArgument: Body | null;
}

export interface SubscriptExpr {
  kind: "SubscriptExpr";
  receiver: Expr;
  leftBracket: Token;
  arguments: Expr[];
  rightBracket: Token;
}

export interface AssignmentExpr {
  kind: "AssignmentExpr";
  target: Expr;
  equal: Token;
  value: Expr;
}

export interface ConditionalExpr {
  kind: "ConditionalExpr";
  condition: Expr;
  question: Token;
  thenBranch: Expr;
  colon: Token;
  elseBranch: Expr;
}

export interface SuperExpr {
  kind: "SuperExpr";
  name: Token | null;
  arguments: Expr[] | null;
  blockArgument: Body | null;
}

export type Expr =
  | NumExpr
  | StringExpr
  | BoolExpr
  | NullExpr
  | ThisExpr
  | FieldExpr
  | StaticFieldExpr
  | ListExpr
  | MapExpr
  | InterpolationExpr
  | GroupingExpr
  | PrefixExpr
  | InfixExpr
  | CallExpr
  | SubscriptExpr
  | AssignmentExpr
  | ConditionalExpr
  | SuperExpr;

// --- Statements ---

export interface VarStmt {
  kind: "VarStmt";
  name: Token;
  typeAnnotation: TypeAnnotation | null;
  initializer: Expr | null;
}

export interface ClassStmt {
  kind: "ClassStmt";
  foreignKeyword: Token | null;
  name: Token;
  superclass: Token | null;
  methods: Method[];
}

export interface ImportStmt {
  kind: "ImportStmt";
  path: Token;
  variables: Token[] | null;
}

export interface IfStmt {
  kind: "IfStmt";
  condition: Expr;
  thenBranch: Stmt;
  elseBranch: Stmt | null;
}

export interface ForStmt {
  kind: "ForStmt";
  variable: Token;
  typeAnnotation: TypeAnnotation | null;
  iterator: Expr;
  body: Stmt;
}

export interface WhileStmt {
  kind: "WhileStmt";
  condition: Expr;
  body: Stmt;
}

export interface ReturnStmt {
  kind: "ReturnStmt";
  keyword: Token;
  value: Expr | null;
}

export interface BlockStmt {
  kind: "BlockStmt";
  statements: Stmt[];
}

export interface BreakStmt {
  kind: "BreakStmt";
  keyword: Token;
}

export interface ContinueStmt {
  kind: "ContinueStmt";
  keyword: Token;
}

export type Stmt =
  | VarStmt
  | ClassStmt
  | ImportStmt
  | IfStmt
  | ForStmt
  | WhileStmt
  | ReturnStmt
  | BlockStmt
  | BreakStmt
  | ContinueStmt
  | Expr;

// --- Method + Body ---

export interface Method {
  kind: "Method";
  foreignKeyword: Token | null;
  staticKeyword: Token | null;
  constructKeyword: Token | null;
  name: Token;
  parameters: Parameter[] | null;
  returnType: TypeAnnotation | null;
  body: Body | null;
}

export interface Body {
  kind: "Body";
  parameters: Parameter[] | null;
  expression: Expr | null;
  statements: Stmt[] | null;
}

// Node is any AST node
export type Node = Module | Expr | Stmt | Method | Body;
