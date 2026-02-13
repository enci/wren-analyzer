import { describe, it, expect } from "vitest";
import { Lexer } from "../src/lexer.js";
import { Parser } from "../src/parser.js";
import { Resolver } from "../src/resolver.js";
import { TypeChecker } from "../src/type-checker.js";
import { SourceFile } from "../src/source-file.js";
import type { Diagnostic } from "../src/types.js";
import { DiagnosticSeverity } from "../src/types.js";

function analyze(source: string): {
  errors: Diagnostic[];
  warnings: Diagnostic[];
} {
  const file = new SourceFile("<test>", source);
  const lexer = new Lexer(file);
  const parser = new Parser(lexer);
  const module = parser.parseModule();

  const diagnostics: Diagnostic[] = [...parser.diagnostics];

  const resolver = new Resolver(diagnostics);
  resolver.resolve(module);

  const typeChecker = new TypeChecker(diagnostics);
  typeChecker.check(module);

  return {
    errors: diagnostics.filter(
      (d) => d.severity === DiagnosticSeverity.Error,
    ),
    warnings: diagnostics.filter(
      (d) => d.severity === DiagnosticSeverity.Warning,
    ),
  };
}

function warnings(source: string): string[] {
  return analyze(source).warnings.map((d) => d.message);
}

