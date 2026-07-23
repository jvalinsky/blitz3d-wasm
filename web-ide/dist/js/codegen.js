"use strict";
/**
 * Blitz3D Code Generator - WASM Text Format
 *
 * Generates WebAssembly Text Format (WAT) from AST
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodeGenerator = void 0;
class CodeGenerator {
  constructor() {
    this.output = [];
    this.indent = 0;
    this.localIndex = 0;
    this.locals = new Map();
    this.globals = new Map();
    this.functions = new Map();
    this.nextFunctionIndex = 0;
    this.stringLiterals = new Map();
    this.nextStringIndex = 0;
  }
  generate(program) {
    this.emit("(module");
    this.indent++;
    // Import JavaScript runtime functions
    this.emitRuntimeImports();
    // Memory
    this.emit('(memory (export "memory") 1)');
    // String data section
    this.emitStringData(program);
    // Generate functions
    for (const stmt of program.statements) {
      if (stmt.type === "FunctionDeclaration") {
        this.generateFunction(stmt);
      }
    }
    // Generate main entry point if needed
    this.generateMainFunction(program);
    this.indent--;
    this.emit(")");
    return this.output.join("\n");
  }
  emitRuntimeImports() {
    // Basic runtime functions
    this.emit('(import "env" "print" (func $print (param i32)))');
    this.emit('(import "env" "printFloat" (func $printFloat (param f32)))');
    this.emit('(import "env" "printString" (func $printString (param i32)))');
    this.emit("");
  }
  emitStringData(program) {
    // Collect all string literals
    this.collectStringLiterals(program);
    if (this.stringLiterals.size > 0) {
      this.emit(";; String data section");
      let offset = 0;
      for (const [str, index] of this.stringLiterals.entries()) {
        const escaped = str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
        this.emit(`(data (i32.const ${offset}) "${escaped}\\00")`);
        offset += str.length + 1; // +1 for null terminator
      }
      this.emit("");
    }
  }
  collectStringLiterals(node) {
    if (!node || typeof node !== "object") {
      return;
    }
    if (node.type === "StringLiteral" && !this.stringLiterals.has(node.value)) {
      this.stringLiterals.set(node.value, this.nextStringIndex++);
    }
    // Recursively collect from all properties
    for (const key in node) {
      if (Array.isArray(node[key])) {
        node[key].forEach((item) => this.collectStringLiterals(item));
      } else if (typeof node[key] === "object") {
        this.collectStringLiterals(node[key]);
      }
    }
  }
  generateFunction(func) {
    this.locals.clear();
    this.localIndex = 0;
    // Register function
    const funcIndex = this.nextFunctionIndex++;
    this.functions.set(func.name, {
      index: funcIndex,
      params: func.parameters.map((p) => this.typeToWasm(p.type)),
      returns: func.returnType ? this.typeToWasm(func.returnType) : "",
    });
    // Function signature
    const params = func.parameters.map((p, i) => {
      const wasmType = this.typeToWasm(p.type);
      this.locals.set(p.name, { index: i, type: wasmType });
      this.localIndex++;
      return `(param $${p.name} ${wasmType})`;
    }).join(" ");
    const returns = func.returnType
      ? `(result ${this.typeToWasm(func.returnType)})`
      : "";
    this.emit(
      `(func $${func.name} (export "${func.name}") ${params} ${returns}`,
    );
    this.indent++;
    // Local variables (we'll add them as we encounter them)
    const localDecls = [];
    // Generate function body
    for (const stmt of func.body) {
      this.generateStatement(stmt);
    }
    // Add default return if no explicit return
    if (func.returnType) {
      const wasmType = this.typeToWasm(func.returnType);
      if (wasmType === "i32") {
        this.emit("i32.const 0");
      } else if (wasmType === "f32") {
        this.emit("f32.const 0");
      }
    }
    this.indent--;
    this.emit(")");
    this.emit("");
  }
  generateMainFunction(program) {
    // Generate main function from top-level statements
    const topLevelStmts = program.statements.filter((s) =>
      s.type !== "FunctionDeclaration" && s.type !== "TypeDeclaration"
    );
    if (topLevelStmts.length === 0) {
      return;
    }
    this.emit('(func $main (export "main")');
    this.indent++;
    // First pass: collect all local declarations
    const localDecls = [];
    const stmtOutputs = [];
    for (const stmt of topLevelStmts) {
      const beforeLocals = this.localIndex;
      const beforeOutput = this.output.length;
      this.generateStatement(stmt);
      // Extract any local declarations that were added
      const newOutput = this.output.slice(beforeOutput);
      const locals = [];
      const nonLocals = [];
      for (const line of newOutput) {
        if (line.trim().startsWith("(local ")) {
          locals.push(line);
        } else {
          nonLocals.push(line);
        }
      }
      // Remove the output we just processed
      this.output = this.output.slice(0, beforeOutput);
      localDecls.push(...locals);
      stmtOutputs.push(nonLocals);
    }
    // Emit all locals first
    for (const local of localDecls) {
      this.output.push(local);
    }
    // Then emit all statement code
    for (const stmtOutput of stmtOutputs) {
      this.output.push(...stmtOutput);
    }
    this.indent--;
    this.emit(")");
    this.emit("");
    // Start function
    this.emit("(start $main)");
  }
  generateStatement(stmt) {
    switch (stmt.type) {
      case "VariableDeclaration":
        this.generateVariableDeclaration(stmt);
        break;
      case "ExpressionStatement":
        // Check if this is an assignment or function call (which don't return values in statement context)
        if (stmt.expression.type === "Assignment") {
          this.generateAssignmentStatement(stmt.expression);
        } else if (stmt.expression.type === "FunctionCall") {
          this.generateFunctionCall(stmt.expression);
          // Don't drop - Print and other void functions don't return a value
        } else {
          this.generateExpression(stmt.expression);
          this.emit("drop"); // Discard result
        }
        break;
      case "IfStatement":
        this.generateIfStatement(stmt);
        break;
      case "ForLoop":
        this.generateForLoop(stmt);
        break;
      case "WhileLoop":
        this.generateWhileLoop(stmt);
        break;
      case "ReturnStatement":
        if (stmt.value) {
          this.generateExpression(stmt.value);
        }
        this.emit("return");
        break;
      default:
        this.emit(`; TODO: ${stmt.type}`);
    }
  }
  generateVariableDeclaration(decl) {
    const wasmType = this.typeToWasm(decl.varType);
    if (decl.scope === "global") {
      const globalIndex = this.globals.size;
      this.globals.set(decl.name, { index: globalIndex, type: wasmType });
      // Emit global declaration
      const initialValue = decl.initializer
        ? this.expressionToString(decl.initializer)
        : (wasmType === "i32" ? "i32.const 0" : "f32.const 0");
      this.emit(`(global $${decl.name} (mut ${wasmType}) (${initialValue}))`);
    } else {
      // Local variable
      const localIndex = this.localIndex++;
      this.locals.set(decl.name, { index: localIndex, type: wasmType });
      this.emit(`(local $${decl.name} ${wasmType})`);
      if (decl.initializer) {
        this.generateExpression(decl.initializer);
        this.emit(`local.set $${decl.name}`);
      }
    }
  }
  generateIfStatement(stmt) {
    // Generate condition
    this.generateExpression(stmt.condition);
    this.emit("(if");
    this.indent++;
    this.emit("(then");
    this.indent++;
    for (const s of stmt.thenBranch) {
      this.generateStatement(s);
    }
    this.indent--;
    this.emit(")");
    if (stmt.elseBranch && stmt.elseBranch.length > 0) {
      this.emit("(else");
      this.indent++;
      for (const s of stmt.elseBranch) {
        this.generateStatement(s);
      }
      this.indent--;
      this.emit(")");
    }
    this.indent--;
    this.emit(")");
  }
  generateForLoop(loop) {
    // Initialize loop variable
    this.generateExpression(loop.start);
    const wasmType = "i32"; // For now assume int
    const varIndex = this.localIndex++;
    this.locals.set(loop.variable, { index: varIndex, type: wasmType });
    this.emit(`(local $${loop.variable} ${wasmType})`);
    this.emit(`local.set $${loop.variable}`);
    // Calculate end value (store in temp)
    this.generateExpression(loop.end);
    const endVarIndex = this.localIndex++;
    this.emit(`(local $__for_end_${varIndex} ${wasmType})`);
    this.emit(`local.set $__for_end_${varIndex}`);
    // Loop
    this.emit("(block $break");
    this.indent++;
    this.emit("(loop $continue");
    this.indent++;
    // Check condition
    this.emit(`local.get $${loop.variable}`);
    this.emit(`local.get $__for_end_${varIndex}`);
    this.emit("i32.gt_s");
    this.emit("br_if $break");
    // Loop body
    for (const stmt of loop.body) {
      this.generateStatement(stmt);
    }
    // Increment
    this.emit(`local.get $${loop.variable}`);
    if (loop.step) {
      this.generateExpression(loop.step);
    } else {
      this.emit("i32.const 1");
    }
    this.emit("i32.add");
    this.emit(`local.set $${loop.variable}`);
    this.emit("br $continue");
    this.indent--;
    this.emit(")");
    this.indent--;
    this.emit(")");
  }
  generateWhileLoop(loop) {
    this.emit("(block $break");
    this.indent++;
    this.emit("(loop $continue");
    this.indent++;
    // Check condition
    this.generateExpression(loop.condition);
    this.emit("i32.eqz");
    this.emit("br_if $break");
    // Loop body
    for (const stmt of loop.body) {
      this.generateStatement(stmt);
    }
    this.emit("br $continue");
    this.indent--;
    this.emit(")");
    this.indent--;
    this.emit(")");
  }
  generateExpression(expr) {
    switch (expr.type) {
      case "IntegerLiteral":
        this.emit(`i32.const ${expr.value}`);
        break;
      case "FloatLiteral":
        this.emit(`f32.const ${expr.value}`);
        break;
      case "StringLiteral": {
        const index = this.stringLiterals.get(expr.value) || 0;
        // Return pointer to string in memory
        let offset = 0;
        for (const [str, idx] of this.stringLiterals.entries()) {
          if (idx === index) {
            break;
          }
          offset += str.length + 1;
        }
        this.emit(`i32.const ${offset}`);
        break;
      }
      case "Identifier": {
        const varName = expr.name;
        // Try to find variable with or without type suffix
        let local = this.locals.get(varName);
        if (!local) {
          // Try with % suffix (int)
          local = this.locals.get(varName + "%");
        }
        if (!local) {
          // Try with # suffix (float)
          local = this.locals.get(varName + "#");
        }
        if (!local) {
          // Try with $ suffix (string)
          local = this.locals.get(varName + "$");
        }
        if (local) {
          // Use the actual variable name with suffix
          const actualName = Array.from(this.locals.keys()).find((k) =>
            k === varName ||
            k.startsWith(varName) && k.length === varName.length + 1
          );
          this.emit(`local.get $${actualName}`);
        } else {
          const global = this.globals.get(varName);
          if (global) {
            this.emit(`global.get $${varName}`);
          } else {
            this.emit(`; ERROR: Unknown identifier ${varName}`);
            this.emit("i32.const 0");
          }
        }
        break;
      }
      case "BinaryOp":
        this.generateBinaryOp(expr);
        break;
      case "UnaryOp":
        this.generateExpression(expr.operand);
        if (expr.operator === "Not") {
          this.emit("i32.eqz");
        } else if (expr.operator === "-") {
          this.emit("i32.const -1");
          this.emit("i32.mul");
        }
        break;
      case "FunctionCall":
        this.generateFunctionCall(expr);
        break;
      case "Assignment":
        this.generateAssignment(expr);
        break;
      default:
        this.emit(`; TODO: Expression ${expr.type}`);
        this.emit("i32.const 0");
    }
  }
  generateBinaryOp(expr) {
    this.generateExpression(expr.left);
    this.generateExpression(expr.right);
    // Determine type (simplified - assume i32 for now)
    const op = expr.operator;
    switch (op) {
      case "+":
        this.emit("i32.add");
        break;
      case "-":
        this.emit("i32.sub");
        break;
      case "*":
        this.emit("i32.mul");
        break;
      case "/":
        this.emit("i32.div_s");
        break;
      case "Mod":
        this.emit("i32.rem_s");
        break;
      case "=":
      case "==":
        this.emit("i32.eq");
        break;
      case "<>":
      case "!=":
        this.emit("i32.ne");
        break;
      case "<":
        this.emit("i32.lt_s");
        break;
      case "<=":
        this.emit("i32.le_s");
        break;
      case ">":
        this.emit("i32.gt_s");
        break;
      case ">=":
        this.emit("i32.ge_s");
        break;
      case "And":
        this.emit("i32.and");
        break;
      case "Or":
        this.emit("i32.or");
        break;
      default:
        this.emit(`; Unknown operator: ${op}`);
    }
  }
  generateFunctionCall(expr) {
    // Special built-in functions
    if (expr.name.type === "Identifier") {
      const funcName = expr.name.name.toLowerCase();
      if (funcName === "print") {
        if (expr.arguments.length > 0) {
          this.generateExpression(expr.arguments[0]);
          // Check if argument is a string literal
          const arg = expr.arguments[0];
          if (arg.kind === "StringLiteral") {
            this.emit("call $printString");
          } else {
            this.emit("call $print");
          }
        }
        return;
      }
    }
    // Regular function call
    for (const arg of expr.arguments) {
      this.generateExpression(arg);
    }
    if (expr.name.type === "Identifier") {
      const funcName = expr.name.name;
      this.emit(`call $${funcName}`);
    }
  }
  generateAssignmentStatement(expr) {
    // Assignment as a statement (no return value)
    if (expr.target.type === "Identifier") {
      const varName = expr.target.name;
      let local = this.locals.get(varName);
      // Auto-declare variable if it doesn't exist
      if (!local && !this.globals.has(varName)) {
        const wasmType = "i32";
        const localIndex = this.localIndex++;
        this.locals.set(varName, { index: localIndex, type: wasmType });
        this.emit(`(local $${varName} ${wasmType})`);
        local = this.locals.get(varName);
      }
      // Generate value and set
      this.generateExpression(expr.value);
      if (local) {
        this.emit(`local.set $${varName}`);
      } else {
        const global = this.globals.get(varName);
        if (global) {
          this.emit(`global.set $${varName}`);
        }
      }
    }
  }
  generateAssignment(expr) {
    // Set target
    if (expr.target.type === "Identifier") {
      const varName = expr.target.name;
      let local = this.locals.get(varName);
      // Auto-declare variable if it doesn't exist (Blitz3D implicit declaration)
      if (!local && !this.globals.has(varName)) {
        const wasmType = "i32"; // Default to int for now
        const localIndex = this.localIndex++;
        this.locals.set(varName, { index: localIndex, type: wasmType });
        this.emit(`(local $${varName} ${wasmType})`);
        local = this.locals.get(varName);
      }
      // Generate value
      this.generateExpression(expr.value);
      if (local) {
        this.emit(`local.set $${varName}`);
      } else {
        const global = this.globals.get(varName);
        if (global) {
          this.emit(`global.set $${varName}`);
        }
      }
    }
    // Assignment also returns the value
    if (expr.target.type === "Identifier") {
      const varName = expr.target.name;
      const local = this.locals.get(varName);
      if (local) {
        this.emit(`local.get $${varName}`);
      } else {
        const global = this.globals.get(varName);
        if (global) {
          this.emit(`global.get $${varName}`);
        }
      }
    }
  }
  expressionToString(expr) {
    if (expr.type === "IntegerLiteral") {
      return `i32.const ${expr.value}`;
    } else if (expr.type === "FloatLiteral") {
      return `f32.const ${expr.value}`;
    }
    return "i32.const 0";
  }
  typeToWasm(type) {
    if (type.kind === "primitive") {
      switch (type.name) {
        case "Int":
          return "i32";
        case "Float":
          return "f32";
        case "String":
          return "i32"; // Pointer to string
        default:
          return "i32";
      }
    }
    return "i32";
  }
  emit(line) {
    this.output.push("  ".repeat(this.indent) + line);
  }
}
exports.CodeGenerator = CodeGenerator;
