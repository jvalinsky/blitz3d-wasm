---
title: "Advanced Syntax Issues"
type: technical
audience: developer
status: draft
created: 2026-01-23
updated: 2026-01-23
related:
  - docs/compiler/gaps/compilation-gaps.md
  - docs/compiler/gaps/handle-arrays.md
  - docs/compiler/gaps/object-references.md
tags: [compiler, syntax, select-statements, expressions, type-promotion]
---

# Advanced Syntax Issues

## Overview

Advanced syntax issues involve complex BlitzBasic constructs that compile correctly in isolation but fail when used in large, nested patterns. These issues primarily affect Select statements, complex expressions, and type promotion, causing stack validation errors and runtime failures.

🔗 **Related:** [Compilation Gaps](compilation-gaps.md) | [Handle Arrays](handle-arrays.md) | [Object References](object-references.md)

## Current Implementation Status

**✅ Basic Syntax:** Simple Select statements and expressions work
**⚠️ Complex Patterns:** Large nested constructs cause WASM validation errors
**❌ Type Promotion:** i32/f32 mixing doesn't promote correctly

## Problem Statement

SCPB uses complex syntax patterns that work in small examples but fail in production code:

```blitzbasic
; This works (small)
Select n\State
    Case 1: UpdateIdle()
End Select

; This fails (large/complex)
Select n\NPCtype
    Case NPCtype173
        Select n\State  ; Stack validation fails here
            Case 0: ComplexLogic()  ; Return values not dropped
        End Select
End Select
```

**Root Cause:** WASM validation requires consistent stack states, but complex BlitzBasic patterns leave inconsistent stacks.

## Technical Issues

### 1. Select Statement Stack Imbalance

**Problem:** Large Select statements with complex Case bodies leave different stack states, causing WASM validation failures.

**Evidence:**
```blitzbasic
Select npc\NPCtype
    Case NPCtype173
        ; Complex logic that may leave values on stack
        If CheckCondition() Then  ; Function call leaves return value
            DoSomething()         ; Another function call
        EndIf
    Case NPCtype096
        ; Different complexity of operations
        SimpleAction()            ; Leaves different stack state
End Select
```

**WASM Validation Error:** `type mismatch at end of branch, expected [] but got [i32]`

**Root Cause:** Each Case branch must leave the stack in the same state, but BlitzBasic allows different operation complexity per branch.

### 2. Function Call Return Value Issues - ✅ FIXED

**Status:** **RESOLVED** - Function call return value dropping has been implemented

**Solution Implemented:**
```swift
// In StatementGeneration.swift - function call handling
if shouldDrop {
    function.body.append(.drop)  // ✅ Return values now properly dropped
}
```

**Previous Problem:**
```blitzbasic
; This failed - return value left on stack
GetValue()              ; Return value left on stack, causing validation error
UpdatePosition()        ; Stack pollution
CheckCondition()        ; Validation errors
```

**Current Status:**
```blitzbasic
; These patterns now work correctly:
GetValue()              ; ✅ Return value automatically dropped
UpdatePosition()        ; ✅ No more stack pollution
CheckCondition()        ; ✅ Clean statement execution
```

**Technical Implementation:**
- Signature-based detection of function return types
- Automatic `.drop` instruction insertion for statement-context calls
- Fallback type-based dropping for unknown functions
- Proper stack management without manual workarounds

### 3. Type Promotion Issues

**Problem:** i32/f32 arithmetic doesn't promote correctly, causing type mismatches.

**Problem Code:**
```blitzbasic
; This fails due to incorrect type promotion
Local health# = 100.0
Local damage% = 25
health = health - damage  ; i32 - f32 operation fails

; Workaround required
health = health - Float(damage)
```

**Root Cause:** The `commonType()` function uses incorrect enum ordering for type promotion.

## Implementation Requirements

### 1. Select Statement Enhancement

**File:** `Sources/Compiler/CodeGen/StatementGeneration.swift`

Implement stack state balancing for Select statements:

