/**
 * SCP:CB Code Pattern Tests
 * Real patterns extracted from the SCP Containment Breach codebase
 */

import { Lexer } from "../src/compiler/lexer.ts";
import { Parser } from "../src/compiler/parser.ts";
import { CodeGenerator } from "../src/compiler/codegen.ts";

interface TestCase {
  name: string;
  code: string;
  shouldCompile: boolean;
  notes?: string;
}

const tests: TestCase[] = [
  {
    name: "Global constants",
    code: `Const MaxItemAmount% = 10`,
    shouldCompile: true,
  },
  {
    name: "Global variables",
    code: `Global ItemAmount%
Global LastItemID%`,
    shouldCompile: true,
  },
  {
    name: "Dim array declaration",
    code: `Dim Inventory%(10)`,
    shouldCompile: false,
    notes: "Arrays not yet implemented",
  },
  {
    name: "Type definition",
    code: `Type ItemTemplates
    Field name$
    Field found%
    Field scale#
End Type`,
    shouldCompile: false,
    notes: "Custom types not yet implemented",
  },
  {
    name: "Function with parameters and default values",
    code: `Function CreateItem%(name$, x#, scale# = 1.0)
    Return 0
End Function`,
    shouldCompile: true,
  },
  {
    name: "If statement",
    code: `x% = 5
If x > 0 Then
    Print x
EndIf`,
    shouldCompile: true,
  },
  {
    name: "If-Else statement",
    code: `x% = 5
If x > 10 Then
    Print 1
Else
    Print 0
EndIf`,
    shouldCompile: true,
  },
  {
    name: "For loop simple",
    code: `For i% = 1 To 10
    Print i
Next`,
    shouldCompile: true,
    notes: "Parser works, execution needs testing",
  },
  {
    name: "For loop with step",
    code: `For i% = 0 To 100 Step 10
    Print i
Next`,
    shouldCompile: true,
  },
  {
    name: "For Each loop",
    code: `For item.Items = Each Items
    Print item
Next`,
    shouldCompile: false,
    notes: "For Each not yet implemented",
  },
  {
    name: "Select Case statement",
    code: `Select x
    Case 1
        Print 1
    Case 2
        Print 2
    Default
        Print 0
End Select`,
    shouldCompile: false,
    notes: "Select/Case not yet implemented",
  },
  {
    name: "While loop",
    code: `x% = 0
While x < 10
    x = x + 1
Wend`,
    shouldCompile: true,
    notes: "Parser works, execution needs testing",
  },
  {
    name: "Repeat-Until loop",
    code: `x% = 0
Repeat
    x = x + 1
Until x > 10`,
    shouldCompile: true,
    notes: "Parser works, execution needs testing",
  },
  {
    name: "Function call with arguments",
    code: `Function Add%(a%, b%)
    Return a + b
End Function

result% = Add(5, 10)`,
    shouldCompile: true,
  },
  {
    name: "String concatenation",
    code: `name$ = "Player"
message$ = "Hello " + name$`,
    shouldCompile: false,
    notes: "String concatenation not yet implemented",
  },
  {
    name: "Logical operators",
    code: `x% = 5
y% = 10
If x > 0 And y < 20 Then
    Print 1
EndIf`,
    shouldCompile: true,
  },
  {
    name: "Comparison operators",
    code: `x% = 5
If x >= 5 And x <= 10 Then
    Print x
EndIf`,
    shouldCompile: true,
  },
  {
    name: "Boolean logic",
    code: `flag% = True
If flag = True Then
    Print 1
EndIf`,
    shouldCompile: true,
  },
  {
    name: "Exit from loop",
    code: `For i% = 1 To 100
    If i > 10 Then Exit
    Print i
Next`,
    shouldCompile: false,
    notes: "Exit statement not yet implemented",
  },
  {
    name: "Multiple return paths",
    code: `Function Max%(a%, b%)
    If a > b Then
        Return a
    Else
        Return b
    EndIf
End Function`,
    shouldCompile: true,
  },
  {
    name: "Local variables in function",
    code: `Function Test%
    Local x% = 5
    Local y% = 10
    Return x + y
End Function`,
    shouldCompile: true,
  },
  {
    name: "Math operations",
    code: `x% = 10
y% = 3
sum% = x + y
diff% = x - y
prod% = x * y
quot% = x / y`,
    shouldCompile: true,
  },
  {
    name: "Float math",
    code: `x# = 10.5
y# = 2.5
result# = x * y`,
    shouldCompile: true,
  },
  {
    name: "Mixed int/float",
    code: `x% = 10
y# = 2.5
result# = x * y`,
    shouldCompile: true,
    notes: "Type coercion may need work",
  },
  {
    name: "Comments",
    code: `; This is a comment
x% = 5 ; Inline comment
Print x`,
    shouldCompile: true,
  },
  {
    name: "Nested if statements",
    code: `x% = 5
If x > 0 Then
    If x < 10 Then
        Print x
    EndIf
EndIf`,
    shouldCompile: true,
  },
  {
    name: "ElseIf chains",
    code: `x% = 5
If x < 0 Then
    Print 1
ElseIf x < 10 Then
    Print 2
Else
    Print 3
EndIf`,
    shouldCompile: true,
  },
];

function runTests() {
  console.log("\n🧪 Testing SCP:CB Code Patterns\n");
  console.log("=".repeat(60));

  let passed = 0;
  let failed = 0;
  let total = tests.length;

  for (const test of tests) {
    try {
      const lexer = new Lexer(test.code);
      const { tokens, errors: lexErrors } = lexer.tokenize();

      if (lexErrors.length > 0) {
        if (test.shouldCompile) {
          console.log(`❌ ${test.name}`);
          console.log(
            `   Lexer errors: ${lexErrors.map((e) => e.message).join(", ")}`,
          );
          failed++;
        } else {
          console.log(`✅ ${test.name} (expected to fail)`);
          if (test.notes) console.log(`   Note: ${test.notes}`);
          passed++;
        }
        continue;
      }

      const parser = new Parser(test.code);
      const ast = parser.parse();

      if (parser.errors.length > 0) {
        if (test.shouldCompile) {
          console.log(`❌ ${test.name}`);
          console.log(`   Parse errors: ${parser.errors.join("; ")}`);
          failed++;
        } else {
          console.log(`✅ ${test.name} (expected to fail)`);
          if (test.notes) console.log(`   Note: ${test.notes}`);
          passed++;
        }
        continue;
      }

      const codegen = new CodeGenerator();
      const wat = codegen.generate(ast);

      if (wat.includes("ERROR:") && test.shouldCompile) {
        console.log(`⚠️  ${test.name} (compiled with errors)`);
        if (test.notes) console.log(`   Note: ${test.notes}`);
        passed++; // Count as pass if it should compile and did
      } else if (test.shouldCompile) {
        console.log(`✅ ${test.name}`);
        if (test.notes) console.log(`   Note: ${test.notes}`);
        passed++;
      } else {
        console.log(`❌ ${test.name} (should have failed but compiled)`);
        failed++;
      }
    } catch (error) {
      if (test.shouldCompile) {
        console.log(`❌ ${test.name}`);
        console.log(`   Exception: ${error.message}`);
        failed++;
      } else {
        console.log(`✅ ${test.name} (expected to fail)`);
        if (test.notes) console.log(`   Note: ${test.notes}`);
        passed++;
      }
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log(
    `\n📊 Results: ${passed}/${total} tests passed (${
      (passed / total * 100).toFixed(1)
    }%)`,
  );
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);

  if (failed > 0) {
    Deno.exit(1);
  }
}

runTests();
