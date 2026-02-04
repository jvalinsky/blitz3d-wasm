# IR Design and Tradeoffs (With References)

This section is about **compiler IR choices** when targeting WebAssembly, and why
they materially affect correctness, performance, and maintainability.

This repo already contains multiple “layers” that act like IR; when rebuilding
from scratch, pick a deliberate IR strategy instead of letting it accrete.

## Why an IR at all?

An IR is what makes these goals possible:

- Separate **parsing** (syntax) from **meaning** (binding, types, coercions).
- Separate **meaning** from **WASM emission** (stack discipline, structured control flow).
- Make it feasible to add:
  - validation hooks (stack/type checks),
  - deterministic lowering passes,
  - optimizations (even simple ones) without rewriting codegen.

## WebAssembly Shapes Your IR

### 1) WASM is a structured control-flow stack machine

WASM control flow is expressed with `block/loop/if` and branches (`br/br_if/br_table`),
not arbitrary jumps. That means any source language feature that looks like
unstructured jumps (e.g. `Goto`/`Gosub`) must be **restructured** or lowered to a
state machine.

Reference (control-flow overview):
```
https://developer.mozilla.org/en-US/docs/WebAssembly/Reference/Control_flow
```

### 2) WASM validation is stack-typed and path-sensitive

WASM requires all control-flow paths to agree on the stack shape/types at joins.
The spec’s validation algorithm explicitly tracks a value stack and control stack
with an `unreachable` flag that enables stack-polymorphism.

References (spec + validation algorithm):
```
https://webassembly.github.io/spec/core/
https://webassembly.github.io/spec/core/_download/WebAssembly.pdf
```

Practical implication:
- If your IR makes stack effects implicit, you will fight wasm-validate constantly.
- If your IR makes stack effects explicit, you can validate *before* emitting bytes.

## Common IR Options (and their tradeoffs)

### Option A — Direct AST → WASM emission

**Pros**
- Fastest to prototype.
- Fewer layers.

**Cons**
- Stack balancing becomes “every node must be correct” with little help.
- Hard to implement coherent type coercion rules.
- Hard to support `Goto/Gosub` safely without a major refactor later.

Use this only for a toy compiler.

### Option B — “WASM-like” stack IR (explicit instructions)

**Pros**
- 1:1 mapping to WASM opcodes.
- Easy to emit binary once you’re correct.

**Cons**
- You have effectively committed to thinking in a stack machine everywhere.
- Higher-level optimizations become awkward unless you add additional structure.
- You still need a structured-control-flow story.

This can work well if you invest early in:
- a stack validator (like this repo does), and
- consistent lowering passes that normalize control flow.

### Option C — SSA / CFG IR (values + basic blocks)

**Pros**
- Great for analysis and optimization (CSE, DCE, constant folding, LICM, etc.).
- Makes many correctness checks and transforms straightforward.

**Cons**
- You must eventually lower SSA/CFG to WASM’s structured form.
  - If your source has unstructured jumps, you need a “relooper”/structuring pass
    or a state-machine transform.
- You must eliminate φ-nodes (phis) in a WASM-compatible way (copies on edges, etc.).

This approach is powerful, but “from scratch” it’s easy to overbuild.

### Option D — Hybrid “typed expression/effect IR” (recommended here)

This is effectively what you want for Blitz3D→WASM:

- Expressions lower to typed values (e.g. `.i32`, `.f32`, `.void`)
- Statements lower to side-effecting operations (stores, calls, branches)
- Control flow is represented structurally (if/while/for/select) and emitted via
  a small set of IR constructs

**Pros**
- Much easier to keep WASM stack correctness under control.
- Still amenable to targeted optimizations (constant folding, trivial DCE).
- You can centralize coercions and ABI rules.

**Cons**
- Some optimizations are harder than SSA.
- Unstructured jumps still require special handling.

## Unstructured Control Flow: Relooper vs State Machine

If you need to support `Goto/Gosub` (or anything that produces an arbitrary CFG),
you have two standard strategies:

### Strategy 1 — Relooper (CFG → structured control flow)

Binaryen provides a “Relooper” utility that can take an arbitrary CFG and emit
structured control flow suitable for WebAssembly.

Reference (Binaryen wiki):
```
https://github-wiki-see.page/m/WebAssembly/binaryen/wiki/Compiling-to-WebAssembly-with-Binaryen
```

Reference (Emscripten mentions relooper in papers/talks list):
```
https://emscripten.org/docs/introducing_emscripten/Talks-and-Publications.html
```

### Strategy 2 — State machine transform

Lower unstructured control flow into:
- a program counter / state variable, and
- a structured loop + `switch` (`br_table` in WASM terms)

This tends to be simpler to implement than a full relooper, but can:
- be slower (dispatch every “step”),
- be more verbose in generated code,
- complicate debugging (unless you keep good source maps).

## Stack Scheduling and “Keep Values on Stack”

Even if your IR is not explicitly stack-based, WASM execution is. You can improve
performance by reducing redundant local loads/stores and letting values remain on
the stack when safe.

Koopman’s classic work on intra-block stack scheduling is a useful mental model:
```
https://users.ece.cmu.edu/~koopman/stack_compiler/
```

This repo implements a Koopman-style “stack scheduler” in codegen; treat it as an
optional optimization layer, not a correctness dependency.

## Security/Robustness Tradeoffs (IR invariants)

IR design is also about preventing whole classes of bugs.

Cranelift’s public design notes emphasize:
- keeping IR without undefined behavior by design, and
- defending against pathological inputs.

Reference:
```
https://cranelift.dev/
```

For this project, the analogous principles are:
- make “type + stack effect” explicit in IR nodes,
- avoid transforms with quadratic worst-cases on large SCPCB code,
- keep parsing and lowering non-recursive where possible for huge merged sources.

## What This Repo Does Today (Code-First)

Prefer reading the real implementation over docs:

- Parser (syntax only): `Sources/Compiler/Parser/Parser.swift`
- Lowering (semantic binding + typed IR values/effects): `Sources/Compiler/Lowering/ASTLowering.swift`
- IR → WASM emission: `Sources/Compiler/CodeGen/IREmitter.swift`
- Stack validation: `Sources/Compiler/CodeGen/StackValidator.swift`
- Optional stack scheduling: `Sources/Compiler/CodeGen/StackScheduler.swift`

The key rebuild takeaway:
- Keep IR **typed** and control-flow **structured** as early as possible.
- Make “WASM-valid by construction” the default, and keep optimizations optional.

