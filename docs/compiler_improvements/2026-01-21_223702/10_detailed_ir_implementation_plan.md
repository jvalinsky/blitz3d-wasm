# Detailed Plan: Typed IR Implementation - Next Steps

## Current State

| Component | Status | Notes |
|-----------|--------|-------|
| IR Types (Types.swift) | ✅ Complete | `IRType` enum (i32, f32, void) |
| IR Nodes (IR.swift) | ✅ Complete | `IRValue`, `IREffect`, `IRBuilder` (with `indirect`) |
| AST Lowering (ASTLowering.swift) | ✅ Complete | AST → IR, Case-insensitive, Arrays, Loops, Globals, Strings |
| ParserTests.swift | ✅ Fixed | All 30 tests passing |
| IR → WASM Emitter | ✅ Complete | `IREmitter.swift` handles loops, arrays, strings |
| Wire into CodeGenerator | ✅ Integrated | `generateFromIR()` added |
| CLI Flag (--use-ir) | ✅ Added | Enabled in `main.swift` |
| IRPipelineTests | ✅ Verified | 8/8 tests passing (including Deduplication) |
| WASMValidationTests | ✅ Fixed | 39/39 tests passing |

## Decision Pending: Integration Strategy

**Decision 9**: Choose IR Integration Strategy
- Option 10: Parallel Pipeline (Opt-in) - Lower risk
- Option 11: Replace Primary Codegen - Cleaner but higher risk

## Detailed Execution Plan

### Phase 1: Fix Tests and Verify IR Foundation (IMMEDIATE)

#### Step 1.1: Fix ParserTests.swift Syntax Errors
**Action 12** | Priority: HIGH | Confidence: 90%

**Problem**: ParserTests.swift uses deprecated Swift pattern matching:
```swift
// BROKEN (deprecated)
if case .constant(let decl) = program.statements[0] {
    if case .integerLiteral(let value) = decl.value {
```

**FIXED** (correct syntax with tuple pattern matching):
```swift
// CORRECT
if case .constant(let (decl, _)) = program.statements[0] {
    if case .integerLiteral(let (value, _)) = decl.value {
```

**Affected Test Methods** (need manual fixing):
1. `testParseIntegerLiteral` - lines 16-17
2. `testParseFloatLiteral` - lines 32-33
3. `testParseStringLiteral` - lines 48-49
4. `testParseIdentifier` - lines 64-65
5. `testParseBinaryExpression` - lines 80-81
6. `testParseAssignment` - lines 96-97
7. `testParseLocalDeclaration` - lines 112-113
8. `testParseGlobalDeclaration` - lines 126-129
9. `testParseConstant` - lines 140-141
10. `testParseIfStatement` - lines 152-158
11. `testParseWhileLoop` - lines 169-170
12. `testParseForLoop` - lines 181-183
13. `testParseForLoopWithStep` - lines 194-195
14. `testParseRepeatUntil` - lines 206-207
15. `testParseFunctionWithBody` - lines 229-230
16. `testParseFieldAccess` - lines 249-250
17. `testParseFunctionCall` - lines 265-267
18. `testParseArrayAccess` - lines 278-279
19. `testParseReturnStatement` - lines 294-295
20. `testParseReturnWithoutValue` - lines 310-311
21. `testParseComplexExpression` - lines 334-335
22. `testParseComparison` - lines 350-351
23. `testParseNotExpression` - lines 373-374
24. `testParseGoto` - lines 396-397
25. `testParseGosub` - lines 408-409

**Verification**:
```bash
cd /Users/jack/Software/scp_port/blitz3d-wasm
swift test --test-product Blitz3DCompilerPackageTests --filter ParserTests
# Should pass without deprecated syntax warnings
```

#### Step 1.2: Create IR Type Tests
**New Action** | Priority: HIGH | Confidence: 95%

**Deliverable**: `Tests/CompilerTests/IRTests/IRTypeTests.swift`

