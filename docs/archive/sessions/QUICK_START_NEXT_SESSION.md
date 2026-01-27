# Quick Start Guide - Next Session

## Current Status (Session 6 End)
- **Pass Rate**: 80% (29/36 files)
- **Unit Tests**: 100% (244/244)
- **Blocking Issue**: Optional parameters not supported

## Failing Files
1. **Main.bb** - CRASH (compiler crash)
2. **MapSystem.bb** - CRASH (compiler crash)
3. **DevilParticleSystem.bb** - 1 error (needs optional params)
4. **NPCs.bb** - 16 errors (type inference)
5. **Save.bb** - 96 errors (type inference)
6. **UpdateEvents.bb** - 7 errors (type inference)
7. **Items.bb** - Unknown (was passing, need to check)

## First 30 Minutes

### 1. Check Current State (5 min)
```bash
cd /Users/jack/Software/scp_port/blitz3d-wasm
swift test | grep "Executed"
bash test_scpcb_fast.sh | tail -10
```

### 2. Investigate Main.bb Crash (25 min)
```bash
# Get stack trace
lldb -- swift run blitz3d-wasm ../scpcb/Main.bb -o /tmp/Main.wasm
# At crash: type 'bt' for backtrace

# Binary search to find crash line
head -7500 ../scpcb/Main.bb > /tmp/main_half1.bb
swift run blitz3d-wasm /tmp/main_half1.bb -o /tmp/test.wasm
# Continue until you find the exact line
```

## Priority Order (Next 3-4 Hours)

### Phase 1: Fix Crashes (HIGHEST PRIORITY)
**Why**: Blocking 2 files, likely quick fixes

**Commands**:
```bash
# Find crash line in Main.bb
# Check reference:
grep -r "similar.*pattern" /Users/jack/Software/scp_port/reference/blitz3d-ng/
# Fix and test
swift test
bash test_scpcb_fast.sh
```

**Expected**: 80% → 82% (31/36)

### Phase 2: Optional Parameters (IF CRASHES ARE QUICK)
**Why**: Blocks DevilParticleSystem, needed for other features

**Reference to Check**:
```bash
# How Blitz3D handles default params
cat /Users/jack/Software/scp_port/reference/blitz3d-ng/src/tools/compiler/tree/func/func.cpp
# Search for default or optional
grep -r "default" /Users/jack/Software/scp_port/reference/blitz3d-ng/src/tools/compiler/
```

**Start Point**: Read `docs/NEXT_STEPS_DETAILED_PLAN.md` Phase 2

### Phase 3: Type Inference (IF TIME ALLOWS)
**Why**: Fixes remaining 3 files, well-understood problem

**Quick Fixes**:
1. Check `TypeInference.swift` - scan whole function body
2. Verify `getTargetType()` checks suffix first
3. Ensure binary ops promote correctly

## Key Resources

### Reference Code Locations
```bash
# Blitz3D C++ compiler source
cd /Users/jack/Software/scp_port/reference/blitz3d-ng/src/tools/compiler/

# Function handling
cat tree/func/func.cpp

# Variable handling
cat tree/var/ident_var.cpp
cat tree/var/decl_var.cpp

# Type system
cat tree/type/type.cpp

# Statement generation
cat tree/stmt/*.cpp
```

### Our Compiler Key Files
```bash
cd /Users/jack/Software/scp_port/blitz3d-wasm/Sources/Compiler/

# Parser
nano Parser/Parser.swift

# Type inference
nano CodeGen/TypeInference.swift

# Code generation
nano CodeGen/StatementGeneration.swift
nano CodeGen/ExpressionGeneration.swift
nano CodeGen/CodeGenerator.swift
```

### Testing
```bash
# Quick SCPCB test
bash test_scpcb_fast.sh | grep -E "(PASS|FAIL|Summary)" | tail -20

# Full unit tests
swift test

# Specific file
swift run blitz3d-wasm ../scpcb/Main.bb -o /tmp/Main.wasm
wasm-validate /tmp/Main.wasm
```

## Common Debugging Commands

### Find Error Pattern
```bash
# Get all validation errors for a file
wasm-validate /tmp/NPCs.wasm 2>&1 | grep "error:" | head -20

# Count error types
wasm-validate /tmp/Save.wasm 2>&1 | grep "error:" | cut -d: -f3 | sort | uniq -c

# Find specific pattern in source
grep -n "problematic_pattern" ../scpcb/Main.bb
```

### Binary Search File
```bash
# Save this as a function in your shell:
test_lines() {
    head -$1 ../scpcb/$2 > /tmp/test_$2
    swift run blitz3d-wasm /tmp/test_$2 -o /tmp/test.wasm 2>&1 | grep -q "Wrote WASM"
    echo $?  # 0 = success, non-zero = fail
}

# Usage:
test_lines 5000 Main.bb
```

### Check Reference Code
```bash
# Find how Blitz3D handles a specific construct
cd /Users/jack/Software/scp_port/reference/blitz3d-ng/
grep -r "keyword_or_pattern" src/tools/compiler/

# View specific implementation
cat src/tools/compiler/tree/stmt/if.cpp
cat src/tools/compiler/tree/expr/call.cpp
```

## Session Goals

### Minimum (2-3 hours)
- ✅ Fix Main.bb and MapSystem.bb crashes
- ✅ Document findings
- **Result**: 82% pass rate

### Moderate (4-6 hours)
- ✅ Fix crashes
- ✅ Start optional parameter implementation
- ✅ Design complete, parser partially updated
- **Result**: 82% + solid foundation for next session

### Ambitious (8+ hours)
- ✅ Fix crashes
- ✅ Complete optional parameters
- ✅ Fix at least one type inference file
- **Result**: 85%+ pass rate

## Remember

1. **Use reference code** when stuck - it has all the answers
2. **Think deeply** before implementing - understand why, not just how
3. **Test frequently** - after every change
4. **Document as you go** - future you will thank you
5. **Take your time** - rushing leads to wrong fixes

## If You Get Stuck

1. Read relevant reference code
2. Create minimal reproduction
3. Check if it's a parser issue or codegen issue
4. Look at unit tests for similar patterns
5. Binary search to isolate exact problem

---

**Start with**: Fix Main.bb crash (highest impact, likely quick win)  
**Detailed Plan**: See `NEXT_STEPS_DETAILED_PLAN.md`  
**Full Context**: See `SESSION_6_COMPLETE.md`
