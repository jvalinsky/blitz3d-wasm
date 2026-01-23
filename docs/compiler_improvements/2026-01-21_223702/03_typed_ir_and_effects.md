# 03 — Typed IR + Effects (ACTIVE PRIORITY)

**Status: ACTIVE (Jan 22 2026)**
This plan has been elevated to the highest priority following the failure of heuristic patches in the current AST-to-WASM pipeline.

## What Was Tried (FAILED)

### Auto-Import Experiment (Attempted in codex_session.log lines 377-530)
- **Approach:** Created `--auto-import-map` flag to auto-stub missing functions by guessing signatures from call sites
- **Result:** FAILED CATASTROPHICALLY
- **Why:**
  1. **Arity Conflicts:** Different call sites used different argument counts for the same function (e.g., 2 args vs 3 args)
  2. **Stack Mismatches:** Calls used as statements (returning values) were not reliably dropped, leaving values on the stack
  3. **Validation Hell:** `wasm-validate` reported hundreds of errors like "expected 3 args, got 2"

### Patch-Based Fixes (Superseded)
- Attempted to fix specific `StatementGeneration.swift` bugs (stack leaks, type truncation)
- **Result:** Whack-a-mole - fixing one bug revealed another
- **Conclusion:** The direct AST-to-WASM pipeline is fundamentally unsound for this complexity level

## What Was Implemented (COMPLETED)

### ✅ 1. IR Type System
- **File:** `Sources/Compiler/IR/Types.swift`
- **Status:** COMPLETE
- **Contents:** `IRType` enum (i32, f32, void), `CustomStringConvertible`, `isValue` property

### ✅ 2. IR Nodes and Builder
- **File:** `Sources/Compiler/IR/IR.swift`
- **Status:** COMPLETE
- **Contents:** 
  - `IRValue`: Typed expressions (ConstI32, ConstF32, LocalGet, GlobalGet, Binary, Call, LoadField, LoadArray, Convert)
  - `IREffect`: Stack-neutral statements (Discard, Assign, IfStmt, WhileStmt, ForStmt, ReturnStmt, Break, etc.)
  - `IRModule`, `IRFunction`: Module structure
  - `IRBuilder`: Fluent API for constructing IR

### ✅ 3. AST to IR Lowering Pass
- **File:** `Sources/Compiler/Lowering/ASTLowering.swift`
- **Status:** COMPLETE
- **Contents:**
  - `lower(_ program: ProgramNode) -> IRModule`: Entry point
  - `lowerFunction()`: Function parameter/local tracking
  - `lowerStatement()`: AST statements → IR Effects with explicit type handling
  - `lowerExpression()`: AST expressions → IR Values with explicit casts
  - `SymbolTable`: Tracks locals, globals, arrays, types

## Current Status

| Item | Status |
|------|--------|
| IR Type System | ✅ Complete |
| IR Nodes & Builder | ✅ Complete |
| AST → IR Lowering | ✅ Complete |
| IR → WASM Emitter | ✅ Complete |
| Wire into CodeGenerator | ✅ Complete |
| Test Integration | ✅ CLI Flag Added |
| ParserTests.swift | ✅ Fixed & Passing |
| Multi-dim Arrays | ✅ Complete & Verified |
| String Allocation | ✅ Complete & Deduplicated |
| Global Initialization | ✅ Complete & Verified |

## Goal

Introduce an intermediate representation (IR) that makes it impossible to generate invalid WASM for supported constructs by:
- Annotating every expression with a concrete type
- Making "value vs effect" explicit (a.k.a. *effects*)
- Structuring control flow so statement blocks are stack-neutral by construction

This is the "compiler engineering" foundation that turns repeated one-off fixes into a stable system.

## Why (the short version)

WASM has strict rules:
- A `drop` requires one value on the stack.
- `if/loop/block` must have consistent stack results across branches.

If the compiler still reasons directly in terms of "append instructions to a stack machine", it's very easy to leak or over-drop values, especially in large real code (SCPCB).

