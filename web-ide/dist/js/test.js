"use strict";
/**
 * Test the Blitz3D TypeScript Compiler
 */
Object.defineProperty(exports, "__esModule", { value: true });
const lexer_1 = require("./lexer");
const parser_1 = require("./parser");
const codegen_1 = require("./codegen");
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
console.log("=== Blitz3D TypeScript Compiler Test ===\n");
// Lexer test
console.log("1. LEXER TEST");
console.log("Input:", testProgram);
const lexer = new lexer_1.Lexer(testProgram);
const tokens = lexer.tokenize();
console.log("Tokens:", tokens.length);
console.log("");
// Parser test
console.log("2. PARSER TEST");
const parser = new parser_1.Parser(testProgram);
try {
  const ast = parser.parse();
  console.log("AST:", JSON.stringify(ast, null, 2));
  console.log("");
  // Code generator test
  console.log("3. CODE GENERATION TEST");
  const codegen = new codegen_1.CodeGenerator();
  const wat = codegen.generate(ast);
  console.log("WebAssembly Text Format:\n");
  console.log(wat);
} catch (e) {
  console.error("Error:", e);
}
