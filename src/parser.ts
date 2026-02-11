import type {
  Module,
  Expr,
  Stmt,
  Method,
  Body,
  TypeAnnotation,
  Parameter,
} from "./ast.js";
import { Lexer } from "./lexer.js";
import { type Token, TokenType } from "./token.js";
import type { Diagnostic } from "./types.js";
import { DiagnosticSeverity } from "./types.js";

const EQUALITY_OPERATORS = [TokenType.EqualEqual, TokenType.BangEqual];

const COMPARISON_OPERATORS = [
  TokenType.Less,
  TokenType.LessEqual,
  TokenType.Greater,
  TokenType.GreaterEqual,
];

const BITWISE_SHIFT_OPERATORS = [TokenType.LessLess, TokenType.GreaterGreater];

const RANGE_OPERATORS = [TokenType.DotDot, TokenType.DotDotDot];

const TERM_OPERATORS = [TokenType.Plus, TokenType.Minus];

const FACTOR_OPERATORS = [
  TokenType.Star,
  TokenType.Slash,
  TokenType.Percent,
];

const PREFIX_OPERATORS = [TokenType.Minus, TokenType.Bang, TokenType.Tilde];

const INFIX_OPERATORS = [
  TokenType.PipePipe,
  TokenType.AmpAmp,
  TokenType.EqualEqual,
  TokenType.BangEqual,
  TokenType.Is,
  TokenType.Less,
  TokenType.LessEqual,
  TokenType.Greater,
  TokenType.GreaterEqual,
  TokenType.Pipe,
  TokenType.Caret,
  TokenType.Amp,
  TokenType.LessLess,
  TokenType.GreaterGreater,
  TokenType.DotDot,
  TokenType.DotDotDot,
  TokenType.Plus,
  TokenType.Minus,
  TokenType.Star,
  TokenType.Slash,
  TokenType.Percent,
];

export class Parser {
  private lexer: Lexer;
  private current: Token | null;
  private previous!: Token;
  private lookahead: Token[] = [];
  readonly diagnostics: Diagnostic[] = [];

  constructor(lexer: Lexer) {
    this.lexer = lexer;
    this.current = this.lexer.readToken();
  }

  parseModule(): Module {
    this.ignoreLine();

    const statements: Stmt[] = [];
    while (this.peek() !== TokenType.Eof) {
      statements.push(this.definition());
      if (this.peek() === TokenType.Eof) break;
      this.consumeLine("Expect newline.");
    }

    this.consume(TokenType.Eof, "Expect end of input.");
    return { kind: "Module", statements };
  }

  private definition(): Stmt {
    if (this.match(TokenType.Class)) {
      return this.finishClass(null);
    }

    if (this.match(TokenType.Foreign)) {
      const foreignKeyword = this.previous;
      this.consume(TokenType.Class, "Expect 'class' after 'foreign'.");
      return this.finishClass(foreignKeyword);
    }

    if (this.match(TokenType.Import)) {
      this.ignoreLine();
      const path = this.consume(TokenType.String, "Expect import path.");

      let variables: Token[] | null = null;
      if (this.match(TokenType.For)) {
        this.ignoreLine();
        variables = [];
        while (true) {
          variables.push(
            this.consume(TokenType.Name, "Expect imported variable name."),
          );
          // Handle `as Alias` renaming — the alias replaces the original
          // name in scope (Wren binds the alias, not the original)
          if (this.match(TokenType.As)) {
            const alias = this.consume(TokenType.Name, "Expect alias name after 'as'.");
            variables[variables.length - 1] = alias;
          }
          if (!this.match(TokenType.Comma)) break;
          this.ignoreLine();
        }
      }

      return { kind: "ImportStmt", path, variables };
    }

    if (this.match(TokenType.Var)) {
      const name = this.consume(TokenType.Name, "Expect variable name.");
      const typeAnnotation = this.parseTypeAnnotation();

      let initializer: Expr | null = null;
      if (this.match(TokenType.Equal)) {
        this.ignoreLine();
        initializer = this.expression();
      }

      return { kind: "VarStmt", name, typeAnnotation, initializer };
    }

    return this.statement();
  }

