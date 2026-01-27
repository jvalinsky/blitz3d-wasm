# Validation Debugging Workflow

This is the standard workflow for turning a wasm-tools validation error into a minimal compiler fix + regression.

## 1) Get a stable failing artifact

```bash
swift build -c debug
.build/arm64-apple-macosx/debug/blitz3d-wasm ../scpcb/MapSystem.bb --use-ir -o /tmp/MapSystem_ir.wasm
wasm-tools validate /tmp/MapSystem_ir.wasm 2> /tmp/MapSystem_ir.validate.txt
```

Record:
- func index (e.g. `func 549`)
- byte offset (e.g. `0x27383`)
- expected/found types

## 2) Locate the failing instruction

Use one of these:

```bash
wasm-tools print /tmp/MapSystem_ir.wasm > /tmp/MapSystem_ir.print.wat
```

Or:

```bash
wasm-objdump -d /tmp/MapSystem_ir.wasm > /tmp/MapSystem_ir.disasm.txt
```

Goal: identify the specific instruction at/near the failing offset and the surrounding block/if/loop context.

## 3) Map func index → compiler function

Add (or use) a debug dump that prints, during module emission:
- wasm func index
- source function name (if known)
- IR function id

This should be a single opt-in flag so normal builds stay clean.

## 4) Add a typed stack trace (debug-only)

For the failing function only:
- log stack types before/after each emitted instruction (or each IR op)
- stop when a mismatch is detected

This will usually point directly at:
- a missing coercion
- a wrong opcode choice (`i32.*` vs `f32.*`)
- an incorrect discard/drop
- a broken merge rule for `if` / `br_if`

## 5) Reduce to a minimal test

Prefer one of these test types:

1. **Unit test**: feed a tiny IR program into the pass/emitter and assert wasm validation.
2. **Golden test**: compile a short `.bb` snippet through `--use-ir` and validate output.

Minimal test rule: isolate the failure to the smallest input that still triggers the validator error.

## 6) Fix, then lock it in

- Apply the fix in the most local place (usually: lowering coercion or emitter opcode selection).
- Add/extend a test that:
  - compiles the snippet
  - runs `wasm-tools validate`
  - fails with a clear message if invalid