```swift
func generateSelectStatement(_ select: SelectNode) -> [WASMInstruction] {
    var instrs: [WASMInstruction] = []

    // Generate select expression and store in global
    let (exprInstrs, exprType) = expressionGenerator.generateWithInfo(select.expression)
    instrs.append(contentsOf: exprInstrs)

    let scratchIdx = exprType == .f32 ? context.scratchGlobalFloatIdx : context.scratchGlobalIdx
    instrs.append(.globalSet(scratchIdx))

    // Generate block structure
    instrs.append(.block(.void, []))
    var blockInstrs: [WASMInstruction] = []

    // Track maximum stack depth for each branch
    var maxStackDepth = 0

    for caseNode in select.cases {
        var caseConditionInstrs: [WASMInstruction] = []
        var caseBodyInstrs: [WASMInstruction] = []

        // Generate case condition
        caseConditionInstrs.append(.globalGet(scratchIdx))
        // ... condition generation ...

        // Generate case body
        caseBodyInstrs.append(contentsOf: generateStatementList(caseNode.body))

        // Calculate stack effect of this branch
        let branchStackEffect = calculateStackEffect(caseBodyInstrs)
        maxStackDepth = max(maxStackDepth, branchStackEffect)

        // Generate if instruction
        let ifInstrs = [.if(.void, caseConditionInstrs + caseBodyInstrs + [.br(1)])]
        blockInstrs.append(contentsOf: ifInstrs)
    }

    // Add stack balancing for all branches
    // Ensure each branch leaves the same stack state
    for _ in 0..<maxStackDepth {
        blockInstrs.append(.drop)
    }

    instrs.append(contentsOf: blockInstrs)
    instrs.append(.end)

    return instrs
}

func calculateStackEffect(_ instructions: [WASMInstruction]) -> Int {
    var stackDepth = 0
    var maxDepth = 0

    for instr in instructions {
        switch instr {
        case .i32Const, .f32Const, .i64Const, .f64Const:
            stackDepth += 1
        case .i32Load, .f32Load, .i64Load, .f64Load:
            stackDepth += 1  // Push loaded value
        case .i32Store, .f32Store, .i64Store, .f64Store:
            stackDepth -= 1  // Pop stored value
        case .drop:
            stackDepth -= 1
        case .select:
            stackDepth -= 2  // Pop condition and false value
        // ... handle other instructions
        default:
            break
        }
        maxDepth = max(maxDepth, stackDepth)
    }

    return maxDepth
}
```

### 2. Function Call Return Value Handling

**File:** `Sources/Compiler/CodeGen/StatementGeneration.swift`

Automatically drop return values from statement-context function calls:

```swift
case .functionCall(let call, _):
    let (instrs, returnType) = expressionGenerator.generateWithInfo(.functionCall(call, call.span))

    var result = instrs

    // Drop return value if function returns a value and is used as statement
    if returnType != .void {
        // Check if this function is declared to return a value
        if let funcDef = functionDefinitions[call.name],
           !funcDef.results.isEmpty {
            result.append(.drop)
        }
    }

    return result
```

### 3. Type Promotion Fix

**File:** `Sources/Compiler/CodeGen/TypeHandling.swift`

Fix the type promotion logic:

```swift
public func commonType(_ type1: WASMType, _ type2: WASMType) -> WASMType {
    // Proper type promotion rules for arithmetic operations
    if type1 == .f64 || type2 == .f64 { return .f64 }
    if type1 == .f32 || type2 == .f32 { return .f32 }
    if type1 == .i64 || type2 == .i64 { return .i64 }
    return .i32  // Default case
}

// Alternative: Fix the enum comparison order
// In WASM.swift, update the Comparable implementation
public static func < (lhs: WASMType, rhs: WASMType) -> Bool {
    // Define proper promotion order: i32 < f32 < i64 < f64
    let promotionOrder: [WASMType: Int] = [
        .i32: 0, .f32: 1, .i64: 2, .f64: 3,
        .v128: 4, .void: -1, .funcref: 5, .externref: 6
    ]
    return (promotionOrder[lhs] ?? 0) < (promotionOrder[rhs] ?? 0)
}
```

## SCPB Usage Patterns

### Complex Select Statements
```blitzbasic
; Large Select statements in NPC AI - currently fail
Function UpdateNPC(npc.NPCs)
    Select npc\NPCtype
        Case NPCtype173
            Select npc\State
                Case 0
                    ; Complex movement logic
                    If EntityVisible(npc\obj, Camera) Then
                        ; Multiple function calls
                        CalculateDirection()
                        MoveEntity(npc\obj, dx, dy, dz)
                        PlaySound(sound)
                    EndIf
                Case 1
                    ; Different complexity
                    SimpleAction()
            End Select
        Case NPCtype096
            ; Different branch complexity
            ComplexHuntingLogic()
    End Select
End Function
```

