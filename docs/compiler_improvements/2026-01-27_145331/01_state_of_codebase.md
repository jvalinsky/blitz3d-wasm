# State of Codebase (as of 2026-01-27)

This is a concrete inventory of what’s _done_ vs _still missing_ for wasm-valid
output on real SCP:CB modules.

## DONE: CFG + Structured Control Flow

**Goal**: build a correct CFG for legacy Blitz3D control flow (labels/goto,
while/for/repeat, break/continue).

**Status**: Implemented and covered by targeted tests.

**Where**

- CFG construction: `Sources/Compiler/IR/Analysis/ControlFlowGraph.swift`
- Tests: `Tests/CompilerTests/CFGBuilderTests.swift`

**Why this matters**

- CFG correctness is a prerequisite for any structured lowering (relooper /
  region structuring).

## DONE: Relooper → State Machine

**Goal**: eliminate irreducible control flow by lowering gotos/labels into a
deterministic dispatch loop.

**Status**: Implemented and covered by a state-machine test.

**Where**

- Pass: `Sources/Compiler/IR/Passes/Relooper.swift`
- Tests: `Tests/CompilerTests/RelooperStateMachineTests.swift`

**Key invariant**

- After relooper, control flow should be representable with `loop/if/br/br_if`
  (and no undefined stack behavior).

## DONE: Function Index Pre-registration (Forward Calls)

**Goal**: ensure direct `call` targets exist even if bodies appear later.

**Status**: Implemented.

**Where**

- `Sources/Compiler/CodeGen/IREmitter.swift`

## DONE (partial): Signature-driven Coercion

**Goal**: align call sites and variable sets with declared types so the wasm
operand stack stays type-correct.

**Status**: Major improvements landed, but remaining mismatch indicates more
cases exist.

**Where**

- `Sources/Compiler/CodeGen/IREmitter.swift`
- Lowering / coercions: `Sources/Compiler/Lowering/*`

## STILL FAILING: MapSystem.bb wasm-tools Validate

**Symptom**

- `type mismatch: expected i32, found f32` (func 549, offset 0x27383 in last
  observed module)

**Interpretation**

- Somewhere between IR lowering and raw WASM emission, the simulated stack type
  differs from the validator’s expectation.

**Likely buckets**

1. A value is produced as `f32` when the consumer expects `i32` (common:
   indices, booleans, pointer-ish values).
2. A control-flow merge has inconsistent stack types across branches.
3. A “drop/discard” policy is wrong, leaving a stray `f32` on the stack.

## Missing Plumbing (Needed Next)

- A way to map `(func index, instruction offset)` → compiler-level origin:
  - which IR function it corresponds to (source name if available)
  - which lowering/emitter step created the instruction
- A type-aware stack simulator:
  - IR-level (before emission)
  - WASM-level (post-emission but pre-encode), ideally as a debug check