  private finishClass(foreignKeyword: Token | null): ClassStmt {
    const name = this.consume(TokenType.Name, "Expect class name.");

    let superclass: Token | null = null;
    if (this.match(TokenType.Is)) {
      superclass = this.consume(TokenType.Name, "Expect name of superclass.");
    }

    const methods: Method[] = [];
    this.consume(TokenType.LeftBrace, "Expect '{' after class name.");
    this.ignoreLine();

    while (!this.match(TokenType.RightBrace) && this.peek() !== TokenType.Eof) {
      methods.push(this.method());
      if (this.match(TokenType.RightBrace)) break;
      this.consumeLine("Expect newline after definition in class.");
    }

    return {
      kind: "ClassStmt",
      foreignKeyword,
      name,
      superclass,
      methods,
    };
  }

  private method(): Method {
    let foreignKeyword: Token | null = null;
    if (this.match(TokenType.Foreign)) {
      foreignKeyword = this.previous;
    }

    let staticKeyword: Token | null = null;
    if (this.match(TokenType.Static)) {
      staticKeyword = this.previous;
    }

    let constructKeyword: Token | null = null;
    if (this.match(TokenType.Construct)) {
      constructKeyword = this.previous;
    }

    let parameters: Parameter[] | null = null;
    let allowParameters = false;

    if (this.match(TokenType.LeftBracket)) {
      // Subscript operator
      parameters = this.parameterList();
      this.consume(TokenType.RightBracket, "Expect ']' after parameters.");
      allowParameters = false;
    } else if (this.matchAny(INFIX_OPERATORS)) {
      allowParameters = true;
    } else if (this.matchAny([TokenType.Bang, TokenType.Tilde])) {
      allowParameters = false;
    } else {
      this.consume(TokenType.Name, "Expect method name.");
      allowParameters = true;
    }
    const name = this.previous;

    if (this.match(TokenType.LeftParen)) {
      if (!allowParameters) {
        this.error("A parameter list is not allowed for this method.");
      }

      this.ignoreLine();
      if (!this.match(TokenType.RightParen)) {
        parameters = this.parameterList();
        this.ignoreLine();
        this.consume(TokenType.RightParen, "Expect ')' after parameters.");
      }
    }

    // Setter: `name=(value)`
    if (this.match(TokenType.Equal)) {
      this.consume(TokenType.LeftParen, "Expect '(' after '=' in setter.");
      parameters = this.parameterList();
      this.consume(TokenType.RightParen, "Expect ')' after setter parameter.");
    }

    // Return type annotation: `-> Type`
    const returnType = this.parseReturnTypeAnnotation();

    let body: Body | null = null;
    if (foreignKeyword === null) {
      this.consume(TokenType.LeftBrace, "Expect '{' before method body.");
      body = this.finishBody(parameters);
    }

    return {
      kind: "Method",
      foreignKeyword,
      staticKeyword,
      constructKeyword,
      name,
      parameters,
      returnType,
      body,
    };
  }

