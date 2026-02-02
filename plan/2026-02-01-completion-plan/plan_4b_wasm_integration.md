# Phase 4B: WASM Integration

**Duration**: 7 hours  
**Priority**: High  
**Prerequisites**: Phase 4A complete

---

## Goal

Wire video runtime and complete imports into main WASM loader.

---

## Tasks

### 1. Integrate VideoRuntime (2 hours)
- Add VideoRuntime to main runtime exports
- Ensure all 7 WASM API functions exported:
  - `BlitzMovie_Open`
  - `BlitzMovie_Close`
  - `BlitzMovie_Play/Stop/Pause`
  - `BlitzMovie_GetWidth/Height/CurrentTime/Duration`
  - `BlitzMovie_Seek`
  - `BlitzMovie_IsPlaying`

**Files**:
- `web/src/runtime/index.ts`
- `web/src/worker/scpcb_worker.ts`

### 2. WASM String Reading (1 hour)
- Implement string reading from WASM linear memory
- Helper for reading null-terminated strings
- Handle UTF-8 encoding

**Files**:
- `web/src/runtime/memory.ts`

### 3. Wire scpcb_worker.ts (2 hours)
- Connect VideoRuntime to worker harness
- Add movie handle management
- Implement lifecycle (init, update, cleanup)

**Files**:
- `web/src/worker/scpcb_worker.ts`

### 4. Test Video Playback (1 hour)
- Test in full runtime context
- Verify startup videos play
- Check memory management

### 5. Memory Management (1 hour)
- Implement movie handle reference counting
- Cleanup on movie close
- Handle browser memory limits

---

## Acceptance Criteria

- [ ] All 7 video functions work from WASM
- [ ] String reading from WASM memory works
- [ ] Videos play in full runtime context
- [ ] No memory leaks in movie system
- [ ] Handles cleaned up properly

---

## Next Phase

- [Phase 4C: Asset Pipeline](./plan_4c_asset_pipeline.md)

---

## References

- [Main Plan Index](./README.md)
- [Video System Docs](../docs/VIDEO_SYSTEM.md)
