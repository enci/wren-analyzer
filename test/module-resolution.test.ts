import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { analyze } from "../src/index.js";
import type { AnalysisOptions } from "../src/index.js";
import { DiagnosticSeverity } from "../src/types.js";

const MODULES_DIR = join(import.meta.dirname!, "fixtures", "modules");

function analyzeModule(name: string, options?: AnalysisOptions) {
  const path = join(MODULES_DIR, name);
  const source = readFileSync(path, "utf-8");
  const opts = options ?? { searchPaths: [MODULES_DIR] };
  const result = analyze(source, path, opts);
  return {
    ...result,
    warnings: result.diagnostics.filter(
      (d) => d.severity === DiagnosticSeverity.Warning,
    ),
    errors: result.diagnostics.filter(
      (d) => d.severity === DiagnosticSeverity.Error,
    ),
  };
}

describe("Module resolution", () => {
  describe("selective import: import 'mod' for Class", () => {
    it("resolves imported class and produces no errors", () => {
      const { errors, warnings } = analyzeModule("importer_selective.wren");
      expect(errors).toHaveLength(0);
      expect(warnings).toHaveLength(0);
    });

    it("makes imported class methods available to type-checker", () => {
      const { warnings } = analyzeModule("importer_selective.wren");
      // Helper.new, h.greet(), h.name are all valid — no warnings
      expect(warnings).toHaveLength(0);
    });
  });

  describe("bare import: import 'mod'", () => {
    it("resolves all top-level names and produces no errors", () => {
      const { errors, warnings } = analyzeModule("importer_bare.wren");
      expect(errors).toHaveLength(0);
      expect(warnings).toHaveLength(0);
    });

    it("makes all imported classes available", () => {
      // Both Helper and MathUtils from the bare import should be available
      const { warnings } = analyzeModule("importer_bare.wren");
      expect(warnings).toHaveLength(0);
    });
  });

  describe("multi-module import", () => {
    it("resolves classes from multiple modules", () => {
      const { errors, warnings } = analyzeModule("importer_multi.wren");
      expect(errors).toHaveLength(0);
      expect(warnings).toHaveLength(0);
    });
  });

  describe("cross-module type checking", () => {
    it("warns about non-existent methods on imported classes", () => {
      const { warnings } = analyzeModule("importer_wrong_method.wren");
      expect(warnings.length).toBeGreaterThanOrEqual(2);

      // Check that warnings mention the right method names
      const messages = warnings.map((w) => w.message);
      const hasNonExistent = messages.some((m) =>
        m.includes("nonExistentMethod"),
      );
      const hasUnknownStatic = messages.some((m) =>
        m.includes("unknownStatic"),
      );
      expect(hasNonExistent).toBe(true);
      expect(hasUnknownStatic).toBe(true);
    });

    it("warns with proper diagnostic codes", () => {
      const { warnings } = analyzeModule("importer_wrong_method.wren");
      for (const w of warnings) {
        expect(w.code).toBe("unknown-method");
      }
    });
  });

  describe("unresolved module import", () => {
    it("does not crash on missing module files", () => {
      const { errors } = analyzeModule("importer_unresolved.wren");
      // The selective import registers the variable name,
      // so SomeClass should not cause an undefined variable error
      expect(errors).toHaveLength(0);
    });
  });

  describe("inherited methods from imported classes", () => {
    it("resolves inherited methods across module boundary", () => {
      const { errors, warnings } = analyzeModule("importer_inherited.wren");
      expect(errors).toHaveLength(0);
      // c.describe() is inherited from Shape — should be found
      expect(warnings).toHaveLength(0);
    });
  });

  describe("transitive imports", () => {
    it("resolves classes from indirectly imported modules", () => {
      const { errors, warnings } = analyzeModule("importer_transitive.wren");
      expect(errors).toHaveLength(0);
      expect(warnings).toHaveLength(0);
    });
  });

  describe("cross-module arity checking", () => {
    it("warns on wrong instance method arity", () => {
      const { errors, warnings } = analyzeModule("importer_wrong_arity.wren");
      expect(errors).toHaveLength(0);

      const arityWarnings = warnings.filter((w) => w.code === "wrong-arity");
      // reset(1), moveTo(1,2), moveBy(1), init(0,0),
      // create(), create("a","b"),
      // name(), health(),
      // reset (getter), moveTo (getter)
      expect(arityWarnings.length).toBeGreaterThanOrEqual(8);
    });

    it("distinguishes getter-as-method from method-as-getter", () => {
      const { warnings } = analyzeModule("importer_wrong_arity.wren");
      const messages = warnings.map((w) => w.message);

      // Getter called as zero-arg method: name(), health()
      expect(
        messages.some((m) => m.includes("'name'") && m.includes("0 argument")),
      ).toBe(true);

      // Method called as getter: reset, moveTo
      expect(
        messages.some((m) => m.includes("'reset'") && m.includes("getter")),
      ).toBe(true);
    });

    it("warns on wrong static method arity", () => {
      const { warnings } = analyzeModule("importer_wrong_arity.wren");
      const messages = warnings.map((w) => w.message);

      // Entity.create() — should be create(name) — zero args instead of one
      expect(
        messages.some(
          (m) => m.includes("create") && m.includes("0 argument"),
        ),
      ).toBe(true);
      // Entity.create("a", "b") — two args instead of one
      expect(
        messages.some(
          (m) => m.includes("create") && m.includes("2 argument"),
        ),
      ).toBe(true);
    });
  });

  describe("cross-module getter vs method distinction", () => {
    it("accepts correct getter and method usage", () => {
      const { errors } = analyzeModule("importer_getter_method.wren");
      expect(errors).toHaveLength(0);
    });

    it("warns on all incorrect getter/method usage", () => {
      const { warnings } = analyzeModule("importer_getter_method.wren");
      // Getter as method: name(), health(), defaultName()
      // Method as getter: reset, count, moveTo
      // Wrong arg count: moveTo(1,2), moveBy(1), spawnAt("a")
      expect(warnings.length).toBeGreaterThanOrEqual(9);

      // All should be wrong-arity
      for (const w of warnings) {
        expect(w.code).toBe("wrong-arity");
      }
    });

    it("detects getter-called-as-method across modules", () => {
      const { warnings } = analyzeModule("importer_getter_method.wren");
      const messages = warnings.map((w) => w.message);

      // e.name() — name is a getter, not a zero-arg method
      expect(
        messages.some(
          (m) => m.includes("'name'") && m.includes("0 argument"),
        ),
      ).toBe(true);

      // e.health() — health is a getter
      expect(
        messages.some(
          (m) => m.includes("'health'") && m.includes("0 argument"),
        ),
      ).toBe(true);

      // Entity.defaultName() — static getter
      expect(
        messages.some(
          (m) => m.includes("'defaultName'") && m.includes("0 argument"),
        ),
      ).toBe(true);
    });

    it("detects method-called-as-getter across modules", () => {
      const { warnings } = analyzeModule("importer_getter_method.wren");
      const messages = warnings.map((w) => w.message);

      // e.reset — reset is a zero-arg method, not a getter
      expect(
        messages.some(
          (m) => m.includes("'reset'") && m.includes("getter"),
        ),
      ).toBe(true);

      // Entity.count — static zero-arg method used as getter
      expect(
        messages.some(
          (m) => m.includes("'count'") && m.includes("getter"),
        ),
      ).toBe(true);
    });
  });

  describe("cross-module type inference from constructors", () => {
    it("infers type from imported class constructor and checks methods", () => {
      const { errors, warnings } = analyzeModule(
        "importer_type_annotation.wren",
      );
      expect(errors).toHaveLength(0);

      // Should warn about nonExistent on Entity, Circle, Rectangle
      expect(warnings.length).toBeGreaterThanOrEqual(3);
      for (const w of warnings) {
        expect(w.message).toContain("nonExistent");
        expect(w.code).toBe("unknown-method");
      }
    });
  });

  describe("cross-module inherited method arity", () => {
    it("warns when inherited method is called with wrong arity", () => {
      const { errors, warnings } = analyzeModule(
        "importer_inherited_arity.wren",
      );
      expect(errors).toHaveLength(0);

      // c.describe (getter access on a zero-arg method)
      // c.radius() (method call on a getter)
      // c.area() (method call on a getter)
      expect(warnings.length).toBeGreaterThanOrEqual(3);

      const messages = warnings.map((w) => w.message);

      // describe called as getter — it's a zero-arg method
      expect(
        messages.some(
          (m) => m.includes("'describe'") && m.includes("getter"),
        ),
      ).toBe(true);

      // radius called as method — it's a getter
      expect(
        messages.some(
          (m) => m.includes("'radius'") && m.includes("0 argument"),
        ),
      ).toBe(true);

      // area called as method — it's a getter
      expect(
        messages.some(
          (m) => m.includes("'area'") && m.includes("0 argument"),
        ),
      ).toBe(true);
    });
  });

  describe("without search paths", () => {
    it("works like before when no search paths provided", () => {
      const { errors } = analyzeModule("importer_selective.wren", {});
      // Without search paths, the import can't be resolved.
      // But the selective import still registers variable names via the parser,
      // so "Helper" is declared in scope — no undefined variable error.
      expect(errors).toHaveLength(0);
    });

    it("cannot type-check imported class methods without search paths", () => {
      // Without module resolution, the type-checker can't know Helper's methods.
      // It should gracefully skip — no errors, but no method warnings either.
      const { errors } = analyzeModule("importer_wrong_method.wren", {});
      expect(errors).toHaveLength(0);
    });
  });
});

