/**
 * Wren Language Test Suite Runner
 *
 * Walks the Wren fork's test/language/ directory and runs our analyzer on each
 * .wren file, comparing our errors/warnings against the `// expect error` and
 * `// expect warning` comment markers embedded in the test files.
 *
 * Uses the same comment format as the Wren project's Python test runner
 * (wren/util/test.py).
 */

import { describe, it, expect, afterAll } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { analyze } from "../src/index.js";
import { SourceFile } from "../src/source-file.js";
import { DiagnosticSeverity } from "../src/types.js";

// Path to the Wren fork's language tests
const WREN_TEST_DIR = join(
  import.meta.dirname!,
  "..",
  "..",
  "wren",
  "test",
  "language",
);

// --- Comment patterns (mirroring wren/util/test.py) ---

const EXPECT_ERROR_PATTERN = /\/\/ expect error(?! line)/;
const EXPECT_ERROR_LINE_PATTERN = /\/\/ expect error line (\d+)/;
const EXPECT_WARNING_PATTERN = /\/\/ expect warning(?! line)/;
const EXPECT_WARNING_LINE_PATTERN = /\/\/ expect warning line (\d+)/;
const EXPECT_RUNTIME_ERROR_PATTERN = /\/\/ expect (?:handled )?runtime error:/;
const SKIP_PATTERN = /\/\/ skip:/;
const NONTEST_PATTERN = /\/\/ nontest/;

// --- Types ---

interface TestExpectations {
  errorLines: Set<number>;
  warningLines: Set<number>;
  hasRuntimeError: boolean;
  skip: boolean;
}

interface TestResult {
  path: string;
  status: "pass" | "fail" | "skip" | "missing";
  falsePositiveErrors: number[];
  falsePositiveWarnings: number[];
  missingErrors: number[];
  missingWarnings: number[];
}

// --- Parse expectations from a .wren file ---

function parseExpectations(source: string): TestExpectations {
  const lines = source.split("\n");
  const errorLines = new Set<number>();
  const warningLines = new Set<number>();
  let hasRuntimeError = false;
  let skip = false;

  // The Wren test runner counts line numbers starting at 1, and skips empty
  // lines when incrementing. We replicate that:
  let lineNum = 1;
  for (const line of lines) {
    if (line.length === 0) {
      lineNum++;
      continue;
    }

    if (SKIP_PATTERN.test(line) || NONTEST_PATTERN.test(line)) {
      skip = true;
      return { errorLines, warningLines, hasRuntimeError, skip };
    }

    if (EXPECT_RUNTIME_ERROR_PATTERN.test(line)) {
      hasRuntimeError = true;
    }

    // Same-line error
    if (EXPECT_ERROR_PATTERN.test(line)) {
      errorLines.add(lineNum);
    }

    // Error on a specific line
    const errorLineMatch = EXPECT_ERROR_LINE_PATTERN.exec(line);
    if (errorLineMatch) {
      errorLines.add(parseInt(errorLineMatch[1]!, 10));
    }

    // Same-line warning
    if (EXPECT_WARNING_PATTERN.test(line)) {
      warningLines.add(lineNum);
    }

    // Warning on a specific line
    const warningLineMatch = EXPECT_WARNING_LINE_PATTERN.exec(line);
    if (warningLineMatch) {
      warningLines.add(parseInt(warningLineMatch[1]!, 10));
    }

    lineNum++;
  }

  return { errorLines, warningLines, hasRuntimeError, skip };
}

// --- Collect all .wren files recursively ---

function collectWrenFiles(dir: string): string[] {
  const files: string[] = [];

  function walk(d: string) {
    for (const entry of readdirSync(d)) {
      const full = join(d, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        walk(full);
      } else if (entry.endsWith(".wren")) {
        files.push(full);
      }
    }
  }

  walk(dir);
  files.sort();
  return files;
}

// --- Run the suite ---

const allFiles = collectWrenFiles(WREN_TEST_DIR);
const results: TestResult[] = [];

