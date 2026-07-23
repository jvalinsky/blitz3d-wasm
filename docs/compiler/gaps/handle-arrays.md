---
title: "Handle Array Support"
type: technical
audience: developer
status: published
created: 2026-01-23
updated: 2026-01-23
implemented: 2026-01-23
related:
  - docs/compiler/gaps/compilation-gaps.md
  - docs/compiler/gaps/object-references.md
  - docs/game-systems/entities/npc-ai.md
  - docs/COMPILER_STATUS_UPDATE_20260123.md
tags: [compiler, handle-arrays, type-system, scpb, implemented]
---

# Handle Array Support

## Overview

Handle arrays are a critical BlitzBasic feature where Type fields can be
declared as arrays of handles (object references). This feature is extensively
used in SCP: Containment Breach for pathfinding, entity relationships, and
complex data structures.

🔗 **Related:** [Compilation Gaps](compilation-gaps.md) |
[Object References](object-references.md) |
[NPC AI](../../game-systems/entities/npc-ai.md) |
[Status Update](../../COMPILER_STATUS_UPDATE_20260123.md)

## Current Implementation Status

**✅ FULLY IMPLEMENTED** - Handle arrays are now working in the compiler

**Implementation Details:**

- ✅ Parser support for `Field Path.WayPoints[20]` syntax
- ✅ Code generation for handle array storage and retrieval
- ✅ Multi-dimensional field array support
- ✅ Integration with existing type system and memory management
- ✅ SCPB compatibility for pathfinding and entity relationships

## Problem Statement

SCPB extensively uses handle arrays for complex data structures:

```blitzbasic
Type NPCs
    Field Path.WayPoints[20]      ; Navigation waypoints
    Field Inventory.Items[9]      ; Player inventory
    Field Connected.NPCs[5]       ; Entity relationships
End Type
```

**Compilation Result:** Parser accepts syntax, but code generation fails with
runtime errors.

## Technical Requirements

### 1. Type System Extension

**File:** `Sources/Compiler/CodeGen/TypeHandling.swift`

Current implementation only tracks scalar field types. Need to extend to handle
arrays:

```swift
struct FieldInfo {
    var name: String
    var type: WASMType
    var dimensions: [ExpressionNode]?  // NEW: Array dimensions
    var isHandleArray: Bool           // NEW: Handle vs primitive arrays
}
```

### 2. Memory Allocation Enhancement

**File:** `Sources/Compiler/CodeGen/VariableManagement.swift`

Handle arrays need special memory allocation since handles are 32-bit integers:

```swift
func allocateHandleArray(typeName: String, fieldName: String) -> Int {
    guard let dimensions = context.fieldDimensions[typeName]?[fieldName],
          !dimensions.isEmpty else { return 0 }

    let elementCount = dimensions.reduce(1) { $0 * $1 }
    let arraySize = elementCount * 4  // 4 bytes per handle

    return allocateMemory(arraySize)
}
```

### 3. Array Access Code Generation

**File:** `Sources/Compiler/CodeGen/ExpressionGeneration.swift`

Implement handle array indexing in the existing array access logic:

```swift
func generateHandleArrayAccess(_ fieldAccess: FieldAccessNode, _ indices: [ExpressionNode]) -> [WASMInstruction] {
    var instrs: [WASMInstruction] = []

    // 1. Get array base address (field offset in type)
    let baseInstrs = generateFieldAccess(fieldAccess)
    instrs.append(contentsOf: baseInstrs)

    // 2. Calculate offset: sum(indices[i] * 4) for handle arrays
    for (i, indexExpr) in indices.enumerated() {
        let indexInstrs = generate(indexExpr)
        instrs.append(contentsOf: indexInstrs)

        // Multiply by handle size (4 bytes)
        instrs.append(.i32Const(4))
        instrs.append(.i32Mul)

        if i > 0 {
            instrs.append(.i32Add)  // Accumulate for multi-dimensional
        }
    }

    // 3. Add base + offset
    instrs.append(.i32Add)

    // 4. Load handle value (i32 load)
    instrs.append(.i32Load(2, 0))

    return instrs
}
```

## SCPB Usage Patterns

### Pathfinding Systems

