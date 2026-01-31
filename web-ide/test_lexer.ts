import { Lexer } from './src/compiler/lexer.ts';

const lexer = new Lexer('x% = 5');
const result = lexer.tokenize();
console.log('Tokens:', result.tokens.map(t => ({ type: t.type, value: t.value })));