**Test Cases**:
```swift
func testIRTypeEquality() {
    XCTAssertEqual(IRType.i32, IRType.i32)
    XCTAssertEqual(IRType.f32, IRType.f32)
    XCTAssertNotEqual(IRType.i32, IRType.f32)
}

func testIRTypeIsValue() {
    XCTAssertTrue(IRType.i32.isValue)
    XCTAssertTrue(IRType.f32.isValue)
    XCTAssertFalse(IRType.void.isValue)
}

func testIRTypeDescription() {
    XCTAssertEqual(IRType.i32.description, "i32")
    XCTAssertEqual(IRType.f32.description, "f32")
    XCTAssertEqual(IRType.void.description, "void")
}
```

**Verification**:
```bash
swift test --test-product Blitz3DCompilerPackageTests --filter IRTypeTests
```

#### Step 1.3: Create IR Builder Tests
**New Action** | Priority: HIGH | Confidence: 90%

**Deliverable**: `Tests/CompilerTests/IRTests/IRBuilderTests.swift`

**Test Cases**:
```swift
func testBuildConstI32() {
    let value = builder.buildConstI32(42)
    if case .constI32(let intVal) = value {
        XCTAssertEqual(intVal, 42)
    }
}

func testBuildBinary() {
    let lhs = builder.buildConstI32(10)
    let rhs = builder.buildConstI32(5)
    let result = builder.buildBinary("Add", lhs: lhs, rhs: rhs, resultType: .i32)
    // Verify result is binary with correct operands
}

func testBuildIfStatement() {
    let condition = builder.buildConstI32(1)
    let thenBody: [IREffect] = [.nop]
    let elseBody: [IREffect]? = nil
    let ifEffect = builder.buildIf(condition, then: thenBody, else: elseBody)
    // Verify if effect structure
}
```

**Verification**:
```bash
swift test --test-product Blitz3DCompilerPackageTests --filter IRBuilderTests
```

### Phase 2: Create IR → WASM Emitter

#### Step 2.1: Design IREmitter Interface
**New Action** | Priority: HIGH | Confidence: 85%

**Deliverable**: `Sources/Compiler/CodeGen/IREmitter.swift`

**Interface Design**:
```swift
public class IREmitter {
    private var context: ModuleContext
    private var function: WASMFunction?
    
    public init(context: ModuleContext) {
        self.context = context
    }
    
    public func emit(module: IRModule) -> WASMModule {
        // Emit all functions, globals, imports
    }
    
    private func emit(function: IRFunction) -> WASMFunction {
        // Emit single function
    }
    
    private func emit(effect: IREffect, into function: inout WASMFunction) {
        // Emit statement effect to WASM instructions
    }
    
    private func emit(value: IRValue) -> [WASMInstruction] {
        // Emit expression value to WASM instructions
    }
}
```

**Key Invariants**:
- `emit(effect:)` never changes stack height
- `emit(value:)` pushes exactly one value of `value.type`
- `Discard(value)` emits `drop` only if `value.type != .void`

#### Step 2.2: Implement IREmitter for Basic Types
**New Action** | Priority: HIGH | Confidence: 85%

**Emit Logic**:
```swift
// IRValue → WASMInstruction[]
case .constI32(let value):
    return [.i32Const(value)]
case .constF32(let value):
    return [.f32Const(value)]
case .localGet(let index, let type):
    switch type {
    case .i32: return [.localGet(index)]
    case .f32: return [.f32Const(0)] // Placeholder
    case .void: return []
    }
case .binary(let op, let lhs, let rhs, let resultType):
    var instrs = emit(value: lhs)
    instrs.append(contentsOf: emit(value: rhs))
    switch (op, resultType) {
    case ("Add", .i32): instrs.append(.i32Add)
    case ("Add", .f32): instrs.append(.f32Add)
    case ("Sub", .i32): instrs.append(.i32Sub)
    case ("Sub", .f32): instrs.append(.f32Sub)
    // ... more operations
    }
    return instrs
```

#### Step 2.3: Implement IREmitter for Control Flow
**New Action** | Priority: HIGH | Confidence: 80%

