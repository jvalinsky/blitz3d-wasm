# Blitz3D-to-WebAssembly Compiler Gap Analysis Report

**Generated:** 2026-01-23 14:48:33 UTC
**Git Commit:** 7563c99550bee27507d5e57ac9a92772caf6822d
**Repository:** blitz3d-wasm
**Report Type:** Compiler Feature Gap Analysis for SCP: Containment Breach Compatibility

---

## Executive Summary

This report analyzes the current implementation status of the Blitz3D-to-WebAssembly compiler, focusing on three critical missing features that prevent full SCP: Containment Breach (SCPB) compatibility:

1. **Handle Arrays** - `Field Path.WayPoints[20]` support
2. **Complex Object References** - `object\field[index]` patterns
3. **Advanced Syntax Issues** - Select statements, expressions, type promotion

**Current Status:** ~75% of SCPB compiles successfully. The missing 25% is blocked by these three feature gaps.

**Impact:** Without these fixes, complex NPC AI, pathfinding, inventory systems, and entity relationships cannot compile.

---

## 1. Handle Arrays - Field Array Support

### Current Implementation Status

**✅ Parser Support:** The BlitzBasic parser correctly recognizes handle array syntax:
```blitzbasic
Type NPCs
    Field Path.WayPoints[20]  ; ✅ Parser accepts this
    Field Connected.NPCs[10]  ; ✅ Parser accepts this
End Type
```

**❌ Code Generation:** Handle array storage and retrieval is not implemented.

### Technical Analysis

**Root Cause:** The code generator handles scalar fields but not array fields.

**Evidence from Codebase:**
```swift
// Sources/Compiler/CodeGen/ExpressionGeneration.swift:924
if fieldDimensions != nil && !fieldDimensions!.isEmpty {
    // Returns pointer to array base, but indexing fails
    return (instrs, .i32)
}
```

**SCPB Usage Patterns:**
```blitzbasic
Type NPCs
    Field Path.WayPoints[20]      ; Navigation waypoints
    Field Inventory.Items[9]      ; Player inventory
    Field Connected.NPCs[5]       ; Entity relationships
End Type
```

### Implementation Requirements

#### 1.1 Type System Extension
**File:** `Sources/Compiler/CodeGen/TypeHandling.swift`
**Task:** Track handle array dimensions in type context
```swift
struct TypeContext {
    // Add handle array dimension tracking
    var handleArrayDimensions: [String: [String: [ExpressionNode]]] = [:]
    // [TypeName: [FieldName: dimensions]]
}
```

#### 1.2 Memory Allocation Enhancement
**File:** `Sources/Compiler/CodeGen/VariableManagement.swift`
**Task:** Allocate memory for handle arrays in type instances
```swift
func calculateTypeSize(_ typeName: String) -> Int {
    var totalSize = 0
    // Include space for handle arrays (each handle = 4 bytes)
    for (fieldName, dimensions) in handleArrayDimensions[typeName] {
        let arraySize = dimensions.reduce(1) { $0 * $1 }  // Product of dimensions
        totalSize += arraySize * 4  // 4 bytes per handle
    }
    return totalSize
}
```

#### 1.3 Array Access Code Generation
**File:** `Sources/Compiler/CodeGen/ExpressionGeneration.swift`
**Task:** Generate proper handle array indexing
```swift
func generateHandleArrayAccess(_ fieldAccess: FieldAccessNode, _ indices: [ExpressionNode]) -> [WASMInstruction] {
    var instrs: [WASMInstruction] = []

    // 1. Get array base address
    let baseInstrs = generateFieldAccess(fieldAccess)
    instrs.append(contentsOf: baseInstrs.instrs)

    // 2. Calculate offset: sum(indices[i] * stride[i])
    for (i, indexExpr) in indices.enumerated() {
        let indexInstrs = generate(indexExpr)
        instrs.append(contentsOf: indexInstrs.instrs)

        // Multiply by handle size (4 bytes)
        instrs.append(.i32Const(4))
        instrs.append(.i32Mul)

        if i > 0 {
            instrs.append(.i32Add)  // Accumulate offset
        }
    }

    // 3. Add base + offset
    instrs.append(.i32Add)

    // 4. Load/store handle value
    // For reads: instrs.append(.i32Load(2, 0))
    // For writes: additional logic needed

    return instrs
}
```

### Testing Requirements

#### Unit Tests
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

