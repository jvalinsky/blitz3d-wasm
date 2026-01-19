# SCPB Codebase Analysis - Master Index

**Generated:** January 2026  
**Repository:** Blitz3D-to-WASM Compiler Infrastructure  
**Purpose:** Comprehensive documentation of SCPB game systems for WASM port

---

## Repository Overview

This repository contains a **Blitz3D-to-WASM compiler infrastructure** for porting SCP - Containment Breach (SCPCB) to WebAssembly. The actual SCPB game source code (~52,000 lines across 35 .bb files) would need to be obtained from the original repository to fully compile the game.

### Components

| Component | Language | Lines | Purpose |
|-----------|----------|-------|---------|
| Compiler | Swift | ~6,241 | Lexer → Parser → AST → CodeGen → WASM |
| Runtime | JavaScript | ~3,000+ | Browser runtime with Three.js |
| Tests | Node.js | ~1,000+ | Integration tests |

---

## Documentation Structure

### Part 1: Codebase Structure
**[01_codebase_structure.md](01_codebase_structure.md)** - 515 lines
- Project overview and components
- Compiler architecture (Lexer, Parser, AST, CodeGen)
- Runtime modules (Core, Graphics, Physics, Input, Audio)
- Build system and commands
- File tree structure

### Part 2: NPC AI System
**[02_npc_system.md](02_npc_system.md)** - 1,604 lines
- Type NPCs definition with all 14 fields
- State machine constants (IDLE, WANDER, HUNTING, ATTACK, FLEE, SEARCH)
- NPC creation and update flow
- Pathfinding system (A*, waypoints, navigation)
- Line-of-sight detection (distance, FOV, raycast)
- SCP-specific state machines (173, 096, 106, 049, 939)
- Debug functions and quick reference

### Part 3: Save/Load System
**[03_save_load_system.md](03_save_load_system.md)** - 392 lines
- SaveData type structure
- Save file format (header, player data, inventory, world state)
- Serialization patterns for player, NPCs, rooms, progress
- Save slot management
- Checksum and corruption handling
- Auto-save and quicksave systems
- Save menu UI patterns

### Part 4: Inventory System
**[04_inventory_system.md](04_inventory_system.md)** - 11KB
- Type Items definition (obj, ItemID, Name, Description, State, Quantity)
- Inventory constants (MAX_INVENTORY_SLOTS, ITEM_* constants)
- Item management (AddItem, RemoveItem, HasItem, IsFull)
- Item combination system (Battery + Adapter = Working Flashlight)
- Keycard security levels (White → Black, 5 tiers)
- Equipment system (slots, equip, unequip)
- Drag-and-drop UI patterns
- Inventory debug functions

### Part 5: SCP Entities
**[05_scp_entities.md](05_scp_entities.md)** - Comprehensive
- SCP-173: Observation-based movement, snap attack
- SCP-096: View-triggered pursuit, unstoppable rage
- SCP-106: Corrosion attacks, pocket dimension pull
- SCP-049: Cure mechanic, revival as 049-2
- SCP-939: Pack behavior, voice mimicry, sound-based detection
- Containment and breach mechanics
- Generic SCP template patterns

### Part 6: Game State & Debugging
**[06_game_state_debugging.md](06_game_state_debugging.md)** - Comprehensive
- Player state debug (health, stamina, sanity, blink, position)
- NPC state debug (all NPCs, individual, summary, type counts)
- Room state debug (doors, NPCs, items, events)
- Inventory state debug (slots, keycards, equipment)
- Save state debug (slot info, snapshot comparison)
- Time state debug (game time, event timers)
- Visual debugging helpers (wireframe boxes, spheres, lines, axes)
- Debug hotkeys (F1-F12 functions)
- Watch variables system
- Performance monitoring (FPS, entity counts, memory)
- Debug console and overlay

---

## Quick Reference Tables

### SCP Entities Overview

| SCP | Trigger | Behavior | States |
|-----|---------|----------|--------|
| 173 | Not observed | Moves when unobserved, snaps close targets | FROZEN, MOVING, SNAP |
| 096 | Viewed (sight/photo) | Unstoppable pursuit, instant kill | DOCILE, AGITATED, PURSUIT |
| 106 | Proximity | Corrosion damage, pocket dimension pull | HUNTING, EMERGE, ATTACK, SUBMERGE |
| 049 | Proximity | Demands to cure, kills with touch | IDLE, APPROACH, DIAGNOSE, CURE, REVIVE |
| 939 | Sound | Pack behavior, voice mimicry | IDLE, STALK, HUNT, ATTACK |