  private statement(): Stmt {
    if (this.match(TokenType.Break)) {
      return { kind: "BreakStmt", keyword: this.previous };
    }

    if (this.match(TokenType.Continue)) {
      return { kind: "ContinueStmt", keyword: this.previous };
    }

    if (this.match(TokenType.If)) {
      this.consume(TokenType.LeftParen, "Expect '(' after 'if'.");
      this.ignoreLine();
      const condition = this.expression();
      this.consume(TokenType.RightParen, "Expect ')' after if condition.");
      const thenBranch = this.statement();
      let elseBranch: Stmt | null = null;
      if (this.match(TokenType.Else)) {
        elseBranch = this.statement();
      }
      return { kind: "IfStmt", condition, thenBranch, elseBranch };
    }

    if (this.match(TokenType.For)) {
      this.consume(TokenType.LeftParen, "Expect '(' after 'for'.");
      const variable = this.consume(
        TokenType.Name,
        "Expect for loop variable name.",
      );
      const typeAnnotation = this.parseTypeAnnotation();
      this.consume(TokenType.In, "Expect 'in' after loop variable.");
      this.ignoreLine();
      const iterator = this.expression();
      this.consume(TokenType.RightParen, "Expect ')' after loop expression.");
      const body = this.statement();
      return { kind: "ForStmt", variable, typeAnnotation, iterator, body };
    }

    if (this.match(TokenType.While)) {
      this.consume(TokenType.LeftParen, "Expect '(' after 'while'.");
      this.ignoreLine();
      const condition = this.expression();
      this.consume(TokenType.RightParen, "Expect ')' after while condition.");
      const body = this.statement();
      return { kind: "WhileStmt", condition, body };
    }

    if (this.match(TokenType.Return)) {
      const keyword = this.previous;
      let value: Expr | null = null;
      if (this.peek() !== TokenType.Line && this.peek() !== TokenType.Eof) {
        value = this.expression();
      }
      return { kind: "ReturnStmt", keyword, value };
    }

    if (this.match(TokenType.LeftBrace)) {
      const statements: Stmt[] = [];
      this.ignoreLine();

      while (
        this.peek() !== TokenType.RightBrace &&
        this.peek() !== TokenType.Eof
      ) {
        statements.push(this.definition());
        if (this.peek() === TokenType.RightBrace) break;
        this.consumeLine("Expect newline after statement.");
      }

      this.consume(TokenType.RightBrace, "Expect '}' after block.");
      return { kind: "BlockStmt", statements };
    }

    // Expression statement
    return this.expression();
  }

  private finishBody(parameters: Parameter[] | null): Body {
    // Empty block
    if (this.match(TokenType.RightBrace)) {
      return { kind: "Body", parameters, expression: null, statements: [] };
    }

    // Single-expression body (no newline after '{')
    if (!this.matchLine()) {
      const expr = this.expression();
      this.ignoreLine();
      this.consume(TokenType.RightBrace, "Expect '}' at end of block.");
      return { kind: "Body", parameters, expression: expr, statements: null };
    }

    // Empty block with just a newline
    if (this.match(TokenType.RightBrace)) {
      return { kind: "Body", parameters, expression: null, statements: [] };
    }

    const statements: Stmt[] = [];
    while (this.peek() !== TokenType.Eof) {
      statements.push(this.definition());
      this.consumeLine("Expect newline after statement.");
      if (this.match(TokenType.RightBrace)) break;
    }

    return { kind: "Body", parameters, expression: null, statements };
  }

  // --- Type annotations ---

  private parseTypeAnnotation(): TypeAnnotation | null {
    if (!this.match(TokenType.Colon)) return null;
    const name = this.consume(TokenType.Name, "Expect type name after ':'.");
    if (name.type !== TokenType.Name) return null;
    return { name };
  }

  private parseReturnTypeAnnotation(): TypeAnnotation | null {
    if (!this.match(TokenType.Arrow)) return null;
    const name = this.consume(TokenType.Name, "Expect type name after '->'.");
    if (name.type !== TokenType.Name) return null;
    return { name };
  }

  // --- Expressions ---

  private expression(): Expr {
    return this.assignment();
  }

  private assignment(): Expr {
    const expr = this.conditional();
    if (!this.match(TokenType.Equal)) return expr;

    const equal = this.previous;
    const value = this.assignment();
    return { kind: "AssignmentExpr", target: expr, equal, value };
  }

