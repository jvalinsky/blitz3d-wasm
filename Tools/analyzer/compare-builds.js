#!/usr/bin/env node

/**
 * LLM-Optimized WASM Comparator
 * 
 * Compares two WASM files and outputs structured comparison for AI consumption.
 * 
 * Usage:
 *   node compare-builds.js before.wasm after.wasm
 *   node compare-builds.js before.wasm after.wasm --verbose
 */

import { WASMAnalyzer } from './core.js';
import { readFileSync, existsSync } from 'fs';

class BuildComparator {
  constructor() {
    this.beforeAnalysis = null;
    this.afterAnalysis = null;
  }

  async compare(fileA, fileB, verbose = false) {
    console.log(`\nComparing builds:\n  Before: ${fileA}\n  After:  ${fileB}\n`);

    if (!existsSync(fileA)) {
      return { error: `File not found: ${fileA}` };
    }
    if (!existsSync(fileB)) {
      return { error: `File not found: ${fileB}` };
    }

    try {
      const [analyzerA, analyzerB] = await Promise.all([
        WASMAnalyzer.fromFile(fileA),
        WASMAnalyzer.fromFile(fileB)
      ]);

      this.beforeAnalysis = analyzerA.generateReport();
      this.afterAnalysis = analyzerB.generateReport();

      return this.generateComparison(verbose);
    } catch (e) {
      return { error: e.message };
    }
  }

  generateComparison(verbose = false) {
    const before = this.beforeAnalysis;
    const after = this.afterAnalysis;

    const summary = {
      before: {
        functions: before.summary.totalFunctions,
        instructions: before.summary.totalInstructions,
        globals: before.summary.totalGlobals,
        stackValid: before.summary.stackValid,
        typeValid: before.summary.typeValid,
        controlFlowValid: before.summary.controlFlowValid,
        errors: before.errors.length
      },
      after: {
        functions: after.summary.totalFunctions,
        instructions: after.summary.totalInstructions,
        globals: after.summary.totalGlobals,
        stackValid: after.summary.stackValid,
        typeValid: after.summary.typeValid,
        controlFlowValid: after.summary.controlFlowValid,
        errors: after.errors.length
      }
    };

    const changes = {
      instructions: after.summary.totalInstructions - before.summary.totalInstructions,
      errors: after.errors.length - before.errors.length,
      stackIssues: !before.summary.stackValid !== !after.summary.stackValid,
      typeIssues: !before.summary.typeValid !== !after.summary.typeValid,
      controlIssues: !before.summary.controlFlowValid !== !after.summary.controlFlowValid
    };

    const improvements = [];
    const regressions = [];

    if (before.errors.length > after.errors.length) {
      improvements.push(`Errors: ${before.errors.length} → ${after.errors.length}`);
    } else if (before.errors.length < after.errors.length) {
      regressions.push(`Errors: ${before.errors.length} → ${after.errors.length}`);
    }

    if (!before.summary.stackValid && after.summary.stackValid) {
      improvements.push('Stack balance: FIXED');
    } else if (before.summary.stackValid && !after.summary.stackValid) {
      regressions.push('Stack balance: BROKEN');
    }

    if (!before.summary.typeValid && after.summary.typeValid) {
      improvements.push('Type consistency: FIXED');
    } else if (before.summary.typeValid && !after.summary.typeValid) {
      regressions.push('Type consistency: BROKEN');
    }

    if (changes.instructions < 0) {
      improvements.push(`Instructions: ${changes.instructions}`);
    } else if (changes.instructions > 0) {
      regressions.push(`Instructions: +${changes.instructions}`);
    }

    const verdict = this.getVerdict(improvements, regressions);

    const result = {
      summary,
      changes,
      improvements,
      regressions,
      verdict,
      metrics: {
        before: before.metrics,
        after: after.metrics
      }
    };

    if (verbose) {
      result.beforeFull = before;
      result.afterFull = after;
    }

    return result;
  }

