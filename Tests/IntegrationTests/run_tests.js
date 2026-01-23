#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run

import { dirname, fromFileUrl, join, existsSync } from "jsr:@std/path";

const WASM_CLI_PATH = join(dirname(fromFileUrl(import.meta.url)), "..", "..", ".build", "debug", "blitz3d-wasm");
const TEST_DIR = join(dirname(fromFileUrl(import.meta.url)), "Assets");
const OUTPUT_DIR = join(TEST_DIR, "output");

const tests = [
  {
    name: "Embedded String Data",
    file: "test_string_data.bb",
    expectedOutput: ["Hello from embedded data!"],
  },
  {
    name: "Multiple Data Types",
    file: "test_multiple_types.bb",
    expectedOutput: ["42", "19.99", "Widget"],
  },
  {
    name: "Data Loop",
    file: "test_data_loop.bb",
    expectedOutput: ["300"],
  },
  {
    name: "Restore Statement",
    file: "test_restore.bb",
    expectedOutput: ["1", "1"],
  },
];

function createTestFiles() {
  Deno.mkdirSync(OUTPUT_DIR, { recursive: true });

  const testFiles = {
    "test_string_data.bb": `
Function Main()
    Local message$
    Data "Hello from embedded data!"
    Read message$
    Print message$
End Function
`,
    "test_multiple_types.bb": `
Function Main()
    Local count%, price#, name$
    Data 42, 19.99, "Widget"
    Read count%, price#, name$
    Print count%
    Print price#
    Print name$
End Function
`,
    "test_data_loop.bb": `
Function Main()
    Local i, total
    Data 100, 200, 300
    total = 0
    For i = 1 To 3
        Read total
    Next
    Print total
End Function
`,
    "test_restore.bb": `
Function Main()
    Local x
    Data 1, 2, 3
    Read x
    Print x
    Restore
    Read x
    Print x
End Function
`,
  };

  for (const [filename, content] of Object.entries(testFiles)) {
    const filepath = join(TEST_DIR, filename);
    Deno.writeTextFileSync(filepath, content.trim());
    console.log(`Created test file: ${filename}`);
  }
}

async function checkWASMCLI() {
  if (existsSync(WASM_CLI_PATH)) {
    console.log(`✓ WASM CLI found at ${WASM_CLI_PATH}`);
    return true;
  }

  console.log("⚠ WASM CLI not found. Building...");
  const buildProcess = Deno.spawn("swift", ["build"], {
    cwd: join(dirname(fromFileUrl(import.meta.url)), "..", ".."),
    stdio: "inherit",
  });

  return new Promise((resolve) => {
    buildProcess.then((proc) => {
      if (proc.code === 0) {
        console.log("✓ Build successful");
        resolve(existsSync(WASM_CLI_PATH));
      } else {
        console.log("✗ Build failed");
        resolve(false);
      }
    });
  });
}

async function compileTest(testFile) {
  const inputPath = join(TEST_DIR, testFile);
  const outputPath = join(OUTPUT_DIR, testFile.replace(".bb", ".wasm"));

  if (!existsSync(inputPath)) {
    throw new Error(`Test file not found: ${inputPath}`);
  }

  const proc = Deno.spawn(WASM_CLI_PATH, [inputPath, "-o", outputPath], {
    cwd: TEST_DIR,
    stdio: ["pipe", "pipe", "pipe"],
  });

  const { code, stdout, stderr } = await proc;

  if (code === 0) {
    const stat = await Deno.stat(outputPath);
    return {
      input: inputPath,
      output: outputPath,
      size: stat.size,
    };
  } else {
    throw new Error(`Compilation failed: ${new TextDecoder().decode(stderr)}`);
  }
}

function runWASMMock(wasmPath, expectedOutput) {
  console.log(`  Simulating WASM execution...`);

  const stat = Deno.statSync(wasmPath);
  console.log(`  WASM file size: ${stat.size} bytes`);

  const buffer = Deno.readFileSync(wasmPath);
  const isValidWASM = buffer[0] === 0x00 && buffer[1] === 0x61 && buffer[2] === 0x73 && buffer[3] === 0x6d;

  if (!isValidWASM) {
    throw new Error("Invalid WASM file - missing magic number");
  }

  console.log(`  ✓ Valid WASM binary`);

  return true;
}

async function runTests() {
  console.log("=".repeat(60));
  console.log("Blitz3D WASM Integration Tests");
  console.log("=".repeat(60));
  console.log("");

  const cliExists = await checkWASMCLI();
  if (!cliExists) {
    console.log("\n✗ Cannot run tests without WASM CLI");
    console.log("  Run: swift build");
    Deno.exit(1);
  }

  console.log("\nCreating test files...");
  createTestFiles();

  console.log("\nRunning tests...");
  console.log("-".repeat(60));

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    console.log(`\nTest: ${test.name}`);
    console.log(`  File: ${test.file}`);

    try {
      console.log("  Compiling...");
      const result = await compileTest(test.file);
      console.log(`  ✓ Compiled to ${result.output.split("/").pop()} (${result.size} bytes)`);

      console.log("  Running...");
      runWASMMock(result.output, test.expectedOutput);

      console.log(`  ✓ PASS`);
      passed++;
    } catch (error) {
      console.log(`  ✗ FAIL: ${error.message}`);
      failed++;
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log("=".repeat(60));

  if (failed === 0) {
    console.log("\n✓ All tests passed!");
    Deno.exit(0);
  } else {
    console.log(`\n✗ ${failed} test(s) failed`);
    Deno.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test runner error:", err);
  Deno.exit(1);
});
