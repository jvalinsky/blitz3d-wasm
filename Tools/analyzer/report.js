/**
 * WASM Analysis Report Generator
 *
 * Generates detailed text reports for CI/CD pipelines,
 * issue tracking, and documentation purposes.
 */

import { WASMAnalyzer } from "./core.js";
import { writeFileSync } from "fs";

export class ReportGenerator {
  constructor(analysis) {
    this.analysis = analysis;
  }

  generateTextReport(options = {}) {
    const {
      format = "detailed",
      includeStackTraces = false,
      includeSuggestions = true,
    } = options;

    let report = "";
    const summary = this.analysis.summary;
    const metrics = this.analysis.metrics;

    report += this.generateHeader();
    report += this.generateSummarySection(summary, metrics);
    report += this.generateStackBalanceSection();
    report += this.generateTypeConsistencySection();
    report += this.generateControlFlowSection();
    report += this.generateMetricsSection();
    report += this.generateErrorsSection();
    report += this.generateSuggestionsSection();

    return report;
  }

  generateHeader() {
    return `
================================================================================
                    WASM COMPILATION ANALYSIS REPORT
================================================================================
Generated: ${new Date().toISOString()}
Blitz3D WASM Compiler Analysis Tool
================================================================================

`;
  }

  generateSummarySection(summary, metrics) {
    let section = "EXECUTIVE SUMMARY\n";
    section += "─".repeat(80) + "\n\n";

    section += `Overall Status: ${this.getOverallStatus()}\n\n`;

    section += "Module Statistics:\n";
    section += `  • Total Functions:     ${summary.totalFunctions || 0}\n`;
    section += `  • Total Instructions:  ${summary.totalInstructions || 0}\n`;
    section += `  • Type Signatures:     ${summary.totalTypes || 0}\n`;
    section += `  • Global Variables:    ${summary.totalGlobals || 0}\n`;
    section += `  • Memory Pages:        ${metrics.memory?.pages || 0}\n\n`;

    section += "Validation Results:\n";
    section += `  ✓ Stack Balance:       ${
      summary.stackValid ? "PASS" : "FAIL"
    }\n`;
    section += `  ✓ Type Consistency:    ${
      summary.typeValid ? "PASS" : "FAIL"
    }\n`;
    section += `  ✓ Control Flow:        ${
      summary.controlFlowValid ? "PASS" : "FAIL"
    }\n\n`;

    return section;
  }

  generateStackBalanceSection() {
    const stack = this.analysis.stackBalance;
    if (!stack) return "";

    let section = "STACK BALANCE ANALYSIS\n";
    section += "─".repeat(80) + "\n\n";

    section += `Status: ${stack.valid ? "✓ PASS" : "✗ FAIL"}\n\n`;

    if (stack.errors?.length > 0) {
      section += `Issues Found: ${stack.errors.length}\n\n`;

      // Group by type
      const typeErrors = stack.errors.filter((e) =>
        e.toLowerCase().includes("type")
      );
      const stackErrors = stack.errors.filter((e) =>
        e.toLowerCase().includes("stack")
      );
      const otherErrors = stack.errors.filter((e) =>
        !typeErrors.includes(e) && !stackErrors.includes(e)
      );

      if (typeErrors.length > 0) {
        section += `Type Mismatches (${typeErrors.length}):\n`;
        typeErrors.slice(0, 10).forEach((e) => {
          section += `  ⚠ ${e}\n`;
        });
        if (typeErrors.length > 10) {
          section += `  ... and ${typeErrors.length - 10} more type errors\n`;
        }
        section += "\n";
      }

      if (stackErrors.length > 0) {
        section += `Stack Imbalance (${stackErrors.length}):\n`;
        stackErrors.slice(0, 10).forEach((e) => {
          section += `  ⚠ ${e}\n`;
        });
        if (stackErrors.length > 10) {
          section += `  ... and ${stackErrors.length - 10} more stack errors\n`;
        }
        section += "\n";
      }
    } else {
      section += "No stack balance issues detected.\n\n";
    }

    // Function-level results
    if (stack.functionResults?.length > 0) {
      section += "Per-Function Results:\n";
      const failing = stack.functionResults.filter((f) => !f.valid);

      if (failing.length > 0) {
        failing.forEach((f) => {
          section +=
            `  ✗ Function ${f.funcIdx}: ${f.errors.length} error(s), max stack: ${f.maxStack}\n`;
        });
      } else {
        section += "  All functions pass stack balance validation.\n";
      }
      section += "\n";
    }

    return section;
  }

