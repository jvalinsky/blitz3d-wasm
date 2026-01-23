# 01 — WASM Validity as an Invariant (No-Heuristics Mode)

## Goal

Make “`wasm-validate` passes” a *compiler invariant* for supported constructs:
- If compilation succeeds, the module validates.
- If the compiler cannot guarantee validity, it fails with a precise diagnostic tied to a source span.

This shifts the workflow from “generate WASM and hope the validator likes it” to “prove stack/typing correctness before emitting bytecode”.

## Why this matters (the practical reason)

WASM validation errors are expensive to debug because they point to a byte offset in generated code, not a source line. In the current repo, we’ve seen failures consistent with emitting `.drop` when the stack is already empty (example patterns appear in SCPCB compilation reports).

## Current Codebase Observations (what exists today)

- Statement lowering drops return values in statement context:
  - `../../../Sources/Compiler/CodeGen/StatementGeneration.swift`
- Expression lowering sometimes forces a dummy return for `void` calls:
  - `../../../Sources/Compiler/CodeGen/ExpressionGeneration.swift`
- There is a full “3-stack” validator algorithm implementation:
  - `../../../Sources/Compiler/CodeGen/StackValidator.swift`
- There is *also* ad-hoc delta computation code in `StatementGeneration.swift` that is currently unused for `if`:
  - `../../../Sources/Compiler/CodeGen/StatementGeneration.swift`

## What Is Likely Causing the Current “drop got []” Failures

Based on the current code structure, the most plausible root cause is:
- A call’s *actual* signature has **zero results**, but the compiler’s call generation reports a **non-void** type upward (via heuristic return-type guessing or mismatched signature resolution).
- Statement lowering then appends `.drop` for a “value-producing” statement call, but the call left nothing on the stack, so the `.drop` itself underflows.

This is consistent with the fact that return type inference in call generation currently mixes:
- explicit registered definitions (good)
- “truth from WASM type table” lookups (okay as a diagnostic check, but fragile as logic)
- name-based heuristics (dangerous for correctness)

See `../../../Sources/Compiler/CodeGen/ExpressionGeneration.swift` and `../../../Sources/Compiler/CodeGen/StatementGeneration.swift`.

**Progress note (completed)**
- Call resolution now prefers registered signatures/actual WASM types and does **not** synthesize dummy return values for void calls.
- Statement-level dropping now consults signature maps (`SignatureResolver`) and only drops when a signature reports results (fallback: non-void generated type).

## Plan

### 1. Make “value vs void” explicit everywhere

**Action**
- Ensure there is a single, authoritative answer to: “does this expression produce a value?”
- Remove any behavior that retroactively changes expression category (e.g., “if void, push 0”) unless it is *only* used in a context that requires a value.

**Why**
- Statement context wants “effect-only” evaluation: values should be discarded.
- Expression context wants a value: “void as 0” is a semantic choice and should be explicit, not implicit.

**Acceptance**
- There is no longer any place where codegen adds `.drop` “just in case”.
- A `void` call used in expression context is either:
  - rejected with a compile-time error, or
  - explicitly coerced (documented behavior), but without creating validator hazards.

**Adjustment to fit current repo state**
- Do *not* rely on name-based return-type heuristics (e.g. “functions containing `value` return float”) because the compiler already maintains signatures for imports and user functions. Prefer: “if no signature exists, fail in strict mode.”

### 2. Make call signatures the source of truth for stack effect

**Action**
- Guarantee that every `.call` has a known signature at codegen time.
- If a call target cannot be resolved to a signature, compilation should fail (in strict mode) rather than “guess types and patch with drops”.

**Acceptance**
- The compiler can compute stack effects precisely for `.call` (params/results).
- No `.call` remains “unknown signature”.

**Related plan**
- See `02_signatures_defaults_and_call_semantics.md`.

### 3. Integrate `StackValidator` as a codegen guardrail

**Action**
- Use the validator during codegen (or IR->WASM lowering) to:
  - validate every instruction sequence appended to a function body
  - validate nested blocks and merges for `if/loop/block`
  - validate `return` behavior with the function’s declared results

**Design choice**
- In “dev/diagnostic builds”, validate continuously.
- In “release builds”, validate at function granularity (or per block) for performance.

**Acceptance**
- A failing case reports:
  - source location (span)
  - expected stack types and actual stack types (from validator)
  - the instruction context (optional, but very helpful)

**Refs**
- WASM validation algorithm reference: `../../../Sources/Compiler/CodeGen/StackValidator.swift`
- Repo research: `../../../docs/STACK_BALANCE_HEURISTICS.md`, `../../../../docs/COMPILER_STACK_BALANCING.md`

### 4. Remove “best-effort drop insertion” at control-flow boundaries

**Action**
- If statements/loops compile to `.void` blocks, then their branches/bodies must have net stack effect 0 by construction.
- Do not attempt to “balance branches” with heuristic drops.

**Why**
- A heuristic drop can fix one module and break another (especially when signatures drift).

**Acceptance**
- All stack-neutral requirements are enforced at the IR/statement level (see `03_typed_ir_and_effects.md`).

### 5. Add a “WASM validity regression suite”

**Action**
- Create a test runner mode that:
  - compiles a corpus (SCPCB subset + targeted microtests)
  - runs `wasm-validate`
  - stores a stable JSON report with categorized failures

**Acceptance**
- Every PR can report:
  - total compiled
  - total validated
  - failures grouped by class (parse/semantic/runtime/validator)

**Refs**
- Existing reporting artifacts in repo: `../../compile_test_report_*.txt`, `../../compile_errors_*.json`

## Risks

- Integrating validator everywhere can slow compilation; mitigate via build flags.
- Some existing behavior may rely on “void coerces to int”; document and test it explicitly if kept.

## Concrete “First Fix” Checklist (to reach Milestone A sooner)

These items are tactical and directly aligned to current failure modes:

- [x] **Make statement-call dropping depend on the resolved signature**
  - Implemented via `SignatureResolver` + guarded drop in statement lowering.
  - Refs: `../../../Sources/Compiler/CodeGen/StatementGeneration.swift`, `../../../Sources/Compiler/CodeGen/ExpressionGeneration.swift`

- [x] **Reject or explicitly coerce calls where “expected results” ≠ “actual results”**
  - Calls with 0-result signatures used in value context are now warned and coerced to `i32Const 0` to keep stack sane (short-term).
  - Refs: `../../../Sources/Compiler/CodeGen/ExpressionGeneration.swift`

- [x] **Audit statement lowering for control-flow merges**
  - Completed via Typed IR implementation where `if`, `while`, and `loop` bodies are stack-neutral by construction.
  - Verified in `IRPipelineTests.swift`.
  - Refs: `../../../Sources/Compiler/IR/IR.swift`, `../../../Sources/Compiler/CodeGen/IREmitter.swift`