#### Integration Tests
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

---

## 2. Complex Object References

### Current Implementation Status

**✅ Basic Field Access:** `object\field` patterns work correctly
```blitzbasic
npc\Health = 100        ; ✅ Works
waypoint\X = 1.5        ; ✅ Works
```

**❌ Indexed Field Access:** `object\field[index]` patterns fail
```blitzbasic
waypoint\Connected[i] = other  ; ❌ Fails
npc\Path[index] = wp          ; ❌ Fails
```

### Technical Analysis

**Root Cause:** The AST and code generator don't support array indexing within field access expressions.

**Current AST Support:**
```swift
// Sources/Compiler/AST/AST.swift:290
case fieldAccess(FieldAccessNode, SourceSpan)  // Basic field access only

// Sources/Compiler/AST/AST.swift:396-405
public struct FieldAccessNode {
    public var object: ExpressionNode
    public var field: String
    public var span: SourceSpan
    // No support for array indexing
}
```

**Parser Limitation:**
```swift
// Sources/Compiler/Parser/Parser.swift:1603-1611
if consume(.backslash) {
    let field = currentToken.text
    // Only handles basic field access, not field[index]
    let node = FieldAccessNode(object: expr, field: field, span: span)
    expr = .fieldAccess(node, span)
}
```

### SCPB Usage Patterns

**Pathfinding Systems:**
```blitzbasic
; Waypoint connections
waypoint\Connected[0] = northWaypoint
waypoint\Connected[1] = southWaypoint

; NPC navigation
npc\Path[currentIndex] = nextWaypoint
```

**Entity Relationships:**
```blitzbasic
; MTF squad coordination
soldier\Teammates[0] = leader
soldier\Teammates[1] = partner
```

**Inventory Systems:**
```blitzbasic
; Item arrays
player\Inventory[slot] = newItem
container\Items[index] = storedItem
```

### Implementation Requirements

#### 2.1 AST Extension
**File:** `Sources/Compiler/AST/AST.swift`
**Task:** Add support for indexed field access
```swift
// Extend ExpressionNode
case indexedFieldAccess(IndexedFieldAccessNode, SourceSpan)

// New AST node
public struct IndexedFieldAccessNode {
    public var object: ExpressionNode
    public var field: String
    public var indices: [ExpressionNode]  // Support multi-dimensional
    public var span: SourceSpan
}
```

#### 2.2 Parser Enhancement
**File:** `Sources/Compiler/Parser/Parser.swift`
**Task:** Parse array indexing in field access
```swift
func parseFieldAccess() -> ExpressionNode {
    let object = parseExpression()

    while true {
        if consume(.backslash) {
            let field = parseIdentifier()

            // Check for array indexing
            var indices: [ExpressionNode] = []
            if consume(.leftBracket) {
                repeat {
                    indices.append(parseExpression())
                } while consume(.comma)
                expect(.rightBracket)
            }

            if indices.isEmpty {
                // Basic field access
                let node = FieldAccessNode(object: object, field: field, span: span)
                return .fieldAccess(node, span)
            } else {
                // Indexed field access
                let node = IndexedFieldAccessNode(object: object, field: field, indices: indices, span: span)
                return .indexedFieldAccess(node, span)
            }
        }
        break
    }

    return object
}
```

#### 2.3 Code Generation Implementation
**File:** `Sources/Compiler/CodeGen/ExpressionGeneration.swift`
**Task:** Generate indexed field access code
```swift
case .indexedFieldAccess(let access, _):
    return generateIndexedFieldAccess(access)

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

    // 4. Load value (for reads)
    switch elementType {
    case .i32: instrs.append(.i32Load(2, 0))
    case .f32: instrs.append(.f32Load(2, 0))
    case .i64: instrs.append(.i64Load(2, 0))
    case .f64: instrs.append(.f64Load(2, 0))
    default: instrs.append(.i32Load(2, 0))
    }

    return (instrs, elementType)
}
```

### Type Resolution Enhancement

**File:** `Sources/Compiler/CodeGen/TypeHandling.swift`
**Task:** Track field element types for arrays
```swift
func getFieldElementType(_ objectExpr: ExpressionNode, _ fieldName: String) -> WASMType {
    guard let typeName = getTypeName(from: objectExpr),
          let fieldType = userTypes[typeName]?.fieldTypes[fieldName] else {
        return .i32
    }

    // For array fields, return element type
    if let dimensions = fieldDimensions[typeName]?[fieldName], !dimensions.isEmpty {
        return wasmType(from: fieldType)
    }

    return wasmType(from: fieldType)
}
```