  generateTypeConsistencySection() {
    const types = this.analysis.typeConsistency;
    if (!types) return "";

    let section = "TYPE CONSISTENCY ANALYSIS\n";
    section += "─".repeat(80) + "\n\n";

    section += `Status: ${types.valid ? "✓ PASS" : "✗ FAIL"}\n\n`;

    if (types.issues?.length > 0) {
      section += `Issues Found: ${types.issues.length}\n\n`;

      const errors = types.issues.filter((i) => i.severity === "error");
      const warnings = types.issues.filter((i) => i.severity === "warning");

      if (errors.length > 0) {
        section += `Critical Errors (${errors.length}):\n`;
        errors.forEach((e) => {
          section +=
            `  ✗ Function ${e.funcIdx}, Local ${e.localIdx}: ${e.message}\n`;
        });
        section += "\n";
      }

      if (warnings.length > 0) {
        section += `Warnings (${warnings.length}):\n`;
        warnings.slice(0, 10).forEach((w) => {
          section += `  ⚠ Function ${w.funcIdx}: ${w.message}\n`;
        });
        if (warnings.length > 10) {
          section += `  ... and ${warnings.length - 10} more warnings\n`;
        }
        section += "\n";
      }
    } else {
      section += "No type consistency issues detected.\n\n";
    }

    return section;
  }

  generateControlFlowSection() {
    const cf = this.analysis.controlFlow;
    if (!cf) return "";

    let section = "CONTROL FLOW ANALYSIS\n";
    section += "─".repeat(80) + "\n\n";

    section += `Status: ${cf.valid ? "✓ PASS" : "✗ FAIL"}\n\n`;

    if (cf.results?.length > 0) {
      section += `Issues Found: ${cf.results.length}\n\n`;

      const invalidBranches = cf.results.filter((r) =>
        r.type === "invalid_branch_depth"
      );
      const unbalancedBlocks = cf.results.filter((r) =>
        r.type === "unbalanced_blocks"
      );

      if (invalidBranches.length > 0) {
        section += `Invalid Branch Depths (${invalidBranches.length}):\n`;
        invalidBranches.forEach((b) => {
          section +=
            `  ✗ Function ${b.funcIdx}, instruction ${b.idx}: ${b.message}\n`;
        });
        section += "\n";
      }

      if (unbalancedBlocks.length > 0) {
        section += `Unbalanced Blocks (${unbalancedBlocks.length}):\n`;
        unbalancedBlocks.forEach((b) => {
          section += `  ✗ Function ${b.funcIdx}: ${b.message}\n`;
        });
        section += "\n";
      }
    }

    if (cf.loopHeaders?.length > 0) {
      section += `Loop Headers Found: ${cf.loopHeaders.length}\n`;
      cf.loopHeaders.forEach((l) => {
        section += `  • Function ${l.funcIdx}, instruction ${l.idx}\n`;
      });
      section += "\n";
    }

    return section;
  }