  private conditional(): Expr {
    let expr = this.logicalOr();
    if (!this.match(TokenType.Question)) return expr;

    const question = this.previous;
    this.ignoreLine();
    const thenBranch = this.assignment();
    const colon = this.consume(
      TokenType.Colon,
      "Expect ':' after then branch of conditional operator.",
    );
    this.ignoreLine();
    const elseBranch = this.assignment();
    return {
      kind: "ConditionalExpr",
      condition: expr,
      question,
      thenBranch,
      colon,
      elseBranch,
    };
  }

  private logicalOr(): Expr {
    return this.parseInfix([TokenType.PipePipe], () => this.logicalAnd());
  }

  private logicalAnd(): Expr {
    return this.parseInfix([TokenType.AmpAmp], () => this.equality());
  }

  private equality(): Expr {
    return this.parseInfix(EQUALITY_OPERATORS, () => this.typeTest());
  }

  private typeTest(): Expr {
    return this.parseInfix([TokenType.Is], () => this.comparison());
  }

  private comparison(): Expr {
    return this.parseInfix(COMPARISON_OPERATORS, () => this.bitwiseOr());
  }

  private bitwiseOr(): Expr {
    return this.parseInfix([TokenType.Pipe], () => this.bitwiseXor());
  }

  private bitwiseXor(): Expr {
    return this.parseInfix([TokenType.Caret], () => this.bitwiseAnd());
  }

  private bitwiseAnd(): Expr {
    return this.parseInfix([TokenType.Amp], () => this.bitwiseShift());
  }

  private bitwiseShift(): Expr {
    return this.parseInfix(BITWISE_SHIFT_OPERATORS, () => this.range());
  }

  private range(): Expr {
    return this.parseInfix(RANGE_OPERATORS, () => this.term());
  }

  private term(): Expr {
    return this.parseInfix(TERM_OPERATORS, () => this.factor());
  }

  private factor(): Expr {
    return this.parseInfix(FACTOR_OPERATORS, () => this.prefix());
  }

  private prefix(): Expr {
    if (this.matchAny(PREFIX_OPERATORS)) {
      return {
        kind: "PrefixExpr",
        operator: this.previous,
        right: this.prefix(),
      };
    }
    return this.call();
  }

  private call(): Expr {
    let expr = this.primary();

    while (true) {
      if (this.match(TokenType.LeftBracket)) {
        const leftBracket = this.previous;
        const args = this.argumentList();
        this.ignoreLine();
        const rightBracket = this.consume(
          TokenType.RightBracket,
          "Expect ']' after subscript arguments.",
        );
        expr = {
          kind: "SubscriptExpr",
          receiver: expr,
          leftBracket,
          arguments: args,
          rightBracket,
        };
      } else if (this.match(TokenType.Dot)) {
        this.ignoreLine();
        const name = this.consume(TokenType.Name, "Expect method name after '.'.");
        expr = this.methodCall(expr, name);
      } else if (this.peekDotAfterNewline()) {
        // Allow newline before '.' for method chaining: `expr\n.method()`
        this.ignoreLine();
        this.advance(); // consume the dot
        this.ignoreLine();
        const name = this.consume(TokenType.Name, "Expect method name after '.'.");
        expr = this.methodCall(expr, name);
      } else {
        break;
      }
    }

    return expr;
  }

  private methodCall(receiver: Expr | null, name: Token): CallExpr {
    const [args, blockArgument] = this.finishCall();
    return {
      kind: "CallExpr",
      receiver,
      name,
      arguments: args,
      blockArgument,
    };
  }

  private finishCall(): [Expr[] | null, Body | null] {
    let args: Expr[] | null = null;
    if (this.match(TokenType.LeftParen)) {
      this.ignoreLine();
      if (this.match(TokenType.RightParen)) {
        args = [];
      } else {
        args = this.argumentList();
        this.ignoreLine();
        this.consume(TokenType.RightParen, "Expect ')' after arguments.");
      }
    }

    let blockArgument: Body | null = null;
    if (this.match(TokenType.LeftBrace)) {
      let parameters: Parameter[] | null = null;
      if (this.match(TokenType.Pipe)) {
        parameters = this.parameterList();
        this.consume(TokenType.Pipe, "Expect '|' after block parameters.");
      }
      blockArgument = this.finishBody(parameters);
    }

    return [args, blockArgument];
  }

