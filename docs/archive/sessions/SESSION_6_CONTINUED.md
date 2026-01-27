# Session 6 Continued: DevilParticleSystem Deep Dive

**Status**: In Progress - Debugging single remaining file

## Problem Statement

DevilParticleSystem.bb has 1 validation error:
```
/tmp/DevilParticleSystem.wasm:00042e9: error: type mismatch at end of `if true` branch, expected [] but got [i32]
```

## Investigation Summary

### Binary Search Results
- Lines 1-210: PASS ✅
- Lines 211-421: PASS ✅ (when compiled alone)
- Lines 1-315: PASS ✅
- Lines 1-350: FAIL ❌ (same error at offset 0x4222)
- Lines 1-331 through 1-350: ALL FAIL at same offset

**Key Finding**: Error offset stays constant (0x4222) regardless of which lines 331-421 are included. This means the problematic code is BEFORE line 331, but only manifests as an error when enough context exists.

### Isolated Test Cases (All Pass ✅)

1. Single-line if with void function call
2. EntityTexture with 3 parameters
3. Auto-declared variables in expressions
4. forEach loops with types
5. Exact pattern from lines 334-338

**Conclusion**: The error is NOT in the syntax patterns themselves, but in how compiler state accumulates when processing the full file.

## Hypothesis

The error at offset 0x4222 is in a function earlier than line 331, likely in the `UpdateParticles_Devil()` function that starts at line 297. The function:
- Uses forEach loop over Emitters
- Has nested if statements
- Calls EntityTexture with 3 parameters (but runtime declares 4)
- Uses auto-declared global variables

**Potential Root Cause**: EntityTexture declared as 4-parameter function, but called with 3. When parameter count doesn't match, might be:
1. Falling back to default behavior
2. Returning i32 instead of void
3. Leaving value on stack in single-line if

## EntityTexture Declaration Issue

**Our Runtime**:
```swift
("EntityTexture", "EntityTexture", [.i32, .i32, .i32, .i32], [], "env"),
```

**Actual Usage in SCPCB**:
- 2 parameters: `EntityTexture entity, texture` (AAText.bb, DevilParticleSystem.bb line 256)
- 3 parameters: `EntityTexture entity, texture, frame` (DevilParticleSystem.bb line 337)
- 4 parameters: `EntityTexture entity, texture, frame, blend` (Main.bb)

Blitz3D supports optional/default parameters, but our compiler only has one signature.

## Next Steps

### Immediate
1. Add multiple EntityTexture overloads to runtime (2, 3, and 4 parameter versions)
2. Recompile DevilParticleSystem and verify fix
3. Check if other functions also need multiple signatures

### Short-term
1. Survey all SCPCB function calls to find other functions with optional parameters
2. Add all necessary overloads to runtime
3. Consider implementing proper optional parameter support in compiler

### Long-term
1. Implement optional/default parameters in function declarations
2. Add parameter count resolution during semantic analysis
3. Generate appropriate function calls based on provided arguments

## Function Signature Audit Needed

These Blitz3D functions commonly have optional parameters:
- EntityTexture (2-4 params)
- LoadMesh (1-2 params)
- CreateSprite (0-2 params)
- EntityAlpha (1-2 params)
- EntityColor (2-4 params)
- PositionEntity (2-4 params)
- RotateEntity (2-5 params)
- ScaleEntity (2-4 params)

Need to audit runtime declarations and add all variations.

## Time Investment

- Phase 1 (Cleanup): 15 min
- Phase 2 (Binary Search): 45 min
- Phase 3 (Isolated Tests): 30 min
- Phase 4 (Deep Investigation): 60 min
- **Total**: 2.5 hours

## Lessons Learned

1. **Cumulative State Matters**: Errors can be caused by interaction between distant parts of code
2. **Binary Search Has Limits**: When error offset stays constant, problem is earlier than search range
3. **Isolated Tests Insufficient**: Must test with full context to catch state-dependent bugs
4. **Optional Parameters**: Major gap in our compiler - many Blitz3D functions have them
5. **Take Time**: Rushing leads to testing wrong hypotheses - slow, methodical debugging pays off

## Files to Check Next

After fixing EntityTexture, these files likely have similar issues:
- NPCs.bb - 16 type errors
- Save.bb - 96 type errors  
- UpdateEvents.bb - 7 type errors

All are TYPE MISMATCH errors, not stack balance.
