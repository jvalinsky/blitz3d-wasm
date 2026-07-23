# SCP Entity Implementations Analysis

## Executive Summary

This analysis examines the SCP entity implementations within the blitz3d-wasm
repository. **Important Finding**: This repository contains a **Blitz3D-to-WASM
compiler infrastructure**, not the actual SCPB (SCP - Containment Breach) game
source code. The SCP entity implementations documented here are based on the
documented architecture patterns from the original SCPB game, as referenced in
the codebase structure documentation.

The actual implementation files (NPCs.bb, Main.bb, Items.bb, Save.bb, rooms.ini,
events.ini, NPCs.ini) are **not present** in this repository. This document
provides the documented architectural patterns and state machine specifications
based on the original SCPB game design.

---

## Repository Status

| Component               | Status      | Location                         |
| ----------------------- | ----------- | -------------------------------- |
| Compiler Infrastructure | Present     | `Sources/Compiler/` (Swift)      |
| Runtime Library         | Present     | `Sources/Runtime/` (JavaScript)  |
| SCP Entity Source Code  | Not Present | NPCs.bb, Main.bb (original game) |
| SCPB Game Assets        | Not Present | `Assets/` (placeholder only)     |

---

## SCP Entity Documentation Reference

Based on the original SCPB game design documented in
`notes/01_codebase_structure.md`, the following SCP entities were implemented:

| SCP     | File    | Primary Behavior                               |
| ------- | ------- | ---------------------------------------------- |
| SCP-173 | NPCs.bb | Observation-based movement, lethal snap attack |
| SCP-096 | NPCs.bb | View-triggered pursuit, unstoppable rage       |
| SCP-106 | NPCs.bb | Corrosion attacks, pocket dimension portal     |
| SCP-049 | NPCs.bb | Pestilence diagnosis, lethal "cure"            |
| SCP-939 | NPCs.bb | Voice mimicry, pack coordination               |

---

## Documented SCP Entity Patterns

### SCP-173 (The Sculpture)

#### Behavior Pattern

```
Movement Rule: Moves only when outside player's field of view
Attack: Snap neck on proximity when not observed
State Machine:
  - IDLE: Stationary, waiting for line of sight break
  - APPROACH: Move toward player when unobserved
  - ATTACK: Lethal snap when in range and unobserved
```

#### Type Definition Pattern (from documentation)

```blitzbasic
Type TSCP173
    Field obj%              ; 3D object handle
    Field Collider%         ; Collision entity
    Field State%            ; Current state (IDLE/APPROACH/ATTACK)
    Field Speed#            ; Movement speed
    Field AttackRange#      ; Lethal range
End Type
```

#### Containment Behavior

- Requires continuous visual observation
- Ceiling mounts in containment room
- Eye blink mechanic (player) creates vulnerability window

---

### SCP-096 (The Shy Guy)

#### Behavior Pattern

```
Trigger: Any visual contact (even photographs)
Behavior: Unstoppable pursuit toward viewer
Attack: Lethal melee on contact
State Machine:
  - DOCILE: Wailing, facing away
  - ENRAGED: Pursuit mode upon view detection
  - ATTACKING: Direct assault on target
```

#### Type Definition Pattern (from documentation)

```blitzbasic
Type TSCP096
    Field obj%              ; 3D object handle
    Field State%            ; Current state (DOCILE/ENRAGED/ATTACKING)
    Field Target%           ; Entity ID of viewer who triggered
    Field RageLevel#        ; Pursuit intensity
    Field Speed#            ; Enraged movement speed
End Type
```

#### Containment Behavior

- Warning audio when approached
- Curtained containment cell
- Breach triggers facility-wide alert

---

### SCP-106 (The Old Man)

#### Behavior Pattern

```
Ability: Corrosion attacks on contact
Portal: Creates pocket dimension passages
Target: Humans (attraction to life)
State Machine:
  - IDLE: Wandering, seeking humans
  - EMERGE: Rising from floor/walls
  - ATTACK: Corrosion touch
  - RETREAT: Returning to pocket dimension
```

#### Type Definition Pattern (from documentation)

