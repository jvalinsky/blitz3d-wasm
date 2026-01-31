// Blitz3D Compiler Bundle - Generated from TypeScript

// ===== src/compiler/lexer.ts =====
/**
 * Blitz3D Lexer - Tokenization
 * 
 * Converts source code into tokens for parsing
 */

const TokenType {
  // Literals
  INTEGER = 'INTEGER',
  FLOAT = 'FLOAT',
  STRING = 'STRING',
  
  // Identifiers and keywords
  IDENTIFIER = 'IDENTIFIER',
  
  // Keywords
  IF = 'IF',
  THEN = 'THEN',
  ELSE = 'ELSE',
  ELSEIF = 'ELSEIF',
  ENDIF = 'ENDIF',
  FOR = 'FOR',
  TO = 'TO',
  STEP = 'STEP',
  NEXT = 'NEXT',
  WHILE = 'WHILE',
  WEND = 'WEND',
  REPEAT = 'REPEAT',
  UNTIL = 'UNTIL',
  FOREVER = 'FOREVER',
  SELECT = 'SELECT',
  CASE = 'CASE',
  DEFAULT = 'DEFAULT',
  END = 'END',
  FUNCTION = 'FUNCTION',
  RETURN = 'RETURN',
  LOCAL = 'LOCAL',
  GLOBAL = 'GLOBAL',
  CONST = 'CONST',
  DIM = 'DIM',
  TYPE = 'TYPE',
  FIELD = 'FIELD',
  NEW = 'NEW',
  DELETE = 'DELETE',
  FIRST = 'FIRST',
  LAST = 'LAST',
  BEFORE = 'BEFORE',
  AFTER = 'AFTER',
  EACH = 'EACH',
  DATA = 'DATA',
  READ = 'READ',
  RESTORE = 'RESTORE',
  INCLUDE = 'INCLUDE',
  
  // Operators
  PLUS = 'PLUS',
  MINUS = 'MINUS',
  MULTIPLY = 'MULTIPLY',
  DIVIDE = 'DIVIDE',
  MOD = 'MOD',
  POWER = 'POWER',
  
  // Comparisons
  EQ = 'EQ',         // =
  NE = 'NE',         // <>
  LT = 'LT',         // <
  LE = 'LE',         // <=
  GT = 'GT',         // >
  GE = 'GE',         // >=
  
  // Logical
  AND = 'AND',
  OR = 'OR',
  NOT = 'NOT',
  XOR = 'XOR',
  
  // Bitwise
  SHL = 'SHL',
  SHR = 'SHR',
  SAR = 'SAR',
  
  // Punctuation
  LPAREN = 'LPAREN',       // (
  RPAREN = 'RPAREN',       // )
  COMMA = 'COMMA',         // ,
  COLON = 'COLON',         // :
  DOT = 'DOT',             // .
  BACKSLASH = 'BACKSLASH', // \
  
  // Special
  NEWLINE = 'NEWLINE',
  EOF = 'EOF',
  
  // Type suffixes
  PERCENT = 'PERCENT',   // % (integer)
  HASH = 'HASH',         // # (float)
  DOLLAR = 'DOLLAR',     // $ (string)
}

interface Token {
  type
  value
  line
  column
}

interface LexerError {
  message
  line
  column
}

const KEYWORDS, TokenType> = {
  'if',
  'then',
  'else',
  'elseif',
  'endif',
  'for',
  'to',
  'step',
  'next',
  'while',
  'wend',
  'repeat',
  'until',
  'forever',
  'select',
  'case',
  'default',
  'end',
  'function',
  'return',
  'local',
  'global',
  'const',
  'dim',
  'type',
  'field',
  'new',
  'delete',
  'first',
  'last',
  'before',
  'after',
  'each',
  'data',
  'read',
  'restore',
  'include',
  'mod',
  'and',
  'or',
  'not',
  'xor',
  'shl',
  'shr',
  'sar',
};

class Lexer {
  source
  pos = 0;
  line = 1;
  column = 1;
  errors= [];
  
  constructor(source) {
    this.source = source;
  }
  
  tokenize()
    const tokens= [];
    
    while (!this.isAtEnd()) {
      this.skipWhitespace();
      
      if (this.isAtEnd()) break;
      
      const token = this.nextToken();
      if (token) {
        tokens.push(token);
      }
    }
    
    tokens.push({
      type,
      value,
      line,
      column,
    });
    
    return { tokens, errors
  }
  
  nextToken()
    const start = this.pos;
    const startLine = this.line;
    const startColumn = this.column;
    
    const ch = this.peek();
    
    // Comments
    if (ch === ';') {
      this.skipComment();
      return null;
    }
    
    // Newlines
    if (ch === '\n') {
      this.advance();
      const token = this.makeToken(TokenType.NEWLINE, '\n', startLine, startColumn);
      this.line++;
      this.column = 1;
      return token;
    }
    
    // Strings
    if (ch === '"') {
      return this.scanString(startLine, startColumn);
    }
    
    // Numbers
    if (this.isDigit(ch) || (ch === '.' && this.isDigit(this.peekNext()))) {
      return this.scanNumber(startLine, startColumn);
    }
    
    // Identifiers and keywords
    if (this.isAlpha(ch)) {
      return this.scanIdentifier(startLine, startColumn);
    }
    
