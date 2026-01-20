/**
 * WASM Analyzer for Blitz3D Compiler
 * 
 * Main entry point - re-exports all modules for convenient usage.
 */

// Core analysis
export { WASMAnalyzer, analyzeWASM, analyzeFile } from './core.js';

// Visualization
export { WASMVisualizer, visualizeAnalysis, visualizeFile } from './visualize.js';

// Reporting
export { ReportGenerator, generateReport, saveReport } from './report.js';

// CLI
export { AnalyzerCLI } from './cli.js';

import { AnalyzerCLI } from './cli.js';

// Run CLI if executed directly
if (process.argv[1] && process.argv[1].endsWith('analyzer/index.js')) {
  new AnalyzerCLI().run();
}
