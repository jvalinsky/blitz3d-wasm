# Blitz3D-WASM Architecture

## Overview

Blitz3D-WASM compiles Blitz3D BASIC code to WebAssembly, running game logic in WASM with a thin JavaScript runtime for browser API bindings.

## Design Principle

**WASM does game logic. JS only wraps browser APIs.**

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
                              │ imports ~10 functions
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     JS Runtime (~500 lines)                  │
├─────────────────────────────────────────────────────────────┤
│ • CreateSprite() → new THREE.Sprite()                       │
│ • PositionEntity(id,x,y,z) → obj.position.set(x,y,z)       │
│ • EntityAlpha(id,a) → material.opacity = a                  │
│ • FreeEntity(id) → scene.remove(obj)                        │
│ • CreateCamera/Light → Three.js camera/light                │
│ • Audio → Web Audio API                                      │
└─────────────────────────────────────────────────────────────┘
```

## What Goes Where

### In WASM (compiled BB code)
- **Game Logic**: AI, physics, particles, events
- **Data Structures**: Types, arrays, linked lists
- **Math**: Distance calculations, interpolation
- **State Management**: Player position, inventory, game flags
- **File Parsing**: RMesh loader, B3D parser (from SCPCB's BB code)

### In JS Runtime (browser bindings only)
- **3D Rendering**: Three.js wrapper (CreateMesh, PositionEntity, etc.)
- **Audio**: Web Audio API wrapper (LoadSound, PlaySound)
- **Input**: DOM events → KeyDown, MouseX, etc.
- **File I/O**: Fetch API → ReadFile, WriteFile

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
        
        ; Calls JS runtime
        PositionEntity(p\obj, p\x, p\y, p\z)
        
        ; More WASM logic
        If p\lifetime <= 0 Then
            FreeEntity(p\obj)  ; JS call
            Delete p           ; WASM linked list management
        End If
    Next
End Function
```

**JS Runtime** - only implements the imports:
```javascript
PositionEntity: (id, x, y, z) => {
    const entity = entities.get(id);
    if (entity) entity.obj.position.set(x, y, -z);
},

FreeEntity: (id) => {
    const entity = entities.get(id);
    if (entity) {
        scene.remove(entity.obj);
        entities.delete(id);
    }
}
```

## Why This Architecture?

1. **Use existing code**: SCPCB has 52K lines of working BB code
2. **Battle-tested logic**: Don't reimplement AI/physics/parsing in JS
3. **Smaller JS footprint**: ~500 lines vs 11K+ lines
4. **Easier debugging**: Game logic in one place (WASM)
5. **Better performance**: WASM runs closer to native speed

## Compiler Pipeline

```
BB Source → Lexer → Parser → AST → IR → WASM Binary
                                    ↓
                              Type System
                              - New/Delete
                              - Field offsets
                              - Linked lists
```

## Import Modules

The WASM module imports from three namespaces:

| Module | Purpose | Example Functions |
|--------|---------|-------------------|
| `env` | Core Blitz3D API | PositionEntity, CreateSprite, Print |
| `blitz3d` | Bank/mesh operations | CreateBank, PeekInt, ParseB3D |
| `al` | OpenAL audio | alCreateSource, alSourcePlay |

## File Structure

```
Sources/
├── Compiler/           # Swift compiler (14K lines)
│   ├── Lexer/         # Tokenizer
│   ├── Parser/        # Recursive descent parser
│   ├── AST/           # Abstract syntax tree
│   ├── IR/            # Intermediate representation
│   ├── Lowering/      # AST → IR
│   └── CodeGen/       # IR → WASM
│
└── Runtime/
    ├── thin/          # Minimal runtime (~500 lines)
    │   ├── runtime.js # Browser API bindings
    │   └── test.html  # Demo page
    └── modules/       # Full runtime (legacy, 11K lines)
```
