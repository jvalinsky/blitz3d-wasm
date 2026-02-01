/**
 * Blitz3D Code Generator - WASM Text Format
 * 
 * Generates WebAssembly Text Format (WAT) from AST
 */

import * as AST from './ast';

// Built-in functions that we import from the JS runtime
const BUILTIN_FUNCTIONS: Record<string, { params: string[]; result: string }> = {
  // String functions (all take/return i32 pointers)
  'len':     { params: ['i32'], result: 'i32' },
  'left':    { params: ['i32', 'i32'], result: 'i32' },
  'right':   { params: ['i32', 'i32'], result: 'i32' },
  'mid':     { params: ['i32', 'i32', 'i32'], result: 'i32' },
  'instr':   { params: ['i32', 'i32', 'i32'], result: 'i32' },
  'upper':   { params: ['i32'], result: 'i32' },
  'lower':   { params: ['i32'], result: 'i32' },
  'trim':    { params: ['i32'], result: 'i32' },
  'chr':     { params: ['i32'], result: 'i32' },
  'asc':     { params: ['i32'], result: 'i32' },
  'str':     { params: ['i32'], result: 'i32' },
  'string':  { params: ['i32', 'i32'], result: 'i32' },
  'replace': { params: ['i32', 'i32', 'i32'], result: 'i32' },
  // Math functions (i32 in/out for simplicity — JS runtime does float conversion)
  'abs':     { params: ['i32'], result: 'i32' },
  'sgn':     { params: ['i32'], result: 'i32' },
  'sin':     { params: ['i32'], result: 'i32' },
  'cos':     { params: ['i32'], result: 'i32' },
  'tan':     { params: ['i32'], result: 'i32' },
  'asin':    { params: ['i32'], result: 'i32' },
  'acos':    { params: ['i32'], result: 'i32' },
  'atan':    { params: ['i32'], result: 'i32' },
  'atan2':   { params: ['i32', 'i32'], result: 'i32' },
  'sqr':     { params: ['i32'], result: 'i32' },
  'floor':   { params: ['i32'], result: 'i32' },
  'ceil':    { params: ['i32'], result: 'i32' },
  'log':     { params: ['i32'], result: 'i32' },
  'exp':     { params: ['i32'], result: 'i32' },
  // Conversion
  'int':     { params: ['i32'], result: 'i32' },
  'float':   { params: ['i32'], result: 'i32' },
  // Random
  'rand':    { params: ['i32', 'i32'], result: 'i32' },
  'rnd':     { params: ['i32', 'i32'], result: 'i32' },
  'seedrnd': { params: ['i32'], result: '' },
  // System
  'millisecs': { params: [], result: 'i32' },
  // Power operator helper
  'pow':       { params: ['i32', 'i32'], result: 'i32' },
  
  // Graphics functions (using f32 for positions/rotations)
  'graphics3d':      { params: ['i32', 'i32'], result: '' },
  'graphics':        { params: ['i32', 'i32'], result: '' },
  'createsphere':    { params: ['i32'], result: 'i32' },
  'createcube':      { params: [], result: 'i32' },
  'createmesh':      { params: [], result: 'i32' },
  'createsurface':   { params: ['i32'], result: 'i32' },
  'createcamera':    { params: [], result: 'i32' },
  'createlight':     { params: ['i32'], result: 'i32' },
  'positionentity':  { params: ['i32', 'f32', 'f32', 'f32'], result: '' },
  'rotateentity':    { params: ['i32', 'f32', 'f32', 'f32'], result: '' },
  'turnentity':      { params: ['i32', 'f32', 'f32', 'f32'], result: '' },
  'scaleentity':     { params: ['i32', 'f32', 'f32', 'f32'], result: '' },
  'entityx':         { params: ['i32'], result: 'f32' },
  'entityy':         { params: ['i32'], result: 'f32' },
  'entityz':         { params: ['i32'], result: 'f32' },
  'entitydistance':  { params: ['i32', 'i32'], result: 'f32' },
  'pointentity':     { params: ['i32', 'i32'], result: '' },
  'lightcolor':      { params: ['i32', 'i32', 'i32', 'i32'], result: '' },
  'entitycolor':     { params: ['i32', 'i32', 'i32', 'i32'], result: '' },
  'entitytexture':   { params: ['i32', 'i32'], result: '' },
  'renderworld':     { params: [], result: '' },
  'flip':            { params: [], result: '' },
  'cls':             { params: [], result: '' },
  'loadtexture':     { params: ['i32'], result: 'i32' },
  'loadimage':       { params: ['i32'], result: 'i32' },
  'loadmesh':        { params: ['i32'], result: 'i32' },
  'drawimage':       { params: ['i32', 'f32', 'f32'], result: '' },
  'addvertex':       { params: ['i32', 'f32', 'f32', 'f32'], result: 'i32' },
  'addtriangle':     { params: ['i32', 'i32', 'i32', 'i32'], result: '' },
  'animate':         { params: ['i32', 'i32', 'f32', 'f32'], result: '' },
  'createplane':     { params: [], result: 'i32' },
  'createskybox':    { params: ['i32'], result: 'i32' },
  'keydown':         { params: ['i32'], result: 'i32' },
};

