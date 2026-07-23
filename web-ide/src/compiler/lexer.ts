/**
 * Blitz3D Lexer - Tokenization
 *
 * Converts source code into tokens for parsing
 */

export enum TokenType {
  // Literals
  INTEGER = "INTEGER",
  FLOAT = "FLOAT",
  STRING = "STRING",

  // Identifiers and keywords
  IDENTIFIER = "IDENTIFIER",

  // Keywords
  IF = "IF",
  THEN = "THEN",
  ELSE = "ELSE",
  ELSEIF = "ELSEIF",
  ENDIF = "ENDIF",
  FOR = "FOR",
  TO = "TO",
  STEP = "STEP",
  NEXT = "NEXT",
  WHILE = "WHILE",
  WEND = "WEND",
  REPEAT = "REPEAT",
  UNTIL = "UNTIL",
  FOREVER = "FOREVER",
  SELECT = "SELECT",
  CASE = "CASE",
  DEFAULT = "DEFAULT",
  END = "END",
  FUNCTION = "FUNCTION",
  RETURN = "RETURN",
  LOCAL = "LOCAL",
  GLOBAL = "GLOBAL",
  CONST = "CONST",
  DIM = "DIM",
  TYPE = "TYPE",
  FIELD = "FIELD",
  NEW = "NEW",
  DELETE = "DELETE",
  FIRST = "FIRST",
  LAST = "LAST",
  BEFORE = "BEFORE",
  AFTER = "AFTER",
  EACH = "EACH",
  DATA = "DATA",
  READ = "READ",
  RESTORE = "RESTORE",
  INCLUDE = "INCLUDE",
  TRUE = "TRUE",
  FALSE = "FALSE",
  NULL = "NULL",
  GOTO = "GOTO",
  GOSUB = "GOSUB",

  // Operators
  PLUS = "PLUS",
  MINUS = "MINUS",
  MULTIPLY = "MULTIPLY",
  DIVIDE = "DIVIDE",
  MOD = "MOD",
  POWER = "POWER",

  // Comparisons
  EQ = "EQ", // =
  NE = "NE", // <>
  LT = "LT", // <
  LE = "LE", // <=
  GT = "GT", // >
  GE = "GE", // >=

  // Logical
  AND = "AND",
  OR = "OR",
  NOT = "NOT",
  XOR = "XOR",

  // Bitwise
  SHL = "SHL",
  SHR = "SHR",
  SAR = "SAR",

  // Punctuation
  LPAREN = "LPAREN", // (
  RPAREN = "RPAREN", // )
  COMMA = "COMMA", // ,
  COLON = "COLON", // :
  DOT = "DOT", // .
  BACKSLASH = "BACKSLASH", // \

  // Special
  NEWLINE = "NEWLINE",
  EOF = "EOF",

  // Type suffixes
  PERCENT = "PERCENT", // % (integer)
  HASH = "HASH", // # (float)
  DOLLAR = "DOLLAR", // $ (string)
}

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

export interface LexerError {
  message: string;
  line: number;
  column: number;
}

const KEYWORDS: Record<string, TokenType> = {
  "if": TokenType.IF,
  "then": TokenType.THEN,
  "else": TokenType.ELSE,
  "elseif": TokenType.ELSEIF,
  "endif": TokenType.ENDIF,
  "for": TokenType.FOR,
  "to": TokenType.TO,
  "step": TokenType.STEP,
  "next": TokenType.NEXT,
  "while": TokenType.WHILE,
  "wend": TokenType.WEND,
  "repeat": TokenType.REPEAT,
  "until": TokenType.UNTIL,
  "forever": TokenType.FOREVER,
  "select": TokenType.SELECT,
  "case": TokenType.CASE,
  "default": TokenType.DEFAULT,
  "end": TokenType.END,
  "function": TokenType.FUNCTION,
  "return": TokenType.RETURN,
  "local": TokenType.LOCAL,
  "global": TokenType.GLOBAL,
  "const": TokenType.CONST,
  "dim": TokenType.DIM,
  "type": TokenType.TYPE,
  "field": TokenType.FIELD,
  "new": TokenType.NEW,
  "delete": TokenType.DELETE,
  "first": TokenType.FIRST,
  "last": TokenType.LAST,
  "before": TokenType.BEFORE,
  "after": TokenType.AFTER,
  "each": TokenType.EACH,
  "data": TokenType.DATA,
  "read": TokenType.READ,
  "restore": TokenType.RESTORE,
  "include": TokenType.INCLUDE,
  "true": TokenType.TRUE,
  "false": TokenType.FALSE,
  "null": TokenType.NULL,
  "goto": TokenType.GOTO,
  "gosub": TokenType.GOSUB,
  "mod": TokenType.MOD,
  "and": TokenType.AND,
  "or": TokenType.OR,
  "not": TokenType.NOT,
  "xor": TokenType.XOR,
  "shl": TokenType.SHL,
  "shr": TokenType.SHR,
  "sar": TokenType.SAR,
};

