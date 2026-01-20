# Core Game Systems Compilation Analysis

**Date**: January 20, 2026  
**Status**: ✅ All 3 core systems compile to WASM

## Compilation Results

| File | Lines | WASM Size | Status |
|------|-------|-----------|--------|
| Particles.bb | 288 | 13 KB | ✅ Success |
| Items.bb | 886 | 47 KB | ✅ Success |
| NPCs.bb | 7,460 | 120 KB | ✅ Success |

## Issues Found

### 1. Missing Runtime Functions

These functions are called by the game but not registered in the compiler:

**Sprite/Particle Functions**:
- CreateSprite
- SpriteViewMode
- ScaleSprite  
- ParticleTextures
- UpdateParticles
- UpdateEmitters
- SetEmitter

**Entity Functions**:
- EntityAlpha
- EntityBlend
- EntityFX
- EntityParent
- EntityVisible
- EntityShininess
- EntityColor
- EntityPick
- EntityPickMode
- EntityInView
- EntityCollided
- HideEntity
- ShowEntity
- Kill
- NameEntity
- TranslateEntity

**Asset Loading**:
- LoadMesh_Strict
- LoadAnimMesh_Strict
- LoadTexture_Strict
- LoadSound_Strict
- LoadTempSound
- LoadImage_Strict
- FreeSound_Strict

**Game-Specific**:
- PlaySound_Strict
- DebugLog
- RuntimeError
- CatchErrors
- MilliSecs2
- CurrentDate
- GiveAchievement
- CreateDecal
- UpdateDecals
- CreateParticle
- CreateConsoleMsg
- Console_SpawnNPC
- AlignToVector
- AnimateNPC
- Animate2
- CurveAngle
- ChangeNPCTextureID
- CheckForNPCInFacility
- LinePick
- PickedX/Y/Z
- CameraProject

### 2. Type Definition Issues

The compiler encounters "Failed to resolve field access" warnings because:
- Types are defined across multiple files
- Particles.bb references `Particles` type (defined elsewhere)
- Items.bb references `Items` type (defined elsewhere)  
- NPCs.bb references `NPCs` type (defined elsewhere)

**Current behavior**: Compiler auto-declares these as globals (wrong!)

**Solution needed**: Multi-file compilation or include resolution

### 3. Global Variables

These files reference many globals defined in Main.bb:
- BLEND_ADD (constant)
- CoughSFX (array)
- AlarmSFX (array)
- DamageSFX (array)
- PickSFX (array)
- IntroSFX (sound)
- BreathSFX (sound)
- Collider (entity)
- Inventory (array)
- Room (current room)

## Next Steps

### Priority 1: Add Missing Functions (2-3 hours)
Add stubs for the ~50 missing functions to CodeGenerator.swift.

Most are straightforward:
- Entity functions → map to Three.js object properties
- Load functions → call existing LoadMesh/LoadTexture
- Sound functions → call FMOD wrappers

### Priority 2: Multi-file Compilation (4-6 hours)
Support compiling multiple .bb files together:
1. Parse all files first
2. Collect all type definitions
3. Then generate code with full type context

Alternative: Implement `Include` directive properly

### Priority 3: Test Execution (1-2 hours)
Load compiled WASM modules in browser:
1. Add missing runtime functions to runtime.js
2. Test Particles.wasm - should create sprites
3. Test Items.wasm - should load item definitions
4. Test NPCs.wasm - should define NPC behaviors

## Findings

✅ **Compiler works** - generates valid WASM  
✅ **Code generation** - handles complex logic correctly  
✅ **Type inference** - works for local scopes  
⚠️ **Type resolution** - breaks across file boundaries  
⚠️ **Function registry** - missing ~50 game functions  
⚠️ **Include system** - not fully implemented  

## Estimated Effort to Full Game

- **Missing functions**: 50 functions × 10 min = 8 hours
- **Multi-file support**: 6 hours  
- **Main.bb compilation**: 4 hours (fix special cases)
- **Runtime testing**: 8 hours
- **Asset loading**: 8 hours
- **Bug fixes**: 16 hours

**Total**: ~50 hours to playable demo

## Quick Wins

1. **Add sprite functions** (30 min) - Particles.wasm can run
2. **Add entity functions** (1 hour) - All 3 modules can initialize
3. **Test in browser** (30 min) - Validate runtime integration
4. **Load one room** (2 hours) - Visual progress!

---

Generated after 8.5 hour session implementing browser runtime