export class CodeGenerator {
  private output: string[] = [];
  private indent = 0;
  private localIndex = 0;
  private locals = new Map<string, { index: number; type: string }>();
  private globals = new Map<string, { index: number; type: string }>();
  private functions = new Map<string, { index: number; params: string[]; returns: string }>();
  private nextFunctionIndex = 0;
  private stringLiterals = new Map<string, number>();
  private nextStringIndex = 0;
  private dimArrays = new Map<string, { dimensions: number[] }>();
  private stringDataSize = 0; // Total bytes used by string data section
  private errors: string[] = [];

  generate(program: AST.Program): string {
    try {
      // Validate AST before generation
      this.validateAST(program);
      
      if (this.errors.length > 0) {
        throw new Error(`CodeGen validation failed:\n${this.errors.join('\n')}`);
      }

      this.emit('(module');
      this.indent++;

      // Import JavaScript runtime functions
      this.emitRuntimeImports();

      // Memory
      this.emit('(memory (export "memory") 1)');

      // String data section
      this.emitStringData(program);

      // First pass: Register all function signatures (for forward references)
      for (const stmt of program.statements) {
        if (stmt.type === 'FunctionDeclaration') {
          this.registerFunction(stmt);
        }
      }

      // Second pass: Generate function bodies
      for (const stmt of program.statements) {
        if (stmt.type === 'FunctionDeclaration') {
          try {
            this.generateFunctionBody(stmt);
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            throw new Error(`Error in function '${stmt.name}': ${msg}`);
          }
        }
      }

      // Generate main entry point if needed
      this.generateMainFunction(program);

      this.indent--;
      this.emit(')');

      return this.output.join('\n');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Code generation failed: ${msg}`);
    }
  }

  private validateAST(program: AST.Program): void {
    // Basic validation to catch common issues early
    if (!program || typeof program !== 'object') {
      this.errors.push('Invalid program: not an object');
      return;
    }

    if (!Array.isArray(program.statements)) {
      this.errors.push('Invalid program: statements is not an array');
      return;
    }

    // Check for duplicate function names
    const functionNames = new Set<string>();
    for (const stmt of program.statements) {
      if (stmt.type === 'FunctionDeclaration') {
        const funcName = stmt.name.toLowerCase();
        if (functionNames.has(funcName)) {
          this.errors.push(`Duplicate function declaration: ${stmt.name}`);
        }
        functionNames.add(funcName);
      }
    }
  }

  private emitRuntimeImports(): void {
    // Basic runtime functions
    this.emit('(import "env" "print" (func $print (param i32)))');
    this.emit('(import "env" "printFloat" (func $printFloat (param f32)))');
    this.emit('(import "env" "printString" (func $printString (param i32)))');

    // Built-in functions
    for (const [name, sig] of Object.entries(BUILTIN_FUNCTIONS)) {
      const params = sig.params.map(p => `(param ${p})`).join(' ');
      const result = sig.result ? `(result ${sig.result})` : '';
      this.emit(`(import "env" "b3d_${name}" (func $b3d_${name} ${params} ${result}))`);
    }
    this.emit('');
  }

  private emitStringData(program: AST.Program): void {
    // Collect all string literals
    this.collectStringLiterals(program);

    if (this.stringLiterals.size > 0) {
      this.emit(';; String data section');
      let offset = 0;
      for (const [str, index] of this.stringLiterals.entries()) {
        const escaped = str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        this.emit(`(data (i32.const ${offset}) "${escaped}\\00")`);
        offset += str.length + 1; // +1 for null terminator
      }
      this.stringDataSize = offset;
      this.emit('');
    }

    // Export heap base so JS runtime knows where dynamic data starts
    // Align to 4-byte boundary
    const heapBase = (this.stringDataSize + 3) & ~3;
    this.emit(`(global $__heap_ptr (mut i32) (i32.const ${heapBase}))`);
    this.emit('');
  }

  private collectStringLiterals(node: any): void {
    if (!node || typeof node !== 'object') return;

    if (node.type === 'StringLiteral' && !this.stringLiterals.has(node.value)) {
      this.stringLiterals.set(node.value, this.nextStringIndex++);
    }

    // Recursively collect from all properties
    for (const key in node) {
      if (Array.isArray(node[key])) {
        node[key].forEach((item: any) => this.collectStringLiterals(item));
      } else if (typeof node[key] === 'object') {
        this.collectStringLiterals(node[key]);
      }
    }
  }

  // Register function signature (first pass - for forward references)
  private registerFunction(func: AST.FunctionDeclaration): void {
    // Function name already has suffix stripped by parser
    // Return type is already in AST from parser
    const funcIndex = this.nextFunctionIndex++;
    this.functions.set(func.name.toLowerCase(), {  // LOWERCASE for case-insensitive lookup
      index: funcIndex,
      params: func.parameters.map(p => this.typeToWasm(p.type)),
      returns: func.returnType ? this.typeToWasm(func.returnType) : ''
    });
  }

  // Generate function body (second pass - after all signatures registered)
  private generateFunctionBody(func: AST.FunctionDeclaration): void {
    this.locals.clear();
    this.localIndex = 0;

    // Function signature (name already has suffix stripped by parser)
    const params = func.parameters.map((p, i) => {
      const wasmType = this.typeToWasm(p.type);
      this.locals.set(p.name.toLowerCase(), { index: i, type: wasmType }); // LOWERCASE
      this.localIndex++;
      return `(param $${p.name} ${wasmType})`;
    }).join(' ');

    // Return type is already in AST from parser
    const returns = func.returnType ? `(result ${this.typeToWasm(func.returnType)})` : '';

    // Use lowercase name for WASM function
    this.emit(`(func $${func.name.toLowerCase()} (export "${func.name}") ${params} ${returns}`);
    this.indent++;

    // Local variables (we'll add them as we encounter them)
    const localDecls: string[] = [];

    // Generate function body
    for (const stmt of func.body) {
      this.generateStatement(stmt);
    }

    // Add default return if no explicit return
    if (func.returnType) {
      const wasmType = this.typeToWasm(func.returnType);
      if (wasmType === 'i32') {
        this.emit('i32.const 0');
      } else if (wasmType === 'f32') {
        this.emit('f32.const 0');
      }
    }

    this.indent--;
    this.emit(')');
    this.emit('');
  }

  private generateMainFunction(program: AST.Program): void {
    // Generate main function from top-level statements
    const topLevelStmts = program.statements.filter(s => 
      s.type !== 'FunctionDeclaration' && s.type !== 'TypeDeclaration'
    );

    if (topLevelStmts.length === 0) return;

    this.emit('(func $main (export "main")');
    this.indent++;

    // First pass: collect all local declarations
    const localDecls: string[] = [];
    const stmtOutputs: string[][] = [];
    
    for (const stmt of topLevelStmts) {
      const beforeLocals = this.localIndex;
      const beforeOutput = this.output.length;
      
      this.generateStatement(stmt);
      
      // Extract any local declarations that were added
      const newOutput = this.output.slice(beforeOutput);
      const locals: string[] = [];
      const nonLocals: string[] = [];
      
      for (const line of newOutput) {
        if (line.trim().startsWith('(local ')) {
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
    this.emit(')');
    this.emit('');

    // Start function
    this.emit('(start $main)');
  }

  private generateStatement(stmt: AST.Statement): void {
    switch (stmt.type) {
      case 'VariableDeclaration':
        this.generateVariableDeclaration(stmt);
        break;
      case 'Assignment':
        this.generateAssignmentStatement(stmt);
        break;
      case 'ExpressionStatement':
        // Check if this is an assignment or function call (which don't return values in statement context)
        if (stmt.expression.type === 'Assignment') {
          this.generateAssignmentStatement(stmt.expression);
        } else if (stmt.expression.type === 'FunctionCall') {
          this.generateFunctionCall(stmt.expression);
          // Don't drop - Print and other void functions don't return a value
        } else {
          this.generateExpression(stmt.expression);
          this.emit('drop'); // Discard result
        }
        break;
      case 'IfStatement':
        this.generateIfStatement(stmt);
        break;
      case 'ForLoop':
        this.generateForLoop(stmt);
        break;
      case 'WhileLoop':
        this.generateWhileLoop(stmt);
        break;
      case 'RepeatStatement':
        this.generateRepeatLoop(stmt);
        break;
      case 'SelectStatement':
        this.generateSelectStatement(stmt);
        break;
      case 'ReturnStatement':
        if (stmt.value) {
          this.generateExpression(stmt.value);
        }
        this.emit('return');
        break;
      case 'LabelStatement':
        this.emit(`; label: ${stmt.name}`);
        break;
      case 'GotoStatement':
        this.emit(`; TODO: goto ${stmt.label}`);
        break;
      case 'GosubStatement':
        this.emit(`; TODO: gosub ${stmt.label}`);
        break;
      case 'EndStatement':
        this.emit('return');
        break;
      default:
        this.emit(`; TODO: ${stmt.type}`);
    }
  }

  private generateVariableDeclaration(decl: any): void {
    const wasmType = decl.varType ? this.typeToWasm(decl.varType) : 'i32';

    // Dim array declaration
    if (decl.scope === 'dim' && decl.dimensions && decl.dimensions.length > 0) {
      const rawName = decl.name;
      // Strip type suffix for consistent lookup
      const baseName = rawName.replace(/[%#$]$/, '');

      // Track as a dim array under all possible names
      this.dimArrays.set(rawName, { dimensions: [] });
      this.dimArrays.set(baseName, { dimensions: [] });
      this.dimArrays.set(baseName.toLowerCase(), { dimensions: [] });

      // Create a local to hold the base pointer for this array
      const localIndex = this.localIndex++;
      const localName = `__dim_${baseName}`;
      this.locals.set(localName, { index: localIndex, type: 'i32' });
      // Also register with lowercase for lookups
      this.locals.set(`__dim_${baseName.toLowerCase()}`, { index: localIndex, type: 'i32' });
      this.emit(`(local $${localName} i32)`);

      // Allocate: (dimension + 1) * 4 bytes at current heap_ptr
      // Store current heap_ptr as the array base
      this.emit('global.get $__heap_ptr');
      this.emit(`local.set $${localName}`);

      // Bump heap_ptr by (dimension + 1) * 4
      this.emit('global.get $__heap_ptr');
      this.generateExpression(decl.dimensions[0]);
      this.emit('i32.const 1');
      this.emit('i32.add');
      this.emit('i32.const 4');
      this.emit('i32.mul');
      this.emit('i32.add');
      this.emit('global.set $__heap_ptr');
      return;
    }

    if (decl.scope === 'global') {
      const globalIndex = this.globals.size;
      this.globals.set(decl.name, { index: globalIndex, type: wasmType });

      // Emit global declaration
      const initialValue = decl.initializer ? this.expressionToString(decl.initializer) :
                          (wasmType === 'i32' ? 'i32.const 0' : 'f32.const 0');
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

  private generateIfStatement(stmt: AST.IfStatement): void {
    // Generate condition
    this.generateExpression(stmt.condition);

    this.emit('(if');
    this.indent++;
    this.emit('(then');
    this.indent++;

    for (const s of stmt.thenBranch) {
      this.generateStatement(s);
    }

    this.indent--;
    this.emit(')');

    // ElseIf branches: chain as nested (else (if ...))
    const elseIfs = stmt.elseIfBranches || [];
    if (elseIfs.length > 0 || (stmt.elseBranch && stmt.elseBranch.length > 0)) {
      this.emit('(else');
      this.indent++;

      if (elseIfs.length > 0) {
        // Generate first elseif, the rest become nested
        this.generateElseIfChain(elseIfs, 0, stmt.elseBranch);
      } else if (stmt.elseBranch) {
        for (const s of stmt.elseBranch) {
          this.generateStatement(s);
        }
      }

      this.indent--;
      this.emit(')');
    }

    this.indent--;
    this.emit(')');
  }

  private generateElseIfChain(
    elseIfs: Array<{ condition: any; body: any[] }>,
    index: number,
    elseBranch?: any[]
  ): void {
    if (index >= elseIfs.length) {
      // No more elseifs, emit the final else branch
      if (elseBranch) {
        for (const s of elseBranch) {
          this.generateStatement(s);
        }
      }
      return;
    }

    const branch = elseIfs[index];
    this.generateExpression(branch.condition);
    this.emit('(if');
    this.indent++;
    this.emit('(then');
    this.indent++;

    for (const s of branch.body) {
      this.generateStatement(s);
    }

    this.indent--;
    this.emit(')');

    // More elseifs or a final else?
    if (index + 1 < elseIfs.length || (elseBranch && elseBranch.length > 0)) {
      this.emit('(else');
      this.indent++;
      this.generateElseIfChain(elseIfs, index + 1, elseBranch);
      this.indent--;
      this.emit(')');
    }

    this.indent--;
    this.emit(')');
  }

  private generateForLoop(loop: AST.ForLoop): void {
    // Initialize loop variable
    this.generateExpression(loop.start);
    const wasmType = 'i32'; // For now assume int
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
    this.emit('(block $break');
    this.indent++;
    this.emit('(loop $continue');
    this.indent++;
    
    // Check condition
    this.emit(`local.get $${loop.variable}`);
    this.emit(`local.get $__for_end_${varIndex}`);
    this.emit('i32.gt_s');
    this.emit('br_if $break');
    
    // Loop body
    for (const stmt of loop.body) {
      this.generateStatement(stmt);
    }
    
    // Increment
    this.emit(`local.get $${loop.variable}`);
    if (loop.step) {
      this.generateExpression(loop.step);
    } else {
      this.emit('i32.const 1');
    }
    this.emit('i32.add');
    this.emit(`local.set $${loop.variable}`);
    
    this.emit('br $continue');
    
    this.indent--;
    this.emit(')');
    this.indent--;
    this.emit(')');
  }

  private generateWhileLoop(loop: AST.WhileLoop): void {
    this.emit('(block $break');
    this.indent++;
    this.emit('(loop $continue');
    this.indent++;
    
    // Check condition
    this.generateExpression(loop.condition);
    this.emit('i32.eqz');
    this.emit('br_if $break');
    
    // Loop body
    for (const stmt of loop.body) {
      this.generateStatement(stmt);
    }
    
    this.emit('br $continue');
    
    this.indent--;
    this.emit(')');
    this.indent--;
    this.emit(')');
  }

  private generateRepeatLoop(loop: AST.RepeatStatement): void {
    this.emit('(block $break');
    this.indent++;
    this.emit('(loop $continue');
    this.indent++;
    
    // Loop body
    for (const stmt of loop.body) {
      this.generateStatement(stmt);
    }
    
    // Check condition (if there is one)
    if (loop.condition) {
      this.generateExpression(loop.condition);
      this.emit('i32.eqz');
      this.emit('br_if $break');
    } else {
      // Forever - just loop back
      this.emit('br $continue');
    }
    
    this.indent--;
    this.emit(')');
    this.indent--;
    this.emit(')');
  }

  private generateSelectStatement(stmt: any): void {
    // Evaluate the select expression into a temp local
    const tempName = `$__select_${this.localIndex}`;
    const tempIndex = this.localIndex++;
    this.locals.set(tempName, { index: tempIndex, type: 'i32' });
    this.emit(`(local ${tempName} i32)`);
    this.generateExpression(stmt.expression);
    this.emit(`local.set ${tempName}`);

    const cases = stmt.cases || [];
    const defaultCase = stmt.defaultCase;

    // Generate chained if/else for each case
    this.generateCaseChain(tempName, cases, 0, defaultCase);
  }

  private generateCaseChain(
    tempName: string,
    cases: Array<{ values: any[]; body: any[] }>,
    index: number,
    defaultCase?: any[]
  ): void {
    if (index >= cases.length) {
      // Default case
      if (defaultCase) {
        for (const s of defaultCase) {
          this.generateStatement(s);
        }
      }
      return;
    }

    const caseClause = cases[index];

    // Generate condition: select_val == value1 || select_val == value2 ...
    for (let i = 0; i < caseClause.values.length; i++) {
      this.emit(`local.get ${tempName}`);
      this.generateExpression(caseClause.values[i]);
      this.emit('i32.eq');
      if (i > 0) {
        this.emit('i32.or');
      }
    }

    this.emit('(if');
    this.indent++;
    this.emit('(then');
    this.indent++;

    for (const s of caseClause.body) {
      this.generateStatement(s);
    }

    this.indent--;
    this.emit(')');

    // More cases or default?
    if (index + 1 < cases.length || (defaultCase && defaultCase.length > 0)) {
      this.emit('(else');
      this.indent++;
      this.generateCaseChain(tempName, cases, index + 1, defaultCase);
      this.indent--;
      this.emit(')');
    }

    this.indent--;
    this.emit(')');
  }

  private generateExpression(expr: AST.Expression): void {
    switch (expr.type) {
      case 'IntegerLiteral':
        this.emit(`i32.const ${expr.value}`);
        break;
      case 'FloatLiteral':
        this.emit(`f32.const ${expr.value}`);
        break;
      case 'StringLiteral': {
        const index = this.stringLiterals.get(expr.value) || 0;
        // Return pointer to string in memory
        let offset = 0;
        for (const [str, idx] of this.stringLiterals.entries()) {
          if (idx === index) break;
          offset += str.length + 1;
        }
        this.emit(`i32.const ${offset}`);
        break;
      }
      case 'Identifier': {
        const varName = expr.name.toLowerCase(); // Lowercase for case-insensitive lookup
        
        // Try to find variable with or without type suffix
        let local = this.locals.get(varName);
        if (!local) {
          // Try with % suffix (int)
          local = this.locals.get(varName + '%');
        }
        if (!local) {
          // Try with # suffix (float)
          local = this.locals.get(varName + '#');
        }
        if (!local) {
          // Try with $ suffix (string)
          local = this.locals.get(varName + '$');
        }
        
        if (local) {
          // Use the actual variable name with suffix
          const actualName = Array.from(this.locals.keys()).find(k => 
            k === varName || k.startsWith(varName) && k.length === varName.length + 1
          );
          this.emit(`local.get $${actualName}`);
        } else {
          const global = this.globals.get(varName);
          if (global) {
            this.emit(`global.get $${varName}`);
          } else {
            this.emit(`; ERROR: Unknown identifier ${varName}`);
            this.emit('i32.const 0');
          }
        }
        break;
      }
      case 'BinaryOp':
        this.generateBinaryOp(expr);
        break;
      case 'UnaryOp':
        this.generateExpression(expr.operand);
        if (expr.operator === 'Not') {
          this.emit('i32.eqz');
        } else if (expr.operator === '-') {
          this.emit('i32.const -1');
          this.emit('i32.mul');
        }
        break;
      case 'FunctionCall':
        this.generateFunctionCall(expr);
        break;
      case 'ArrayAccess': {
        // Array read expression
        const arrExpr = expr.array;
        if (arrExpr.type === 'Identifier') {
          const arrName = arrExpr.name;
          const arrBaseName = arrName.replace(/[%#$]$/, '').toLowerCase();
          const dimKey = this.dimArrays.has(arrBaseName) ? arrBaseName :
                         this.dimArrays.has(arrName) ? arrName : null;
          if (dimKey) {
            this.emit(`local.get $__dim_${dimKey}`);
            if (expr.indices.length > 0) {
              this.generateExpression(expr.indices[0]);
              this.emit('i32.const 4');
              this.emit('i32.mul');
              this.emit('i32.add');
            }
            this.emit('i32.load');
          } else {
            this.emit(`; ERROR: Unknown array ${arrName} (no Dim found)`);
            this.emit('i32.const 0');
          }
        } else {
          this.emit('; TODO: complex array access');
          this.emit('i32.const 0');
        }
        break;
      }
      case 'FieldAccess':
        // Field access - emit TODO for now (needs type system)
        this.emit(`; TODO: FieldAccess ${expr.field}`);
        this.emit('i32.const 0');
        break;
      case 'NewExpression':
        this.emit(`; TODO: New ${expr.typeName}`);
        this.emit('i32.const 0');
        break;
      case 'Assignment':
        this.generateAssignment(expr);
        break;
      default:
        this.emit(`; TODO: Expression ${expr.type}`);
        this.emit('i32.const 0');
    }
  }

  private generateBinaryOp(expr: AST.BinaryOp): void {
    this.generateExpression(expr.left);
    this.generateExpression(expr.right);
    
    // Determine type (simplified - assume i32 for now)
    const op = expr.operator;
    
    switch (op) {
      case '+':
        this.emit('i32.add');
        break;
      case '-':
        this.emit('i32.sub');
        break;
      case '*':
        this.emit('i32.mul');
        break;
      case '/':
        this.emit('i32.div_s');
        break;
      case 'Mod':
        this.emit('i32.rem_s');
        break;
      case '=':
      case '==':
        this.emit('i32.eq');
        break;
      case '<>':
      case '!=':
        this.emit('i32.ne');
        break;
      case '<':
        this.emit('i32.lt_s');
        break;
      case '<=':
        this.emit('i32.le_s');
        break;
      case '>':
        this.emit('i32.gt_s');
        break;
      case '>=':
        this.emit('i32.ge_s');
        break;
      case 'And':
        this.emit('i32.and');
        break;
      case 'Or':
        this.emit('i32.or');
        break;
      case 'Xor':
        this.emit('i32.xor');
        break;
      case 'Shl':
        this.emit('i32.shl');
        break;
      case 'Shr':
        this.emit('i32.shr_u');
        break;
      case 'Sar':
        this.emit('i32.shr_s');
        break;
      case '^':
        // Power operator — use imported pow function
        // For integer approximation, just emit a call to b3d builtin
        this.emit('call $b3d_pow');
        break;
      default:
        this.emit(`; Unknown operator: ${op}`);
    }
  }

  private generateFunctionCall(expr: any): void {
    // Get function name
    const nameNode = expr.name;
    if (!nameNode || nameNode.type !== 'Identifier') {
      // Non-identifier callee — generate args and emit error
      for (const arg of expr.arguments) {
        this.generateExpression(arg);
      }
      this.emit('; ERROR: non-identifier callee');
      return;
    }

    const rawName = nameNode.name;
    const lowerName = rawName.toLowerCase();

    // Special case: Print
    if (lowerName === 'print') {
      if (expr.arguments.length > 0) {
        this.generateExpression(expr.arguments[0]);
        const arg = expr.arguments[0];
        if (arg.type === 'StringLiteral') {
          this.emit('call $printString');
        } else {
          this.emit('call $print');
        }
      }
      return;
    }

    // Check for Dim array access: arr(index) where arr is a known Dim name
    const baseNameForDim = lowerName.replace(/[%#$]$/, '');
    if (this.dimArrays.has(baseNameForDim) || this.dimArrays.has(rawName)) {
      // Array read: compute base + index * 4, then i32.load
      const dimKey = this.dimArrays.has(baseNameForDim) ? baseNameForDim : rawName;
      const localKey = `__dim_${dimKey}`;
      this.emit(`local.get $${localKey}`);
      if (expr.arguments.length > 0) {
        this.generateExpression(expr.arguments[0]);
        this.emit('i32.const 4');
        this.emit('i32.mul');
        this.emit('i32.add');
      }
      this.emit('i32.load');
      return;
    }

    // Check for built-in function
    const builtinKey = lowerName.replace(/[%#$]$/, '');
    if (BUILTIN_FUNCTIONS[builtinKey]) {
      const funcSig = BUILTIN_FUNCTIONS[builtinKey];
      
      // Generate arguments with bidirectional type coercion
      for (let i = 0; i < expr.arguments.length; i++) {
        const arg = expr.arguments[i];
        const expectedType = funcSig.params[i] || 'i32';
        
        this.generateExpression(arg);
        
        const isInt = this.isIntegerExpression(arg);
        const isFloat = this.isFloatExpression(arg);
        
        // Type coercion: i32 → f32
        if (expectedType === 'f32' && isInt) {
          this.emit('f32.convert_i32_s');
        }
        // Type coercion: f32 → i32 (truncate)
        else if (expectedType === 'i32' && isFloat) {
          this.emit('i32.trunc_f32_s');
        }
      }
      
      this.emit(`call $b3d_${builtinKey}`);
      return;
    }

    // Regular user-defined function call
    // Strip any suffix from call name and lookup by lowercase base name
    let callName = rawName;
    const lastChar = callName[callName.length - 1];
    if (lastChar === '%' || lastChar === '#' || lastChar === '$') {
      callName = callName.slice(0, -1); // Strip suffix
    }
    callName = callName.toLowerCase(); // Lowercase for case-insensitive lookup
    
    for (const arg of expr.arguments) {
      this.generateExpression(arg);
    }
    this.emit(`call $${callName}`);
  }

  private generateAssignmentStatement(expr: any): void {
    // Array assignment: arr(index) = value
    if (expr.target.type === 'ArrayAccess') {
      const arrayExpr = expr.target.array;
      if (arrayExpr.type === 'Identifier') {
        const arrName = arrayExpr.name;
        const baseName = arrName.replace(/[%#$]$/, '').toLowerCase();
        const dimKey = this.dimArrays.has(baseName) ? baseName :
                       this.dimArrays.has(arrName) ? arrName : null;
        if (dimKey) {
          const localKey = `__dim_${dimKey}`;
          // Compute address: base + index * 4
          this.emit(`local.get $${localKey}`);
          if (expr.target.indices.length > 0) {
            this.generateExpression(expr.target.indices[0]);
            this.emit('i32.const 4');
            this.emit('i32.mul');
            this.emit('i32.add');
          }
          // Generate value
          this.generateExpression(expr.value);
          // Store
          this.emit('i32.store');
          return;
        }
      }
    }

    // Regular assignment to identifier
    if (expr.target.type === 'Identifier') {
      const varName = expr.target.name;
      let local = this.locals.get(varName);

      // Auto-declare variable if it doesn't exist
      if (!local && !this.globals.has(varName)) {
        // Infer type from expression
        const wasmType = this.isFloatExpression(expr.value) ? 'f32' : 'i32';
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

  private generateAssignment(expr: AST.Assignment): void {
    // Set target
    if (expr.target.type === 'Identifier') {
      const varName = expr.target.name;
      let local = this.locals.get(varName);
      
      // Auto-declare variable if it doesn't exist (Blitz3D implicit declaration)
      if (!local && !this.globals.has(varName)) {
        // Infer type from expression
        const wasmType = this.isFloatExpression(expr.value) ? 'f32' : 'i32';
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
    if (expr.target.type === 'Identifier') {
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

  private expressionToString(expr: AST.Expression): string {
    if (expr.type === 'IntegerLiteral') {
      return `i32.const ${expr.value}`;
    } else if (expr.type === 'FloatLiteral') {
      return `f32.const ${expr.value}`;
    }
    return 'i32.const 0';
  }

  private typeToWasm(type: AST.TypeAnnotation): string {
    if (type.kind === 'primitive') {
      switch (type.name) {
        case 'Int': return 'i32';
        case 'Float': return 'f32';
        case 'String': return 'i32'; // Pointer to string
        default: return 'i32';
      }
    }
    return 'i32';
  }

  private emit(line: string): void {
    this.output.push('  '.repeat(this.indent) + line);
  }
  
  // Helper to detect if an expression will produce i32
  private isIntegerExpression(expr: any): boolean {
    if (!expr) return false;
    
    switch (expr.type) {
      case 'IntegerLiteral':
        return true;
      case 'FloatLiteral':
        return false;
      case 'UnaryOp':
        return this.isIntegerExpression(expr.operand);
      case 'BinaryOp':
        // Both sides integer = result integer
        return this.isIntegerExpression(expr.left) && this.isIntegerExpression(expr.right);
      case 'Identifier':
        const varName = expr.name.toLowerCase();
        const local = this.locals.get(varName);
        if (local) return local.type === 'i32';
        const global = this.globals.get(varName);
        if (global) return global.type === 'i32';
        return false; // Unknown - don't assume
      default:
        return false;
    }
  }
  
  // Helper to detect if an expression will produce f32
  private isFloatExpression(expr: any): boolean {
    if (!expr) return false;
    
    switch (expr.type) {
      case 'FloatLiteral':
        return true;
      case 'IntegerLiteral':
        return false;
      case 'UnaryOp':
        return this.isFloatExpression(expr.operand);
      case 'BinaryOp':
        // If either side is float, result is float
        return this.isFloatExpression(expr.left) || this.isFloatExpression(expr.right);
      case 'Identifier':
        const varName = expr.name.toLowerCase();
        const local = this.locals.get(varName);
        if (local) return local.type === 'f32';
        const global = this.globals.get(varName);
        if (global) return global.type === 'f32';
        return false; // Unknown - don't assume
      default:
        return false;
    }
  }
}
