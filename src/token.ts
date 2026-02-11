import type { SourceFile } from "./source-file.js";

export enum TokenType {
  // Punctuators
  LeftParen = "leftParen",
  RightParen = "rightParen",
  LeftBracket = "leftBracket",
  RightBracket = "rightBracket",
  LeftBrace = "leftBrace",
  RightBrace = "rightBrace",
  Colon = "colon",
  Dot = "dot",
  DotDot = "dotDot",
  DotDotDot = "dotDotDot",
  Comma = "comma",
  Star = "star",
  Slash = "slash",
  Percent = "percent",
  Plus = "plus",
  Minus = "minus",
  Pipe = "pipe",
  PipePipe = "pipePipe",
  Caret = "caret",
  Amp = "amp",
  AmpAmp = "ampAmp",
  Question = "question",
  Bang = "bang",
  Tilde = "tilde",
  Equal = "equal",
  Less = "less",
  LessEqual = "lessEqual",
  LessLess = "lessLess",
  Greater = "greater",
  GreaterEqual = "greaterEqual",
  GreaterGreater = "greaterGreater",
  EqualEqual = "equalEqual",
  BangEqual = "bangEqual",
  Arrow = "arrow", // ->

  // Keywords
  Break = "break",
  Class = "class",
  Construct = "construct",
  Else = "else",
  False = "false",
  For = "for",
  Foreign = "foreign",
  If = "if",
  Import = "import",
  In = "in",
  Is = "is",
  Null = "null",
  Return = "return",
  Static = "static",
  Super = "super",
  This = "this",
  True = "true",
  Var = "var",
  While = "while",

  // Literals and identifiers
  Field = "field",
  StaticField = "staticField",
  Name = "name",
  Number = "number",
  String = "string",
  Interpolation = "interpolation",
  Line = "line",
  Error = "error",
  Eof = "eof",
}

export const KEYWORDS: Record<string, TokenType> = {
  break: TokenType.Break,
  class: TokenType.Class,
  construct: TokenType.Construct,
  else: TokenType.Else,
  false: TokenType.False,
  for: TokenType.For,
  foreign: TokenType.Foreign,
  if: TokenType.If,
  import: TokenType.Import,
  in: TokenType.In,
  is: TokenType.Is,
  null: TokenType.Null,
  return: TokenType.Return,
  static: TokenType.Static,
  super: TokenType.Super,
  this: TokenType.This,
  true: TokenType.True,
  var: TokenType.Var,
  while: TokenType.While,
};

export interface Token {
  source: SourceFile;
  type: TokenType;
  start: number;
  length: number;
  text: string;
}

export function makeToken(
  source: SourceFile,
  type: TokenType,
  start: number,
  length: number,
): Token {
  return {
    source,
    type,
    start,
    length,
    text: source.substring(start, length),
  };
}
