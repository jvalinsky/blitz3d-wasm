---
title: "Complex Object References"
type: technical
audience: developer
status: draft
created: 2026-01-23
updated: 2026-01-23
related:
  - docs/compiler/gaps/compilation-gaps.md
  - docs/compiler/gaps/handle-arrays.md
  - docs/game-systems/entities/npc-ai.md
tags: [compiler, object-references, field-access, scpb]
---

# Complex Object References

## Overview

Complex object references enable advanced field access patterns like
`object\field[index]` and `obj1\reference = obj2`. While basic `object\field`
access works, indexed field access and object assignments fail compilation,
blocking entity relationships and navigation systems.

🔗 **Related:** [Compilation Gaps](compilation-gaps.md) |
[Handle Arrays](handle-arrays.md) |
[NPC AI](../../game-systems/entities/npc-ai.md)

## Current Implementation Status

**✅ Basic Field Access:** `npc\Health` patterns work correctly **❌ Indexed
Field Access:** `waypoint\Connected[i]` patterns fail **❌ Object Assignments:**
`obj1\reference = obj2` patterns fail

## Problem Statement

SCPB uses complex object relationships extensively:

```blitzbasic
; Entity relationships - currently fail
waypoint\Connected[0] = northWaypoint
soldier\Teammates[i] = partner

; Complex data structures - currently fail
npc\Target\EnemyX = playerX
container\Items[slot]\Quantity = 5
```

**Root Cause:** AST and code generation don't support nested/complex field
access patterns.

## Technical Requirements

### 1. AST Extension

**File:** `Sources/Compiler/AST/AST.swift`

Need to extend ExpressionNode to support complex field access:

```swift
indirect enum ExpressionNode {
    // Existing
    case fieldAccess(FieldAccessNode, SourceSpan)

    // New - indexed field access
    case indexedFieldAccess(IndexedFieldAccessNode, SourceSpan)

    // New - nested field access (obj.field.subfield)
    case nestedFieldAccess(NestedFieldAccessNode, SourceSpan)
}

// New AST nodes
public struct IndexedFieldAccessNode {
    public var object: ExpressionNode
    public var field: String
    public var indices: [ExpressionNode]  // Support multi-dimensional
    public var span: SourceSpan
}

public struct NestedFieldAccessNode {
    public var object: ExpressionNode
    public var fields: [String]  // Chain of field names
    public var span: SourceSpan
}
```

### 2. Parser Enhancement

**File:** `Sources/Compiler/Parser/Parser.swift`

Extend field access parsing to handle complex patterns:

```swift
func parseFieldAccess() -> ExpressionNode {
    let object = parseExpression()

    var fields: [String] = []
    var indices: [[ExpressionNode]] = []

    while true {
        if consume(.backslash) {
            let field = parseIdentifier()
            fields.append(field)

            // Check for array indexing
            var fieldIndices: [ExpressionNode] = []
            if consume(.leftBracket) {
                repeat {
                    fieldIndices.append(parseExpression())
                } while consume(.comma)
                expect(.rightBracket)
            }
            indices.append(fieldIndices)

        } else {
            break
        }
    }

    // Determine appropriate AST node
    if fields.count == 1 && indices[0].isEmpty {
        // Simple field access: obj.field
        return .fieldAccess(FieldAccessNode(object: object, field: fields[0], span: span), span)
    } else if fields.count == 1 && !indices[0].isEmpty {
        // Indexed field access: obj.field[index]
        return .indexedFieldAccess(IndexedFieldAccessNode(object: object, field: fields[0], indices: indices[0], span: span), span)
    } else if fields.count > 1 {
        // Nested field access: obj.field1.field2
        return .nestedFieldAccess(NestedFieldAccessNode(object: object, fields: fields, span: span), span)
    }

    return object
}
```

### 3. Code Generation Implementation

**File:** `Sources/Compiler/CodeGen/ExpressionGeneration.swift`

Implement code generation for complex field access:

