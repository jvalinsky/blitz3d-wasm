/**
 * WASM Analyzer for Blitz3D Compiler
 *
 * Main entry point - re-exports all modules for convenient usage.
 */

// Core analysis
export { analyzeFile, analyzeWASM, WASMAnalyzer } from "./core.js";

// Visualization
export {
  visualizeAnalysis,
  visualizeFile,
  WASMVisualizer,
} from "./visualize.js";

// Reporting
export { generateReport, ReportGenerator, saveReport } from "./report.js";

// CLI
export { AnalyzerCLI } from "./cli.js";

import { AnalyzerCLI } from "./cli.js";

// Run CLI if executed directly
if (process.argv[1] && process.argv[1].endsWith("analyzer/index.js")) {
  new AnalyzerCLI().run();
}