describe("TypeChecker", () => {
  describe("variable initialization", () => {
    it("no warning for correct type", () => {
      expect(warnings("var x: Num = 42")).toEqual([]);
    });

    it("warns on type mismatch", () => {
      const w = warnings('var x: Num = "hello"');
      expect(w).toHaveLength(1);
      expect(w[0]).toContain("Num");
      expect(w[0]).toContain("String");
    });

    it("warns on bool assigned to Num", () => {
      const w = warnings("var x: Num = true");
      expect(w).toHaveLength(1);
      expect(w[0]).toContain("Bool");
    });

    it("no warning without annotation", () => {
      expect(warnings('var x = "hello"')).toEqual([]);
    });

    it("no warning for null assigned to Null type", () => {
      expect(warnings("var x: Null = null")).toEqual([]);
    });

    it("warns on no initializer for typed var", () => {
      const w = warnings("var x: Num");
      expect(w).toHaveLength(1);
      expect(w[0]).toContain("no initializer");
    });

    it("no warning on no initializer for Null type", () => {
      expect(warnings("var x: Null")).toEqual([]);
    });

    it("correct type with String", () => {
      expect(warnings('var s: String = "hello"')).toEqual([]);
    });

    it("correct type with Bool", () => {
      expect(warnings("var b: Bool = true")).toEqual([]);
    });

    it("correct type with List", () => {
      expect(warnings("var l: List = [1, 2, 3]")).toEqual([]);
    });

    it("correct type with Map", () => {
      expect(warnings('var m: Map = {"a": 1}')).toEqual([]);
    });
  });

  describe("variable reassignment", () => {
    it("no warning for correct reassignment", () => {
      expect(warnings("var x: Num = 42\nx = 10")).toEqual([]);
    });

    it("warns on type mismatch reassignment", () => {
      const w = warnings('var x: Num = 42\nx = "hello"');
      expect(w).toHaveLength(1);
      expect(w[0]).toContain("Num");
      expect(w[0]).toContain("String");
    });

    it("no warning when no annotation", () => {
      expect(warnings('var x = 42\nx = "hello"')).toEqual([]);
    });
  });

  describe("return types", () => {
    it("no warning for correct return type", () => {
      expect(
        warnings("class Foo {\n  bar() -> Num {\n    return 42\n  }\n}"),
      ).toEqual([]);
    });

    it("warns on return type mismatch", () => {
      const w = warnings(
        'class Foo {\n  bar() -> Num {\n    return "hello"\n  }\n}',
      );
      expect(w).toHaveLength(1);
      expect(w[0]).toContain("Num");
      expect(w[0]).toContain("String");
    });

    it("warns on bare return in typed method", () => {
      const w = warnings(
        "class Foo {\n  bar() -> Num {\n    return\n  }\n}",
      );
      expect(w).toHaveLength(1);
      expect(w[0]).toContain("Null");
    });

    it("no warning for method without return type", () => {
      expect(
        warnings('class Foo {\n  bar() {\n    return "hello"\n  }\n}'),
      ).toEqual([]);
    });

    it("no warning for correct return type in single-expression body", () => {
      expect(
        warnings("class Foo {\n  bar() -> Num { 42 }\n}"),
      ).toEqual([]);
    });

    it("warns on single-expression body type mismatch", () => {
      const w = warnings(
        'class Foo {\n  bar() -> Num { "hello" }\n}',
      );
      expect(w).toHaveLength(1);
      expect(w[0]).toContain("String");
    });
  });

  describe("parameter types", () => {
    it("registers parameter types in scope", () => {
      // Assigning a string to a Num parameter should warn
      const w = warnings(
        'class Foo {\n  bar(x: Num) {\n    x = "hello"\n  }\n}',
      );
      expect(w).toHaveLength(1);
      expect(w[0]).toContain("Num");
      expect(w[0]).toContain("String");
    });

    it("no warning on correct assignment to typed parameter", () => {
      expect(
        warnings("class Foo {\n  bar(x: Num) {\n    x = 42\n  }\n}"),
      ).toEqual([]);
    });
  });

  describe("complex expressions skipped", () => {
    it("no warning when assigning method call to typed var", () => {
      // Method calls return unknown type, so no warning
      expect(warnings("var x: Num = foo()")).toEqual([]);
    });

    it("no warning when assigning infix expression", () => {
      expect(warnings("var x: Num = 1 + 2")).toEqual([]);
    });
  });

  describe("for loop annotations", () => {
    it("registers for loop variable type", () => {
      // We can't easily test this directly since it's just tracked,
      // but at least ensure no crash
      expect(warnings("for (i: Num in [1, 2, 3]) i")).toEqual([]);
    });
  });

  describe("string interpolation type", () => {
    it("infers String for interpolation", () => {
      const w = warnings('var name = "world"\nvar x: Num = "hello %(name)"');
      expect(w).toHaveLength(1);
      expect(w[0]).toContain("String");
    });
  });

  describe("method existence - static calls", () => {
    it("warns on unknown static method on user class", () => {
      const w = warnings(`
class Foo {
  construct new() {}
}
Foo.bar()
`);
      expect(w).toHaveLength(1);
      expect(w[0]).toContain("Foo");
      expect(w[0]).toContain("bar");
      expect(w[0]).toContain("static");
    });

    it("no warning on valid static method", () => {
      expect(warnings(`
class Foo {
  construct new() {}
  static bar() { "hello" }
}
Foo.bar()
`)).toEqual([]);
    });

    it("no warning on valid constructor", () => {
      expect(warnings(`
class Foo {
  construct new() {}
}
Foo.new()
`)).toEqual([]);
    });

    it("warns on unknown static method on core class", () => {
      const w = warnings("System.foo()");
      expect(w).toHaveLength(1);
      expect(w[0]).toContain("System");
      expect(w[0]).toContain("foo");
    });

    it("no warning on valid core static method", () => {
      expect(warnings('System.print("hello")')).toEqual([]);
    });

    it("no warning on unknown class (could be from import)", () => {
      expect(warnings("SomeExternalClass.doStuff()")).toEqual([]);
    });
  });

  describe("method existence - instance calls with type annotations", () => {
    it("warns on unknown instance method with type annotation", () => {
      const w = warnings(`
class Foo {
  construct new() {}
  bar() { "hello" }
}
class Main {
  construct new() {
    var f: Foo = Foo.new()
    f.baz()
  }
}
`);
      expect(w).toHaveLength(1);
      expect(w[0]).toContain("Foo");
      expect(w[0]).toContain("baz");
    });

    it("no warning on valid instance method", () => {
      expect(warnings(`
class Foo {
  construct new() {}
  bar() { "hello" }
}
class Main {
  construct new() {
    var f: Foo = Foo.new()
    f.bar()
  }
}
`)).toEqual([]);
    });

    it("no warning for Object methods on user class", () => {
      expect(warnings(`
class Foo {
  construct new() {}
}
class Main {
  construct new() {
    var f: Foo = Foo.new()
    f.toString
  }
}
`)).toEqual([]);
    });

    it("warns on unknown method on annotated Num type", () => {
      const w = warnings(`
class Main {
  construct new() {
    var n: Num = 42
    n.foo()
  }
}
`);
      expect(w).toHaveLength(1);
      expect(w[0]).toContain("Num");
      expect(w[0]).toContain("foo");
    });

    it("no warning on valid Num method", () => {
      expect(warnings(`
class Main {
  construct new() {
    var n: Num = 42
    n.abs
  }
}
`)).toEqual([]);
    });
  });

  describe("method existence - this calls", () => {
    it("warns on unknown method via this", () => {
      const w = warnings(`
class Foo {
  construct new() {}
  bar() {
    this.baz()
  }
}
`);
      expect(w).toHaveLength(1);
      expect(w[0]).toContain("Foo");
      expect(w[0]).toContain("baz");
    });

    it("no warning on valid this call", () => {
      expect(warnings(`
class Foo {
  construct new() {}
  bar() { "hello" }
  baz() {
    this.bar()
  }
}
`)).toEqual([]);
    });
  });

  describe("method existence - inferred types from initializers", () => {
    it("warns on unknown method with inferred constructor type", () => {
      const w = warnings(`
class Foo {
  construct new() {}
  bar() { "hello" }
}
class Main {
  construct new() {
    var f = Foo.new()
    f.baz()
  }
}
`);
      expect(w).toHaveLength(1);
      expect(w[0]).toContain("Foo");
      expect(w[0]).toContain("baz");
    });

    it("warns on unknown method with inferred literal type", () => {
      const w = warnings(`
class Main {
  construct new() {
    var s = "hello"
    s.foo()
  }
}
`);
      expect(w).toHaveLength(1);
      expect(w[0]).toContain("String");
      expect(w[0]).toContain("foo");
    });

    it("no warning on valid method with inferred literal type", () => {
      expect(warnings(`
class Main {
  construct new() {
    var s = "hello"
    s.contains("ell")
  }
}
`)).toEqual([]);
    });

    it("no warning when receiver type is unknown", () => {
      expect(warnings(`
class Main {
  construct new() {
    var x = someFunction()
    x.anything()
  }
}
`)).toEqual([]);
    });
  });

  describe("method existence - parameter types", () => {
    it("warns on unknown method on typed parameter", () => {
      const w = warnings(`
class Foo {
  construct new() {}
  bar() { "hello" }
}
class Main {
  doSomething(f: Foo) {
    f.baz()
  }
}
`);
      expect(w).toHaveLength(1);
      expect(w[0]).toContain("Foo");
      expect(w[0]).toContain("baz");
    });

    it("no warning on valid method on typed parameter", () => {
      expect(warnings(`
class Foo {
  construct new() {}
  bar() { "hello" }
}
class Main {
  doSomething(f: Foo) {
    f.bar()
  }
}
`)).toEqual([]);
    });
  });

  describe("method existence - getters and properties", () => {
    it("warns on unknown getter access on user class", () => {
      const w = warnings(`
class Foo {
  construct new() {}
  name { "Foo" }
}
class Main {
  construct new() {
    var f: Foo = Foo.new()
    f.nonexistent
  }
}
`);
      expect(w).toHaveLength(1);
      expect(w[0]).toContain("Foo");
      expect(w[0]).toContain("nonexistent");
    });

    it("no warning on valid getter access", () => {
      expect(warnings(`
class Foo {
  construct new() {}
  name { "Foo" }
}
class Main {
  construct new() {
    var f: Foo = Foo.new()
    f.name
  }
}
`)).toEqual([]);
    });

    it("no warning on core getter like Num.isInteger", () => {
      expect(warnings(`
class Main {
  construct new() {
    var n: Num = 42
    n.isInteger
  }
}
`)).toEqual([]);
    });

    it("warns on unknown getter on core type", () => {
      const w = warnings(`
class Main {
  construct new() {
    var n: Num = 42
    n.bogus
  }
}
`);
      expect(w).toHaveLength(1);
      expect(w[0]).toContain("Num");
      expect(w[0]).toContain("bogus");
    });
  });
});
