export { Lexer } from './lexer.js';
export { Parser } from './parser.js';
export { CodeGenerator } from './codegen.js';
export * as AST from './ast.js';
export { withTimeout, TimeoutChecker, CompilationTimeout } from './timeout.js';
export {
  CompilerError,
  LexerError,
  ParseError,
  CodeGenError,
  ValidationError,
  ErrorCollector,
  type SourceLocation
} from './errors.js';

declare global {
  interface Window {
    Blitz3DCompiler: {
      Lexer: typeof import('./lexer.js').Lexer;
      Parser: typeof import('./parser.js').Parser;
      CodeGenerator: typeof import('./codegen.js').CodeGenerator;
      withTimeout: typeof import('./timeout.js').withTimeout;
      TimeoutChecker: typeof import('./timeout.js').TimeoutChecker;
      CompilationTimeout: typeof import('./timeout.js').CompilationTimeout;
    };
  }
}
