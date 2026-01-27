# SCPCB Compilation Test Results

**Date**: January 27, 2026

## Test Results

| File | Lines | Result | Notes |
|------|-------|--------|-------|
| Achievements.bb | 180 | ✅ VALID | |
| Menu.bb | 2,626 | ✅ VALID | Large file with UI code |
| KeyName.bb | 68 | ✅ VALID | Simple key mappings |
| Difficulty.bb | 74 | ✅ VALID | Difficulty settings |
| Save.bb | 1,886 | ✅ VALID | Save/Load system |
| Items.bb | 1,174 | ❌ stack error | `drop` without value |
| Particles.bb | 288 | ❌ type/scope | Float/int mismatch, local vars |
| MapSystem.bb | 8,750 | ❌ include | Missing Drawportals.bb (case) |

## Summary

- **5/8 files** compile to valid WASM (62.5%)
- **Major success**: Menu.bb (2,626 lines) compiles perfectly
- **Major success**: Save.bb (1,886 lines) compiles perfectly

## Issues to Fix

### 1. Items.bb - Stack Imbalance
```
error: type mismatch in drop, expected [any] but got []
```
Function return value being dropped when function returns void.

### 2. Particles.bb - Type Issues
```
error: type mismatch in i32.or, expected [i32, i32] but got [... f32, i32]
error: local variable out of range
```
- Float comparison result used in Or expression
- Local variable scope issues

### 3. MapSystem.bb - Case-Sensitive Include
```
Error: file doesn't exist - Drawportals.bb
```
Include references `Drawportals.bb` but file is `DrawPortals.bb`.

## Prioritized Fix List

1. **Function return drop** - Don't add drop for void functions
2. **Float comparison in boolean** - Convert f32 comparison to i32
3. **Case-insensitive includes** - Match files regardless of case