**Emit Logic**:
```swift
case .ifStmt(let condition, let thenBody, let elseBody):
    var instrs = emit(value: condition)
    instrs.append(.i32EqZ) // Convert condition to boolean
    
    var thenInstrs: [WASMInstruction] = []
    for effect in thenBody {
        emit(effect: effect, into: &thenInstrs)
    }
    
    var elseInstrs: [WASMInstruction]?
    if let elseBody = elseBody {
        elseInstrs = []
        for effect in elseBody {
            emit(effect: effect, into: &elseInstrs!)
        }
    }
    
    instrs.append(.if(.void, thenInstrs, elseInstrs))
    return instrs
```

### Phase 3: Wire IR Pipeline into CodeGenerator

#### Step 3.1: Add IR Generation Path
**Action 8** | Priority: HIGH | Confidence: 75%

**Modifications to `CodeGenerator.swift`**:

```swift
public func generate(from program: ProgramNode) -> WASMModule {
    // Existing path: Direct AST → WASM
    // if useIRPipeline {
    //     return generateViaIR(program)
    // }
    return generateDirect(program)
}

private func generateViaIR(_ program: ProgramNode) -> WASMModule {
    let lowering = ASTLowering()
    let irModule = lowering.lower(program)
    
    let emitter = IREmitter(context: self)
    return emitter.emit(module: irModule)
}
```

#### Step 3.2: Add CLI Flag
**New Action** | Priority: MEDIUM | Confidence: 90%

**Modifications to `Tools/wasm-cli/main.swift`**:

```swift
var useIRPipeline = false
if arguments.contains("--use-ir") {
    useIRPipeline = true
}
// Pass to CodeGenerator
var codeGen = CodeGenerator()
codeGen.useIRPipeline = useIRPipeline
```

### Phase 4: Integration Testing

#### Step 4.1: Test Simple Programs
**New Action** | Priority: HIGH | Confidence: 90%

**Test Cases**:
```swift
// test_ir_simple.bb
Local x% = 42
Local y% = x% + 10
Return y%
```

**Verification**:
```bash
# Test with IR pipeline
swift run blitz3d-wasm test_ir_simple.bb --use-ir -o /tmp/test.wasm
wasm-validate /tmp/test.wasm
```

#### Step 4.2: Test Control Flow
**New Action** | Priority: HIGH | Confidence: 85%

**Test Cases**:
```swift
# test_ir_if.bb
Local x% = 10
If x% > 5 Then
    Return 1
Else
    Return 0
EndIf
```

**Verification**:
```bash
swift run blitz3d-wasm test_ir_if.bb --use-ir -o /tmp/test.wasm
wasm-validate /tmp/test.wasm
```

#### Step 4.3: Test SCPCB UpdateEvents.bb
**New Action** | Priority: HIGH | Confidence: 70%

**Verification**:
```bash
swift run blitz3d-wasm ../scpcb/UpdateEvents.bb --use-ir -o /tmp/test.wasm
wasm-validate /tmp/test.wasm
```

### Success Criteria

| Criterion | Target | Measurement |
|-----------|--------|-------------|
| Tests Compile | 100% | `swift test --filter ParserTests` passes |
| IR Type Tests | 3/3 pass | `swift test --filter IRTypeTests` |
| IR Builder Tests | 5/5 pass | `swift test --filter IRBuilderTests` |
| Simple Program | Validates | `wasm-validate` passes |
| Control Flow | Validates | `wasm-validate` passes |
| SCPCB UpdateEvents | Validates | `wasm-validate` passes |

### Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| ParserTests syntax errors | HIGH | Manual fixing of each test method |
| IR → WASM emission bugs | HIGH | Incremental testing (simple → complex) |
| Stack validation failures | HIGH | Use `StackValidator` on output |
| Performance regression | MEDIUM | Benchmark before/after with --use-ir flag |

### Estimated Timeline

| Phase | Effort | Duration |
|-------|--------|----------|
| Phase 1: Fix Tests + IR Tests | 2-3 hours | Day 1 |
| Phase 2: IREmitter | 4-6 hours | Day 2 |
| Phase 3: Wire into CodeGenerator | 2-3 hours | Day 3 |
| Phase 4: Integration Testing | 2-4 hours | Day 3-4 |
| **Total** | **10-16 hours** | **4 days** |
