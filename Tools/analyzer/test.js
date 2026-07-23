#!/usr/bin/env node

/**
 * Quick test script to validate the analyzer works
 * Run: node test.js
 */

import { existsSync, readFileSync } from "fs";
import { WASMAnalyzer } from "./core.js";

async function runTests() {
  console.log("WASM Analyzer Test Suite\n" + "=".repeat(50));

  // Test 1: Load and parse a WASM file if available
  console.log("\n1. Testing WASM parsing...");
  try {
    if (existsSync("../test.wasm")) {
      const analysis = await WASMAnalyzer.fromFile("../test.wasm");
      const report = analysis.generateReport();
      console.log(`   ✓ Parsed ${report.summary.totalFunctions} functions`);
      console.log(`   ✓ ${report.summary.totalInstructions} instructions`);
      console.log(`   ✓ Stack valid: ${report.summary.stackValid}`);
    } else {
      console.log("   ⊘ No test.wasm found - skipping");
    }
  } catch (e) {
    console.log(`   ✗ Failed: ${e.message}`);
  }

  // Test 2: Generate sample analysis structure
  console.log("\n2. Testing report generation...");
  try {
    const mockAnalysis = {
      summary: {
        totalFunctions: 10,
        totalInstructions: 500,
        totalTypes: 5,
        totalGlobals: 3,
        stackValid: true,
        typeValid: true,
        controlFlowValid: true,
      },
      metrics: {
        totalInstructions: 500,
        instructionCounts: {
          "local.get": 120,
          "local.set": 80,
          "i32.add": 50,
          "i32.const": 100,
          "call": 30,
        },
        functionSizes: [45, 52, 38, 67, 43, 51, 39, 58, 44, 63],
        stackDepths: [
          { funcIdx: 0, max: 5 },
          { funcIdx: 1, max: 3 },
          { funcIdx: 2, max: 7 },
          { funcIdx: 3, max: 4 },
          { funcIdx: 4, max: 2 },
        ],
        localCounts: [3, 5, 2, 4, 6],
        branchCounts: [
          { funcIdx: 0, branches: 5 },
          { funcIdx: 1, branches: 3 },
          { funcIdx: 2, branches: 8 },
        ],
        callCounts: [
          { funcIdx: 0, calls: 10 },
          { funcIdx: 1, calls: 5 },
          { funcIdx: 2, calls: 15 },
        ],
        maxStackObserved: 7,
        memory: { pages: 2 },
      },
      stackBalance: {
        valid: true,
        functionResults: [
          { funcIdx: 0, valid: true, errors: [], maxStack: 5 },
          { funcIdx: 1, valid: true, errors: [], maxStack: 3 },
        ],
        errors: [],
      },
      typeConsistency: {
        valid: true,
        issues: [],
      },
      controlFlow: {
        valid: true,
        results: [],
        loopHeaders: [],
      },
      errors: [],
      warnings: ["Some local variables unused in function 2"],
    };

    const { ReportGenerator } = await import("./report.js");
    const generator = new ReportGenerator(mockAnalysis);
    const report = generator.generateTextReport();
    console.log("   ✓ Report generated successfully");
    console.log(`   ✓ Report length: ${report.length} chars`);
  } catch (e) {
    console.log(`   ✗ Failed: ${e.message}`);
  }

  // Test 3: Test visualization
  console.log("\n3. Testing visualization...");
  try {
    const { WASMVisualizer } = await import("./visualize.js");
    const mockAnalysis = {
      summary: {
        totalFunctions: 5,
        totalInstructions: 250,
        stackValid: true,
        typeValid: true,
        controlFlowValid: true,
      },
      metrics: {
        instructionCounts: {
          "local.get": 60,
          "i32.const": 50,
          "call": 25,
        },
        functionSizes: [45, 52, 38, 67, 43],
        stackDepths: [
          { funcIdx: 0, max: 5 },
          { funcIdx: 1, max: 3 },
          { funcIdx: 2, max: 7 },
        ],
        localCounts: [3, 5, 2, 4, 6],
        branchCounts: [],
        callCounts: [],
      },
      errors: [],
    };

    const visualizer = new WASMVisualizer(mockAnalysis);
    const dashboard = visualizer.generateSummaryDashboard();
    console.log("   ✓ Dashboard generated successfully");
    console.log(`   ✓ Dashboard length: ${dashboard.length} chars`);

    const stackChart = visualizer.generateStackDepthChart();
    console.log("   ✓ Stack chart generated");
  } catch (e) {
    console.log(`   ✗ Failed: ${e.message}`);
  }

  console.log("\n" + "=".repeat(50));
  console.log("Test suite complete!");
}

runTests().catch(console.error);
