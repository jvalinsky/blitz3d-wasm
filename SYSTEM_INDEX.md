# SCP: Containment Breach - System Documentation Index

## Overview

This documentation covers all major systems in the SCP: Containment Breach game,
which has been ported to WebAssembly via the blitz3d-wasm compiler. The game is
a sophisticated survival horror experience featuring complex AI systems,
immersive gameplay mechanics, and interconnected systems working together to
create a terrifying facility simulation.

## System Categories

### 🎮 [Core Systems](CORE_SYSTEMS.md)

Fundamental systems that form the foundation of the game engine.

- **[Rendering System](CORE_SYSTEMS.md#rendering-system)** - WebGL/Three.js 3D
  graphics pipeline
- **[Input System](CORE_SYSTEMS.md#input-system)** - Keyboard and mouse input
  handling
- **[Audio System](CORE_SYSTEMS.md#audio-system)** - Web Audio API with 3D
  positional sound
- **[Physics System](CORE_SYSTEMS.md#physics-system)** - Collision detection and
  entity picking

### ⚙️ [Game Mechanics](GAME_MECHANICS.md)

Core gameplay systems that define the player experience.

- **[Player Control System](GAME_MECHANICS.md#player-control-system)** -
  Movement, stamina, health, sanity, blink mechanics
- **[Inventory System](GAME_MECHANICS.md#inventory-system)** - Item management
  and combination mechanics
- **[Save/Load System](GAME_MECHANICS.md#saveload-system)** - Game state
  persistence

### 🤖 [Entity Systems](ENTITY_SYSTEMS.md)

All entities that inhabit the game world.

- **[NPC AI System](ENTITY_SYSTEMS.md#npc-ai-system)** - State machine
  architecture with pathfinding
- **[SCP Entity System](ENTITY_SYSTEMS.md#scp-entity-system)** - Unique
  mechanics for each SCP entity
- **[Human NPC System](ENTITY_SYSTEMS.md#human-npc-system)** - MTF soldiers,
  scientists, guards

### 🏢 [Room/Level Management](ROOM_LEVEL_MANAGEMENT.md)

Systems that manage the game environment.

- **[Room System](ROOM_LEVEL_MANAGEMENT.md#room-system)** - Procedural facility
  generation
- **[Level Generation](ROOM_LEVEL_MANAGEMENT.md#level-generation)** -
  Template-based facility layouts

### 🖥️ [UI/HUD Systems](UI_HUD_SYSTEMS.md)

User interface and heads-up display systems.

- **[Main Menu System](UI_HUD_SYSTEMS.md#main-menu-system)** - Game startup and
  options
- **[In-Game HUD](UI_HUD_SYSTEMS.md#ingame-hud)** - Real-time player status
  display
- **[Inventory UI](UI_HUD_SYSTEMS.md#inventory-ui)** - Item management interface

### ⚡ [Event/Trigger Systems](EVENT_TRIGGER_SYSTEMS.md)

Systems that handle game events and triggers.

- **[Event System](EVENT_TRIGGER_SYSTEMS.md#event-system)** - Game event
  management
- **[Trigger System](EVENT_TRIGGER_SYSTEMS.md#trigger-system)** - Environmental
  interaction triggers

### 🔊 [Audio/Sound Systems](AUDIO_SOUND_SYSTEMS.md)

Detailed audio systems for immersive gameplay.

- **[Sound Effect System](AUDIO_SOUND_SYSTEMS.md#sound-effect-system)** -
  Environmental and action audio
- **[Music System](AUDIO_SOUND_SYSTEMS.md#music-system)** - Dynamic atmospheric
  soundtrack
- **[Voice System](AUDIO_SOUND_SYSTEMS.md#voice-system)** - NPC dialogue and SCP
  vocalizations

### 🎨 [Graphics/Rendering Systems](GRAPHICS_RENDERING_SYSTEMS.md)

Advanced graphics and visual effects systems.

- **[Material System](GRAPHICS_RENDERING_SYSTEMS.md#material-system)** - Surface
  property management
- **[Particle System](GRAPHICS_RENDERING_SYSTEMS.md#particle-system)** -
  Environmental and effect particles
- **[Lighting System](GRAPHICS_RENDERING_SYSTEMS.md#lighting-system)** - Dynamic
  horror lighting

### 📁 [File Format Loaders](FILE_FORMAT_LOADERS.md)

Systems that load and manage game assets.

- **[Mesh Loaders](FILE_FORMAT_LOADERS.md#mesh-loaders)** - 3D model loading
  (B3D, X, RMesh)
- **[Texture Loaders](FILE_FORMAT_LOADERS.md#texture-loaders)** - Image and
  texture loading
- **[Audio Loaders](FILE_FORMAT_LOADERS.md#audio-loaders)** - Sound file loading
  systems
- **[Archive Systems](FILE_FORMAT_LOADERS.md#archive-systems)** - Asset
  packaging and loading

### 🗂️ [State Management Systems](STATE_MANAGEMENT_SYSTEMS.md)

Systems that manage game and entity states.

- **[Game State Manager](STATE_MANAGEMENT_SYSTEMS.md#game-state-manager)** -
  Overall game state coordination
- **[Entity State System](STATE_MANAGEMENT_SYSTEMS.md#entity-state-system)** -
  Entity behavior state management
- **[World State System](STATE_MANAGEMENT_SYSTEMS.md#world-state-system)** -
  Global world state tracking

## Architecture Overview

### System Hierarchy

```
Main Game Loop
├── Core Systems (Foundation)
│   ├── Rendering System
│   ├── Input System  
│   ├── Audio System
│   └── Physics System
├── Game Mechanics (Player Experience)
│   ├── Player Control System
│   ├── Inventory System
│   └── Save/Load System
├── Entity Systems (Game World Inhabitants)
│   ├── NPC AI System
│   ├── SCP Entity System
│   └── Human NPC System
├── Environment Systems (Game World)
│   ├── Room/Level Management
│   ├── Event/Trigger Systems
│   └── Graphics/Rendering Systems
├── Interface Systems (User Interaction)
│   ├── UI/HUD Systems
│   └── Input System (shared)
└── Support Systems (Infrastructure)
    ├── Audio/Sound Systems
    ├── File Format Loaders
    └── State Management Systems
```

### Data Flow

1. **Input → Player Controller → Game Logic** - Player actions trigger game
   state changes
2. **AI System → Detection Systems → Entity Behaviors** - NPCs perceive and
   react to world
3. **Event System → World State → Audio/Visual Feedback** - Events trigger
   audio/visual responses
4. **State Management → All Systems → Render System** - Current state drives all
   visual output

### Key Relationships

- **Input ↔ Player Controller**: Direct mapping for player actions
- **AI System ↔ Detection Systems**: Sensory input drives behavior decisions
- **State Machines ↔ Animation Systems**: State-driven visual feedback
- **Event System ↔ World State**: Trigger-based state modifications
- **Save System ↔ All Systems**: State capture and restoration
- **Render System ↔ All Systems**: Visual representation of current state

## Specialized Documentation

### 🚶‍♂️ [NPC AI & Path Tracking System](NPC_AI_SYSTEM.md)

Detailed documentation of the NPC AI system, including:

- State machine architecture
- A* pathfinding implementation
- SCP-specific behaviors
- MTF squad coordination

### 📍 [Waypoint System](WAYPOINT_SYSTEM.md)

Comprehensive documentation of the navigation system:

- Waypoint entity structure
- Graph creation and connection
- Pathfinding algorithms
- Debug visualization

## Technical Implementation

### Compiler Infrastructure

The **blitz3d-wasm** project provides:

- **Swift Compiler**: Converts BlitzBasic to WebAssembly
- **JavaScript Runtime**: Browser-based execution environment
- **Three.js Integration**: Hardware-accelerated 3D graphics
- **Web Audio API**: Cross-platform audio system

### Performance Optimizations

- **Entity Culling**: Frustum-based rendering optimization
- **LOD System**: Level-of-detail for distant objects
- **Audio Streaming**: Background loading for large audio files
- **Asset Batching**: Grouped asset loading operations

### Memory Management

- **Entity Pooling**: Object reuse for performance
- **Asset Caching**: In-memory resource management
- **Garbage Collection**: Automatic memory cleanup
- **State Compression**: Efficient save file formats

## Navigation Tips

### For Developers

- Start with [Core Systems](CORE_SYSTEMS.md) to understand the foundation
- Read [Game Mechanics](GAME_MECHANICS.md) for player experience design
- Study [Entity Systems](ENTITY_SYSTEMS.md) for AI implementation
- Review [Architecture Overview](SYSTEM_ARCHITECTURE.md) for system
  relationships

### For System Integration

- Each system document contains cross-references to related systems
- Follow the data flow diagrams for understanding system interactions
- Use the state management documentation for understanding persistence
- Refer to file format docs for asset integration

### For Performance Optimization

- Review the performance sections in each system document
- Study the memory management patterns in State Management Systems
- Consider the LOD and culling strategies in Graphics documentation

## File Organization

All system documentation is located in the `docs/` directory:

```
docs/
├── SYSTEM_INDEX.md              # This file
├── CORE_SYSTEMS.md              # Core engine systems
├── GAME_MECHANICS.md            # Gameplay mechanics
├── ENTITY_SYSTEMS.md            # NPC and entity systems
├── ROOM_LEVEL_MANAGEMENT.md     # Environment management
├── UI_HUD_SYSTEMS.md            # User interface systems
├── EVENT_TRIGGER_SYSTEMS.md     # Event handling systems
├── AUDIO_SOUND_SYSTEMS.md       # Audio systems
├── GRAPHICS_RENDERING_SYSTEMS.md # Graphics systems
├── FILE_FORMAT_LOADERS.md       # Asset loading systems
├── STATE_MANAGEMENT_SYSTEMS.md  # State management
├── SYSTEM_ARCHITECTURE.md       # Architecture overview
├── NPC_AI_SYSTEM.md             # NPC AI detailed docs
└── WAYPOINT_SYSTEM.md          # Navigation system docs
```

## Contributing to Documentation

When updating documentation:

1. Maintain cross-links between related systems
2. Update this index when adding new system docs
3. Follow the established format and structure
4. Include code examples where relevant
5. Add performance considerations for each system

---

_This documentation covers the complete architecture of SCP: Containment Breach
as implemented in the blitz3d-wasm project. For specific implementation details,
refer to the individual system documents linked above._
