# NPCs.bb Investigation Notes

**Status**: 22 TYPE errors\
**Difficulty**: Medium (estimated 2-3 hours)

---

## Error Pattern Analysis

### Error Categories

**Category 1** (6 errors): Field store mismatches

```
global.set, expected [i32] but got [f32]
f32.store, expected [i32, f32] but got [i32, i32]
```

Pattern repeats 3 times at offsets: 0x3777-0x3782, 0x3798-0x37a3, 0x37aa-0x37b5

**Category 2** (16 errors): Local variable type mismatches

```
local.set, expected [i32] but got [f32]
i32.gt_s, expected [i32, i32] but got [i32, f32]
```

Pattern occurs at: 0xcb30, 0xcb43, 0xcb53, 0xcb66, 0xd1a3, 0xd1b6, 0xd1c6,
0xd1d9, 0x17bee, 0x17c04, 0x17c14, 0x17c2a, 0x183d7, 0x18409

---

## Type Definition

```blitz3d
Type NPCs
    Field obj%, obj2%, obj3%, obj4%, Collider%     ; i32
    Field NPCtype%, ID%                            ; i32
    Field DropSpeed#, Gravity%                     ; f32, i32
    Field State#, State2#, State3#, PrevState%     ; f32, f32, f32, i32
    Field MakingNoise%                             ; i32
    Field Frame#                                   ; f32
    Field Angle#                                   ; f32
    Field Sound%, SoundChn%, SoundTimer#           ; i32, i32, f32
    Field Sound2%, SoundChn2%                      ; i32, i32
    Field Speed#, CurrSpeed#                       ; f32, f32
    Field texture$                                 ; string
    Field Idle#                                    ; f32
    Field Reload#                                  ; f32
    Field LastSeen%, LastDist#                     ; i32, f32
    Field PrevX#, PrevY#, PrevZ#                   ; f32, f32, f32
    Field Target.NPCs, TargetID%                   ; ref, i32
    Field EnemyX#, EnemyY#, EnemyZ#                ; f32, f32, f32
    Field Path.WayPoints[20], PathStatus%, PathTimer#, PathLocation%
    Field NVX#, NVY#, NVZ#, NVName$
    Field GravityMult# = 1.0                       ; f32 with initializer
    Field MaxGravity# = 0.2                        ; f32 with initializer
    Field MTFVariant%                              ; i32
    Field MTFLeader.NPCs                           ; ref
    Field IsDead%                                  ; i32
    Field BlinkTimer# = 1.0                        ; f32 with initializer
    Field IgnorePlayer%                            ; i32
    Field ManipulateBone%, ManipulationType%       ; i32, i32
    Field BoneToManipulate$                        ; string
    Field BonePitch#, BoneYaw#, BoneRoll#          ; f32, f32, f32
    Field NPCNameInSection$                        ; string
    Field InFacility% = True                       ; i32 with initializer
    Field CanUseElevator% = False                  ; i32 with initializer
    Field CurrElevator.ElevatorObj                 ; ref
    Field HP%                                      ; i32
    Field PathX#, PathZ#                           ; f32, f32
    Field Model$                                   ; string
    Field ModelScaleX#, ModelScaleY#, ModelScaleZ# ; f32, f32, f32
    Field HideFromNVG                              ; i32 (no suffix)
    Field TextureID% = -1                          ; i32 with initializer
    Field CollRadius#                              ; f32
    Field IdleTimer#                               ; f32
    Field SoundChn_IsStream%, SoundChn2_IsStream%  ; i32, i32
    Field FallingPickDistance#                     ; f32
End Type
```

---

## Test Results

### Working Tests

✅ Simple field access (NPCtype%, ID%) ✅ Parameter name matching field name ✅
Mixed integer/float fields (State#, State2#, etc.)

### Hypothesis

The errors are NOT in simple test cases but occur in the actual NPCs.bb file.
Possibilities:

1. **Field initializers with wrong types**
   - Lines with `GravityMult# = 1.0`, `MaxGravity# = 0.2`, etc.
   - Maybe initializers are being treated as wrong type

2. **Complex field access patterns**
   - Array fields: `Field Path.WayPoints[20]`
   - Reference fields: `Field Target.NPCs`, `Field MTFLeader.NPCs`

3. **Local variable inference issues**
   - Pattern shows `local.set, expected [i32] but got [f32]`
   - Local variables auto-declared with wrong types

4. **Comparison operations**
   - `i32.gt_s, expected [i32, i32] but got [i32, f32]`
   - Comparing integer locals with float values

---

## Investigation Strategy

### Step 1: Find Problematic Code Sections

Use WASM offsets to locate exact functions/lines:

```bash
wasm-objdump -d /tmp/npcs.wasm | grep -B 30 "0003777:"
wasm-objdump -d /tmp/npcs.wasm | grep -B 30 "000cb30:"
```

### Step 2: Identify Pattern

- Are all errors in same function?
- Are they related to specific fields?
- Are they in initialization code?

### Step 3: Create Minimal Reproduction

Once pattern is found, create test case that reproduces issue

### Step 4: Fix Root Cause

Likely one of:

- Field offset calculation bug
- Type registration for fields with initializers
- Local variable type inference in complex expressions
- Comparison operators with mixed types

---

## Quick Checks to Try

### Check 1: Field Initializers

```bash
cd /Users/jack/Software/scp_port/blitz3d-wasm
cat > /tmp/test_field_init.bb << 'EOF'
Type Test
    Field x# = 1.0
    Field y% = 5
End Type

Function Main()
    Local t.Test = New Test
    Print t\x
    Print t\y
End Function
EOF
.build/arm64-apple-macosx/debug/blitz3d-wasm /tmp/test_field_init.bb -o /tmp/test.wasm
wasm-validate /tmp/test.wasm
```

### Check 2: Array Fields

```bash
cat > /tmp/test_array_field.bb << 'EOF'
Type Test
    Field Path[20]
End Type

Function Main()
    Local t.Test = New Test
    t\Path[0] = 1
End Function
EOF
.build/arm64-apple-macosx/debug/blitz3d-wasm /tmp/test_array_field.bb -o /tmp/test.wasm
wasm-validate /tmp/test.wasm
```

### Check 3: Reference Fields

```bash
cat > /tmp/test_ref_field.bb << 'EOF'
Type Test
    Field next.Test
End Type

Function Main()
    Local t1.Test = New Test
    Local t2.Test = New Test
    t1\next = t2
End Function
EOF
.build/arm64-apple-macosx/debug/blitz3d-wasm /tmp/test_ref_field.bb -o /tmp/test.wasm
wasm-validate /tmp/test.wasm
```

---

## Expected Timeline

- **Investigation**: 1 hour (find exact cause)
- **Fix Implementation**: 30 min - 1 hour
- **Testing**: 30 min
- **Total**: 2-3 hours

---

## Success Criteria

- All 22 TYPE errors resolved
- NPCs.bb validates successfully
- No regressions in other files
- Pass rate: 32/36 (89%)

---

## Notes for Next Session

1. Start with Quick Checks above
2. Use WASM disassembly to locate exact error locations
3. Compare with working test cases to find difference
4. Focus on field initializers first (most suspicious)
5. Check if problem is in type registration or code generation

This issue is contained to NPCs.bb, suggesting it's a specific pattern that file
uses that others don't. The large number of fields with mixed types and
initializers makes it a prime suspect.
