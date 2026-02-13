import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { analyze } from "../src/index.js";
import { DiagnosticSeverity } from "../src/types.js";
import type { Diagnostic } from "../src/types.js";

const FIXTURES = join(import.meta.dirname!, "fixtures");

function fixture(name: string) {
  const path = join(FIXTURES, name);
  const source = readFileSync(path, "utf-8");
  return analyze(source, path);
}

// Count expected warnings and errors from `// expect warning` and `// expect error` comments
function countExpected(source: string): { warnings: number; errors: number } {
  const lines = source.split("\n");
  let warnings = 0;
  let errors = 0;
  for (const line of lines) {
    // Count "expect warning" comments (on the same line as code)
    if (line.includes("// expect warning")) warnings++;
    // Count "expect error" comments
    if (line.includes("// expect error")) errors++;
  }
  return { warnings, errors };
}

function analyzeFixture(name: string) {
  const path = join(FIXTURES, name);
  const source = readFileSync(path, "utf-8");
  const result = analyze(source, path);
  const expected = countExpected(source);
  return {
    ...result,
    source,
    expected,
    warnings: result.diagnostics.filter(
      (d) => d.severity === DiagnosticSeverity.Warning,
    ),
    errors: result.diagnostics.filter(
      (d) => d.severity === DiagnosticSeverity.Error,
    ),
  };
}

