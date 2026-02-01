export { Lexer } from './lexer.js';
export { Parser } from './parser.js';
export { CodeGenerator } from './codegen.js';
export * as AST from './ast.js';
declare global {
    interface Window {
        Blitz3DCompiler: {
            Lexer: typeof import('./lexer.js').Lexer;
            Parser: typeof import('./parser.js').Parser;
            CodeGenerator: typeof import('./codegen.js').CodeGenerator;
        };
    }
}
