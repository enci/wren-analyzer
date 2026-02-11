import { readFileSync, statSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { analyze } from "../src/index.js";
import {
  formatDiagnosticsJson,
  formatDiagnosticsPretty,
} from "../src/reporter.js";
import { SourceFile } from "../src/source-file.js";

function main() {
  const args = process.argv.slice(2);

  let json = false;
  if (args[0] === "--json") {
    json = true;
    args.shift();
  }

  if (args.length !== 1) {
    console.error("Usage: wren-analyzer [--json] <source file or directory>");
    process.exit(1);
  }

  const path = args[0]!;
  const stat = statSync(path, { throwIfNoEntry: false });

  if (!stat) {
    console.error(`File not found: ${path}`);
    process.exit(1);
  }

  if (stat.isDirectory()) {
    const files = readdirSync(path).filter((f) => f.endsWith(".wren"));
    for (const file of files) {
      analyzeFile(join(path, file), json);
    }
  } else {
    analyzeFile(path, json);
  }
}

function analyzeFile(path: string, json: boolean): void {
  const source = readFileSync(path, "utf-8");
  const { diagnostics } = analyze(source, path);

  if (diagnostics.length === 0) return;

  if (json) {
    console.log(formatDiagnosticsJson(diagnostics));
  } else {
    const file = new SourceFile(path, source);
    console.log(formatDiagnosticsPretty(diagnostics, file));
  }
}

main();