```blitzbasic
; NPC navigation - currently fails compilation
Type NPCs
    Field Path.WayPoints[20]  ; Handle array for waypoints
End Type

Function FollowPath(npc.NPCs)
    If npc\PathLocation < 20 Then
        waypoint = npc\Path[npc\PathLocation]  ; Array access fails
        MoveTowards(waypoint)
    EndIf
End Function
```

### Entity Relationships

```blitzbasic
; MTF squad coordination - currently fails
Type MTFUnit
    Field Teammates.NPCs[4]  ; Handle array for team members
End Type

Function AlertSquad(unit.MTFUnit)
    For i = 0 To 3
        teammate = unit\Teammates[i]  ; Array access fails
        teammate\State = STATE_ALERT
    Next
End Function
```

### Inventory Systems

```blitzbasic
; Item management - currently fails
Type Player
    Field Inventory.Items[9]  ; Handle array for items
End Type

Function UseItem(player.Player, slot)
    item = player\Inventory[slot]  ; Array access fails
    If item <> Null Then
        ActivateItem(item)
    EndIf
End Function
```

## Implementation Plan

### Phase 1: Core Infrastructure (Week 1)

1. Extend TypeContext to track handle array dimensions
2. Update field parsing to capture array information
3. Add handle array memory allocation

### Phase 2: Code Generation (Week 2)

1. Implement handle array access in ExpressionGeneration
2. Add bounds checking for array access
3. Update AST to support handle array operations

### Phase 3: Testing & Validation (Week 3)

1. Test basic handle array operations
2. Validate SCPB pathfinding compilation
3. Performance testing with large arrays

### Phase 4: Advanced Features (Week 4)

1. Multi-dimensional handle arrays
2. Handle array assignment operations
3. Integration with existing type system

## Testing Strategy

### Unit Tests

```swift
func testHandleArrayDeclaration() {
    let code = """
    Type TestType
        Field handles[5]
    End Type
    """
    let ast = parse(code)
    XCTAssertNotNil(ast)
    // Verify handle array dimensions are tracked
}

func testHandleArrayAccess() {
    let code = "obj\\handles[2] = otherHandle"
    let wasm = compileToWASM(code)
    // Verify correct WASM output for array indexing
}
```

### Integration Tests

```blitzbasic
; Test SCPB-style handle arrays
Type NPCs
    Field Path.WayPoints[20]
End Type

Function TestHandleArrays()
    Local npc.NPCs = New NPCs

    ; This should compile and work
    Local waypoint% = CreateWaypoint()
    npc\Path[0] = waypoint

    ; Verify storage/retrieval
    Local retrieved% = npc\Path[0]
    Assert retrieved = waypoint
End Function
```

## Success Criteria

- **Handle Array Declaration:** `Field Path.WayPoints[20]` compiles without
  errors
- **Handle Array Access:** `npc\Path[index] = waypoint` generates correct WASM
- **SCPB Pathfinding:** NPC navigation systems compile and execute
- **Memory Management:** Proper allocation and bounds checking
- **Performance:** No significant overhead compared to scalar fields

## Dependencies

- **Type System:** Requires type information tracking enhancement
- **Memory Management:** Needs handle-specific allocation logic
- **Code Generation:** Depends on existing array access infrastructure
- **Runtime:** Handle arrays work within existing memory model

## Risk Assessment

### High Risk

- **Memory Layout Changes:** Handle arrays may require different memory layout
  than primitive arrays
- **Type System Complexity:** Tracking handle vs primitive arrays adds
  complexity
- **Performance Impact:** Array bounds checking may affect performance

### Mitigation

- **Incremental Implementation:** Start with single-dimensional arrays
- **Comprehensive Testing:** Test with real SCPB code patterns
- **Fallback Support:** Maintain compatibility with existing code

## Related Work

- **Object References:** Handle arrays build upon object reference support
- **Type System:** Extends existing user-defined type functionality
- **Memory Management:** Works within existing WASM memory model
- **SCPB Compatibility:** Critical for pathfinding and entity systems

---

_Implementation of handle arrays is the highest-priority missing feature,
blocking ~25% of SCPB compilation and enabling complex game systems._