  private argumentList(): Expr[] {
    const args: Expr[] = [];
    this.ignoreLine();
    while (true) {
      args.push(this.expression());
      if (!this.match(TokenType.Comma)) break;
      this.ignoreLine();
    }
    return args;
  }

  private parameterList(): Parameter[] {
    const parameters: Parameter[] = [];
    while (true) {
      const name = this.consume(TokenType.Name, "Expect parameter name.");
      const typeAnnotation = this.parseTypeAnnotation();
      parameters.push({ name, typeAnnotation });
      if (!this.match(TokenType.Comma)) break;
      this.ignoreLine();
    }
    return parameters;
  }

  private primary(): Expr {
    if (this.match(TokenType.LeftParen)) return this.grouping();
    if (this.match(TokenType.LeftBracket)) return this.listLiteral();
    if (this.match(TokenType.LeftBrace)) return this.mapLiteral();
    if (this.match(TokenType.Name)) return this.methodCall(null, this.previous);
    if (this.match(TokenType.Super)) return this.superCall();

    if (this.match(TokenType.False))
      return { kind: "BoolExpr", value: this.previous };
    if (this.match(TokenType.True))
      return { kind: "BoolExpr", value: this.previous };
    if (this.match(TokenType.Null))
      return { kind: "NullExpr", value: this.previous };
    if (this.match(TokenType.This))
      return { kind: "ThisExpr", keyword: this.previous };

    if (this.match(TokenType.Field))
      return { kind: "FieldExpr", name: this.previous };
    if (this.match(TokenType.StaticField))
      return { kind: "StaticFieldExpr", name: this.previous };

    if (this.match(TokenType.Number))
      return { kind: "NumExpr", value: this.previous };
    if (this.match(TokenType.String))
      return { kind: "StringExpr", value: this.previous };

    if (this.peek() === TokenType.Interpolation)
      return this.stringInterpolation();

    this.error("Expect expression.");
    return { kind: "NullExpr", value: this.previous };
  }

  private grouping(): GroupingExpr {
    const leftParen = this.previous;
    this.ignoreLine();
    const expression = this.expression();
    this.ignoreLine();
    const rightParen = this.consume(
      TokenType.RightParen,
      "Expect ')' after expression.",
    );
    return { kind: "GroupingExpr", leftParen, expression, rightParen };
  }

  private listLiteral(): ListExpr {
    const leftBracket = this.previous;
    const elements: Expr[] = [];

    this.ignoreLine();
    while (this.peek() !== TokenType.RightBracket) {
      elements.push(this.expression());
      this.ignoreLine();
      if (!this.match(TokenType.Comma)) break;
      this.ignoreLine();
    }

    const rightBracket = this.consume(
      TokenType.RightBracket,
      "Expect ']' after list elements.",
    );
    return { kind: "ListExpr", leftBracket, elements, rightBracket };
  }

  private mapLiteral(): MapExpr {
    const leftBrace = this.previous;
    const entries: { key: Expr; value: Expr }[] = [];

    this.ignoreLine();
    while (this.peek() !== TokenType.RightBrace) {
      const key = this.expression();
      this.consume(TokenType.Colon, "Expect ':' after map key.");
      this.ignoreLine();
      const value = this.expression();
      entries.push({ key, value });
      this.ignoreLine();
      if (!this.match(TokenType.Comma)) break;
      this.ignoreLine();
    }

    const rightBrace = this.consume(
      TokenType.RightBrace,
      "Expect '}' after map entries.",
    );
    return { kind: "MapExpr", leftBrace, entries, rightBrace };
  }