    // Operators and punctuation
    switch (ch) {
      case '('); return this.makeToken(TokenType.LPAREN, '(', startLine, startColumn);
      case ')'); return this.makeToken(TokenType.RPAREN, ')', startLine, startColumn);
      case ','); return this.makeToken(TokenType.COMMA, ',', startLine, startColumn);
      case ':'); return this.makeToken(TokenType.COLON, ':', startLine, startColumn);
      case '.'); return this.makeToken(TokenType.DOT, '.', startLine, startColumn);
      case '\\'); return this.makeToken(TokenType.BACKSLASH, '\\', startLine, startColumn);
      case '+'); return this.makeToken(TokenType.PLUS, '+', startLine, startColumn);
      case '-'); return this.makeToken(TokenType.MINUS, '-', startLine, startColumn);
      case '*'); return this.makeToken(TokenType.MULTIPLY, '*', startLine, startColumn);
      case '/'); return this.makeToken(TokenType.DIVIDE, '/', startLine, startColumn);
      case '^'); return this.makeToken(TokenType.POWER, '^', startLine, startColumn);
      case '%'); return this.makeToken(TokenType.PERCENT, '%', startLine, startColumn);
      case '#'); return this.makeToken(TokenType.HASH, '#', startLine, startColumn);
      case '$'); return this.makeToken(TokenType.DOLLAR, '$', startLine, startColumn);
      
      case '=':
        this.advance();
        return this.makeToken(TokenType.EQ, '=', startLine, startColumn);
      
      case '<':
        this.advance();
        if (this.peek() === '>') {
          this.advance();
          return this.makeToken(TokenType.NE, '<>', startLine, startColumn);
        } else if (this.peek() === '=') {
          this.advance();
          return this.makeToken(TokenType.LE, '<=', startLine, startColumn);
        }
        return this.makeToken(TokenType.LT, '<', startLine, startColumn);
      
      case '>':
        this.advance();
        if (this.peek() === '=') {
          this.advance();
          return this.makeToken(TokenType.GE, '>=', startLine, startColumn);
        }
        return this.makeToken(TokenType.GT, '>', startLine, startColumn);
      
      default:
        this.errors.push({
          message,
          line,
          column,
        });
        this.advance();
        return null;
    }
  }
  
  scanString(startLine, startColumn)
    this.advance(); // Skip opening quote
    const start = this.pos;
    
    while (!this.isAtEnd() && this.peek() !== '"') {
      if (this.peek() === '\n') {
        this.line++;
        this.column = 0;
      }
      this.advance();
    }
    
    if (this.isAtEnd()) {
      this.errors.push({
        message,
        line,
        column,
      });
    } else {
      this.advance(); // Skip closing quote
    }
    
    const value = this.source.substring(start, this.pos - 1);
    return this.makeToken(TokenType.STRING, value, startLine, startColumn);
  }
  
  scanNumber(startLine, startColumn)
    const start = this.pos;
    
    while (this.isDigit(this.peek())) {
      this.advance();
    }
    
    // Float?
    if (this.peek() === '.' && this.isDigit(this.peekNext())) {
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
  
  scanIdentifier(startLine, startColumn)
    const start = this.pos;
    
    while (this.isAlphaNumeric(this.peek()) || this.peek() === '_') {
      this.advance();
    }
    
    // Include type suffix if present (%, #, $)
    if (this.peek() === '%' || this.peek() === '#' || this.peek() === '$') {
      this.advance();
    }
    
    const value = this.source.substring(start, this.pos);
    const lowerValue = value.toLowerCase();
    
    // Check for keyword (without type suffix)
    const baseValue = value.replace(/[%#$]$/, '').toLowerCase();
    const type = KEYWORDS[baseValue] || TokenType.IDENTIFIER;
    
    return this.makeToken(type, value, startLine, startColumn);
  }
  
  skipWhitespace()
    while (!this.isAtEnd()) {
      const ch = this.peek();
      if (ch === ' ' || ch === '\t' || ch === '\r') {
        this.advance();
      } else {
        break;
      }
    }
  }
  
  skipComment()
    while (!this.isAtEnd() && this.peek() !== '\n') {
      this.advance();
    }
  }
  
  peek()
    if (this.isAtEnd()) return '\0';
    return this.source[this.pos];
  }
  
  peekNext()
    if (this.pos + 1 >= this.source.length) return '\0';
    return this.source[this.pos + 1];
  }
  
  advance()
    if (!this.isAtEnd()) {
      this.pos++;
      this.column++;
    }
  }
  
  isAtEnd()
    return this.pos >= this.source.length;
  }
  
  isDigit(ch)
    return ch >= '0' && ch <= '9';
  }
  
  isAlpha(ch)
    return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_';
  }
  
  isAlphaNumeric(ch)
    return this.isAlpha(ch) || this.isDigit(ch);
  }
  
  makeToken(type, value, line, column)
    return { type, value, line, column };
  }
}


// ===== src/compiler/ast.ts =====
/**
 * Blitz3D AST (Abstract Syntax Tree)
 * 
 * Represents the parsed structure of Blitz3D programs
 */

interface SourceLocation {
  line
  column
}

interface Node {
  kind
  loc?
}

// ============================================================================
// Program
// ============================================================================

interface Program extends Node {
  kind
  statements
}

// ============================================================================
// Statements
// ============================================================================

type Statement =
  | VariableDeclaration
  | FunctionDeclaration
  | TypeDeclaration
  | DataStatement
  | Assignment
  | IfStatement
  | ForStatement
  | WhileStatement
  | RepeatStatement
  | SelectStatement
  | ReturnStatement
  | ExpressionStatement
  | LabelStatement
  | GotoStatement
  | IncludeStatement;

