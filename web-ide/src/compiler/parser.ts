/**
 * Blitz3D Parser
 *
 * Converts tokens into an Abstract Syntax Tree (AST)
 */

import { Lexer, Token, TokenType } from "./lexer";
import * as AST from "./ast";

export class ParseError extends Error {
  constructor(message: string, public token: Token) {
    super(
      `Parse error at line ${token.line}, column ${token.column}: ${message}`,
    );
    this.name = "ParseError";
  }
}

export class Parser {
  private tokens: Token[];
  private current = 0;
  public errors: string[] = [];

  constructor(source: string) {
    const lexer = new Lexer(source);
    const result = lexer.tokenize();
    this.tokens = result.tokens;

    // Report lexer errors
    if (result.errors.length > 0) {
      console.error("Lexer errors:", result.errors);
    }
  }

  parse(): AST.Program {
    const statements: AST.Statement[] = [];

    // Safety guard: prevent infinite parsing loops
    let iterations = 0;
    const MAX_STATEMENTS = 10000; // Max statements in a program

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
      const error =
        "Parser exceeded maximum statement count (possible infinite loop or extremely large program)";
      this.errors.push(error);
      console.error(error);
    }

    return { type: "Program", statements };
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
    if (this.match(TokenType.IF)) return this.ifStatement();
    if (this.match(TokenType.FOR)) return this.forLoop();
    if (this.match(TokenType.WHILE)) return this.whileLoop();
    if (this.match(TokenType.REPEAT)) return this.repeatLoop();
    if (this.match(TokenType.SELECT)) return this.selectStatement();
    if (this.match(TokenType.RETURN)) return this.returnStatement();

    // Goto statement
    if (this.match(TokenType.GOTO)) {
      const label =
        this.consume(TokenType.IDENTIFIER, "Expected label name after Goto")
          .value;
      return { type: "GotoStatement", label };
    }

    // Gosub statement
    if (this.match(TokenType.GOSUB)) {
      const label =
        this.consume(TokenType.IDENTIFIER, "Expected label name after Gosub")
          .value;
      return { type: "GosubStatement", label };
    }

    // Dot-prefix labels (e.g. .labelName)
    if (
      this.check(TokenType.DOT) && this.peekNext().type === TokenType.IDENTIFIER
    ) {
      this.advance(); // consume DOT
      const labelName = this.advance().value; // consume IDENTIFIER
      return { type: "LabelStatement", name: labelName };
    }

    // Check for function calls without parentheses (Blitz3D feature)
    // Examples: Print "hello", Graphics3D 800, 600, PositionEntity camera, 0, 0, -5
    if (this.check(TokenType.IDENTIFIER)) {
      const name = this.peek().value;
      const nextToken = this.peekNext();

      // Check for implicit variable assignment (identifier followed by =)
      if (nextToken.type === TokenType.EQ) {
        const varName = this.advance().value; // consume identifier
        this.advance(); // consume =
        const value = this.expression();
        return {
          type: "Assignment",
          target: { type: "Identifier", name: varName },
          value: value,
        } as AST.Assignment;
      }

      // Check if this looks like a function call without parentheses
      // (identifier followed by something that could be an argument)
      if (
        nextToken.type !== TokenType.LPAREN &&
        nextToken.type !== TokenType.NEWLINE &&
        nextToken.type !== TokenType.EOF && !this.isEndOfStatement(nextToken)
      ) {
        this.advance(); // consume function name

        // Parse comma-separated arguments
        const args: AST.Expression[] = [];
        if (!this.check(TokenType.NEWLINE) && !this.isAtEnd()) {
          do {
            args.push(this.expression());
          } while (
            this.match(TokenType.COMMA) && !this.check(TokenType.NEWLINE)
          );
        }

        return {
          type: "ExpressionStatement",
          expression: {
            type: "FunctionCall",
            name: { type: "Identifier", name: name },
            arguments: args,
          } as AST.FunctionCall,
        };
      }
    }

    // Check for loop/section terminators - return null to signal end of block
    if (
      this.check(
        TokenType.NEXT,
        TokenType.WEND,
        TokenType.UNTIL,
        TokenType.FOREVER,
        TokenType.CASE,
        TokenType.DEFAULT,
        TokenType.ENDIF,
      )
    ) {
      return null;
    }