export class Lexer {
  private source: string;
  private pos = 0;
  private line = 1;
  private column = 1;
  private errors: LexerError[] = [];
  private readonly MAX_TOKENS = 100000; // Prevent infinite tokenization

  constructor(source: string) {
    this.source = source;
  }

  tokenize(): { tokens: Token[]; errors: LexerError[] } {
    const tokens: Token[] = [];

    try {
      let tokenCount = 0;

      while (!this.isAtEnd() && tokenCount < this.MAX_TOKENS) {
        this.skipWhitespace();

        if (this.isAtEnd()) break;

        try {
          const token = this.nextToken();
          if (token) {
            tokens.push(token);
            tokenCount++;
          }
        } catch (error) {
          // Record error but continue tokenizing
          const errorMsg = error instanceof Error
            ? error.message
            : String(error);
          this.errors.push({
            message: errorMsg,
            line: this.line,
            column: this.column,
          });

          // Skip to next line to recover
          while (!this.isAtEnd() && this.peek() !== "\n") {
            this.advance();
          }
          if (!this.isAtEnd()) this.advance(); // Skip newline
        }
      }

      if (tokenCount >= this.MAX_TOKENS) {
        this.errors.push({
          message:
            "Maximum token count exceeded (possible infinite loop in source)",
          line: this.line,
          column: this.column,
        });
      }

      tokens.push({
        type: TokenType.EOF,
        value: "",
        line: this.line,
        column: this.column,
      });
    } catch (error) {
      // Catastrophic error - record and return what we have
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.errors.push({
        message: `Fatal lexer error: ${errorMsg}`,
        line: this.line,
        column: this.column,
      });
    }

    return { tokens, errors: this.errors };
  }

  private nextToken(): Token | null {
    const start = this.pos;
    const startLine = this.line;
    const startColumn = this.column;

    const ch = this.peek();

    // Comments
    if (ch === ";") {
      this.skipComment();
      return null;
    }

    // Newlines
    if (ch === "\n") {
      this.advance();
      const token = this.makeToken(
        TokenType.NEWLINE,
        "\n",
        startLine,
        startColumn,
      );
      this.line++;
      this.column = 1;
      return token;
    }

    // Strings
    if (ch === '"') {
      return this.scanString(startLine, startColumn);
    }

    // Numbers
    if (this.isDigit(ch) || (ch === "." && this.isDigit(this.peekNext()))) {
      return this.scanNumber(startLine, startColumn);
    }

    // Identifiers and keywords
    if (this.isAlpha(ch)) {
      return this.scanIdentifier(startLine, startColumn);
    }

    // Operators and punctuation
    switch (ch) {
      case "(":
        this.advance();
        return this.makeToken(TokenType.LPAREN, "(", startLine, startColumn);
      case ")":
        this.advance();
        return this.makeToken(TokenType.RPAREN, ")", startLine, startColumn);
      case ",":
        this.advance();
        return this.makeToken(TokenType.COMMA, ",", startLine, startColumn);
      case ":":
        this.advance();
        return this.makeToken(TokenType.COLON, ":", startLine, startColumn);
      case ".":
        this.advance();
        return this.makeToken(TokenType.DOT, ".", startLine, startColumn);
      case "\\":
        this.advance();
        return this.makeToken(
          TokenType.BACKSLASH,
          "\\",
          startLine,
          startColumn,
        );
      case "+":
        this.advance();
        return this.makeToken(TokenType.PLUS, "+", startLine, startColumn);
      case "-":
        this.advance();
        return this.makeToken(TokenType.MINUS, "-", startLine, startColumn);
      case "*":
        this.advance();
        return this.makeToken(TokenType.MULTIPLY, "*", startLine, startColumn);
      case "/":
        this.advance();
        return this.makeToken(TokenType.DIVIDE, "/", startLine, startColumn);
      case "^":
        this.advance();
        return this.makeToken(TokenType.POWER, "^", startLine, startColumn);
      case "%":
        this.advance();
        return this.makeToken(TokenType.PERCENT, "%", startLine, startColumn);
      case "#":
        this.advance();
        return this.makeToken(TokenType.HASH, "#", startLine, startColumn);
      case "$":
        this.advance();
        return this.makeToken(TokenType.DOLLAR, "$", startLine, startColumn);

      case "=":
        this.advance();
        return this.makeToken(TokenType.EQ, "=", startLine, startColumn);

      case "<":
        this.advance();
        if (this.peek() === ">") {
          this.advance();
          return this.makeToken(TokenType.NE, "<>", startLine, startColumn);
        } else if (this.peek() === "=") {
          this.advance();
          return this.makeToken(TokenType.LE, "<=", startLine, startColumn);
        }
        return this.makeToken(TokenType.LT, "<", startLine, startColumn);

      case ">":
        this.advance();
        if (this.peek() === "=") {
          this.advance();
          return this.makeToken(TokenType.GE, ">=", startLine, startColumn);
        }
        return this.makeToken(TokenType.GT, ">", startLine, startColumn);

      default:
        this.errors.push({
          message: `Unexpected character: '${ch}'`,
          line: startLine,
          column: startColumn,
        });
        this.advance();
        return null;
    }
  }

