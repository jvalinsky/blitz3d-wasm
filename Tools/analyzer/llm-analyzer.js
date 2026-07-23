/**
 * LLM-Optimized WASM Error Analyzer
 *
 * Designed for LLMs to quickly understand compilation issues and get actionable insights.
 * Outputs structured data optimized for AI consumption.
 */

import { WASMAnalyzer } from "./core.js";
import { readFileSync } from "fs";

export class LLMWASMAnalyzer {
  constructor(wasmPath, bbPath = null) {
    this.wasmPath = wasmPath;
    this.bbPath = bbPath;
    this.analysis = null;
    this.context = {};
  }

  async analyze() {
    try {
      const analyzer = await WASMAnalyzer.fromFile(this.wasmPath);
      this.analysis = analyzer.generateReport();
      return this.analysis;
    } catch (e) {
      return { error: e.message };
    }
  }

  /**
   * Get a brief summary for quick context
   */
  getSummary() {
    if (!this.analysis) return { error: "Not analyzed yet" };

    const { summary } = this.analysis;
    return {
      status: this.getOverallStatus(),
      functions: summary.totalFunctions,
      instructions: summary.totalInstructions,
      stackValid: summary.stackValid,
      typeValid: summary.typeValid,
      controlFlowValid: summary.controlFlowValid,
      issueCount: this.analysis.errors.length,
      warningsCount: this.analysis.warnings.length,
    };
  }

  /**
   * Get prioritized issues for LLM to address
   */
  getPrioritizedIssues() {
    if (!this.analysis) return { error: "Not analyzed yet" };

    const issues = [];

    // Stack balance issues (highest priority - blocks compilation)
    if (!this.analysis.summary.stackValid) {
      const stackErrors = this.analysis.stackBalance?.errors || [];
      stackErrors.forEach((err) => {
        issues.push({
          severity: "critical",
          category: "stack_balance",
          message: err,
          suggestion: this.getStackFixSuggestion(err),
        });
      });
    }

    // Control flow issues
    if (!this.analysis.summary.controlFlowValid) {
      const cfResults = this.analysis.controlFlow?.results || [];
      cfResults.forEach((r) => {
        issues.push({
          severity: "high",
          category: "control_flow",
          type: r.type,
          message: r.message,
          funcIdx: r.funcIdx,
          suggestion: this.getCFFixSuggestion(r),
        });
      });
    }

    // Type issues
    if (!this.analysis.summary.typeValid) {
      const typeIssues = this.analysis.typeConsistency?.issues || [];
      typeIssues.forEach((issue) => {
        issues.push({
          severity: "high",
          category: "type_consistency",
          message: issue.message,
          funcIdx: issue.funcIdx,
          suggestion: this.getTypeFixSuggestion(issue),
        });
      });
    }

    // Warnings
    this.analysis.warnings?.forEach((w) => {
      issues.push({
        severity: "medium",
        category: "warning",
        message: w,
        suggestion: this.getWarningSuggestion(w),
      });
    });

    return {
      totalIssues: issues.length,
      critical: issues.filter((i) => i.severity === "critical").length,
      high: issues.filter((i) => i.severity === "high").length,
      medium: issues.filter((i) => i.severity === "medium").length,
      issues,
    };
  }

  /**
   * Get function-level breakdown for targeted debugging
   */
  getFunctionBreakdown() {
    if (!this.analysis) return { error: "Not analyzed yet" };

    const functions = this.analysis.stackBalance?.functionResults || [];

    return {
      total: functions.length,
      passing: functions.filter((f) => f.valid).length,
      failing: functions.filter((f) => !f.valid).length,
      functions: functions.map((f) => ({
        idx: f.funcIdx,
        status: f.valid ? "pass" : "fail",
        maxStack: f.maxStack,
        finalStackSize: f.finalStackSize,
        errorCount: f.errors.length,
        errors: f.errors,
      })),
    };
  }

