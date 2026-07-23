# Priority Matrix & Implementation Order

**Date**: February 1, 2026\
**Purpose**: Prioritized list of all identified issues and gaps

---

## Priority Definitions

- **P0 (Critical)**: Blocks SCPCB from compiling or running at all
- **P1 (High)**: Blocks significant gameplay features
- **P2 (Medium)**: Limits functionality but workarounds exist
- **P3 (Low)**: Nice-to-have, not essential for SCPCB

---

## P0: Critical Blockers (Must Fix Immediately)

### Compiler Issues

| # | Issue                | Component | Effort            | Dependency            |
| - | -------------------- | --------- | ----------------- | --------------------- |
| 1 | Include file support | Compiler  | Medium (2-3 days) | None - **START HERE** |

### Runtime Issues

| # | Issue                                            | Component        | Effort             | Dependency         |
| - | ------------------------------------------------ | ---------------- | ------------------ | ------------------ |
| 2 | Math library (29 functions)                      | Runtime          | Low (2-5 days)     | None               |
| 3 | String operations (28 functions)                 | Runtime          | Medium (1-2 weeks) | None               |
| 4 | File I/O (30 functions)                          | Engine + Runtime | High (2-3 weeks)   | VFS implementation |
| 5 | Asset loading (LoadMesh, LoadTexture, LoadImage) | Engine + Runtime | High (2-3 weeks)   | File I/O, Parsers  |

**Estimated Total**: 7-11 weeks (can parallelize)

**Critical Path**:

```
Week 1: Include files + Math library
Week 2-3: String operations + File I/O (parallel)
Week 4-6: Asset loading (depends on File I/O)
```

---

## P1: High Priority (Blocks Significant Features)

| #  | Issue                | Category | Functions Missing     | Effort                 | Impact                  |
| -- | -------------------- | -------- | --------------------- | ---------------------- | ----------------------- |
| 6  | Audio system         | Engine   | 29/32 (9% coverage)   | Medium (2-3 weeks)     | No music, limited sound |
| 7  | Physics engine       | Engine   | 85/100 (15% coverage) | Very High (2-3 months) | Limited collision       |
| 8  | Geometric primitives | Engine   | 5-10 functions        | Low (1 week)           | Cannot prototype        |
| 9  | Camera control       | Engine   | 8-10 functions        | Low (3-5 days)         | Limited rendering       |
| 10 | Entity picking       | Engine   | 7 functions           | Medium (1 week)        | No mouse selection      |

**Estimated Total**: 3-5 months

---

## P2: Medium Priority (Limits Functionality)

| #  | Issue                  | Category | Functions Missing    | Effort             | Impact                  |
| -- | ---------------------- | -------- | -------------------- | ------------------ | ----------------------- |
| 11 | Animation sequences    | Engine   | 10/18 (22% coverage) | Medium (2-3 weeks) | Basic animation only    |
| 12 | Display management     | Engine   | 6 functions          | Low (3-5 days)     | Limited graphics modes  |
| 13 | Entity hierarchy       | Engine   | 6 functions          | Medium (1 week)    | No entity parenting     |
| 14 | Camera advanced        | Engine   | 5 functions          | Low (3-5 days)     | Limited camera options  |
| 15 | Memory/Banks           | Engine   | 19/30 (37% coverage) | Medium (1-2 weeks) | Limited bank operations |
| 16 | Type suffix edge cases | Compiler | Testing only         | Low (2-3 days)     | Potential bugs          |
| 17 | Type inference         | Compiler | Testing/fixes        | Medium (1 week)    | Wrong variable types    |

**Estimated Total**: 2-3 months

---

## P3: Low Priority (Nice to Have)

| #  | Issue            | Category | Functions Missing | Effort                 | Impact           |
| -- | ---------------- | -------- | ----------------- | ---------------------- | ---------------- |
| 18 | Joystick support | Engine   | 25 functions      | Medium (1-2 weeks)     | No gamepad       |
| 19 | 2D graphics      | Engine   | 50+ functions     | High (1-2 months)      | No 2D rendering  |
| 20 | Terrain system   | Engine   | 15 functions      | High (2-3 weeks)       | No terrain       |
| 21 | Sprite system    | Engine   | 10 functions      | Medium (1 week)        | No sprites       |
| 22 | Networking       | Engine   | 21 functions      | Very High (2-3 months) | No multiplayer   |
| 23 | System functions | Engine   | 12 functions      | Low (1 week)           | Limited sys info |
| 24 | GetKey/WaitKey   | Engine   | 2 functions       | Low (1-2 days)         | Limited input    |

**Estimated Total**: 5-8 months

---

## Implementation Order (Recommended)

### Phase 1: Core Compilation (Week 1-2)

**Goal**: SCPCB compiles successfully with all includes

```
Week 1:
  ✓ Implement include file support (2-3 days)
  ✓ Implement math library (2-5 days)
  ✓ Test SCPCB compilation

Week 2:
  ✓ Begin string operations
  ✓ Test SCPCB compilation with math
```

**Deliverable**: SCPCB compiles, basic math works

---

### Phase 2: Core Runtime (Week 3-6)

