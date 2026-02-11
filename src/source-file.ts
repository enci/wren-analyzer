import { Chars } from "./chars.js";

export class SourceFile {
  readonly path: string;
  private readonly str: string;
  private readonly bytes: Uint8Array;
  private lines: number[] | null = null;

  constructor(path: string, source: string) {
    this.path = path;
    this.str = source;
    this.bytes = new TextEncoder().encode(source);
  }

  byteAt(index: number): number {
    return this.bytes[index]!;
  }

  get count(): number {
    return this.bytes.length;
  }

  columnAt(offset: number): number {
    let column = 1;
    for (let i = offset - 1; i >= 0; i--) {
      if (this.bytes[i] === Chars.lineFeed) break;
      column++;
    }
    return column;
  }

  lineAt(offset: number): number {
    const lines = this.findLines();
    for (let i = 0; i < lines.length; i++) {
      if (offset < lines[i]!) return i;
    }
    return lines.length;
  }

  getLine(line: number): string {
    const lines = this.findLines();
    const start = lines[line - 1]!;
    const end = lines[line]! - 1;
    return this.str.slice(start, end);
  }

  substring(start: number, length: number): string {
    return this.str.slice(start, start + length);
  }

  private findLines(): number[] {
    if (this.lines !== null) return this.lines;

    this.lines = [0];
    for (let i = 0; i < this.bytes.length; i++) {
      if (this.bytes[i] === Chars.lineFeed) {
        this.lines.push(i + 1);
      }
    }
    return this.lines;
  }
}
