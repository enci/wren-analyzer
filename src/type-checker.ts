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
} from "./ast.js";
import { RecursiveVisitor, visitExpr, visitStmt } from "./visitor.js";
import type { Diagnostic } from "./types.js";
import { DiagnosticSeverity } from "./types.js";

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
 * Registry of known class methods. Maps class name → method info.
 */
interface ClassInfo {
  instanceMethods: Set<string>;
  staticMethods: Set<string>;
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
 * Infer the type of an expression using both literal analysis and environment lookup.
 */
function inferExprType(expr: Expr, env: TypeEnvironment): string | null {
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
    return inferExprType(expr.expression, env);
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
function buildClassRegistry(module: Module): Map<string, ClassInfo> {
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
  const instanceMethods = new Set<string>();
  const staticMethods = new Set<string>();

  for (const method of cls.methods) {
    const name = method.name.text;
    if (method.staticKeyword !== null || method.constructKeyword !== null) {
      staticMethods.add(name);
    } else {
      instanceMethods.add(name);
    }

    // Setter variant: name= (registered in addition to the getter)
    if (method.isSetter) {
      const setterName = name + "=";
      if (method.staticKeyword !== null) {
        staticMethods.add(setterName);
      } else {
        instanceMethods.add(setterName);
      }
    }
  }

  const superclass = cls.superclass ? cls.superclass.text : null;
  registry.set(cls.name.text, { instanceMethods, staticMethods, superclass });
}

// Core classes always available in Wren — their methods are known.
// We only list commonly called methods to avoid false positives on operators.
const CORE_INSTANCE_METHODS = new Map<string, Set<string>>([
  ["Object", new Set(["toString", "type", "is"])],
  ["Bool", new Set(["toString"])],
  ["Null", new Set(["toString"])],
  ["Num", new Set([
    "abs", "acos", "asin", "atan", "cbrt", "ceil", "cos", "floor",
    "round", "sin", "sqrt", "tan", "log", "log2", "exp", "pow",
    "fraction", "truncate", "sign", "isInteger", "isNan", "isInfinity",
    "min", "max", "clamp", "toString",
  ])],
  ["String", new Set([
    "contains", "count", "endsWith", "indexOf", "replace", "split",
    "startsWith", "trim", "trimEnd", "trimStart", "bytes", "codePoints",
    "toString", "iterate", "iteratorValue",
  ])],
  ["List", new Set([
    "add", "addAll", "clear", "count", "indexOf", "insert", "iterate",
    "iteratorValue", "remove", "removeAt", "sort", "swap", "toString",
  ])],
  ["Map", new Set([
    "clear", "containsKey", "count", "keys", "values", "iterate",
    "remove", "toString",
  ])],
  ["Range", new Set([
    "from", "to", "min", "max", "isInclusive", "iterate",
    "iteratorValue", "toString",
  ])],
  ["Fiber", new Set([
    "call", "error", "isDone", "transfer", "transferError", "try",
  ])],
  ["Fn", new Set(["arity", "call", "toString"])],
  ["Sequence", new Set([
    "all", "any", "contains", "count", "each", "isEmpty", "map",
    "skip", "take", "where", "reduce", "join", "toList", "toString",
  ])],
]);

// Core class inheritance hierarchy (instance methods only — statics are not inherited).
const CORE_SUPERCLASS = new Map<string, string>([
  ["List", "Sequence"],
  ["Map", "Sequence"],
  ["Range", "Sequence"],
  ["String", "Sequence"],
]);

const CORE_STATIC_METHODS = new Map<string, Set<string>>([
  ["Object", new Set(["same"])],
  ["Num", new Set([
    "fromString", "infinity", "nan", "pi", "tau",
    "largest", "smallest", "maxSafeInteger", "minSafeInteger",
  ])],
  ["String", new Set(["fromCodePoint", "fromByte"])],
  ["List", new Set(["new", "filled"])],
  ["Map", new Set(["new"])],
  ["Fiber", new Set(["new", "abort", "current", "suspend", "yield"])],
  ["Fn", new Set(["new"])],
  ["System", new Set(["print", "printAll", "write", "writeAll", "clock", "gc"])],
]);

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

  check(node: Module): void {
    // Skip type-checking when the source has parse/resolve errors.
    // The AST is likely malformed and would produce nonsensical warnings.
    const hasErrors = this.diagnostics.some(
      (d) => d.severity === DiagnosticSeverity.Error,
    );
    if (hasErrors) return;

    // Pre-scan: build class registry from all ClassStmt in module
    this.classRegistry = buildClassRegistry(node);
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
      const initType = inferExprType(node.initializer, this.env);
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

    // Determine if this is a static call (PascalCase receiver) or instance call
    const receiverClassName = getReceiverClassName(node.receiver);

    if (receiverClassName) {
      // Static call: Foo.bar()
      this.checkStaticMethodExists(receiverClassName, methodName, node);
    } else {
      // Instance call: resolve receiver type
      const receiverType = this.inferReceiverType(node.receiver);
      // Skip Null — variables initialized to null (var f = null) are almost
      // always reassigned later (e.g. to a Fn), so Null is too weak to warn on.
      if (receiverType && receiverType !== "Null") {
        this.checkInstanceMethodExists(receiverType, methodName, node);
      }
    }
  }

  private checkStaticMethodExists(
    className: string,
    methodName: string,
    node: CallExpr,
  ): void {
    // `attributes` is a universal static method available on every class.
    if (methodName === "attributes") return;

    // Check user-defined classes
    const userClass = this.classRegistry.get(className);
    if (userClass) {
      if (!userClass.staticMethods.has(methodName)) {
        this.warn(
          `Class '${className}' does not define a static method '${methodName}'.`,
          node.name,
          "unknown-method",
        );
      }
      return;
    }

    // Check core classes
    const coreMethods = CORE_STATIC_METHODS.get(className);
    if (coreMethods) {
      if (!coreMethods.has(methodName)) {
        this.warn(
          `Class '${className}' does not define a static method '${methodName}'.`,
          node.name,
          "unknown-method",
        );
      }
      return;
    }

    // Unknown class — could be from an import, don't warn
  }

  private checkInstanceMethodExists(
    typeName: string,
    methodName: string,
    node: CallExpr,
  ): void {
    // Walk the superclass chain for user-defined classes.
    // Instance methods are inherited, so Bar inherits Foo's methods.
    let current: string | null = typeName;
    const visited = new Set<string>(); // guard against cycles

    let knownClass = false;

    while (current !== null) {
      if (visited.has(current)) break;
      visited.add(current);

      // Check user-defined class
      const userClass = this.classRegistry.get(current);
      if (userClass) {
        knownClass = true;
        if (userClass.instanceMethods.has(methodName)) return; // found it
        // Walk up to the superclass
        current = userClass.superclass;
        continue;
      }

      // Check core classes — walk their hierarchy too
      const coreMethods = CORE_INSTANCE_METHODS.get(current);
      if (coreMethods) {
        knownClass = true;
        if (coreMethods.has(methodName)) return; // found it
        // Walk up the core superclass chain (e.g. List → Sequence)
        current = CORE_SUPERCLASS.get(current) ?? null;
        continue;
      }

      // Reached a class we don't know about — stop walking
      break;
    }

    // Unknown type — could be from an import, don't warn
    if (!knownClass) return;

    // Exhausted the chain without finding the method.
    // Last check: Object's universal methods (toString, type, is)
    const objectMethods = CORE_INSTANCE_METHODS.get("Object");
    if (objectMethods && objectMethods.has(methodName)) return;

    this.warn(
      `Type '${typeName}' does not define an instance method '${methodName}'.`,
      node.name,
      "unknown-method",
    );
  }

  /**
   * Infer the type of a receiver expression.
   */
  private inferReceiverType(expr: Expr): string | null {
    // `this` → current class
    if (expr.kind === "ThisExpr") {
      return this.currentClassName;
    }

    // Variable reference: CallExpr { receiver: null, name: "foo", arguments: null }
    if (
      expr.kind === "CallExpr" &&
      expr.receiver === null &&
      expr.arguments === null
    ) {
      return this.env.get(expr.name.text);
    }

    // Literal types
    return inferType(expr);
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
