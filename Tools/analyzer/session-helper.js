/**
 * LLM Compilation Session Helper
 *
 * Provides structured context about the compiler state, recent changes,
 * and actionable tasks for the LLM to work on.
 */

import { existsSync, readdirSync, readFileSync } from "fs";
import path from "path";

export class LLMSessionHelper {
  constructor(projectRoot = "/Users/jack/Software/scp_port/blitz3d-wasm") {
    this.projectRoot = projectRoot;
    this.context = {};
  }

  /**
   * Get current compiler state summary
   */
  getCompilerState() {
    const state = {
      files: {},
      testResults: {},
      recentChanges: [],
      knownIssues: [],
    };

    // Check for recent compilation outputs
    const outputDir = `${this.projectRoot}/.build`;
    if (existsSync(outputDir)) {
      const files = readdirSync(outputDir).filter((f) => f.endsWith(".wasm"));
      state.recentBuilds = files.length;
    }

    // Check test status
    const testResults = this.getTestStatus();
    state.testStatus = testResults;

    return state;
  }

  /**
   * Get test execution status
   */
  getTestStatus() {
    const status = {
      lastRun: null,
      passing: 0,
      failing: 0,
      total: 0,
    };

    // Check for test scripts in package.json
    const pkgPath = `${this.projectRoot}/package.json`;
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
        status.scripts = Object.keys(pkg.scripts || {});
      } catch (e) {}
    }

    return status;
  }

  /**
   * Get file contents for LLM to read
   */
  getFileContents(relativePath) {
    const fullPath = path.join(this.projectRoot, relativePath);
    if (!existsSync(fullPath)) {
      return { error: "File not found", path: relativePath };
    }

    try {
      const content = readFileSync(fullPath, "utf-8");
      return {
        path: relativePath,
        exists: true,
        lines: content.split("\n").length,
        content: content,
      };
    } catch (e) {
      return { error: e.message, path: relativePath };
    }
  }

  /**
   * Get compiler source file structure
   */
  getCompilerStructure() {
    const structure = {
      sources: `${this.projectRoot}/Sources`,
      compiler: `${this.projectRoot}/Sources/Compiler`,
      runtime: `${this.projectRoot}/Sources/Runtime`,
      tools: `${this.projectRoot}/Tools`,
    };

    // Key files for understanding the compiler
    structure.keyFiles = {
      "CodeGenerator": `${structure.compiler}/CodeGen/CodeGenerator.swift`,
      "StatementGeneration":
        `${structure.compiler}/CodeGen/StatementGeneration.swift`,
      "ExpressionGeneration":
        `${structure.compiler}/CodeGen/ExpressionGeneration.swift`,
      "WASM": `${structure.compiler}/CodeGen/WASM.swift`,
    };

    return structure;
  }

  /**
   * Get recent compilation outputs for comparison
   */
  getRecentOutputs() {
    const outputs = [];
    const wasmDir = this.projectRoot;

    // Look for WASM files
    if (existsSync(wasmDir)) {
      const find = (dir, depth = 0) => {
        if (depth > 3) return;
        try {
          const items = readdirSync(dir);
          for (const item of items) {
            const fullPath = path.join(dir, item);
            if (item.endsWith(".wasm")) {
              const stats = readFileSync(fullPath);
              outputs.push({
                path: fullPath.replace(wasmDir + "/", ""),
                size: stats.length,
                modified: new Date(),
              });
            } else if (item !== "node_modules" && item !== ".build") {
              find(fullPath, depth + 1);
            }
          }
        } catch (e) {}
      };
      find(wasmDir);
    }

    return outputs.slice(0, 20); // Return most recent 20
  }

  /**
   * Generate a context summary for the LLM
   */
  getContextSummary() {
    return {
      project: "Blitz3D WASM Compiler",
      state: this.getCompilerState(),
      structure: this.getCompilerStructure(),
      recentOutputs: this.getRecentOutputs(),
      analyzer: `${this.projectRoot}/Tools/analyzer`,
    };
  }

  /**
   * Get actionable tasks based on current state
   */
  getActionableTasks() {
    const tasks = [];

    // Check if there are failing WASM files to analyze
    const recentOutputs = this.getRecentOutputs();
    if (recentOutputs.length > 0) {
      tasks.push({
        id: "analyze_recent",
        description: "Analyze recently compiled WASM files",
        action: "run LLM analyzer on recent outputs",
        targets: recentOutputs.slice(0, 5).map((o) => o.path),
      });
    }

    // Check for test files
    const testDir = `${this.projectRoot}/Tests`;
    if (existsSync(testDir)) {
      const testFiles = readdirSync(testDir).filter((f) => f.endsWith(".bb"));
      if (testFiles.length > 0) {
        tasks.push({
          id: "run_tests",
          description: "Run compilation tests",
          action: "Compile test files and analyze results",
          targets: testFiles,
        });
      }
    }

    // Check for example files
    const examplesDir = `${this.projectRoot}/Examples`;
    if (existsSync(examplesDir)) {
      tasks.push({
        id: "test_examples",
        description: "Test example compilation",
        action: "Compile examples and verify output",
        location: examplesDir,
      });
    }

    return {
      taskCount: tasks.length,
      tasks,
    };
  }

  /**
   * Quick reference for LLM
   */
  getQuickReference() {
    return {
      compiler: {
        entryPoint: "swift run blitz3d-wasm <input.bb> -o <output.wasm>",
        watOutput: "swift run blitz3d-wasm <input.bb> --wat -o <output.wat>",
        testScript: "./test_compile_scpcb.sh",
      },
      analyzer: {
        command: "node Tools/analyzer/cli.js <wasmfile>",
        verbose: "node cli.js <wasmfile> -v",
        watch: "node cli.js <wasmfile> -w",
        compare: "node cli.js -c <before.wasm> <after.wasm>",
      },
      keyDocs: [
        "docs/stack-balancing-research.md",
        "STACK_BALANCING_FINDINGS.md",
        "COMPILATION_STATUS.md",
        "Sources/Compiler/CodeGen/REFACTORING_PLAN.md",
      ],
      commonErrors: [
        "type mismatch at end of if branch",
        "Stack underflow",
        "function ends with values on stack",
        "Invalid branch depth",
      ],
    };
  }
}

export function getSessionContext() {
  const helper = new LLMSessionHelper();
  return {
    summary: helper.getContextSummary(),
    tasks: helper.getActionableTasks(),
    reference: helper.getQuickReference(),
  };
}
