# Blitz3D-WASM Architecture

## Overview

Blitz3D-WASM compiles Blitz3D BASIC code to WebAssembly, running game logic in WASM with a TypeScript runtime for browser API bindings.

## Design Principle

**WASM does game logic. TypeScript provides browser API bindings.**

```
┌─────────────────────────────────────────────────────────────┐
│                        WASM (BB Code)                        │
├─────────────────────────────────────────────────────────────┤
│ • Type system (New, Delete, linked list management)         │
│ • Field access (p\x, p\y, p\obj, etc.)                      │
│ • Physics math (gravity, velocity, position updates)        │
│ • Game logic (lifetime, alpha fade, removal conditions)     │
│ • Control flow (While/Wend, If/Then, For Each)              │
│ • Memory management (heap allocation)                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ imports runtime functions
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              TypeScript Runtime (~12K lines)                 │
├─────────────────────────────────────────────────────────────┤
│ • CreateSprite() → new THREE.Sprite()                       │
│ • PositionEntity(id,x,y,z) → obj.position.set(x,y,z)       │
│ • EntityAlpha(id,a) → material.opacity = a                  │
│ • FreeEntity(id) → scene.remove(obj)                        │
│ • CreateCamera/Light → Three.js camera/light                │
│ • Audio → Web Audio API                                      │
│ • Command buffer → batch WASM→JS calls                      │
│ • Virtual filesystem → manifest-based asset loading         │
└─────────────────────────────────────────────────────────────┘
```

## Runtime Implementations

### TypeScript Runtime (Production)

The main runtime in `web/src/runtime/` (~9K lines) plus loader/worker (~3K lines):

| Module | Lines | Purpose |
|--------|-------|--------|
| `core.ts` | ~2066 | Core runtime functions |
| `graphics.ts` | ~3695 | Three.js integration |
| `fileio.ts` | ~1010 | Virtual filesystem |
| `b3d.ts` | ~880 | B3D format parser |
| `smpk.ts` | ~332 | SMPK format loader |
| `animation.ts` | ~144 | Animation system |
| `mesh.ts` | ~278 | Mesh utilities |
| `xloader.ts` | ~402 | X format loader |

Plus shared systems:
- `shared/command_buffer.ts` - Binary WASM→JS protocol
- `shared/boot_state_machine.ts` - Startup sequencing
- `shared/path_alias.ts` - Legacy path resolution
- `worker/scpcb_worker.ts` - Web Worker harness

### Thin Demo Runtime

For simple demos, `Sources/Runtime/thin/runtime.js` (~500 lines) provides:
- Basic Three.js entity management
- Simple input handling
- Timer and frame management

## What Goes Where

### In WASM (compiled BB code)
- **Game Logic**: AI, physics, particles, events
- **Data Structures**: Types, arrays, linked lists
- **Math**: Distance calculations, interpolation
- **State Management**: Player position, inventory, game flags
- **Control Flow**: Loops, conditionals, function calls

### In TypeScript Runtime (browser bindings)
- **3D Rendering**: Three.js wrapper (CreateMesh, PositionEntity, etc.)
- **Audio**: Web Audio API wrapper (LoadSound, PlaySound)
- **Input**: DOM events → KeyDown, MouseX, etc.
- **File I/O**: Virtual filesystem with manifest-based loading
- **Asset Loading**: SMPK, B3D, X format parsers

## Example: Particle System

**BB Code (particles.bb)** - compiled to WASM:
```blitz
Type Particles
    Field obj%          ; Sprite handle
    Field x#, y#, z#    ; Position  
    Field vy#           ; Velocity
    Field gravity#
    Field alpha#
    Field lifetime#
End Type

Function UpdateParticles()
    Local p.Particles
    For p = Each Particles
        ; Physics (runs in WASM)
        p\vy = p\vy - p\gravity * FPSfactor
        p\y = p\y + p\vy * FPSfactor
        
        ; Calls TypeScript runtime
        PositionEntity(p\obj, p\x, p\y, p\z)
        
        ; More WASM logic
        If p\lifetime <= 0 Then
            FreeEntity(p\obj)  ; TS call
            Delete p           ; WASM linked list management
        End If
    Next
End Function
```

**TypeScript Runtime** - implements the imports:
```typescript
export function PositionEntity(id: number, x: number, y: number, z: number): void {
    const entity = entities.get(id);
    if (entity) entity.obj.position.set(x, y, -z);
}

export function FreeEntity(id: number): void {
    const entity = entities.get(id);
    if (entity) {
        scene.remove(entity.obj);
        entities.delete(id);
    }
}
```

## Why This Architecture?

1. **Use existing code**: SCPCB has 52K lines of working BB code
2. **Battle-tested logic**: Don't reimplement AI/physics/parsing in TS
3. **Better separation**: Game logic in WASM, browser APIs in TS
4. **Performance**: WASM runs closer to native speed
5. **Easier debugging**: Game logic in one place (WASM)

## Compiler Pipeline

```
BB Source → Lexer → Parser → AST → IR → WASM Binary
                                    ↓
                              Type System
                              - New/Delete
                              - Field offsets
                              - Linked lists
```

**Compiler**: ~17K lines Swift
- Lexer: Tokenizer
- Parser: Recursive descent (~2.2K lines)
- AST: Abstract syntax tree
- IR: Intermediate representation
- Lowering: AST → IR (~1.3K lines)
- CodeGen: IR → WASM

## Import Modules

The WASM module imports from namespaces:

| Module | Purpose | Example Functions |
|--------|---------|-------------------|
| `env` | Core Blitz3D API | PositionEntity, CreateSprite, Print |
| `blitz3d` | Bank/mesh operations | CreateBank, PeekInt |
| `al` | OpenAL audio | alCreateSource, alSourcePlay |

## File Structure

```
Sources/
├── Compiler/           # Swift compiler (~17K lines)
│   ├── Lexer/          # Tokenizer
│   ├── Parser/         # Recursive descent parser
│   ├── AST/            # Abstract syntax tree
│   ├── IR/             # Intermediate representation
│   ├── Lowering/       # AST → IR
│   └── CodeGen/        # IR → WASM
│
└── Runtime/
    └── thin/           # Minimal demo runtime (~500 lines)
        ├── runtime.js  # Browser API bindings
        └── test.html   # Demo page

web/
├── src/
│   ├── main.ts         # SCPCB loader (~2K lines)
│   ├── runtime/        # TypeScript runtime (~9K lines)
│   ├── shared/         # Command buffer, boot state
│   └── worker/         # Web Worker harness
└── public/             # Built assets and manifests
```

## Command Buffer System

For high-frequency operations, the runtime uses a binary command buffer protocol:

```
┌─────────────────────────────────────┐
│ Header (24 bytes)               │
├─────────────────────────────────────┤
│ Command #1 (variable length)    │
├─────────────────────────────────────┤
│ Command #2 (variable length)    │
├─────────────────────────────────────┤
│ ... (more commands)             │
└─────────────────────────────────────┘
```

See `docs/COMMAND_BUFFER_SYSTEM.md` for full protocol specification.

## Asset Pipeline

Assets are converted offline to SMPK format:

```
Source Formats → Converters → SMPK → Web Deploy

.b3d  ──┬── convert_b3d_to_smpk.ts  ──┬── .smpk
.x    ──┼── convert_x_to_smpk.ts    ──┤
.rmesh──┴── convert_rmesh_to_smpk.ts──┘
```

See `docs/SMPK_SYSTEM.md` for format specification.