describe("library modules analyze cleanly", () => {
  for (const lib of [
    "helper.wren",
    "shapes.wren",
    "entity.wren",
    "base_module.wren",
    "middleware.wren",
  ]) {
    it(`${lib} has no errors`, () => {
      const { errors } = analyzeModule(lib);
      expect(errors).toHaveLength(0);
    });
  }
});

describe("ModuleResolver integration with analyze()", () => {
  it("passes search paths through correctly", () => {
    const source = `
import "helper" for Helper
var h = Helper.new("test")
h.greet()
`;
    const result = analyze(source, join(MODULES_DIR, "test.wren"), {
      searchPaths: [MODULES_DIR],
    });

    const warnings = result.diagnostics.filter(
      (d) => d.severity === DiagnosticSeverity.Warning,
    );
    const errors = result.diagnostics.filter(
      (d) => d.severity === DiagnosticSeverity.Error,
    );

    expect(errors).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });

  it("detects wrong methods on imported classes via inline source", () => {
    const source = `
import "helper" for Helper
Helper.nonExistent()
`;
    const result = analyze(source, join(MODULES_DIR, "test.wren"), {
      searchPaths: [MODULES_DIR],
    });

    const warnings = result.diagnostics.filter(
      (d) => d.severity === DiagnosticSeverity.Warning,
    );
    expect(warnings.length).toBeGreaterThanOrEqual(1);
    expect(warnings[0]!.message).toContain("nonExistent");
  });

  it("detects wrong arity on imported class methods", () => {
    const source = `
import "helper" for MathUtils
MathUtils.square(1, 2)
`;
    const result = analyze(source, join(MODULES_DIR, "test.wren"), {
      searchPaths: [MODULES_DIR],
    });

    const warnings = result.diagnostics.filter(
      (d) => d.severity === DiagnosticSeverity.Warning,
    );
    expect(warnings.length).toBeGreaterThanOrEqual(1);
    expect(warnings[0]!.code).toBe("wrong-arity");
  });
});
