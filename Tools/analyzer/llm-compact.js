#!/usr/bin/env node
import { LLMWASMAnalyzer } from "./llm-analyzer.js";

function printUsage() {
  console.log(`
LLM Compact WASM Analyzer

Usage:
  node llm-compact.js <file.wasm> [--max-issues N] [--max-functions N] [--max-messages N] [--format json|text]

Defaults:
  --max-issues 20
  --max-functions 10
  --max-messages 10
  --format json
`);
}

function normalizeMessage(message) {
  return message.replace(/\s+/g, " ").trim();
}

function groupIssues(issues) {
  const groups = new Map();
  for (const issue of issues) {
    const key = `${issue.category}::${normalizeMessage(issue.message)}`;
    const current = groups.get(key);
    if (current) {
      current.count += 1;
    } else {
      groups.set(key, {
        category: issue.category,
        severity: issue.severity,
        message: normalizeMessage(issue.message),
        count: 1,
      });
    }
  }
  return Array.from(groups.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.message.localeCompare(b.message);
  });
}

function getTopFailingFunctions(functions, limit) {
  return functions
    .filter((f) => f.status === "fail")
    .sort((a, b) => b.errorCount - a.errorCount)
    .slice(0, limit)
    .map((f) => ({
      idx: f.idx,
      errorCount: f.errorCount,
      maxStack: f.maxStack,
      finalStackSize: f.finalStackSize,
      sampleError: f.errors[0] || null,
    }));
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    printUsage();
    process.exit(args.length === 0 ? 1 : 0);
  }

  const wasmPath = args[0];
  let maxIssues = 20;
  let maxFunctions = 10;
  let maxMessages = 10;
  let format = "json";

  for (let i = 1; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--max-issues") {
      maxIssues = Number(args[i + 1] || maxIssues);
      i += 1;
    } else if (arg === "--max-functions") {
      maxFunctions = Number(args[i + 1] || maxFunctions);
      i += 1;
    } else if (arg === "--max-messages") {
      maxMessages = Number(args[i + 1] || maxMessages);
      i += 1;
    } else if (arg === "--format") {
      format = args[i + 1] || format;
      i += 1;
    }
  }

  const analyzer = new LLMWASMAnalyzer(wasmPath);
  await analyzer.analyze();

  const summary = analyzer.getSummary();
  const issuesReport = analyzer.getPrioritizedIssues();
  const functionReport = analyzer.getFunctionBreakdown();

  const groupedIssues = groupIssues(issuesReport.issues || []).slice(0, maxMessages);
  const topIssues = (issuesReport.issues || []).slice(0, maxIssues);
  const failingFunctions = getTopFailingFunctions(
    functionReport.functions || [],
    maxFunctions
  );

  const payload = {
    summary,
    issues: {
      total: issuesReport.totalIssues || 0,
      critical: issuesReport.critical || 0,
      high: issuesReport.high || 0,
      medium: issuesReport.medium || 0,
      grouped: groupedIssues,
      samples: topIssues.map((issue) => ({
        severity: issue.severity,
        category: issue.category,
        message: normalizeMessage(issue.message),
        suggestion: issue.suggestion || null,
        funcIdx: issue.funcIdx ?? null,
      })),
    },
    failingFunctions,
  };

  if (format === "text") {
    console.log("LLM COMPACT REPORT");
    console.log(`status: ${summary.status}`);
    console.log(
      `functions: ${summary.functions} | instructions: ${summary.instructions}`
    );
    console.log(
      `stack: ${summary.stackValid} | type: ${summary.typeValid} | control: ${summary.controlFlowValid}`
    );
    console.log(`issues: ${payload.issues.total}`);
    console.log("");
    console.log("top grouped issues:");
    for (const group of groupedIssues) {
      console.log(`  (${group.count}) [${group.category}] ${group.message}`);
    }
    if (failingFunctions.length > 0) {
      console.log("");
      console.log("top failing functions:");
      for (const fn of failingFunctions) {
        console.log(
          `  func ${fn.idx}: errors=${fn.errorCount} maxStack=${fn.maxStack} finalStack=${fn.finalStackSize}`
        );
        if (fn.sampleError) {
          console.log(`    ${normalizeMessage(fn.sampleError)}`);
        }
      }
    }
    return;
  }

  console.log(JSON.stringify(payload, null, 2));
}

main();
