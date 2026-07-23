/**
 * Comprehensive Unit Tests for Blitz3D TypeScript Compiler
 * Tests all language features: variables, types, functions, control flow, loops, expressions
 */

import { Lexer } from "./lexer";
import { Parser } from "./parser";
import { CodeGenerator } from "./codegen";

let passed = 0;
let failed = 0;

function test(
  name: string,
  code: string,
  check: (ast: any, wat: string) => void,
) {
  try {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    if (tokens.errors && tokens.errors.length > 0) {
      console.log(`❌ ${name}: Lexer errors: ${tokens.errors.join(", ")}`);
      failed++;
      return;
    }

    const parser = new Parser(code);
    const ast = parser.parse();
    if (parser.errors && parser.errors.length > 0) {
      console.log(`❌ ${name}: Parser errors: ${parser.errors.join(", ")}`);
      failed++;
      return;
    }

    const codegen = new CodeGenerator();
    const wat = codegen.generate(ast);

    check(ast, wat);
    console.log(`✅ ${name}`);
    passed++;
  } catch (e: any) {
    console.log(`❌ ${name}: ${e.message}`);
    failed++;
  }
}

console.log("=== Blitz3D Compiler Unit Tests ===\n");

// ============ VARIABLE TESTS ============
console.log("--- Variables ---");

test("Integer variable declaration", `x% = 42`, (ast, wat) => {
  if (ast.statements.length !== 1) throw new Error("Expected 1 statement");
  if (ast.statements[0].type !== "Assignment") {
    throw new Error("Expected Assignment");
  }
  if (!wat.includes("i32.const 42")) throw new Error("Missing i32.const 42");
});

test("Float variable declaration", `x# = 3.14`, (ast, wat) => {
  if (ast.statements[0].value.type !== "FloatLiteral") {
    throw new Error("Expected FloatLiteral");
  }
  if (!wat.includes("f32.const")) throw new Error("Missing f32.const");
});

test("String variable declaration", `x$ = "hello"`, (ast, wat) => {
  if (ast.statements[0].value.type !== "StringLiteral") {
    throw new Error("Expected StringLiteral");
  }
});

test("Variable assignment", `x% = 10\nx% = 20`, (ast, wat) => {
  if (ast.statements.length !== 2) throw new Error("Expected 2 statements");
});

// ============ ARITHMETIC TESTS ============
console.log("--- Arithmetic ---");

test("Addition", `Print 1 + 2`, (ast, wat) => {
  if (!wat.includes("i32.add")) throw new Error("Missing i32.add");
});

test("Subtraction", `Print 5 - 3`, (ast, wat) => {
  if (!wat.includes("i32.sub")) throw new Error("Missing i32.sub");
});

test("Multiplication", `Print 4 * 3`, (ast, wat) => {
  if (!wat.includes("i32.mul")) throw new Error("Missing i32.mul");
});

test("Division", `Print 10 / 2`, (ast, wat) => {
  if (!wat.includes("i32.div_s")) throw new Error("Missing i32.div_s");
});

test("Modulo", `Print 10 Mod 3`, (ast, wat) => {
  if (!wat.includes("i32.rem_s")) throw new Error("Missing i32.rem_s");
});

test("Mixed operations", `Print 1 + 2 * 3 - 4`, (ast, wat) => {
  // The Print argument should be a BinaryOp
  if (ast.statements[0].expression.type !== "FunctionCall") {
    throw new Error("Expected FunctionCall");
  }
  if (ast.statements[0].expression.arguments[0].type !== "BinaryOp") {
    throw new Error("Expected BinaryOp in Print argument");
  }
});

// ============ COMPARISON TESTS ============
console.log("--- Comparisons ---");

test("Equality", `If x = y Then Print 1 EndIf`, (ast, wat) => {
  if (!wat.includes("i32.eq")) throw new Error("Missing i32.eq");
});

test("Inequality", `If x <> y Then Print 1 EndIf`, (ast, wat) => {
  if (!wat.includes("i32.ne")) throw new Error("Missing i32.ne");
});

test("Less than", `If x < y Then Print 1 EndIf`, (ast, wat) => {
  if (!wat.includes("i32.lt_s")) throw new Error("Missing i32.lt_s");
});

test("Less or equal", `If x <= y Then Print 1 EndIf`, (ast, wat) => {
  if (!wat.includes("i32.le_s")) throw new Error("Missing i32.le_s");
});

test("Greater than", `If x > y Then Print 1 EndIf`, (ast, wat) => {
  if (!wat.includes("i32.gt_s")) throw new Error("Missing i32.gt_s");
});

test("Greater or equal", `If x >= y Then Print 1 EndIf`, (ast, wat) => {
  if (!wat.includes("i32.ge_s")) throw new Error("Missing i32.ge_s");
});

// ============ LOGICAL TESTS ============
console.log("--- Logical Operations ---");

test("And operator", `If x = 1 And y = 2 Then Print 1 EndIf`, (ast, wat) => {
  if (!wat.includes("i32.and")) throw new Error("Missing i32.and");
});

test("Or operator", `If x = 1 Or y = 2 Then Print 1 EndIf`, (ast, wat) => {
  if (!wat.includes("i32.or")) throw new Error("Missing i32.or");
});

test("Not operator", `If Not x = 1 Then Print 1 EndIf`, (ast, wat) => {
  if (!wat.includes("i32.eqz")) throw new Error("Missing i32.eqz");
});

