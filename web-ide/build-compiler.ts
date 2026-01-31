// Bundle the compiler modules into a single file
import { Lexer } from './src/compiler/lexer.ts';
import { Parser } from './src/compiler/parser.ts';
import { CodeGenerator } from './src/compiler/codegen.ts';

// Export for browser use
(window as any).Blitz3DCompiler = {
  Lexer,
  Parser,
  CodeGenerator
};

console.log('Blitz3D Compiler loaded successfully!');
