/**
 * Blitz3D Lexer - Tokenization
 *
 * Converts source code into tokens for parsing
 */
export var TokenType;
(function (TokenType) {
  // Literals
  TokenType["INTEGER"] = "INTEGER";
  TokenType["FLOAT"] = "FLOAT";
  TokenType["STRING"] = "STRING";
  // Identifiers and keywords
  TokenType["IDENTIFIER"] = "IDENTIFIER";
  // Keywords
  TokenType["IF"] = "IF";
  TokenType["THEN"] = "THEN";
  TokenType["ELSE"] = "ELSE";
  TokenType["ELSEIF"] = "ELSEIF";
  TokenType["ENDIF"] = "ENDIF";
  TokenType["FOR"] = "FOR";
  TokenType["TO"] = "TO";
  TokenType["STEP"] = "STEP";
  TokenType["NEXT"] = "NEXT";
  TokenType["WHILE"] = "WHILE";
  TokenType["WEND"] = "WEND";
  TokenType["REPEAT"] = "REPEAT";
  TokenType["UNTIL"] = "UNTIL";
  TokenType["FOREVER"] = "FOREVER";
  TokenType["SELECT"] = "SELECT";
  TokenType["CASE"] = "CASE";
  TokenType["DEFAULT"] = "DEFAULT";
  TokenType["END"] = "END";
  TokenType["FUNCTION"] = "FUNCTION";
  TokenType["RETURN"] = "RETURN";
  TokenType["LOCAL"] = "LOCAL";
  TokenType["GLOBAL"] = "GLOBAL";
  TokenType["CONST"] = "CONST";
  TokenType["DIM"] = "DIM";
  TokenType["TYPE"] = "TYPE";
  TokenType["FIELD"] = "FIELD";
  TokenType["NEW"] = "NEW";
  TokenType["DELETE"] = "DELETE";
  TokenType["FIRST"] = "FIRST";
  TokenType["LAST"] = "LAST";
  TokenType["BEFORE"] = "BEFORE";
  TokenType["AFTER"] = "AFTER";
  TokenType["EACH"] = "EACH";
  TokenType["DATA"] = "DATA";
  TokenType["READ"] = "READ";
  TokenType["RESTORE"] = "RESTORE";
  TokenType["INCLUDE"] = "INCLUDE";
  // Operators
  TokenType["PLUS"] = "PLUS";
  TokenType["MINUS"] = "MINUS";
  TokenType["MULTIPLY"] = "MULTIPLY";
  TokenType["DIVIDE"] = "DIVIDE";
  TokenType["MOD"] = "MOD";
  TokenType["POWER"] = "POWER";
  // Comparisons
  TokenType["EQ"] = "EQ";
  TokenType["NE"] = "NE";
  TokenType["LT"] = "LT";
  TokenType["LE"] = "LE";
  TokenType["GT"] = "GT";
  TokenType["GE"] = "GE";
  // Logical
  TokenType["AND"] = "AND";
  TokenType["OR"] = "OR";
  TokenType["NOT"] = "NOT";
  TokenType["XOR"] = "XOR";
  // Bitwise
  TokenType["SHL"] = "SHL";
  TokenType["SHR"] = "SHR";
  TokenType["SAR"] = "SAR";
  // Punctuation
  TokenType["LPAREN"] = "LPAREN";
  TokenType["RPAREN"] = "RPAREN";
  TokenType["COMMA"] = "COMMA";
  TokenType["COLON"] = "COLON";
  TokenType["DOT"] = "DOT";
  TokenType["BACKSLASH"] = "BACKSLASH";
  // Special
  TokenType["NEWLINE"] = "NEWLINE";
  TokenType["EOF"] = "EOF";
  // Type suffixes
  TokenType["PERCENT"] = "PERCENT";
  TokenType["HASH"] = "HASH";
  TokenType["DOLLAR"] = "DOLLAR";
})(TokenType || (TokenType = {}));
const KEYWORDS = {
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
  constructor(source) {
    this.pos = 0;
    this.line = 1;
    this.column = 1;
    this.errors = [];
    this.source = source;
  }
  tokenize() {
    const tokens = [];
    while (!this.isAtEnd()) {
      this.skipWhitespace();
      if (this.isAtEnd()) {
        break;
      }
      const token = this.nextToken();
      if (token) {
        tokens.push(token);
      }
    }
    tokens.push({
      type: TokenType.EOF,
      value: "",
      line: this.line,
      column: this.column,
    });
    return { tokens, errors: this.errors };
  }
  nextToken() {
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
  scanString(startLine, startColumn) {
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
  scanNumber(startLine, startColumn) {
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
  scanIdentifier(startLine, startColumn) {
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
  skipWhitespace() {
    while (!this.isAtEnd()) {
      const ch = this.peek();
      if (ch === " " || ch === "\t" || ch === "\r") {
        this.advance();
      } else {
        break;
      }
    }
  }
  skipComment() {
    while (!this.isAtEnd() && this.peek() !== "\n") {
      this.advance();
    }
  }
  peek() {
    if (this.isAtEnd()) {
      return "\0";
    }
    return this.source[this.pos];
  }
  peekNext() {
    if (this.pos + 1 >= this.source.length) {
      return "\0";
    }
    return this.source[this.pos + 1];
  }
  advance() {
    if (!this.isAtEnd()) {
      this.pos++;
      this.column++;
    }
  }
  isAtEnd() {
    return this.pos >= this.source.length;
  }
  isDigit(ch) {
    return ch >= "0" && ch <= "9";
  }
  isAlpha(ch) {
    return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_";
  }
  isAlphaNumeric(ch) {
    return this.isAlpha(ch) || this.isDigit(ch);
  }
  makeToken(type, value, line, column) {
    return { type, value, line, column };
  }
}
/**
 * Blitz3D AST (Abstract Syntax Tree)
 *
 * Represents the parsed structure of Blitz3D programs
 */
// ============================================================================
// Utilities
// ============================================================================
export function inferTypeFromSuffix(suffix) {
  if (!suffix) {
    return undefined;
  }
  switch (suffix) {
    case "%":
      return { name: "Int", suffix: "%" };
    case "#":
      return { name: "Float", suffix: "#" };
    case "$":
      return { name: "String", suffix: "$" };
    default:
      return undefined;
  }
}
export function isStatement(node) {
  return [
    "VariableDeclaration",
    "FunctionDeclaration",
    "TypeDeclaration",
    "DataStatement",
    "Assignment",
    "IfStatement",
    "ForStatement",
    "WhileStatement",
    "RepeatStatement",
    "SelectStatement",
    "ReturnStatement",
    "ExpressionStatement",
    "LabelStatement",
    "GotoStatement",
    "IncludeStatement",
  ].includes(node.kind);
}
export function isExpression(node) {
  return [
    "IntegerLiteral",
    "FloatLiteral",
    "StringLiteral",
    "Identifier",
    "BinaryExpression",
    "UnaryExpression",
    "CallExpression",
    "FieldAccess",
    "ArrayAccess",
    "NewExpression",
    "FirstExpression",
    "LastExpression",
    "BeforeExpression",
    "AfterExpression",
    "HandleExpression",
    "ObjectCastExpression",
  ].includes(node.kind);
}
/**
 * Blitz3D Parser
 *
 * Converts tokens into an Abstract Syntax Tree (AST)
 */
import { Lexer, TokenType } from "./lexer";
export class ParseError extends Error {
  constructor(message, token) {
    super(
      `Parse error at line ${token.line}, column ${token.column}: ${message}`,
    );
    this.token = token;
    this.name = "ParseError";
  }
}
export class Parser {
  constructor(source) {
    this.current = 0;
    const lexer = new Lexer(source);
    const result = lexer.tokenize();
    this.tokens = result.tokens;
    // Report lexer errors
    if (result.errors.length > 0) {
      console.error("Lexer errors:", result.errors);
    }
  }
  parse() {
    const statements = [];
    while (!this.isAtEnd()) {
      try {
        const stmt = this.statement();
        if (stmt) {
          statements.push(stmt);
        }
      } catch (e) {
        if (e instanceof ParseError) {
          console.error(e.message);
          this.synchronize();
        } else {
          throw e;
        }
      }
    }
    return { type: "Program", statements };
  }
  // Statement parsing
  statement() {
    // Skip newlines
    while (this.match(TokenType.NEWLINE)) {}
    if (this.isAtEnd()) {
      return null;
    }
    // Function declaration
    if (this.match(TokenType.FUNCTION)) {
      return this.functionDeclaration();
    }
    // Type declaration
    if (this.match(TokenType.TYPE)) {
      return this.typeDeclaration();
    }
    // Variable declaration
    if (
      this.match(
        TokenType.LOCAL,
        TokenType.GLOBAL,
        TokenType.CONST,
        TokenType.DIM,
      )
    ) {
      return this.variableDeclaration();
    }
    // Control flow
    if (this.match(TokenType.IF)) {
      return this.ifStatement();
    }
    if (this.match(TokenType.FOR)) {
      return this.forLoop();
    }
    if (this.match(TokenType.WHILE)) {
      return this.whileLoop();
    }
    if (this.match(TokenType.REPEAT)) {
      return this.repeatLoop();
    }
    if (this.match(TokenType.SELECT)) {
      return this.selectStatement();
    }
    if (this.match(TokenType.RETURN)) {
      return this.returnStatement();
    }
    // Expression statement (assignment or function call)
    return this.expressionStatement();
  }
  functionDeclaration() {
    const name =
      this.consume(TokenType.IDENTIFIER, "Expected function name").value;
    // Check for type suffix
    let returnType;
    if (
      this.peek().value.includes("#") || this.peek().value.includes("$") ||
      this.peek().value.includes("%")
    ) {
      const suffix = this.peek().value[this.peek().value.length - 1];
      returnType = this.suffixToType(suffix);
    }
    this.consume(TokenType.LPAREN, 'Expected "(" after function name');
    const parameters = [];
    if (!this.check(TokenType.RPAREN)) {
      do {
        const paramName =
          this.consume(TokenType.IDENTIFIER, "Expected parameter name").value;
        let paramType = { kind: "primitive", name: "Int" };
        // Check for type suffix in parameter name
        const lastChar = paramName[paramName.length - 1];
        if (["#", "$", "%"].includes(lastChar)) {
          paramType = this.suffixToType(lastChar);
        }
        // Default value
        let defaultValue;
        if (this.match(TokenType.EQ)) {
          defaultValue = this.expression();
        }
        parameters.push({ name: paramName, type: paramType, defaultValue });
      } while (this.match(TokenType.COMMA));
    }
    this.consume(TokenType.RPAREN, 'Expected ")" after parameters');
    this.consumeNewlines();
    const body = [];
    while (!this.check(TokenType.END) && !this.isAtEnd()) {
      const stmt = this.statement();
      if (stmt) {
        body.push(stmt);
      }
    }
    this.consume(TokenType.END, 'Expected "End" after function body');
    this.consume(TokenType.FUNCTION, 'Expected "Function" after "End"');
    return {
      type: "FunctionDeclaration",
      name,
      parameters,
      returnType,
      body,
    };
  }
  typeDeclaration() {
    const name = this.consume(TokenType.IDENTIFIER, "Expected type name").value;
    this.consumeNewlines();
    const fields = [];
    while (!this.check(TokenType.END) && !this.isAtEnd()) {
      if (this.match(TokenType.NEWLINE)) {
        continue;
      }
      if (this.check(TokenType.FIELD)) {
        this.advance();
        const fieldName =
          this.consume(TokenType.IDENTIFIER, "Expected field name").value;
        let fieldType = { kind: "primitive", name: "Int" };
        const lastChar = fieldName[fieldName.length - 1];
        if (["#", "$", "%"].includes(lastChar)) {
          fieldType = this.suffixToType(lastChar);
        }
        fields.push({ name: fieldName, type: fieldType });
        this.consumeNewlines();
      } else {
        break;
      }
    }
    this.consume(TokenType.END, 'Expected "End" after type body');
    this.consume(TokenType.TYPE, 'Expected "Type" after "End"');
    return { type: "TypeDeclaration", name, fields };
  }
  variableDeclaration() {
    const scope = this.previous().type === TokenType.LOCAL
      ? "local"
      : this.previous().type === TokenType.GLOBAL
      ? "global"
      : this.previous().type === TokenType.CONST
      ? "const"
      : "dim";
    const name =
      this.consume(TokenType.IDENTIFIER, "Expected variable name").value;
    let varType = { kind: "primitive", name: "Int" };
    const lastChar = name[name.length - 1];
    if (["#", "$", "%"].includes(lastChar)) {
      varType = this.suffixToType(lastChar);
    }
    // Array dimensions
    const dimensions = [];
    if (this.match(TokenType.LPAREN)) {
      if (!this.check(TokenType.RPAREN)) {
        do {
          dimensions.push(this.expression());
        } while (this.match(TokenType.COMMA));
      }
      this.consume(TokenType.RPAREN, 'Expected ")" after array dimensions');
    }
    // Initial value
    let initializer;
    if (this.match(TokenType.EQ)) {
      initializer = this.expression();
    }
    return {
      type: "VariableDeclaration",
      name,
      varType,
      scope,
      dimensions,
      initializer,
    };
  }
  ifStatement() {
    const condition = this.expression();
    this.match(TokenType.THEN); // Optional
    this.consumeNewlines();
    const thenBranch = [];
    while (
      !this.check(
        TokenType.ELSE,
        TokenType.ELSEIF,
        TokenType.ENDIF,
        TokenType.END,
      ) && !this.isAtEnd()
    ) {
      const stmt = this.statement();
      if (stmt) {
        thenBranch.push(stmt);
      }
    }
    const elseIfBranches = [];
    while (this.match(TokenType.ELSEIF)) {
      const elseIfCondition = this.expression();
      this.match(TokenType.THEN);
      this.consumeNewlines();
      const elseIfBody = [];
      while (
        !this.check(
          TokenType.ELSE,
          TokenType.ELSEIF,
          TokenType.ENDIF,
          TokenType.END,
        ) && !this.isAtEnd()
      ) {
        const stmt = this.statement();
        if (stmt) {
          elseIfBody.push(stmt);
        }
      }
      elseIfBranches.push({ condition: elseIfCondition, body: elseIfBody });
    }
    let elseBranch;
    if (this.match(TokenType.ELSE)) {
      this.consumeNewlines();
      elseBranch = [];
      while (!this.check(TokenType.ENDIF, TokenType.END) && !this.isAtEnd()) {
        const stmt = this.statement();
        if (stmt) {
          elseBranch.push(stmt);
        }
      }
    }
    if (this.match(TokenType.END)) {
      this.consume(TokenType.IF, 'Expected "If" after "End"');
    } else {
      this.consume(TokenType.ENDIF, 'Expected "EndIf" or "End If"');
    }
    return {
      type: "IfStatement",
      condition,
      thenBranch,
      elseIfBranches,
      elseBranch,
    };
  }
  forLoop() {
    const variable =
      this.consume(TokenType.IDENTIFIER, "Expected loop variable").value;
    this.consume(TokenType.EQ, 'Expected "=" after loop variable');
    const start = this.expression();
    this.consume(TokenType.TO, 'Expected "To" in for loop');
    const end = this.expression();
    let step;
    if (this.match(TokenType.STEP)) {
      step = this.expression();
    }
    this.consumeNewlines();
    const body = [];
    while (!this.check(TokenType.NEXT) && !this.isAtEnd()) {
      const stmt = this.statement();
      if (stmt) {
        body.push(stmt);
      }
    }
    this.consume(TokenType.NEXT, 'Expected "Next" after for loop body');
    this.match(TokenType.IDENTIFIER); // Optional variable name after Next
    return { type: "ForLoop", variable, start, end, step, body };
  }
  whileLoop() {
    const condition = this.expression();
    this.consumeNewlines();
    const body = [];
    while (!this.check(TokenType.WEND) && !this.isAtEnd()) {
      const stmt = this.statement();
      if (stmt) {
        body.push(stmt);
      }
    }
    this.consume(TokenType.WEND, 'Expected "Wend" after while loop body');
    return { type: "WhileLoop", condition, body };
  }
  repeatLoop() {
    this.consumeNewlines();
    const body = [];
    while (!this.check(TokenType.UNTIL, TokenType.FOREVER) && !this.isAtEnd()) {
      const stmt = this.statement();
      if (stmt) {
        body.push(stmt);
      }
    }
    let condition;
    if (this.match(TokenType.UNTIL)) {
      condition = this.expression();
    } else {
      this.consume(
        TokenType.FOREVER,
        'Expected "Until" or "Forever" after repeat loop',
      );
    }
    return { type: "RepeatLoop", body, condition };
  }
  selectStatement() {
    const expression = this.expression();
    this.consumeNewlines();
    const cases = [];
    let defaultCase;
    while (this.match(TokenType.CASE) && !this.isAtEnd()) {
      if (this.check(TokenType.DEFAULT)) {
        this.advance();
        this.consumeNewlines();
        defaultCase = [];
        while (!this.check(TokenType.CASE, TokenType.END) && !this.isAtEnd()) {
          const stmt = this.statement();
          if (stmt) {
            defaultCase.push(stmt);
          }
        }
      } else {
        const values = [];
        do {
          values.push(this.expression());
        } while (this.match(TokenType.COMMA));
        this.consumeNewlines();
        const body = [];
        while (!this.check(TokenType.CASE, TokenType.END) && !this.isAtEnd()) {
          const stmt = this.statement();
          if (stmt) {
            body.push(stmt);
          }
        }
        cases.push({ values, body });
      }
    }
    this.consume(TokenType.END, 'Expected "End" after select statement');
    this.consume(TokenType.SELECT, 'Expected "Select" after "End"');
    return { type: "SelectStatement", expression, cases, defaultCase };
  }
  returnStatement() {
    let value;
    if (!this.check(TokenType.NEWLINE) && !this.isAtEnd()) {
      value = this.expression();
    }
    return { type: "ReturnStatement", value };
  }
  expressionStatement() {
    const expr = this.expression();
    return { type: "ExpressionStatement", expression: expr };
  }
  // Expression parsing (precedence climbing)
  expression() {
    return this.assignment();
  }
  assignment() {
    const expr = this.logicalOr();
    if (this.match(TokenType.EQ)) {
      const value = this.assignment();
      if (
        expr.type === "Identifier" || expr.type === "FieldAccess" ||
        expr.type === "ArrayAccess"
      ) {
        return { type: "Assignment", target: expr, value };
      }
      throw new ParseError("Invalid assignment target", this.previous());
    }
    return expr;
  }
  logicalOr() {
    let expr = this.logicalAnd();
    while (this.match(TokenType.OR)) {
      const operator = this.previous().value;
      const right = this.logicalAnd();
      expr = { type: "BinaryOp", left: expr, operator, right };
    }
    return expr;
  }
  logicalAnd() {
    let expr = this.equality();
    while (this.match(TokenType.AND)) {
      const operator = this.previous().value;
      const right = this.equality();
      expr = { type: "BinaryOp", left: expr, operator, right };
    }
    return expr;
  }
  equality() {
    let expr = this.comparison();
    while (this.match(TokenType.NOT_EQUAL)) {
      const operator = this.previous().value;
      const right = this.comparison();
      expr = { type: "BinaryOp", left: expr, operator, right };
    }
    return expr;
  }
  comparison() {
    let expr = this.additive();
    while (
      this.match(
        TokenType.LESS_THAN,
        TokenType.LESS_EQUAL,
        TokenType.GREATER_THAN,
        TokenType.GREATER_EQUAL,
      )
    ) {
      const operator = this.previous().value;
      const right = this.additive();
      expr = { type: "BinaryOp", left: expr, operator, right };
    }
    return expr;
  }
  additive() {
    let expr = this.multiplicative();
    while (this.match(TokenType.PLUS, TokenType.MINUS)) {
      const operator = this.previous().value;
      const right = this.multiplicative();
      expr = { type: "BinaryOp", left: expr, operator, right };
    }
    return expr;
  }
  multiplicative() {
    let expr = this.unary();
    while (this.match(TokenType.MULTIPLY, TokenType.DIVIDE, TokenType.MOD)) {
      const operator = this.previous().value;
      const right = this.unary();
      expr = { type: "BinaryOp", left: expr, operator, right };
    }
    return expr;
  }
  unary() {
    if (this.match(TokenType.NOT, TokenType.MINUS)) {
      const operator = this.previous().value;
      const operand = this.unary();
      return { type: "UnaryOp", operator, operand };
    }
    return this.postfix();
  }
  postfix() {
    let expr = this.primary();
    while (true) {
      if (this.match(TokenType.LPAREN)) {
        // Function call
        const args = [];
        if (!this.check(TokenType.RPAREN)) {
          do {
            args.push(this.expression());
          } while (this.match(TokenType.COMMA));
        }
        this.consume(TokenType.RPAREN, 'Expected ")" after arguments');
        expr = { type: "FunctionCall", name: expr, arguments: args };
      } else if (this.match(TokenType.DOT)) {
        // Field access
        const field =
          this.consume(TokenType.IDENTIFIER, 'Expected field name after "."')
            .value;
        expr = { type: "FieldAccess", object: expr, field };
      } else if (this.match(TokenType.LBRACKET)) {
        // Array access
        const indices = [];
        do {
          indices.push(this.expression());
        } while (this.match(TokenType.COMMA));
        this.consume(TokenType.RBRACKET, 'Expected "]" after array indices');
        expr = { type: "ArrayAccess", array: expr, indices };
      } else {
        break;
      }
    }
    return expr;
  }
  primary() {
    // Literals
    if (this.match(TokenType.INTEGER)) {
      return { type: "IntegerLiteral", value: parseInt(this.previous().value) };
    }
    if (this.match(TokenType.FLOAT)) {
      return { type: "FloatLiteral", value: parseFloat(this.previous().value) };
    }
    if (this.match(TokenType.STRING)) {
      return { type: "StringLiteral", value: this.previous().value };
    }
    if (this.match(TokenType.TRUE)) {
      return { type: "IntegerLiteral", value: 1 };
    }
    if (this.match(TokenType.FALSE)) {
      return { type: "IntegerLiteral", value: 0 };
    }
    if (this.match(TokenType.NULL)) {
      return { type: "IntegerLiteral", value: 0 };
    }
    // Identifier
    if (this.match(TokenType.IDENTIFIER)) {
      return { type: "Identifier", name: this.previous().value };
    }
    // Grouped expression
    if (this.match(TokenType.LPAREN)) {
      const expr = this.expression();
      this.consume(TokenType.RPAREN, 'Expected ")" after expression');
      return expr;
    }
    // New keyword
    if (this.match(TokenType.NEW)) {
      const typeName =
        this.consume(TokenType.IDENTIFIER, 'Expected type name after "New"')
          .value;
      return { type: "NewExpression", typeName };
    }
    throw new ParseError(`Unexpected token: ${this.peek().value}`, this.peek());
  }
  // Helper methods
  suffixToType(suffix) {
    switch (suffix) {
      case "#":
        return { kind: "primitive", name: "Float" };
      case "$":
        return { kind: "primitive", name: "String" };
      case "%":
        return { kind: "primitive", name: "Int" };
      default:
        return { kind: "primitive", name: "Int" };
    }
  }
  match(...types) {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }
  check(...types) {
    if (this.isAtEnd()) {
      return false;
    }
    return types.includes(this.peek().type);
  }
  advance() {
    if (!this.isAtEnd()) {
      this.current++;
    }
    return this.previous();
  }
  isAtEnd() {
    return this.peek().type === TokenType.EOF;
  }
  peek() {
    return this.tokens[this.current];
  }
  previous() {
    return this.tokens[this.current - 1];
  }
  consume(type, message) {
    if (this.check(type)) {
      return this.advance();
    }
    throw new ParseError(message, this.peek());
  }
  consumeNewlines() {
    while (this.match(TokenType.NEWLINE)) {}
  }
  synchronize() {
    this.advance();
    while (!this.isAtEnd()) {
      if (this.previous().type === TokenType.NEWLINE) {
        return;
      }
      switch (this.peek().type) {
        case TokenType.FUNCTION:
        case TokenType.TYPE:
        case TokenType.LOCAL:
        case TokenType.GLOBAL:
        case TokenType.IF:
        case TokenType.FOR:
        case TokenType.WHILE:
        case TokenType.REPEAT:
        case TokenType.SELECT:
        case TokenType.RETURN:
          return;
      }
      this.advance();
    }
  }
}
/**
 * Blitz3D Code Generator - WASM Text Format
 *
 * Generates WebAssembly Text Format (WAT) from AST
 */
export class CodeGenerator {
  constructor() {
    this.output = [];
    this.indent = 0;
    this.localIndex = 0;
    this.locals = new Map();
    this.globals = new Map();
    this.functions = new Map();
    this.nextFunctionIndex = 0;
    this.stringLiterals = new Map();
    this.nextStringIndex = 0;
  }
  generate(program) {
    this.emit("(module");
    this.indent++;
    // Import JavaScript runtime functions
    this.emitRuntimeImports();
    // Memory
    this.emit('(memory (export "memory") 1)');
    // String data section
    this.emitStringData(program);
    // Generate functions
    for (const stmt of program.statements) {
      if (stmt.type === "FunctionDeclaration") {
        this.generateFunction(stmt);
      }
    }
    // Generate main entry point if needed
    this.generateMainFunction(program);
    this.indent--;
    this.emit(")");
    return this.output.join("\n");
  }
  emitRuntimeImports() {
    // Basic runtime functions
    this.emit('(import "env" "print" (func $print (param i32)))');
    this.emit('(import "env" "printFloat" (func $printFloat (param f32)))');
    this.emit('(import "env" "printString" (func $printString (param i32)))');
    this.emit("");
  }
  emitStringData(program) {
    // Collect all string literals
    this.collectStringLiterals(program);
    if (this.stringLiterals.size > 0) {
      this.emit("; String data section");
      let offset = 0;
      for (const [str, index] of this.stringLiterals.entries()) {
        const escaped = str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
        this.emit(`(data (i32.const ${offset}) "${escaped}\\00")`);
        offset += str.length + 1; // +1 for null terminator
      }
      this.emit("");
    }
  }
  collectStringLiterals(node) {
    if (!node || typeof node !== "object") {
      return;
    }
    if (node.type === "StringLiteral" && !this.stringLiterals.has(node.value)) {
      this.stringLiterals.set(node.value, this.nextStringIndex++);
    }
    // Recursively collect from all properties
    for (const key in node) {
      if (Array.isArray(node[key])) {
        node[key].forEach((item) => this.collectStringLiterals(item));
      } else if (typeof node[key] === "object") {
        this.collectStringLiterals(node[key]);
      }
    }
  }
  generateFunction(func) {
    this.locals.clear();
    this.localIndex = 0;
    // Register function
    const funcIndex = this.nextFunctionIndex++;
    this.functions.set(func.name, {
      index: funcIndex,
      params: func.parameters.map((p) => this.typeToWasm(p.type)),
      returns: func.returnType ? this.typeToWasm(func.returnType) : "",
    });
    // Function signature
    const params = func.parameters.map((p, i) => {
      const wasmType = this.typeToWasm(p.type);
      this.locals.set(p.name, { index: i, type: wasmType });
      this.localIndex++;
      return `(param $${p.name} ${wasmType})`;
    }).join(" ");
    const returns = func.returnType
      ? `(result ${this.typeToWasm(func.returnType)})`
      : "";
    this.emit(
      `(func $${func.name} (export "${func.name}") ${params} ${returns}`,
    );
    this.indent++;
    // Local variables (we'll add them as we encounter them)
    const localDecls = [];
    // Generate function body
    for (const stmt of func.body) {
      this.generateStatement(stmt);
    }
    // Add default return if no explicit return
    if (func.returnType) {
      const wasmType = this.typeToWasm(func.returnType);
      if (wasmType === "i32") {
        this.emit("i32.const 0");
      } else if (wasmType === "f32") {
        this.emit("f32.const 0");
      }
    }
    this.indent--;
    this.emit(")");
    this.emit("");
  }
  generateMainFunction(program) {
    // Generate main function from top-level statements
    const topLevelStmts = program.statements.filter((s) =>
      s.type !== "FunctionDeclaration" && s.type !== "TypeDeclaration"
    );
    if (topLevelStmts.length === 0) {
      return;
    }
    this.emit('(func $main (export "main")');
    this.indent++;
    for (const stmt of topLevelStmts) {
      this.generateStatement(stmt);
    }
    this.indent--;
    this.emit(")");
    this.emit("");
    // Start function
    this.emit("(start $main)");
  }
  generateStatement(stmt) {
    switch (stmt.type) {
      case "VariableDeclaration":
        this.generateVariableDeclaration(stmt);
        break;
      case "ExpressionStatement":
        this.generateExpression(stmt.expression);
        this.emit("drop"); // Discard result
        break;
      case "IfStatement":
        this.generateIfStatement(stmt);
        break;
      case "ForLoop":
        this.generateForLoop(stmt);
        break;
      case "WhileLoop":
        this.generateWhileLoop(stmt);
        break;
      case "ReturnStatement":
        if (stmt.value) {
          this.generateExpression(stmt.value);
        }
        this.emit("return");
        break;
      default:
        this.emit(`; TODO: ${stmt.type}`);
    }
  }
  generateVariableDeclaration(decl) {
    const wasmType = this.typeToWasm(decl.varType);
    if (decl.scope === "global") {
      const globalIndex = this.globals.size;
      this.globals.set(decl.name, { index: globalIndex, type: wasmType });
      // Emit global declaration
      const initialValue = decl.initializer
        ? this.expressionToString(decl.initializer)
        : (wasmType === "i32" ? "i32.const 0" : "f32.const 0");
      this.emit(`(global $${decl.name} (mut ${wasmType}) (${initialValue}))`);
    } else {
      // Local variable
      const localIndex = this.localIndex++;
      this.locals.set(decl.name, { index: localIndex, type: wasmType });
      this.emit(`(local $${decl.name} ${wasmType})`);
      if (decl.initializer) {
        this.generateExpression(decl.initializer);
        this.emit(`local.set $${decl.name}`);
      }
    }
  }
  generateIfStatement(stmt) {
    // Generate condition
    this.generateExpression(stmt.condition);
    this.emit("(if");
    this.indent++;
    this.emit("(then");
    this.indent++;
    for (const s of stmt.thenBranch) {
      this.generateStatement(s);
    }
    this.indent--;
    this.emit(")");
    if (stmt.elseBranch && stmt.elseBranch.length > 0) {
      this.emit("(else");
      this.indent++;
      for (const s of stmt.elseBranch) {
        this.generateStatement(s);
      }
      this.indent--;
      this.emit(")");
    }
    this.indent--;
    this.emit(")");
  }
  generateForLoop(loop) {
    // Initialize loop variable
    this.generateExpression(loop.start);
    const wasmType = "i32"; // For now assume int
    const varIndex = this.localIndex++;
    this.locals.set(loop.variable, { index: varIndex, type: wasmType });
    this.emit(`(local $${loop.variable} ${wasmType})`);
    this.emit(`local.set $${loop.variable}`);
    // Calculate end value (store in temp)
    this.generateExpression(loop.end);
    const endVarIndex = this.localIndex++;
    this.emit(`(local $__for_end_${varIndex} ${wasmType})`);
    this.emit(`local.set $__for_end_${varIndex}`);
    // Loop
    this.emit("(block $break");
    this.indent++;
    this.emit("(loop $continue");
    this.indent++;
    // Check condition
    this.emit(`local.get $${loop.variable}`);
    this.emit(`local.get $__for_end_${varIndex}`);
    this.emit("i32.gt_s");
    this.emit("br_if $break");
    // Loop body
    for (const stmt of loop.body) {
      this.generateStatement(stmt);
    }
    // Increment
    this.emit(`local.get $${loop.variable}`);
    if (loop.step) {
      this.generateExpression(loop.step);
    } else {
      this.emit("i32.const 1");
    }
    this.emit("i32.add");
    this.emit(`local.set $${loop.variable}`);
    this.emit("br $continue");
    this.indent--;
    this.emit(")");
    this.indent--;
    this.emit(")");
  }
  generateWhileLoop(loop) {
    this.emit("(block $break");
    this.indent++;
    this.emit("(loop $continue");
    this.indent++;
    // Check condition
    this.generateExpression(loop.condition);
    this.emit("i32.eqz");
    this.emit("br_if $break");
    // Loop body
    for (const stmt of loop.body) {
      this.generateStatement(stmt);
    }
    this.emit("br $continue");
    this.indent--;
    this.emit(")");
    this.indent--;
    this.emit(")");
  }
  generateExpression(expr) {
    switch (expr.type) {
      case "IntegerLiteral":
        this.emit(`i32.const ${expr.value}`);
        break;
      case "FloatLiteral":
        this.emit(`f32.const ${expr.value}`);
        break;
      case "StringLiteral": {
        const index = this.stringLiterals.get(expr.value) || 0;
        // Return pointer to string in memory
        let offset = 0;
        for (const [str, idx] of this.stringLiterals.entries()) {
          if (idx === index) {
            break;
          }
          offset += str.length + 1;
        }
        this.emit(`i32.const ${offset}`);
        break;
      }
      case "Identifier": {
        const local = this.locals.get(expr.name);
        if (local) {
          this.emit(`local.get $${expr.name}`);
        } else {
          const global = this.globals.get(expr.name);
          if (global) {
            this.emit(`global.get $${expr.name}`);
          } else {
            this.emit(`; ERROR: Unknown identifier ${expr.name}`);
            this.emit("i32.const 0");
          }
        }
        break;
      }
      case "BinaryOp":
        this.generateBinaryOp(expr);
        break;
      case "UnaryOp":
        this.generateExpression(expr.operand);
        if (expr.operator === "Not") {
          this.emit("i32.eqz");
        } else if (expr.operator === "-") {
          this.emit("i32.const -1");
          this.emit("i32.mul");
        }
        break;
      case "FunctionCall":
        this.generateFunctionCall(expr);
        break;
      case "Assignment":
        this.generateAssignment(expr);
        break;
      default:
        this.emit(`; TODO: Expression ${expr.type}`);
        this.emit("i32.const 0");
    }
  }
  generateBinaryOp(expr) {
    this.generateExpression(expr.left);
    this.generateExpression(expr.right);
    // Determine type (simplified - assume i32 for now)
    const op = expr.operator;
    switch (op) {
      case "+":
        this.emit("i32.add");
        break;
      case "-":
        this.emit("i32.sub");
        break;
      case "*":
        this.emit("i32.mul");
        break;
      case "/":
        this.emit("i32.div_s");
        break;
      case "Mod":
        this.emit("i32.rem_s");
        break;
      case "=":
      case "==":
        this.emit("i32.eq");
        break;
      case "<>":
      case "!=":
        this.emit("i32.ne");
        break;
      case "<":
        this.emit("i32.lt_s");
        break;
      case "<=":
        this.emit("i32.le_s");
        break;
      case ">":
        this.emit("i32.gt_s");
        break;
      case ">=":
        this.emit("i32.ge_s");
        break;
      case "And":
        this.emit("i32.and");
        break;
      case "Or":
        this.emit("i32.or");
        break;
      default:
        this.emit(`; Unknown operator: ${op}`);
    }
  }
  generateFunctionCall(expr) {
    // Special built-in functions
    if (expr.name.type === "Identifier") {
      const funcName = expr.name.name.toLowerCase();
      if (funcName === "print") {
        if (expr.arguments.length > 0) {
          this.generateExpression(expr.arguments[0]);
          // Determine type and call appropriate print function
          this.emit("call $print");
        }
        return;
      }
    }
    // Regular function call
    for (const arg of expr.arguments) {
      this.generateExpression(arg);
    }
    if (expr.name.type === "Identifier") {
      const funcName = expr.name.name;
      this.emit(`call $${funcName}`);
    }
  }
  generateAssignment(expr) {
    // Generate value
    this.generateExpression(expr.value);
    // Set target
    if (expr.target.type === "Identifier") {
      const varName = expr.target.name;
      const local = this.locals.get(varName);
      if (local) {
        this.emit(`local.set $${varName}`);
      } else {
        const global = this.globals.get(varName);
        if (global) {
          this.emit(`global.set $${varName}`);
        }
      }
    }
    // Assignment also returns the value
    if (expr.target.type === "Identifier") {
      const varName = expr.target.name;
      const local = this.locals.get(varName);
      if (local) {
        this.emit(`local.get $${varName}`);
      } else {
        const global = this.globals.get(varName);
        if (global) {
          this.emit(`global.get $${varName}`);
        }
      }
    }
  }
  expressionToString(expr) {
    if (expr.type === "IntegerLiteral") {
      return `i32.const ${expr.value}`;
    } else if (expr.type === "FloatLiteral") {
      return `f32.const ${expr.value}`;
    }
    return "i32.const 0";
  }
  typeToWasm(type) {
    if (type.kind === "primitive") {
      switch (type.name) {
        case "Int":
          return "i32";
        case "Float":
          return "f32";
        case "String":
          return "i32"; // Pointer to string
        default:
          return "i32";
      }
    }
    return "i32";
  }
  emit(line) {
    this.output.push("  ".repeat(this.indent) + line);
  }
}
window.Blitz3DCompiler = { Lexer, Parser, CodeGenerator };