// ============ IF/THEN/ELSE TESTS ============
console.log("--- If/Then/Else ---");

test("Simple If", `If x = 1 Then Print 1 EndIf`, (ast, wat) => {
  if (ast.statements[0].type !== "IfStatement") {
    throw new Error("Expected IfStatement");
  }
  if (!wat.includes("(if")) throw new Error("Missing (if");
});

test("If/Else", `If x = 1 Then Print 1 Else Print 0 EndIf`, (ast, wat) => {
  if (!wat.includes("(if")) throw new Error("Missing (if");
  if (!wat.includes("(else")) throw new Error("Missing (else");
});

test(
  "If/ElseIf/Else",
  `If x = 1 Then Print "A" ElseIf x = 2 Then Print "B" Else Print "C" EndIf`,
  (ast, wat) => {
    if (ast.statements[0].elseIfBranches.length !== 1) {
      throw new Error(
        "Expected 1 ElseIf",
      );
    }
  },
);

// ============ WHILE LOOP TESTS ============
console.log("--- While Loops ---");

test("While loop", `While x < 10\n  x = x + 1\nWend`, (ast, wat) => {
  if (ast.statements[0].type !== "WhileLoop") {
    throw new Error("Expected WhileLoop");
  }
  if (!wat.includes("(loop")) throw new Error("Missing loop");
  if (!wat.includes("(block")) throw new Error("Missing block");
});

// ============ REPEAT/UNTIL TESTS ============
console.log("--- Repeat/Until ---");

test("Repeat Until", `Repeat\n  x = x + 1\nUntil x = 10`, (ast, wat) => {
  if (ast.statements[0].type !== "RepeatStatement") {
    throw new Error("Expected RepeatStatement");
  }
  if (!ast.statements[0].condition) throw new Error("Expected condition");
});

test("Repeat Forever", `Repeat\n  x = x + 1\nForever`, (ast, wat) => {
  if (!wat.includes("(loop")) throw new Error("Missing loop");
});

// ============ FUNCTION TESTS ============
console.log("--- Functions ---");

test(
  "Function declaration",
  `Function Add%(a%, b%)\n  Return a + b\nEnd Function`,
  (ast, wat) => {
    if (ast.statements[0].type !== "FunctionDeclaration") {
      throw new Error(
        "Expected FunctionDeclaration",
      );
    }
    if (ast.statements[0].name !== "Add%") {
      throw new Error(
        "Expected function name Add%",
      );
    }
  },
);

test(
  "Function with return",
  `Function Double%(x%)\n  Return x * 2\nEnd Function`,
  (ast, wat) => {
    if (!wat.includes("local.get $x")) {
      throw new Error(
        "Missing local.get for parameter",
      );
    }
  },
);

test("Function call", `Print Add(1, 2)`, (ast, wat) => {
  if (!wat.includes("call $Add")) throw new Error("Missing call to Add");
});

// ============ FOR LOOP TESTS ============
console.log("--- For Loops ---");

test("For loop basic", `For i% = 1 To 5\n  Print i\nNext`, (ast, wat) => {
  if (ast.statements[0].type !== "ForLoop") throw new Error("Expected ForLoop");
  if (ast.statements[0].variable !== "i%") {
    throw new Error("Expected variable i%");
  }
});

test(
  "For loop with step",
  `For i% = 1 To 10 Step 2\n  Print i\nNext`,
  (ast, wat) => {
    if (!ast.statements[0].step) throw new Error("Expected step value");
  },
);

// ============ PRINT STATEMENT TESTS ============
console.log("--- Print Statements ---");

test("Print integer", `Print 42`, (ast, wat) => {
  if (!wat.includes("call $print")) throw new Error("Missing call $print");
});

test("Print string", `Print "Hello"`, (ast, wat) => {
  if (!wat.includes("call $printString")) {
    throw new Error("Missing call $printString");
  }
});

test("Print variable", `x% = 5\nPrint x`, (ast, wat) => {
  if (!wat.includes("local.get $x")) throw new Error("Missing local.get $x");
});

// ============ DATA/READ/RESTORE TESTS ============
console.log("--- Data/Read ---");

test("Data statement", `Data 1, 2, 3`, (ast, wat) => {
  if (ast.statements[0].type !== "DataStatement") {
    throw new Error("Expected DataStatement");
  }
});

// ============ INCLUDE TESTS ============
console.log("--- Include ---");

test("Include file", `Include "file.bb"`, (ast, wat) => {
  // Include is typically handled by preprocessor
});

// ============ COMPILE AND WAT VALIDATION ============
console.log("--- WAT Validation ---");

test(
  "Complete program compiles",
  `
x% = 5
y% = 10
z% = x + y
Print z
`,
  (ast, wat) => {
    if (!wat.includes("(module")) throw new Error("Missing module");
    if (!wat.includes("(func")) throw new Error("Missing func");
    if (!wat.includes("(memory")) throw new Error("Missing memory");
  },
);

test("WAT contains data section for strings", `Print "hello"`, (ast, wat) => {
  if (!wat.includes("(data")) {
    throw new Error("Missing data section for strings");
  }
});

// ============ SUMMARY ============
console.log("\n=== Test Summary ===");
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`Total: ${passed + failed}`);

if (failed > 0) {
  process.exit(1);
}
