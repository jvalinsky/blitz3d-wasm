/**
 * Blitz3D Parser
 * 
 * Converts tokens into an Abstract Syntax Tree (AST)
 */

import { Token, TokenType, Lexer } from './lexer';
import * as AST from './ast';

export class ParseError extends Error {
  constructor(message: string, public token: Token) {
    super(`Parse error at line ${token.line}, column ${token.column}: ${message}`);
    this.name = 'ParseError';
  }
}

export class Parser {
  private tokens: Token[];
  private current = 0;

  constructor(source: string) {
    const lexer = new Lexer(source);
    const result = lexer.tokenize();
    this.tokens = result.tokens;
    
    // Report lexer errors
    if (result.errors.length > 0) {
      console.error('Lexer errors:', result.errors);
    }
  }

  parse(): AST.Program {
    const statements: AST.Statement[] = [];
    
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

    return { type: 'Program', statements };
  }

  // Statement parsing
  private statement(): AST.Statement | null {
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

    // Check for Print statement (special case - can be called without parens)
    if (this.check(TokenType.IDENTIFIER)) {
      const name = this.peek().value.toLowerCase();
      if (name === 'print') {
        this.advance(); // consume 'Print'
        const arg = this.expression();
        return {
          type: 'ExpressionStatement',
          expression: {
            type: 'FunctionCall',
            name: { type: 'Identifier', name: 'Print' },
            arguments: [arg]
          } as AST.FunctionCall
        };
      }
    }

    // Expression statement (assignment or function call)
    return this.expressionStatement();
  }

  private functionDeclaration(): AST.FunctionDeclaration {
    const name = this.consume(TokenType.IDENTIFIER, 'Expected function name').value;
    
    // Check for type suffix
    let returnType: AST.TypeAnnotation | undefined;
    if (this.peek().value.includes('#') || this.peek().value.includes('$') || this.peek().value.includes('%')) {
      const suffix = this.peek().value[this.peek().value.length - 1];
      returnType = this.suffixToType(suffix);
    }

    this.consume(TokenType.LPAREN, 'Expected "(" after function name');
    
    const parameters: AST.Parameter[] = [];
    if (!this.check(TokenType.RPAREN)) {
      do {
        const paramName = this.consume(TokenType.IDENTIFIER, 'Expected parameter name').value;
        let paramType: AST.TypeAnnotation = { kind: 'primitive', name: 'Int' };
        
        // Check for type suffix in parameter name
        const lastChar = paramName[paramName.length - 1];
        if (['#', '$', '%'].includes(lastChar)) {
          paramType = this.suffixToType(lastChar);
        }

        // Default value
        let defaultValue: AST.Expression | undefined;
        if (this.match(TokenType.EQ)) {
          defaultValue = this.expression();
        }

        parameters.push({ name: paramName, type: paramType, defaultValue });
      } while (this.match(TokenType.COMMA));
    }
    
    this.consume(TokenType.RPAREN, 'Expected ")" after parameters');
    this.consumeNewlines();

    const body: AST.Statement[] = [];
    while (!this.check(TokenType.END) && !this.isAtEnd()) {
      const stmt = this.statement();
      if (stmt) body.push(stmt);
    }

    this.consume(TokenType.END, 'Expected "End" after function body');
    this.consume(TokenType.FUNCTION, 'Expected "Function" after "End"');

    return {
      type: 'FunctionDeclaration',
      name,
      parameters,
      returnType,
      body
    };
  }

