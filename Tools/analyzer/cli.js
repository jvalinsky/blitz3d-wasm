#!/usr/bin/env node

/**
 * WASM Analyzer CLI
 * 
 * Usage:
 *   node cli.js <wasm-file>          # Analyze single file
 *   node cli.js <dir>                # Analyze all wasm files in directory
 *   node cli.js --watch <file>       # Watch file for changes
 *   node cli.js --compare <a> <b>    # Compare two wasm files
 *   node cli.js --batch <pattern>    # Analyze multiple files matching pattern
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync, watch } from 'fs';
import { WASMAnalyzer } from './index.js';
import { visualizeAnalysis } from './visualize.js';

class AnalyzerCLI {
  constructor() {
    this.args = process.argv.slice(2);
    this.options = {
      watch: false,
      compare: false,
      batch: false,
      output: './analysis-output',
      verbose: false
    };
  }

  parseArgs() {
    while (this.args.length > 0) {
      const arg = this.args.shift();
      switch (arg) {
        case '--watch':
        case '-w':
          this.options.watch = true;
          break;
        case '--compare':
        case '-c':
          this.options.compare = true;
          this.options.fileA = this.args.shift();
          this.options.fileB = this.args.shift();
          break;
        case '--batch':
        case '-b':
          this.options.batch = true;
          this.options.pattern = this.args.shift();
          break;
        case '--output':
        case '-o':
          this.options.output = this.args.shift();
          break;
        case '--verbose':
        case '-v':
          this.options.verbose = true;
          break;
        case '--help':
        case '-h':
          this.printHelp();
          process.exit(0);
        default:
          this.options.target = arg;
      }
    }
  }

  printHelp() {
    console.log(`
WASM Analyzer for Blitz3D Compiler

Usage:
  node cli.js <file>              Analyze a single WASM file
  node cli.js <dir>               Analyze all WASM files in directory
  node cli.js -w <file>           Watch file and re-analyze on changes
  node cli.js -c <a> <b>          Compare two WASM files
  node cli.js -b <pattern>        Batch analyze files matching pattern
  node cli.js -o <dir>            Set output directory (default: ./analysis-output)
  node cli.js -v                  Verbose output
  node cli.js -h                  Show this help

Examples:
  node cli.js output.wasm
  node cli.js ./compiled/
  node cli.js -w Main.wasm
  node cli.js -c before.wasm after.wasm
  node cli.js -b "*.wasm"

Output:
  - dashboard.html    Interactive summary dashboard
  - stack-depth.svg   Stack depth visualization
  - instructions.svg  Instruction distribution chart
  - function-sizes.svg Function size comparison
  - errors.svg        Error heatmap
  - analysis.json     Full analysis data (JSON)
`);
  }

  async run() {
    this.parseArgs();

    if (!this.options.target) {
      console.error('Error: No target file or directory specified');
      this.printHelp();
      process.exit(1);
    }

    if (this.options.compare) {
      await this.compare();
    } else if (this.options.batch) {
      await this.batchAnalyze();
    } else if (this.options.watch) {
      this.watchAnalyze();
    } else if (existsSync(this.options.target) && 
               (this.options.target.endsWith('.wasm') || this.options.target.endsWith('.wat'))) {
      await this.analyzeSingle(this.options.target);
    } else if (existsSync(this.options.target) && 
               (await import('fs')).statSync(this.options.target).isDirectory()) {
      await this.analyzeDirectory(this.options.target);
    } else {
      console.error(`Error: Target not found: ${this.options.target}`);
      process.exit(1);
    }
  }

  async analyzeSingle(filepath) {
    console.log(`\nAnalyzing: ${filepath}`);
    console.log('='.repeat(60));

    try {
      const analysis = await WASMAnalyzer.fromFile(filepath);
      const report = analysis.generateReport();
      
      if (this.options.verbose) {
        console.log('\nFull Report:');
        console.log(JSON.stringify(report, null, 2));
      }

      const output = visualizeAnalysis(report);
      this.printSummary(report);
      this.printOutputFiles(output);

      if (!report.summary.stackValid || !report.summary.typeValid) {
        console.log('\n❌ Issues found - see dashboard.html for details');
        process.exit(1);
      }

      return report;
    } catch (e) {
      console.error(`Error analyzing ${filepath}: ${e.message}`);
      if (this.options.verbose) {
        console.error(e.stack);
      }
      return null;
    }
  }

  async analyzeDirectory(dirpath) {
    const { glob } = await import('glob');
    const files = await glob(`${dirpath}/**/*.wasm`);
    
    console.log(`\nAnalyzing ${files.length} WASM files in ${dirpath}`);
    console.log('='.repeat(60));

    const results = [];
    for (const file of files) {
      const result = await this.analyzeSingle(file);
      if (result) {
        results.push({ file, ...result.summary });
      }
    }

    this.printDirectorySummary(results);
  }

  async batchAnalyze() {
    const { glob } = await import('glob');
    const files = await glob(this.options.pattern);
    
    console.log(`\nBatch analyzing ${files.length} files matching: ${this.options.pattern}`);
    console.log('='.repeat(60));

    const results = [];
    for (const file of files) {
      const result = await this.analyzeSingle(file);
      if (result) {
        results.push({ file, ...result.summary });
      }
    }

    this.printBatchSummary(results);
  }

  async compare() {
    console.log(`\nComparing WASM files:`);
    console.log(`  A: ${this.options.fileA}`);
    console.log(`  B: ${this.options.fileB}`);
    console.log('='.repeat(60));

    const [analysisA, analysisB] = await Promise.all([
      WASMAnalyzer.fromFile(this.options.fileA),
      WASMAnalyzer.fromFile(this.options.fileB)
    ]);

    const reportA = analysisA.generateReport();
    const reportB = analysisB.generateReport();

    this.printComparison(reportA, reportB);
  }

  watchAnalyze() {
    if (!existsSync(this.options.target)) {
      console.error(`File not found: ${this.options.target}`);
      process.exit(1);
    }

    console.log(`\nWatching ${this.options.target} for changes...`);
    console.log('Press Ctrl+C to stop\n');

    let lastAnalysis = null;

    const runAnalysis = async () => {
      try {
        const analysis = await WASMAnalyzer.fromFile(this.options.target);
        const report = analysis.generateReport();
        lastAnalysis = report;

        console.clear();
        console.log(`Last analysis: ${new Date().toLocaleString()}`);
        console.log('─'.repeat(60));
        this.printSummary(report);
      } catch (e) {
        console.error(`Analysis error: ${e.message}`);
      }
    };

    runAnalysis();

    watch(this.options.target, {}, runAnalysis);
  }

  printSummary(report) {
    const summary = report.summary;
    const metrics = report.metrics;

    console.log('\n📊 Summary:');
    console.log(`  Functions:        ${summary.totalFunctions}`);
    console.log(`  Instructions:     ${summary.totalInstructions}`);
    console.log(`  Globals:          ${summary.totalGlobals}`);
    
    console.log('\n✅ Validation:');
    console.log(`  Stack Balance:    ${summary.stackValid ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`  Type Checking:    ${summary.typeValid ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`  Control Flow:     ${summary.controlFlowValid ? '✓ PASS' : '✗ FAIL'}`);

    if (metrics.stackDepths?.length > 0) {
      const maxStack = Math.max(...metrics.stackDepths.map(d => d.max));
      const avgStack = metrics.stackDepths.reduce((sum, d) => sum + d.max, 0) / metrics.stackDepths.length;
      console.log(`\n📈 Stack Usage:`);
      console.log(`  Maximum Depth:    ${maxStack}`);
      console.log(`  Average Depth:    ${avgStack.toFixed(1)}`);
    }

    if (metrics.functionSizes?.length > 0) {
      const totalSize = metrics.functionSizes.reduce((a, b) => a + b, 0);
      const avgSize = totalSize / metrics.functionSizes.length;
      const maxSize = Math.max(...metrics.functionSizes);
      console.log(`\n📏 Code Size:`);
      console.log(`  Total:            ${totalSize} instructions`);
      console.log(`  Average/Function: ${avgSize.toFixed(0)} instructions`);
      console.log(`  Largest:          ${maxSize} instructions`);
    }

    if (report.errors?.length > 0) {
      console.log(`\n❌ Errors (${report.errors.length}):`);
      report.errors.slice(0, 5).forEach(e => {
        console.log(`  • ${e.substring(0, 100)}${e.length > 100 ? '...' : ''}`);
      });
      if (report.errors.length > 5) {
        console.log(`  ... and ${report.errors.length - 5} more`);
      }
    }

    if (report.warnings?.length > 0) {
      console.log(`\n⚠️  Warnings (${report.warnings.length}):`);
      report.warnings.slice(0, 3).forEach(w => {
        console.log(`  • ${w.substring(0, 100)}`);
      });
    }
  }

  printOutputFiles(output) {
    console.log(`\n📁 Output files in ${this.options.output}/:`);
    Object.entries(output).forEach(([name, path]) => {
      console.log(`  • ${name}: ${path}`);
    });
  }

  printDirectorySummary(results) {
    console.log('\n📋 Directory Summary:');
    console.log('─'.repeat(60));

    let passed = 0;
    let failed = 0;

    results.forEach(r => {
      const status = r.stackValid && r.typeValid ? '✓' : '✗';
      console.log(`  ${status} ${r.file}: ${r.totalFunctions} funcs, ${r.totalInstructions} instr`);
      if (r.stackValid && r.typeValid) passed++;
      else failed++;
    });

    console.log(`\nTotal: ${results.length} files | ${passed} passed | ${failed} failed`);
  }

  printBatchSummary(results) {
    console.log('\n📋 Batch Summary:');
    console.log('─'.repeat(60));

    const passed = results.filter(r => r.stackValid && r.typeValid).length;
    const failed = results.length - passed;

    results.filter(r => !r.stackValid || !r.typeValid).forEach(r => {
      console.log(`  ✗ ${r.file}`);
    });

    console.log(`\nTotal: ${results.length} files | ${passed} passed | ${failed} failed`);
  }

  printComparison(reportA, reportB) {
    const summaryA = reportA.summary;
    const summaryB = reportB.summary;

    console.log('\n📊 Comparison:');
    console.log('─'.repeat(60));
    console.log(`                    Before           After`);
    console.log(`  Functions:       ${String(summaryA.totalFunctions).padEnd(15)} ${summaryB.totalFunctions}`);
    console.log(`  Instructions:    ${String(summaryA.totalInstructions).padEnd(15)} ${summaryB.totalInstructions}`);
    console.log(`  Stack Valid:     ${String(summaryA.stackValid).padEnd(15)} ${summaryB.stackValid}`);
    console.log(`  Type Valid:      ${String(summaryA.typeValid).padEnd(15)} ${summaryB.typeValid}`);

    const metricsA = reportA.metrics;
    const metricsB = reportB.metrics;

    if (metricsA.functionSizes && metricsB.functionSizes) {
      const sizeA = metricsA.functionSizes.reduce((a, b) => a + b, 0);
      const sizeB = metricsB.functionSizes.reduce((a, b) => a + b, 0);
      const diff = sizeB - sizeA;
      const pct = sizeA > 0 ? ((diff / sizeA) * 100).toFixed(1) : 0;
      
      console.log(`\n  Code Size:       ${sizeA}              ${sizeB} (${diff >= 0 ? '+' : ''}${diff}, ${pct}%)`);
    }

    const errorsA = reportA.errors?.length || 0;
    const errorsB = reportB.errors?.length || 0;
    console.log(`  Errors:          ${errorsA}               ${errorsB} (${errorsB - errorsA >= 0 ? '+' : ''}${errorsB - errorsA})`);
  }
}

new AnalyzerCLI().run();
