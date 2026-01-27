# Blitz3D-WASM Documentation

## Current Status

The compiler successfully compiles Blitz3D code to WebAssembly. Recent work has focused on:
- Typed IR pipeline with proper control flow
- WASM validation compliance
- Branch balancing and type conversion

## Documentation Structure

### Architecture
- [DESIGN_CHOICES.md](DESIGN_CHOICES.md) - Why we made certain decisions
- [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md) - Overall system design
- [compiler_architecture.md](compiler_architecture.md) - Compiler pipeline details

### Compiler Internals
- [compiler/](compiler/) - Detailed compiler documentation
  - [architecture/](compiler/architecture/) - Component design
  - [gaps/](compiler/gaps/) - Known limitations
- [STACK_BALANCE_HEURISTICS.md](STACK_BALANCE_HEURISTICS.md) - WASM stack management

### SCP:CB Analysis
These documents analyze the target game for porting:
- [CORE_SYSTEMS.md](CORE_SYSTEMS.md) - Game loop, state management
- [ENTITY_SYSTEMS.md](ENTITY_SYSTEMS.md) - NPCs, items, rooms
- [GRAPHICS_RENDERING_SYSTEMS.md](GRAPHICS_RENDERING_SYSTEMS.md) - Rendering pipeline
- [AUDIO_SOUND_SYSTEMS.md](AUDIO_SOUND_SYSTEMS.md) - Sound implementation
- [UI_HUD_SYSTEMS.md](UI_HUD_SYSTEMS.md) - Menu and HUD
- [EVENT_TRIGGER_SYSTEMS.md](EVENT_TRIGGER_SYSTEMS.md) - Game events
- [FILE_FORMAT_LOADERS.md](FILE_FORMAT_LOADERS.md) - Asset formats (RMesh, B3D)

### Implementation Plans
- [NEXT_STEPS_DETAILED_PLAN.md](NEXT_STEPS_DETAILED_PLAN.md) - Current priorities
- [ASSET_PIPELINE.md](ASSET_PIPELINE.md) - Asset handling strategy

### Archived
Older session notes and dated analysis in [archive/](archive/).

## Quick Links

| Topic | Document |
|-------|----------|
| Project overview | [../AGENTS.md](../AGENTS.md) |
| Build instructions | [../AGENTS.md](../AGENTS.md#building) |
| Compiler source | [../Sources/Compiler/](../Sources/Compiler/) |
| Runtime source | [../Sources/Runtime/](../Sources/Runtime/) |
| Test fixtures | [../Tests/fixtures/](../Tests/fixtures/) |
| Examples | [../Examples/](../Examples/) |
