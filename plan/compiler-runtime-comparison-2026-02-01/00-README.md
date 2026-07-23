# Compiler & Runtime Comparison Plan

**Date**: February 1, 2026\
**Status**: Analysis Complete\
**Priority**: Critical Review

## Overview

Comprehensive analysis comparing our Swift-based Blitz3D→WASM compiler and
runtime implementation against the reference Blitz3D-NG implementation (C++).
This analysis identifies critical gaps, semantic differences, and provides a
roadmap for achieving compatibility with SCPCB.

## Document Structure

This plan is organized into the following documents:

### Analysis Phase

1. **01-executive-summary.md** - High-level findings and recommendations
2. **02-compiler-comparison.md** - Swift compiler vs Blitz3D-NG compiler
3. **03-runtime-comparison.md** - Swift engine vs Blitz3D-NG runtime (750+
   functions)
4. **04-critical-issues.md** - Blocking issues that prevent SCPCB from working

### Planning Phase

5. **05-priority-matrix.md** - Prioritized list of issues and gaps
6. **06-implementation-roadmap.md** - Phased approach to closing gaps
7. **07-scpcb-compatibility.md** - Specific requirements for SCPCB support

### Technical Details

8. **08-architecture-decisions.md** - Key architectural differences and
   rationale
9. **09-testing-strategy.md** - Validation approach for changes

## Key Findings Summary

### 🔴 Critical Blockers

1. **Include file support** - Stubbed out in Swift compiler (blocks SCPCB
   Main.bb with 23 includes)
2. **Asset loading** - No LoadMesh/LoadTexture/LoadImage in Swift engine
3. **File I/O** - Zero file operations (0/30 functions)
4. **Math library** - No trigonometry functions (0/29 functions)
5. **String operations** - No string manipulation (0/28 functions)

### 📊 Coverage Statistics

- **Swift Compiler**: 94.7% individual file success, but missing include support
- **Swift Engine**: 166/750 functions = **22% coverage** of Blitz3D-NG runtime
- **Scene Graph**: 64% coverage (strongest area)
- **Graphics/Rendering**: 29% coverage (missing asset loading)
- **Audio**: 9% coverage (minimal)
- **Physics**: 15% coverage (no ODE integration)

### ✅ Correct Design Decisions

- **Relooper algorithm** - Required for WASM structured control flow (not a bug)
- **Import-based runtime** - Separation of compiler and runtime is sound
  architecture
- **TypeScript runtime** - May provide missing functionality via browser APIs

## Next Steps

1. Review all documents in order
2. Prioritize critical issues (document 05)
3. Implement include file support (immediate priority)
4. Audit TypeScript runtime to identify what it provides
5. Create implementation plan for top priorities

## Related Documentation

- Project memory blocks: `project/compiler/swift/issues`,
  `project/compiler/swift/differences`
- Source locations:
  - Swift compiler: `Sources/Compiler/`
  - Swift engine: `Sources/Blitz3DEngine/`
  - Blitz3D-NG reference: `/Users/jack/Software/scp_port/reference/blitz3d-ng/`
  - SCPCB codebase: `/Users/jack/Software/scp_port/scpcb/`

## Timeline

- **Analysis Phase**: Complete (Feb 1, 2026)
- **Priority 1 (Critical)**: 1-2 weeks
- **Priority 2 (High)**: 1-3 months
- **Priority 3 (Medium)**: 3-6 months
- **Full SCPCB Compatibility**: 6-12 months (estimated)
