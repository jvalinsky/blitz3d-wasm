/**
 * Blitz3D Parser
 *
 * Converts tokens into an Abstract Syntax Tree (AST)
 */
import { Token } from './lexer';
import * as AST from './ast';
export declare class ParseError extends Error {
    token: Token;
    constructor(message: string, token: Token);
}
export declare class Parser {
    private tokens;
    private current;
    errors: string[];
    constructor(source: string);
    parse(): AST.Program;
    private statement;
    private functionDeclaration;
    private typeDeclaration;
    private variableDeclaration;
    private ifStatement;
    private forLoop;
    private whileLoop;
    private repeatLoop;
    private selectStatement;
    private returnStatement;
    private expressionStatement;
    private expression;
    private assignment;
    private logicalOr;
    private logicalAnd;
    private equality;
    private comparison;
    private additive;
    private multiplicative;
    private unary;
    private postfix;
    private primary;
    private suffixToType;
    private match;
    private check;
    private advance;
    private isAtEnd;
    private peek;
    private previous;
    private consume;
    private consumeNewlines;
    private synchronize;
}
