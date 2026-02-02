# Phase 4C: Asset Pipeline

**Duration**: 12 hours  
**Priority**: High  
**Prerequisites**: Phase 4B complete

---

## Goal

Convert all SCPCB assets to web-compatible formats.

---

## Tasks

### 1. Convert Videos (2 hours)
Convert 10+ AVI files to MP4 (H.264 + AAC):
- startup_TSS.mp4 ✓ (already done)
- startup_Undertow.mp4 ✓ (already done)
- Remaining 8+ intro/videos/*.avi files

**Tools**:
```bash
ffmpeg -i input.avi -c:v libx264 -c:a aac -crf 23 output.mp4
```

### 2. Convert Models to SMPK (4 hours)
Convert 150+ models:
- NPCs (SCP-173, SCP-049, etc.)
- Rooms (room2*, room3*, etc.)
- Props and items

**Tools**:
- B3D/X/RMESH → SMPK converter
- Bulk conversion script

**Acceptance**:
- [ ] All .b3d, .x, .rmesh converted
- [ ] No source models in dist/
- [ ] CI gate passes

### 3. Optimize Textures (3 hours)
- Compress textures (WebP/PNG)
- Resize oversized textures (>1024x1024)
- Generate mipmaps

**Target**: Reduce texture memory by 50%

### 4. Generate Asset Manifests (1 hour)
- Create JSON manifests for all assets
- Group by loading priority (boot, facility, rooms, etc.)
- Include file hashes for cache busting

**Files**:
- `web/public/scpcb_manifest.json`

### 5. Lazy Loading System (2 hours)
- Implement on-demand asset loading
- Progress tracking
- Error handling with retry

**Files**:
- `web/src/runtime/fileio.ts`
- `web/src/runtime/assets.ts`

---

## Acceptance Criteria

- [ ] All 10+ videos converted to MP4
- [ ] All 150+ models in SMPK format
- [ ] Textures optimized
- [ ] Manifests generated
- [ ] Lazy loading works
- [ ] CI gate: no .b3d/.x/.rmesh in dist

---

## Next Phase

- [Phase 4D: Main Menu](./plan_4d_main_menu.md)

---

## References

- [Main Plan Index](./README.md)
- [SMPK System](../docs/SMPK_SYSTEM.md)
