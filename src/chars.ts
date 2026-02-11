export const Chars = {
  tab: 0x09,
  lineFeed: 0x0a,
  carriageReturn: 0x0d,
  space: 0x20,
  bang: 0x21,
  quote: 0x22,
  hash: 0x23,
  percent: 0x25,
  amp: 0x26,
  leftParen: 0x28,
  rightParen: 0x29,
  star: 0x2a,
  plus: 0x2b,
  comma: 0x2c,
  minus: 0x2d,
  dot: 0x2e,
  slash: 0x2f,

  zero: 0x30,
  nine: 0x39,

  colon: 0x3a,
  less: 0x3c,
  equal: 0x3d,
  greater: 0x3e,
  question: 0x3f,

  upperA: 0x41,
  upperF: 0x46,
  upperZ: 0x5a,

  leftBracket: 0x5b,
  backslash: 0x5c,
  rightBracket: 0x5d,
  caret: 0x5e,
  underscore: 0x5f,

  lowerA: 0x61,
  lowerF: 0x66,
  lowerX: 0x78,
  lowerZ: 0x7a,

  leftBrace: 0x7b,
  pipe: 0x7c,
  rightBrace: 0x7d,
  tilde: 0x7e,
} as const;

export function isAlpha(c: number): boolean {
  return (
    (c >= Chars.lowerA && c <= Chars.lowerZ) ||
    (c >= Chars.upperA && c <= Chars.upperZ) ||
    c === Chars.underscore
  );
}

export function isDigit(c: number): boolean {
  return c >= Chars.zero && c <= Chars.nine;
}

export function isAlphaNumeric(c: number): boolean {
  return isAlpha(c) || isDigit(c);
}

export function isHexDigit(c: number): boolean {
  return (
    (c >= Chars.zero && c <= Chars.nine) ||
    (c >= Chars.lowerA && c <= Chars.lowerF) ||
    (c >= Chars.upperA && c <= Chars.upperF)
  );
}

export function isLowerAlpha(c: number): boolean {
  return c >= Chars.lowerA && c <= Chars.lowerZ;
}
