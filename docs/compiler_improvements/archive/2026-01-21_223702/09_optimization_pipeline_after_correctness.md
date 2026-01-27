# 09 — Optimization Pipeline (Only After Correctness)

## Goal

Improve runtime performance and output size without risking correctness:
- Make optimizations opt-in until correctness is proven stable.
- Use IR-level invariants to keep optimizations safe.

## Current State (observed)

- There is a basic stack scheduling optimization pass (Koopman-inspired):
  - `../../../Sources/Compiler/CodeGen/StackScheduler.swift`
- Source mapping currently disables optimizations for stability:
  - `../../../Sources/Compiler/CodeGen/CodeGenerator.swift`

## Plan

### 1. Establish performance baselines

**Action**
- Track:
  - compile time for SCPCB
  - module size
  - frame-time microbenchmarks in browser (small scenes)

### 2. IR-level safe optimizations (recommended first)

Once IR exists (see plan 03), implement:
- constant folding
- dead-code elimination in structured IR
- local common subexpression elimination for pure ops

### 3. WASM-level toolchain (optional)

If you choose to integrate external tooling:
- `wasm-opt` for size/speed levels
- keep a “no wasm-opt” path for deterministic debugging

### 4. Data layout optimizations (runtime + compiler cooperation)

For Type collections, consider (later):
- packed iteration caches for `For Each` loops (while preserving semantics)

## Acceptance

- Optimizations never reintroduce `wasm-validate` failures.
- Debug builds remain easy to trace (optimized builds are optional).

