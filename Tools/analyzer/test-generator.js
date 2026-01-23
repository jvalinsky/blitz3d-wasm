import { writeFileSync, existsSync, readFileSync, mkdirSync, readDirSync } from "node:fs";
import { join, basename } from "node:path";

export class LLMTestGenerator {
  constructor(outputDir = "/Users/jack/Software/scp_port/blitz3d-wasm/Tests/Generated") {
    this.outputDir = outputDir;
    this.testDir = "/Users/jack/Software/scp_port/blitz3d-wasm/Tests";
    this.ensureOutputDir();
  }

  ensureOutputDir() {
    if (!existsSync(this.outputDir)) {
      mkdirSync(this.outputDir, { recursive: true });
    }
  }

  generateStackImbalanceTest(errorDetails) {
    const testName = `test_stack_${Date.now()}`;

    const templates = {
      if_branch_mismatch: `
' Test: if/else branch stack mismatch
' Error: type mismatch at end of if/else branches

Function TestFunc()
    Local x = 0
    
    ' Both branches should leave stack in same state
    If True Then
        x = SomeFunction()  ' May return value
    Else
        x = 0
    End If
    
    Return x
End Function

Function SomeFunction()
    Return 42
End Function
`,
      function_call_drop: `
' Test: function call return value not dropped
' Error: function ends with values on stack

Function TestFunc()
    ' Call that returns value but result not used
    SomeFunction()
    
    ' Should be: Local result = SomeFunction() then drop or use result
End Function

Function SomeFunction()
    Return 42
End Function
`,
      nested_if_stack: `
' Test: nested if statements and stack state
' Error: stack not balanced in nested conditionals

Function TestFunc(cond1, cond2)
    Local result = 0
    
    If cond1 Then
        If cond2 Then
            result = 1
        Else
            result = 2
        End If
    Else
        result = 3
    End If
    
    Return result
End Function
`,
    };

    const template = templates[errorDetails.pattern] || templates.if_branch_mismatch;

    return this.writeTest(testName, template, errorDetails);
  }

  generateTypeMismatchTest(errorDetails) {
    const testName = `test_type_${Date.now()}`;

    const templates = {
      argument_order: `
' Test: function argument type/order mismatch
' Error: type mismatch in call

Function TestFunc()
    Local a:Float = 1.0
    Local b:Float = 2.0
    
    ' Type conversion may be needed
    result = Calculate(a, b)
End Function

Function Calculate(x, y)
    Return x + y
End Function
`,
      literal_type: `
' Test: numeric literal type issues
' Error: type mismatch with literals

Function TestFunc()
    ' Integer vs float literals
    Local a = 42     ' i32
    Local b = 42.0   ' f32
    
    ' May need explicit type conversion
    result = AddFloats(Float(a), b)
End Function

Function AddFloats(x, y)
    Return x + y
End Function
`,
      return_type: `
' Test: function return type mismatch
' Error: return type doesn't match declaration

Function TestFunc():Int
    Return 3.14  ' Float literal where Int expected
End Function
`,
    };

    const template = templates[errorDetails.pattern] || templates.argument_order;

    return this.writeTest(testName, template, errorDetails);
  }

  generateControlFlowTest(errorDetails) {
    const testName = `test_cf_${Date.now()}`;

    const templates = {
      branch_depth: `
' Test: branch depth validation
' Error: invalid branch depth

Function TestFunc()
    Local result = 0
    
    ' Deeply nested control flow
    For i = 1 To 10
        If i > 5 Then
            For j = 1 To 5
                If j > 2 Then
                    ' Complex branching - ensure depths correct
                    Exit
                End If
            End For
        End If
    End For
    
    Return result
End Function
`,
      block_structure: `
' Test: block structure validation
' Error: unbalanced blocks

Function TestFunc(cond)
    Local result = 0
    
    If cond Then
        result = 1
    ' Missing End If - this is a parse error, not compile
    End If
    
    Return result
End Function
`,
    };

    const template = templates[errorDetails.pattern] || templates.branch_depth;

    return this.writeTest(testName, template, errorDetails);
  }

