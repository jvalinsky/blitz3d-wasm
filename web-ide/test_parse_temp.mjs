import "./dist/compiler.bundle.js";

const { Parser } = window.Blitz3DCompiler;

const code = `For i% = 1 To 5
    Print i
Next`;

const parser = new Parser(code);
const ast = parser.parse();

console.log("AST:");
console.log(JSON.stringify(ast, null, 2));
console.log("\nParser errors:", parser.errors);