---

## 3. Advanced Syntax Issues

### 3.1 Select Statement Stack Imbalance

**Current Status:** Basic selects work, complex nested selects fail ❌

**Root Cause:** WASM validation requires all branches to leave the stack in the same state.

**Problem Code:**
```blitzbasic
Select n\NPCtype
    Case NPCtype173
        Select n\State  ; This creates nested blocks
            Case 0
                ComplexLogic()  ; May leave different stack state
            Case 1
                OtherLogic()    ; May leave different stack state
        End Select
End Select
```

**Implementation Fix:**
**File:** `Sources/Compiler/CodeGen/StatementGeneration.swift`
```swift
func generateSelectStatement(_ select: SelectNode) -> [WASMInstruction] {
    var instrs: [WASMInstruction] = []

    // Generate select expression
    let (exprInstrs, exprType) = expressionGenerator.generateWithInfo(select.expression)
    instrs.append(contentsOf: exprInstrs)

    // Store result in scratch global
    let scratchIdx = exprType == .f32 ? context.scratchGlobalFloatIdx : context.scratchGlobalIdx
    instrs.append(.globalSet(scratchIdx))

    // Generate block
    instrs.append(.block(.void, []))
    var blockInstrs: [WASMInstruction] = []

    // Generate each case
    for caseNode in select.cases {
        var caseConditionInstrs: [WASMInstruction] = []

        // Build condition: global.get == case_value
        caseConditionInstrs.append(.globalGet(scratchIdx))

        for caseValue in caseNode.values {
            switch caseValue {
            case .single(let expr):
                let (valueInstrs, _) = expressionGenerator.generateWithInfo(expr)
                caseConditionInstrs.append(contentsOf: valueInstrs)
                caseConditionInstrs.append(.i32Eq)  // Assume i32 for now
            case .range(let from, let to):
                // Range comparison logic
                // (value >= from) && (value <= to)
            }
        }

        // Generate case body
        let bodyInstrs = generateStatementList(caseNode.body)

        // Ensure consistent stack state
        let bodyStackEffect = calculateStackEffect(bodyInstrs)
        if bodyStackEffect != 0 {
            // Add drop instructions to balance stack
            for _ in 0..<abs(bodyStackEffect) {
                bodyInstrs.append(.drop)
            }
        }

        // Combine: if condition { body; br 1 }
        let ifInstrs = [.if(.void, caseConditionInstrs + bodyInstrs + [.br(1)])]
        blockInstrs.append(contentsOf: ifInstrs)
    }

    // Default case
    if let defaultBody = select.defaultCase {
        let defaultInstrs = generateStatementList(defaultBody)
        blockInstrs.append(contentsOf: defaultInstrs)
    }

    instrs.append(contentsOf: blockInstrs)
    instrs.append(.end)  // End block

    return instrs
}
```

### 3.2 Function Call Stack Issues

**Current Status:** Function calls in expressions leave return values on stack ❌

**Problem Code:**
```blitzbasic
; This fails - return value left on stack
result = GetValue() + 5

; Workaround required
temp = GetValue()
result = temp + 5
```

**Root Cause:** Statement context function calls don't drop return values.

**Implementation Fix:**
**File:** `Sources/Compiler/CodeGen/StatementGeneration.swift`
```swift
case .functionCall(let call, _):
    let (instrs, returnType) = expressionGenerator.generateWithInfo(.functionCall(call, call.span))

    var result = instrs

    // If function has return value and is used as statement, drop it
    if returnType != .void && functionDefinitions[call.name] != nil {
        let funcDef = functionDefinitions[call.name]!
        if !funcDef.results.isEmpty {
            result.append(.drop)
        }
    }

    return result
```

### 3.3 Type Promotion Issues

**Current Status:** i32/f32 mixing doesn't promote correctly ❌

**Problem Code:**
```swift
// Sources/Compiler/CodeGen/TypeHandling.swift:60
public func commonType(_ type1: WASMType, _ type2: WASMType) -> WASMType {
    return max(type1, type2)  // ❌ Wrong - i32 > f32 in enum ordering
}
```