```swift
case .indexedFieldAccess(let access, _):
    return generateIndexedFieldAccess(access)

case .nestedFieldAccess(let access, _):
    return generateNestedFieldAccess(access)

private func generateIndexedFieldAccess(_ access: IndexedFieldAccessNode) -> (instrs: [WASMInstruction], type: WASMType) {
    var instrs: [WASMInstruction] = []

    // 1. Get field base address
    let baseInstrs = generate(.fieldAccess(FieldAccessNode(object: access.object, field: access.field, span: access.span), access.span))
    instrs.append(contentsOf: baseInstrs.instrs)

    // 2. Calculate array offset
    let elementType = getFieldElementType(access.object, access.field)
    let elementSize = context.typeSize(for: elementType)

    for (i, indexExpr) in access.indices.enumerated() {
        let indexInstrs = generate(indexExpr)
        instrs.append(contentsOf: indexInstrs.instrs)

        // Convert to i32 if needed
        if indexInstrs.type != .i32 {
            instrs.append(contentsOf: convert(from: indexInstrs.type, to: .i32))
        }

        // Multiply by element size
        instrs.append(.i32Const(Int32(elementSize)))
        instrs.append(.i32Mul)

        if i > 0 {
            instrs.append(.i32Add)  // Accumulate for multi-dimensional
        }
    }

    // 3. Add base + offset
    instrs.append(.i32Add)

    // 4. Load value
    switch elementType {
    case .i32: instrs.append(.i32Load(2, 0))
    case .f32: instrs.append(.f32Load(2, 0))
    case .i64: instrs.append(.i64Load(2, 0))
    case .f64: instrs.append(.f64Load(2, 0))
    default: instrs.append(.i32Load(2, 0))
    }

    return (instrs, elementType)
}

private func generateNestedFieldAccess(_ access: NestedFieldAccessNode) -> (instrs: [WASMInstruction], type: WASMType) {
    var currentObject = access.object
    var instrs: [WASMInstruction] = []

    // Chain field accesses
    for field in access.fields {
        let fieldAccess = FieldAccessNode(object: currentObject, field: field, span: access.span)
        let (fieldInstrs, fieldType) = generateFieldAccess(fieldAccess)

        instrs.append(contentsOf: fieldInstrs)

        // Update current object for next field in chain
        // This requires the result to be treated as the new object
        currentObject = .fieldAccess(fieldAccess, access.span)
    }

    // Load final value
    let finalType = getFieldType(currentObject, access.fields.last!)
    switch finalType {
    case .i32: instrs.append(.i32Load(2, 0))
    case .f32: instrs.append(.f32Load(2, 0))
    case .i64: instrs.append(.i64Load(2, 0))
    case .f64: instrs.append(.f64Load(2, 0))
    default: instrs.append(.i32Load(2, 0))
    }

    return (instrs, finalType)
}
```

## SCPB Usage Patterns

### Entity Relationships

```blitzbasic
; MTF squad coordination - currently fails
Type MTFUnit
    Field Leader.NPCs       ; Direct reference works
    Field Teammates.NPCs[4] ; Handle array - separate issue
End Type

Function CoordinateSquad(unit.MTFUnit)
    ; Direct reference assignment - should work but currently fails
    unit\Leader\State = STATE_COMBAT

    ; This pattern is used extensively in SCPB
    unit\Leader\Target = player
End Function
```

### Navigation Systems

```blitzbasic
; Waypoint connections - currently fails
Type WayPoint
    Field Connected.WayPoint[4]  ; Connected waypoints
    Field Distance#[4]           ; Distance to each connection
End Type

Function NavigatePath(current.WayPoint, target.WayPoint)
    ; Find connection to target
    For i = 0 To 3
        If current\Connected[i] = target Then  ; Array access fails
            Return current\Distance[i]        ; Nested access fails
        EndIf
    Next
End Function
```

### Inventory Management

