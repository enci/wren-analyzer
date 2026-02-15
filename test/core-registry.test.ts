import { describe, it, expect } from "vitest";
import { join } from "path";
import { getCoreRegistry, getBuiltinModuleRegistry, isBuiltinModule, BUILTIN_MODULES } from "../src/core/core-registry.js";
import { analyze } from "../src/index.js";

// =============================================================================
// Core registry parsing
// =============================================================================

describe("core-registry", () => {
  describe("stub parsing", () => {
    it("parses core module without errors", () => {
      const registry = getCoreRegistry();
      expect(registry.size).toBeGreaterThan(0);
    });

    it("contains all expected core classes", () => {
      const registry = getCoreRegistry();
      // Note: "Class" and "Null" are Wren keywords and can't be used as class
      // names in stub source. Their methods are inherited from Object.
      const expected = [
        "Object", "Bool", "Fiber", "Fn", "Num",
        "Sequence", "String", "List", "Map", "MapEntry", "Range", "System",
      ];
      for (const name of expected) {
        expect(registry.has(name), `Missing class: ${name}`).toBe(true);
      }
    });

    it("tracks Num instance method arities", () => {
      const num = getCoreRegistry().get("Num")!;
      // Getters (arity -1)
      expect(num.instanceMethods.hasArity("abs", -1)).toBe(true);
      expect(num.instanceMethods.hasArity("ceil", -1)).toBe(true);
      expect(num.instanceMethods.hasArity("floor", -1)).toBe(true);
      expect(num.instanceMethods.hasArity("isInteger", -1)).toBe(true);
      expect(num.instanceMethods.hasArity("toString", -1)).toBe(true);
      // Methods with arguments
      expect(num.instanceMethods.hasArity("min", 1)).toBe(true);
      expect(num.instanceMethods.hasArity("max", 1)).toBe(true);
      expect(num.instanceMethods.hasArity("clamp", 2)).toBe(true);
      expect(num.instanceMethods.hasArity("pow", 1)).toBe(true);
      expect(num.instanceMethods.hasArity("atan", 1)).toBe(true);
      // Operators
      expect(num.instanceMethods.hasArity("+", 1)).toBe(true);
      expect(num.instanceMethods.hasArity("-", 1)).toBe(true);
      expect(num.instanceMethods.hasArity("*", 1)).toBe(true);
      expect(num.instanceMethods.hasArity("/", 1)).toBe(true);
      expect(num.instanceMethods.hasArity("<", 1)).toBe(true);
      expect(num.instanceMethods.hasArity("==", 1)).toBe(true);
      expect(num.instanceMethods.hasArity("..", 1)).toBe(true);
      expect(num.instanceMethods.hasArity("...", 1)).toBe(true);
    });

    it("tracks Num static method arities", () => {
      const num = getCoreRegistry().get("Num")!;
      expect(num.staticMethods.hasArity("fromString", 1)).toBe(true);
      // Static getters
      expect(num.staticMethods.hasArity("infinity", -1)).toBe(true);
      expect(num.staticMethods.hasArity("nan", -1)).toBe(true);
      expect(num.staticMethods.hasArity("pi", -1)).toBe(true);
      expect(num.staticMethods.hasArity("tau", -1)).toBe(true);
      expect(num.staticMethods.hasArity("largest", -1)).toBe(true);
      expect(num.staticMethods.hasArity("smallest", -1)).toBe(true);
      expect(num.staticMethods.hasArity("maxSafeInteger", -1)).toBe(true);
      expect(num.staticMethods.hasArity("minSafeInteger", -1)).toBe(true);
    });

    it("tracks String methods and inheritance", () => {
      const str = getCoreRegistry().get("String")!;
      expect(str.superclass).toBe("Sequence");
      // Instance methods
      expect(str.instanceMethods.has("contains")).toBe(true);
      expect(str.instanceMethods.has("split")).toBe(true);
      expect(str.instanceMethods.has("trim")).toBe(true);
      expect(str.instanceMethods.has("bytes")).toBe(true);
      expect(str.instanceMethods.has("codePoints")).toBe(true);
      // indexOf has two arities
      expect(str.instanceMethods.hasArity("indexOf", 1)).toBe(true);
      expect(str.instanceMethods.hasArity("indexOf", 2)).toBe(true);
      // trim overloads
      expect(str.instanceMethods.hasArity("trim", 0)).toBe(true);
      expect(str.instanceMethods.hasArity("trim", 1)).toBe(true);
      // Static
      expect(str.staticMethods.hasArity("fromCodePoint", 1)).toBe(true);
      expect(str.staticMethods.hasArity("fromByte", 1)).toBe(true);
    });

    it("tracks List methods and inheritance", () => {
      const list = getCoreRegistry().get("List")!;
      expect(list.superclass).toBe("Sequence");
      expect(list.instanceMethods.has("add")).toBe(true);
      expect(list.instanceMethods.has("clear")).toBe(true);
      expect(list.instanceMethods.has("count")).toBe(true);
      expect(list.instanceMethods.has("sort")).toBe(true);
      expect(list.instanceMethods.has("addAll")).toBe(true);
      // sort overloads
      expect(list.instanceMethods.hasArity("sort", 0)).toBe(true);
      expect(list.instanceMethods.hasArity("sort", 1)).toBe(true);
      // Static
      expect(list.staticMethods.hasArity("new", 0)).toBe(true);
      expect(list.staticMethods.hasArity("filled", 2)).toBe(true);
    });

    it("tracks Map methods and inheritance", () => {
      const map = getCoreRegistry().get("Map")!;
      expect(map.superclass).toBe("Sequence");
      expect(map.instanceMethods.has("containsKey")).toBe(true);
      expect(map.instanceMethods.has("keys")).toBe(true);
      expect(map.instanceMethods.has("values")).toBe(true);
      expect(map.instanceMethods.has("count")).toBe(true);
      expect(map.staticMethods.hasArity("new", 0)).toBe(true);
    });

    it("tracks Range methods and inheritance", () => {
      const range = getCoreRegistry().get("Range")!;
      expect(range.superclass).toBe("Sequence");
      expect(range.instanceMethods.hasArity("from", -1)).toBe(true);
      expect(range.instanceMethods.hasArity("to", -1)).toBe(true);
      expect(range.instanceMethods.hasArity("min", -1)).toBe(true);
      expect(range.instanceMethods.hasArity("max", -1)).toBe(true);
      expect(range.instanceMethods.hasArity("isInclusive", -1)).toBe(true);
    });

    it("tracks Fiber instance and static methods", () => {
      const fiber = getCoreRegistry().get("Fiber")!;
      // Instance
      expect(fiber.instanceMethods.hasArity("call", 0)).toBe(true);
      expect(fiber.instanceMethods.hasArity("call", 1)).toBe(true);
      expect(fiber.instanceMethods.hasArity("error", -1)).toBe(true);
      expect(fiber.instanceMethods.hasArity("isDone", -1)).toBe(true);
      expect(fiber.instanceMethods.hasArity("transfer", 0)).toBe(true);
      expect(fiber.instanceMethods.hasArity("transfer", 1)).toBe(true);
      expect(fiber.instanceMethods.hasArity("try", 0)).toBe(true);
      expect(fiber.instanceMethods.hasArity("try", 1)).toBe(true);
      // Static
      expect(fiber.staticMethods.hasArity("new", 1)).toBe(true);
      expect(fiber.staticMethods.hasArity("abort", 1)).toBe(true);
      expect(fiber.staticMethods.hasArity("current", -1)).toBe(true);
      expect(fiber.staticMethods.hasArity("suspend", 0)).toBe(true);
      expect(fiber.staticMethods.hasArity("yield", 0)).toBe(true);
      expect(fiber.staticMethods.hasArity("yield", 1)).toBe(true);
    });

    it("tracks Fn methods including high-arity call overloads", () => {
      const fn = getCoreRegistry().get("Fn")!;
      expect(fn.instanceMethods.hasArity("arity", -1)).toBe(true);
      // call from 0 to 16 args
      for (let i = 0; i <= 16; i++) {
        expect(fn.instanceMethods.hasArity("call", i), `Fn.call(${i} args)`).toBe(true);
      }
      expect(fn.instanceMethods.hasArity("toString", -1)).toBe(true);
      expect(fn.staticMethods.hasArity("new", 1)).toBe(true);
    });

    it("tracks Sequence methods", () => {
      const seq = getCoreRegistry().get("Sequence")!;
      expect(seq.instanceMethods.has("all")).toBe(true);
      expect(seq.instanceMethods.has("any")).toBe(true);
      expect(seq.instanceMethods.has("each")).toBe(true);
      expect(seq.instanceMethods.has("map")).toBe(true);
      expect(seq.instanceMethods.has("where")).toBe(true);
      // count has two arities: getter and 1-arg
      expect(seq.instanceMethods.hasArity("count", -1)).toBe(true);
      expect(seq.instanceMethods.hasArity("count", 1)).toBe(true);
      // reduce has two arities
      expect(seq.instanceMethods.hasArity("reduce", 1)).toBe(true);
      expect(seq.instanceMethods.hasArity("reduce", 2)).toBe(true);
      // join has two arities
      expect(seq.instanceMethods.hasArity("join", 0)).toBe(true);
      expect(seq.instanceMethods.hasArity("join", 1)).toBe(true);
    });

    it("tracks System static methods", () => {
      const sys = getCoreRegistry().get("System")!;
      expect(sys.staticMethods.hasArity("clock", -1)).toBe(true);
      expect(sys.staticMethods.hasArity("gc", 0)).toBe(true);
      expect(sys.staticMethods.hasArity("print", 0)).toBe(true);
      expect(sys.staticMethods.hasArity("print", 1)).toBe(true);
      expect(sys.staticMethods.hasArity("write", 1)).toBe(true);
      expect(sys.staticMethods.hasArity("writeAll", 1)).toBe(true);
      expect(sys.staticMethods.hasArity("printAll", 1)).toBe(true);
    });

    it("tracks Object methods", () => {
      const obj = getCoreRegistry().get("Object")!;
      expect(obj.instanceMethods.hasArity("toString", -1)).toBe(true);
      expect(obj.instanceMethods.hasArity("type", -1)).toBe(true);
      expect(obj.instanceMethods.hasArity("is", 1)).toBe(true);
      expect(obj.instanceMethods.hasArity("==", 1)).toBe(true);
      expect(obj.instanceMethods.hasArity("!=", 1)).toBe(true);
      expect(obj.staticMethods.hasArity("same", 2)).toBe(true);
    });

    it("tracks MapEntry methods", () => {
      const entry = getCoreRegistry().get("MapEntry")!;
      expect(entry.instanceMethods.hasArity("key", -1)).toBe(true);
      expect(entry.instanceMethods.hasArity("value", -1)).toBe(true);
      expect(entry.instanceMethods.hasArity("toString", -1)).toBe(true);
      expect(entry.staticMethods.hasArity("new", 2)).toBe(true);
    });

    it("tracks inheritance hierarchy", () => {
      const registry = getCoreRegistry();
      expect(registry.get("List")!.superclass).toBe("Sequence");
      expect(registry.get("Map")!.superclass).toBe("Sequence");
      expect(registry.get("Range")!.superclass).toBe("Sequence");
      expect(registry.get("String")!.superclass).toBe("Sequence");
      expect(registry.get("Object")!.superclass).toBeNull();
      expect(registry.get("Num")!.superclass).toBeNull();
      expect(registry.get("Bool")!.superclass).toBeNull();
      expect(registry.get("Sequence")!.superclass).toBeNull();
    });
  });

  // ===========================================================================
  // Optional module registries
  // ===========================================================================

  describe("optional modules", () => {
    it("parses Random module", () => {
      const registry = getBuiltinModuleRegistry("random")!;
      expect(registry).not.toBeNull();
      const random = registry.get("Random")!;
      expect(random).toBeDefined();
      // Constructors
      expect(random.staticMethods.hasArity("new", 0)).toBe(true);
      expect(random.staticMethods.hasArity("new", 1)).toBe(true);
      // Instance methods
      expect(random.instanceMethods.hasArity("float", 0)).toBe(true);
      expect(random.instanceMethods.hasArity("float", 1)).toBe(true);
      expect(random.instanceMethods.hasArity("float", 2)).toBe(true);
      expect(random.instanceMethods.hasArity("int", 0)).toBe(true);
      expect(random.instanceMethods.hasArity("int", 1)).toBe(true);
      expect(random.instanceMethods.hasArity("int", 2)).toBe(true);
      expect(random.instanceMethods.hasArity("sample", 1)).toBe(true);
      expect(random.instanceMethods.hasArity("sample", 2)).toBe(true);
      expect(random.instanceMethods.hasArity("shuffle", 1)).toBe(true);
    });

    it("parses Meta module", () => {
      const registry = getBuiltinModuleRegistry("meta")!;
      expect(registry).not.toBeNull();
      const meta = registry.get("Meta")!;
      expect(meta).toBeDefined();
      expect(meta.staticMethods.hasArity("getModuleVariables", 1)).toBe(true);
      expect(meta.staticMethods.hasArity("eval", 1)).toBe(true);
      expect(meta.staticMethods.hasArity("compileExpression", 1)).toBe(true);
      expect(meta.staticMethods.hasArity("compile", 1)).toBe(true);
    });

    it("returns null for unknown module", () => {
      expect(getBuiltinModuleRegistry("nonexistent")).toBeNull();
    });
  });

  // ===========================================================================
  // BUILTIN_MODULES
  // ===========================================================================

  describe("BUILTIN_MODULES", () => {
    it("contains meta and random", () => {
      expect(BUILTIN_MODULES.has("meta")).toBe(true);
      expect(BUILTIN_MODULES.has("random")).toBe(true);
      expect(BUILTIN_MODULES.size).toBe(2);
    });

    it("isBuiltinModule works", () => {
      expect(isBuiltinModule("meta")).toBe(true);
      expect(isBuiltinModule("random")).toBe(true);
      expect(isBuiltinModule("helper")).toBe(false);
      expect(isBuiltinModule("core")).toBe(false);
    });
  });

  // ===========================================================================
  // Integration: core methods in type-checking
  // ===========================================================================

  describe("type-checking with core registry", () => {
    it("recognizes core class methods without false warnings", () => {
      const source = `
        var n = 42
        n.abs
        n.ceil
        n.floor
        n.toString
        n.min(1)
        n.max(2)
        n.clamp(0, 100)
      `;
      const { diagnostics } = analyze(source);
      const warnings = diagnostics.filter(d => d.message.includes("does not define"));
      expect(warnings).toHaveLength(0);
    });

    it("recognizes List methods", () => {
      const source = `
        var items = [1, 2, 3]
        items.add(4)
        items.clear()
        items.count
        items.sort()
        items.indexOf(2)
      `;
      const { diagnostics } = analyze(source);
      const warnings = diagnostics.filter(d => d.message.includes("does not define"));
      expect(warnings).toHaveLength(0);
    });

    it("recognizes String methods", () => {
      const source = `
        var s = "hello"
        s.contains("ell")
        s.split(",")
        s.trim()
        s.startsWith("h")
        s.endsWith("o")
        s.indexOf("l")
        s.replace("l", "r")
      `;
      const { diagnostics } = analyze(source);
      const warnings = diagnostics.filter(d => d.message.includes("does not define"));
      expect(warnings).toHaveLength(0);
    });

    it("recognizes static methods", () => {
      const source = `
        System.print("hello")
        System.print()
        Num.fromString("42")
        List.new()
        List.filled(10, 0)
        Map.new()
      `;
      const { diagnostics } = analyze(source);
      const warnings = diagnostics.filter(d => d.message.includes("does not define"));
      expect(warnings).toHaveLength(0);
    });

    it("recognizes Sequence methods via inheritance", () => {
      const source = `
        var items = [1, 2, 3]
        items.map {|x| x }
        items.where {|x| x > 1 }
        items.each {|x| x }
        items.any {|x| x > 0 }
        items.all {|x| x > 0 }
        items.isEmpty
        items.toList
        items.count
        items.join(",")
      `;
      const { diagnostics } = analyze(source);
      const warnings = diagnostics.filter(d => d.message.includes("does not define"));
      expect(warnings).toHaveLength(0);
    });

    it("warns on nonexistent core instance methods", () => {
      const source = `
        var n = 42
        n.nonExistent
      `;
      const { diagnostics } = analyze(source);
      const warnings = diagnostics.filter(d => d.message.includes("does not define"));
      expect(warnings).toHaveLength(1);
      expect(warnings[0]!.message).toContain("nonExistent");
    });

    it("warns on nonexistent core static methods", () => {
      const source = `
        System.nonExistent()
      `;
      const { diagnostics } = analyze(source);
      const warnings = diagnostics.filter(d => d.message.includes("does not define"));
      expect(warnings).toHaveLength(1);
      expect(warnings[0]!.message).toContain("nonExistent");
    });

    it("detects arity mismatch on core static methods", () => {
      const source = `
        List.filled(1)
      `;
      const { diagnostics } = analyze(source);
      const warnings = diagnostics.filter(d => d.code === "wrong-arity");
      expect(warnings).toHaveLength(1);
      expect(warnings[0]!.message).toContain("filled");
    });

    it("Null type does not cause false positives", () => {
      // Variables typed as Null should not trigger method warnings
      const source = `
        var x = null
        x.toString
      `;
      const { diagnostics } = analyze(source);
      const warnings = diagnostics.filter(d => d.message.includes("does not define"));
      expect(warnings).toHaveLength(0);
    });
  });

  // ===========================================================================
  // Unresolved import diagnostics
  // ===========================================================================

  describe("unresolved import diagnostics", () => {
    it("emits warning for unresolved module", () => {
      const source = `import "nonexistent" for Foo`;
      const { diagnostics } = analyze(source, "/tmp/test.wren", {
        searchPaths: ["/tmp"],
      });
      const unresolvedWarnings = diagnostics.filter(d => d.code === "unresolved-import");
      expect(unresolvedWarnings).toHaveLength(1);
      expect(unresolvedWarnings[0]!.message).toContain("nonexistent");
    });

    it("does not warn for builtin modules", () => {
      const source = `import "random" for Random`;
      const { diagnostics } = analyze(source, "/tmp/test.wren", {
        searchPaths: ["/tmp"],
      });
      const unresolvedWarnings = diagnostics.filter(d => d.code === "unresolved-import");
      expect(unresolvedWarnings).toHaveLength(0);
    });
  });

  // ===========================================================================
  // Unknown import variable diagnostics
  // ===========================================================================

  describe("unknown import variable diagnostics", () => {
    const MODULES_DIR = join(import.meta.dirname!, "fixtures", "modules");

    it("warns when importing non-existent name from file module", () => {
      const source = `import "helper" for NonExistent`;
      const { diagnostics } = analyze(source, join(MODULES_DIR, "test.wren"), {
        searchPaths: [MODULES_DIR],
      });
      const warnings = diagnostics.filter(d => d.code === "unknown-import-variable");
      expect(warnings).toHaveLength(1);
      expect(warnings[0]!.message).toContain("NonExistent");
      expect(warnings[0]!.message).toContain("helper");
    });

    it("warns when importing non-existent name from builtin module", () => {
      const source = `import "random" for Bogus`;
      const { diagnostics } = analyze(source, "/tmp/test.wren", {
        searchPaths: ["/tmp"],
      });
      const warnings = diagnostics.filter(d => d.code === "unknown-import-variable");
      expect(warnings).toHaveLength(1);
      expect(warnings[0]!.message).toContain("Bogus");
      expect(warnings[0]!.message).toContain("random");
    });

    it("does not warn for valid class import", () => {
      const source = `import "helper" for Helper`;
      const { diagnostics } = analyze(source, join(MODULES_DIR, "test.wren"), {
        searchPaths: [MODULES_DIR],
      });
      const warnings = diagnostics.filter(d => d.code === "unknown-import-variable");
      expect(warnings).toHaveLength(0);
    });

    it("does not warn for valid top-level variable import", () => {
      // helper.wren exports HELPER_VERSION as a top-level var
      const source = `import "helper" for HELPER_VERSION`;
      const { diagnostics } = analyze(source, join(MODULES_DIR, "test.wren"), {
        searchPaths: [MODULES_DIR],
      });
      const warnings = diagnostics.filter(d => d.code === "unknown-import-variable");
      expect(warnings).toHaveLength(0);
    });

    it("warns only for missing names in a mixed import", () => {
      const source = `import "helper" for Helper, NonExistent`;
      const { diagnostics } = analyze(source, join(MODULES_DIR, "test.wren"), {
        searchPaths: [MODULES_DIR],
      });
      const warnings = diagnostics.filter(d => d.code === "unknown-import-variable");
      expect(warnings).toHaveLength(1);
      expect(warnings[0]!.message).toContain("NonExistent");
    });

    it("warns for each missing name when multiple are invalid", () => {
      const source = `import "helper" for Foo, Bar, Baz`;
      const { diagnostics } = analyze(source, join(MODULES_DIR, "test.wren"), {
        searchPaths: [MODULES_DIR],
      });
      const warnings = diagnostics.filter(d => d.code === "unknown-import-variable");
      expect(warnings).toHaveLength(3);
    });

    it("does not warn for bare imports", () => {
      const source = `import "helper"`;
      const { diagnostics } = analyze(source, join(MODULES_DIR, "test.wren"), {
        searchPaths: [MODULES_DIR],
      });
      const warnings = diagnostics.filter(d => d.code === "unknown-import-variable");
      expect(warnings).toHaveLength(0);
    });

    it("does not emit unknown-import-variable when module is unresolved", () => {
      const source = `import "noexist" for Foo`;
      const { diagnostics } = analyze(source, "/tmp/test.wren", {
        searchPaths: ["/tmp"],
      });
      // Should get unresolved-import but NOT unknown-import-variable
      const unresolvedWarnings = diagnostics.filter(d => d.code === "unresolved-import");
      const unknownVarWarnings = diagnostics.filter(d => d.code === "unknown-import-variable");
      expect(unresolvedWarnings).toHaveLength(1);
      expect(unknownVarWarnings).toHaveLength(0);
    });

    it("does not warn for valid builtin class (Random from random)", () => {
      const source = `import "random" for Random`;
      const { diagnostics } = analyze(source, "/tmp/test.wren", {
        searchPaths: ["/tmp"],
      });
      const warnings = diagnostics.filter(d => d.code === "unknown-import-variable");
      expect(warnings).toHaveLength(0);
    });

    it("does not warn for valid builtin class (Meta from meta)", () => {
      const source = `import "meta" for Meta`;
      const { diagnostics } = analyze(source, "/tmp/test.wren", {
        searchPaths: ["/tmp"],
      });
      const warnings = diagnostics.filter(d => d.code === "unknown-import-variable");
      expect(warnings).toHaveLength(0);
    });
  });

  // ===========================================================================
  // Return type tracking
  // ===========================================================================

  describe("return type tracking", () => {
    it("tracks Num getter return types", () => {
      const num = getCoreRegistry().get("Num")!;
      expect(num.instanceMethods.getReturnType("abs", -1)).toBe("Num");
      expect(num.instanceMethods.getReturnType("ceil", -1)).toBe("Num");
      expect(num.instanceMethods.getReturnType("floor", -1)).toBe("Num");
      expect(num.instanceMethods.getReturnType("isInteger", -1)).toBe("Bool");
      expect(num.instanceMethods.getReturnType("isNan", -1)).toBe("Bool");
      expect(num.instanceMethods.getReturnType("isInfinity", -1)).toBe("Bool");
      expect(num.instanceMethods.getReturnType("toString", -1)).toBe("String");
    });

    it("tracks Num method return types", () => {
      const num = getCoreRegistry().get("Num")!;
      expect(num.instanceMethods.getReturnType("+", 1)).toBe("Num");
      expect(num.instanceMethods.getReturnType("-", 1)).toBe("Num");
      expect(num.instanceMethods.getReturnType("*", 1)).toBe("Num");
      expect(num.instanceMethods.getReturnType("/", 1)).toBe("Num");
      expect(num.instanceMethods.getReturnType("<", 1)).toBe("Bool");
      expect(num.instanceMethods.getReturnType("==", 1)).toBe("Bool");
      expect(num.instanceMethods.getReturnType("..", 1)).toBe("Range");
      expect(num.instanceMethods.getReturnType("...", 1)).toBe("Range");
      expect(num.instanceMethods.getReturnType("clamp", 2)).toBe("Num");
      expect(num.instanceMethods.getReturnType("min", 1)).toBe("Num");
      expect(num.instanceMethods.getReturnType("max", 1)).toBe("Num");
    });

    it("tracks Num static return types", () => {
      const num = getCoreRegistry().get("Num")!;
      expect(num.staticMethods.getReturnType("fromString", 1)).toBe("Num");
      expect(num.staticMethods.getReturnType("pi", -1)).toBe("Num");
      expect(num.staticMethods.getReturnType("infinity", -1)).toBe("Num");
    });

    it("tracks String method return types", () => {
      const str = getCoreRegistry().get("String")!;
      expect(str.instanceMethods.getReturnType("+", 1)).toBe("String");
      expect(str.instanceMethods.getReturnType("contains", 1)).toBe("Bool");
      expect(str.instanceMethods.getReturnType("startsWith", 1)).toBe("Bool");
      expect(str.instanceMethods.getReturnType("endsWith", 1)).toBe("Bool");
      expect(str.instanceMethods.getReturnType("split", 1)).toBe("List");
      expect(str.instanceMethods.getReturnType("indexOf", 1)).toBe("Num");
      expect(str.instanceMethods.getReturnType("indexOf", 2)).toBe("Num");
      expect(str.instanceMethods.getReturnType("trim", 0)).toBe("String");
      expect(str.instanceMethods.getReturnType("replace", 2)).toBe("String");
      expect(str.instanceMethods.getReturnType("toString", -1)).toBe("String");
      expect(str.instanceMethods.getReturnType("byteCount", -1)).toBe("Num");
    });

    it("tracks List method return types", () => {
      const list = getCoreRegistry().get("List")!;
      expect(list.instanceMethods.getReturnType("count", -1)).toBe("Num");
      expect(list.instanceMethods.getReturnType("sort", 0)).toBe("List");
      expect(list.instanceMethods.getReturnType("sort", 1)).toBe("List");
      expect(list.instanceMethods.getReturnType("indexOf", 1)).toBe("Num");
      expect(list.instanceMethods.getReturnType("toString", -1)).toBe("String");
      expect(list.instanceMethods.getReturnType("+", 1)).toBe("List");
      expect(list.staticMethods.getReturnType("new", 0)).toBe("List");
      expect(list.staticMethods.getReturnType("filled", 2)).toBe("List");
    });

    it("tracks Map method return types", () => {
      const map = getCoreRegistry().get("Map")!;
      expect(map.instanceMethods.getReturnType("containsKey", 1)).toBe("Bool");
      expect(map.instanceMethods.getReturnType("count", -1)).toBe("Num");
      expect(map.instanceMethods.getReturnType("keys", -1)).toBe("List");
      expect(map.instanceMethods.getReturnType("values", -1)).toBe("List");
      expect(map.staticMethods.getReturnType("new", 0)).toBe("Map");
    });

    it("tracks Bool method return types", () => {
      const bool = getCoreRegistry().get("Bool")!;
      expect(bool.instanceMethods.getReturnType("!", -1)).toBe("Bool");
      expect(bool.instanceMethods.getReturnType("toString", -1)).toBe("String");
    });

    it("tracks Range method return types", () => {
      const range = getCoreRegistry().get("Range")!;
      expect(range.instanceMethods.getReturnType("from", -1)).toBe("Num");
      expect(range.instanceMethods.getReturnType("to", -1)).toBe("Num");
      expect(range.instanceMethods.getReturnType("min", -1)).toBe("Num");
      expect(range.instanceMethods.getReturnType("max", -1)).toBe("Num");
      expect(range.instanceMethods.getReturnType("isInclusive", -1)).toBe("Bool");
      expect(range.instanceMethods.getReturnType("toString", -1)).toBe("String");
    });

    it("tracks Sequence method return types", () => {
      const seq = getCoreRegistry().get("Sequence")!;
      expect(seq.instanceMethods.getReturnType("all", 1)).toBe("Bool");
      expect(seq.instanceMethods.getReturnType("any", 1)).toBe("Bool");
      expect(seq.instanceMethods.getReturnType("contains", 1)).toBe("Bool");
      expect(seq.instanceMethods.getReturnType("isEmpty", -1)).toBe("Bool");
      expect(seq.instanceMethods.getReturnType("count", -1)).toBe("Num");
      expect(seq.instanceMethods.getReturnType("toList", -1)).toBe("List");
      expect(seq.instanceMethods.getReturnType("join", 0)).toBe("String");
      expect(seq.instanceMethods.getReturnType("join", 1)).toBe("String");
      expect(seq.instanceMethods.getReturnType("map", 1)).toBe("Sequence");
      expect(seq.instanceMethods.getReturnType("toString", -1)).toBe("String");
    });

    it("tracks Object method return types", () => {
      const obj = getCoreRegistry().get("Object")!;
      expect(obj.instanceMethods.getReturnType("==", 1)).toBe("Bool");
      expect(obj.instanceMethods.getReturnType("!=", 1)).toBe("Bool");
      expect(obj.instanceMethods.getReturnType("is", 1)).toBe("Bool");
      expect(obj.instanceMethods.getReturnType("!", -1)).toBe("Bool");
      expect(obj.instanceMethods.getReturnType("toString", -1)).toBe("String");
      expect(obj.staticMethods.getReturnType("same", 2)).toBe("Bool");
    });

    it("tracks Fiber return types", () => {
      const fiber = getCoreRegistry().get("Fiber")!;
      expect(fiber.instanceMethods.getReturnType("isDone", -1)).toBe("Bool");
      expect(fiber.staticMethods.getReturnType("new", 1)).toBe("Fiber");
      expect(fiber.staticMethods.getReturnType("current", -1)).toBe("Fiber");
    });

    it("tracks Fn return types", () => {
      const fn = getCoreRegistry().get("Fn")!;
      expect(fn.instanceMethods.getReturnType("arity", -1)).toBe("Num");
      expect(fn.instanceMethods.getReturnType("toString", -1)).toBe("String");
      expect(fn.staticMethods.getReturnType("new", 1)).toBe("Fn");
    });

    it("tracks System return types", () => {
      const sys = getCoreRegistry().get("System")!;
      expect(sys.staticMethods.getReturnType("clock", -1)).toBe("Num");
    });

    it("returns null for unannotated methods", () => {
      const fiber = getCoreRegistry().get("Fiber")!;
      // call() has no return type annotation
      expect(fiber.instanceMethods.getReturnType("call", 0)).toBeNull();
    });

    it("returns undefined for nonexistent methods", () => {
      const num = getCoreRegistry().get("Num")!;
      expect(num.instanceMethods.getReturnType("nonexistent", 0)).toBeUndefined();
    });

    it("tracks Random module return types", () => {
      const random = getBuiltinModuleRegistry("random")!.get("Random")!;
      expect(random.instanceMethods.getReturnType("float", 0)).toBe("Num");
      expect(random.instanceMethods.getReturnType("int", 1)).toBe("Num");
      expect(random.instanceMethods.getReturnType("sample", 2)).toBe("List");
    });

    it("tracks Meta module return types", () => {
      const meta = getBuiltinModuleRegistry("meta")!.get("Meta")!;
      expect(meta.staticMethods.getReturnType("getModuleVariables", 1)).toBe("List");
      expect(meta.staticMethods.getReturnType("compileExpression", 1)).toBe("Fn");
      expect(meta.staticMethods.getReturnType("compile", 1)).toBe("Fn");
    });

    it("constructor return types are inferred as class name", () => {
      const random = getBuiltinModuleRegistry("random")!.get("Random")!;
      expect(random.staticMethods.getReturnType("new", 0)).toBe("Random");
      expect(random.staticMethods.getReturnType("new", 1)).toBe("Random");

      const list = getCoreRegistry().get("List")!;
      expect(list.staticMethods.getReturnType("new", 0)).toBe("List");
    });
  });
});
