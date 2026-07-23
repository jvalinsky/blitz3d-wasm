# 07 — Testing, Fuzzing, and Differential Methods (Catch Bugs Early)

## Current Test Coverage (2026-01-27) ✅

**WASM Validation Test Suite**: Successfully established as part of the WASM
Validation Trilogy fixes:

**Unit Tests** (Synthetic):

- `test_validator_underflow.bb` - Stack validator logic ✅
- `test_arg_conversion.bb` - Type conversion f32↔i32 ✅
- `test_branch_imbalance.bb` - Branch balancing (6 cases) ✅

**Integration Tests** (Real-World SCP-CB files):

- `Dreamfilter.bb` (16KB, 5 functions) ✅
- `Save.bb` (34KB, 9 functions) ✅
- `UpdateEvents.bb` (18KB, 6 functions) ✅
- `FMod.bb` (15KB, 4 functions) ✅
- `Menu.bb` (60KB, 32 functions) ✅

**Total Coverage**: 8/8 files validated (100% success rate), 144KB compiled
code, 0 validation errors

**Validation Rate Achievement**: Milestone A ("Always wasm-valid") achieved for
tested corpus.

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

**Tier C: Back-end** ✅ IMPLEMENTED

- [x] `wasm-validate` for all compiled modules (8/8 test files pass as of
      2026-01-27)
- [ ] Optional execution tests using a minimal runtime harness (future work)
- [x] Run a targeted compile/validate on a known-problem SCPCB file (e.g.,
      `scpcb/UpdateEvents.bb`) to track drop-related validator regressions.
      **Status:** ✅ `UpdateEvents.bb` now validates cleanly after WASM
      Validation Trilogy fixes. Additional validated files: `Save.bb`,
      `Menu.bb`, `Dreamfilter.bb`, `FMod.bb` (total: 5 real-world files, 144KB)

### 2. Differential testing (state-of-the-art approach)

**Action**

- Create a restricted subset of BB semantics (deterministic, no graphics) and:
  - run compiled WASM
  - run a reference interpreter for the same subset
  - compare printed traces and final variable states

**Why**

- Validator correctness is necessary but not sufficient; semantic drift is
  common in ports.

### 3. Metamorphic tests

For randomly generated programs, apply transformations that must preserve
behavior:

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

- [x] A stable corpus directory (SCPCB subset + microtests) ✅ COMPLETE
      (2026-01-27)
  - Unit tests: `test_validator_underflow.bb`, `test_arg_conversion.bb`,
    `test_branch_imbalance.bb`
  - Real-world: 5 SCP-CB files (Dreamfilter, Save, UpdateEvents, FMod, Menu)
  - Documentation: `REAL_WORLD_VALIDATION_RESULTS.md`,
    `WASM_VALIDATION_FIXES_SUMMARY.md`
- [ ] A JSON report format for failures (parse/semantic/runtime/validator)
      (future work: CI integration)

## References (in repo)

- Prior SCPCB compilation reporting artifacts:
  - `../../compile_test_report_*.txt`
  - `../../compile_errors_*.json`