  generateFileTest(originalFilePath, analysis) {
    const fileName = basename(originalFilePath, ".bb");
    const testName = `test_${fileName}_${Date.now()}`;

    const testContent = `' Generated test for ${fileName}
' Based on analysis: ${JSON.stringify(analysis.summary, null, 2)}

' Focus areas:
' - Stack balance: ${analysis.summary.stackValid ? "OK" : "ISSUES"}
' - Type consistency: ${analysis.summary.typeValid ? "OK" : "ISSUES"}
' - Control flow: ${analysis.summary.controlFlowValid ? "OK" : "ISSUES"}

Function TestGenerated()
    ' Placeholder for ${fileName} test
    Return 0
End Function
`;

    return this.writeTest(testName, testContent, { originalPath: originalFilePath });
  }

  generateComparisonTest(beforeWasm, afterWasm, description) {
    const testName = `test_compare_${Date.now()}`;

    const content = `' Generated comparison test
' Before: ${beforeWasm}
' After: ${afterWasm}
' Description: ${description}

' This test file documents the comparison between two compilations
' Run: deno run -A ../analyzer/cli.js -c ${beforeWasm} ${afterWasm}

Function TestPlaceholder()
    Return 0
End Function
`;

    return this.writeTest(testName, content, { before: beforeWasm, after: afterWasm });
  }

  writeTest(name, content, metadata = {}) {
    const filePath = `${this.outputDir}/${name}.bb`;

    try {
      writeFileSync(filePath, content);
      return {
        success: true,
        testFile: filePath,
        name,
        metadata,
      };
    } catch (e) {
      return {
        success: false,
        error: e.message,
        name,
      };
    }
  }

  generateTestRunner() {
    const testFiles = [];

    if (existsSync(this.outputDir)) {
      const files = readDirSync(this.outputDir);
      testFiles.push(...files.filter((f) => f.endsWith(".bb")));
    }

    const runnerContent = `' Auto-generated test runner
' Run: swift run blitz3d-wasm run_tests.bb -o run_tests.wasm

Print "Running generated tests..."
Print "Total tests: " + testFiles.length

For i = 0 To testFiles.length - 1
    Print "Test " + i + ": " + testFiles[i]
Next

Print "Done."
End
`;

    const runnerPath = `${this.outputDir}/run_tests.bb`;
    writeFileSync(runnerPath, runnerContent);

    return {
      runnerFile: runnerPath,
      testCount: testFiles.length,
      tests: testFiles,
    };
  }

  listTests() {
    const tests = [];

    if (existsSync(this.outputDir)) {
      const files = readDirSync(this.outputDir);
      for (const file of files) {
        if (file.endsWith(".bb")) {
          const content = readFileSync(`${this.outputDir}/${file}`, "utf-8");
          tests.push({
            name: file,
            path: `${this.outputDir}/${file}`,
            lines: content.split("\n").length,
          });
        }
      }
    }

    return tests;
  }
}

export function createStackTest(pattern, details = {}) {
  const generator = new LLMTestGenerator();
  return generator.generateStackImbalanceTest({ pattern, ...details });
}

export function createTypeTest(pattern, details = {}) {
  const generator = new LLMTestGenerator();
  return generator.generateTypeMismatchTest({ pattern, ...details });
}

export function createControlFlowTest(pattern, details = {}) {
  const generator = new LLMTestGenerator();
  return generator.generateControlFlowTest({ pattern, ...details });
}

export function createFileTest(filePath, analysis) {
  const generator = new LLMTestGenerator();
  return generator.generateFileTest(filePath, analysis);
}

export function listGeneratedTests() {
  const generator = new LLMTestGenerator();
  return generator.listTests();
}