## Proposed IR (minimal but strong)

Start with a **structured typed IR** (not full SSA initially):

### Types
- `I32`, `F32`, `StringPtr` (or just `I32` pointer with string tag), `Void`, plus "opaque handles" as `I32` with type tags at semantic level.

### Expressions (all typed)
- `ConstI32`, `ConstF32`, `ConstStringPtr`
- `VarGet(name)` -> typed
- `BinOp(op, lhs, rhs)` -> typed
- `Call(symbol, args)` -> typed (arity + types already validated)
- `LoadField`, `StoreField` (store is effect-only)
- `ArrayLoad`, `ArrayStore` (store is effect-only)

### Statements (effect-only)
Statements must have net stack effect 0:
- `Assign(name, expr)`
- `ExprStmt(expr)` but only for effectful expressions, represented as `Discard(expr)` in IR if needed
- `If(condExprI32, thenStmts, elseStmts)`
- `While(condExprI32, bodyStmts)`
- `For(...)`, `ForEach(...)`, `SelectCase(...)`
- `Return(expr?)` (must match function signature)

Key invariant:
- "Statement list lowers to a WASM instruction list that leaves the stack unchanged."

## Plan

### Next Steps

#### ✅ 4. Wire IR Pipeline into CodeGenerator
- **Action:** Integrate `ASTLowering` into `CodeGenerator.swift`
- **Status:** COMPLETE
- **Contents:** Added `generateFromIR()` method to `CodeGenerator.swift`

#### ✅ 5. Create IR → WASM Emitter
- **Action:** Implement `IREmitter` class
- **Status:** COMPLETE (Initial version)
- **Contents:** `IREmitter.swift` handles basic values, binary ops, globals, and control flow (if, while, repeat).

#### ✅ 6. Fix ParserTests.swift
- **Issue:** Used deprecated tuple-associated enum syntax
- **Action:** Fixed 8 test methods to use `let (val, _)` pattern.
- **Status:** COMPLETE

### Completed Stages

#### ✅ Stage 0 — "Effect annotations without a full IR"
Skipped in favor of full Typed IR implementation.

#### ✅ 1. Add IR definitions + typed nodes
- **Deliverable:** `Sources/Compiler/IR/IR.swift`, `Types.swift`
- **Acceptance:** Typed enums defined and compilable

#### ✅ 2. Add AST → IR lowering pass
- **Deliverable:** `Sources/Compiler/Lowering/ASTLowering.swift`
- **Responsibilities:**
  - Resolve symbols (function vs array ambiguity)
  - Apply implicit conversions explicitly (insert `ToI32`, `ToF32` nodes)
  - Convert syntax sugar (`ElseIf` chain, `Select Case` ranges) into canonical forms

**Acceptance:**
- The IR is well-typed: every node has a fully-known type.
- A `void` call cannot appear in a value position.

### 3. Add IR → WASM lowering pass (Future)

**Responsibilities:**
- Map typed IR ops to specific WASM instructions
- Enforce statement list stack neutrality

**Acceptance:**
- No `.drop` can be emitted unless the IR proves a value is produced.
- `if` and loop bodies are `.void` blocks whose bodies are stack-neutral.

### 4. Integrate StackValidator as a verification step (not a fixer)

**Action**
- Validate emitted WASM per function (and/or per block) and fail fast with spans mapped back to IR/AST source locations.

**Refs**
- Existing validator implementation: `../../../Sources/Compiler/CodeGen/StackValidator.swift`

### 5. Optional: move toward SSA later (for optimization)

Once correctness is stable, you can introduce SSA for better optimization (CSE, LICM, etc.). But do **not** block correctness on SSA.

## Cross-links

- Calls + signatures: `02_signatures_defaults_and_call_semantics.md`
- WASM-validity invariant: `01_wasm_validity_as_an_invariant.md`
- Stack research: `../../../docs/STACK_BALANCE_HEURISTICS.md`, `../../../../docs/COMPILER_STACK_BALANCING.md`
