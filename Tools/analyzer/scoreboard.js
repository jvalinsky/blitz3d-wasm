#!/usr/bin/env node
/**
 * Scoreboard generator for compile_errors_*.json outputs.
 *
 * Usage:
 *   node scoreboard.js [globPattern]
 *
 * Default pattern (from repo root perspective):
 *   ../compile_errors_*.json
 *
 * Output:
 *   - Per-run summary (timestamp, passed/failed, compile vs validate failures)
 *   - Aggregated totals across all runs
 *   - Top error categories (sorted desc)
 *   - Most frequently failing files
 *
 * This script is intentionally dependency-light; it only uses glob (already in package.json).
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { globSync } from "glob";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadRuns(pattern) {
  const files = globSync(pattern, { cwd: __dirname, absolute: true });
  if (!files.length) {
    throw new Error(`No files matched pattern '${pattern}' (cwd=${__dirname})`);
  }
  const runs = [];
  for (const file of files.sort()) {
    const raw = await fs.readFile(file, "utf8");
    try {
      const data = JSON.parse(raw);
      runs.push({ file, data });
    } catch (err) {
      console.error(`Failed to parse ${file}:`, err.message);
    }
  }
  return runs;
}

function mergeCategories(target, src) {
  for (const [k, v] of Object.entries(src || {})) {
    target[k] = (target[k] || 0) + v;
  }
}

function aggregate(runs) {
  const agg = {
    totalRuns: runs.length,
    totalFiles: 0,
    totalPassed: 0,
    totalFailed: 0,
    totalCompileErrors: 0,
    totalValidationErrors: 0,
    errorCategories: {},
    failedFiles: new Map(), // file -> count
  };

  for (const { data } of runs) {
    const { summary = {}, error_categories = {}, failed_files = [] } = data;
    agg.totalFiles += summary.total_files || 0;
    agg.totalPassed += summary.passed || 0;
    agg.totalFailed += summary.failed || 0;
    agg.totalCompileErrors += summary.compile_errors || 0;
    agg.totalValidationErrors += summary.validation_errors || 0;
    mergeCategories(agg.errorCategories, error_categories);
    for (const f of failed_files || []) {
      agg.failedFiles.set(f, (agg.failedFiles.get(f) || 0) + 1);
    }
  }

  return agg;
}

function formatPercent(numerator, denominator) {
  if (denominator === 0) return "n/a";
  return ((numerator / denominator) * 100).toFixed(1) + "%";
}

function printScoreboard(runs, agg) {
  console.log("=== SCPCB Compiler Scoreboard ===");
  console.log(`Runs analyzed: ${agg.totalRuns}`);
  console.log("");

  console.log("Per-run summaries:");
  for (const { file, data } of runs) {
    const ts = data.test_run?.timestamp ?? "unknown";
    const sum = data.summary ?? {};
    console.log(
      `- ${path.basename(file)} @ ${ts}: ${sum.passed ?? 0}/${
        sum.total_files ?? 0
      } passed ` +
        `(compileErr=${sum.compile_errors ?? 0}, validateErr=${
          sum.validation_errors ?? 0
        })`,
    );
  }
  console.log("");

  const overallPassRate = formatPercent(agg.totalPassed, agg.totalFiles);
  const overallValidateFail = agg.totalValidationErrors;
  const overallCompileFail = agg.totalCompileErrors;

  console.log("Aggregated totals:");
  console.log(
    `- Total files: ${agg.totalFiles}, Passed: ${agg.totalPassed}, Failed: ${agg.totalFailed} (pass rate: ${overallPassRate})`,
  );
  console.log(
    `- Compile errors: ${overallCompileFail}, Validation errors: ${overallValidateFail}`,
  );
  console.log("");

  const topCategories = Object.entries(agg.errorCategories)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  console.log("Top error categories (all runs):");
  for (const [cat, count] of topCategories) {
    console.log(`- ${cat}: ${count}`);
  }
  if (!topCategories.length) console.log("- none");
  console.log("");

  const topFailed = Array.from(agg.failedFiles.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  console.log("Most frequently failing files:");
  for (const [file, count] of topFailed) {
    console.log(`- ${file}: ${count} run(s)`);
  }
  if (!topFailed.length) console.log("- none");
}

async function main() {
  const pattern = process.argv[2] || "../compile_errors_*.json";
  const runs = await loadRuns(pattern);
  const agg = aggregate(runs);
  printScoreboard(runs, agg);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
