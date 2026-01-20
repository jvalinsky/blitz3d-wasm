# Stack Balancing Research - WASM Compiler Solutions

**Date**: January 20, 2026  
**Research Duration**: 30 minutes  
**Status**: Comprehensive solutions identified

---

## The Problem

Our compiler generates WASM with unbalanced if/else branches:

```wasm
(if (result)                    ; expects empty stack
  (then 
    (call $foo)                 ; returns i32
    ; BUG: i32 left on stack!
  )
)
; ERROR: expected [] but got [i32]
```

**Impact**: 12 files fail validation (23% of test suite)

---

## Solution Overview

Five proven approaches from production compilers:

### 1. **LLVM's CFGStackify** ⭐ Recommended
- **Time**: 8-12 hours
- **Risk**: Medium
- **Approach**: Insert BLOCK/LOOP markers before generating code
- **Pros**: Proven in LLVM, handles all CFG patterns
- **Cons**: Requires CFG analysis pass

### 2. **SSA + Stackification**
- **Time**: 12-16 hours  
- **Risk**: High
- **Approach**: Convert to SSA form, then "stackify" back to stack machine
- **Pros**: Cleanest solution, enables other optimizations
- **Cons**: Major architectural change

### 3. **Three-Stack Validation**
- **Time**: 6-8 hours
- **Risk**: Medium
- **Approach**: Track value/control/init stacks during generation
- **Pros**: Matches WASM spec exactly
- **Cons**: Requires threading state through generators

### 4. **Relooper Algorithm**
- **Time**: 10-14 hours
- **Risk**: High
- **Approach**: Decompose CFG into Simple/Multiple/Loop shapes
- **Pros**: Handles irreducible control flow
- **Cons**: Complex implementation

### 5. **Binaryen Post-Processing** ⭐ Quick Win
- **Time**: 4-6 hours
- **Risk**: Low
- **Approach**: Generate WASM, run binaryen optimizer to fix
- **Pros**: Uses existing tools, minimal code changes
- **Cons**: Less control, black box approach

---

## Key Insights from Research

### WASM Is Not a Pure Stack Machine
- Has structured control flow (blocks define scopes)
- Stack must be balanced at block boundaries
- Can't just add .drop everywhere

### SSA Form Helps Immensely
- Each variable has single assignment
- Stack liveness becomes trivial: "dies when consumed"
- Automatically prevents undefined variable access
- Used by: LLVM, Binaryen, most production compilers

### Validation Uses Three Stacks
From WASM spec:
1. **Value Stack**: Operand types (i32, f32, etc.)
2. **Control Stack**: Block nesting and expected types
3. **Initialization Stack**: Variable initialization tracking

### Production Compilers' Approach
- **LLVM**: CFGStackify pass before code generation
- **Emscripten**: Relooper for CFG → structured control flow
- **Binaryen**: SSAify pass + optimization passes
- **AssemblyScript**: Uses Binaryen as backend

**Common Pattern**: Transform BEFORE generating WASM, not after!

---

## Recommended Implementation

### Phase 1: Quick Fix (4-6 hours)
1. Integrate Binaryen as post-processor
2. Generate WASM as-is
3. Run `binaryen.optimize()` to fix stack issues
4. Validate fixed WASM

**Benefits**: 
- Unblocks 12 failing files immediately
- Low risk to existing code
- Can refine later

### Phase 2: Proper Solution (8-12 hours)
1. Add CFG analysis pass
2. Implement CFGStackify-style algorithm
3. Insert BLOCK/LOOP markers during generation
4. Track stack state in control structures

**Benefits**:
- Full control over generated code
- Better error messages
- Enables future optimizations

### Phase 3: Long-term (12-16 hours)
1. Add SSA intermediate representation
2. Implement stackification pass
3. Enable advanced optimizations
4. Match production compiler quality

---

## References

### LLVM WebAssembly Backend
- **CFGStackify**: https://llvm.org/doxygen/WebAssemblyCFGStackify_8cpp_source.html
- Inserts BLOCK/LOOP/TRY markers for scopes
- Handles single-entry loops
- Time: O(NumBlocks * NumNestedLoops)

### Stackification Algorithm
- **Gist Example**: https://gist.github.com/evanw/58a8a5b8b4a1da32fcdcfbf9da87c82a
- Turns SSA form into stack machine code
- Used by LLVM's WASM backend
- Distinguishes "stackified" vs "localized" values

### WASM Spec
- **Validation Algorithm**: https://webassembly.github.io/spec/core/appendix/algorithm.html
- Defines three-stack validation model
- Declarative constraints
- Single-pass over opcodes

### Relooper
- **Article**: https://medium.com/leaningtech/solving-the-structured-control-flow-problem-once-and-for-all-5123117b1ee2
- Handles arbitrary CFG → structured control flow
- Used by Emscripten
- Decomposition into Simple/Multiple/Loop shapes

### Binaryen
- **SSAify Pass**: https://github.com/WebAssembly/binaryen/blob/main/src/passes/SSAify.cpp
- Converts to SSA without phi nodes
- Multiple assignments at merge points
- Used by AssemblyScript

---

## Decision Matrix

| Approach | Time | Risk | Control | Quality |
|----------|------|------|---------|---------|
| Binaryen Post-Process | 4-6h | Low | Low | Medium |
| CFGStackify | 8-12h | Med | High | High |
| Three-Stack Tracking | 6-8h | Med | Med | Medium |
| SSA + Stackification | 12-16h | High | High | Excellent |
| Relooper | 10-14h | High | High | High |

**Recommendation**: Start with **Binaryen Post-Processing** to unblock progress, then implement **CFGStackify** for production quality.

---

## Next Steps

1. **Immediate** (30 min):
   - Install binaryen npm package
   - Test post-processing on failing WASM
   - Measure improvement

2. **Short-term** (Weekend):
   - Implement Binaryen integration
   - Rerun full test suite
   - Document results

3. **Medium-term** (Next week):
   - Design CFG analysis pass
   - Prototype CFGStackify algorithm
   - Benchmark vs Binaryen

4. **Long-term** (Next month):
   - Evaluate SSA intermediate form
   - Plan migration path
   - Implement gradually

---

Generated after 13+ hour session
Research compiled from LLVM, Binaryen, WASM spec
All production compilers use similar approaches