interface VariableDeclaration extends Node {
  kind
  scope
  name
  type?
  initializer?
  dimensions?, 20)
}

interface FunctionDeclaration extends Node {
  kind
  name
  parameters
  returnType?
  body
}

interface Parameter {
  name
  type?
  defaultValue?
}

interface TypeDeclaration extends Node {
  kind
  name
  fields
}

interface Field {
  name
  type?
  dimensions?
}

interface DataStatement extends Node {
  kind
  values
  label?
}

interface Assignment extends Node {
  kind
  target, field access, or array element
  value
}

interface IfStatement extends Node {
  kind
  condition
  thenBranch
  elseIfBranches?
  elseBranch?
}

interface ElseIfBranch {
  condition
  body
}

interface ForStatement extends Node {
  kind
  variable
  start
  end
  step?
  body
}

interface WhileStatement extends Node {
  kind
  condition
  body
}

interface RepeatStatement extends Node {
  kind
  body
  condition?)
}

interface SelectStatement extends Node {
  kind
  value
  cases
  defaultCase?
}

interface CaseClause {
  values
  body
}

interface ReturnStatement extends Node {
  kind
  value?
}

interface ExpressionStatement extends Node {
  kind
  expression
}

interface LabelStatement extends Node {
  kind
  name
}

interface GotoStatement extends Node {
  kind
  label
}

interface IncludeStatement extends Node {
  kind
  filename
}

// ============================================================================
// Expressions
// ============================================================================

type Expression =
  | IntegerLiteral
  | FloatLiteral
  | StringLiteral
  | Identifier
  | BinaryExpression
  | UnaryExpression
  | CallExpression
  | FieldAccess
  | ArrayAccess
  | NewExpression
  | FirstExpression
  | LastExpression
  | BeforeExpression
  | AfterExpression
  | HandleExpression
  | ObjectCastExpression;

interface IntegerLiteral extends Node {
  kind
  value
}

interface FloatLiteral extends Node {
  kind
  value
}

interface StringLiteral extends Node {
  kind
  value
}

interface Identifier extends Node {
  kind
  name
  type?, y#, s$
}

interface BinaryExpression extends Node {
  kind
  operator
  left
  right
}

type BinaryOperator =
  | '+' | '-' | '*' | '/' | 'Mod' | '^'
  | '=' | '<>' | '<' | '<=' | '>' | '>='
  | 'And' | 'Or' | 'Xor'
  | 'Shl' | 'Shr' | 'Sar';

interface UnaryExpression extends Node {
  kind
  operator
  operand
}

type UnaryOperator = '+' | '-' | 'Not';

interface CallExpression extends Node {
  kind
  callee
  arguments
}

interface FieldAccess extends Node {
  kind
  object
  field
}

interface ArrayAccess extends Node {
  kind
  array
  indices
}

interface NewExpression extends Node {
  kind
  typeName
}

interface FirstExpression extends Node {
  kind
  typeName
}

interface LastExpression extends Node {
  kind
  typeName
}

interface BeforeExpression extends Node {
  kind
  object
}

interface AfterExpression extends Node {
  kind
  object
}

interface HandleExpression extends Node {
  kind
  object
}

interface ObjectCastExpression extends Node {
  kind
  typeName
  object
}

// ============================================================================
// Type Annotations
// ============================================================================

interface TypeAnnotation {
  name, 'Float', 'String', or custom type name
  suffix?
}

// ============================================================================
// Utilities
// ============================================================================

function inferTypeFromSuffix(suffix?)
  if (!suffix) return undefined;
  
  switch (suffix) {
    case '%', suffix
    case '#', suffix
    case '$', suffix
    default
  }
}

function isStatement(node)
  return [
    'VariableDeclaration',
    'FunctionDeclaration',
    'TypeDeclaration',
    'DataStatement',
    'Assignment',
    'IfStatement',
    'ForStatement',
    'WhileStatement',
    'RepeatStatement',
    'SelectStatement',
    'ReturnStatement',
    'ExpressionStatement',
    'LabelStatement',
    'GotoStatement',
    'IncludeStatement',
  ].includes(node.kind);
}

function isExpression(node)
  return [
    'IntegerLiteral',
    'FloatLiteral',
    'StringLiteral',
    'Identifier',
    'BinaryExpression',
    'UnaryExpression',
    'CallExpression',
    'FieldAccess',
    'ArrayAccess',
    'NewExpression',
    'FirstExpression',
    'LastExpression',
    'BeforeExpression',
    'AfterExpression',
    'HandleExpression',
    'ObjectCastExpression',
  ].includes(node.kind);
}


// ===== src/compiler/parser.ts =====
/**
 * Blitz3D Parser
 * 
 * Converts tokens into an Abstract Syntax Tree (AST)
 */


