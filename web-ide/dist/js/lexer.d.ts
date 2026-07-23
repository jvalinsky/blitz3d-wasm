/**
 * Blitz3D Lexer - Tokenization
 *
 * Converts source code into tokens for parsing
 */
export declare enum TokenType {
  INTEGER = "INTEGER",
  FLOAT = "FLOAT",
  STRING = "STRING",
  IDENTIFIER = "IDENTIFIER",
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
  PLUS = "PLUS",
  MINUS = "MINUS",
  MULTIPLY = "MULTIPLY",
  DIVIDE = "DIVIDE",
  MOD = "MOD",
  POWER = "POWER",
  EQ = "EQ", // =
  NE = "NE", // <>
  LT = "LT", // <
  LE = "LE", // <=
  GT = "GT", // >
  GE = "GE", // >=
  AND = "AND",
  OR = "OR",
  NOT = "NOT",
  XOR = "XOR",
  SHL = "SHL",
  SHR = "SHR",
  SAR = "SAR",
  LPAREN = "LPAREN", // (
  RPAREN = "RPAREN", // )
  COMMA = "COMMA", // ,
  COLON = "COLON", // :
  DOT = "DOT", // .
  BACKSLASH = "BACKSLASH", // \
  NEWLINE = "NEWLINE",
  EOF = "EOF",
  PERCENT = "PERCENT", // % (integer)
  HASH = "HASH", // # (float)
  DOLLAR = "DOLLAR",
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
export declare class Lexer {
  private source;
  private pos;
  private line;
  private column;
  private errors;
  constructor(source: string);
  tokenize(): {
    tokens: Token[];
    errors: LexerError[];
  };
  private nextToken;
  private scanString;
  private scanNumber;
  private scanIdentifier;
  private skipWhitespace;
  private skipComment;
  private peek;
  private peekNext;
  private advance;
  private isAtEnd;
  private isDigit;
  private isAlpha;
  private isAlphaNumeric;
  private makeToken;
}
