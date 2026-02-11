import { Chars, isAlpha, isAlphaNumeric, isDigit, isHexDigit } from "./chars.js";
import { SourceFile } from "./source-file.js";
import { type Token, TokenType, KEYWORDS, makeToken } from "./token.js";

type Punctuator = [TokenType, ...(number | TokenType)[]];

const PUNCTUATORS = new Map<number, Punctuator>([
  [Chars.leftParen, [TokenType.LeftParen]],
  [Chars.rightParen, [TokenType.RightParen]],
  [Chars.leftBracket, [TokenType.LeftBracket]],
  [Chars.rightBracket, [TokenType.RightBracket]],
  [Chars.leftBrace, [TokenType.LeftBrace]],
  [Chars.rightBrace, [TokenType.RightBrace]],
  [Chars.colon, [TokenType.Colon]],
  [Chars.comma, [TokenType.Comma]],
  [Chars.star, [TokenType.Star]],
  [Chars.slash, [TokenType.Slash]],
  [Chars.percent, [TokenType.Percent]],
  [Chars.plus, [TokenType.Plus]],
  [Chars.tilde, [TokenType.Tilde]],
  [Chars.caret, [TokenType.Caret]],
  [Chars.question, [TokenType.Question]],
  [Chars.lineFeed, [TokenType.Line]],

  [Chars.pipe, [TokenType.Pipe, Chars.pipe, TokenType.PipePipe]],
  [Chars.amp, [TokenType.Amp, Chars.amp, TokenType.AmpAmp]],
  [Chars.bang, [TokenType.Bang, Chars.equal, TokenType.BangEqual]],
  [Chars.equal, [TokenType.Equal, Chars.equal, TokenType.EqualEqual]],

  [
    Chars.dot,
    [TokenType.Dot, Chars.dot, TokenType.DotDot, Chars.dot, TokenType.DotDotDot],
  ],
]);

export class Lexer {
  private source: SourceFile;
  private start = 0;
  private current = 0;
  private interpolations: number[] = [];

  constructor(source: SourceFile) {
    this.source = source;
    this.skipBomAndShebang();
  }

  private skipBomAndShebang(): void {
    // Skip UTF-8 BOM (U+FEFF)
    if (this.source.byteAt(0) === 0xfeff) {
      this.current = 1;
    }

    // Skip shebang line: #!...
    if (
      this.current < this.source.count &&
      this.source.byteAt(this.current) === 0x23 /* # */ &&
      this.current + 1 < this.source.count &&
      this.source.byteAt(this.current + 1) === 0x21 /* ! */
    ) {
      while (
        this.current < this.source.count &&
        this.source.byteAt(this.current) !== Chars.lineFeed
      ) {
        this.current++;
      }
    }
  }

  readToken(): Token {
    if (this.current >= this.source.count) {
      return this.token(TokenType.Eof);
    }

    this.skipWhitespace();

    this.start = this.current;

    if (this.current >= this.source.count) {
      return this.token(TokenType.Eof);
    }

    const c = this.source.byteAt(this.current);
    this.advance();

    // Handle interpolation nesting
    if (this.interpolations.length > 0) {
      if (c === Chars.leftParen) {
        this.interpolations[this.interpolations.length - 1]!++;
      } else if (c === Chars.rightParen) {
        this.interpolations[this.interpolations.length - 1]!--;
        if (this.interpolations[this.interpolations.length - 1] === 0) {
          this.interpolations.pop();
          return this.readString();
        }
      }
    }

    // Handle "-" and "->"
    if (c === Chars.minus) {
      if (this.match(Chars.greater)) {
        return this.token(TokenType.Arrow);
      }
      return this.token(TokenType.Minus);
    }

    // Maximal munch punctuators
    const punctuator = PUNCTUATORS.get(c);
    if (punctuator) {
      let type = punctuator[0];
      let i = 1;
      while (i < punctuator.length) {
        if (!this.match(punctuator[i] as number)) break;
        type = punctuator[i + 1] as TokenType;
        i += 2;
      }
      return this.token(type);
    }

    // Handle "<", "<<", "<="
    if (c === Chars.less) {
      if (this.match(Chars.less)) return this.token(TokenType.LessLess);
      if (this.match(Chars.equal)) return this.token(TokenType.LessEqual);
      return this.token(TokenType.Less);
    }

    // Handle ">", ">>", ">="
    if (c === Chars.greater) {
      if (this.match(Chars.greater))
        return this.token(TokenType.GreaterGreater);
      if (this.match(Chars.equal)) return this.token(TokenType.GreaterEqual);
      return this.token(TokenType.Greater);
    }

    if (c === Chars.underscore) return this.readField();
    if (c === Chars.quote) return this.readString();

    if (c === Chars.zero && this.peek() === Chars.lowerX)
      return this.readHexNumber();
    if (isDigit(c)) return this.readNumber();
    if (isAlpha(c)) return this.readName();

    // Skip class/method attributes: #key or #!key (with optional groups/values)
    if (c === 0x23 /* # */) {
      this.skipAttribute();
      return this.readToken();
    }

    return this.token(TokenType.Error);
  }