  /**
   * Get instruction statistics for optimization insights
   */
  getOptimizationInsights() {
    if (!this.analysis) return { error: "Not analyzed yet" };

    const { metrics } = this.analysis;
    const counts = metrics.instructionCounts || {};

    // Identify potential issues
    const insights = [];

    // Check for high drop count (indicates stack imbalance attempts)
    const dropCount = counts["drop"] || 0;
    if (dropCount > 10) {
      insights.push({
        type: "stack_inefficiency",
        message: `High drop instruction count (${dropCount})`,
        suggestion: "Review if/else branches for inconsistent stack effects",
      });
    }

    // Check for many branches (complex control flow)
    const branchCount = (metrics.branchCounts || []).reduce(
      (sum, b) => sum + b.branches,
      0,
    );
    if (branchCount > 20) {
      insights.push({
        type: "complex_control_flow",
        message: `High branch count (${branchCount})`,
        suggestion: "Consider simplifying nested if/else structures",
      });
    }

    // Check for deep stack usage
    const maxStack = metrics.maxStackObserved;
    if (maxStack > 50) {
      insights.push({
        type: "high_stack_usage",
        message: `Maximum stack depth (${maxStack})`,
        suggestion:
          "Consider breaking expressions into smaller parts or using locals",
      });
    }

    // Get top instructions
    const topInstructions = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([instr, count]) => ({ instruction: instr, count }));

    return {
      insights,
      topInstructions,
      totalInstructions: metrics.totalInstructions,
      averageFunctionSize: metrics.functionSizes?.length > 0
        ? Math.round(
          metrics.functionSizes.reduce((a, b) => a + b, 0) /
            metrics.functionSizes.length,
        )
        : 0,
      largestFunction: Math.max(...(metrics.functionSizes || [0])),
    };
  }

  /**
   * Generate a structured report for LLM consumption
   */
  getStructuredReport() {
    return {
      summary: this.getSummary(),
      issues: this.getPrioritizedIssues(),
      functions: this.getFunctionBreakdown(),
      optimization: this.getOptimizationInsights(),
    };
  }

  /**
   * Quick yes/no check for common questions
   */
  check(condition) {
    switch (condition) {
      case "compiles":
        return this.analysis?.summary?.stackValid &&
          this.analysis?.summary?.typeValid &&
          this.analysis?.summary?.controlFlowValid;
      case "stack_valid":
        return this.analysis?.summary?.stackValid || false;
      case "type_valid":
        return this.analysis?.summary?.typeValid || false;
      case "has_errors":
        return (this.analysis?.errors?.length || 0) > 0;
      case "has_warnings":
        return (this.analysis?.warnings?.length || 0) > 0;
      default:
        return null;
    }
  }

  getOverallStatus() {
    const { stackValid, typeValid, controlFlowValid } =
      this.analysis?.summary || {};

    if (stackValid && typeValid && controlFlowValid) {
      return "healthy";
    }

    const failed =
      [!stackValid, !typeValid, !controlFlowValid].filter(Boolean).length;
    return `issues (${failed} checks failed)`;
  }

  getStackFixSuggestion(err) {
    if (err.includes("excess value")) {
      return "Ensure both branches of if/else leave same values on stack. Use drop for unused return values.";
    }
    if (err.includes("underflow")) {
      return "Check that required arguments are pushed before operations. Verify function call argument count.";
    }
    if (err.includes("function ends with")) {
      return "Add return statement or ensure stack is balanced at function end.";
    }
    return "Review stack balance in control flow structures.";
  }

  getCFFixSuggestion(r) {
    if (r.type === "invalid_branch_depth") {
      return "Check branch depth calculation. Ensure br/br_if targets valid block.";
    }
    if (r.type === "unbalanced_blocks") {
      return "Verify all block/loop/if structures have matching end instructions.";
    }
    return "Review control flow structure for nesting issues.";
  }

  getTypeFixSuggestion(issue) {
    return "Check type conversions and function signature matches.";
  }

  getWarningSuggestion(w) {
    if (w.includes("unused")) {
      return "Consider removing unused locals or variables.";
    }
    return "Review and address if relevant.";
  }
}

export async function analyzeForLLM(wasmPath, bbPath = null) {
  const analyzer = new LLMWASMAnalyzer(wasmPath, bbPath);
  await analyzer.analyze();
  return analyzer.getStructuredReport();
}

export function quickCheck(wasmPath, question) {
  return new LLMWASMAnalyzer(wasmPath).check(question);
}