**Evidence:**
```swift
// Sources/Compiler/CodeGen/WASM.swift:67-70
public static func < (lhs: WASMType, rhs: WASMType) -> Bool {
    let order: [WASMType] = [.i32, .f32, .i64, .f64, .v128, .void, .funcref, .externref]
    // This makes i32 > f32, breaking promotion
}
```

**Implementation Fix:**
**File:** `Sources/Compiler/CodeGen/TypeHandling.swift`
```swift
public func commonType(_ type1: WASMType, _ type2: WASMType) -> WASMType {
    // Proper type promotion rules
    if type1 == .f64 || type2 == .f64 { return .f64 }
    if type1 == .f32 || type2 == .f32 { return .f32 }
    if type1 == .i64 || type2 == .i64 { return .i64 }
    return .i32  // Default case
}

// Alternative: fix the enum ordering
public static func < (lhs: WASMType, rhs: WASMType) -> Bool {
    // Size-based ordering for promotion
    let sizeOrder: [WASMType: Int] = [
        .i32: 0, .f32: 1, .i64: 2, .f64: 3,
        .v128: 4, .void: -1, .funcref: 5, .externref: 6
    ]
    return sizeOrder[lhs, default: 0] < sizeOrder[rhs, default: 0]
}
```

---

## Implementation Priority & Timeline

### Phase 1: Critical Infrastructure (Week 1-2)
1. **Handle Arrays** - Core blocking feature
2. **Type Promotion Fix** - Fixes expression compilation errors

### Phase 2: Complex References (Week 3-4)
1. **Indexed Field Access** - Enables entity relationships
2. **Enhanced Type Resolution** - Support for complex field types

### Phase 3: Syntax Polish (Week 5-6)
1. **Select Statement Fixes** - Large function compilation
2. **Function Call Cleanup** - Stack management
3. **Advanced Expression Support** - Nested operations

### Phase 4: Testing & Validation (Week 7-8)
1. **SCPB Full Compilation** - Achieve 90%+ success rate
2. **Integration Testing** - Real gameplay scenarios
3. **Performance Optimization** - Compilation speed improvements

---

## Success Metrics

### Compilation Success Targets
- **Handle Arrays:** `Field Path.WayPoints[20]` compiles and executes correctly
- **Complex References:** `waypoint\Connected[i] = other` works in all contexts
- **Advanced Syntax:** Large SCPB functions compile without WASM validation errors
- **SCPB Coverage:** 90%+ of SCPB source files compile successfully

### Performance Targets
- **Compilation Speed:** < 2 seconds for typical SCPB files
- **WASM Size:** < 50KB overhead for runtime
- **Runtime Performance:** 60+ FPS for compiled SCPB games

---

## Risk Assessment

### High-Risk Items
1. **Handle Array Memory Management** - Complex pointer arithmetic in WASM
2. **Type System Extensions** - May require major refactoring
3. **Stack Validation** - WASM validation is strict, hard to debug

### Mitigation Strategies
1. **Incremental Implementation** - Test each feature independently
2. **Comprehensive Testing** - Unit tests + SCPB integration tests
3. **Fallback Mechanisms** - Graceful degradation for edge cases

---

## Dependencies & Prerequisites

### Required Changes
1. **AST Extensions** - New node types for indexed access
2. **Parser Updates** - Complex expression parsing
3. **Code Generation** - Multi-stage WASM instruction generation
4. **Type System** - Enhanced type tracking and promotion

### Testing Infrastructure
1. **SCPB Test Suite** - Real game code compilation
2. **Unit Tests** - Individual feature validation
3. **Integration Tests** - End-to-end compilation pipelines

---

## Conclusion

The three missing feature categories represent the final 25% needed for full SCP: Containment Breach compatibility. Implementation requires coordinated changes across the parser, AST, type system, and code generator.

**Estimated Effort:** 8 weeks of focused development
**Risk Level:** Medium (incremental approach mitigates risk)
**Impact:** Enables complete BlitzBasic-to-WebAssembly compilation pipeline

**Next Steps:**
1. Begin with handle array implementation (highest impact)
2. Fix type promotion issues (enables expression compilation)
3. Implement complex object references (enables data structures)
4. Polish advanced syntax support (enables large functions)

This roadmap will complete the Blitz3D-to-WebAssembly compiler and enable browser-based SCP: Containment Breach gameplay.

---

*Report generated by automated codebase analysis. Implementation details subject to validation during development.*