```blitzbasic
; Item properties - currently fails
Type Item
    Field Name$
    Field Quantity%
    Field Properties.ItemStats
End Type

Type Player
    Field Inventory.Item[9]
End Type

Function UseItem(player.Player, slot%)
    item = player\Inventory[slot]           ; Handle array access fails
    If item\Properties\Durability > 0 Then  ; Nested field access fails
        item\Quantity = item\Quantity - 1   ; Field assignment works
    EndIf
End Function
```

## Implementation Plan

### Phase 1: AST and Parser (Week 1)

1. Add new AST node types for complex field access
2. Update parser to recognize indexed and nested field patterns
3. Add comprehensive test cases for parsing

### Phase 2: Code Generation (Week 2)

1. Implement indexed field access generation
2. Add nested field access generation
3. Update type resolution for complex expressions

### Phase 3: Integration Testing (Week 3)

1. Test with SCPB entity relationship code
2. Validate navigation system compilation
3. Performance testing with complex field chains

### Phase 4: Optimization (Week 4)

1. Optimize code generation for common patterns
2. Add caching for type lookups
3. Implement bounds checking optimizations

## Testing Strategy

### Unit Tests

```swift
func testIndexedFieldAccess() {
    let code = "obj\\field[5]"
    let ast = parse(code)
    XCTAssertNotNil(ast)
    // Verify IndexedFieldAccessNode is created
}

func testNestedFieldAccess() {
    let code = "obj\\field1\\field2"
    let ast = parse(code)
    XCTAssertNotNil(ast)
    // Verify NestedFieldAccessNode is created
}

func testComplexFieldChain() {
    let code = "player\\inventory[slot]\\properties\\durability"
    let wasm = compileToWASM(code)
    // Verify correct nested access compilation
}
```

### Integration Tests

```blitzbasic
; Test SCPB-style complex field access
Type WayPoint
    Field Connected.WayPoint[4]
    Field Distance#[4]
End Type

Type NPC
    Field Target.NPCs
    Field Path.WayPoint[20]
End Type

Function TestComplexReferences()
    Local npc.NPC = New NPC
    Local wp.WayPoint = New WayPoint

    ; These patterns should all work after implementation
    npc\Target = player              ; Direct object assignment
    npc\Path[0] = wp                 ; Indexed field assignment
    wp\Connected[1] = nextWaypoint   ; Indexed field assignment
    distance# = wp\Distance[1]       ; Indexed field access

    ; Complex chaining
    npc\Path[0]\Connected[2] = destination  ; Nested indexed access
End Function
```

## Success Criteria

- **Indexed Field Access:** `obj\field[index]` compiles and executes correctly
- **Nested Field Access:** `obj\field1\field2` compiles and executes correctly
- **Object Assignments:** `obj1\reference = obj2` works for all reference types
- **SCPB Entity Systems:** NPC relationships and navigation compile successfully
- **Performance:** Complex field access has minimal overhead
- **Type Safety:** Proper type checking for all field access patterns

## Dependencies

- **Type System:** Requires accurate type information for field lookup
- **Memory Layout:** Depends on consistent field offset calculations
- **Handle System:** Works with handle arrays for complex data structures
- **Parser:** Needs robust expression parsing for nested patterns

## Risk Assessment

### Medium Risk

- **AST Complexity:** Adding new node types increases AST complexity
- **Type Resolution:** Complex field chains require accurate type tracking
- **Performance:** Nested field access may impact runtime performance

### Low Risk

- **Backward Compatibility:** New features don't break existing code
- **Incremental Implementation:** Can implement indexed and nested access
  separately
- **Testing:** Well-established patterns in SCPB provide clear test cases

## Related Work

- **Handle Arrays:** Complex references often used with handle arrays
- **Type System:** Extends field access to support object relationships
- **Memory Management:** Works within existing field offset system
- **SCPB Compatibility:** Critical for entity AI and game state management

---

_Complex object references are essential for SCPB's entity relationships,
navigation systems, and data structures, making this a high-priority
implementation for achieving full game compatibility._
