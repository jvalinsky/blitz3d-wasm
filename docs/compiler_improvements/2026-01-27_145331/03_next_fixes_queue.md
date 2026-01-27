# Next Fixes Queue (Prioritized)

This is the “most likely to fix the next wasm validate error first” queue.

## P0 — Must do first (to unblock iteration speed)

1. **Function index → name mapping**
   - Add a debug print during emission: wasm func index + function name.
   - Outcome: when validate says `func 549`, we immediately know which Blitz function it is.

2. **Emitter-side typed stack simulator (debug-only)**
   - Simulate WASM operand stack types during emission.
   - Assert at each instruction that operands/results match opcode type.
   - Outcome: mismatch points to the exact opcode that introduced/consumed the wrong type.

## P1 — Likely sources of `expected i32, found f32`

1. **Index coercions in all array access paths**
   - Ensure indices are always `i32` at the point they reach `load/store` or runtime helpers.
   - Pay attention to: multi-dim flattening, computed indices, and mixed numeric expressions.

2. **Branch/merge stack rules**
   - For `if` lowering: both arms must leave identical stack types.
   - For loops: ensure no accidental value leakage across `br` targets.

3. **Drop/discard correctness**
   - Any expression statement that produces a value must drop it.
   - Any statement that must *preserve* a value must not be over-dropped.

4. **Boolean conventions**
   - Ensure conditions are always `i32` (0/1), never `f32`.
   - Audit places where comparisons might return `f32` by accident.

## P2 — Make correctness self-policing

1. **IR type/effect annotations (minimal version)**
   - Not a full dependent type system; just enough to predict stack types.

2. **Differential tests**
   - Compile same snippet via “old path” and “IR path” and compare key runtime behavior.

