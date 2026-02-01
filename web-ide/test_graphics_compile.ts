#!/usr/bin/env -S deno run --allow-read

import { Lexer, Parser, CodeGenerator } from './src/compiler/all.ts';

const source = await Deno.readTextFile('test_graphics.bb');

try {
  const lexer = new Lexer(source);
  const { tokens, errors: lexerErrors } = lexer.tokenize();
  
  if (lexerErrors.length > 0) {
    console.log('❌ Lexer errors:', lexerErrors);
    Deno.exit(1);
  }
  
  const parser = new Parser(source);
  const ast = parser.parse();
  
  if (parser.errors.length > 0) {
    console.log('❌ Parser errors:', parser.errors);
    Deno.exit(1);
  }
  
  const codegen = new CodeGenerator();
  const wat = codegen.generate(ast);
  
  console.log('✅ Graphics example compiled successfully!');
  console.log(`   Tokens: ${tokens.length}, Lines: ${source.split('\n').length}, WAT: ${wat.length} bytes`);
  console.log('\nFirst 30 lines of WAT:');
  console.log(wat.split('\n').slice(0, 30).join('\n'));
} catch (error) {
  console.log('❌ Compilation error:', error.message);
  Deno.exit(1);
}