  generateMetricsSection() {
    const metrics = this.analysis.metrics;
    if (!metrics) return "";

    let section = "CODE METRICS\n";
    section += "─".repeat(80) + "\n\n";

    section += "Instruction Distribution:\n";
    const topInstrs = Object.entries(metrics.instructionCounts || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    if (topInstrs.length > 0) {
      const maxCount = topInstrs[0][1];
      const barWidth = 30;

      topInstrs.forEach(([instr, count]) => {
        const barLen = Math.round((count / maxCount) * barWidth);
        const bar = "█".repeat(barLen);
        section += `  ${instr.padEnd(20)} ${bar} ${count}\n`;
      });
    }
    section += "\n";

    section += "Function Size Distribution:\n";
    const sizes = metrics.functionSizes || [];
    if (sizes.length > 0) {
      const sorted = [...sizes].sort((a, b) => b - a);
      const p50 = sorted[Math.floor(sorted.length * 0.5)];
      const p90 = sorted[Math.floor(sorted.length * 0.9)];
      const p99 = sorted[Math.floor(sorted.length * 0.99)];

      section += `  • Smallest:   ${Math.min(...sizes)} instructions\n`;
      section += `  • Median:     ${p50} instructions\n`;
      section += `  • 90th %ile:  ${p90} instructions\n`;
      section += `  • 99th %ile:  ${p99} instructions\n`;
      section += `  • Largest:    ${Math.max(...sizes)} instructions\n`;
    }
    section += "\n";

    section += "Stack Usage:\n";
    const stackDepths = metrics.stackDepths || [];
    if (stackDepths.length > 0) {
      const maxStack = Math.max(...stackDepths.map((d) => d.max));
      const avgStack = stackDepths.reduce((sum, d) => sum + d.max, 0) /
        stackDepths.length;

      section += `  • Maximum Depth: ${maxStack}\n`;
      section += `  • Average Depth: ${avgStack.toFixed(1)}\n`;
    }
    section += "\n";

    section += "Local Variable Usage:\n";
    const locals = metrics.localCounts || [];
    section += `  • Total Locals: ${locals.reduce((a, b) => a + b, 0)}\n`;
    section += `  • Max in Func:  ${Math.max(...locals, 0)}\n`;
    section += `  • Avg per Func: ${
      locals.length > 0
        ? (locals.reduce((a, b) => a + b, 0) / locals.length).toFixed(1)
        : 0
    }\n`;
    section += "\n";

    return section;
  }

  generateErrorsSection() {
    const errors = this.analysis.errors || [];
    if (errors.length === 0) return "";

    let section = "ERROR DETAILS\n";
    section += "─".repeat(80) + "\n\n";

    section += `Total Errors: ${errors.length}\n\n`;

    errors.forEach((err, idx) => {
      section += `${idx + 1}. ${err}\n`;
      section += "─".repeat(40) + "\n";
    });

    return section;
  }

  generateSuggestionsSection() {
    const suggestions = [];

    if (!this.analysis.summary.stackValid) {
      suggestions.push({
        category: "Stack Balance",
        issue: "Stack balance validation failed",
        suggestion:
          "Review if/else branches for consistent stack effects. Ensure function calls with return values are properly handled (drop the return value if unused).",
      });
    }

    if (!this.analysis.summary.typeValid) {
      suggestions.push({
        category: "Type Checking",
        issue: "Type consistency issues detected",
        suggestion:
          "Check function call argument ordering. Ensure numeric literals have correct types. Review type conversion operations.",
      });
    }

    if (!this.analysis.summary.controlFlowValid) {
      suggestions.push({
        category: "Control Flow",
        issue: "Control flow validation failed",
        suggestion:
          'Verify branch depths are correct. Ensure all blocks (if/loop/block) are properly closed with "end" instructions.',
      });
    }

    const metrics = this.analysis.metrics;
    if (metrics?.stackDepths?.some((d) => d.max > 100)) {
      suggestions.push({
        category: "Optimization",
        issue: "High stack usage detected (>100)",
        suggestion:
          "Consider breaking complex expressions into smaller parts or using local variables to reduce stack pressure.",
      });
    }

    if (suggestions.length === 0) {
      return "";
    }

    let section = "RECOMMENDATIONS\n";
    section += "─".repeat(80) + "\n\n";

    suggestions.forEach((s, idx) => {
      section += `${idx + 1}. [${s.category}]\n`;
      section += `   Issue: ${s.issue}\n`;
      section += `   Fix: ${s.suggestion}\n\n`;
    });

    return section;
  }

  getOverallStatus() {
    const { stackValid, typeValid, controlFlowValid } = this.analysis.summary;

    if (stackValid && typeValid && controlFlowValid) {
      return "✓ ALL CHECKS PASSED";
    }

    const failed =
      [!stackValid, !typeValid, !controlFlowValid].filter(Boolean).length;
    return `⚠ ${failed} CHECK(S) FAILED`;
  }

  generateMarkdownReport() {
    const report = this.generateTextReport();
    return report;
  }

  generateJSONReport() {
    return JSON.stringify(this.analysis, null, 2);
  }

  generateJUnitXML() {
    const testsuites = [];
    let testCount = 0;
    let failures = 0;

    // Stack balance tests
    const stack = this.analysis.stackBalance;
    testsuites.push({
      name: "Stack Balance",
      tests: stack?.functionResults?.length || 0,
      failures: stack?.functionResults?.filter((f) => !f.valid).length || 0,
    });
    testCount += stack?.functionResults?.length || 0;
    failures += stack?.functionResults?.filter((f) => !f.valid).length || 0;

    // Type consistency tests
    const types = this.analysis.typeConsistency;
    const typeFailures =
      types?.issues?.filter((i) => i.severity === "error").length || 0;
    testsuites.push({
      name: "Type Consistency",
      tests: 1,
      failures: typeFailures,
    });
    testCount += 1;
    failures += typeFailures;

    // Control flow tests
    const cf = this.analysis.controlFlow;
    testsuites.push({
      name: "Control Flow",
      tests: cf?.results?.length || 0,
      failures: cf?.results?.length || 0,
    });
    testCount += cf?.results?.length || 0;
    failures += cf?.results?.length || 0;

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml +=
      `<testsuites name="WASM Analysis" tests="${testCount}" failures="${failures}">\n`;

    testsuites.forEach((ts) => {
      xml +=
        `  <testsuite name="${ts.name}" tests="${ts.tests}" failures="${ts.failures}">\n`;
      if (ts.name === "Stack Balance" && stack?.functionResults) {
        stack.functionResults.forEach((f) => {
          if (!f.valid) {
            xml += `    <testcase name="function_${f.funcIdx}">\n`;
            f.errors.forEach((e) => {
              xml += `      <failure message="${e}">${e}</failure>\n`;
            });
            xml += `    </testcase>\n`;
          }
        });
      }
      xml += `  </testsuite>\n`;
    });

    xml += `</testsuites>`;
    return xml;
  }

  saveReport(filepath, format = "text") {
    switch (format) {
      case "json":
        writeFileSync(filepath, this.generateJSONReport());
        break;
      case "markdown":
        writeFileSync(filepath, this.generateMarkdownReport());
        break;
      case "junit":
        writeFileSync(filepath, this.generateJUnitXML());
        break;
      default:
        writeFileSync(filepath, this.generateTextReport());
    }
  }
}

export function generateReport(analysis, options = {}) {
  const generator = new ReportGenerator(analysis);
  return generator.generateTextReport(options);
}

export function saveReport(analysis, filepath, format = "text") {
  const generator = new ReportGenerator(analysis);
  generator.saveReport(filepath, format);
}
