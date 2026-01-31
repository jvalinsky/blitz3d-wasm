/**
 * Test the Blitz3D TypeScript Compiler
 */

import { Lexer } from './lexer';
import { Parser } from './parser';
import { CodeGenerator } from './codegen';

const testProgram = `
; Simple Blitz3D program
x% = 5
y% = 10
z% = x + y
Print z
`;

const testFunction = `
Function Add%(a%, b%)
    Return a + b
End Function

result% = Add(5, 10)
Print result
`;

console.log('=== Blitz3D TypeScript Compiler Test ===\n');

// Lexer test
console.log('1. LEXER TEST');
console.log('Input:', testProgram);
const lexer = new Lexer(testProgram);
const tokens = lexer.tokenize();
console.log('Tokens:', tokens.length);
console.log('');

// Parser test
console.log('2. PARSER TEST');
const parser = new Parser(testProgram);
try {
  const ast = parser.parse();
  console.log('AST:', JSON.stringify(ast, null, 2));
  console.log('');

  // Code generator test
  console.log('3. CODE GENERATION TEST');
  const codegen = new CodeGenerator();
  const wat = codegen.generate(ast);
  console.log('WebAssembly Text Format:\n');
  console.log(wat);
} catch (e) {
  console.error('Error:', e);
}