  getVerdict(improvements, regressions) {
    if (regressions.length === 0 && improvements.length > 0) {
      return 'success';
    }
    if (improvements.length === 0 && regressions.length > 0) {
      return 'failure';
    }
    if (improvements.length > regressions.length) {
      return 'partial';
    }
    return 'no_change';
  }

  printResult(result) {
    if (result.error) {
      console.error(`Error: ${result.error}`);
      return;
    }

    console.log('═'.repeat(60));
    console.log('BUILD COMPARISON RESULT');
    console.log('═'.repeat(60));

    // Verdict
    const verdictColors = {
      success: '✓ SUCCESS',
      partial: '⚠ PARTIAL',
      failure: '✗ FAILURE',
      no_change: '○ NO CHANGE'
    };
    console.log(`\nVerdict: ${verdictColors[result.verdict]}`);

    // Summary table
    console.log('\n┌──────────────────────┬──────────┬──────────┬────────┐');
    console.log('│ Metric               │ Before   │ After    │ Change │');
    console.log('├──────────────────────┼──────────┼──────────┼────────┤');
    console.log(`│ Functions            │ ${String(result.summary.before.functions).padEnd(8)} │ ${String(result.summary.after.functions).padEnd(8)} │ ${String(result.changes.instructions === 0 ? '-' : '').padEnd(6)} │`);
    console.log(`│ Instructions         │ ${String(result.summary.before.instructions).padEnd(8)} │ ${String(result.summary.after.instructions).padEnd(8)} │ ${String(result.changes.instructions).padEnd(6)} │`);
    console.log(`│ Errors               │ ${String(result.summary.before.errors).padEnd(8)} │ ${String(result.summary.after.errors).padEnd(8)} │ ${String(result.changes.errors).padEnd(6)} │`);
    console.log('├──────────────────────┼──────────┼──────────┼────────┤');
    console.log(`│ Stack Valid          │ ${result.summary.before.stackValid ? '    ✓   ' : '    ✗   '} │ ${result.summary.after.stackValid ? '    ✓   ' : '    ✗   '} │        │`);
    console.log(`│ Type Valid           │ ${result.summary.before.typeValid ? '    ✓   ' : '    ✗   '} │ ${result.summary.after.typeValid ? '    ✓   ' : '    ✗   '} │        │`);
    console.log(`│ Control Flow Valid   │ ${result.summary.before.controlFlowValid ? '    ✓   ' : '    ✗   '} │ ${result.summary.after.controlFlowValid ? '    ✓   ' : '    ✗   '} │        │`);
    console.log('└──────────────────────┴──────────┴──────────┴────────┘');

    // Improvements
    if (result.improvements.length > 0) {
      console.log('\n✓ Improvements:');
      result.improvements.forEach(i => console.log(`  • ${i}`));
    }

    // Regressions
    if (result.regressions.length > 0) {
      console.log('\n✗ Regressions:');
      result.regressions.forEach(r => console.log(`  • ${r}`));
    }

    // Recommendations
    console.log('\n' + '─'.repeat(60));
    if (result.verdict === 'success') {
      console.log('✓ Fix validated - no regressions detected');
    } else if (result.verdict === 'failure') {
      console.log('✗ Regressions detected - review changes');
    } else if (result.verdict === 'partial') {
      console.log('⚠ Mixed results - some improvements, some regressions');
    } else {
      console.log('○ No significant changes detected');
    }

    console.log('');
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log(`
WASM Build Comparator for LLM

Usage:
  node compare-builds.js <before.wasm> <after.wasm>
  node compare-builds.js <before.wasm> <after.wasm> --verbose

Examples:
  node compare-builds.js before.wasm after.wasm
  node compare-builds.js old.wasm new.wasm -v
`);
    process.exit(1);
  }

  const verbose = args.includes('--verbose') || args.includes('-v');
  const files = args.filter(a => !a.startsWith('-'));

  const comparator = new BuildComparator();
  const result = await comparator.compare(files[0], files[1], verbose);
  comparator.printResult(result);
}

main();
