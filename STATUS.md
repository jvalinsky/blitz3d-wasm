# Project Status

**Last Updated**: January 27, 2026

## Summary

Blitz3D-WASM compiles Blitz3D BASIC to WebAssembly with a thin JS runtime for browser APIs.

## Working Demo

**URL**: https://blitz3d.exe.xyz:8000/test.html

Demonstrates:
- Particles falling with gravity
- Alpha fading
- Automatic deletion when expired
- All logic in WASM, JS only renders

## What's In WASM vs JS

### WASM (compiled BB code)
- Type system (New, Delete, linked lists)
- Field access (p\x, p\y, p\obj)
- Physics (gravity, velocity)
- Game logic (lifetime, conditions)
- Control flow (While, If, For Each)
- Memory management

### JS Runtime (~500 lines)
- `CreateSprite()` → Three.js Sprite
- `PositionEntity(id,x,y,z)` → set position
- `EntityAlpha(id,a)` → set opacity
- `FreeEntity(id)` → remove from scene
- `Print(s)` → console.log

## Compilation Test Results

| File | Status |
|------|--------|
| particles.bb | ✅ Valid WASM, runs correctly |
| SCPCB/Difficulty.bb | ✅ Compiles |
| SCPCB/KeyName.bb | ✅ Compiles |
| SCPCB/Particles.bb | ✅ Compiles |

## Recent Fixes

| Issue | Fix |
|-------|-----|
| Type lookup case sensitivity | `.lowercased()` on all lookups |
| Field access wrong offset | Fixed fieldOffsets lookup |
| Delete not working | Fixed userTypes lookup |
| Function shadowing | Added userFunctionIndices map |
| New allocation stack leak | Changed if block to void |

## Next Steps

1. **Test more SCPCB files** - MapSystem.bb, NPCs.bb
2. **Implement missing imports** - LoadMesh, LoadTexture, etc.
3. **Load actual SCPCB assets** - RMesh rooms, textures
4. **Compile full SCPCB** - Main.bb with all includes
