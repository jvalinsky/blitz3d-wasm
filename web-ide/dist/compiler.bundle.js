"use strict";
var Blitz3DCompiler = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // web-ide/src/compiler/all.ts
  var all_exports = {};
  __export(all_exports, {
    AST: () => ast_exports,
    CodeGenError: () => CodeGenError,
    CodeGenerator: () => CodeGenerator,
    CompilationTimeout: () => CompilationTimeout,
    CompilerError: () => CompilerError,
    ErrorCollector: () => ErrorCollector,
    Lexer: () => Lexer,
    LexerError: () => LexerError,
    ParseError: () => ParseError2,
    Parser: () => Parser,
    TimeoutChecker: () => TimeoutChecker,
    ValidationError: () => ValidationError,
    withTimeout: () => withTimeout
  });

  // web-ide/src/compiler/lexer.ts
  var KEYWORDS = {
    "if": "IF" /* IF */,
    "then": "THEN" /* THEN */,
    "else": "ELSE" /* ELSE */,
    "elseif": "ELSEIF" /* ELSEIF */,
    "endif": "ENDIF" /* ENDIF */,
    "for": "FOR" /* FOR */,
    "to": "TO" /* TO */,
    "step": "STEP" /* STEP */,
    "next": "NEXT" /* NEXT */,
    "while": "WHILE" /* WHILE */,
    "wend": "WEND" /* WEND */,
    "repeat": "REPEAT" /* REPEAT */,
    "until": "UNTIL" /* UNTIL */,
    "forever": "FOREVER" /* FOREVER */,
    "select": "SELECT" /* SELECT */,
    "case": "CASE" /* CASE */,
    "default": "DEFAULT" /* DEFAULT */,
    "end": "END" /* END */,
    "function": "FUNCTION" /* FUNCTION */,
    "return": "RETURN" /* RETURN */,
    "local": "LOCAL" /* LOCAL */,
    "global": "GLOBAL" /* GLOBAL */,
    "const": "CONST" /* CONST */,
    "dim": "DIM" /* DIM */,
    "type": "TYPE" /* TYPE */,
    "field": "FIELD" /* FIELD */,
    "new": "NEW" /* NEW */,
    "delete": "DELETE" /* DELETE */,
    "first": "FIRST" /* FIRST */,
    "last": "LAST" /* LAST */,
    "before": "BEFORE" /* BEFORE */,
    "after": "AFTER" /* AFTER */,
    "each": "EACH" /* EACH */,
    "data": "DATA" /* DATA */,
    "read": "READ" /* READ */,
    "restore": "RESTORE" /* RESTORE */,
    "include": "INCLUDE" /* INCLUDE */,
    "true": "TRUE" /* TRUE */,
    "false": "FALSE" /* FALSE */,
    "null": "NULL" /* NULL */,
    "goto": "GOTO" /* GOTO */,
    "gosub": "GOSUB" /* GOSUB */,
    "mod": "MOD" /* MOD */,
    "and": "AND" /* AND */,
    "or": "OR" /* OR */,
    "not": "NOT" /* NOT */,
    "xor": "XOR" /* XOR */,
    "shl": "SHL" /* SHL */,
    "shr": "SHR" /* SHR */,
    "sar": "SAR" /* SAR */
  };
  var Lexer = class {
    // Prevent infinite tokenization
    constructor(source) {
      __publicField(this, "source");
      __publicField(this, "pos", 0);
      __publicField(this, "line", 1);
      __publicField(this, "column", 1);
      __publicField(this, "errors", []);
      __publicField(this, "MAX_TOKENS", 1e5);
      this.source = source;
    }
    tokenize() {
      const tokens = [];
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
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.errors.push({
              message: errorMsg,
              line: this.line,
              column: this.column
            });
            while (!this.isAtEnd() && this.peek() !== "\n") {
              this.advance();
            }
            if (!this.isAtEnd()) this.advance();
          }
        }
        if (tokenCount >= this.MAX_TOKENS) {
          this.errors.push({
            message: "Maximum token count exceeded (possible infinite loop in source)",
            line: this.line,
            column: this.column
          });
        }
        tokens.push({
          type: "EOF" /* EOF */,
          value: "",
          line: this.line,
          column: this.column
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        this.errors.push({
          message: `Fatal lexer error: ${errorMsg}`,
          line: this.line,
          column: this.column
        });
      }
      return { tokens, errors: this.errors };
    }
    nextToken() {
      const start = this.pos;
      const startLine = this.line;
      const startColumn = this.column;
      const ch = this.peek();
      if (ch === ";") {
        this.skipComment();
        return null;
      }
      if (ch === "\n") {
        this.advance();
        const token = this.makeToken("NEWLINE" /* NEWLINE */, "\n", startLine, startColumn);
        this.line++;
        this.column = 1;
        return token;
      }
      if (ch === '"') {
        return this.scanString(startLine, startColumn);
      }
      if (this.isDigit(ch) || ch === "." && this.isDigit(this.peekNext())) {
        return this.scanNumber(startLine, startColumn);
      }
      if (this.isAlpha(ch)) {
        return this.scanIdentifier(startLine, startColumn);
      }
      switch (ch) {
        case "(":
          this.advance();
          return this.makeToken("LPAREN" /* LPAREN */, "(", startLine, startColumn);
        case ")":
          this.advance();
          return this.makeToken("RPAREN" /* RPAREN */, ")", startLine, startColumn);
        case ",":
          this.advance();
          return this.makeToken("COMMA" /* COMMA */, ",", startLine, startColumn);
        case ":":
          this.advance();
          return this.makeToken("COLON" /* COLON */, ":", startLine, startColumn);
        case ".":
          this.advance();
          return this.makeToken("DOT" /* DOT */, ".", startLine, startColumn);
        case "\\":
          this.advance();
          return this.makeToken("BACKSLASH" /* BACKSLASH */, "\\", startLine, startColumn);
        case "+":
          this.advance();
          return this.makeToken("PLUS" /* PLUS */, "+", startLine, startColumn);
        case "-":
          this.advance();
          return this.makeToken("MINUS" /* MINUS */, "-", startLine, startColumn);
        case "*":
          this.advance();
          return this.makeToken("MULTIPLY" /* MULTIPLY */, "*", startLine, startColumn);
        case "/":
          this.advance();
          return this.makeToken("DIVIDE" /* DIVIDE */, "/", startLine, startColumn);
        case "^":
          this.advance();
          return this.makeToken("POWER" /* POWER */, "^", startLine, startColumn);
        case "%":
          this.advance();
          return this.makeToken("PERCENT" /* PERCENT */, "%", startLine, startColumn);
        case "#":
          this.advance();
          return this.makeToken("HASH" /* HASH */, "#", startLine, startColumn);
        case "$":
          this.advance();
          return this.makeToken("DOLLAR" /* DOLLAR */, "$", startLine, startColumn);
        case "=":
          this.advance();
          return this.makeToken("EQ" /* EQ */, "=", startLine, startColumn);
        case "<":
          this.advance();
          if (this.peek() === ">") {
            this.advance();
            return this.makeToken("NE" /* NE */, "<>", startLine, startColumn);
          } else if (this.peek() === "=") {
            this.advance();
            return this.makeToken("LE" /* LE */, "<=", startLine, startColumn);
          }
          return this.makeToken("LT" /* LT */, "<", startLine, startColumn);
        case ">":
          this.advance();
          if (this.peek() === "=") {
            this.advance();
            return this.makeToken("GE" /* GE */, ">=", startLine, startColumn);
          }
          return this.makeToken("GT" /* GT */, ">", startLine, startColumn);
        default:
          this.errors.push({
            message: `Unexpected character: '${ch}'`,
            line: startLine,
            column: startColumn
          });
          this.advance();
          return null;
      }
    }
    scanString(startLine, startColumn) {
      this.advance();
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
          column: startColumn
        });
      } else {
        this.advance();
      }
      const value = this.source.substring(start, this.pos - 1);
      return this.makeToken("STRING" /* STRING */, value, startLine, startColumn);
    }
    scanNumber(startLine, startColumn) {
      const start = this.pos;
      while (this.isDigit(this.peek())) {
        this.advance();
      }
      if (this.peek() === "." && this.isDigit(this.peekNext())) {
        this.advance();
        while (this.isDigit(this.peek())) {
          this.advance();
        }
        const value2 = this.source.substring(start, this.pos);
        return this.makeToken("FLOAT" /* FLOAT */, value2, startLine, startColumn);
      }
      const value = this.source.substring(start, this.pos);
      return this.makeToken("INTEGER" /* INTEGER */, value, startLine, startColumn);
    }
    scanIdentifier(startLine, startColumn) {
      const start = this.pos;
      while (this.isAlphaNumeric(this.peek()) || this.peek() === "_") {
        this.advance();
      }
      if (this.peek() === "%" || this.peek() === "#" || this.peek() === "$") {
        this.advance();
      }
      const value = this.source.substring(start, this.pos);
      const lowerValue = value.toLowerCase();
      const baseValue = value.replace(/[%#$]$/, "").toLowerCase();
      const type = KEYWORDS[baseValue] || "IDENTIFIER" /* IDENTIFIER */;
      return this.makeToken(type, value, startLine, startColumn);
    }
    skipWhitespace() {
      while (!this.isAtEnd()) {
        const ch = this.peek();
        if (ch === " " || ch === "	" || ch === "\r") {
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
      if (this.isAtEnd()) return "\0";
      return this.source[this.pos];
    }
    peekNext() {
      if (this.pos + 1 >= this.source.length) return "\0";
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
      return ch >= "a" && ch <= "z" || ch >= "A" && ch <= "Z" || ch === "_";
    }
    isAlphaNumeric(ch) {
      return this.isAlpha(ch) || this.isDigit(ch);
    }
    makeToken(type, value, line, column) {
      return { type, value, line, column };
    }
  };

  // web-ide/src/compiler/parser.ts
  var ParseError = class extends Error {
    constructor(message, token) {
      super(`Parse error at line ${token.line}, column ${token.column}: ${message}`);
      this.token = token;
      this.name = "ParseError";
    }
  };
  var Parser = class {
    constructor(source) {
      __publicField(this, "tokens");
      __publicField(this, "current", 0);
      __publicField(this, "errors", []);
      const lexer = new Lexer(source);
      const result = lexer.tokenize();
      this.tokens = result.tokens;
      if (result.errors.length > 0) {
        console.error("Lexer errors:", result.errors);
      }
    }
    parse() {
      const statements = [];
      let iterations = 0;
      const MAX_STATEMENTS = 1e4;
      while (!this.isAtEnd() && iterations++ < MAX_STATEMENTS) {
        try {
          const stmt = this.statement();
          if (stmt) statements.push(stmt);
        } catch (e) {
          if (e instanceof ParseError) {
            this.errors.push(e.message);
            console.error(e.message);
            this.synchronize();
          } else {
            throw e;
          }
        }
      }
      if (iterations >= MAX_STATEMENTS) {
        const error = "Parser exceeded maximum statement count (possible infinite loop or extremely large program)";
        this.errors.push(error);
        console.error(error);
      }
      return { type: "Program", statements };
    }
    // Statement parsing
    statement() {
      while (this.match("NEWLINE" /* NEWLINE */)) {
      }
      if (this.isAtEnd()) return null;
      if (this.match("FUNCTION" /* FUNCTION */)) {
        return this.functionDeclaration();
      }
      if (this.match("TYPE" /* TYPE */)) {
        return this.typeDeclaration();
      }
      if (this.match("LOCAL" /* LOCAL */, "GLOBAL" /* GLOBAL */, "CONST" /* CONST */, "DIM" /* DIM */)) {
        return this.variableDeclaration();
      }
      if (this.match("IF" /* IF */)) return this.ifStatement();
      if (this.match("FOR" /* FOR */)) return this.forLoop();
      if (this.match("WHILE" /* WHILE */)) return this.whileLoop();
      if (this.match("REPEAT" /* REPEAT */)) return this.repeatLoop();
      if (this.match("SELECT" /* SELECT */)) return this.selectStatement();
      if (this.match("RETURN" /* RETURN */)) return this.returnStatement();
      if (this.match("GOTO" /* GOTO */)) {
        const label = this.consume("IDENTIFIER" /* IDENTIFIER */, "Expected label name after Goto").value;
        return { type: "GotoStatement", label };
      }
      if (this.match("GOSUB" /* GOSUB */)) {
        const label = this.consume("IDENTIFIER" /* IDENTIFIER */, "Expected label name after Gosub").value;
        return { type: "GosubStatement", label };
      }
      if (this.check("DOT" /* DOT */) && this.peekNext().type === "IDENTIFIER" /* IDENTIFIER */) {
        this.advance();
        const labelName = this.advance().value;
        return { type: "LabelStatement", name: labelName };
      }
      if (this.check("IDENTIFIER" /* IDENTIFIER */)) {
        const name = this.peek().value.toLowerCase();
        if (name === "print") {
          this.advance();
          const arg = this.expression();
          return {
            type: "ExpressionStatement",
            expression: {
              type: "FunctionCall",
              name: { type: "Identifier", name: "Print" },
              arguments: [arg]
            }
          };
        }
        if (this.peekNext().type === "EQ" /* EQ */) {
          const varName = this.advance().value;
          this.advance();
          const value = this.expression();
          return {
            type: "Assignment",
            target: { type: "Identifier", name: varName },
            value
          };
        }
      }
      if (this.check(
        "NEXT" /* NEXT */,
        "WEND" /* WEND */,
        "UNTIL" /* UNTIL */,
        "FOREVER" /* FOREVER */,
        "CASE" /* CASE */,
        "DEFAULT" /* DEFAULT */,
        "ENDIF" /* ENDIF */
      )) {
        return null;
      }
      if (this.check("END" /* END */)) {
        const next = this.peekNext();
        if (next.type === "FUNCTION" /* FUNCTION */ || next.type === "TYPE" /* TYPE */ || next.type === "IF" /* IF */ || next.type === "SELECT" /* SELECT */ || next.type === "WHILE" /* WHILE */) {
          return null;
        }
        this.advance();
        return { type: "EndStatement" };
      }
      if (this.check("ELSE" /* ELSE */, "ELSEIF" /* ELSEIF */)) {
        return null;
      }
      if (this.match("DATA" /* DATA */)) {
        return this.dataStatement();
      }
      if (this.match("READ" /* READ */)) {
        return this.readStatement();
      }
      if (this.match("RESTORE" /* RESTORE */)) {
        return this.restoreStatement();
      }
      if (this.match("INCLUDE" /* INCLUDE */)) {
        return this.includeStatement();
      }
      return this.expressionStatement();
    }
    functionDeclaration() {
      let name = this.consume("IDENTIFIER" /* IDENTIFIER */, "Expected function name").value;
      let returnType;
      const lastChar = name[name.length - 1];
      if (lastChar === "%") {
        returnType = { kind: "primitive", name: "Int" };
        name = name.slice(0, -1);
      } else if (lastChar === "#") {
        returnType = { kind: "primitive", name: "Float" };
        name = name.slice(0, -1);
      } else if (lastChar === "$") {
        returnType = { kind: "primitive", name: "String" };
        name = name.slice(0, -1);
      }
      this.consume("LPAREN" /* LPAREN */, 'Expected "(" after function name');
      const parameters = [];
      if (!this.check("RPAREN" /* RPAREN */)) {
        do {
          let paramName = this.consume("IDENTIFIER" /* IDENTIFIER */, "Expected parameter name").value;
          let paramType = { kind: "primitive", name: "Int" };
          const lastChar2 = paramName[paramName.length - 1];
          if (lastChar2 === "%") {
            paramType = { kind: "primitive", name: "Int" };
            paramName = paramName.slice(0, -1);
          } else if (lastChar2 === "#") {
            paramType = { kind: "primitive", name: "Float" };
            paramName = paramName.slice(0, -1);
          } else if (lastChar2 === "$") {
            paramType = { kind: "primitive", name: "String" };
            paramName = paramName.slice(0, -1);
          }
          let defaultValue;
          if (this.match("EQ" /* EQ */)) {
            defaultValue = this.expression();
          }
          parameters.push({ name: paramName, type: paramType, defaultValue });
        } while (this.match("COMMA" /* COMMA */));
      }
      this.consume("RPAREN" /* RPAREN */, 'Expected ")" after parameters');
      this.consumeNewlines();
      const body = [];
      while (!this.check("END" /* END */) && !this.isAtEnd()) {
        const stmt = this.statement();
        if (stmt) body.push(stmt);
      }
      this.consume("END" /* END */, 'Expected "End" after function body');
      this.consume("FUNCTION" /* FUNCTION */, 'Expected "Function" after "End"');
      return {
        type: "FunctionDeclaration",
        name,
        parameters,
        returnType,
        body
      };
    }
    typeDeclaration() {
      const name = this.consume("IDENTIFIER" /* IDENTIFIER */, "Expected type name").value;
      this.consumeNewlines();
      const fields = [];
      while (!this.check("END" /* END */) && !this.isAtEnd()) {
        if (this.match("NEWLINE" /* NEWLINE */)) continue;
        if (this.check("FIELD" /* FIELD */)) {
          this.advance();
          const fieldName = this.consume("IDENTIFIER" /* IDENTIFIER */, "Expected field name").value;
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
      this.consume("END" /* END */, 'Expected "End" after type body');
      this.consume("TYPE" /* TYPE */, 'Expected "Type" after "End"');
      return { type: "TypeDeclaration", name, fields };
    }
    variableDeclaration() {
      const scope = this.previous().type === "LOCAL" /* LOCAL */ ? "local" : this.previous().type === "GLOBAL" /* GLOBAL */ ? "global" : this.previous().type === "CONST" /* CONST */ ? "const" : "dim";
      const name = this.consume("IDENTIFIER" /* IDENTIFIER */, "Expected variable name").value;
      let varType = { kind: "primitive", name: "Int" };
      const lastChar = name[name.length - 1];
      if (["#", "$", "%"].includes(lastChar)) {
        varType = this.suffixToType(lastChar);
      }
      const dimensions = [];
      if (this.match("LPAREN" /* LPAREN */)) {
        if (!this.check("RPAREN" /* RPAREN */)) {
          do {
            dimensions.push(this.expression());
          } while (this.match("COMMA" /* COMMA */));
        }
        this.consume("RPAREN" /* RPAREN */, 'Expected ")" after array dimensions');
      }
      let initializer;
      if (this.match("EQ" /* EQ */)) {
        initializer = this.expression();
      }
      return {
        type: "VariableDeclaration",
        name,
        varType,
        scope,
        dimensions,
        initializer
      };
    }
    dataStatement() {
      const values = [];
      while (!this.check("NEWLINE" /* NEWLINE */, "EOF" /* EOF */) && !this.isAtEnd()) {
        const value = this.expression();
        if (value) values.push(value);
        this.match("COMMA" /* COMMA */);
      }
      return { type: "DataStatement", values };
    }
    readStatement() {
      const variables = [];
      while (!this.check("NEWLINE" /* NEWLINE */, "EOF" /* EOF */) && !this.isAtEnd()) {
        if (this.check("IDENTIFIER" /* IDENTIFIER */)) {
          const name = this.advance().value;
          variables.push({ type: "Identifier", name });
        }
        this.match("COMMA" /* COMMA */);
      }
      return { type: "ReadStatement", variables };
    }
    restoreStatement() {
      return { type: "RestoreStatement" };
    }
    includeStatement() {
      const filename = this.expression();
      if (filename.type !== "StringLiteral") {
        throw new ParseError("Include requires a string literal", this.previous());
      }
      return {
        type: "IncludeStatement",
        filename: filename.value
      };
    }
    ifStatement() {
      const condition = this.expression();
      this.match("THEN" /* THEN */);
      this.consumeNewlines();
      const thenBranch = [];
      while (!this.check("ELSE" /* ELSE */, "ELSEIF" /* ELSEIF */, "ENDIF" /* ENDIF */, "END" /* END */) && !this.isAtEnd()) {
        const stmt = this.statement();
        if (stmt) thenBranch.push(stmt);
      }
      const elseIfBranches = [];
      while (this.match("ELSEIF" /* ELSEIF */) || this.check("ELSE" /* ELSE */) && this.peekNext().type === "IF" /* IF */) {
        if (this.previous().type !== "ELSEIF" /* ELSEIF */) {
          this.advance();
          this.advance();
        }
        const elseIfCondition = this.expression();
        this.match("THEN" /* THEN */);
        this.consumeNewlines();
        const elseIfBody = [];
        while (!this.check("ELSE" /* ELSE */, "ELSEIF" /* ELSEIF */, "ENDIF" /* ENDIF */, "END" /* END */) && !this.isAtEnd()) {
          const stmt = this.statement();
          if (stmt) elseIfBody.push(stmt);
        }
        elseIfBranches.push({ condition: elseIfCondition, body: elseIfBody });
      }
      let elseBranch;
      if (this.match("ELSE" /* ELSE */)) {
        this.consumeNewlines();
        elseBranch = [];
        while (!this.check("ENDIF" /* ENDIF */, "END" /* END */) && !this.isAtEnd()) {
          const stmt = this.statement();
          if (stmt) elseBranch.push(stmt);
        }
      }
      if (this.match("END" /* END */)) {
        this.consume("IF" /* IF */, 'Expected "If" after "End"');
      } else {
        this.consume("ENDIF" /* ENDIF */, 'Expected "EndIf" or "End If"');
      }
      return { type: "IfStatement", condition, thenBranch, elseIfBranches, elseBranch };
    }
    forLoop() {
      const variable = this.consume("IDENTIFIER" /* IDENTIFIER */, "Expected loop variable").value;
      this.consume("EQ" /* EQ */, 'Expected "=" after loop variable');
      const start = this.expression();
      this.consume("TO" /* TO */, 'Expected "To" in for loop');
      const end = this.expression();
      let step;
      if (this.match("STEP" /* STEP */)) {
        step = this.expression();
      }
      this.consumeNewlines();
      const body = [];
      while (!this.check("NEXT" /* NEXT */) && !this.isAtEnd()) {
        const stmt = this.statement();
        if (stmt) body.push(stmt);
      }
      this.consume("NEXT" /* NEXT */, 'Expected "Next" after for loop body');
      this.match("IDENTIFIER" /* IDENTIFIER */);
      return { type: "ForLoop", variable, start, end, step, body };
    }
    whileLoop() {
      const condition = this.expression();
      this.consumeNewlines();
      const body = [];
      while (!this.check("WEND" /* WEND */) && !(this.check("END" /* END */) && this.peekNext().type === "WHILE" /* WHILE */) && !this.isAtEnd()) {
        const stmt = this.statement();
        if (stmt) body.push(stmt);
      }
      if (this.match("WEND" /* WEND */)) {
      } else if (this.match("END" /* END */)) {
        this.consume("WHILE" /* WHILE */, 'Expected "While" after "End"');
      } else {
        this.consume("WEND" /* WEND */, 'Expected "Wend" or "End While" after while loop body');
      }
      return { type: "WhileLoop", condition, body };
    }
    repeatLoop() {
      this.consumeNewlines();
      const body = [];
      while (!this.check("UNTIL" /* UNTIL */, "FOREVER" /* FOREVER */) && !this.isAtEnd()) {
        const stmt = this.statement();
        if (stmt) body.push(stmt);
      }
      let condition;
      if (this.match("UNTIL" /* UNTIL */)) {
        condition = this.expression();
      } else {
        this.consume("FOREVER" /* FOREVER */, 'Expected "Until" or "Forever" after repeat loop');
      }
      return { type: "RepeatStatement", body, condition };
    }
    selectStatement() {
      const expression = this.expression();
      this.consumeNewlines();
      const cases = [];
      let defaultCase;
      while ((this.check("CASE" /* CASE */) || this.check("DEFAULT" /* DEFAULT */)) && !this.isAtEnd()) {
        if (this.match("DEFAULT" /* DEFAULT */) || this.match("CASE" /* CASE */) && this.check("DEFAULT" /* DEFAULT */)) {
          if (this.check("DEFAULT" /* DEFAULT */)) this.advance();
          this.consumeNewlines();
          defaultCase = [];
          while (!this.check("CASE" /* CASE */, "DEFAULT" /* DEFAULT */, "END" /* END */) && !this.isAtEnd()) {
            const stmt = this.statement();
            if (stmt) defaultCase.push(stmt);
          }
        } else {
          const values = [];
          do {
            values.push(this.expression());
          } while (this.match("COMMA" /* COMMA */));
          this.consumeNewlines();
          const body = [];
          while (!this.check("CASE" /* CASE */, "DEFAULT" /* DEFAULT */, "END" /* END */) && !this.isAtEnd()) {
            const stmt = this.statement();
            if (stmt) body.push(stmt);
          }
          cases.push({ values, body });
        }
      }
      this.consume("END" /* END */, 'Expected "End" after select statement');
      this.consume("SELECT" /* SELECT */, 'Expected "Select" after "End"');
      return { type: "SelectStatement", expression, cases, defaultCase };
    }
    returnStatement() {
      let value;
      if (!this.check("NEWLINE" /* NEWLINE */) && !this.isAtEnd()) {
        value = this.expression();
      }
      return { type: "ReturnStatement", value };
    }
    expressionStatement() {
      const expr = this.expression();
      if (expr.type === "BinaryOp" && expr.operator === "=") {
        let target = expr.left;
        if (target.type === "FunctionCall" && target.name && target.name.type === "Identifier") {
          target = { type: "ArrayAccess", array: target.name, indices: target.arguments };
        }
        if (target.type === "Identifier" || target.type === "FieldAccess" || target.type === "ArrayAccess") {
          return { type: "Assignment", target, value: expr.right };
        }
      }
      return { type: "ExpressionStatement", expression: expr };
    }
    // Expression parsing (precedence climbing)
    expression() {
      return this.assignment();
    }
    assignment() {
      const expr = this.logicalOr();
      if (this.match("EQ" /* EQ */)) {
        const value = this.assignment();
        let target = expr;
        if (target.type === "FunctionCall" && target.name && target.name.type === "Identifier") {
          target = { type: "ArrayAccess", array: target.name, indices: target.arguments };
        }
        if (target.type === "Identifier" || target.type === "FieldAccess" || target.type === "ArrayAccess") {
          return { type: "Assignment", target, value };
        }
        throw new ParseError("Invalid assignment target", this.previous());
      }
      return expr;
    }
    logicalOr() {
      let expr = this.logicalXor();
      while (this.match("OR" /* OR */)) {
        const operator = this.previous().value;
        const right = this.logicalXor();
        expr = { type: "BinaryOp", left: expr, operator, right };
      }
      return expr;
    }
    logicalXor() {
      let expr = this.logicalAnd();
      while (this.match("XOR" /* XOR */)) {
        const operator = this.previous().value;
        const right = this.logicalAnd();
        expr = { type: "BinaryOp", left: expr, operator, right };
      }
      return expr;
    }
    logicalAnd() {
      let expr = this.equality();
      while (this.match("AND" /* AND */)) {
        const operator = this.previous().value;
        const right = this.equality();
        expr = { type: "BinaryOp", left: expr, operator, right };
      }
      return expr;
    }
    equality() {
      let expr = this.comparison();
      while (this.match("EQ" /* EQ */, "NE" /* NE */)) {
        const operator = this.previous().value;
        const right = this.comparison();
        expr = { type: "BinaryOp", left: expr, operator, right };
      }
      return expr;
    }
    comparison() {
      let expr = this.bitshift();
      while (this.match("LT" /* LT */, "LE" /* LE */, "GT" /* GT */, "GE" /* GE */)) {
        const operator = this.previous().value;
        const right = this.bitshift();
        expr = { type: "BinaryOp", left: expr, operator, right };
      }
      return expr;
    }
    bitshift() {
      let expr = this.additive();
      while (this.match("SHL" /* SHL */, "SHR" /* SHR */, "SAR" /* SAR */)) {
        const operator = this.previous().value;
        const right = this.additive();
        expr = { type: "BinaryOp", left: expr, operator, right };
      }
      return expr;
    }
    additive() {
      let expr = this.multiplicative();
      while (this.match("PLUS" /* PLUS */, "MINUS" /* MINUS */)) {
        const operator = this.previous().value;
        const right = this.multiplicative();
        expr = { type: "BinaryOp", left: expr, operator, right };
      }
      return expr;
    }
    multiplicative() {
      let expr = this.power();
      while (this.match("MULTIPLY" /* MULTIPLY */, "DIVIDE" /* DIVIDE */, "MOD" /* MOD */)) {
        const operator = this.previous().value;
        const right = this.power();
        expr = { type: "BinaryOp", left: expr, operator, right };
      }
      return expr;
    }
    power() {
      let expr = this.unary();
      while (this.match("POWER" /* POWER */)) {
        const operator = this.previous().value;
        const right = this.unary();
        expr = { type: "BinaryOp", left: expr, operator, right };
      }
      return expr;
    }
    unary() {
      if (this.match("NOT" /* NOT */, "MINUS" /* MINUS */)) {
        const operator = this.previous().value;
        const operand = this.unary();
        return { type: "UnaryOp", operator, operand };
      }
      return this.postfix();
    }
    postfix() {
      let expr = this.primary();
      let iterations = 0;
      const MAX_POSTFIX_ITERATIONS = 1e3;
      while (iterations++ < MAX_POSTFIX_ITERATIONS) {
        if (this.match("LPAREN" /* LPAREN */)) {
          const args = [];
          if (!this.check("RPAREN" /* RPAREN */)) {
            do {
              args.push(this.expression());
            } while (this.match("COMMA" /* COMMA */));
          }
          this.consume("RPAREN" /* RPAREN */, 'Expected ")" after arguments');
          expr = { type: "FunctionCall", name: expr, arguments: args };
        } else if (this.match("DOT" /* DOT */)) {
          const field = this.consume("IDENTIFIER" /* IDENTIFIER */, 'Expected field name after "."').value;
          expr = { type: "FieldAccess", object: expr, field };
        } else if (this.match("BACKSLASH" /* BACKSLASH */)) {
          const field = this.consume("IDENTIFIER" /* IDENTIFIER */, 'Expected field name after "\\"').value;
          expr = { type: "FieldAccess", object: expr, field };
        } else {
          break;
        }
      }
      if (iterations >= MAX_POSTFIX_ITERATIONS) {
        this.error("Parser exceeded maximum iterations in postfix expression (possible infinite loop)");
      }
      return expr;
    }
    primary() {
      if (this.match("INTEGER" /* INTEGER */)) {
        return { type: "IntegerLiteral", value: parseInt(this.previous().value) };
      }
      if (this.match("FLOAT" /* FLOAT */)) {
        return { type: "FloatLiteral", value: parseFloat(this.previous().value) };
      }
      if (this.match("STRING" /* STRING */)) {
        return { type: "StringLiteral", value: this.previous().value };
      }
      if (this.match("TRUE" /* TRUE */)) {
        return { type: "IntegerLiteral", value: 1 };
      }
      if (this.match("FALSE" /* FALSE */)) {
        return { type: "IntegerLiteral", value: 0 };
      }
      if (this.match("NULL" /* NULL */)) {
        return { type: "IntegerLiteral", value: 0 };
      }
      if (this.match("IDENTIFIER" /* IDENTIFIER */)) {
        return { type: "Identifier", name: this.previous().value };
      }
      if (this.match("LPAREN" /* LPAREN */)) {
        const expr = this.expression();
        this.consume("RPAREN" /* RPAREN */, 'Expected ")" after expression');
        return expr;
      }
      if (this.match("NEW" /* NEW */)) {
        const typeName = this.consume("IDENTIFIER" /* IDENTIFIER */, 'Expected type name after "New"').value;
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
      if (this.isAtEnd()) return false;
      return types.includes(this.peek().type);
    }
    advance() {
      if (!this.isAtEnd()) this.current++;
      return this.previous();
    }
    isAtEnd() {
      return this.peek().type === "EOF" /* EOF */;
    }
    peek() {
      return this.tokens[this.current];
    }
    peekNext() {
      return this.tokens[this.current + 1] || this.peek();
    }
    previous() {
      return this.tokens[this.current - 1];
    }
    consume(type, message) {
      if (this.check(type)) return this.advance();
      throw new ParseError(message, this.peek());
    }
    consumeNewlines() {
      while (this.match("NEWLINE" /* NEWLINE */)) {
      }
    }
    synchronize() {
      this.advance();
      while (!this.isAtEnd()) {
        if (this.previous().type === "NEWLINE" /* NEWLINE */) return;
        switch (this.peek().type) {
          case "FUNCTION" /* FUNCTION */:
          case "TYPE" /* TYPE */:
          case "LOCAL" /* LOCAL */:
          case "GLOBAL" /* GLOBAL */:
          case "IF" /* IF */:
          case "FOR" /* FOR */:
          case "WHILE" /* WHILE */:
          case "REPEAT" /* REPEAT */:
          case "SELECT" /* SELECT */:
          case "RETURN" /* RETURN */:
            return;
        }
        this.advance();
      }
    }
  };

  // web-ide/src/compiler/codegen.ts
  var BUILTIN_FUNCTIONS = {
    // String functions (all take/return i32 pointers)
    "len": { params: ["i32"], result: "i32" },
    "left": { params: ["i32", "i32"], result: "i32" },
    "right": { params: ["i32", "i32"], result: "i32" },
    "mid": { params: ["i32", "i32", "i32"], result: "i32" },
    "instr": { params: ["i32", "i32", "i32"], result: "i32" },
    "upper": { params: ["i32"], result: "i32" },
    "lower": { params: ["i32"], result: "i32" },
    "trim": { params: ["i32"], result: "i32" },
    "chr": { params: ["i32"], result: "i32" },
    "asc": { params: ["i32"], result: "i32" },
    "str": { params: ["i32"], result: "i32" },
    "string": { params: ["i32", "i32"], result: "i32" },
    "replace": { params: ["i32", "i32", "i32"], result: "i32" },
    // Math functions (i32 in/out for simplicity — JS runtime does float conversion)
    "abs": { params: ["i32"], result: "i32" },
    "sgn": { params: ["i32"], result: "i32" },
    "sin": { params: ["i32"], result: "i32" },
    "cos": { params: ["i32"], result: "i32" },
    "tan": { params: ["i32"], result: "i32" },
    "asin": { params: ["i32"], result: "i32" },
    "acos": { params: ["i32"], result: "i32" },
    "atan": { params: ["i32"], result: "i32" },
    "atan2": { params: ["i32", "i32"], result: "i32" },
    "sqr": { params: ["i32"], result: "i32" },
    "floor": { params: ["i32"], result: "i32" },
    "ceil": { params: ["i32"], result: "i32" },
    "log": { params: ["i32"], result: "i32" },
    "exp": { params: ["i32"], result: "i32" },
    // Conversion
    "int": { params: ["i32"], result: "i32" },
    "float": { params: ["i32"], result: "i32" },
    // Random
    "rand": { params: ["i32", "i32"], result: "i32" },
    "rnd": { params: ["i32", "i32"], result: "i32" },
    "seedrnd": { params: ["i32"], result: "" },
    // System
    "millisecs": { params: [], result: "i32" },
    // Power operator helper
    "pow": { params: ["i32", "i32"], result: "i32" }
  };
  var CodeGenerator = class {
    constructor() {
      __publicField(this, "output", []);
      __publicField(this, "indent", 0);
      __publicField(this, "localIndex", 0);
      __publicField(this, "locals", /* @__PURE__ */ new Map());
      __publicField(this, "globals", /* @__PURE__ */ new Map());
      __publicField(this, "functions", /* @__PURE__ */ new Map());
      __publicField(this, "nextFunctionIndex", 0);
      __publicField(this, "stringLiterals", /* @__PURE__ */ new Map());
      __publicField(this, "nextStringIndex", 0);
      __publicField(this, "dimArrays", /* @__PURE__ */ new Map());
      __publicField(this, "stringDataSize", 0);
      // Total bytes used by string data section
      __publicField(this, "errors", []);
    }
    generate(program) {
      try {
        this.validateAST(program);
        if (this.errors.length > 0) {
          throw new Error(`CodeGen validation failed:
${this.errors.join("\n")}`);
        }
        this.emit("(module");
        this.indent++;
        this.emitRuntimeImports();
        this.emit('(memory (export "memory") 1)');
        this.emitStringData(program);
        for (const stmt of program.statements) {
          if (stmt.type === "FunctionDeclaration") {
            this.registerFunction(stmt);
          }
        }
        for (const stmt of program.statements) {
          if (stmt.type === "FunctionDeclaration") {
            try {
              this.generateFunctionBody(stmt);
            } catch (error) {
              const msg = error instanceof Error ? error.message : String(error);
              throw new Error(`Error in function '${stmt.name}': ${msg}`);
            }
          }
        }
        this.generateMainFunction(program);
        this.indent--;
        this.emit(")");
        return this.output.join("\n");
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        throw new Error(`Code generation failed: ${msg}`);
      }
    }
    validateAST(program) {
      if (!program || typeof program !== "object") {
        this.errors.push("Invalid program: not an object");
        return;
      }
      if (!Array.isArray(program.statements)) {
        this.errors.push("Invalid program: statements is not an array");
        return;
      }
      const functionNames = /* @__PURE__ */ new Set();
      for (const stmt of program.statements) {
        if (stmt.type === "FunctionDeclaration") {
          const funcName = stmt.name.toLowerCase();
          if (functionNames.has(funcName)) {
            this.errors.push(`Duplicate function declaration: ${stmt.name}`);
          }
          functionNames.add(funcName);
        }
      }
    }
    emitRuntimeImports() {
      this.emit('(import "env" "print" (func $print (param i32)))');
      this.emit('(import "env" "printFloat" (func $printFloat (param f32)))');
      this.emit('(import "env" "printString" (func $printString (param i32)))');
      for (const [name, sig] of Object.entries(BUILTIN_FUNCTIONS)) {
        const params = sig.params.map((p) => `(param ${p})`).join(" ");
        const result = sig.result ? `(result ${sig.result})` : "";
        this.emit(`(import "env" "b3d_${name}" (func $b3d_${name} ${params} ${result}))`);
      }
      this.emit("");
    }
    emitStringData(program) {
      this.collectStringLiterals(program);
      if (this.stringLiterals.size > 0) {
        this.emit(";; String data section");
        let offset = 0;
        for (const [str, index] of this.stringLiterals.entries()) {
          const escaped = str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
          this.emit(`(data (i32.const ${offset}) "${escaped}\\00")`);
          offset += str.length + 1;
        }
        this.stringDataSize = offset;
        this.emit("");
      }
      const heapBase = this.stringDataSize + 3 & ~3;
      this.emit(`(global $__heap_ptr (mut i32) (i32.const ${heapBase}))`);
      this.emit("");
    }
    collectStringLiterals(node) {
      if (!node || typeof node !== "object") return;
      if (node.type === "StringLiteral" && !this.stringLiterals.has(node.value)) {
        this.stringLiterals.set(node.value, this.nextStringIndex++);
      }
      for (const key in node) {
        if (Array.isArray(node[key])) {
          node[key].forEach((item) => this.collectStringLiterals(item));
        } else if (typeof node[key] === "object") {
          this.collectStringLiterals(node[key]);
        }
      }
    }
    // Register function signature (first pass - for forward references)
    registerFunction(func) {
      const funcIndex = this.nextFunctionIndex++;
      this.functions.set(func.name.toLowerCase(), {
        // LOWERCASE for case-insensitive lookup
        index: funcIndex,
        params: func.parameters.map((p) => this.typeToWasm(p.type)),
        returns: func.returnType ? this.typeToWasm(func.returnType) : ""
      });
    }
    // Generate function body (second pass - after all signatures registered)
    generateFunctionBody(func) {
      this.locals.clear();
      this.localIndex = 0;
      const params = func.parameters.map((p, i) => {
        const wasmType = this.typeToWasm(p.type);
        this.locals.set(p.name.toLowerCase(), { index: i, type: wasmType });
        this.localIndex++;
        return `(param $${p.name} ${wasmType})`;
      }).join(" ");
      const returns = func.returnType ? `(result ${this.typeToWasm(func.returnType)})` : "";
      this.emit(`(func $${func.name.toLowerCase()} (export "${func.name}") ${params} ${returns}`);
      this.indent++;
      const localDecls = [];
      for (const stmt of func.body) {
        this.generateStatement(stmt);
      }
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
      const topLevelStmts = program.statements.filter(
        (s) => s.type !== "FunctionDeclaration" && s.type !== "TypeDeclaration"
      );
      if (topLevelStmts.length === 0) return;
      this.emit('(func $main (export "main")');
      this.indent++;
      const localDecls = [];
      const stmtOutputs = [];
      for (const stmt of topLevelStmts) {
        const beforeLocals = this.localIndex;
        const beforeOutput = this.output.length;
        this.generateStatement(stmt);
        const newOutput = this.output.slice(beforeOutput);
        const locals = [];
        const nonLocals = [];
        for (const line of newOutput) {
          if (line.trim().startsWith("(local ")) {
            locals.push(line);
          } else {
            nonLocals.push(line);
          }
        }
        this.output = this.output.slice(0, beforeOutput);
        localDecls.push(...locals);
        stmtOutputs.push(nonLocals);
      }
      for (const local of localDecls) {
        this.output.push(local);
      }
      for (const stmtOutput of stmtOutputs) {
        this.output.push(...stmtOutput);
      }
      this.indent--;
      this.emit(")");
      this.emit("");
      this.emit("(start $main)");
    }
    generateStatement(stmt) {
      switch (stmt.type) {
        case "VariableDeclaration":
          this.generateVariableDeclaration(stmt);
          break;
        case "Assignment":
          this.generateAssignmentStatement(stmt);
          break;
        case "ExpressionStatement":
          if (stmt.expression.type === "Assignment") {
            this.generateAssignmentStatement(stmt.expression);
          } else if (stmt.expression.type === "FunctionCall") {
            this.generateFunctionCall(stmt.expression);
          } else {
            this.generateExpression(stmt.expression);
            this.emit("drop");
          }
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
        case "RepeatStatement":
          this.generateRepeatLoop(stmt);
          break;
        case "SelectStatement":
          this.generateSelectStatement(stmt);
          break;
        case "ReturnStatement":
          if (stmt.value) {
            this.generateExpression(stmt.value);
          }
          this.emit("return");
          break;
        case "LabelStatement":
          this.emit(`; label: ${stmt.name}`);
          break;
        case "GotoStatement":
          this.emit(`; TODO: goto ${stmt.label}`);
          break;
        case "GosubStatement":
          this.emit(`; TODO: gosub ${stmt.label}`);
          break;
        case "EndStatement":
          this.emit("return");
          break;
        default:
          this.emit(`; TODO: ${stmt.type}`);
      }
    }
    generateVariableDeclaration(decl) {
      const wasmType = decl.varType ? this.typeToWasm(decl.varType) : "i32";
      if (decl.scope === "dim" && decl.dimensions && decl.dimensions.length > 0) {
        const rawName = decl.name;
        const baseName = rawName.replace(/[%#$]$/, "");
        this.dimArrays.set(rawName, { dimensions: [] });
        this.dimArrays.set(baseName, { dimensions: [] });
        this.dimArrays.set(baseName.toLowerCase(), { dimensions: [] });
        const localIndex = this.localIndex++;
        const localName = `__dim_${baseName}`;
        this.locals.set(localName, { index: localIndex, type: "i32" });
        this.locals.set(`__dim_${baseName.toLowerCase()}`, { index: localIndex, type: "i32" });
        this.emit(`(local $${localName} i32)`);
        this.emit("global.get $__heap_ptr");
        this.emit(`local.set $${localName}`);
        this.emit("global.get $__heap_ptr");
        this.generateExpression(decl.dimensions[0]);
        this.emit("i32.const 1");
        this.emit("i32.add");
        this.emit("i32.const 4");
        this.emit("i32.mul");
        this.emit("i32.add");
        this.emit("global.set $__heap_ptr");
        return;
      }
      if (decl.scope === "global") {
        const globalIndex = this.globals.size;
        this.globals.set(decl.name, { index: globalIndex, type: wasmType });
        const initialValue = decl.initializer ? this.expressionToString(decl.initializer) : wasmType === "i32" ? "i32.const 0" : "f32.const 0";
        this.emit(`(global $${decl.name} (mut ${wasmType}) (${initialValue}))`);
      } else {
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
      const elseIfs = stmt.elseIfBranches || [];
      if (elseIfs.length > 0 || stmt.elseBranch && stmt.elseBranch.length > 0) {
        this.emit("(else");
        this.indent++;
        if (elseIfs.length > 0) {
          this.generateElseIfChain(elseIfs, 0, stmt.elseBranch);
        } else if (stmt.elseBranch) {
          for (const s of stmt.elseBranch) {
            this.generateStatement(s);
          }
        }
        this.indent--;
        this.emit(")");
      }
      this.indent--;
      this.emit(")");
    }
    generateElseIfChain(elseIfs, index, elseBranch) {
      if (index >= elseIfs.length) {
        if (elseBranch) {
          for (const s of elseBranch) {
            this.generateStatement(s);
          }
        }
        return;
      }
      const branch = elseIfs[index];
      this.generateExpression(branch.condition);
      this.emit("(if");
      this.indent++;
      this.emit("(then");
      this.indent++;
      for (const s of branch.body) {
        this.generateStatement(s);
      }
      this.indent--;
      this.emit(")");
      if (index + 1 < elseIfs.length || elseBranch && elseBranch.length > 0) {
        this.emit("(else");
        this.indent++;
        this.generateElseIfChain(elseIfs, index + 1, elseBranch);
        this.indent--;
        this.emit(")");
      }
      this.indent--;
      this.emit(")");
    }
    generateForLoop(loop) {
      this.generateExpression(loop.start);
      const wasmType = "i32";
      const varIndex = this.localIndex++;
      this.locals.set(loop.variable, { index: varIndex, type: wasmType });
      this.emit(`(local $${loop.variable} ${wasmType})`);
      this.emit(`local.set $${loop.variable}`);
      this.generateExpression(loop.end);
      const endVarIndex = this.localIndex++;
      this.emit(`(local $__for_end_${varIndex} ${wasmType})`);
      this.emit(`local.set $__for_end_${varIndex}`);
      this.emit("(block $break");
      this.indent++;
      this.emit("(loop $continue");
      this.indent++;
      this.emit(`local.get $${loop.variable}`);
      this.emit(`local.get $__for_end_${varIndex}`);
      this.emit("i32.gt_s");
      this.emit("br_if $break");
      for (const stmt of loop.body) {
        this.generateStatement(stmt);
      }
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
      this.generateExpression(loop.condition);
      this.emit("i32.eqz");
      this.emit("br_if $break");
      for (const stmt of loop.body) {
        this.generateStatement(stmt);
      }
      this.emit("br $continue");
      this.indent--;
      this.emit(")");
      this.indent--;
      this.emit(")");
    }
    generateRepeatLoop(loop) {
      this.emit("(block $break");
      this.indent++;
      this.emit("(loop $continue");
      this.indent++;
      for (const stmt of loop.body) {
        this.generateStatement(stmt);
      }
      if (loop.condition) {
        this.generateExpression(loop.condition);
        this.emit("i32.eqz");
        this.emit("br_if $break");
      } else {
        this.emit("br $continue");
      }
      this.indent--;
      this.emit(")");
      this.indent--;
      this.emit(")");
    }
    generateSelectStatement(stmt) {
      const tempName = `$__select_${this.localIndex}`;
      const tempIndex = this.localIndex++;
      this.locals.set(tempName, { index: tempIndex, type: "i32" });
      this.emit(`(local ${tempName} i32)`);
      this.generateExpression(stmt.expression);
      this.emit(`local.set ${tempName}`);
      const cases = stmt.cases || [];
      const defaultCase = stmt.defaultCase;
      this.generateCaseChain(tempName, cases, 0, defaultCase);
    }
    generateCaseChain(tempName, cases, index, defaultCase) {
      if (index >= cases.length) {
        if (defaultCase) {
          for (const s of defaultCase) {
            this.generateStatement(s);
          }
        }
        return;
      }
      const caseClause = cases[index];
      for (let i = 0; i < caseClause.values.length; i++) {
        this.emit(`local.get ${tempName}`);
        this.generateExpression(caseClause.values[i]);
        this.emit("i32.eq");
        if (i > 0) {
          this.emit("i32.or");
        }
      }
      this.emit("(if");
      this.indent++;
      this.emit("(then");
      this.indent++;
      for (const s of caseClause.body) {
        this.generateStatement(s);
      }
      this.indent--;
      this.emit(")");
      if (index + 1 < cases.length || defaultCase && defaultCase.length > 0) {
        this.emit("(else");
        this.indent++;
        this.generateCaseChain(tempName, cases, index + 1, defaultCase);
        this.indent--;
        this.emit(")");
      }
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
          let offset = 0;
          for (const [str, idx] of this.stringLiterals.entries()) {
            if (idx === index) break;
            offset += str.length + 1;
          }
          this.emit(`i32.const ${offset}`);
          break;
        }
        case "Identifier": {
          const varName = expr.name;
          let local = this.locals.get(varName);
          if (!local) {
            local = this.locals.get(varName + "%");
          }
          if (!local) {
            local = this.locals.get(varName + "#");
          }
          if (!local) {
            local = this.locals.get(varName + "$");
          }
          if (local) {
            const actualName = Array.from(this.locals.keys()).find(
              (k) => k === varName || k.startsWith(varName) && k.length === varName.length + 1
            );
            this.emit(`local.get $${actualName}`);
          } else {
            const global = this.globals.get(varName);
            if (global) {
              this.emit(`global.get $${varName}`);
            } else {
              this.emit(`; ERROR: Unknown identifier ${varName}`);
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
        case "ArrayAccess": {
          const arrExpr = expr.array;
          if (arrExpr.type === "Identifier") {
            const arrName = arrExpr.name;
            const arrBaseName = arrName.replace(/[%#$]$/, "").toLowerCase();
            const dimKey = this.dimArrays.has(arrBaseName) ? arrBaseName : this.dimArrays.has(arrName) ? arrName : null;
            if (dimKey) {
              this.emit(`local.get $__dim_${dimKey}`);
              if (expr.indices.length > 0) {
                this.generateExpression(expr.indices[0]);
                this.emit("i32.const 4");
                this.emit("i32.mul");
                this.emit("i32.add");
              }
              this.emit("i32.load");
            } else {
              this.emit(`; ERROR: Unknown array ${arrName} (no Dim found)`);
              this.emit("i32.const 0");
            }
          } else {
            this.emit("; TODO: complex array access");
            this.emit("i32.const 0");
          }
          break;
        }
        case "FieldAccess":
          this.emit(`; TODO: FieldAccess ${expr.field}`);
          this.emit("i32.const 0");
          break;
        case "NewExpression":
          this.emit(`; TODO: New ${expr.typeName}`);
          this.emit("i32.const 0");
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
        case "Xor":
          this.emit("i32.xor");
          break;
        case "Shl":
          this.emit("i32.shl");
          break;
        case "Shr":
          this.emit("i32.shr_u");
          break;
        case "Sar":
          this.emit("i32.shr_s");
          break;
        case "^":
          this.emit("call $b3d_pow");
          break;
        default:
          this.emit(`; Unknown operator: ${op}`);
      }
    }
    generateFunctionCall(expr) {
      const nameNode = expr.name;
      if (!nameNode || nameNode.type !== "Identifier") {
        for (const arg of expr.arguments) {
          this.generateExpression(arg);
        }
        this.emit("; ERROR: non-identifier callee");
        return;
      }
      const rawName = nameNode.name;
      const lowerName = rawName.toLowerCase();
      if (lowerName === "print") {
        if (expr.arguments.length > 0) {
          this.generateExpression(expr.arguments[0]);
          const arg = expr.arguments[0];
          if (arg.type === "StringLiteral") {
            this.emit("call $printString");
          } else {
            this.emit("call $print");
          }
        }
        return;
      }
      const baseNameForDim = lowerName.replace(/[%#$]$/, "");
      if (this.dimArrays.has(baseNameForDim) || this.dimArrays.has(rawName)) {
        const dimKey = this.dimArrays.has(baseNameForDim) ? baseNameForDim : rawName;
        const localKey = `__dim_${dimKey}`;
        this.emit(`local.get $${localKey}`);
        if (expr.arguments.length > 0) {
          this.generateExpression(expr.arguments[0]);
          this.emit("i32.const 4");
          this.emit("i32.mul");
          this.emit("i32.add");
        }
        this.emit("i32.load");
        return;
      }
      const builtinKey = lowerName.replace(/[%#$]$/, "");
      if (BUILTIN_FUNCTIONS[builtinKey]) {
        for (const arg of expr.arguments) {
          this.generateExpression(arg);
        }
        this.emit(`call $b3d_${builtinKey}`);
        return;
      }
      let callName = rawName;
      const lastChar = callName[callName.length - 1];
      if (lastChar === "%" || lastChar === "#" || lastChar === "$") {
        callName = callName.slice(0, -1);
      }
      callName = callName.toLowerCase();
      for (const arg of expr.arguments) {
        this.generateExpression(arg);
      }
      this.emit(`call $${callName}`);
    }
    generateAssignmentStatement(expr) {
      if (expr.target.type === "ArrayAccess") {
        const arrayExpr = expr.target.array;
        if (arrayExpr.type === "Identifier") {
          const arrName = arrayExpr.name;
          const baseName = arrName.replace(/[%#$]$/, "").toLowerCase();
          const dimKey = this.dimArrays.has(baseName) ? baseName : this.dimArrays.has(arrName) ? arrName : null;
          if (dimKey) {
            const localKey = `__dim_${dimKey}`;
            this.emit(`local.get $${localKey}`);
            if (expr.target.indices.length > 0) {
              this.generateExpression(expr.target.indices[0]);
              this.emit("i32.const 4");
              this.emit("i32.mul");
              this.emit("i32.add");
            }
            this.generateExpression(expr.value);
            this.emit("i32.store");
            return;
          }
        }
      }
      if (expr.target.type === "Identifier") {
        const varName = expr.target.name;
        let local = this.locals.get(varName);
        if (!local && !this.globals.has(varName)) {
          const wasmType = "i32";
          const localIndex = this.localIndex++;
          this.locals.set(varName, { index: localIndex, type: wasmType });
          this.emit(`(local $${varName} ${wasmType})`);
          local = this.locals.get(varName);
        }
        this.generateExpression(expr.value);
        if (local) {
          this.emit(`local.set $${varName}`);
        } else {
          const global = this.globals.get(varName);
          if (global) {
            this.emit(`global.set $${varName}`);
          }
        }
      }
    }
    generateAssignment(expr) {
      if (expr.target.type === "Identifier") {
        const varName = expr.target.name;
        let local = this.locals.get(varName);
        if (!local && !this.globals.has(varName)) {
          const wasmType = "i32";
          const localIndex = this.localIndex++;
          this.locals.set(varName, { index: localIndex, type: wasmType });
          this.emit(`(local $${varName} ${wasmType})`);
          local = this.locals.get(varName);
        }
        this.generateExpression(expr.value);
        if (local) {
          this.emit(`local.set $${varName}`);
        } else {
          const global = this.globals.get(varName);
          if (global) {
            this.emit(`global.set $${varName}`);
          }
        }
      }
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
            return "i32";
          // Pointer to string
          default:
            return "i32";
        }
      }
      return "i32";
    }
    emit(line) {
      this.output.push("  ".repeat(this.indent) + line);
    }
  };

  // web-ide/src/compiler/ast.ts
  var ast_exports = {};
  __export(ast_exports, {
    inferTypeFromSuffix: () => inferTypeFromSuffix,
    isExpression: () => isExpression,
    isStatement: () => isStatement
  });
  function inferTypeFromSuffix(suffix) {
    if (!suffix) return void 0;
    switch (suffix) {
      case "%":
        return { name: "Int", suffix: "%" };
      case "#":
        return { name: "Float", suffix: "#" };
      case "$":
        return { name: "String", suffix: "$" };
      default:
        return void 0;
    }
  }
  function isStatement(node) {
    return [
      "VariableDeclaration",
      "FunctionDeclaration",
      "TypeDeclaration",
      "DataStatement",
      "ReadStatement",
      "RestoreStatement",
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
      "GosubStatement",
      "EndStatement",
      "IncludeStatement"
    ].includes(node.kind);
  }
  function isExpression(node) {
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
      "ObjectCastExpression"
    ].includes(node.kind);
  }

  // web-ide/src/compiler/timeout.ts
  var CompilationTimeout = class extends Error {
    constructor(message) {
      super(message);
      this.name = "CompilationTimeout";
    }
  };
  async function withTimeout(fn, timeoutMs = 5e3) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new CompilationTimeout(`Compilation exceeded ${timeoutMs}ms timeout`));
      }, timeoutMs);
      try {
        const result = fn();
        clearTimeout(timeoutId);
        resolve(result);
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }
  var TimeoutChecker = class {
    constructor(timeoutMs = 5e3) {
      __publicField(this, "startTime");
      __publicField(this, "timeoutMs");
      this.startTime = Date.now();
      this.timeoutMs = timeoutMs;
    }
    check() {
      if (Date.now() - this.startTime > this.timeoutMs) {
        throw new CompilationTimeout(`Operation exceeded ${this.timeoutMs}ms timeout`);
      }
    }
    elapsed() {
      return Date.now() - this.startTime;
    }
  };

  // web-ide/src/compiler/errors.ts
  var CompilerError = class extends Error {
    constructor(message, location, source) {
      super(message);
      this.location = location;
      this.source = source;
      this.name = "CompilerError";
    }
    toString() {
      if (!this.location) {
        return `${this.name}: ${this.message}`;
      }
      const { line, column, length } = this.location;
      let result = `${this.name} at line ${line}, column ${column}: ${this.message}`;
      if (this.source) {
        const lines = this.source.split("\n");
        if (line > 0 && line <= lines.length) {
          const sourceLine = lines[line - 1];
          result += `

${line} | ${sourceLine}`;
          result += `
${" ".repeat(String(line).length)} | ${" ".repeat(column - 1)}^`;
          if (length && length > 1) {
            result += "~".repeat(Math.min(length - 1, sourceLine.length - column));
          }
        }
      }
      return result;
    }
  };
  var LexerError = class extends CompilerError {
    constructor(message, location, source) {
      super(message, location, source);
      this.name = "LexerError";
    }
  };
  var ParseError2 = class extends CompilerError {
    constructor(message, location, source) {
      super(message, location, source);
      this.name = "ParseError";
    }
  };
  var CodeGenError = class extends CompilerError {
    constructor(message, location, source) {
      super(message, location, source);
      this.name = "CodeGenError";
    }
  };
  var ValidationError = class extends CompilerError {
    constructor(message, location, source) {
      super(message, location, source);
      this.name = "ValidationError";
    }
  };
  var ErrorCollector = class {
    constructor() {
      __publicField(this, "errors", []);
      __publicField(this, "warnings", []);
    }
    addError(error) {
      this.errors.push(error);
    }
    addWarning(warning) {
      this.warnings.push(warning);
    }
    hasErrors() {
      return this.errors.length > 0;
    }
    hasWarnings() {
      return this.warnings.length > 0;
    }
    getErrors() {
      return this.errors;
    }
    getWarnings() {
      return this.warnings;
    }
    clear() {
      this.errors = [];
      this.warnings = [];
    }
    toString() {
      let result = "";
      if (this.errors.length > 0) {
        result += `${this.errors.length} error(s):
`;
        result += this.errors.map((e) => e.toString()).join("\n\n");
      }
      if (this.warnings.length > 0) {
        if (result) result += "\n\n";
        result += `${this.warnings.length} warning(s):
`;
        result += this.warnings.map((w) => w.toString()).join("\n\n");
      }
      return result || "No errors or warnings";
    }
  };
  return __toCommonJS(all_exports);
})();
window.Blitz3DCompiler = Blitz3DCompiler;
