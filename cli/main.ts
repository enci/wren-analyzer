import { readFileSync, statSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { analyze } from "../src/index.js";
import type { AnalysisOptions } from "../src/index.js";
import {
  formatDiagnosticsJson,
  formatDiagnosticsPretty,
} from "../src/reporter.js";
import { SourceFile } from "../src/source-file.js";

function main() {
  const args = process.argv.slice(2);

  let json = false;
  const searchPaths: string[] = [];

  // Parse flags
  while (args.length > 0 && args[0]!.startsWith("-")) {
    if (args[0] === "--json") {
      json = true;
      args.shift();
    } else if (args[0] === "--search-path" || args[0] === "-I") {
      args.shift();
      if (args.length === 0) {
        console.error("Missing path after --search-path");
        process.exit(1);
      }
      searchPaths.push(args.shift()!);
    } else {
      console.error(`Unknown flag: ${args[0]}`);
      process.exit(1);
    }
  }

  if (args.length !== 1) {
    console.error(
      "Usage: wren-analyzer [--json] [--search-path <dir>]... <source file or directory>",
    );
    process.exit(1);
  }

  const path = args[0]!;
  const stat = statSync(path, { throwIfNoEntry: false });

  if (!stat) {
    console.error(`File not found: ${path}`);
    process.exit(1);
  }

  // If analyzing a directory, add it as a search path automatically
  // so files within the directory can resolve imports to each other.
  const options: AnalysisOptions = { searchPaths };

  if (stat.isDirectory()) {
    // Add the directory itself as a search path
    if (!searchPaths.includes(path)) {
      searchPaths.push(path);
    }
    for (const file of collectWrenFiles(path)) {
      // Also add each file's directory as a search path for local imports
      const fileDir = dirname(file);
      if (!searchPaths.includes(fileDir)) {
        searchPaths.push(fileDir);
      }
      analyzeFile(file, json, options);
    }
  } else {
    // For single files, add the file's directory as a search path
    const fileDir = dirname(path);
    if (!searchPaths.includes(fileDir)) {
      searchPaths.push(fileDir);
    }
    analyzeFile(path, json, options);
  }
}

function analyzeFile(
  path: string,
  json: boolean,
  options: AnalysisOptions,
): void {
  const source = readFileSync(path, "utf-8");
  const { diagnostics } = analyze(source, path, options);

  if (diagnostics.length === 0) return;

  if (json) {
    console.log(formatDiagnosticsJson(diagnostics));
  } else {
    const file = new SourceFile(path, source);
    console.log(formatDiagnosticsPretty(diagnostics, file));
  }
}

function collectWrenFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) {
      files.push(...collectWrenFiles(full));
    } else if (entry.endsWith(".wren")) {
      files.push(full);
    }
  }
  files.sort();
  return files;
}

main();