  private scanString(startLine: number, startColumn: number): Token {
    this.advance(); // Skip opening quote
    const start = this.pos;

    while (!this.isAtEnd() && this.peek() !== '"') {
      if (this.peek() === "\n") {
        this.line++;
        this.column = 0;
      }
      this.advance();
    }

    if (this.isAtEnd()) {
      this.errors.push({
        message: "Unterminated string",
        line: startLine,
        column: startColumn,
      });
    } else {
      this.advance(); // Skip closing quote
    }

    const value = this.source.substring(start, this.pos - 1);
    return this.makeToken(TokenType.STRING, value, startLine, startColumn);
  }

  private scanNumber(startLine: number, startColumn: number): Token {
    const start = this.pos;

    while (this.isDigit(this.peek())) {
      this.advance();
    }

    // Float?
    if (this.peek() === "." && this.isDigit(this.peekNext())) {
      this.advance(); // Skip '.'

      while (this.isDigit(this.peek())) {
        this.advance();
      }

      const value = this.source.substring(start, this.pos);
      return this.makeToken(TokenType.FLOAT, value, startLine, startColumn);
    }

    const value = this.source.substring(start, this.pos);
    return this.makeToken(TokenType.INTEGER, value, startLine, startColumn);
  }

  private scanIdentifier(startLine: number, startColumn: number): Token {
    const start = this.pos;

    while (this.isAlphaNumeric(this.peek()) || this.peek() === "_") {
      this.advance();
    }

    // Include type suffix if present (%, #, $)
    if (this.peek() === "%" || this.peek() === "#" || this.peek() === "$") {
      this.advance();
    }

    const value = this.source.substring(start, this.pos);
    const lowerValue = value.toLowerCase();

    // Check for keyword (without type suffix)
    const baseValue = value.replace(/[%#$]$/, "").toLowerCase();
    const type = KEYWORDS[baseValue] || TokenType.IDENTIFIER;

    return this.makeToken(type, value, startLine, startColumn);
  }

  private skipWhitespace(): void {
    while (!this.isAtEnd()) {
      const ch = this.peek();
      if (ch === " " || ch === "\t" || ch === "\r") {
        this.advance();
      } else {
        break;
      }
    }
  }

  private skipComment(): void {
    while (!this.isAtEnd() && this.peek() !== "\n") {
      this.advance();
    }
  }

  private peek(): string {
    if (this.isAtEnd()) return "\0";
    return this.source[this.pos];
  }

  private peekNext(): string {
    if (this.pos + 1 >= this.source.length) return "\0";
    return this.source[this.pos + 1];
  }

  private advance(): void {
    if (!this.isAtEnd()) {
      this.pos++;
      this.column++;
    }
  }

  private isAtEnd(): boolean {
    return this.pos >= this.source.length;
  }

  private isDigit(ch: string): boolean {
    return ch >= "0" && ch <= "9";
  }

  private isAlpha(ch: string): boolean {
    return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_";
  }

  private isAlphaNumeric(ch: string): boolean {
    return this.isAlpha(ch) || this.isDigit(ch);
  }

  private makeToken(
    type: TokenType,
    value: string,
    line: number,
    column: number,
  ): Token {
    return { type, value, line, column };
  }
}
