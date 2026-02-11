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
  TypeAnnotation,
} from "./ast.js";
import { RecursiveVisitor, visitExpr, visitStmt } from "./visitor.js";
import type { Diagnostic } from "./types.js";
import { DiagnosticSeverity } from "./types.js";

// Type environment: a stack of scopes mapping variable names to type names.
class TypeEnvironment {
  private scopes: Map<string, string>[] = [new Map()];

  push(): void {
    this.scopes.push(new Map());
  }

  pop(): void {
    this.scopes.pop();
  }

  set(name: string, typeName: string): void {
    this.scopes[this.scopes.length - 1]!.set(name, typeName);
  }

  get(name: string): string | null {
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      const scope = this.scopes[i]!;
      if (scope.has(name)) return scope.get(name)!;
    }
    return null;
  }
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

export class TypeChecker extends RecursiveVisitor {
  private env = new TypeEnvironment();
  private currentReturnType: string | null = null;
  readonly diagnostics: Diagnostic[];

  constructor(diagnostics: Diagnostic[]) {
    super();
    this.diagnostics = diagnostics;
  }

  check(node: Module): void {
    this.visitModule(node);
  }

  // --- Variable declarations ---

  override visitVarStmt(node: VarStmt): void {
    // Register type annotation
    if (node.typeAnnotation !== null) {
      this.env.set(node.name.text, node.typeAnnotation.name.text);
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
      this.env.set(node.variable.text, node.typeAnnotation.name.text);
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
      const declaredType = this.env.get(varName);
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

  // --- Method return types ---

  override visitMethod(node: Method): void {
    const previousReturnType = this.currentReturnType;

    // Enter method scope
    this.env.push();

    // Register parameter types
    if (node.parameters !== null) {
      for (const param of node.parameters) {
        if (param.typeAnnotation !== null) {
          this.env.set(param.name.text, param.typeAnnotation.name.text);
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
          this.env.set(param.name.text, param.typeAnnotation.name.text);
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