    // END: if followed by FUNCTION/TYPE/IF/SELECT/WHILE it's a block terminator,
    // otherwise it's a standalone End statement (program termination)
    if (this.check(TokenType.END)) {
      const next = this.peekNext();
      if (
        next.type === TokenType.FUNCTION || next.type === TokenType.TYPE ||
        next.type === TokenType.IF || next.type === TokenType.SELECT ||
        next.type === TokenType.WHILE
      ) {
        return null; // Block terminator — caller consumes it
      }
      // Standalone End statement
      this.advance(); // consume END
      return { type: "EndStatement" };
    }

    // ELSE / ELSEIF as block terminator
    if (this.check(TokenType.ELSE, TokenType.ELSEIF)) {
      return null;
    }

    // Data/Read/Restore statements
    if (this.match(TokenType.DATA)) {
      return this.dataStatement();
    }
    if (this.match(TokenType.READ)) {
      return this.readStatement();
    }
    if (this.match(TokenType.RESTORE)) {
      return this.restoreStatement();
    }

    // Include statement (preprocessor directive)
    if (this.match(TokenType.INCLUDE)) {
      return this.includeStatement();
    }

    // Expression statement (assignment or function call)
    return this.expressionStatement();
  }

  private functionDeclaration(): AST.FunctionDeclaration {
    let name =
      this.consume(TokenType.IDENTIFIER, "Expected function name").value;

    // Check for type suffix and STRIP IT from name (like Swift compiler does)
    let returnType: AST.TypeAnnotation | undefined;
    const lastChar = name[name.length - 1];
    if (lastChar === "%") {
      returnType = { kind: "primitive", name: "Int" };
      name = name.slice(0, -1); // STRIP SUFFIX
    } else if (lastChar === "#") {
      returnType = { kind: "primitive", name: "Float" };
      name = name.slice(0, -1); // STRIP SUFFIX
    } else if (lastChar === "$") {
      returnType = { kind: "primitive", name: "String" };
      name = name.slice(0, -1); // STRIP SUFFIX
    }

    this.consume(TokenType.LPAREN, 'Expected "(" after function name');

    const parameters: AST.Parameter[] = [];
    if (!this.check(TokenType.RPAREN)) {
      do {
        let paramName =
          this.consume(TokenType.IDENTIFIER, "Expected parameter name").value;
        let paramType: AST.TypeAnnotation = { kind: "primitive", name: "Int" };

        // Check for type suffix in parameter name and STRIP IT
        const lastChar = paramName[paramName.length - 1];
        if (lastChar === "%") {
          paramType = { kind: "primitive", name: "Int" };
          paramName = paramName.slice(0, -1); // STRIP SUFFIX
        } else if (lastChar === "#") {
          paramType = { kind: "primitive", name: "Float" };
          paramName = paramName.slice(0, -1); // STRIP SUFFIX
        } else if (lastChar === "$") {
          paramType = { kind: "primitive", name: "String" };
          paramName = paramName.slice(0, -1); // STRIP SUFFIX
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
      type: "FunctionDeclaration",
      name,
      parameters,
      returnType,
      body,
    };
  }

  private typeDeclaration(): AST.TypeDeclaration {
    const name = this.consume(TokenType.IDENTIFIER, "Expected type name").value;
    this.consumeNewlines();

    const fields: AST.TypeField[] = [];
    while (!this.check(TokenType.END) && !this.isAtEnd()) {
      if (this.match(TokenType.NEWLINE)) continue;

      if (this.check(TokenType.FIELD)) {
        this.advance();
        const fieldName =
          this.consume(TokenType.IDENTIFIER, "Expected field name").value;

        let fieldType: AST.TypeAnnotation = { kind: "primitive", name: "Int" };
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

  private variableDeclaration(): AST.VariableDeclaration {
    const scope = this.previous().type === TokenType.LOCAL
      ? "local"
      : this.previous().type === TokenType.GLOBAL
      ? "global"
      : this.previous().type === TokenType.CONST
      ? "const"
      : "dim";

    const name =
      this.consume(TokenType.IDENTIFIER, "Expected variable name").value;

    let varType: AST.TypeAnnotation = { kind: "primitive", name: "Int" };
    const lastChar = name[name.length - 1];
    if (["#", "$", "%"].includes(lastChar)) {
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
      type: "VariableDeclaration",
      name,
      varType,
      scope,
      dimensions,
      initializer,
    };
  }

  private dataStatement(): AST.DataStatement {
    const values: AST.Expression[] = [];
    // Data can be on same line or multiple lines
    while (!this.check(TokenType.NEWLINE, TokenType.EOF) && !this.isAtEnd()) {
      const value = this.expression();
      if (value) values.push(value);
      this.match(TokenType.COMMA); // optional comma
    }
    return { type: "DataStatement", values };
  }

  private readStatement(): AST.ReadStatement {
    const variables: AST.Identifier[] = [];
    while (!this.check(TokenType.NEWLINE, TokenType.EOF) && !this.isAtEnd()) {
      if (this.check(TokenType.IDENTIFIER)) {
        const name = this.advance().value;
        variables.push({ type: "Identifier", name });
      }
      this.match(TokenType.COMMA);
    }
    return { type: "ReadStatement", variables };
  }

  private restoreStatement(): AST.RestoreStatement {
    // Restore takes an optional label (not implemented yet)
    return { type: "RestoreStatement" };
  }

  private includeStatement(): AST.IncludeStatement {
    // Include "filename"
    const filename = this.expression();
    if (filename.type !== "StringLiteral") {
      throw new ParseError(
        "Include requires a string literal",
        this.previous(),
      );
    }
    return {
      type: "IncludeStatement",
      filename: filename.value,
    };
  }

  private ifStatement(): AST.IfStatement {
    const condition = this.expression();
    this.match(TokenType.THEN); // Optional
    this.consumeNewlines();

    const thenBranch: AST.Statement[] = [];
    while (
      !this.check(
        TokenType.ELSE,
        TokenType.ELSEIF,
        TokenType.ENDIF,
        TokenType.END,
      ) && !this.isAtEnd()
    ) {
      const stmt = this.statement();
      if (stmt) thenBranch.push(stmt);
    }

    const elseIfBranches: Array<
      { condition: AST.Expression; body: AST.Statement[] }
    > = [];
    while (
      this.match(TokenType.ELSEIF) ||
      (this.check(TokenType.ELSE) && this.peekNext().type === TokenType.IF)
    ) {
      // Handle both "ElseIf" (single token) and "Else If" (two tokens)
      if (this.previous().type !== TokenType.ELSEIF) {
        this.advance(); // consume ELSE
        this.advance(); // consume IF
      }
      const elseIfCondition = this.expression();
      this.match(TokenType.THEN);
      this.consumeNewlines();

      const elseIfBody: AST.Statement[] = [];
      while (
        !this.check(
          TokenType.ELSE,
          TokenType.ELSEIF,
          TokenType.ENDIF,
          TokenType.END,
        ) && !this.isAtEnd()
      ) {
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

    return {
      type: "IfStatement",
      condition,
      thenBranch,
      elseIfBranches,
      elseBranch,
    };
  }

  private forLoop(): AST.ForLoop {
    const variable =
      this.consume(TokenType.IDENTIFIER, "Expected loop variable").value;
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

    return { type: "ForLoop", variable, start, end, step, body };
  }

  private whileLoop(): AST.WhileLoop {
    const condition = this.expression();
    this.consumeNewlines();

    const body: AST.Statement[] = [];
    while (
      !this.check(TokenType.WEND) &&
      !(this.check(TokenType.END) &&
        this.peekNext().type === TokenType.WHILE) &&
      !this.isAtEnd()
    ) {
      const stmt = this.statement();
      if (stmt) body.push(stmt);
    }

    // Accept either "Wend" or "End While"
    if (this.match(TokenType.WEND)) {
      // ok
    } else if (this.match(TokenType.END)) {
      this.consume(TokenType.WHILE, 'Expected "While" after "End"');
    } else {
      this.consume(
        TokenType.WEND,
        'Expected "Wend" or "End While" after while loop body',
      );
    }

    return { type: "WhileLoop", condition, body };
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
      this.consume(
        TokenType.FOREVER,
        'Expected "Until" or "Forever" after repeat loop',
      );
    }

    return { type: "RepeatStatement", body, condition };
  }

  private selectStatement(): AST.SelectStatement {
    const expression = this.expression();
    this.consumeNewlines();

    const cases: AST.CaseClause[] = [];
    let defaultCase: AST.Statement[] | undefined;

    while (
      (this.check(TokenType.CASE) || this.check(TokenType.DEFAULT)) &&
      !this.isAtEnd()
    ) {
      if (
        this.match(TokenType.DEFAULT) ||
        (this.match(TokenType.CASE) && this.check(TokenType.DEFAULT))
      ) {
        // Handle "Default" or "Case Default"
        if (this.check(TokenType.DEFAULT)) this.advance();
        this.consumeNewlines();
        defaultCase = [];
        while (
          !this.check(TokenType.CASE, TokenType.DEFAULT, TokenType.END) &&
          !this.isAtEnd()
        ) {
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
        while (
          !this.check(TokenType.CASE, TokenType.DEFAULT, TokenType.END) &&
          !this.isAtEnd()
        ) {
          const stmt = this.statement();
          if (stmt) body.push(stmt);
        }

        cases.push({ values, body });
      }
    }

    this.consume(TokenType.END, 'Expected "End" after select statement');
    this.consume(TokenType.SELECT, 'Expected "Select" after "End"');

    return { type: "SelectStatement", expression, cases, defaultCase };
  }

  private returnStatement(): AST.ReturnStatement {
    let value: AST.Expression | undefined;
    if (!this.check(TokenType.NEWLINE) && !this.isAtEnd()) {
      value = this.expression();
    }
    return { type: "ReturnStatement", value };
  }

  private expressionStatement(): AST.Statement {
    const expr = this.expression();

    // Check if this is really an assignment disguised as an equality BinaryOp
    // e.g. arr(0) = 42 gets parsed as BinaryOp{left: FunctionCall, op: '=', right: 42}
    // Convert to Assignment if the left side is a valid target
    if (expr.type === "BinaryOp" && expr.operator === "=") {
      let target = expr.left;
      // Convert FunctionCall(Identifier, args) to ArrayAccess
      if (
        target.type === "FunctionCall" && target.name &&
        target.name.type === "Identifier"
      ) {
        target = {
          type: "ArrayAccess",
          array: target.name,
          indices: target.arguments,
        };
      }
      if (
        target.type === "Identifier" || target.type === "FieldAccess" ||
        target.type === "ArrayAccess"
      ) {
        return {
          type: "Assignment",
          target,
          value: expr.right,
        } as AST.Assignment;
      }
    }

    return { type: "ExpressionStatement", expression: expr };
  }

  // Expression parsing (precedence climbing)
  private expression(): AST.Expression {
    return this.assignment();
  }

  private assignment(): AST.Expression {
    const expr = this.logicalOr();

    if (this.match(TokenType.EQ)) {
      const value = this.assignment();
      // Convert FunctionCall with Identifier callee to ArrayAccess for assignment
      // e.g. arr(5) = 10 is parsed as FunctionCall but should be ArrayAccess
      let target = expr;
      if (
        target.type === "FunctionCall" && target.name &&
        target.name.type === "Identifier"
      ) {
        target = {
          type: "ArrayAccess",
          array: target.name,
          indices: target.arguments,
        };
      }
      if (
        target.type === "Identifier" || target.type === "FieldAccess" ||
        target.type === "ArrayAccess"
      ) {
        return { type: "Assignment", target, value };
      }
      throw new ParseError("Invalid assignment target", this.previous());
    }

    return expr;
  }

  private logicalOr(): AST.Expression {
    let expr = this.logicalXor();

    while (this.match(TokenType.OR)) {
      const operator = this.previous().value;
      const right = this.logicalXor();
      expr = { type: "BinaryOp", left: expr, operator, right };
    }

    return expr;
  }

  private logicalXor(): AST.Expression {
    let expr = this.logicalAnd();

    while (this.match(TokenType.XOR)) {
      const operator = this.previous().value;
      const right = this.logicalAnd();
      expr = { type: "BinaryOp", left: expr, operator, right };
    }

    return expr;
  }

  private logicalAnd(): AST.Expression {
    let expr = this.equality();

    while (this.match(TokenType.AND)) {
      const operator = this.previous().value;
      const right = this.equality();
      expr = { type: "BinaryOp", left: expr, operator, right };
    }

    return expr;
  }

  private equality(): AST.Expression {
    let expr = this.comparison();

    while (this.match(TokenType.EQ, TokenType.NE)) {
      const operator = this.previous().value;
      const right = this.comparison();
      expr = { type: "BinaryOp", left: expr, operator, right };
    }

    return expr;
  }

  private comparison(): AST.Expression {
    let expr = this.bitshift();

    while (this.match(TokenType.LT, TokenType.LE, TokenType.GT, TokenType.GE)) {
      const operator = this.previous().value;
      const right = this.bitshift();
      expr = { type: "BinaryOp", left: expr, operator, right };
    }

    return expr;
  }

  private bitshift(): AST.Expression {
    let expr = this.additive();

    while (this.match(TokenType.SHL, TokenType.SHR, TokenType.SAR)) {
      const operator = this.previous().value;
      const right = this.additive();
      expr = { type: "BinaryOp", left: expr, operator, right };
    }

    return expr;
  }

  private additive(): AST.Expression {
    let expr = this.multiplicative();

    while (this.match(TokenType.PLUS, TokenType.MINUS)) {
      const operator = this.previous().value;
      const right = this.multiplicative();
      expr = { type: "BinaryOp", left: expr, operator, right };
    }

    return expr;
  }

  private multiplicative(): AST.Expression {
    let expr = this.power();

    while (this.match(TokenType.MULTIPLY, TokenType.DIVIDE, TokenType.MOD)) {
      const operator = this.previous().value;
      const right = this.power();
      expr = { type: "BinaryOp", left: expr, operator, right };
    }

    return expr;
  }

  private power(): AST.Expression {
    let expr = this.unary();

    while (this.match(TokenType.POWER)) {
      const operator = this.previous().value;
      const right = this.unary();
      expr = { type: "BinaryOp", left: expr, operator, right };
    }

    return expr;
  }

  private unary(): AST.Expression {
    if (this.match(TokenType.NOT, TokenType.MINUS)) {
      const operator = this.previous().value;
      const operand = this.unary();
      return { type: "UnaryOp", operator, operand };
    }

    return this.postfix();
  }

  private postfix(): AST.Expression {
    let expr = this.primary();

    // Safety guard: prevent infinite loops
    let iterations = 0;
    const MAX_POSTFIX_ITERATIONS = 1000;

    while (iterations++ < MAX_POSTFIX_ITERATIONS) {
      if (this.match(TokenType.LPAREN)) {
        // Function call
        const args: AST.Expression[] = [];
        if (!this.check(TokenType.RPAREN)) {
          do {
            args.push(this.expression());
          } while (this.match(TokenType.COMMA));
        }
        this.consume(TokenType.RPAREN, 'Expected ")" after arguments');
        expr = { type: "FunctionCall", name: expr, arguments: args };
      } else if (this.match(TokenType.DOT)) {
        // Field access (dot syntax)
        const field =
          this.consume(TokenType.IDENTIFIER, 'Expected field name after "."')
            .value;
        expr = { type: "FieldAccess", object: expr, field };
      } else if (this.match(TokenType.BACKSLASH)) {
        // Field access (backslash syntax, e.g. npc\Health)
        const field =
          this.consume(TokenType.IDENTIFIER, 'Expected field name after "\\"')
            .value;
        expr = { type: "FieldAccess", object: expr, field };
      } else {
        break;
      }
    }

    if (iterations >= MAX_POSTFIX_ITERATIONS) {
      this.error(
        "Parser exceeded maximum iterations in postfix expression (possible infinite loop)",
      );
    }

    return expr;
  }

  private primary(): AST.Expression {
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
  private suffixToType(suffix: string): AST.TypeAnnotation {
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

  private peekNext(): Token {
    return this.tokens[this.current + 1] || this.peek();
  }

  private isEndOfStatement(token: Token): boolean {
    // Tokens that typically end a statement
    return token.type === TokenType.NEWLINE ||
      token.type === TokenType.EOF ||
      token.type === TokenType.THEN ||
      token.type === TokenType.END ||
      token.type === TokenType.ELSE ||
      token.type === TokenType.ELSEIF ||
      token.type === TokenType.NEXT ||
      token.type === TokenType.WEND ||
      token.type === TokenType.UNTIL ||
      token.type === TokenType.FOREVER;
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
