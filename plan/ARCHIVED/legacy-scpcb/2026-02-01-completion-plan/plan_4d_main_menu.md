# Phase 4D: Main Menu

**Duration**: 7 hours\
**Priority**: Medium\
**Prerequisites**: Phase 4C complete

---

## Goal

Get SCPCB main menu running and interactive.

---

## Tasks

### 1. Load Startup Videos (1 hour)

- Play videos in sequence:
  1. startup_TSS.mp4
  2. startup_Undertow.mp4
- Handle skip on key press
- Transition to menu

### 2. Render Menu UI (2 hours)

- Load menu background
- Render buttons:
  - New Game
  - Load Game
  - Options
  - Quit
- Handle text rendering

**Files**:

- `web/src/runtime/ui.ts`
- SCPCB Main.bb integration

### 3. Wire Menu Buttons (2 hours)

- **New Game**: Start game, load facility
- **Load Game**: Show save list (if saves exist)
- **Options**: Open settings menu
- **Quit**: Exit to browser

### 4. Settings Persistence (1 hour)

- Save settings to localStorage:
  - Graphic width/height
  - Audio volume
  - Controls
- Load on startup

### 5. Test Menu Flow (1 hour)

- Test all button paths
- Verify video playback
- Check settings save/load

---

## Acceptance Criteria

- [ ] Videos play in sequence
- [ ] Menu renders correctly
- [ ] All buttons functional
- [ ] Settings persist
- [ ] Can start new game

---

## Next Phase

- [Phase 4E: Game Loop](./plan_4e_game_loop.md)

---

## References

- [Main Plan Index](./README.md)
