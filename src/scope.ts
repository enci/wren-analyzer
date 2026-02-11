import { isLowerAlpha } from "./chars.js";
import type { Token } from "./token.js";
import type { Diagnostic } from "./types.js";
import { DiagnosticSeverity } from "./types.js";

// A scope entry is a Token (for user-declared vars) or true (for built-in names).
type ScopeEntry = Token | true;

// null is used as a sentinel for class boundaries.
type ScopeMap = Map<string, ScopeEntry> | null;

export class Scope {
  private scopes: ScopeMap[];
  private forwardReferences: Token[] = [];
  readonly diagnostics: Diagnostic[];

  constructor(diagnostics: Diagnostic[]) {
    this.diagnostics = diagnostics;

    // Module scope with built-in names
    const moduleScope = new Map<string, ScopeEntry>([
      ["Bool", true],
      ["Class", true],
      ["Fiber", true],
      ["Fn", true],
      ["List", true],
      ["Map", true],
      ["MapKeySequence", true],
      ["MapSequence", true],
      ["MapValueSequence", true],
      ["Null", true],
      ["Num", true],
      ["Object", true],
      ["Range", true],
      ["Sequence", true],
      ["String", true],
      ["StringByteSequence", true],
      ["StringCodePointSequence", true],
      ["System", true],
      ["WhereSequence", true],
    ]);

    this.scopes = [moduleScope];
  }

  declare(name: Token): void {
    const scope = this.scopes[this.scopes.length - 1];
    if (scope === null) return; // inside class sentinel

    if (scope.has(name.text)) {
      const existing = scope.get(name.text)!;
      const lineInfo =
        existing === true
          ? ""
          : `, on line ${name.source.lineAt(existing.start)}`;
      this.diagnostics.push({
        message: `A variable named '${name.text}' is already defined in this scope${lineInfo}.`,
        severity: DiagnosticSeverity.Error,
        span: { start: name.start, length: name.length },
        source: "wren-analyzer",
        code: "duplicate-variable",
      });
      return;
    }

    scope.set(name.text, name);
  }

  resolve(name: Token): Token | true | null {
    let reachedClass = false;

    for (let i = this.scopes.length - 1; i >= 0; i--) {
      const scope = this.scopes[i];
      if (scope === null) {
        reachedClass = true;
        break;
      }
      if (scope.has(name.text)) {
        return scope.get(name.text)!;
      }
    }

    if (reachedClass) {
      const firstByte = name.text.charCodeAt(0);
      if (isLowerAlpha(firstByte)) {
        // Lowercase name inside class = implicit self-send
        return null;
      } else {
        // Capitalized name resolves at module level
        const moduleScope = this.scopes[0]!;
        if (moduleScope.has(name.text)) {
          return moduleScope.get(name.text)!;
        } else {
          // Assume forward reference
          this.forwardReferences.push(name);
          return null;
        }
      }
    }

    // Not defined
    this.diagnostics.push({
      message: `Variable '${name.text}' is not defined.`,
      severity: DiagnosticSeverity.Error,
      span: { start: name.start, length: name.length },
      source: "wren-analyzer",
      code: "undefined-variable",
    });
    return null;
  }

  begin(): void {
    this.scopes.push(new Map());
  }

  end(): void {
    this.scopes.pop();
  }

  beginClass(): void {
    this.scopes.push(null);
  }

  endClass(): void {
    this.scopes.pop();
  }

  checkForwardReferences(): void {
    const moduleScope = this.scopes[0]!;
    for (const use of this.forwardReferences) {
      if (!moduleScope.has(use.text)) {
        this.diagnostics.push({
          message: `Variable '${use.text}' is not defined.`,
          severity: DiagnosticSeverity.Error,
          span: { start: use.start, length: use.length },
          source: "wren-analyzer",
          code: "undefined-variable",
        });
      }
    }
  }
}
