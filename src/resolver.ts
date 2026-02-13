import type {
  Module,
  Body,
  CallExpr,
  BlockStmt,
  ClassStmt,
  ForStmt,
  ImportStmt,
  VarStmt,
} from "./ast.js";
import { Scope } from "./scope.js";
import { RecursiveVisitor, visitExpr, visitStmt } from "./visitor.js";
import type { Diagnostic } from "./types.js";

export class Resolver extends RecursiveVisitor {
  private scope: Scope;
  private hasBareImport = false;
  readonly diagnostics: Diagnostic[];

  constructor(diagnostics: Diagnostic[]) {
    super();
    this.diagnostics = diagnostics;
    this.scope = new Scope(diagnostics);
  }

  resolve(node: Module): void {
    this.visitModule(node);
  }

  override visitModule(node: Module): void {
    super.visitModule(node);
    // When bare imports exist (import "module" without `for`), skip forward
    // reference checks — the imported module may define those names.
    if (!this.hasBareImport) {
      this.scope.checkForwardReferences();
    }
  }

  override visitBody(node: Body): void {
    this.scope.begin();
    if (node.parameters !== null) {
      for (const param of node.parameters) {
        this.scope.declare(param.name);
      }
    }
    super.visitBody(node);
    this.scope.end();
  }

  override visitCallExpr(node: CallExpr): void {
    if (node.receiver !== null) {
      visitExpr(this, node.receiver);
    } else {
      this.scope.resolve(node.name);
    }

    if (node.arguments !== null) {
      for (const arg of node.arguments) {
        visitExpr(this, arg);
      }
    }

    if (node.blockArgument !== null) this.visitBody(node.blockArgument);
  }

  override visitBlockStmt(node: BlockStmt): void {
    this.scope.begin();
    super.visitBlockStmt(node);
    this.scope.end();
  }

  override visitClassStmt(node: ClassStmt): void {
    this.scope.declare(node.name);
    this.scope.beginClass();
    super.visitClassStmt(node);
    this.scope.endClass();
  }

  override visitForStmt(node: ForStmt): void {
    this.scope.begin();
    this.scope.declare(node.variable);
    super.visitForStmt(node);
    this.scope.end();
  }

  override visitImportStmt(node: ImportStmt): void {
    if (node.variables !== null) {
      for (const variable of node.variables) {
        this.scope.declare(variable);
      }
    } else {
      this.hasBareImport = true;
    }
    super.visitImportStmt(node);
  }

  override visitVarStmt(node: VarStmt): void {
    this.scope.declare(node.name);
    super.visitVarStmt(node);
  }
}
