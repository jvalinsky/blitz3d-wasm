# Subplan 01 — Compiler (Swift BB→WASM)

**Phase**: Continuous (maintenance mode)
**Parent**: [00_GLOBAL_PLAN.md](../00_GLOBAL_PLAN.md)
**Code**: `Sources/Compiler` (~18.5K lines: Lexer, Preprocessor, Parser, AST, IR, Lowering, CodeGen)
**Canonical metrics**: `docs/COMPILER_STATUS_ANALYSIS.md` — never copy numbers into this file.

## Objective

Keep the compiler correct, regression-proof, and aligned with the runtime import contract. The compiler is production-ready *for current scope*; it re-enters active development only when SCPCB, mods, or the Phase B engine migration surface new requirements.

## Principles

- **No silent stubs.** A missing runtime import is either implemented (compiler signature + runtime implementation together) or consciously stubbed behind an explicit flag with a tracking entry here.
- **Fixture-first fixes.** Every bug becomes a minimal `.bb` fixture *before* the fix.
- **Metrics live in one place.** Update `docs/COMPILER_STATUS_ANALYSIS.md` first; plans/README only link to it.

## Workstreams

### 1.1 Regression prevention (ongoing)

- [ ] Add/extend fixtures for newly observed SCPCB and mod patterns (parser + codegen)
- [ ] Keep `deno task test:all` green (Swift + Deno + web build + wasm smoke)
- [ ] Keep import/signature changes in lockstep with the runtime contract (both TS runtime and Swift engine once Phase B starts)
- [ ] Track any temporary workaround as a checklist item in the owning subplan

### 1.2 Triage protocol (when something breaks)

1. Reproduce with the smallest possible `.bb` fixture
2. Classify: parse failure | codegen produces invalid wasm | runtime import mismatch
3. Add a targeted test first (Swift or Deno, whichever layer owns the bug)
4. Fix, then run `deno task test:all`
5. Log action + outcome in deciduous, link commit with `--commit HEAD`

### 1.3 Diagnostics quality (opportunistic)

- [ ] Complete span-carrying AST work so errors report file:line:col (see archived `docs/plans/2026-01-21-ast-spans-and-instrumentation-reintroduction.md` for prior analysis)
- [ ] Compile-error messages name the offending token and suggest the fix for the known deprecated-syntax cases (e.g. `Dim a[10]` → `Dim a(10)`)
- [ ] Optional: emit WASM name section for readable stack traces in devtools

### 1.4 Phase B alignment (starts with Phase B)

- [ ] Audit generated import surface vs. `Blitz3DEngine` exported surface; produce a machine-readable signature manifest both sides check in CI
- [ ] Ensure codegen can target either runtime without flags (identical ABI) — any divergence is a bug in the engine, not a compiler branch

## Acceptance criteria

- `deno task test:all` green at all times on `main`
- Zero unexplained divergence between documented and actual pass rates
- Every runtime import referenced by generated wasm is implemented or explicitly flagged as stubbed

## Commands

```bash
deno task test:all              # full baseline
deno task scpcb:compile:main    # build SCPCB wasm
deno task test:web:build        # dist build + asset/model gates
swift test                      # compiler unit tests
```
