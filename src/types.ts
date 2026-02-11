export interface Span {
  start: number;
  length: number;
}

export enum DiagnosticSeverity {
  Error = "error",
  Warning = "warning",
  Info = "info",
}

export interface Diagnostic {
  message: string;
  severity: DiagnosticSeverity;
  span: Span;
  source: "wren-analyzer";
  code?: string;
}
