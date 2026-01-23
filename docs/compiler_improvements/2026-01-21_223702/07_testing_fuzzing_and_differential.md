# 07 — Testing, Fuzzing, and Differential Methods (Catch Bugs Early)

## Goal

Turn correctness into a continuously enforced property:
- Parser/semantic tests catch regressions before codegen is involved.
- WASM validation is run automatically on a stable corpus.
- Randomized testing finds edge cases in control-flow, typing, and calls.

## Plan

### 1. Build a tiered test suite

**Tier A: Front-end**
- Lexer tokenization golden tests.
- Parser golden AST tests for tricky constructs.

**Tier B: Semantic**
- Symbol resolution across includes.
- Type inference and implicit variable behavior.
- Call resolution (overloads/defaults/array-vs-call).

**Tier C: Back-end**
- `wasm-validate` for all compiled modules.
- Optional execution tests using a minimal runtime harness.
- Run a targeted compile/validate on a known-problem SCPCB file (e.g., `scpcb/UpdateEvents.bb`) to track drop-related validator regressions. **Update:** `UpdateEvents.bb` now validates cleanly after typed `for` lowering and SCPCB import/stub fixes.

### 2. Differential testing (state-of-the-art approach)

**Action**
- Create a restricted subset of BB semantics (deterministic, no graphics) and:
  - run compiled WASM
  - run a reference interpreter for the same subset
  - compare printed traces and final variable states

**Why**
- Validator correctness is necessary but not sufficient; semantic drift is common in ports.

### 3. Metamorphic tests

For randomly generated programs, apply transformations that must preserve behavior:
- Insert redundant parentheses
- Split `:`-chained statements into newlines
- Replace `If cond Then A Else B` with multi-line form

### 4. Fuzzing targets

**Lexer/parser fuzz**
- Random tokens + “almost valid” constructs for recovery testing.

**IR/codegen fuzz**
- Random structured control-flow trees with calls and conversions, ensuring:
  - no invalid WASM emitted
  - validator errors map back to source spans

## Deliverables

- A stable corpus directory (SCPCB subset + microtests).
- A JSON report format for failures (parse/semantic/runtime/validator).

## References (in repo)

- Prior SCPCB compilation reporting artifacts:
  - `../../compile_test_report_*.txt`
  - `../../compile_errors_*.json`
