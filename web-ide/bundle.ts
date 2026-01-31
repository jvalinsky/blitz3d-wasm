// Read and output TypeScript files without imports/exports
const files = [
  'src/compiler/lexer.ts',
  'src/compiler/ast.ts', 
  'src/compiler/parser.ts',
  'src/compiler/codegen.ts'
];

console.log('// Blitz3D Compiler Bundle - Generated from TypeScript');
console.log('');

for (const file of files) {
  const content = await Deno.readTextFile(file);
  // Remove import/export statements
  const cleaned = content
    .split('\n')
    .filter(line => !line.trim().startsWith('import '))
    .map(line => line.replace(/^export /g, ''))
    .join('\n');
  
  console.log(`// ===== ${file} =====`);
  console.log(cleaned);
  console.log('');
}

// Add browser exports
console.log('// Browser exports');
console.log('window.Blitz3DCompiler = { Lexer, Parser, CodeGenerator };');