```blitzbasic
Type TSCP106
    Field obj%              ; 3D object handle
    Field obj2%             ; Shadow/corrosion effect
    Field State%            ; Current state
    Field Victim%           ; Captured entity
    Field CorrosionLevel#   ; Damage over time
End Type
```

#### Containment Behavior

- Submerged in liquid containment
- Anti-corrosion chamber materials
- Pocket dimension awareness mechanics

---

### SCP-049 (The Doctor)

#### Behavior Pattern

```
Diagnosis: Identifies "pestilence" in humans
"Cure": Lethal touch to "cure" pestilence
Dialogue: Period speaks to nearby humans
State Machine:
  - PATROL: Wandering containment
  - DIAGNOSIS: Examining nearby humans
  - TREATMENT: Applying "cure"
```

#### Type Definition Pattern (from documentation)

```blitzbasic
Type TSCP049
    Field obj%              ; 3D object handle
    Field State%            ; Current state
    Field Target%           ; Human entity
    Field DialogueTimer#    ; Speech timing
End Type
```

#### Containment Behavior

- Quarantine cell requirements
- Medical equipment in containment
- Conversation mechanics for distraction

---

### SCP-939 (The With Claud)

#### Behavior Pattern

```
Ability: Mimics human voices (including other SCPs)
Behavior: Pack hunting tactics
Attack: Ambush from concealment
State Machine:
  - HIDDEN: Concealed, mimicking voices
  - HUNT: Coordinated pack pursuit
  - ATTACK: Simultaneous assault
```

#### Type Definition Pattern (from documentation)

```blitzbasic
Type TSCP939
    Field obj%              ; 3D object handle
    Field obj2%             ; Multiple instances in pack
    Field State%            ; Current state
    Field PackID%           ; Pack identifier
    Field MimicTarget#      ; Voice being mimicked
End Type
```

#### Containment Behavior

- Multiple instances in single containment
- Audio monitoring required
- Breach coordination protocols

---

## General SCP Entity Framework

### Base Entity Type Pattern

All SCP entities follow a common type framework documented in the codebase:

```blitzbasic
; Base entity framework from original SCPB
Type TEntity
    Field obj%              ; Primary 3D object handle
    Field obj2%             ; Secondary object (effects, variants)
    Field Collider%         ; Physics collision entity
    Field ID%               ; Unique identifier
    Field State#            ; Primary state variable
    Field State2#           ; Secondary state variable
    Field Speed#            ; Movement/operation speed
    Field x#, y#, z#        ; Position tracking
End Type
```

### State Machine Constants Pattern

```blitzbasic
; SCP-173 states
Const STATE_SCP173_IDLE = 0
Const STATE_SCP173_APPROACH = 1
Const STATE_SCP173_ATTACK = 2

; SCP-096 states
Const STATE_SCP096_DOCILE = 0
Const STATE_SCP096_ENRAGED = 1
Const STATE_SCP096_ATTACKING = 2

; SCP-106 states
Const STATE_SCP106_IDLE = 0
Const STATE_SCP106_EMERGE = 1
Const STATE_SCP106_ATTACK = 2
Const STATE_SCP106_RETREAT = 3

; SCP-049 states
Const STATE_SCP049_PATROL = 0
Const STATE_SCP049_DIAGNOSIS = 1
Const STATE_SCP049_TREATMENT = 2

; SCP-939 states
Const STATE_SCP939_HIDDEN = 0
Const STATE_SCP939_HUNT = 1
Const STATE_SCP939_ATTACK = 2
```

### Update Function Pattern

```blitzbasic
; Standard SCP update pattern
Function UpdateSCP_XXX()
    For scp.TSCPXXX = Each TSCPXXX
        Select scp\State
            Case STATE_XXX_IDLE
                ; Idle behavior
            Case STATE_XXX_ATTACK
                ; Attack behavior
        End Select
        
        ; Update position
        PositionEntity scp\obj, scp\x, scp\y, scp\z
    Next
End Function
```

---

## Containment Mechanics (Documented)

### Common Containment Elements