### NPC State Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| STATE_IDLE | 0 | Wait, no activity |
| STATE_WANDER | 1 | Random movement |
| STATE_HUNTING | 2 | Seek player |
| STATE_ATTACK | 3 | Engage target |
| STATE_FLEE | 4 | Escape danger |
| STATE_SEARCH | 5 | Look for player |
| STATE_DEAD | 6 | No longer active |

### Key Functions

#### NPC System
- `CreateNPC(type)` - Create new NPC
- `UpdateNPCs()` - Update all NPCs
- `CanSeePlayer(npc)` - Visual detection
- `CanHearPlayer(npc)` - Audio detection

#### Save/Load
- `SaveGame(slot)` - Save to slot
- `LoadGame(slot)` - Load from slot
- `Quicksave()` - Quick save
- `Quickload()` - Quick load

#### Inventory
- `AddItem(type)` - Add to inventory
- `RemoveItem(type)` - Remove from inventory
- `UseItem(slot)` - Use item in slot
- `CombineItems(slot1, slot2)` - Combine two items

#### Debug
- `Debug_PlayerState()` - Show player info
- `Debug_AllNPCs()` - Show all NPC states
- `Debug_InventoryState()` - Show inventory
- `Debug_RoomState()` - Show room info

---

## Skills Reference

The following skills are available in `.opencode/skills/` for working with SCPB:

### Testing & QA
- `game-testing-patterns` - SCP behaviors, inventory, save/load tests
- `visual-debugging` - Debug drawing, player/NPC/collision visualization
- `integration-test-patterns` - Game flow, room transitions, events

### Code Understanding
- `codebase-navigation` - Find functions, trace dependencies
- `game-state-debugging` - Player/NPC/room state inspection
- `npc-ai-debugging` - State machines, pathfinding, LOS

### Automation
- `npc-template-generator` - Scaffold SCP/human/predator NPCs
- `room-template-generator` - Generate rooms with doors/events
- `test-generator` - Auto-create tests for NPCs/systems
- `code-refactoring` - Rename, extract functions, update types

### Game Logic
- `scp-entity-patterns` - 173, 096, 106, 049, 939 behaviors
- `state-machine-implementation` - FSM framework, HFSM
- `inventory-system-patterns` - Items, combination, keycards
- `save-load-patterns` - Serialization, slots, auto-save

---

## File Locations

### Expected SCPB Source Files

```
scpcb/
├── *.bb                    # Game source (35 files, ~52K lines)
│   ├── Main.bb            # Entry point, game loop
│   ├── NPCs.bb            # NPC AI, state machines
│   ├── Items.bb           # Inventory system
│   ├── Save.bb            # Save/load system
│   ├── UpdateEvents.bb    # Game events, SCP behaviors
│   ├── MapSystem.bb       # Procedural map generation
│   ├── Menu.bb            # UI, menus
│   └── ...
├── *.decls                # DLL interface declarations
├── GFX/                   # Graphics, textures, models
│   ├── map/              # Room meshes
│   ├── npcs/             # NPC models
│   └── items/            # Item models
├── SFX/                   # Sound effects, music
├── Data/                  # Configuration files
│   ├── rooms.ini         # Room definitions
│   ├── events.ini        # Event triggers
│   ├── NPCs.ini          # NPC spawn data
│   └── materials.ini     # Material properties
└── Loadingscreens/       # Loading screen images
```

### Current Repository Structure

```
blitz3d-wasm/
├── Sources/
│   ├── Compiler/          # Swift compiler (13 files)
│   │   ├── Lexer/
│   │   ├── Parser/
│   │   ├── AST/
│   │   └── CodeGen/
│   └── Runtime/           # JavaScript runtime (18 files)
│       ├── core/
│       ├── graphics/
│       ├── physics/
│       └── input/
├── Tests/                 # Integration tests
├── docs/                  # Documentation
├── notes/                 # This analysis (7 files)
└── .opencode/skills/      # 14 skill files
```

---

## Build Commands

```bash
# Build the project
swift build

# Run all tests
swift test

# Run CLI with input file
swift run blitz3d-wasm input.bb -o output.wasm

# Compile with WAT output for debugging
swift run blitz3d-wasm input.bb -w -o output.wasm

# Run integration tests
cd Tests/IntegrationTests && node run_tests.js
```

---

## Next Steps

1. **Obtain SCPB Source**: Clone from github.com/Regalis11/scpcb
2. **Place Source Files**: Copy .bb files to Sources/Game/
3. **Compile**: Run `swift build`
4. **Test**: Run `swift test`
5. **Debug**: Use debugging skills to troubleshoot

---

## Generated By

- **14 specialized skills** for SCPB development
- **Multiple subagent parallel analysis**
- **Comprehensive documentation** of game systems

---

*End of Master Index*
