/**
 * Blitz3D Code Generator - WASM Text Format
 *
 * Generates WebAssembly Text Format (WAT) from AST
 */
import * as AST from './ast';
export declare class CodeGenerator {
    private output;
    private indent;
    private localIndex;
    private locals;
    private globals;
    private functions;
    private nextFunctionIndex;
    private stringLiterals;
    private nextStringIndex;
    generate(program: AST.Program): string;
    private emitRuntimeImports;
    private emitStringData;
    private collectStringLiterals;
    private generateFunction;
    private generateMainFunction;
    private generateStatement;
    private generateVariableDeclaration;
    private generateIfStatement;
    private generateForLoop;
    private generateWhileLoop;
    private generateExpression;
    private generateBinaryOp;
    private generateFunctionCall;
    private generateAssignmentStatement;
    private generateAssignment;
    private expressionToString;
    private typeToWasm;
    private emit;
}
