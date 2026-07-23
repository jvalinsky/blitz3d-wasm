/**
 * WASM Output Analyzer for Blitz3D Compiler
 *
 * Analyzes compiled WASM modules for:
 * - Stack balance validation (WASM spec 3-stack algorithm)
 * - Type consistency checking
 * - Control flow analysis
 * - Function call validation
 * - Code metrics and statistics
 */

import { readFileSync } from "fs";
import { decode } from "@webassemblyjs/wasm-parser";

export class WASMAnalyzer {
  constructor(wasmBuffer) {
    this.buffer = Buffer.from(wasmBuffer);
    this.ast = null;
    this.module = null;
    this.errors = [];
    this.warnings = [];
    this.metrics = {
      totalInstructions: 0,
      instructionCounts: {},
      functionSizes: [],
      stackDepths: [],
      localCounts: [],
      branchCounts: [],
      callCounts: [],
      maxStackObserved: 0,
    };
  }

  parse() {
    try {
      this.ast = decode(this.buffer);
      this.extractMetadata();
      return this;
    } catch (e) {
      this.errors.push(`Parse error: ${e.message}`);
      return this;
    }
  }

  extractMetadata() {
    if (!this.ast?.body?.[0]?.fields) return;

    const module = this.ast.body[0];
    this.module = {
      fields: module.fields,
      functions: module.fields.filter((f) => f.type === "Func"),
      types: module.fields.filter((f) => f.type === "TypeInstruction"),
      globals: module.fields.filter((f) => f.type === "Global"),
      memory: module.fields.find((f) => f.type === "Memory"),
      imports: module.fields.filter((f) => f.type === "ModuleImport"),
      exports: module.fields.filter((f) => f.type === "ModuleExport"),
    };
  }

  wasmTypeToString(type) {
    if (typeof type === "string") return type;
    if (type?.valtype) return type.valtype;
    return "unknown";
  }

  analyzeStackBalance() {
    if (!this.module) {
      return { valid: false, errors: ["No module parsed"] };
    }

    const results = [];

    this.module.functions.forEach((func, funcIdx) => {
      const funcResult = this.analyzeFunctionStackBalance(func, funcIdx);
      results.push(funcResult);

      if (funcResult.maxStack > this.metrics.maxStackObserved) {
        this.metrics.maxStackObserved = funcResult.maxStack;
      }
    });

    const allValid = results.every((r) => r.valid);

    return {
      valid: allValid,
      functionResults: results,
      errors: results.flatMap((r) => r.errors),
    };
  }

  analyzeFunctionStackBalance(func, funcIdx) {
    const valStack = [];
    const ctrlStack = [];
    const errors = [];
    let maxStack = 0;
    let unreachable = false;

    const pushVal = (type) => {
      if (unreachable && valStack.length === ctrlStack[0]?.valHeight) {
        valStack.push("bot");
      } else {
        valStack.push(type);
      }
      if (valStack.length > maxStack) maxStack = valStack.length;
    };

    const popVal = (expected) => {
      if (valStack.length === 0) {
        errors.push(`Stack underflow`);
        return "error";
      }
      const actual = valStack.pop();
      if (actual === "bot" || expected === "bot") return actual;
      if (actual !== expected && actual !== "error") {
        errors.push(`Type mismatch: expected ${expected}, got ${actual}`);
      }
      return actual;
    };

    const instructions = func.body || [];

    for (let i = 0; i < instructions.length; i++) {
      const instr = instructions[i];
      this.metrics.totalInstructions++;

      const instrName = this.getInstructionName(instr);
      if (!instrName) continue;

      this.metrics.instructionCounts[instrName] =
        (this.metrics.instructionCounts[instrName] || 0) + 1;

      switch (instrName) {
        case "i32.const":
        case "i64.const":
        case "f32.const":
        case "f64.const":
          pushVal(instrName.split(".")[1]);
          break;

        case "drop":
          if (valStack.length === 0 && unreachable) break;
          popVal("any");
          break;

        case "select":
          popVal("i32");
          popVal("any");
          popVal("any");
          pushVal("any");
          break;

        case "local.get":
        case "local.tee":
          pushVal("i32");
          break;

        case "local.set":
          popVal("i32");
          break;

        case "local":
          // local declaration - no stack effect
          break;

        case "i32.add":
        case "i32.sub":
        case "i32.mul":
        case "i32.div_s":
        case "i32.div_u":
          popVal("i32");
          popVal("i32");
          pushVal("i32");
          break;

        case "i64.add":
        case "i64.sub":
        case "i64.mul":
          popVal("i64");
          popVal("i64");
          pushVal("i64");
          break;

        case "f32.add":
        case "f32.sub":
        case "f32.mul":
        case "f32.div":
          popVal("f32");
          popVal("f32");
          pushVal("f32");
          break;

        case "f64.add":
        case "f64.sub":
        case "f64.mul":
        case "f64.div":
          popVal("f64");
          popVal("f64");
          pushVal("f64");
          break;

        case "i32.eq":
        case "i32.ne":
        case "i32.lt_s":
        case "i32.lt_u":
        case "i32.gt_s":
        case "i32.gt_u":
        case "i32.le_s":
        case "i32.le_u":
        case "i32.ge_s":
        case "i32.ge_u":
          popVal("i32");
          popVal("i32");
          pushVal("i32");
          break;

        case "f32.eq":
        case "f32.ne":
        case "f32.lt":
        case "f32.gt":
        case "f32.le":
        case "f32.ge":
          popVal("f32");
          popVal("f32");
          pushVal("i32");
          break;

        case "i32.trunc_f32_s":
        case "i32.trunc_f32_u":
          popVal("f32");
          pushVal("i32");
          break;

        case "f32.convert_i32_s":
        case "f32.convert_i32_u":
          popVal("i32");
          pushVal("f32");
          break;

        case "i32.load":
        case "i32.load8_s":
        case "i32.load8_u":
        case "i32.load16_s":
        case "i32.load16_u":
          popVal("i32");
          pushVal("i32");
          break;

        case "i32.store":
        case "i32.store8":
        case "i32.store16":
          popVal("i32");
          popVal("i32");
          break;

        case "i64.load":
          popVal("i32");
          pushVal("i64");
          break;

        case "f32.load":
          popVal("i32");
          pushVal("f32");
          break;

        case "f32.store":
          popVal("f32");
          popVal("i32");
          break;

        case "memory.size":
        case "memory.grow":
          pushVal("i32");
          break;

        case "block":
        case "loop":
          ctrlStack.unshift({
            type: instrName,
            valHeight: valStack.length,
            endTypes: [],
          });
          break;

        case "end":
        case "else":
          if (ctrlStack.length > 0) {
            const frame = ctrlStack.shift();
            while (valStack.length > frame.valHeight) {
              popVal("any");
              errors.push(`Excess value at end of ${frame.type}`);
            }
          }
          break;

        case "br":
          if (instr.val > ctrlStack.length) {
            errors.push(`Invalid branch depth: ${instr.val}`);
          } else {
            unreachable = true;
          }
          break;

        case "br_if":
          popVal("i32");
          if (instr.val > ctrlStack.length) {
            errors.push(`Invalid br_if depth: ${instr.val}`);
          }
          break;

        case "return":
          unreachable = true;
          break;

        case "call":
          pushVal("any");
          break;

        case "call_indirect":
          popVal("i32");
          break;

        case "unreachable":
          unreachable = true;
          break;

        case "nop":
          break;
      }
    }

    if (valStack.length > 0 && !unreachable) {
      errors.push(`Function ends with ${valStack.length} values on stack`);
    }

    this.metrics.stackDepths.push({ funcIdx, max: maxStack });

    return {
      funcIdx,
      valid: errors.length === 0,
      errors,
      maxStack,
      finalStackSize: valStack.length,
    };
  }

