#!/usr/bin/env -S deno run --allow-read

/**
 * Test all example programs through the compiler
 * Ensures they compile without crashing the compiler
 */

import { Lexer, Parser, CodeGenerator } from './src/compiler/all.ts';

const examples = {
  hello: `; Hello World
Print "Hello from Blitz3D!"`,
  
  math: `; Math Operations
x% = 10
y% = 5
Print x + y
Print x - y
Print x * y`,
  
  loops: `; For loop
For i% = 1 To 5
    Print i
Next`,
  
  functions: `; Functions
Function Add%(a%, b%)
    Return a + b
End Function

Print Add(5, 10)`,
  
  types: `; Custom Types
Type Enemy
    Field Health%
    Field Name$
End Type

Print "Type declared!"`,
  
  arrays: `; Arrays with Dim
Dim arr%(10)
arr(0) = 42
arr(1) = 99
arr(2) = arr(0) + arr(1)
Print arr(0)
Print arr(1)
Print arr(2)`,
  
  strings: `; String Printing
Print "Hello World"
Print "Strings work!"`,
  
  conditionals: `; If/ElseIf/Else + Select/Case
x% = 85
If x >= 90 Then
    Print "A"
ElseIf x >= 80 Then
    Print "B"
Else
    Print "F"
EndIf

Select x
    Case 85
        Print "Eighty-five!"
    Case 90
        Print "Ninety!"
    Default
        Print "Something else"
End Select`
};

interface TestResult {
  name: string;
  success: boolean;
  error?: string;
  stats?: {
    tokens: number;
    lines: number;
    watSize: number;
    compileTime: number;
  };
}

function testExample(name: string, source: string): TestResult {
  const startTime = performance.now();
  
  try {
    // Lexer
    const lexer = new Lexer(source);
    const { tokens, errors: lexerErrors } = lexer.tokenize();
    
    if (lexerErrors.length > 0) {
      return {
        name,
        success: false,
        error: `Lexer errors: ${lexerErrors.map(e => e.message).join(', ')}`
      };
    }
    
    // Parser
    const parser = new Parser(source);
    const ast = parser.parse();
    
    if (parser.errors.length > 0) {
      return {
        name,
        success: false,
        error: `Parser errors: ${parser.errors.join(', ')}`
      };
    }
    
    // CodeGen
    const codegen = new CodeGenerator();
    const wat = codegen.generate(ast);
    
    const endTime = performance.now();
    const compileTime = endTime - startTime;
    
    return {
      name,
      success: true,
      stats: {
        tokens: tokens.length - 1, // Exclude EOF
        lines: source.split('\n').length,
        watSize: wat.length,
        compileTime: Math.round(compileTime * 100) / 100
      }
    };
  } catch (error) {
    const endTime = performance.now();
    const compileTime = endTime - startTime;
    
    return {
      name,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      stats: {
        tokens: 0,
        lines: source.split('\n').length,
        watSize: 0,
        compileTime: Math.round(compileTime * 100) / 100
      }
    };
  }
}

// Run tests
console.log('Testing Blitz3D Web IDE Compiler\n');
console.log('='.repeat(60));

const results: TestResult[] = [];

for (const [name, source] of Object.entries(examples)) {
  const result = testExample(name, source);
  results.push(result);
  
  const status = result.success ? '✅' : '❌';
  console.log(`\n${status} ${name.padEnd(15)} (${result.stats?.compileTime || 0}ms)`);
  
  if (result.success && result.stats) {
    console.log(`   Tokens: ${result.stats.tokens}, Lines: ${result.stats.lines}, WAT: ${result.stats.watSize} bytes`);
  } else if (result.error) {
    console.log(`   Error: ${result.error.substring(0, 100)}${result.error.length > 100 ? '...' : ''}`);
  }
}

// Summary
console.log('\n' + '='.repeat(60));
const passed = results.filter(r => r.success).length;
const failed = results.filter(r => !r.success).length;
const total = results.length;
const passRate = ((passed / total) * 100).toFixed(1);

console.log(`\nSummary: ${passed}/${total} passed (${passRate}%)`);

if (failed > 0) {
  console.log(`\nFailed examples:`);
  results.filter(r => !r.success).forEach(r => {
    console.log(`  - ${r.name}: ${r.error}`);
  });
  Deno.exit(1);
} else {
  console.log('\n🎉 All examples compiled successfully!');
  Deno.exit(0);
}
