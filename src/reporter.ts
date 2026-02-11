import type { Diagnostic } from "./types.js";
import { DiagnosticSeverity } from "./types.js";
import type { SourceFile } from "./source-file.js";

export function formatDiagnosticsJson(diagnostics: Diagnostic[]): string {
  return JSON.stringify(diagnostics, null, 2);
}

export function formatDiagnosticsPretty(
  diagnostics: Diagnostic[],
  source: SourceFile,
): string {
  const RED = "\x1b[31m";
  const YELLOW = "\x1b[33m";
  const CYAN = "\x1b[36m";
  const GRAY = "\x1b[30;1m";
  const NORMAL = "\x1b[0m";

  const lines: string[] = [];

  for (const diag of diagnostics) {
    const line = source.lineAt(diag.span.start);
    const column = source.columnAt(diag.span.start);

    const color =
      diag.severity === DiagnosticSeverity.Error
        ? RED
        : diag.severity === DiagnosticSeverity.Warning
          ? YELLOW
          : CYAN;

    const label =
      diag.severity === DiagnosticSeverity.Error
        ? "Error"
        : diag.severity === DiagnosticSeverity.Warning
          ? "Warning"
          : "Info";

    lines.push(
      `${GRAY}[${source.path} ${line}:${column}]${NORMAL} ${color}${label}:${NORMAL} ${diag.message}`,
    );

    // Show the source line with underline
    if (line > 0) {
      const sourceLine = source.getLine(line);
      lines.push(`  ${GRAY}${line}:${NORMAL} ${sourceLine}`);

      const highlightStart = column - 1;
      const highlightLength = Math.max(1, diag.span.length);
      const indent = " ".repeat(highlightStart);
      const highlight = color + "^".repeat(highlightLength) + NORMAL;
      const lineNumWidth = line.toString().length;
      lines.push(`  ${" ".repeat(lineNumWidth + 1)} ${indent}${highlight}`);
    }
  }

  return lines.join("\n");
}