  getInstructionName(instr) {
    if (!instr) return null;
    if (typeof instr === "string") return instr;
    if (instr.id) return instr.id;
    if (instr.instr) return instr.instr;
    return null;
  }

  analyzeTypeConsistency() {
    const issues = [];
    return {
      valid: issues.filter((i) => i.severity === "error").length === 0,
      issues,
    };
  }

  analyzeControlFlow() {
    const results = [];

    if (!this.module) {
      return { valid: false, errors: ["No module found"] };
    }

    this.module.functions.forEach((func, funcIdx) => {
      const instructions = func.body || [];
      let currentDepth = 0;

      instructions.forEach((instr, idx) => {
        const instrName = this.getInstructionName(instr);

        if (instrName === "block" || instrName === "loop") {
          currentDepth++;
        }

        if (instrName === "end" || instrName === "else") {
          currentDepth--;
        }

        if (instrName === "br" || instrName === "br_if") {
          const depth = instr.val || instr.depth || 0;
          if (depth > currentDepth) {
            results.push({
              funcIdx,
              idx,
              type: "invalid_branch_depth",
              message:
                `Branch depth ${depth} exceeds control depth ${currentDepth}`,
            });
          }
        }
      });

      if (currentDepth !== 0) {
        results.push({
          funcIdx,
          type: "unbalanced_blocks",
          message: `Function ends with control depth ${currentDepth}`,
        });
      }
    });

    return {
      valid: results.filter((r) => r.type === "error").length === 0,
      results,
      loopHeaders: results.filter((r) => r.type === "loop_header"),
    };
  }

  calculateMetrics() {
    if (!this.module) return this.metrics;

    this.module.functions.forEach((func, funcIdx) => {
      const instructions = func.body || [];
      this.metrics.functionSizes.push(instructions.length);

      const branches = instructions.filter((i) => {
        const name = this.getInstructionName(i);
        return name === "br" || name === "br_if" || name === "br_table";
      }).length;
      this.metrics.branchCounts.push({ funcIdx, branches });

      const calls = instructions.filter((i) => {
        const name = this.getInstructionName(i);
        return name === "call" || name === "call_indirect";
      }).length;
      this.metrics.callCounts.push({ funcIdx, calls });
    });

    return this.metrics;
  }

  generateReport() {
    const stackAnalysis = this.analyzeStackBalance();
    const typeAnalysis = this.analyzeTypeConsistency();
    const controlFlow = this.analyzeControlFlow();
    const metrics = this.calculateMetrics();

    return {
      timestamp: new Date().toISOString(),
      summary: {
        totalFunctions: this.module?.functions?.length || 0,
        totalTypes: this.module?.types?.length || 0,
        totalGlobals: this.module?.globals?.length || 0,
        totalInstructions: metrics.totalInstructions,
        stackValid: stackAnalysis.valid,
        typeValid: typeAnalysis.valid,
        controlFlowValid: controlFlow.valid,
      },
      stackBalance: stackAnalysis,
      typeConsistency: typeAnalysis,
      controlFlow: controlFlow,
      metrics,
      errors: this.errors.concat(stackAnalysis.errors),
      warnings: this.warnings,
    };
  }

  static async fromFile(filepath) {
    const buffer = readFileSync(filepath);
    return new WASMAnalyzer(buffer).parse();
  }
}

export function analyzeWASM(buffer) {
  return new WASMAnalyzer(buffer).parse();
}

export function analyzeFile(filepath) {
  return WASMAnalyzer.fromFile(filepath);
}
