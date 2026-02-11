import { describe, it, expect } from "vitest";
import { Lexer } from "../src/lexer.js";
import { Parser } from "../src/parser.js";
import { SourceFile } from "../src/source-file.js";
import type { Module, Expr, Stmt, VarStmt, ClassStmt, ForStmt, Method, Body } from "../src/ast.js";

function parse(source: string): { module: Module; errors: string[] } {
  const file = new SourceFile("<test>", source);
  const lexer = new Lexer(file);
  const parser = new Parser(lexer);
  const module = parser.parseModule();
  return { module, errors: parser.diagnostics.map((d) => d.message) };
}

function parseExpr(source: string): Expr {
  const { module } = parse(source);
  return module.statements[0] as Expr;
}

describe("Parser", () => {
  describe("literals", () => {
    it("parses number literal", () => {
      const expr = parseExpr("42");
      expect(expr.kind).toBe("NumExpr");
    });

    it("parses true/false/null", () => {
      expect(parseExpr("true").kind).toBe("BoolExpr");
      expect(parseExpr("false").kind).toBe("BoolExpr");
      expect(parseExpr("null").kind).toBe("NullExpr");
    });

    it("parses string literal", () => {
      const expr = parseExpr('"hello"');
      expect(expr.kind).toBe("StringExpr");
    });

    it("parses list literal", () => {
      const expr = parseExpr("[1, 2, 3]");
      expect(expr.kind).toBe("ListExpr");
      if (expr.kind === "ListExpr") {
        expect(expr.elements).toHaveLength(3);
      }
    });

    it("parses map literal", () => {
      // At statement level, { starts a block. Test via var initializer.
      const { module } = parse('var x = {"a": 1}');
      const stmt = module.statements[0] as VarStmt;
      expect(stmt.initializer!.kind).toBe("MapExpr");
    });
  });

  describe("expressions", () => {
    it("parses infix expressions", () => {
      const expr = parseExpr("1 + 2");
      expect(expr.kind).toBe("InfixExpr");
    });

    it("parses prefix expressions", () => {
      const expr = parseExpr("-x");
      expect(expr.kind).toBe("PrefixExpr");
    });

    it("parses assignment", () => {
      const expr = parseExpr("x = 42");
      expect(expr.kind).toBe("AssignmentExpr");
    });

    it("parses conditional expression", () => {
      const expr = parseExpr("a ? b : c");
      expect(expr.kind).toBe("ConditionalExpr");
    });

    it("parses method call", () => {
      const expr = parseExpr("foo(1, 2)");
      expect(expr.kind).toBe("CallExpr");
      if (expr.kind === "CallExpr") {
        expect(expr.name.text).toBe("foo");
        expect(expr.arguments).toHaveLength(2);
      }
    });

    it("parses dot call", () => {
      const expr = parseExpr("a.b");
      expect(expr.kind).toBe("CallExpr");
      if (expr.kind === "CallExpr") {
        expect(expr.name.text).toBe("b");
        expect(expr.receiver).not.toBeNull();
      }
    });

    it("parses subscript", () => {
      const expr = parseExpr("a[0]");
      expect(expr.kind).toBe("SubscriptExpr");
    });

    it("parses string interpolation", () => {
      const expr = parseExpr('"hello %(name)"');
      expect(expr.kind).toBe("InterpolationExpr");
    });

    it("parses grouping", () => {
      const expr = parseExpr("(1 + 2)");
      expect(expr.kind).toBe("GroupingExpr");
    });
  });

  describe("statements", () => {
    it("parses var statement", () => {
      const { module } = parse("var x = 42");
      const stmt = module.statements[0] as VarStmt;
      expect(stmt.kind).toBe("VarStmt");
      expect(stmt.name.text).toBe("x");
      expect(stmt.typeAnnotation).toBeNull();
      expect(stmt.initializer).not.toBeNull();
    });

    it("parses if statement", () => {
      const { module } = parse("if (true) 42");
      expect(module.statements[0]).toMatchObject({ kind: "IfStmt" });
    });

    it("parses if/else statement", () => {
      const { module } = parse("if (true) 1 else 2");
      const stmt = module.statements[0];
      expect(stmt).toMatchObject({ kind: "IfStmt" });
      if ("elseBranch" in stmt) {
        expect(stmt.elseBranch).not.toBeNull();
      }
    });

    it("parses while statement", () => {
      const { module } = parse("while (true) 42");
      expect(module.statements[0]).toMatchObject({ kind: "WhileStmt" });
    });

    it("parses for statement", () => {
      const { module } = parse("for (i in list) 42");
      const stmt = module.statements[0] as ForStmt;
      expect(stmt.kind).toBe("ForStmt");
      expect(stmt.variable.text).toBe("i");
      expect(stmt.typeAnnotation).toBeNull();
    });

    it("parses return statement", () => {
      const { module } = parse("return 42");
      expect(module.statements[0]).toMatchObject({ kind: "ReturnStmt" });
    });

    it("parses block statement", () => {
      const { module } = parse("{\n  42\n}");
      expect(module.statements[0]).toMatchObject({ kind: "BlockStmt" });
    });

    it("parses import statement", () => {
      const { module } = parse('"./foo" ');
      // import is a keyword so test a simple one
      const { module: m2 } = parse('import "./foo" for Bar');
      expect(m2.statements[0]).toMatchObject({ kind: "ImportStmt" });
    });

    it("parses break statement", () => {
      const { module } = parse("break");
      expect(module.statements[0]).toMatchObject({ kind: "BreakStmt" });
    });
  });

  describe("class", () => {
    it("parses empty class", () => {
      const { module } = parse("class Foo {}");
      const stmt = module.statements[0] as ClassStmt;
      expect(stmt.kind).toBe("ClassStmt");
      expect(stmt.name.text).toBe("Foo");
      expect(stmt.methods).toHaveLength(0);
    });

    it("parses class with superclass", () => {
      const { module } = parse("class Foo is Bar {}");
      const stmt = module.statements[0] as ClassStmt;
      expect(stmt.superclass!.text).toBe("Bar");
    });

    it("parses class with method", () => {
      const { module } = parse("class Foo {\n  bar() {\n    42\n  }\n}");
      const stmt = module.statements[0] as ClassStmt;
      expect(stmt.methods).toHaveLength(1);
      expect(stmt.methods[0].name.text).toBe("bar");
    });

    it("parses foreign class", () => {
      const { module } = parse("foreign class Foo {}");
      const stmt = module.statements[0] as ClassStmt;
      expect(stmt.foreignKeyword).not.toBeNull();
    });

    it("parses constructor", () => {
      const { module } = parse("class Foo {\n  construct new() {\n    42\n  }\n}");
      const stmt = module.statements[0] as ClassStmt;
      expect(stmt.methods[0].constructKeyword).not.toBeNull();
    });

    it("parses static method", () => {
      const { module } = parse("class Foo {\n  static bar() {\n    42\n  }\n}");
      const stmt = module.statements[0] as ClassStmt;
      expect(stmt.methods[0].staticKeyword).not.toBeNull();
    });
  });

  describe("type annotations", () => {
    it("parses var with type annotation", () => {
      const { module, errors } = parse("var x: Num = 42");
      expect(errors).toHaveLength(0);
      const stmt = module.statements[0] as VarStmt;
      expect(stmt.kind).toBe("VarStmt");
      expect(stmt.typeAnnotation).not.toBeNull();
      expect(stmt.typeAnnotation!.name.text).toBe("Num");
    });

    it("parses var with type annotation and no initializer", () => {
      const { module, errors } = parse("var x: String");
      expect(errors).toHaveLength(0);
      const stmt = module.statements[0] as VarStmt;
      expect(stmt.typeAnnotation!.name.text).toBe("String");
      expect(stmt.initializer).toBeNull();
    });

    it("parses for loop with type annotation", () => {
      const { module, errors } = parse("for (i: Num in list) 42");
      expect(errors).toHaveLength(0);
      const stmt = module.statements[0] as ForStmt;
      expect(stmt.typeAnnotation).not.toBeNull();
      expect(stmt.typeAnnotation!.name.text).toBe("Num");
    });

    it("parses method with parameter type annotations", () => {
      const { module, errors } = parse(
        "class Foo {\n  bar(a: Num, b: String) {\n    42\n  }\n}",
      );
      expect(errors).toHaveLength(0);
      const cls = module.statements[0] as ClassStmt;
      const method = cls.methods[0];
      expect(method.parameters).toHaveLength(2);
      expect(method.parameters![0].typeAnnotation!.name.text).toBe("Num");
      expect(method.parameters![1].typeAnnotation!.name.text).toBe("String");
    });

    it("parses method with return type annotation", () => {
      const { module, errors } = parse(
        "class Foo {\n  bar() -> Num {\n    42\n  }\n}",
      );
      expect(errors).toHaveLength(0);
      const cls = module.statements[0] as ClassStmt;
      const method = cls.methods[0];
      expect(method.returnType).not.toBeNull();
      expect(method.returnType!.name.text).toBe("Num");
    });

    it("parses method with both parameter and return type", () => {
      const { module, errors } = parse(
        "class Foo {\n  bar(x: Num) -> String {\n    42\n  }\n}",
      );
      expect(errors).toHaveLength(0);
      const cls = module.statements[0] as ClassStmt;
      const method = cls.methods[0];
      expect(method.parameters![0].typeAnnotation!.name.text).toBe("Num");
      expect(method.returnType!.name.text).toBe("String");
    });

    it("parses constructor with parameter types", () => {
      const { module, errors } = parse(
        "class Foo {\n  construct new(name: String, age: Num) {\n    42\n  }\n}",
      );
      expect(errors).toHaveLength(0);
      const cls = module.statements[0] as ClassStmt;
      const method = cls.methods[0];
      expect(method.parameters![0].typeAnnotation!.name.text).toBe("String");
      expect(method.parameters![1].typeAnnotation!.name.text).toBe("Num");
    });

    it("parses block parameter with type annotation", () => {
      const { module, errors } = parse("list.each {|x: Num| x }");
      expect(errors).toHaveLength(0);
      // The block argument is on the CallExpr
      const expr = module.statements[0];
      expect(expr.kind).toBe("CallExpr");
      if (expr.kind === "CallExpr" && expr.blockArgument) {
        expect(expr.blockArgument.parameters![0].typeAnnotation!.name.text).toBe("Num");
      }
    });

    it("parses method without annotations (backwards compatible)", () => {
      const { module, errors } = parse(
        "class Foo {\n  bar(x, y) {\n    42\n  }\n}",
      );
      expect(errors).toHaveLength(0);
      const cls = module.statements[0] as ClassStmt;
      const method = cls.methods[0];
      expect(method.parameters![0].typeAnnotation).toBeNull();
      expect(method.parameters![1].typeAnnotation).toBeNull();
      expect(method.returnType).toBeNull();
    });
  });
});