### Function Call Issues
```blitzbasic
; Function calls in expressions - currently fail
Function ComplexLogic()
    ; These work
    result = CalculateValue() + 10
    position = GetPosition()

    ; These fail - return values left on stack
    UpdatePosition()              ; Function returns value but not used
    CheckCondition()              ; Same issue

    ; Workarounds currently required
    temp = UpdatePosition()       ; Assignment consumes return value
    If CheckCondition() <> 0 Then ; Expression context consumes value
        ; Do something
    EndIf
End Function
```

### Type Promotion Issues
```blitzbasic
; Mixed type arithmetic - currently fails
Function DamageCalculation()
    Local health# = 100.0
    Local damage% = 25
    Local multiplier# = 1.5

    ; These operations fail due to type promotion issues
    health = health - damage          ; f32 - i32
    damage = damage * multiplier      ; i32 * f32
    result = CalculateBonus() + 0.5   ; Function return + float

    ; Workarounds required
    health = health - Float(damage)
    damage = Int(Float(damage) * multiplier)
End Function
```

## Implementation Plan

### Phase 1: Select Statement Fixes (Week 1)
1. Implement stack effect calculation for Select branches
2. Add automatic stack balancing with drop instructions
3. Test with complex SCPB Select statements

### Phase 2: Function Call Handling (Week 2)
1. Detect statement-context function calls
2. Automatically drop unused return values
3. Update function definition tracking

### Phase 3: Type Promotion (Week 3)
1. Fix commonType() function logic
2. Update enum comparison order if needed
3. Test mixed-type arithmetic operations

### Phase 4: Integration Testing (Week 4)
1. Test complete SCPB functions with complex syntax
2. Validate WASM output correctness
3. Performance testing with large codebases

## Testing Strategy

### Unit Tests
```swift
func testSelectStackBalancing() {
    let code = """
    Select x
        Case 1: ComplexFunction()  ; Leaves return value
        Case 2: SimpleAction()     ; Different stack state
    End Select
    """
    let wasm = compileToWASM(code)
    // Verify WASM validates and executes correctly
}

func testFunctionCallDropping() {
    let code = "UnusedFunction()  ; Should drop return value"
    let wasm = compileToWASM(code)
    // Verify .drop instruction is generated
}

func testTypePromotion() {
    let code = "result# = intVar% + floatVar#"
    let wasm = compileToWASM(code)
    // Verify proper type promotion to f32
}
```

### Integration Tests
```blitzbasic
; Test complex SCPB patterns
Function TestAdvancedSyntax()
    ; Complex Select with function calls
    Select npc\NPCtype
        Case NPCtype173
            If CheckVisibility() Then  ; Function call in condition
                MoveTowardsPlayer()   ; Function call in statement
                Play173Sound()        ; Another function call
            EndIf
        Case NPCtype096
            SimpleHunting()           ; Different complexity
    End Select

    ; Mixed type operations
    health# = health# - damage%      ; Should promote correctly
    stamina# = stamina# * multiplier#
End Function
```

## Success Criteria

- **Select Statements:** Complex nested Select statements compile without WASM validation errors
- **Function Calls:** Statement-context function calls automatically drop return values
- **Type Promotion:** i32/f32 arithmetic operations promote correctly
- **SCPB Compatibility:** Large SCPB functions with complex syntax compile successfully
- **Performance:** No significant compilation overhead for syntax fixes

## Dependencies

- **WASM Validation:** Requires accurate stack effect calculation
- **Function Tracking:** Needs function definition information for return type detection
- **Type System:** Depends on existing type information for promotion logic
- **Parser:** Complex expressions must be parsed correctly

## Risk Assessment

### Low Risk
- **Select Balancing:** Stack effect calculation is well-understood
- **Function Dropping:** Straightforward pattern matching and code generation
- **Backward Compatibility:** Changes don't break existing working code

### Medium Risk
- **Type Promotion:** May require changes to enum ordering with broader impact
- **Stack Analysis:** Complex for deeply nested expressions
- **Performance:** Stack balancing may add compilation overhead

## Related Work

- **Compilation Gaps:** Part of the three main blocking issues
- **Handle Arrays:** Often used together in complex NPC logic
- **Object References:** Complex field access patterns compound these issues
- **SCPB Compatibility:** Critical for AI systems and game logic

---

*Advanced syntax fixes address the "last mile" issues preventing full SCPB compilation, enabling complex game logic and AI systems that currently fail due to WASM validation and type system limitations.*