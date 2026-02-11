import { describe, it, expect } from "vitest";
import { Lexer } from "../src/lexer.js";
import { SourceFile } from "../src/source-file.js";
import { TokenType } from "../src/token.js";

function tokenize(source: string): { type: TokenType; text: string }[] {
  const file = new SourceFile("<test>", source);
  const lexer = new Lexer(file);
  const tokens: { type: TokenType; text: string }[] = [];
  while (true) {
    const token = lexer.readToken();
    tokens.push({ type: token.type, text: token.text });
    if (token.type === TokenType.Eof) break;
  }
  return tokens;
}

function types(source: string): TokenType[] {
  return tokenize(source).map((t) => t.type);
}

describe("Lexer", () => {
  it("tokenizes empty input", () => {
    expect(types("")).toEqual([TokenType.Eof]);
  });

  it("tokenizes punctuators", () => {
    expect(types("()[]{}")).toEqual([
      TokenType.LeftParen,
      TokenType.RightParen,
      TokenType.LeftBracket,
      TokenType.RightBracket,
      TokenType.LeftBrace,
      TokenType.RightBrace,
      TokenType.Eof,
    ]);
  });

  it("tokenizes operators", () => {
    expect(types("+ - * / %")).toEqual([
      TokenType.Plus,
      TokenType.Minus,
      TokenType.Star,
      TokenType.Slash,
      TokenType.Percent,
      TokenType.Eof,
    ]);
  });

  it("tokenizes comparison operators", () => {
    expect(types("< <= > >= == !=")).toEqual([
      TokenType.Less,
      TokenType.LessEqual,
      TokenType.Greater,
      TokenType.GreaterEqual,
      TokenType.EqualEqual,
      TokenType.BangEqual,
      TokenType.Eof,
    ]);
  });

  it("tokenizes shift operators", () => {
    expect(types("<< >>")).toEqual([
      TokenType.LessLess,
      TokenType.GreaterGreater,
      TokenType.Eof,
    ]);
  });

  it("tokenizes dot operators", () => {
    expect(types(". .. ...")).toEqual([
      TokenType.Dot,
      TokenType.DotDot,
      TokenType.DotDotDot,
      TokenType.Eof,
    ]);
  });

  it("tokenizes logical operators", () => {
    expect(types("&& || !")).toEqual([
      TokenType.AmpAmp,
      TokenType.PipePipe,
      TokenType.Bang,
      TokenType.Eof,
    ]);
  });

  it("tokenizes the arrow operator", () => {
    expect(types("->")).toEqual([TokenType.Arrow, TokenType.Eof]);
  });

  it("tokenizes minus vs arrow", () => {
    expect(types("- ->")).toEqual([
      TokenType.Minus,
      TokenType.Arrow,
      TokenType.Eof,
    ]);
  });

  it("tokenizes numbers", () => {
    const tokens = tokenize("42 3.14 0xFF");
    expect(tokens[0]).toMatchObject({ type: TokenType.Number, text: "42" });
    expect(tokens[1]).toMatchObject({ type: TokenType.Number, text: "3.14" });
    expect(tokens[2]).toMatchObject({ type: TokenType.Number, text: "0xFF" });
  });

  it("tokenizes strings", () => {
    const tokens = tokenize('"hello" "world"');
    expect(tokens[0]).toMatchObject({
      type: TokenType.String,
      text: '"hello"',
    });
    expect(tokens[1]).toMatchObject({
      type: TokenType.String,
      text: '"world"',
    });
  });

  it("tokenizes string interpolation", () => {
    const tokens = tokenize('"hello %(name)"');
    expect(tokens[0]).toMatchObject({
      type: TokenType.Interpolation,
      text: '"hello %(',
    });
    expect(tokens[1]).toMatchObject({ type: TokenType.Name, text: "name" });
    expect(tokens[2]).toMatchObject({ type: TokenType.String, text: ')"' });
  });

  it("tokenizes keywords", () => {
    expect(types("var class if else while for")).toEqual([
      TokenType.Var,
      TokenType.Class,
      TokenType.If,
      TokenType.Else,
      TokenType.While,
      TokenType.For,
      TokenType.Eof,
    ]);
  });

  it("tokenizes identifiers", () => {
    const tokens = tokenize("foo bar baz");
    expect(tokens[0]).toMatchObject({ type: TokenType.Name, text: "foo" });
    expect(tokens[1]).toMatchObject({ type: TokenType.Name, text: "bar" });
    expect(tokens[2]).toMatchObject({ type: TokenType.Name, text: "baz" });
  });

  it("tokenizes fields", () => {
    const tokens = tokenize("_field __staticField");
    expect(tokens[0]).toMatchObject({ type: TokenType.Field, text: "_field" });
    expect(tokens[1]).toMatchObject({
      type: TokenType.StaticField,
      text: "__staticField",
    });
  });

  it("tokenizes newlines", () => {
    expect(types("a\nb")).toEqual([
      TokenType.Name,
      TokenType.Line,
      TokenType.Name,
      TokenType.Eof,
    ]);
  });

  it("skips line comments", () => {
    expect(types("a // comment\nb")).toEqual([
      TokenType.Name,
      TokenType.Line,
      TokenType.Name,
      TokenType.Eof,
    ]);
  });

  it("skips block comments", () => {
    expect(types("a /* comment */ b")).toEqual([
      TokenType.Name,
      TokenType.Name,
      TokenType.Eof,
    ]);
  });

  it("handles nested block comments", () => {
    expect(types("a /* outer /* inner */ still comment */ b")).toEqual([
      TokenType.Name,
      TokenType.Name,
      TokenType.Eof,
    ]);
  });

  it("tokenizes a type-annotated variable", () => {
    expect(types("var x: Num = 42")).toEqual([
      TokenType.Var,
      TokenType.Name,
      TokenType.Colon,
      TokenType.Name,
      TokenType.Equal,
      TokenType.Number,
      TokenType.Eof,
    ]);
  });

  it("tokenizes a method with return type", () => {
    expect(types("foo() -> Num")).toEqual([
      TokenType.Name,
      TokenType.LeftParen,
      TokenType.RightParen,
      TokenType.Arrow,
      TokenType.Name,
      TokenType.Eof,
    ]);
  });

  it("tokenizes colon, equal, question", () => {
    expect(types(": = ?")).toEqual([
      TokenType.Colon,
      TokenType.Equal,
      TokenType.Question,
      TokenType.Eof,
    ]);
  });

  it("tokenizes booleans and null", () => {
    expect(types("true false null")).toEqual([
      TokenType.True,
      TokenType.False,
      TokenType.Null,
      TokenType.Eof,
    ]);
  });
});