describe("Wren language test suite", () => {
  for (const filePath of allFiles) {
    const relPath = relative(WREN_TEST_DIR, filePath);
    const source = readFileSync(filePath, "utf-8");
    const expectations = parseExpectations(source);

    // Skip non-test files, skipped files, and runtime-error-only files
    if (expectations.skip) {
      results.push({
        path: relPath,
        status: "skip",
        falsePositiveErrors: [],
        falsePositiveWarnings: [],
        missingErrors: [],
        missingWarnings: [],
      });
      continue;
    }

    if (
      expectations.hasRuntimeError &&
      expectations.errorLines.size === 0 &&
      expectations.warningLines.size === 0
    ) {
      // Pure runtime error test — we can't detect these
      results.push({
        path: relPath,
        status: "skip",
        falsePositiveErrors: [],
        falsePositiveWarnings: [],
        missingErrors: [],
        missingWarnings: [],
      });
      continue;
    }

    it(relPath, () => {
      const result = analyze(source, filePath);
      const sourceFile = new SourceFile(filePath, source);

      // Map diagnostics to line numbers
      const actualErrorLines = new Set<number>();
      const actualWarningLines = new Set<number>();

      for (const diag of result.diagnostics) {
        const line = sourceFile.lineAt(diag.span.start);
        if (diag.severity === DiagnosticSeverity.Error) {
          actualErrorLines.add(line);
        } else if (diag.severity === DiagnosticSeverity.Warning) {
          actualWarningLines.add(line);
        }
      }

      // False positives: errors/warnings we reported that weren't expected
      const falsePositiveErrors = [...actualErrorLines].filter(
        (l) => !expectations.errorLines.has(l),
      );
      const falsePositiveWarnings = [...actualWarningLines].filter(
        (l) => !expectations.warningLines.has(l),
      );

      // Missing: expected errors/warnings we didn't detect
      const missingErrors = [...expectations.errorLines].filter(
        (l) => !actualErrorLines.has(l),
      );
      const missingWarnings = [...expectations.warningLines].filter(
        (l) => !actualWarningLines.has(l),
      );

      const hasFalsePositives =
        falsePositiveErrors.length > 0 || falsePositiveWarnings.length > 0;
      const hasMissing =
        missingErrors.length > 0 || missingWarnings.length > 0;

      results.push({
        path: relPath,
        status: hasFalsePositives ? "fail" : hasMissing ? "missing" : "pass",
        falsePositiveErrors,
        falsePositiveWarnings,
        missingErrors,
        missingWarnings,
      });

      // We only FAIL on false positives (errors we shouldn't be reporting).
      // Missing expected errors are tracked but don't fail the test — they
      // represent gaps we can close later.
      if (falsePositiveErrors.length > 0) {
        expect.soft(falsePositiveErrors, `Unexpected errors on lines`).toEqual(
          [],
        );
      }
      if (falsePositiveWarnings.length > 0) {
        expect
          .soft(falsePositiveWarnings, `Unexpected warnings on lines`)
          .toEqual([]);
      }
    });
  }

  afterAll(() => {
    const pass = results.filter((r) => r.status === "pass").length;
    const fail = results.filter((r) => r.status === "fail").length;
    const missing = results.filter((r) => r.status === "missing").length;
    const skip = results.filter((r) => r.status === "skip").length;
    const total = results.length;

    console.log("\n=== Wren Test Suite Compatibility Report ===");
    console.log(`Total files:  ${total}`);
    console.log(`  Passed:     ${pass} (exact match)`);
    console.log(`  Missing:    ${missing} (expected errors not yet detected)`);
    console.log(`  Failed:     ${fail} (false positives — unexpected errors)`);
    console.log(`  Skipped:    ${skip} (runtime-only / skip / nontest)`);

    if (fail > 0) {
      console.log("\n--- False positive details ---");
      for (const r of results.filter((r) => r.status === "fail")) {
        const parts: string[] = [];
        if (r.falsePositiveErrors.length > 0)
          parts.push(
            `unexpected errors on lines ${r.falsePositiveErrors.join(", ")}`,
          );
        if (r.falsePositiveWarnings.length > 0)
          parts.push(
            `unexpected warnings on lines ${r.falsePositiveWarnings.join(", ")}`,
          );
        console.log(`  ${r.path}: ${parts.join("; ")}`);
      }
    }

    if (missing > 0 && missing <= 20) {
      console.log("\n--- Missing detection details (first 20) ---");
      for (const r of results
        .filter((r) => r.status === "missing")
        .slice(0, 20)) {
        const parts: string[] = [];
        if (r.missingErrors.length > 0)
          parts.push(
            `missing errors on lines ${r.missingErrors.join(", ")}`,
          );
        if (r.missingWarnings.length > 0)
          parts.push(
            `missing warnings on lines ${r.missingWarnings.join(", ")}`,
          );
        console.log(`  ${r.path}: ${parts.join("; ")}`);
      }
    }
  });
});
