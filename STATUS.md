# Project Status

**Last Updated**: January 30, 2026

## Summary

Blitz3D-WASM compiles Blitz3D BASIC to WebAssembly with a TypeScript runtime for browser APIs.

**Compiler**: Production-ready (~17K lines Swift) — 94.7% SCPCB pass rate\
**Runtime**: TypeScript runtime (~12K lines) with command buffers

## Working Demo

**URL**: https://blitz3d.exe.xyz:8000/test.html

Demonstrates:
- Particles falling with gravity
- Alpha fading
- Automatic deletion when expired
- All logic in WASM, JS only renders

## Architecture

### WASM (compiled BB code)
- Type system (New, Delete, linked lists)
- Field access (p\x, p\y, p\obj)
- Physics (gravity, velocity)
- Game logic (lifetime, conditions)
- Control flow (While, If, For Each)
- Memory management

### TypeScript Runtime (~12K lines)
- Graphics (Three.js integration)
- Audio (Web Audio API)
- File I/O (Virtual filesystem)
- Input (DOM events)
- Command buffer (efficient WASM→JS batching)

### Thin Demo Runtime (~500 lines)
- `CreateSprite()` → Three.js Sprite
- `PositionEntity(id,x,y,z)` → set position
- `EntityAlpha(id,a)` → set opacity
- `FreeEntity(id)` → remove from scene
- `Print(s)` → console.log

## SCPCB Compilation Status

| Metric | Value |
|--------|-------|
| Files Tested | 57 |
| Passing | 54 (94.7%) |
| WASM Validation | 100% |

## Source of Truth

- **Plan index**: `plan/README.md`
- **SCPCB web port**: `plan/00_GLOBAL_PLAN.md`
- **Compiler status**: `docs/COMPILER_STATUS_ANALYSIS.md`

## Recent Achievements

- Complete asset pipeline (B3D/X/RMESH → SMPK)
- Command buffer system for efficient WASM→JS
- Virtual filesystem with path aliasing
- Memory leak detection tooling
- CI gates for no-source-model deployment