  private typeDeclaration(): AST.TypeDeclaration {
    const name = this.consume(TokenType.IDENTIFIER, 'Expected type name').value;
    this.consumeNewlines();

    const fields: AST.TypeField[] = [];
    while (!this.check(TokenType.END) && !this.isAtEnd()) {
      if (this.match(TokenType.NEWLINE)) continue;
      
      if (this.check(TokenType.FIELD)) {
        this.advance();
        const fieldName = this.consume(TokenType.IDENTIFIER, 'Expected field name').value;
        
        let fieldType: AST.TypeAnnotation = { kind: 'primitive', name: 'Int' };
        const lastChar = fieldName[fieldName.length - 1];
        if (['#', '$', '%'].includes(lastChar)) {
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

    return { type: 'TypeDeclaration', name, fields };
  }

  private variableDeclaration(): AST.VariableDeclaration {
    const scope = this.previous().type === TokenType.LOCAL ? 'local' :
                  this.previous().type === TokenType.GLOBAL ? 'global' :
                  this.previous().type === TokenType.CONST ? 'const' : 'dim';

    const name = this.consume(TokenType.IDENTIFIER, 'Expected variable name').value;
    
    let varType: AST.TypeAnnotation = { kind: 'primitive', name: 'Int' };
    const lastChar = name[name.length - 1];
    if (['#', '$', '%'].includes(lastChar)) {
      varType = this.suffixToType(lastChar);
    }

    // Array dimensions
    const dimensions: AST.Expression[] = [];
    if (this.match(TokenType.LPAREN)) {
      if (!this.check(TokenType.RPAREN)) {
        do {
          dimensions.push(this.expression());
        } while (this.match(TokenType.COMMA));
      }
      this.consume(TokenType.RPAREN, 'Expected ")" after array dimensions');
    }

    // Initial value
    let initializer: AST.Expression | undefined;
    if (this.match(TokenType.EQ)) {
      initializer = this.expression();
    }

    return {
      type: 'VariableDeclaration',
      name,
      varType,
      scope,
      dimensions,
      initializer
    };
  }

  private ifStatement(): AST.IfStatement {
    const condition = this.expression();
    this.match(TokenType.THEN); // Optional
    this.consumeNewlines();

    const thenBranch: AST.Statement[] = [];
    while (!this.check(TokenType.ELSE, TokenType.ELSEIF, TokenType.ENDIF, TokenType.END) && !this.isAtEnd()) {
      const stmt = this.statement();
      if (stmt) thenBranch.push(stmt);
    }

    const elseIfBranches: Array<{ condition: AST.Expression; body: AST.Statement[] }> = [];
    while (this.match(TokenType.ELSEIF)) {
      const elseIfCondition = this.expression();
      this.match(TokenType.THEN);
      this.consumeNewlines();

      const elseIfBody: AST.Statement[] = [];
      while (!this.check(TokenType.ELSE, TokenType.ELSEIF, TokenType.ENDIF, TokenType.END) && !this.isAtEnd()) {
        const stmt = this.statement();
        if (stmt) elseIfBody.push(stmt);
      }
      elseIfBranches.push({ condition: elseIfCondition, body: elseIfBody });
    }

    let elseBranch: AST.Statement[] | undefined;
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

    return { type: 'IfStatement', condition, thenBranch, elseIfBranches, elseBranch };
  }

  private forLoop(): AST.ForLoop {
    const variable = this.consume(TokenType.IDENTIFIER, 'Expected loop variable').value;
    this.consume(TokenType.EQ, 'Expected "=" after loop variable');
    const start = this.expression();
    this.consume(TokenType.TO, 'Expected "To" in for loop');
    const end = this.expression();
    
    let step: AST.Expression | undefined;
    if (this.match(TokenType.STEP)) {
      step = this.expression();
    }

    this.consumeNewlines();

    const body: AST.Statement[] = [];
    while (!this.check(TokenType.NEXT) && !this.isAtEnd()) {
      const stmt = this.statement();
      if (stmt) body.push(stmt);
    }

    this.consume(TokenType.NEXT, 'Expected "Next" after for loop body');
    this.match(TokenType.IDENTIFIER); // Optional variable name after Next

    return { type: 'ForLoop', variable, start, end, step, body };
  }

  private whileLoop(): AST.WhileLoop {
    const condition = this.expression();
    this.consumeNewlines();

    const body: AST.Statement[] = [];
    while (!this.check(TokenType.WEND) && !this.isAtEnd()) {
      const stmt = this.statement();
      if (stmt) body.push(stmt);
    }

    this.consume(TokenType.WEND, 'Expected "Wend" after while loop body');

    return { type: 'WhileLoop', condition, body };
  }

  private repeatLoop(): AST.RepeatLoop {
    this.consumeNewlines();

    const body: AST.Statement[] = [];
    while (!this.check(TokenType.UNTIL, TokenType.FOREVER) && !this.isAtEnd()) {
      const stmt = this.statement();
      if (stmt) body.push(stmt);
    }

    let condition: AST.Expression | undefined;
    if (this.match(TokenType.UNTIL)) {
      condition = this.expression();
    } else {
      this.consume(TokenType.FOREVER, 'Expected "Until" or "Forever" after repeat loop');
    }

    return { type: 'RepeatLoop', body, condition };
  }

  private selectStatement(): AST.SelectStatement {
    const expression = this.expression();
    this.consumeNewlines();

    const cases: AST.CaseClause[] = [];
    let defaultCase: AST.Statement[] | undefined;

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
        const values: AST.Expression[] = [];
        do {
          values.push(this.expression());
        } while (this.match(TokenType.COMMA));

        this.consumeNewlines();
        const body: AST.Statement[] = [];
        while (!this.check(TokenType.CASE, TokenType.END) && !this.isAtEnd()) {
          const stmt = this.statement();
          if (stmt) body.push(stmt);
        }

        cases.push({ values, body });
      }
    }

    this.consume(TokenType.END, 'Expected "End" after select statement');
    this.consume(TokenType.SELECT, 'Expected "Select" after "End"');

    return { type: 'SelectStatement', expression, cases, defaultCase };
  }

  private returnStatement(): AST.ReturnStatement {
    let value: AST.Expression | undefined;
    if (!this.check(TokenType.NEWLINE) && !this.isAtEnd()) {
      value = this.expression();
    }
    return { type: 'ReturnStatement', value };
  }

  private expressionStatement(): AST.ExpressionStatement {
    const expr = this.expression();
    return { type: 'ExpressionStatement', expression: expr };
  }

  // Expression parsing (precedence climbing)
  private expression(): AST.Expression {
    return this.assignment();
  }

  private assignment(): AST.Expression {
    const expr = this.logicalOr();

    if (this.match(TokenType.EQ)) {
      const value = this.assignment();
      if (expr.type === 'Identifier' || expr.type === 'FieldAccess' || expr.type === 'ArrayAccess') {
        return { type: 'Assignment', target: expr, value };
      }
      throw new ParseError('Invalid assignment target', this.previous());
    }

    return expr;
  }

  private logicalOr(): AST.Expression {
    let expr = this.logicalAnd();

    while (this.match(TokenType.OR)) {
      const operator = this.previous().value;
      const right = this.logicalAnd();
      expr = { type: 'BinaryOp', left: expr, operator, right };
    }

    return expr;
  }

  private logicalAnd(): AST.Expression {
    let expr = this.equality();

    while (this.match(TokenType.AND)) {
      const operator = this.previous().value;
      const right = this.equality();
      expr = { type: 'BinaryOp', left: expr, operator, right };
    }

    return expr;
  }

  private equality(): AST.Expression {
    let expr = this.comparison();

    while (this.match(TokenType.NOT_EQUAL)) {
      const operator = this.previous().value;
      const right = this.comparison();
      expr = { type: 'BinaryOp', left: expr, operator, right };
    }

    return expr;
  }

  private comparison(): AST.Expression {
    let expr = this.additive();

    while (this.match(TokenType.LESS_THAN, TokenType.LESS_EQUAL, TokenType.GREATER_THAN, TokenType.GREATER_EQUAL)) {
      const operator = this.previous().value;
      const right = this.additive();
      expr = { type: 'BinaryOp', left: expr, operator, right };
    }

    return expr;
  }

  private additive(): AST.Expression {
    let expr = this.multiplicative();

    while (this.match(TokenType.PLUS, TokenType.MINUS)) {
      const operator = this.previous().value;
      const right = this.multiplicative();
      expr = { type: 'BinaryOp', left: expr, operator, right };
    }

    return expr;
  }

  private multiplicative(): AST.Expression {
    let expr = this.unary();

    while (this.match(TokenType.MULTIPLY, TokenType.DIVIDE, TokenType.MOD)) {
      const operator = this.previous().value;
      const right = this.unary();
      expr = { type: 'BinaryOp', left: expr, operator, right };
    }

    return expr;
  }

  private unary(): AST.Expression {
    if (this.match(TokenType.NOT, TokenType.MINUS)) {
      const operator = this.previous().value;
      const operand = this.unary();
      return { type: 'UnaryOp', operator, operand };
    }

    return this.postfix();
  }

  private postfix(): AST.Expression {
    let expr = this.primary();

    while (true) {
      if (this.match(TokenType.LPAREN)) {
        // Function call
        const args: AST.Expression[] = [];
        if (!this.check(TokenType.RPAREN)) {
          do {
            args.push(this.expression());
          } while (this.match(TokenType.COMMA));
        }
        this.consume(TokenType.RPAREN, 'Expected ")" after arguments');
        expr = { type: 'FunctionCall', name: expr, arguments: args };
      } else if (this.match(TokenType.DOT)) {
        // Field access
        const field = this.consume(TokenType.IDENTIFIER, 'Expected field name after "."').value;
        expr = { type: 'FieldAccess', object: expr, field };
      } else if (this.match(TokenType.LBRACKET)) {
        // Array access
        const indices: AST.Expression[] = [];
        do {
          indices.push(this.expression());
        } while (this.match(TokenType.COMMA));
        this.consume(TokenType.RBRACKET, 'Expected "]" after array indices');
        expr = { type: 'ArrayAccess', array: expr, indices };
      } else {
        break;
      }
    }

    return expr;
  }

  private primary(): AST.Expression {
    // Literals
    if (this.match(TokenType.INTEGER)) {
      return { type: 'IntegerLiteral', value: parseInt(this.previous().value) };
    }
    if (this.match(TokenType.FLOAT)) {
      return { type: 'FloatLiteral', value: parseFloat(this.previous().value) };
    }
    if (this.match(TokenType.STRING)) {
      return { type: 'StringLiteral', value: this.previous().value };
    }
    if (this.match(TokenType.TRUE)) {
      return { type: 'IntegerLiteral', value: 1 };
    }
    if (this.match(TokenType.FALSE)) {
      return { type: 'IntegerLiteral', value: 0 };
    }
    if (this.match(TokenType.NULL)) {
      return { type: 'IntegerLiteral', value: 0 };
    }

    // Identifier
    if (this.match(TokenType.IDENTIFIER)) {
      return { type: 'Identifier', name: this.previous().value };
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
      return { type: 'NewExpression', typeName };
    }

    throw new ParseError(`Unexpected token: ${this.peek().value}`, this.peek());
  }

  // Helper methods
  private suffixToType(suffix: string): AST.TypeAnnotation {
    switch (suffix) {
      case '#': return { kind: 'primitive', name: 'Float' };
      case '$': return { kind: 'primitive', name: 'String' };
      case '%': return { kind: 'primitive', name: 'Int' };
      default: return { kind: 'primitive', name: 'Int' };
    }
  }

  private match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  private check(...types: TokenType[]): boolean {
    if (this.isAtEnd()) return false;
    return types.includes(this.peek().type);
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }

  private peek(): Token {
    return this.tokens[this.current];
  }

  private previous(): Token {
    return this.tokens[this.current - 1];
  }

  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance();
    throw new ParseError(message, this.peek());
  }

  private consumeNewlines(): void {
    while (this.match(TokenType.NEWLINE)) {}
  }

  private synchronize(): void {
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
