# Phase 4E: Game Loop

**Duration**: 16 hours  
**Priority**: CRITICAL  
**Prerequisites**: Phase 4D complete

---

## Goal

Basic game running in a test room.

---

## Tasks

### 1. Game Initialization (2 hours)
- Initialize all subsystems
- Load options.ini
- Set up render pipeline
- Create initial world state

### 2. Load Test Room (2 hours)
- Load room2 (medium complexity)
- Spawn player at entry point
- Initialize room entities
- Load room geometry

### 3. Player Movement (3 hours)
- WASD movement
- Mouse look (camera rotation)
- Sprint (Shift key)
- Crouch (Ctrl key)
- Collision with walls

### 4. Collision Detection (3 hours)
- Player vs room geometry
- Player vs doors
- Player vs items
- Proper response (slide along walls)

### 5. Item Interaction (2 hours)
- Pick up items (E key)
- Add to inventory
- Use items (number keys)
- Drop items

### 6. Door Interaction (2 hours)
- Open/close doors (E key)
- Door animation
- Collision update when door moves

### 7. Basic HUD (2 hours)
- Health bar
- Stamina bar
- Inventory display

---

## Acceptance Criteria

- [ ] Player spawns in room
- [ ] Movement smooth at 60fps
- [ ] No clipping through walls
- [ ] Can pick up items
- [ ] Can open doors
- [ ] HUD displays correctly

---

## References

- [Main Plan Index](./README.md)
