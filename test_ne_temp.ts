import { Lexer } from './src/compiler/lexer.ts';
import { Parser } from './src/compiler/parser.ts';

const code = `If x <> y Then Print 1 EndIf`;
console.log('Code:', code);

// First check lexer
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
console.log('Tokens:');
for (const t of tokens) {
  console.log(`  ${t.type}: "${t.value}" (line ${t.line}, col ${t.column})`);
}

// Now check parser
const parser = new Parser(code);
console.log('\nParsing...');

try {
  const ast = parser.parse();
  console.log('AST:', JSON.stringify(ast, null, 2));
  console.log('Parser errors:', parser.errors);
} catch (e: any) {
  console.log('Exception:', e.message);
}