**Goal**: SCPCB loads and initializes

```
Week 3-4:
  ✓ Complete string operations (1-2 weeks)
  ✓ Implement file I/O (parallel)
  ✓ Virtual filesystem setup

Week 5-6:
  ✓ Asset loading (LoadMesh, LoadTexture, LoadImage)
  ✓ B3D/RMESH integration
  ✓ Image decoding
```

**Deliverable**: SCPCB loads assets, displays basic geometry

---

### Phase 3: Gameplay Basics (Week 7-12)

**Goal**: Basic SCPCB gameplay works

```
Week 7-9:
  ✓ Audio system (channel management, 3D audio)
  ✓ Geometric primitives (CreateCube, CreateSphere)
  ✓ Camera control expansion

Week 10-12:
  ✓ Physics/collision improvements
  ✓ Entity picking (mouse selection)
  ✓ Bug fixes and polish
```

**Deliverable**: Playable SCPCB demo

---

### Phase 4: Feature Complete (Month 4-6)

**Goal**: Full SCPCB experience

```
Month 4:
  ✓ Animation sequences
  ✓ Entity hierarchy
  ✓ Display management
  ✓ Advanced camera features

Month 5-6:
  ✓ Physics engine integration (if needed)
  ✓ Polish and optimization
  ✓ Performance tuning
  ✓ Bug fixes
```

**Deliverable**: Complete SCPCB port

---

## Parallel Work Opportunities

These tasks can be done simultaneously:

**Team of 2-3 developers**:

**Developer A**: Compiler & Core Runtime

- Week 1: Include files
- Week 2-3: String operations
- Week 4+: Bug fixes, testing

**Developer B**: Math & File I/O

- Week 1-2: Math library
- Week 3-5: File I/O + VFS
- Week 6+: Asset loading

**Developer C**: Graphics & Audio

- Week 1-3: Asset loading prep (parsers)
- Week 4-6: LoadMesh/LoadTexture
- Week 7+: Audio system

**Reduces timeline from 6 months to 3-4 months**

---

## Risk Assessment

### High Risk

| Issue          | Risk                               | Mitigation                                       |
| -------------- | ---------------------------------- | ------------------------------------------------ |
| Include files  | May have complex dependency chains | Test incrementally with SCPCB                    |
| Asset loading  | File format edge cases             | Use existing B3D/RMESH parsers, validate formats |
| File I/O       | VFS complexity                     | Use proven VFS library or ZIP.js                 |
| Physics engine | Very large effort                  | Start with basic collision, defer full ODE       |

### Medium Risk

| Issue             | Risk                         | Mitigation                                   |
| ----------------- | ---------------------------- | -------------------------------------------- |
| Type inference    | May guess wrong types        | Add semantic analysis, extensive testing     |
| String operations | Memory management complexity | Use TypeScript strings, minimal WASM strings |
| Audio system      | 3D audio complexity          | Start with 2D, add spatialization later      |

### Low Risk

| Issue                | Risk                 | Mitigation                         |
| -------------------- | -------------------- | ---------------------------------- |
| Math library         | Very straightforward | Use WASM imports, standard JS Math |
| Geometric primitives | Simple geometry      | Standard algorithms                |
| Camera control       | Well-defined APIs    | Follow Blitz3D-NG reference        |

---

## Dependencies Graph

```
Include Files (2-3d)
     ↓
Math Library (2-5d) ──────┐
     ↓                    │
String Operations (1-2w)  │
     ↓                    │
File I/O (2-3w) ──────────┤
     ↓                    │
Asset Loading (2-3w) ─────┤
     ↓                    │
     ├─→ Audio System (2-3w)
     ├─→ Geometric Primitives (1w)
     ├─→ Camera Control (3-5d)
     └─→ Entity Picking (1w)
```

**Critical Path**: 7-11 weeks (P0 items)

---

## Effort Summary

### By Priority

```
P0 (Critical):      7-11 weeks
P1 (High):          3-5 months
P2 (Medium):        2-3 months
P3 (Low):           5-8 months
──────────────────────────────
Total:              12-18 months (sequential)
                    6-12 months (with team)
```

### By Category

```
Compiler:           2-4 weeks
Math/Strings:       2-3 weeks
File I/O:           2-3 weeks
Asset Loading:      2-3 weeks
Graphics:           2-4 months
Audio:              2-3 weeks
Physics:            2-3 months
Animation:          2-3 weeks
Input:              2-3 weeks
System:             1-2 weeks
```

---

## Success Metrics

### Phase 1 Complete (Week 2)

- ✅ SCPCB compiles with all includes
- ✅ Math functions working
- ✅ Basic string operations

### Phase 2 Complete (Week 6)

- ✅ Assets load successfully
- ✅ Geometry displays in browser
- ✅ File I/O functional

### Phase 3 Complete (Week 12)

- ✅ Audio plays
- ✅ Basic gameplay works
- ✅ Mouse/keyboard input functional

### Phase 4 Complete (Month 6)

- ✅ Full SCPCB feature set
- ✅ Smooth performance
- ✅ No critical bugs

---

## Next Document

See **06-implementation-roadmap.md** for detailed technical implementation plan.
