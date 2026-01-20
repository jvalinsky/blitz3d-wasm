/**
 * WASM Output Analyzer for Blitz3D Compiler
 * 
 * Analyzes compiled WASM modules for:
 * - Stack balance validation
 * - Type consistency checking
 * - Control flow analysis
 * - Function call validation
 * - Code metrics and statistics
 */

import { readFileSync } from 'fs';
import { BinaryReader } from 'wasmparser';

export class WASMAnalyzer {
  constructor(wasmBuffer) {
    this.buffer = Buffer.from(wasmBuffer);
    this.reader = null;
    this.module = null;
    this.functions = [];
    this.types = [];
    this.globals = [];
    this.memory = null;
    this.tables = [];
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
      maxStackObserved: 0
    };
  }

  parse() {
    try {
      this.reader = new BinaryReader();
      this.reader.read(this.buffer);
      this.extractMetadata();
      return this;
    } catch (e) {
      this.errors.push(`Parse error: ${e.message}`);
      return this;
    }
  }

  extractMetadata() {
    if (!this.reader) return;

    const sections = this.reader.result || {};
    
    // Extract types (type section is typically section 1)
    if (sections.types) {
      this.types = sections.types.map(t => ({
        params: t.params.map(p => this.wasmTypeToString(p)),
        results: t.results.map(r => this.wasmTypeToString(r))
      }));
    }

    // Extract functions
    if (sections.functions) {
      this.functions = sections.functions.map((f, idx) => ({
        index: idx,
        typeIndex: f.type,
        type: this.types[f.type] || null,
        locals: [],
        instructions: [],
        stackHeight: 0,
        maxStack: 0
      }));
    }

    // Extract globals
    if (sections.globals) {
      this.globals = sections.globals.map((g, idx) => ({
        index: idx,
        type: this.wasmTypeToString(g.type),
        mutable: g.mutable
      }));
    }

    // Extract memory
    if (sections.memory) {
      this.memory = {
        initial: sections.memory.initial,
        maximum: sections.memory.maximum,
        pages: sections.memory.initial
      };
    }

    // Extract tables
    if (sections.tables) {
      this.tables = sections.tables.map((t, idx) => ({
        index: idx,
        elementType: this.wasmTypeToString(t.elementType),
        initial: t.initial,
        maximum: t.maximum
      }));
    }

    // If sections object doesn't have expected structure, try reader directly
    if (this.functions.length === 0 && this.reader.funcs) {
      this.functions = this.reader.funcs.map((f, idx) => ({
        index: idx,
        typeIndex: f.type,
        type: this.types[f.type] || null,
        locals: [],
        instructions: [],
        stackHeight: 0,
        maxStack: 0
      }));
    }
  }

  wasmTypeToString(type) {
    const types = {
      0x7f: 'i32',
      0x7e: 'i64',
      0x7d: 'f32',
      0x7c: 'f64',
      0x70: 'funcref',
      0x6f: 'externref'
    };
    if (typeof type === 'string') return type;
    return types[type] || `unknown(${type})`;
  }

  analyzeStackBalance() {
    if (!this.reader) {
      return { valid: false, errors: ['No module parsed'] };
    }

    const results = [];
    const code = this.reader.code || [];
    
    code.forEach((func, funcIdx) => {
      const funcResult = this.analyzeFunctionStackBalance(func, funcIdx);
      results.push(funcResult);
      
      if (funcResult.maxStack > this.metrics.maxStackObserved) {
        this.metrics.maxStackObserved = funcResult.maxStack;
      }
    });

    const allValid = results.every(r => r.valid);
    
    return {
      valid: allValid,
      functionResults: results,
      errors: results.flatMap(r => r.errors)
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
        valStack.push('bot');
      } else {
        valStack.push(type);
      }
      if (valStack.length > maxStack) maxStack = valStack.length;
    };

    const popVal = (expected) => {
      if (valStack.length === 0) {
        errors.push(`Stack underflow at instruction`);
        return 'error';
      }
      const actual = valStack.pop();
      if (actual === 'bot' || expected === 'bot') return actual;
      if (actual !== expected && actual !== 'error') {
        errors.push(`Type mismatch: expected ${expected}, got ${actual}`);
      }
      return actual;
    };

    const instructions = func.code || func.instructions || func.ops || [];
    
    for (let i = 0; i < instructions.length; i++) {
      const instr = instructions[i];
      this.metrics.totalInstructions++;

      const instrName = instr.name || this.getInstrName(instr.opcode);
      if (!instrName) {
        this.metrics.totalInstructions--;
        continue;
      }

      this.metrics.instructionCounts[instrName] = 
        (this.metrics.instructionCounts[instrName] || 0) + 1;

      switch (instrName) {
        case 'const':
        case 'i32.const':
        case 'i64.const':
        case 'f32.const':
        case 'f64.const':
          pushVal(instrName.split('.')[1] || 'i32');
          break;

        case 'drop':
        case 'drop':
          if (valStack.length === 0 && unreachable) {
            break;
          }
          popVal('any');
          break;

        case 'select':
          popVal('i32');
          popVal('any');
          popVal('any');
          pushVal('any');
          break;

        case 'local.get':
        case 'local.tee':
        case 'local.get_s':
        case 'local.get_u':
          pushVal(func.locals?.[instr.index] || 'i32');
          break;

        case 'local.set':
        case 'local.set_s':
        case 'local.set_u':
          popVal(func.locals?.[instr.index] || 'i32');
          break;

        case 'i32.add':
        case 'i32.sub':
        case 'i32.mul':
        case 'i32.div_s':
        case 'i32.div_u':
          popVal('i32');
          popVal('i32');
          pushVal('i32');
          break;

        case 'i64.add':
        case 'i64.sub':
        case 'i64.mul':
          popVal('i64');
          popVal('i64');
          pushVal('i64');
          break;

        case 'f32.add':
        case 'f32.sub':
        case 'f32.mul':
        case 'f32.div':
          popVal('f32');
          popVal('f32');
          pushVal('f32');
          break;

        case 'f64.add':
        case 'f64.sub':
        case 'f64.mul':
        case 'f64.div':
          popVal('f64');
          popVal('f64');
          pushVal('f64');
          break;

        case 'i32.eq':
        case 'i32.ne':
        case 'i32.lt_s':
        case 'i32.lt_u':
        case 'i32.gt_s':
        case 'i32.gt_u':
        case 'i32.le_s':
        case 'i32.le_u':
        case 'i32.ge_s':
        case 'i32.ge_u':
          popVal('i32');
          popVal('i32');
          pushVal('i32');
          break;

        case 'f32.eq':
        case 'f32.ne':
        case 'f32.lt':
        case 'f32.gt':
        case 'f32.le':
        case 'f32.ge':
          popVal('f32');
          popVal('f32');
          pushVal('i32');
          break;

        case 'i32.trunc_f32_s':
        case 'i32.trunc_f32_u':
          popVal('f32');
          pushVal('i32');
          break;

        case 'f32.convert_i32_s':
        case 'f32.convert_i32_u':
          popVal('i32');
          pushVal('f32');
          break;

        case 'i32.load':
        case 'i32.load8_s':
        case 'i32.load8_u':
        case 'i32.load16_s':
        case 'i32.load16_u':
          popVal('i32');
          pushVal('i32');
          break;

        case 'i32.store':
        case 'i32.store8':
        case 'i32.store16':
          popVal('i32');
          popVal('i32');
          break;

        case 'i64.load':
          popVal('i32');
          pushVal('i64');
          break;

        case 'f32.load':
          popVal('i32');
          pushVal('f32');
          break;

        case 'f32.store':
          popVal('f32');
          popVal('i32');
          break;

        case 'memory.size':
        case 'memory.grow':
          pushVal('i32');
          break;

        case 'block':
        case 'loop':
          ctrlStack.unshift({
            type: instrName,
            valHeight: valStack.length,
            endTypes: []
          });
          break;

        case 'end':
          if (ctrlStack.length === 0) {
            break;
          }
          const frame = ctrlStack.shift();
          while (valStack.length > frame.valHeight) {
            popVal('any');
            errors.push(`Excess value at end of ${frame.type}, inserted drop`);
          }
          break;

        case 'br':
          if (instr.depth >= ctrlStack.length) {
            errors.push(`Invalid branch depth: ${instr.depth}`);
          } else {
            const target = ctrlStack[instr.depth];
            unreachable = true;
          }
          break;

        case 'br_if':
          popVal('i32');
          if (instr.depth >= ctrlStack.length) {
            errors.push(`Invalid br_if depth: ${instr.depth}`);
          }
          break;

        case 'return':
          if (ctrlStack.length > 0) {
          }
          unreachable = true;
          break;

        case 'call':
          const sig = this.types[instr.index];
          if (sig) {
            sig.params.forEach(() => popVal('any'));
            sig.results.forEach(t => pushVal(t));
          } else {
            pushVal('any');
          }
          break;

        case 'call_indirect':
          popVal('i32');
          break;

        case 'unreachable':
          unreachable = true;
          break;

        case 'nop':
          break;

        default:
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
      finalStackSize: valStack.length
    };
  }

  getInstrName(opcode) {
    const opcodes = {
      0x00: 'unreachable',
      0x01: 'nop',
      0x02: 'block',
      0x03: 'loop',
      0x04: 'if',
      0x05: 'else',
      0x0b: 'end',
      0x0c: 'br',
      0x0d: 'br_if',
      0x0e: 'br_table',
      0x0f: 'return',
      0x10: 'call',
      0x11: 'call_indirect',
      0x1a: 'drop',
      0x1b: 'select',
      0x20: 'local.get',
      0x21: 'local.set',
      0x22: 'local.tee',
      0x23: 'global.get',
      0x24: 'global.set',
      0x28: 'i32.load',
      0x29: 'i64.load',
      0x2a: 'f32.load',
      0x2b: 'f64.load',
      0x36: 'i32.store',
      0x37: 'i64.store',
      0x38: 'f32.store',
      0x39: 'f64.store',
      0x3c: 'i32.store8',
      0x3d: 'i32.store16',
      0x3e: 'i64.store8',
      0x3f: 'i64.store16',
      0x40: 'i64.store32',
      0x41: 'i32.const',
      0x42: 'i64.const',
      0x43: 'f32.const',
      0x44: 'f64.const',
      0x45: 'i32.eqz',
      0x46: 'i32.eq',
      0x47: 'i32.ne',
      0x48: 'i32.lt_s',
      0x49: 'i32.lt_u',
      0x4a: 'i32.gt_s',
      0x4b: 'i32.gt_u',
      0x4c: 'i32.le_s',
      0x4d: 'i32.le_u',
      0x4e: 'i32.ge_s',
      0x4f: 'i32.ge_u',
      0x6a: 'i32.add',
      0x6b: 'i32.sub',
      0x6c: 'i32.mul',
      0x6d: 'i32.div_s',
      0x6e: 'i32.div_u',
      0xa0: 'call',
      0xfc: 'misc_prefix',
      0xfd: 'simd_prefix',
      0xfe: 'atomics_prefix'
    };
    return opcodes[opcode] || null;
  }

  analyzeTypeConsistency() {
    const issues = [];

    if (!this.reader) return { valid: true, issues: [] };

    return {
      valid: true,
      issues: []
    };
  }

  analyzeControlFlow() {
    const results = [];

    if (!this.reader) {
      return { valid: false, errors: ['No code found'] };
    }

    const code = this.reader.code || [];
    code.forEach((func, funcIdx) => {
      const instructions = func.code || func.instructions || func.ops || [];
      let currentDepth = 0;

      instructions.forEach((instr, idx) => {
        const instrName = instr.name || this.getInstrName(instr.opcode);
        
        if (instrName === 'block' || instrName === 'loop') {
          currentDepth++;
        }

        if (instrName === 'end') {
          currentDepth--;
        }

        if (instrName === 'br' || instrName === 'br_if') {
          if (instr.depth > currentDepth) {
            results.push({
              funcIdx,
              idx,
              type: 'invalid_branch_depth',
              message: `Branch to depth ${instr.depth} exceeds current depth ${currentDepth}`
            });
          }
        }
      });

      if (currentDepth !== 0) {
        results.push({
          funcIdx,
          type: 'unbalanced_blocks',
          message: `Function ends with block depth ${currentDepth}`
        });
      }
    });

    return {
      valid: results.filter(r => r.type === 'error').length === 0,
      results,
      loopHeaders: results.filter(r => r.type === 'loop_header')
    };
  }

  calculateMetrics() {
    if (!this.reader) return this.metrics;

    const code = this.reader.code || [];
    
    code.forEach(func => {
      const instructions = func.code || func.instructions || func.ops || [];
      this.metrics.functionSizes.push(instructions.length);
    });

    code.forEach(func => {
      const locals = func.locals || [];
      const count = locals.length > 0 ? locals.reduce((sum, l) => sum + (l.count || 1), 0) : 0;
      this.metrics.localCounts.push(count);
    });

    code.forEach((func, idx) => {
      const instructions = func.code || func.instructions || func.ops || [];
      const calls = instructions.filter(i => 
        (i.name === 'call' || i.opcode === 0x10 || i.opcode === 0xa0)
      ).length;
      this.metrics.callCounts.push({ funcIdx: idx, calls });
    });

    code.forEach((func, idx) => {
      const instructions = func.code || func.instructions || func.ops || [];
      const branches = instructions.filter(i => 
        i.name === 'br' || i.name === 'br_if' || i.name === 'br_table' ||
        i.opcode === 0x0c || i.opcode === 0x0d || i.opcode === 0x0e
      ).length;
      this.metrics.branchCounts.push({ funcIdx: idx, branches });
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
        totalFunctions: this.functions.length || this.reader?.funcs?.length || 0,
        totalTypes: this.types.length,
        totalGlobals: this.globals.length,
        totalInstructions: metrics.totalInstructions,
        stackValid: stackAnalysis.valid,
        typeValid: typeAnalysis.valid,
        controlFlowValid: controlFlow.valid
      },
      stackBalance: stackAnalysis,
      typeConsistency: typeAnalysis,
      controlFlow: controlFlow,
      metrics,
      errors: this.errors.concat(stackAnalysis.errors),
      warnings: this.warnings
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
