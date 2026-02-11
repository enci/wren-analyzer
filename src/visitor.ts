import type {
  Module,
  Expr,
  Stmt,
  Method,
  Body,
  NumExpr,
  StringExpr,
  BoolExpr,
  NullExpr,
  ThisExpr,
  FieldExpr,
  StaticFieldExpr,
  ListExpr,
  MapExpr,
  InterpolationExpr,
  GroupingExpr,
  PrefixExpr,
  InfixExpr,
  CallExpr,
  SubscriptExpr,
  AssignmentExpr,
  ConditionalExpr,
  SuperExpr,
  VarStmt,
  ClassStmt,
  ImportStmt,
  IfStmt,
  ForStmt,
  WhileStmt,
  ReturnStmt,
  BlockStmt,
  BreakStmt,
} from "./ast.js";

export interface AstVisitor {
  visitModule(node: Module): void;
  visitMethod(node: Method): void;
  visitBody(node: Body): void;

  // Expressions
  visitNumExpr(node: NumExpr): void;
  visitStringExpr(node: StringExpr): void;
  visitBoolExpr(node: BoolExpr): void;
  visitNullExpr(node: NullExpr): void;
  visitThisExpr(node: ThisExpr): void;
  visitFieldExpr(node: FieldExpr): void;
  visitStaticFieldExpr(node: StaticFieldExpr): void;
  visitListExpr(node: ListExpr): void;
  visitMapExpr(node: MapExpr): void;
  visitInterpolationExpr(node: InterpolationExpr): void;
  visitGroupingExpr(node: GroupingExpr): void;
  visitPrefixExpr(node: PrefixExpr): void;
  visitInfixExpr(node: InfixExpr): void;
  visitCallExpr(node: CallExpr): void;
  visitSubscriptExpr(node: SubscriptExpr): void;
  visitAssignmentExpr(node: AssignmentExpr): void;
  visitConditionalExpr(node: ConditionalExpr): void;
  visitSuperExpr(node: SuperExpr): void;

  // Statements
  visitVarStmt(node: VarStmt): void;
  visitClassStmt(node: ClassStmt): void;
  visitImportStmt(node: ImportStmt): void;
  visitIfStmt(node: IfStmt): void;
  visitForStmt(node: ForStmt): void;
  visitWhileStmt(node: WhileStmt): void;
  visitReturnStmt(node: ReturnStmt): void;
  visitBlockStmt(node: BlockStmt): void;
  visitBreakStmt(node: BreakStmt): void;
}

export function visitExpr(visitor: AstVisitor, node: Expr): void {
  switch (node.kind) {
    case "NumExpr": return visitor.visitNumExpr(node);
    case "StringExpr": return visitor.visitStringExpr(node);
    case "BoolExpr": return visitor.visitBoolExpr(node);
    case "NullExpr": return visitor.visitNullExpr(node);
    case "ThisExpr": return visitor.visitThisExpr(node);
    case "FieldExpr": return visitor.visitFieldExpr(node);
    case "StaticFieldExpr": return visitor.visitStaticFieldExpr(node);
    case "ListExpr": return visitor.visitListExpr(node);
    case "MapExpr": return visitor.visitMapExpr(node);
    case "InterpolationExpr": return visitor.visitInterpolationExpr(node);
    case "GroupingExpr": return visitor.visitGroupingExpr(node);
    case "PrefixExpr": return visitor.visitPrefixExpr(node);
    case "InfixExpr": return visitor.visitInfixExpr(node);
    case "CallExpr": return visitor.visitCallExpr(node);
    case "SubscriptExpr": return visitor.visitSubscriptExpr(node);
    case "AssignmentExpr": return visitor.visitAssignmentExpr(node);
    case "ConditionalExpr": return visitor.visitConditionalExpr(node);
    case "SuperExpr": return visitor.visitSuperExpr(node);
  }
}

export function visitStmt(visitor: AstVisitor, node: Stmt): void {
  switch (node.kind) {
    case "VarStmt": return visitor.visitVarStmt(node);
    case "ClassStmt": return visitor.visitClassStmt(node);
    case "ImportStmt": return visitor.visitImportStmt(node);
    case "IfStmt": return visitor.visitIfStmt(node);
    case "ForStmt": return visitor.visitForStmt(node);
    case "WhileStmt": return visitor.visitWhileStmt(node);
    case "ReturnStmt": return visitor.visitReturnStmt(node);
    case "BlockStmt": return visitor.visitBlockStmt(node);
    case "BreakStmt": return visitor.visitBreakStmt(node);
    default: return visitExpr(visitor, node);
  }
}