class ParseError extends Error {
  constructor(message, token) {
    super(`Parse error at line ${token.line}, column ${token.column});
    this.name = 'ParseError';
  }
}

class Parser {
  tokens
  current = 0;

  constructor(source) {
    const lexer = new Lexer(source);
    const result = lexer.tokenize();
    this.tokens = result.tokens;
    
    // Report lexer errors
    if (result.errors.length > 0) {
      console.error('Lexer errors:', result.errors);
    }
  }

  parse()
    const statements= [];
    
    while (!this.isAtEnd()) {
      try {
        const stmt = this.statement();
        if (stmt) statements.push(stmt);
      } catch (e) {
        if (e instanceof ParseError) {
          console.error(e.message);
          this.synchronize();
        } else {
          throw e;
        }
      }
    }

    return { type, statements };
  }

  // Statement parsing
  statement()
    // Skip newlines
    while (this.match(TokenType.NEWLINE)) {}
    
    if (this.isAtEnd()) return null;

    // Function declaration
    if (this.match(TokenType.FUNCTION)) {
      return this.functionDeclaration();
    }

    // Type declaration
    if (this.match(TokenType.TYPE)) {
      return this.typeDeclaration();
    }

    // Variable declaration
    if (this.match(TokenType.LOCAL, TokenType.GLOBAL, TokenType.CONST, TokenType.DIM)) {
      return this.variableDeclaration();
    }

    // Control flow
    if (this.match(TokenType.IF)) return this.ifStatement();
    if (this.match(TokenType.FOR)) return this.forLoop();
    if (this.match(TokenType.WHILE)) return this.whileLoop();
    if (this.match(TokenType.REPEAT)) return this.repeatLoop();
    if (this.match(TokenType.SELECT)) return this.selectStatement();
    if (this.match(TokenType.RETURN)) return this.returnStatement();

    // Expression statement (assignment or function call)
    return this.expressionStatement();
  }

  functionDeclaration()
    const name = this.consume(TokenType.IDENTIFIER, 'Expected function name').value;
    
    // Check for type suffix
    let returnType
    if (this.peek().value.includes('#') || this.peek().value.includes('$') || this.peek().value.includes('%')) {
      const suffix = this.peek().value[this.peek().value.length - 1];
      returnType = this.suffixToType(suffix);
    }

    this.consume(TokenType.LPAREN, 'Expected "(" after function name');
    
    const parameters= [];
    if (!this.check(TokenType.RPAREN)) {
      do {
        const paramName = this.consume(TokenType.IDENTIFIER, 'Expected parameter name').value;
        let paramType= { kind, name
        
        // Check for type suffix in parameter name
        const lastChar = paramName[paramName.length - 1];
        if (['#', '$', '%'].includes(lastChar)) {
          paramType = this.suffixToType(lastChar);
        }

        // Default value
        let defaultValue
        if (this.match(TokenType.EQ)) {
          defaultValue = this.expression();
        }

        parameters.push({ name, type, defaultValue });
      } while (this.match(TokenType.COMMA));
    }
    
    this.consume(TokenType.RPAREN, 'Expected ")" after parameters');
    this.consumeNewlines();

    const body= [];
    while (!this.check(TokenType.END) && !this.isAtEnd()) {
      const stmt = this.statement();
      if (stmt) body.push(stmt);
    }

    this.consume(TokenType.END, 'Expected "End" after function body');
    this.consume(TokenType.FUNCTION, 'Expected "Function" after "End"');

    return {
      type,
      name,
      parameters,
      returnType,
      body
    };
  }

  typeDeclaration()
    const name = this.consume(TokenType.IDENTIFIER, 'Expected type name').value;
    this.consumeNewlines();

    const fields= [];
    while (!this.check(TokenType.END) && !this.isAtEnd()) {
      if (this.match(TokenType.NEWLINE)) continue;
      
      if (this.check(TokenType.FIELD)) {
        this.advance();
        const fieldName = this.consume(TokenType.IDENTIFIER, 'Expected field name').value;
        
        let fieldType= { kind, name
        const lastChar = fieldName[fieldName.length - 1];
        if (['#', '$', '%'].includes(lastChar)) {
          fieldType = this.suffixToType(lastChar);
        }

        fields.push({ name, type);
        this.consumeNewlines();
      } else {
        break;
      }
    }

    this.consume(TokenType.END, 'Expected "End" after type body');
    this.consume(TokenType.TYPE, 'Expected "Type" after "End"');

    return { type, name, fields };
  }

  variableDeclaration()
    const scope = this.previous().type === TokenType.LOCAL ? 'local' :
                  this.previous().type === TokenType.GLOBAL ? 'global' :
                  this.previous().type === TokenType.CONST ? 'const' 

    const name = this.consume(TokenType.IDENTIFIER, 'Expected variable name').value;
    
    let varType= { kind, name
    const lastChar = name[name.length - 1];
    if (['#', '$', '%'].includes(lastChar)) {
      varType = this.suffixToType(lastChar);
    }

    // Array dimensions
    const dimensions= [];
    if (this.match(TokenType.LPAREN)) {
      if (!this.check(TokenType.RPAREN)) {
        do {
          dimensions.push(this.expression());
        } while (this.match(TokenType.COMMA));
      }
      this.consume(TokenType.RPAREN, 'Expected ")" after array dimensions');
    }

    // Initial value
    let initializer
    if (this.match(TokenType.EQ)) {
      initializer = this.expression();
    }

    return {
      type,
      name,
      varType,
      scope,
      dimensions,
      initializer
    };
  }

  ifStatement()
    const condition = this.expression();
    this.match(TokenType.THEN); // Optional
    this.consumeNewlines();

    const thenBranch= [];
    while (!this.check(TokenType.ELSE, TokenType.ELSEIF, TokenType.ENDIF, TokenType.END) && !this.isAtEnd()) {
      const stmt = this.statement();
      if (stmt) thenBranch.push(stmt);
    }

    const elseIfBranches= [];
    while (this.match(TokenType.ELSEIF)) {
      const elseIfCondition = this.expression();
      this.match(TokenType.THEN);
      this.consumeNewlines();

      const elseIfBody= [];
      while (!this.check(TokenType.ELSE, TokenType.ELSEIF, TokenType.ENDIF, TokenType.END) && !this.isAtEnd()) {
        const stmt = this.statement();
        if (stmt) elseIfBody.push(stmt);
      }
      elseIfBranches.push({ condition, body);
    }

    let elseBranch
    if (this.match(TokenType.ELSE)) {
      this.consumeNewlines();
      elseBranch = [];
      while (!this.check(TokenType.ENDIF, TokenType.END) && !this.isAtEnd()) {
        const stmt = this.statement();
        if (stmt) elseBranch.push(stmt);
      }
    }

    if (this.match(TokenType.END)) {
      this.consume(TokenType.IF, 'Expected "If" after "End"');
    } else {
      this.consume(TokenType.ENDIF, 'Expected "EndIf" or "End If"');
    }

    return { type, condition, thenBranch, elseIfBranches, elseBranch };
  }

  forLoop()
    const variable = this.consume(TokenType.IDENTIFIER, 'Expected loop variable').value;
    this.consume(TokenType.EQ, 'Expected "=" after loop variable');
    const start = this.expression();
    this.consume(TokenType.TO, 'Expected "To" in for loop');
    const end = this.expression();
    
    let step
    if (this.match(TokenType.STEP)) {
      step = this.expression();
    }

    this.consumeNewlines();

    const body= [];
    while (!this.check(TokenType.NEXT) && !this.isAtEnd()) {
      const stmt = this.statement();
      if (stmt) body.push(stmt);
    }

    this.consume(TokenType.NEXT, 'Expected "Next" after for loop body');
    this.match(TokenType.IDENTIFIER); // Optional variable name after Next

    return { type, variable, start, end, step, body };
  }

  whileLoop()
    const condition = this.expression();
    this.consumeNewlines();

    const body= [];
    while (!this.check(TokenType.WEND) && !this.isAtEnd()) {
      const stmt = this.statement();
      if (stmt) body.push(stmt);
    }

    this.consume(TokenType.WEND, 'Expected "Wend" after while loop body');

    return { type, condition, body };
  }

  repeatLoop()
    this.consumeNewlines();

    const body= [];
    while (!this.check(TokenType.UNTIL, TokenType.FOREVER) && !this.isAtEnd()) {
      const stmt = this.statement();
      if (stmt) body.push(stmt);
    }

    let condition
    if (this.match(TokenType.UNTIL)) {
      condition = this.expression();
    } else {
      this.consume(TokenType.FOREVER, 'Expected "Until" or "Forever" after repeat loop');
    }

    return { type, body, condition };
  }

  selectStatement()
    const expression = this.expression();
    this.consumeNewlines();

    const cases= [];
    let defaultCase

    while (this.match(TokenType.CASE) && !this.isAtEnd()) {
      if (this.check(TokenType.DEFAULT)) {
        this.advance();
        this.consumeNewlines();
        defaultCase = [];
        while (!this.check(TokenType.CASE, TokenType.END) && !this.isAtEnd()) {
          const stmt = this.statement();
          if (stmt) defaultCase.push(stmt);
        }
      } else {
        const values= [];
        do {
          values.push(this.expression());
        } while (this.match(TokenType.COMMA));

        this.consumeNewlines();
        const body= [];
        while (!this.check(TokenType.CASE, TokenType.END) && !this.isAtEnd()) {
          const stmt = this.statement();
          if (stmt) body.push(stmt);
        }

        cases.push({ values, body });
      }
    }

    this.consume(TokenType.END, 'Expected "End" after select statement');
    this.consume(TokenType.SELECT, 'Expected "Select" after "End"');

    return { type, expression, cases, defaultCase };
  }

  returnStatement()
    let value
    if (!this.check(TokenType.NEWLINE) && !this.isAtEnd()) {
      value = this.expression();
    }
    return { type, value };
  }

  expressionStatement()
    const expr = this.expression();
    return { type, expression
  }

  // Expression parsing (precedence climbing)
  expression()
    return this.assignment();
  }

  assignment()
    const expr = this.logicalOr();

    if (this.match(TokenType.EQ)) {
      const value = this.assignment();
      if (expr.type === 'Identifier' || expr.type === 'FieldAccess' || expr.type === 'ArrayAccess') {
        return { type, target, value };
      }
      throw new ParseError('Invalid assignment target', this.previous());
    }

    return expr;
  }

  logicalOr()
    let expr = this.logicalAnd();

    while (this.match(TokenType.OR)) {
      const operator = this.previous().value;
      const right = this.logicalAnd();
      expr = { type, left, operator, right };
    }

    return expr;
  }

  logicalAnd()
    let expr = this.equality();

    while (this.match(TokenType.AND)) {
      const operator = this.previous().value;
      const right = this.equality();
      expr = { type, left, operator, right };
    }

    return expr;
  }

  equality()
    let expr = this.comparison();

    while (this.match(TokenType.NOT_EQUAL)) {
      const operator = this.previous().value;
      const right = this.comparison();
      expr = { type, left, operator, right };
    }

    return expr;
  }

  comparison()
    let expr = this.additive();

    while (this.match(TokenType.LESS_THAN, TokenType.LESS_EQUAL, TokenType.GREATER_THAN, TokenType.GREATER_EQUAL)) {
      const operator = this.previous().value;
      const right = this.additive();
      expr = { type, left, operator, right };
    }

    return expr;
  }

  additive()
    let expr = this.multiplicative();

    while (this.match(TokenType.PLUS, TokenType.MINUS)) {
      const operator = this.previous().value;
      const right = this.multiplicative();
      expr = { type, left, operator, right };
    }

    return expr;
  }

  multiplicative()
    let expr = this.unary();

    while (this.match(TokenType.MULTIPLY, TokenType.DIVIDE, TokenType.MOD)) {
      const operator = this.previous().value;
      const right = this.unary();
      expr = { type, left, operator, right };
    }

    return expr;
  }

  unary()
    if (this.match(TokenType.NOT, TokenType.MINUS)) {
      const operator = this.previous().value;
      const operand = this.unary();
      return { type, operator, operand };
    }

    return this.postfix();
  }

  postfix()
    let expr = this.primary();

    while (true) {
      if (this.match(TokenType.LPAREN)) {
        // Function call
        const args= [];
        if (!this.check(TokenType.RPAREN)) {
          do {
            args.push(this.expression());
          } while (this.match(TokenType.COMMA));
        }
        this.consume(TokenType.RPAREN, 'Expected ")" after arguments');
        expr = { type, name, arguments
      } else if (this.match(TokenType.DOT)) {
        // Field access
        const field = this.consume(TokenType.IDENTIFIER, 'Expected field name after "."').value;
        expr = { type, object, field };
      } else if (this.match(TokenType.LBRACKET)) {
        // Array access
        const indices= [];
        do {
          indices.push(this.expression());
        } while (this.match(TokenType.COMMA));
        this.consume(TokenType.RBRACKET, 'Expected "]" after array indices');
        expr = { type, array, indices };
      } else {
        break;
      }
    }

    return expr;
  }

  primary()
    // Literals
    if (this.match(TokenType.INTEGER)) {
      return { type, value).value) };
    }
    if (this.match(TokenType.FLOAT)) {
      return { type, value).value) };
    }
    if (this.match(TokenType.STRING)) {
      return { type, value).value };
    }
    if (this.match(TokenType.TRUE)) {
      return { type, value
    }
    if (this.match(TokenType.FALSE)) {
      return { type, value
    }
    if (this.match(TokenType.NULL)) {
      return { type, value
    }

    // Identifier
    if (this.match(TokenType.IDENTIFIER)) {
      return { type, name).value };
    }

    // Grouped expression
    if (this.match(TokenType.LPAREN)) {
      const expr = this.expression();
      this.consume(TokenType.RPAREN, 'Expected ")" after expression');
      return expr;
    }

    // New keyword
    if (this.match(TokenType.NEW)) {
      const typeName = this.consume(TokenType.IDENTIFIER, 'Expected type name after "New"').value;
      return { type, typeName };
    }

    throw new ParseError(`Unexpected token).value}`, this.peek());
  }

  // Helper methods
  suffixToType(suffix)
    switch (suffix) {
      case '#', name
      case '$', name
      case '%', name
      default, name
    }
  }

  match(...types)
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  check(...types)
    if (this.isAtEnd()) return false;
    return types.includes(this.peek().type);
  }

  advance()
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  isAtEnd()
    return this.peek().type === TokenType.EOF;
  }

  peek()
    return this.tokens[this.current];
  }

  previous()
    return this.tokens[this.current - 1];
  }

  consume(type, message)
    if (this.check(type)) return this.advance();
    throw new ParseError(message, this.peek());
  }

  consumeNewlines()
    while (this.match(TokenType.NEWLINE)) {}
  }

  synchronize()
    this.advance();

    while (!this.isAtEnd()) {
      if (this.previous().type === TokenType.NEWLINE) return;

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


// ===== src/compiler/codegen.ts =====
/**
 * Blitz3D Code Generator - WASM Text Format
 * 
 * Generates WebAssembly Text Format (WAT) from AST
 */


class CodeGenerator {
  output= [];
  indent = 0;
  localIndex = 0;
  locals = new Map<string, { index);
  globals = new Map<string, { index);
  functions = new Map<string, { index
  nextFunctionIndex = 0;
  stringLiterals = new Map<string, number>();
  nextStringIndex = 0;

  generate(program)
    this.emit('(module');
    this.indent++;

    // Import JavaScript runtime functions
    this.emitRuntimeImports();

    // Memory
    this.emit('(memory (export "memory") 1)');

    // String data section
    this.emitStringData(program);

    // Generate functions
    for (const stmt of program.statements) {
      if (stmt.type === 'FunctionDeclaration') {
        this.generateFunction(stmt);
      }
    }

    // Generate main entry point if needed
    this.generateMainFunction(program);

    this.indent--;
    this.emit(')');

    return this.output.join('\n');
  }

  emitRuntimeImports()
    // Basic runtime functions
    this.emit('(import "env" "print" (func $print (param i32)))');
    this.emit('(import "env" "printFloat" (func $printFloat (param f32)))');
    this.emit('(import "env" "printString" (func $printString (param i32)))');
    this.emit('');
  }

  emitStringData(program)
    // Collect all string literals
    this.collectStringLiterals(program);

    if (this.stringLiterals.size > 0) {
      this.emit('; String data section');
      let offset = 0;
      for (const [str, index] of this.stringLiterals.entries()) {
        const escaped = str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        this.emit(`(data (i32.const ${offset}) "${escaped}\\00")`);
        offset += str.length + 1; // +1 for null terminator
      }
      this.emit('');
    }
  }

  collectStringLiterals(node)
    if (!node || typeof node !== 'object') return;

    if (node.type === 'StringLiteral' && !this.stringLiterals.has(node.value)) {
      this.stringLiterals.set(node.value, this.nextStringIndex++);
    }

    // Recursively collect from all properties
    for (const key in node) {
      if (Array.isArray(node[key])) {
        node[key].forEach((item) => this.collectStringLiterals(item));
      } else if (typeof node[key] === 'object') {
        this.collectStringLiterals(node[key]);
      }
    }
  }

  generateFunction(func)
    this.locals.clear();
    this.localIndex = 0;

    // Register function
    const funcIndex = this.nextFunctionIndex++;
    this.functions.set(func.name, {
      index,
      params=> this.typeToWasm(p.type)),
      returns) 
    });

    // Function signature
    const params = func.parameters.map((p, i) => {
      const wasmType = this.typeToWasm(p.type);
      this.locals.set(p.name, { index, type);
      this.localIndex++;
      return `(param $${p.name} ${wasmType})`;
    }).join(' ');

    const returns = func.returnType ? `(result ${this.typeToWasm(func.returnType)})` 

    this.emit(`(func $${func.name} (export "${func.name}") ${params} ${returns}`);
    this.indent++;

    // Local variables (we'll add them as we encounter them)
    const localDecls= [];

    // Generate function body
    for (const stmt of func.body) {
      this.generateStatement(stmt);
    }

    // Add default return if no explicit return
    if (func.returnType) {
      const wasmType = this.typeToWasm(func.returnType);
      if (wasmType === 'i32') {
        this.emit('i32.const 0');
      } else if (wasmType === 'f32') {
        this.emit('f32.const 0');
      }
    }

    this.indent--;
    this.emit(')');
    this.emit('');
  }

  generateMainFunction(program)
    // Generate main function from top-level statements
    const topLevelStmts = program.statements.filter(s => 
      s.type !== 'FunctionDeclaration' && s.type !== 'TypeDeclaration'
    );

    if (topLevelStmts.length === 0) return;

    this.emit('(func $main (export "main")');
    this.indent++;

    for (const stmt of topLevelStmts) {
      this.generateStatement(stmt);
    }

    this.indent--;
    this.emit(')');
    this.emit('');

    // Start function
    this.emit('(start $main)');
  }

  generateStatement(stmt)
    switch (stmt.type) {
      case 'VariableDeclaration':
        this.generateVariableDeclaration(stmt);
        break;
      case 'ExpressionStatement':
        this.generateExpression(stmt.expression);
        this.emit('drop'); // Discard result
        break;
      case 'IfStatement':
        this.generateIfStatement(stmt);
        break;
      case 'ForLoop':
        this.generateForLoop(stmt);
        break;
      case 'WhileLoop':
        this.generateWhileLoop(stmt);
        break;
      case 'ReturnStatement':
        if (stmt.value) {
          this.generateExpression(stmt.value);
        }
        this.emit('return');
        break;
      default:
        this.emit(`; TODO);
    }
  }

  generateVariableDeclaration(decl)
    const wasmType = this.typeToWasm(decl.varType);
    
    if (decl.scope === 'global') {
      const globalIndex = this.globals.size;
      this.globals.set(decl.name, { index, type);
      
      // Emit global declaration
      const initialValue = decl.initializer ? this.expressionToString(decl.initializer) 
                          (wasmType === 'i32' ? 'i32.const 0' );
      this.emit(`(global $${decl.name} (mut ${wasmType}) (${initialValue}))`);
    } else {
      // Local variable
      const localIndex = this.localIndex++;
      this.locals.set(decl.name, { index, type);
      this.emit(`(local $${decl.name} ${wasmType})`);
      
      if (decl.initializer) {
        this.generateExpression(decl.initializer);
        this.emit(`local.set $${decl.name}`);
      }
    }
  }

  generateIfStatement(stmt)
    // Generate condition
    this.generateExpression(stmt.condition);
    
    this.emit('(if');
    this.indent++;
    this.emit('(then');
    this.indent++;
    
    for (const s of stmt.thenBranch) {
      this.generateStatement(s);
    }
    
    this.indent--;
    this.emit(')');
    
    if (stmt.elseBranch && stmt.elseBranch.length > 0) {
      this.emit('(else');
      this.indent++;
      
      for (const s of stmt.elseBranch) {
        this.generateStatement(s);
      }
      
      this.indent--;
      this.emit(')');
    }
    
    this.indent--;
    this.emit(')');
  }

  generateForLoop(loop)
    // Initialize loop variable
    this.generateExpression(loop.start);
    const wasmType = 'i32'; // For now assume int
    const varIndex = this.localIndex++;
    this.locals.set(loop.variable, { index, type);
    this.emit(`(local $${loop.variable} ${wasmType})`);
    this.emit(`local.set $${loop.variable}`);
    
    // Calculate end value (store in temp)
    this.generateExpression(loop.end);
    const endVarIndex = this.localIndex++;
    this.emit(`(local $__for_end_${varIndex} ${wasmType})`);
    this.emit(`local.set $__for_end_${varIndex}`);
    
    // Loop
    this.emit('(block $break');
    this.indent++;
    this.emit('(loop $continue');
    this.indent++;
    
    // Check condition
    this.emit(`local.get $${loop.variable}`);
    this.emit(`local.get $__for_end_${varIndex}`);
    this.emit('i32.gt_s');
    this.emit('br_if $break');
    
    // Loop body
    for (const stmt of loop.body) {
      this.generateStatement(stmt);
    }
    
    // Increment
    this.emit(`local.get $${loop.variable}`);
    if (loop.step) {
      this.generateExpression(loop.step);
    } else {
      this.emit('i32.const 1');
    }
    this.emit('i32.add');
    this.emit(`local.set $${loop.variable}`);
    
    this.emit('br $continue');
    
    this.indent--;
    this.emit(')');
    this.indent--;
    this.emit(')');
  }

  generateWhileLoop(loop)
    this.emit('(block $break');
    this.indent++;
    this.emit('(loop $continue');
    this.indent++;
    
    // Check condition
    this.generateExpression(loop.condition);
    this.emit('i32.eqz');
    this.emit('br_if $break');
    
    // Loop body
    for (const stmt of loop.body) {
      this.generateStatement(stmt);
    }
    
    this.emit('br $continue');
    
    this.indent--;
    this.emit(')');
    this.indent--;
    this.emit(')');
  }

  generateExpression(expr)
    switch (expr.type) {
      case 'IntegerLiteral':
        this.emit(`i32.const ${expr.value}`);
        break;
      case 'FloatLiteral':
        this.emit(`f32.const ${expr.value}`);
        break;
      case 'StringLiteral'
        const index = this.stringLiterals.get(expr.value) || 0;
        // Return pointer to string in memory
        let offset = 0;
        for (const [str, idx] of this.stringLiterals.entries()) {
          if (idx === index) break;
          offset += str.length + 1;
        }
        this.emit(`i32.const ${offset}`);
        break;
      }
      case 'Identifier'
        const local = this.locals.get(expr.name);
        if (local) {
          this.emit(`local.get $${expr.name}`);
        } else {
          const global = this.globals.get(expr.name);
          if (global) {
            this.emit(`global.get $${expr.name}`);
          } else {
            this.emit(`; ERROR);
            this.emit('i32.const 0');
          }
        }
        break;
      }
      case 'BinaryOp':
        this.generateBinaryOp(expr);
        break;
      case 'UnaryOp':
        this.generateExpression(expr.operand);
        if (expr.operator === 'Not') {
          this.emit('i32.eqz');
        } else if (expr.operator === '-') {
          this.emit('i32.const -1');
          this.emit('i32.mul');
        }
        break;
      case 'FunctionCall':
        this.generateFunctionCall(expr);
        break;
      case 'Assignment':
        this.generateAssignment(expr);
        break;
      default:
        this.emit(`; TODO);
        this.emit('i32.const 0');
    }
  }

  generateBinaryOp(expr)
    this.generateExpression(expr.left);
    this.generateExpression(expr.right);
    
    // Determine type (simplified - assume i32 for now)
    const op = expr.operator;
    
    switch (op) {
      case '+':
        this.emit('i32.add');
        break;
      case '-':
        this.emit('i32.sub');
        break;
      case '*':
        this.emit('i32.mul');
        break;
      case '/':
        this.emit('i32.div_s');
        break;
      case 'Mod':
        this.emit('i32.rem_s');
        break;
      case '=':
      case '==':
        this.emit('i32.eq');
        break;
      case '<>':
      case '!=':
        this.emit('i32.ne');
        break;
      case '<':
        this.emit('i32.lt_s');
        break;
      case '<=':
        this.emit('i32.le_s');
        break;
      case '>':
        this.emit('i32.gt_s');
        break;
      case '>=':
        this.emit('i32.ge_s');
        break;
      case 'And':
        this.emit('i32.and');
        break;
      case 'Or':
        this.emit('i32.or');
        break;
      default:
        this.emit(`; Unknown operator);
    }
  }

  generateFunctionCall(expr)
    // Special built-in functions
    if (expr.name.type === 'Identifier') {
      const funcName = (expr.name as AST.Identifier).name.toLowerCase();
      
      if (funcName === 'print') {
        if (expr.arguments.length > 0) {
          this.generateExpression(expr.arguments[0]);
          // Determine type and call appropriate print function
          this.emit('call $print');
        }
        return;
      }
    }
    
    // Regular function call
    for (const arg of expr.arguments) {
      this.generateExpression(arg);
    }
    
    if (expr.name.type === 'Identifier') {
      const funcName = (expr.name as AST.Identifier).name;
      this.emit(`call $${funcName}`);
    }
  }

  generateAssignment(expr)
    // Generate value
    this.generateExpression(expr.value);
    
    // Set target
    if (expr.target.type === 'Identifier') {
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
    if (expr.target.type === 'Identifier') {
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

  expressionToString(expr)
    if (expr.type === 'IntegerLiteral') {
      return `i32.const ${expr.value}`;
    } else if (expr.type === 'FloatLiteral') {
      return `f32.const ${expr.value}`;
    }
    return 'i32.const 0';
  }

  typeToWasm(type)
    if (type.kind === 'primitive') {
      switch (type.name) {
        case 'Int'
        case 'Float'
        case 'String'
        default
      }
    }
    return 'i32';
  }

  emit(line)
    this.output.push('  '.repeat(this.indent) + line);
  }
}


// Browser exports
window.Blitz3DCompiler = { Lexer, Parser, CodeGenerator };
