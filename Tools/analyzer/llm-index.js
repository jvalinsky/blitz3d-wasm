/**
 * LLM Tools Index for Blitz3D WASM Compiler
 *
 * Export all LLM-optimized tools for easy importing.
 */

export { analyzeForLLM, LLMWASMAnalyzer, quickCheck } from "./llm-analyzer.js";
export { getSessionContext, LLMSessionHelper } from "./session-helper.js";
export {
  createControlFlowTest,
  createFileTest,
  createStackTest,
  createTypeTest,
  listGeneratedTests,
  LLMTestGenerator,
} from "./test-generator.js";

/**
 * Quick reference for LLM agents working on this project
 */
export const LLM_QUICK_REFERENCE = {
  project: "Blitz3D WASM Compiler",

  compilation: {
    command: "swift run blitz3d-wasm <input.bb> -o <output.wasm>",
    watOutput: "swift run blitz3d-wasm <input.bb> --wat -o <output.wat>",
  },

  analysis: {
    basic: "node Tools/analyzer/cli.js <wasmfile>",
    detailed: "node Tools/analyzer/cli.js <wasmfile> -v",
    llmOptimized: "node Tools/analyzer/llm-analyzer.js <wasmfile>",
    llmCompact: "node Tools/analyzer/llm-compact.js <wasmfile>",
    compare: "node Tools/analyzer/compare-builds.js <before.wasm> <after.wasm>",
  },

  keyPaths: {
    compiler: "Sources/Compiler/CodeGen/",
    tests: "Tests/",
    examples: "Examples/",
    analyzer: "Tools/analyzer/",
    docs: "docs/",
  },

  commonErrors: [
    "type mismatch at end of if branch",
    "Stack underflow",
    "function ends with values on stack",
    "Invalid branch depth",
  ],

  skills: [
    "/analyze-wasm - Analyze WASM compilation output",
    "/debug-compiler-issue - Debug specific compilation errors",
    "/generate-fix - Create test cases and fix suggestions",
    "/compare-builds - Compare before/after compilation outputs",
  ],
};

/**
 * Example usage for LLM agents
 */
export const USAGE_EXAMPLES = {
  analyzeCompilation: `
const { LLMWASMAnalyzer } = require('./llm-analyzer');

const analyzer = new LLMWASMAnalyzer('/path/to/output.wasm');
await analyzer.analyze();

const report = analyzer.getStructuredReport();
// Use report.summary, report.issues, report.functions, report.optimization
`,

  compareBuilds: `
const { BuildComparator } = require('./compare-builds');

const comparator = new BuildComparator();
const result = await comparator.compare('before.wasm', 'after.wasm');
// Use result.verdict, result.improvements, result.regressions
`,

  generateTest: `
const { createStackTest } = require('./test-generator');

const test = createStackTest('if_branch_mismatch', { 
  description: 'Testing if/else stack balance' 
});
// test.testFile contains path to generated test
`,
};