export class RecursiveVisitor implements AstVisitor {
  visitModule(node: Module): void {
    for (const stmt of node.statements) {
      visitStmt(this, stmt);
    }
  }

  visitMethod(node: Method): void {
    if (node.body !== null) this.visitBody(node.body);
  }

  visitBody(node: Body): void {
    if (node.expression !== null) visitExpr(this, node.expression);
    if (node.statements !== null) {
      for (const stmt of node.statements) {
        visitStmt(this, stmt);
      }
    }
  }

  // Expressions

  visitNumExpr(_node: NumExpr): void {}
  visitStringExpr(_node: StringExpr): void {}
  visitBoolExpr(_node: BoolExpr): void {}
  visitNullExpr(_node: NullExpr): void {}
  visitThisExpr(_node: ThisExpr): void {}
  visitFieldExpr(_node: FieldExpr): void {}
  visitStaticFieldExpr(_node: StaticFieldExpr): void {}

  visitListExpr(node: ListExpr): void {
    for (const element of node.elements) {
      visitExpr(this, element);
    }
  }

  visitMapExpr(node: MapExpr): void {
    for (const entry of node.entries) {
      visitExpr(this, entry.key);
      visitExpr(this, entry.value);
    }
  }

  visitInterpolationExpr(node: InterpolationExpr): void {
    for (const expr of node.expressions) {
      visitExpr(this, expr);
    }
  }

  visitGroupingExpr(node: GroupingExpr): void {
    visitExpr(this, node.expression);
  }

  visitPrefixExpr(node: PrefixExpr): void {
    visitExpr(this, node.right);
  }

  visitInfixExpr(node: InfixExpr): void {
    visitExpr(this, node.left);
    visitExpr(this, node.right);
  }

  visitCallExpr(node: CallExpr): void {
    if (node.receiver !== null) visitExpr(this, node.receiver);
    if (node.arguments !== null) {
      for (const arg of node.arguments) {
        visitExpr(this, arg);
      }
    }
    if (node.blockArgument !== null) this.visitBody(node.blockArgument);
  }

  visitSubscriptExpr(node: SubscriptExpr): void {
    visitExpr(this, node.receiver);
    for (const arg of node.arguments) {
      visitExpr(this, arg);
    }
  }

  visitAssignmentExpr(node: AssignmentExpr): void {
    visitExpr(this, node.target);
    visitExpr(this, node.value);
  }

  visitConditionalExpr(node: ConditionalExpr): void {
    visitExpr(this, node.condition);
    visitExpr(this, node.thenBranch);
    visitExpr(this, node.elseBranch);
  }

  visitSuperExpr(node: SuperExpr): void {
    if (node.arguments !== null) {
      for (const arg of node.arguments) {
        visitExpr(this, arg);
      }
    }
    if (node.blockArgument !== null) this.visitBody(node.blockArgument);
  }

  // Statements

  visitVarStmt(node: VarStmt): void {
    if (node.initializer !== null) visitExpr(this, node.initializer);
  }

  visitClassStmt(node: ClassStmt): void {
    for (const method of node.methods) {
      this.visitMethod(method);
    }
  }

  visitImportStmt(_node: ImportStmt): void {}

  visitIfStmt(node: IfStmt): void {
    visitExpr(this, node.condition);
    visitStmt(this, node.thenBranch);
    if (node.elseBranch !== null) visitStmt(this, node.elseBranch);
  }

  visitForStmt(node: ForStmt): void {
    visitExpr(this, node.iterator);
    visitStmt(this, node.body);
  }

  visitWhileStmt(node: WhileStmt): void {
    visitExpr(this, node.condition);
    visitStmt(this, node.body);
  }

  visitReturnStmt(node: ReturnStmt): void {
    if (node.value !== null) visitExpr(this, node.value);
  }

  visitBlockStmt(node: BlockStmt): void {
    for (const stmt of node.statements) {
      visitStmt(this, stmt);
    }
  }

  visitBreakStmt(_node: BreakStmt): void {}
}
