/**
 * Blitz3D Language Feature Tests
 * Tests extracted from SCPCB and core language features
 */

import { Lexer } from "../src/compiler/lexer.ts";
import { Parser } from "../src/compiler/parser.ts";
import { CodeGenerator } from "../src/compiler/codegen.ts";

interface TestCase {
  name: string;
  code: string;
  shouldCompile: boolean;
  expectedTokens?: number;
  expectedStatements?: number;
}

const tests: TestCase[] = [
  // Basic variables and math
  {
    name: "Basic integer math",
    code: `x% = 5
y% = 10
z% = x + y`,
    shouldCompile: true,
    expectedTokens: 14,
  },

  {
    name: "Float variables",
    code: `x# = 3.14
y# = 2.5
result# = x * y`,
    shouldCompile: true,
  },

  {
    name: "String variables",
    code: `name$ = "Test"
msg$ = "Hello"`,
    shouldCompile: true,
  },

  // Functions (from SCPCB pattern)
  {
    name: "Function with return",
    code: `Function Add%(a%, b%)
    Return a + b
End Function`,
    shouldCompile: true,
  },

  {
    name: "Function call",
    code: `Function Add%(a%, b%)
    Return a + b
End Function

result% = Add(5, 10)`,
    shouldCompile: true,
  },

  // Conditionals
  {
    name: "If statement",
    code: `x% = 10
If x > 5 Then
    Print x
EndIf`,
    shouldCompile: true,
  },

  {
    name: "If ElseIf Else",
    code: `score% = 85
If score >= 90 Then
    Print "A"
ElseIf score >= 80 Then
    Print "B"
Else
    Print "C"
EndIf`,
    shouldCompile: true,
  },

  // Loops
  {
    name: "For loop",
    code: `For i% = 1 To 10
    Print i
Next`,
    shouldCompile: true,
  },

  {
    name: "For loop with Step",
    code: `For i% = 0 To 100 Step 10
    Print i
Next i`,
    shouldCompile: true,
  },

  {
    name: "While loop",
    code: `x% = 0
While x < 5
    Print x
    x = x + 1
Wend`,
    shouldCompile: true,
  },

  {
    name: "Repeat Until",
    code: `x% = 0
Repeat
    Print x
    x = x + 1
Until x >= 5`,
    shouldCompile: true,
  },

  // Select Case (from SCPCB)
  {
    name: "Select Case",
    code: `value% = 2
Select value
    Case 1
        Print "One"
    Case 2
        Print "Two"
    Default
        Print "Other"
End Select`,
    shouldCompile: true,
  },

  // Types (from SCPCB Difficulty.bb)
  {
    name: "Type definition",
    code: `Type Player
    Field health%
    Field stamina%
    Field name$
End Type`,
    shouldCompile: true,
  },

  {
    name: "Type instantiation",
    code: `Type Player
    Field health%
End Type

p.Player = New Player
p\\health = 100`,
    shouldCompile: true,
  },

  // Arrays (from SCPCB)
  {
    name: "Dim array",
    code: `Dim values%(10)`,
    shouldCompile: true,
  },

  {
    name: "Array access",
    code: `Dim values%(10)
values(0) = 5
values(1) = 10`,
    shouldCompile: true,
  },

  // Constants (from SCPCB)
  {
    name: "Constants",
    code: `Const SAFE=0
Const EUCLID=1
Const KETER=2`,
    shouldCompile: true,
  },

  // Global/Local
  {
    name: "Global variables",
    code: `Global health%
Global score%
health = 100`,
    shouldCompile: true,
  },

  // Complex expressions
  {
    name: "Complex arithmetic",
    code: `x% = (10 + 5) * 2 - 3
y% = x / 4 + 1`,
    shouldCompile: true,
  },

  {
    name: "Boolean expressions",
    code: `a% = 5
b% = 10
result% = (a < b) And (a > 0)`,
    shouldCompile: true,
  },

  // Comments
  {
    name: "Comments",
    code: `; This is a comment
x% = 5 ; inline comment
; Another comment`,
    shouldCompile: true,
  },

  // Error cases
  {
    name: "Syntax error - missing End Function",
    code: `Function Test%()
    Return 5`,
    shouldCompile: false,
  },

  {
    name: "Syntax error - invalid operator",
    code: `x% = 5 @ 10`,
    shouldCompile: false,
  },
];

function runTests() {
  console.log("\n🧪 Running Blitz3D Language Tests\n");
  console.log("=".repeat(60));

  let passed = 0;
  let failed = 0;
  const failures: string[] = [];

  for (const test of tests) {
    try {
      // Lexer
      const lexer = new Lexer(test.code);
      const tokenResult = lexer.tokenize();

      if (tokenResult.errors.length > 0 && test.shouldCompile) {
        throw new Error(
          `Lexer errors: ${
            tokenResult.errors.map((e) => e.message).join(", ")
          }`,
        );
      }

      if (
        test.expectedTokens && tokenResult.tokens.length !== test.expectedTokens
      ) {
        console.log(
          `  ⚠️  Expected ${test.expectedTokens} tokens, got ${tokenResult.tokens.length}`,
        );
      }

      // Parser
      const parser = new Parser(test.code);
      const ast = parser.parse();

      if (
        test.expectedStatements &&
        ast.statements.length !== test.expectedStatements
      ) {
        console.log(
          `  ⚠️  Expected ${test.expectedStatements} statements, got ${ast.statements.length}`,
        );
      }

      // Code Generator
      const codegen = new CodeGenerator();
      const wat = codegen.generate(ast);

      if (!wat || wat.length === 0) {
        throw new Error("Generated empty WASM");
      }

      if (test.shouldCompile) {
        console.log(`✅ ${test.name}`);
        passed++;
      } else {
        console.log(`❌ ${test.name} - Expected to fail but compiled`);
        failed++;
        failures.push(test.name);
      }
    } catch (error) {
      if (!test.shouldCompile) {
        console.log(`✅ ${test.name} - Failed as expected`);
        passed++;
      } else {
        console.log(`❌ ${test.name}`);
        console.log(`   Error: ${error.message}`);
        failed++;
        failures.push(test.name);
      }
    }
  }

  console.log("=".repeat(60));
  console.log(
    `\n📊 Results: ${passed}/${tests.length} passed, ${failed} failed`,
  );
  console.log(`✅ Pass rate: ${((passed / tests.length) * 100).toFixed(1)}%\n`);

  if (failures.length > 0) {
    console.log("Failed tests:");
    failures.forEach((name) => console.log(`  - ${name}`));
  }

  return { passed, failed, total: tests.length };
}

// Run tests
if (import.meta.main) {
  const results = runTests();
  Deno.exit(results.failed > 0 ? 1 : 0);
}

export { runTests, tests };