describe("Integration tests with Wren fixtures", () => {
  describe("type_check_var_init.wren", () => {
    it("detects correct number of warnings", () => {
      const { warnings, expected } = analyzeFixture("type_check_var_init.wren");
      expect(warnings).toHaveLength(expected.warnings);
    });

    it("produces no parse errors", () => {
      const { errors } = analyzeFixture("type_check_var_init.wren");
      expect(errors).toHaveLength(0);
    });

    it("warnings mention type mismatch", () => {
      const { warnings } = analyzeFixture("type_check_var_init.wren");
      for (const w of warnings) {
        expect(w.code).toBe("type-mismatch");
      }
    });
  });

  describe("type_check_var_assign.wren", () => {
    it("detects correct number of warnings", () => {
      const { warnings, expected } = analyzeFixture(
        "type_check_var_assign.wren",
      );
      expect(warnings).toHaveLength(expected.warnings);
    });

    it("produces no parse errors", () => {
      const { errors } = analyzeFixture("type_check_var_assign.wren");
      expect(errors).toHaveLength(0);
    });
  });

  describe("type_check_return.wren", () => {
    it("detects correct number of warnings", () => {
      const { warnings, expected } = analyzeFixture("type_check_return.wren");
      expect(warnings).toHaveLength(expected.warnings);
    });

    it("produces no parse errors", () => {
      const { errors } = analyzeFixture("type_check_return.wren");
      expect(errors).toHaveLength(0);
    });
  });

  describe("type_check_no_annotation.wren", () => {
    it("produces no warnings at all", () => {
      const { warnings } = analyzeFixture("type_check_no_annotation.wren");
      expect(warnings).toHaveLength(0);
    });

    it("produces no parse errors", () => {
      const { errors } = analyzeFixture("type_check_no_annotation.wren");
      expect(errors).toHaveLength(0);
    });
  });

  describe("type_check_null_init.wren", () => {
    it("detects correct number of warnings", () => {
      const { warnings, expected } = analyzeFixture(
        "type_check_null_init.wren",
      );
      expect(warnings).toHaveLength(expected.warnings);
    });

    it("produces no parse errors", () => {
      const { errors } = analyzeFixture("type_check_null_init.wren");
      expect(errors).toHaveLength(0);
    });
  });

  describe("type_check_integration.wren", () => {
    it("detects correct number of warnings", () => {
      const { warnings, expected } = analyzeFixture(
        "type_check_integration.wren",
      );
      expect(warnings).toHaveLength(expected.warnings);
    });

    it("produces no parse errors", () => {
      const { errors } = analyzeFixture("type_check_integration.wren");
      expect(errors).toHaveLength(0);
    });
  });

  describe("type_check_module_var.wren", () => {
    it("detects correct number of warnings", () => {
      const { warnings, expected } = analyzeFixture(
        "type_check_module_var.wren",
      );
      expect(warnings).toHaveLength(expected.warnings);
    });

    it("produces no parse errors", () => {
      const { errors } = analyzeFixture("type_check_module_var.wren");
      expect(errors).toHaveLength(0);
    });
  });

  describe("variable_annotation.wren", () => {
    it("parses without errors or warnings", () => {
      const { diagnostics } = analyzeFixture("variable_annotation.wren");
      expect(diagnostics).toHaveLength(0);
    });
  });

  describe("variable_no_annotation.wren", () => {
    it("parses without errors or warnings", () => {
      const result = analyzeFixture("variable_no_annotation.wren");
      expect(result.warnings).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("method_parameter_annotation.wren", () => {
    it("parses without errors", () => {
      const { errors } = analyzeFixture("method_parameter_annotation.wren");
      expect(errors).toHaveLength(0);
    });
  });

  describe("method_return_type.wren", () => {
    it("parses without errors", () => {
      const { errors } = analyzeFixture("method_return_type.wren");
      expect(errors).toHaveLength(0);
    });
  });

  describe("constructor_annotation.wren", () => {
    it("parses without errors", () => {
      const { errors } = analyzeFixture("constructor_annotation.wren");
      expect(errors).toHaveLength(0);
    });
  });

  describe("for_loop_annotation.wren", () => {
    it("parses without errors", () => {
      const { errors } = analyzeFixture("for_loop_annotation.wren");
      expect(errors).toHaveLength(0);
    });
  });

  describe("getter_return_type.wren", () => {
    it("parses without errors", () => {
      const { errors } = analyzeFixture("getter_return_type.wren");
      expect(errors).toHaveLength(0);
    });
  });

  describe("setter_annotation.wren", () => {
    it("parses without errors", () => {
      const { errors } = analyzeFixture("setter_annotation.wren");
      expect(errors).toHaveLength(0);
    });
  });

  describe("operator_annotation.wren", () => {
    it("parses without errors", () => {
      const { errors } = analyzeFixture("operator_annotation.wren");
      expect(errors).toHaveLength(0);
    });
  });

  describe("subscript_annotation.wren", () => {
    it("parses without errors", () => {
      const { errors } = analyzeFixture("subscript_annotation.wren");
      expect(errors).toHaveLength(0);
    });
  });

  describe("block_parameter_annotation.wren", () => {
    it("parses without errors", () => {
      const { errors } = analyzeFixture("block_parameter_annotation.wren");
      expect(errors).toHaveLength(0);
    });
  });

  describe("mixed_annotations.wren", () => {
    it("parses without errors", () => {
      const { errors } = analyzeFixture("mixed_annotations.wren");
      expect(errors).toHaveLength(0);
    });
  });

  describe("annotation_with_custom_class.wren", () => {
    it("parses without errors", () => {
      const { errors } = analyzeFixture("annotation_with_custom_class.wren");
      expect(errors).toHaveLength(0);
    });
  });

  describe("bare_import.wren", () => {
    it("produces no errors for PascalCase names with bare import", () => {
      const { errors } = analyzeFixture("bare_import.wren");
      expect(errors).toHaveLength(0);
    });
  });

  describe("error fixtures", () => {
    it("missing_type_after_colon.wren produces parse errors", () => {
      const { errors } = analyzeFixture("missing_type_after_colon.wren");
      expect(errors.length).toBeGreaterThan(0);
    });

    it("missing_type_after_arrow.wren produces parse errors", () => {
      const { errors } = analyzeFixture("missing_type_after_arrow.wren");
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});

describe("analyze() API", () => {
  it("returns empty diagnostics for valid code", () => {
    const result = analyze("var x = 42");
    expect(result.diagnostics).toHaveLength(0);
    expect(result.module.kind).toBe("Module");
  });

  it("returns warnings for type mismatches", () => {
    const result = analyze('var x: Num = "hello"');
    const warnings = result.diagnostics.filter(
      (d) => d.severity === DiagnosticSeverity.Warning,
    );
    expect(warnings).toHaveLength(1);
  });

  it("returns errors for parse failures", () => {
    const result = analyze("var x: = 42");
    const errors = result.diagnostics.filter(
      (d) => d.severity === DiagnosticSeverity.Error,
    );
    expect(errors.length).toBeGreaterThan(0);
  });

  it("handles empty source", () => {
    const result = analyze("");
    expect(result.diagnostics).toHaveLength(0);
  });

  it("diagnostics have source field", () => {
    const result = analyze('var x: Num = "hello"');
    for (const d of result.diagnostics) {
      expect(d.source).toBe("wren-analyzer");
    }
  });
});