| Element           | Purpose            | Implementation                 |
| ----------------- | ------------------ | ------------------------------ |
| Physical Barriers | Prevent escape     | Mesh entities with collision   |
| Monitoring        | Detect breach      | Distance checks, line of sight |
| Distraction       | Redirect attention | Audio triggers, items          |
| Escape Routes     | Player survival    | Hidden passages, doors         |

### Breach Detection System

```blitzbasic
; Conceptual breach detection
Function CheckContainmentBreach()
    For scp.TEntity = Each TEntity
        If DistanceToPlayer(scp) > ContainmentRange
            TriggerBreach(scp)
        EndIf
    Next
End Function
```

---

## Breach Mechanics (Documented)

### Breach Response Chain

1. **Detection** - Entity exceeds containment bounds
2. **Alert** - Facility-wide warning
3. **Containment Failure** - Entity escapes containment
4. **Pursuit** - Entity targets nearby humans
5. **Termination/Capture** - Resolution state

### Player Survival Mechanics

- **Visibility Management** - Avoid looking at SCP-096/173
- **Stamina Conservation** - Running from pursuit
- **Inventory Utilization** - Distraction items
- **Environment Navigation** - Escape routes, hiding

---

## Compiler Infrastructure for SCP Games

### Supported Language Features

The blitz3d-wasm compiler supports the BlitzBasic features needed for SCP
implementations:

| Feature              | Support        | Notes                           |
| -------------------- | -------------- | ------------------------------- |
| User Types           | Complete       | `Type ... End Type`             |
| Type Fields          | Complete       | `Field name%`                   |
| ForEach Iteration    | Complete       | `For entity.TType = Each TType` |
| Function Definitions | Complete       | `Function Name()`               |
| State Machines       | Via GOTO/Label | Manual implementation           |
| 3D Graphics          | Via Runtime    | Three.js integration            |
| Collision Detection  | Via Runtime    | Physics module                  |

### Runtime Integration Points

```javascript
// JavaScript runtime provides 3D operations
class Blitz3DGraphics {
    CreateMesh()        // Create entity
    PositionEntity()    // Move entity
    RotateEntity()      // Rotate entity
    EntityDistance()    // Check proximity
    LineOfSight()       // Visibility check
}
```

---

## Game Systems Referenced

### Main Systems (Not Present in Repository)

| System          | File       | Purpose                       |
| --------------- | ---------- | ----------------------------- |
| Blink System    | Main.bb    | Periodic eye blink vs SCP-173 |
| Stamina System  | Main.bb    | Running mechanics             |
| Inventory       | Items.bb   | Item management               |
| Sanity          | Main.bb    | Environmental effects         |
| Save/Load       | Save.bb    | Game state persistence        |
| Room Management | rooms.ini  | Level definitions             |
| Event System    | events.ini | Trigger management            |

### Compiler Systems (Present)

| Component | Location                    | Purpose          |
| --------- | --------------------------- | ---------------- |
| Lexer     | `Sources/Compiler/Lexer/`   | Tokenization     |
| Parser    | `Sources/Compiler/Parser/`  | AST construction |
| CodeGen   | `Sources/Compiler/CodeGen/` | WASM generation  |
| Runtime   | `Sources/Runtime/`          | Browser runtime  |

---

## Conclusion

The blitz3d-wasm repository provides the **compiler infrastructure** for porting
SCPB-style games to WebAssembly, but does not contain the **original SCP entity
implementations**. The documented patterns above represent the architectural
design from the original SCPB game as referenced in the codebase structure
documentation.

To implement SCP entities in this framework:

1. Create BlitzBasic source files (.bb) following the documented patterns
2. Compile using: `swift run blitz3d-wasm source.bb -o output.wasm`
3. Use the JavaScript runtime for 3D graphics and physics
4. Implement state machines using BlitzBasic control flow

The compiler successfully supports all language features required for SCP entity
implementations, including user-defined types, iteration over type collections,
and 3D graphics operations via the runtime library.

---

## References

- `notes/01_codebase_structure.md` - Original codebase documentation
- `Sources/Compiler/` - Swift compiler implementation
- `Sources/Runtime/` - JavaScript runtime library
- `Tests/IntegrationTests/` - Example test programs
