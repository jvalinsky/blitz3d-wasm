# 06 — Runtime Conformance + SCPCB Priorities (Browser Playability)

## Goal

Ensure the browser runtime implements enough of the Blitz3D engine + DLL shims to run SCPCB:
- VFS/ZIP (zlibwapi replacement) for assets
- Picking/raycast (gameplay critical)
- Audio (FMOD shim or equivalent)
- Particles (DevilParticleSystem shim)
- Video (BlitzMovie shim) if needed for intros/endings

The compiler can be “correct” and still fail to run the game if imports are missing or behaviorally wrong.

## Current State (observed in docs)

- Runtime implementation status and gaps are documented:
  - `../../../../docs/BLITZ3D_RUNTIME_GAPS.md`
- DLL replacement mapping exists:
  - `../../../../docs/decls-compatibility.md`
- Custom DLL porting design exists:
  - `../../../../docs/spec_custom_dlls.md`
- System-call mapping guidance exists:
  - `../../../../docs/spec_system_calls.md`

## Plan (phased by SCPCB critical path)

### Phase 1 — VFS/ZIP + path semantics (P0)

**Action**
- Implement ZIP-backed VFS with the minimal subset SCPCB actually uses.
- Normalize path rules (case sensitivity, `\` vs `/`, `..`).

**Acceptance**
- `FileSize`, `FileType`, and asset loads work against the ZIP container.
- `Blitz_File_ZipApi.bb` behavior is covered by runtime tests.

### Phase 2 — Picking/raycast + collision queries (P0)

**Action**
- Implement:
  - `LinePick`, `EntityPick`, `CameraPick`
  - `PickedX/Y/Z`, `PickedEntity`, etc.

**Why**
- SCPCB uses picking for interaction (doors, items, monitors).

**Acceptance**
- A deterministic “pick test scene” returns correct results across browsers.

### Phase 3 — Audio (P1)

**Action**
- Implement the FMOD surface used by SCPCB with WebAudio.
- Handle known decl mismatches (documented in `spec_custom_dlls.md`).

**Acceptance**
- Music and SFX play with correct channel control (volume/pause/stop).

### Phase 4 — Particles (P1)

**Action**
- Implement DevilParticleSystem functions used by SCPCB.
- Start with correctness + batching; optimize later.

### Phase 5 — Video (P2)

**Action**
- Provide BlitzMovie shim using `<video>` and optional texture mapping.

## Runtime Conformance Testing

**Action**
- Add a runtime conformance suite that:
  - compiles small BB programs calling each runtime API
  - runs them in browser/headless and asserts outputs

**Acceptance**
- Runtime has a “coverage report” that matches the compiler’s import list.

