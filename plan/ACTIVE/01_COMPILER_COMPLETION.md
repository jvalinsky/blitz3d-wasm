# Compiler Completion Plan

## Status
**Type**: Maintenance
**Priority**: High
**Timeline**: Ongoing
**Progress**: See `docs/COMPILER_STATUS_ANALYSIS.md` (status and metrics are tracked there)

## Success Criteria
- [ ] `deno task test:all` is green (Swift + Deno + web build + wasm smoke)
- [ ] Compiler metrics in `docs/COMPILER_STATUS_ANALYSIS.md` remain accurate and up to date
- [ ] No new regressions in parser/codegen for real-world SCPCB patterns
- [ ] Any missing runtime imports are either implemented or explicitly/knowingly stubbed (no “silent” breakage)

## Current Focus

### 1) Keep the success-rate narrative consistent
- Plans/docs historically referenced “94.2% (49/52)” with placeholder “3 failing files”.
- Current source of truth is `docs/COMPILER_STATUS_ANALYSIS.md`.
- When the compiler/test suite changes, update that doc first, then update any summaries that quote the number (README + plan index).

### 2) Reduce “missing import” surprises
- The web runtime has safety stubs for missing imports, but those can hide real gaps.
- Prefer adding missing functions properly (compiler signature + runtime implementation) or consciously stubbing them behind explicit flags.

## Action Items

### Ongoing: Regression prevention
1. [ ] Add/extend fixtures for newly observed SCPCB patterns (parser + codegen)
2. [ ] Keep fast “compile + validate” loops easy to run locally (documented commands below)
3. [ ] Ensure any “temporary” workarounds are tracked in a plan (Track B preferred)

### When something breaks: triage checklist
1. [ ] Reproduce with smallest `.bb` fixture
2. [ ] Identify category: parse failure vs codegen invalid wasm vs runtime import mismatch
3. [ ] Add a targeted test first (Swift or Deno, whichever is appropriate)
4. [ ] Fix and run `deno task test:all`

## Commands

```bash
# Full baseline
deno task test:all

# Build SCPCB wasm (Track B)
deno task scpcb:compile:main

# Build dist + validate asset/model gates
deno task test:web:build
```

## Dependencies
- [ ] WASM Analyzer for validation of generated code
- [ ] Web Runtime for integration testing
- [ ] Test suite for regression prevention
- [ ] Parser debugging tools for complex cases
