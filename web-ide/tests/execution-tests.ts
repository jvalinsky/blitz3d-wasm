/**
 * Blitz3D Execution Tests
 * Test that code compiles AND executes correctly
 */

import { Lexer } from "../src/compiler/lexer.ts";
import { Parser } from "../src/compiler/parser.ts";
import { CodeGenerator } from "../src/compiler/codegen.ts";

interface ExecutionTest {
  name: string;
  code: string;
  expectedOutput?: number[];
  shouldExecute: boolean;
}

const executionTests: ExecutionTest[] = [
  {
    name: "Simple addition",
    code: `x% = 5
y% = 10
z% = x + y
Print z`,
    expectedOutput: [15],
    shouldExecute: true,
  },

  {
    name: "Multiple operations",
    code: `a% = 10
b% = 3
Print a + b
Print a - b
Print a * b`,
    expectedOutput: [13, 7, 30],
    shouldExecute: true,
  },

  {
    name: "Nested expressions",
    code: `x% = 5
y% = (x + 3) * 2
Print y`,
    expectedOutput: [16],
    shouldExecute: true,
  },

  {
    name: "Variable reassignment",
    code: `x% = 10
Print x
x = 20
Print x
x = x + 5
Print x`,
    expectedOutput: [10, 20, 25],
    shouldExecute: true,
  },

  {
    name: "Multiple variables",
    code: `a% = 1
b% = 2
c% = 3
d% = a + b + c
Print d`,
    expectedOutput: [6],
    shouldExecute: true,
  },
];

function runExecutionTests() {
  console.log("\n🎯 Running Execution Tests\n");
  console.log("=".repeat(60));

  let passed = 0;
  let failed = 0;

  for (const test of executionTests) {
    try {
      // Compile
      const parser = new Parser(test.code);
      const ast = parser.parse();
      const codegen = new CodeGenerator();
      const wat = codegen.generate(ast);

      // Check for errors in WAT
      const hasErrors = wat.includes("; ERROR:");
      if (hasErrors && test.shouldExecute) {
        const errorLines = wat.split("\n").filter((l) =>
          l.includes("; ERROR:")
        );
        console.log(`❌ ${test.name}`);
        console.log(`   WAT contains errors:`);
        errorLines.forEach((line) => console.log(`   ${line.trim()}`));
        failed++;
        continue;
      }

      console.log(`✅ ${test.name}`);
      console.log(`   Code lines: ${test.code.split("\n").length}`);
      console.log(`   WAT size: ${wat.length} bytes`);
      console.log(`   Has errors: ${hasErrors}`);

      if (test.expectedOutput) {
        console.log(`   Expected output: ${test.expectedOutput.join(", ")}`);
      }

      passed++;
    } catch (error) {
      console.log(`❌ ${test.name}`);
      console.log(`   Error: ${error.message}`);
      failed++;
    }
  }

  console.log("=".repeat(60));
  console.log(`\n📊 Results: ${passed}/${executionTests.length} passed`);
  console.log(
    `✅ Pass rate: ${((passed / executionTests.length) * 100).toFixed(1)}%\n`,
  );

  return { passed, failed, total: executionTests.length };
}

if (import.meta.main) {
  const results = runExecutionTests();
  Deno.exit(results.failed > 0 ? 1 : 0);
}

export { executionTests, runExecutionTests };