  private skipWhitespace(): void {
    while (true) {
      const c = this.peek();
      if (c === Chars.tab || c === Chars.carriageReturn || c === Chars.space) {
        this.advance();
      } else if (c === Chars.slash && this.peek(1) === Chars.slash) {
        // Line comment
        while (this.peek() !== Chars.lineFeed && !this.isAtEnd) {
          this.advance();
        }
      } else if (c === Chars.slash && this.peek(1) === Chars.star) {
        this.advance();
        this.advance();
        // Block comments can nest
        let nesting = 1;
        while (nesting > 0) {
          if (this.isAtEnd) return;
          if (
            this.peek() === Chars.slash &&
            this.peek(1) === Chars.star
          ) {
            this.advance();
            this.advance();
            nesting++;
          } else if (
            this.peek() === Chars.star &&
            this.peek(1) === Chars.slash
          ) {
            this.advance();
            this.advance();
            nesting--;
          } else {
            this.advance();
          }
        }
      } else {
        break;
      }
    }
  }

  private readField(): Token {
    let type = TokenType.Field;
    if (this.match(Chars.underscore)) type = TokenType.StaticField;
    while (this.matchFn(isAlphaNumeric)) {}
    return this.token(type);
  }

  private readString(): Token {
    // Check for raw string: """
    if (
      this.current + 1 < this.source.count &&
      this.source.byteAt(this.current) === Chars.quote &&
      this.source.byteAt(this.current + 1) === Chars.quote
    ) {
      // Consume the two extra quotes (first was consumed before this call)
      this.advance();
      this.advance();
      return this.readRawString();
    }

    let type = TokenType.String;

    while (this.current < this.source.count) {
      const c = this.source.byteAt(this.current);
      this.advance();

      if (c === Chars.backslash) {
        // Skip escaped character
        if (!this.isAtEnd) this.advance();
      } else if (c === Chars.percent) {
        // String interpolation
        if (!this.isAtEnd) this.advance(); // consume '('
        this.interpolations.push(1);
        type = TokenType.Interpolation;
        break;
      } else if (c === Chars.quote) {
        break;
      }
    }

    return this.token(type);
  }

  private readRawString(): Token {
    // Read until closing """
    while (this.current + 2 < this.source.count) {
      if (
        this.source.byteAt(this.current) === Chars.quote &&
        this.source.byteAt(this.current + 1) === Chars.quote &&
        this.source.byteAt(this.current + 2) === Chars.quote
      ) {
        this.advance();
        this.advance();
        this.advance();
        return this.token(TokenType.String);
      }
      this.advance();
    }
    // Unterminated raw string — consume remaining
    while (!this.isAtEnd) this.advance();
    return this.token(TokenType.String);
  }

  private readHexNumber(): Token {
    this.advance(); // skip 'x'
    while (this.matchFn(isHexDigit)) {}
    return this.token(TokenType.Number);
  }

  private readNumber(): Token {
    while (this.matchFn(isDigit)) {}

    // Floating point
    if (this.peek() === Chars.dot && isDigit(this.peek(1))) {
      this.advance(); // consume '.'
      while (this.matchFn(isDigit)) {}
    }

    // Scientific notation
    if (this.peek() === 0x65 /* e */ || this.peek() === 0x45 /* E */) {
      this.advance();
      if (this.peek() === Chars.plus || this.peek() === Chars.minus) {
        this.advance();
      }
      while (this.matchFn(isDigit)) {}
    }

    return this.token(TokenType.Number);
  }

  private skipAttribute(): void {
    // Skip optional '!' after '#'
    if (!this.isAtEnd && this.source.byteAt(this.current) === 0x21 /* ! */) {
      this.advance();
    }
    // Skip everything until end of line (handles key, key=value, group(...))
    // Attributes can contain parenthesized groups, so track nesting
    let parenDepth = 0;
    while (!this.isAtEnd) {
      const ch = this.source.byteAt(this.current);
      if (ch === Chars.lineFeed && parenDepth === 0) break;
      if (ch === Chars.leftParen) parenDepth++;
      if (ch === Chars.rightParen) parenDepth--;
      this.advance();
    }
  }

  private readName(): Token {
    while (this.matchFn(isAlphaNumeric)) {}

    const text = this.source.substring(this.start, this.current - this.start);
    const type = KEYWORDS.get(text) ?? TokenType.Name;
    return makeToken(this.source, type, this.start, this.current - this.start);
  }

  private get isAtEnd(): boolean {
    return this.current >= this.source.count;
  }

  private advance(): void {
    this.current++;
  }

  private peek(n = 0): number {
    if (this.current + n >= this.source.count) return -1;
    return this.source.byteAt(this.current + n);
  }

  private match(expected: number): boolean {
    if (this.isAtEnd) return false;
    if (this.source.byteAt(this.current) !== expected) return false;
    this.advance();
    return true;
  }

  private matchFn(predicate: (c: number) => boolean): boolean {
    if (this.isAtEnd) return false;
    if (!predicate(this.source.byteAt(this.current))) return false;
    this.advance();
    return true;
  }

  private token(type: TokenType): Token {
    return makeToken(this.source, type, this.start, this.current - this.start);
  }
}