  private superCall(): SuperExpr {
    let name: Token | null = null;
    if (this.match(TokenType.Dot)) {
      name = this.consume(TokenType.Name, "Expect method name after 'super.'.");
    }
    const [args, blockArgument] = this.finishCall();
    return {
      kind: "SuperExpr",
      name,
      arguments: args,
      blockArgument,
    };
  }

  private stringInterpolation(): InterpolationExpr {
    const strings: Token[] = [];
    const expressions: Expr[] = [];

    while (this.match(TokenType.Interpolation)) {
      strings.push(this.previous);
      this.ignoreLine();
      expressions.push(this.expression());
      this.ignoreLine();
    }

    strings.push(
      this.consume(TokenType.String, "Expect end of string interpolation."),
    );
    return { kind: "InterpolationExpr", strings, expressions };
  }

  // --- Utility methods ---

  private parseInfix(tokenTypes: TokenType[], parseOperand: () => Expr): Expr {
    let expr = parseOperand();
    while (this.matchAny(tokenTypes)) {
      const operator = this.previous;
      this.ignoreLine();
      const right = parseOperand();
      expr = { kind: "InfixExpr", left: expr, operator, right };
    }
    return expr;
  }

  private match(type: TokenType): boolean {
    if (this.peek() !== type) return false;
    this.advance();
    return true;
  }

  private matchAny(types: TokenType[]): boolean {
    for (const type of types) {
      if (this.match(type)) return true;
    }
    return false;
  }

  private peekDotAfterNewline(): boolean {
    // Check if the next tokens are newline(s) followed by a dot.
    // This enables method chaining across lines: `expr\n.method()`
    if (this.peek() !== TokenType.Line) return false;
    // Read ahead past newlines
    const buffered: Token[] = [this.current!];
    this.current = null;
    let next = this.lexer.readToken();
    while (next.type === TokenType.Line) {
      buffered.push(next);
      next = this.lexer.readToken();
    }
    const isDot = next.type === TokenType.Dot;
    // Put everything back — store next as the token after buffered
    if (isDot) {
      // We'll consume the newlines and the dot, so don't buffer
      // Just restore current to the dot token
      this.current = next;
    } else {
      // Not a dot — push everything back into the lookahead buffer
      this.lookahead = [...buffered.slice(1), next];
      this.current = buffered[0]!;
    }
    return isDot;
  }

  private matchLine(): boolean {
    if (!this.match(TokenType.Line)) return false;
    while (this.match(TokenType.Line)) {}
    return true;
  }

  private ignoreLine(): void {
    this.matchLine();
  }

  private consumeLine(message: string): void {
    this.consume(TokenType.Line, message);
    this.ignoreLine();
  }

  private advance(): Token {
    this.peek(); // ensure current is populated
    this.previous = this.current!;
    this.current = null;
    return this.previous;
  }

  private consume(type: TokenType, message: string): Token {
    const token = this.advance();
    if (token.type !== type) this.error(message);
    return token;
  }

  private peek(): TokenType {
    if (this.current === null) {
      if (this.lookahead.length > 0) {
        this.current = this.lookahead.shift()!;
      } else {
        this.current = this.lexer.readToken();
      }
    }
    return this.current.type;
  }

  private error(message: string): void {
    const token = this.current ?? this.previous;
    this.diagnostics.push({
      message,
      severity: DiagnosticSeverity.Error,
      span: { start: token.start, length: token.length },
      source: "wren-analyzer",
      code: "parse-error",
    });
  }
}

// Re-export types used by the parser for convenience
type ClassStmt = import("./ast.js").ClassStmt;
type CallExpr = import("./ast.js").CallExpr;
type GroupingExpr = import("./ast.js").GroupingExpr;
type ListExpr = import("./ast.js").ListExpr;
type MapExpr = import("./ast.js").MapExpr;
type SuperExpr = import("./ast.js").SuperExpr;
type InterpolationExpr = import("./ast.js").InterpolationExpr;
