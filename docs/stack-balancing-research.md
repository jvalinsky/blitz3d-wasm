# Stack Balancing Research: Comprehensive Algorithm Documentation

## Table of Contents
1. [Option A: WASM Spec 3-Stack Validator](#option-a-wasm-spec-3-stack-validator)
2. [Option B: SSA-Based Stackification](#option-b-ssa-based-stackification)
3. [Option C: Koopman's Intra-Block Scheduler](#option-c-koopmans-intra-block-scheduler)
4. [Comparison Matrix](#comparison-matrix)
5. [Recommendation](#recommendation)

---

# Option A: WASM Spec 3-Stack Validator

## Background

The WebAssembly specification defines a validation algorithm in [Appendix A](https://webassembly.github.io/spec/core/appendix/algorithm.html) that verifies type safety and stack balance. This algorithm is what every WASM runtime uses to validate modules before execution.

The key insight: **if you track types during code generation the same way the validator does, you can detect imbalances immediately and fix them**.

## The Three Stacks

### 1. Value Stack (`vals`)

Tracks the **types** of values currently on the operand stack.

```
vals: [StackValueType]

enum StackValueType {
    case i32, i64, f32, f64
    case bot    // "Bottom" type - matches anything (for unreachable code)
}
```

**Purpose**: Know exactly what types are on the stack at any point. When you push `i32.const 5`, the validator pushes `.i32` to vals. When you execute `i32.add`, it pops two `.i32` and pushes one `.i32`.

### 2. Control Stack (`ctrls`)

Tracks **block nesting** - each block/loop/if creates a frame.

```
ctrls: [ControlFrame]

struct ControlFrame {
    opcode: String          // "function", "block", "loop", "if"
    startTypes: [Type]      // Parameters to block (usually empty in WASM 1.0)
    endTypes: [Type]        // Results the block must produce
    valHeight: Int          // Value stack height when block was entered
    initHeight: Int         // Init stack height when block was entered
    unreachable: Bool       // Is code after a br/return unreachable?
}
```

**Purpose**: Know the "floor" of the stack (can't pop below valHeight), and know what types must remain when the block ends.

### 3. Initialization Stack (`inits`)

Tracks which **local variables have been assigned**.

```
inits: Set<Int>  // Indices of initialized locals
```

**Purpose**: Catch use-before-initialization errors. In WASM 2.0+ with non-defaultable types, this prevents reading garbage values.

## Core Operations

### Value Stack Operations

```swift
/// Push a type onto the value stack
func pushVal(_ type: StackValueType) {
    vals.append(type)
}

/// Pop a value, returning its type
/// Returns .bot if unreachable and stack is at frame boundary (polymorphic)
func popVal() -> StackValueType {
    guard let frame = ctrls.first else { fatalError("No control frame") }

    // Polymorphic stack: if unreachable and at frame boundary, return Bot
    if vals.count == frame.valHeight && frame.unreachable {
        return .bot
    }

    // Underflow check
    if vals.count <= frame.valHeight {
        error("Stack underflow")
        return .bot
    }

    return vals.removeLast()
}

/// Pop and verify type matches expected
func popVal(expect: StackValueType) -> StackValueType {
    let actual = popVal()

    // Bot matches anything (polymorphic in unreachable code)
    if actual != .bot && expect != .bot && actual != expect {
        error("Type mismatch: expected \(expect), got \(actual)")
    }

    return actual
}

/// Push multiple types
func pushVals(_ types: [StackValueType]) {
    for t in types { pushVal(t) }
}

/// Pop multiple types (in reverse order!)
func popVals(_ types: [StackValueType]) -> [StackValueType] {
    var result: [StackValueType] = []
    for t in types.reversed() {
        result.insert(popVal(expect: t), at: 0)
    }
    return result
}
```

### Control Stack Operations

```swift
/// Enter a new block
func pushCtrl(opcode: String, startTypes: [StackValueType], endTypes: [StackValueType]) {
    let frame = ControlFrame(
        opcode: opcode,
        startTypes: startTypes,
        endTypes: endTypes,
        valHeight: vals.count,      // Current stack height becomes "floor"
        initHeight: inits.count,
        unreachable: false
    )
    ctrls.insert(frame, at: 0)      // Push to front (index 0 = current)
    pushVals(startTypes)             // Block params go on stack
}

/// Exit current block
func popCtrl() -> ControlFrame {
    guard let frame = ctrls.first else { fatalError("No control frame") }

    popVals(frame.endTypes)          // Verify results are on stack

    if vals.count != frame.valHeight {
        error("Stack height mismatch: expected \(frame.valHeight), got \(vals.count)")
        // FIX: Insert drops for excess values
        while vals.count > frame.valHeight {
            vals.removeLast()
            // --> INSERT .drop instruction here <--
        }
    }

    resetLocals(to: frame.initHeight)
    return ctrls.removeFirst()
}

/// Get the label types for a branch to depth n
/// For loops: branch goes to start, so use startTypes
/// For others: branch goes to end, so use endTypes
func labelTypes(_ frame: ControlFrame) -> [StackValueType] {
    return frame.opcode == "loop" ? frame.startTypes : frame.endTypes
}
```

### Unreachable Code Handling

```swift
/// Mark current block as unreachable (after br, return, unreachable)
func unreachable() {
    guard var frame = ctrls.first else { return }

    // Clear stack down to frame height
    while vals.count > frame.valHeight {
        vals.removeLast()
    }

    frame.unreachable = true
    ctrls[0] = frame
}
```

**Why this matters**: After a `br` or `return`, any following code is dead. The stack becomes "polymorphic" - it can pretend to have any types needed. This prevents spurious errors in dead code.

## Instruction Validation

### Constants
```swift
case .i32Const(_): pushVal(.i32)
case .i64Const(_): pushVal(.i64)
case .f32Const(_): pushVal(.f32)
case .f64Const(_): pushVal(.f64)
```

### Binary Operations
```swift
// i32.add: [i32 i32] -> [i32]
case .i32Add, .i32Sub, .i32Mul, .i32DivS, .i32DivU:
    popVal(expect: .i32)
    popVal(expect: .i32)
    pushVal(.i32)

// f32.add: [f32 f32] -> [f32]
case .f32Add, .f32Sub, .f32Mul, .f32Div:
    popVal(expect: .f32)
    popVal(expect: .f32)
    pushVal(.f32)
```

### Comparisons
```swift
// i32.eq: [i32 i32] -> [i32]  (returns 0 or 1)
case .i32Eq, .i32Ne, .i32LtS, .i32GtS, .i32LeS, .i32GeS:
    popVal(expect: .i32)
    popVal(expect: .i32)
    pushVal(.i32)

// f32.lt: [f32 f32] -> [i32]  (comparison returns i32!)
case .f32Lt, .f32Gt, .f32Le, .f32Ge:
    popVal(expect: .f32)
    popVal(expect: .f32)
    pushVal(.i32)  // <-- Note: i32, not f32!
```

### Conversions
```swift
// i32.trunc_f32_s: [f32] -> [i32]
case .i32TruncF32S:
    popVal(expect: .f32)
    pushVal(.i32)

// f32.convert_i32_s: [i32] -> [f32]
case .f32ConvertI32S:
    popVal(expect: .i32)
    pushVal(.f32)
```

### Locals
```swift
// local.get $idx: [] -> [type_of_local]
case .localGet(let idx):
    if !inits.contains(idx) {
        error("Local \(idx) used before initialization")
    }
    pushVal(localTypes[idx])  // Need type context!

// local.set $idx: [type_of_local] -> []
case .localSet(let idx):
    popVal(expect: localTypes[idx])
    inits.insert(idx)

// local.tee $idx: [type] -> [type]  (like set but keeps value)
case .localTee(let idx):
    let t = popVal(expect: localTypes[idx])
    pushVal(t)
    inits.insert(idx)
```

### Memory Operations
```swift
// i32.load: [i32] -> [i32]  (address -> value)
case .i32Load:
    popVal(expect: .i32)  // address
    pushVal(.i32)

// i32.store: [i32 i32] -> []  (address, value -> nothing)
case .i32Store:
    popVal(expect: .i32)  // value
    popVal(expect: .i32)  // address
```

### Control Flow

```swift
// block [t*] -> [t*]
case .block(let resultType, let body):
    let endTypes = resultType == .void ? [] : [resultType.toStackType()]
    pushCtrl("block", startTypes: [], endTypes: endTypes)
    // validate body...
    popCtrl()
    pushVals(endTypes)

// loop [t*] -> [t*]
case .loop(let resultType, let body):
    let endTypes = resultType == .void ? [] : [resultType.toStackType()]
    pushCtrl("loop", startTypes: [], endTypes: endTypes)
    // validate body...
    popCtrl()
    pushVals(endTypes)

// if [t*] -> [t*]
case .if(let resultType, let thenBody, let elseBody):
    popVal(expect: .i32)  // condition
    let endTypes = resultType == .void ? [] : [resultType.toStackType()]
    pushCtrl("if", startTypes: [], endTypes: endTypes)
    // validate thenBody...
    if let elseBody = elseBody {
        // switch to else
        let frame = ctrls[0]
        // Reset to start of if
        while vals.count > frame.valHeight {
            vals.removeLast()
        }
        ctrls[0].unreachable = false
        // validate elseBody...
    }
    popCtrl()
    pushVals(endTypes)
```

### Branches

```swift
// br $label: [t*] -> unreachable
case .br(let depth):
    if depth >= ctrls.count {
        error("Invalid branch depth")
    } else {
        let frame = ctrls[depth]
        popVals(labelTypes(frame))
        unreachable()
    }

// br_if $label: [t* i32] -> [t*]
case .brIf(let depth):
    popVal(expect: .i32)  // condition
    if depth >= ctrls.count {
        error("Invalid branch depth")
    } else {
        let frame = ctrls[depth]
        let types = labelTypes(frame)
        popVals(types)
        pushVals(types)  // Push back for fall-through
    }

// return: [t*] -> unreachable
case .return:
    // Pop function return types (from outermost frame)
    let funcFrame = ctrls.last!
    popVals(funcFrame.endTypes)
    unreachable()
```

### Function Calls

```swift
// call $func: [param_types] -> [result_types]
case .call(let funcIdx):
    let sig = functionSignatures[funcIdx]
    popVals(sig.params.map { $0.toStackType() })
    pushVals(sig.results.map { $0.toStackType() })
```

## Integration Strategy

### Where to Hook In

1. **ExpressionGeneration.generateWithInfo()**: After generating instructions, validate them
2. **StatementGeneration.generateStatement()**: At block boundaries, check balance
3. **FunctionGeneration.generateFunction()**: Reset validator at start, check at end

### Auto-Fix: Inserting Drops

When `popCtrl()` detects excess values:

```swift
func popCtrl() -> (frame: ControlFrame, drops: Int) {
    let frame = ctrls[0]
    popVals(frame.endTypes)

    let excessValues = vals.count - frame.valHeight
    if excessValues > 0 {
        // Report and track how many drops needed
        for _ in 0..<excessValues {
            vals.removeLast()
        }
    }

    ctrls.removeFirst()
    return (frame, excessValues)
}

// In code generation:
let (frame, drops) = validator.popCtrl()
for _ in 0..<drops {
    instructions.append(.drop)
}
```

### Balancing If/Else Branches

Both branches must have the same stack effect:

```swift
func balanceIfBranches(thenInstrs: inout [WASMInstruction],
                       elseInstrs: inout [WASMInstruction]) {
    // Validate then branch
    let thenValidator = StackValidator()
    for instr in thenInstrs {
        thenValidator.validateInstruction(instr)
    }
    let thenDepth = thenValidator.stackDepth

    // Validate else branch
    let elseValidator = StackValidator()
    for instr in elseInstrs {
        elseValidator.validateInstruction(instr)
    }
    let elseDepth = elseValidator.stackDepth

    // Balance to match
    if thenDepth > elseDepth {
        for _ in 0..<(thenDepth - elseDepth) {
            thenInstrs.append(.drop)
        }
    } else if elseDepth > thenDepth {
        for _ in 0..<(elseDepth - thenDepth) {
            elseInstrs.append(.drop)
        }
    }
}
```

---

# Option B: SSA-Based Stackification

## Background

Static Single Assignment (SSA) form is the dominant IR in modern compilers. Each variable is assigned exactly once, making dataflow analysis trivial. Production WASM compilers (LLVM, Binaryen, Waffle) use SSA internally.

The insight from ["WebAssembly Is Not a Stack Machine"](https://news.ycombinator.com/item?id=33093897): WASM's locals are mutable, defeating SSA benefits. The solution is to use SSA internally and only emit locals for values that truly need them.

## SSA IR Design

### Value Representation

```swift
/// Unique identifier for each computed value
struct SSAValue: Hashable {
    let id: Int
    let type: WASMType
}

/// A use of a value
struct SSAUse {
    let value: SSAValue
    let operandIndex: Int
}
```

### Operations

```swift
enum SSAOpKind {
    // Constants
    case i32Const(Int32)
    case f32Const(Float)

    // Arithmetic
    case add(SSAValue, SSAValue)
    case sub(SSAValue, SSAValue)
    case mul(SSAValue, SSAValue)

    // Memory
    case load(address: SSAValue, offset: Int)
    case store(address: SSAValue, value: SSAValue, offset: Int)

    // Calls
    case call(funcIdx: Int, args: [SSAValue])

    // Control flow (produces blockparams for successors)
    case branch(target: BlockID, args: [SSAValue])
    case condBranch(cond: SSAValue, ifTrue: BlockID, ifFalse: BlockID)
}

struct SSAOp {
    let result: SSAValue?   // nil for void operations (store, branch)
    let kind: SSAOpKind
}
```

### Blocks (CFG Nodes)

```swift
struct SSABlock {
    let id: BlockID
    var params: [SSAValue]      // "Block parameters" - like phi inputs
    var ops: [SSAOp]
    var terminator: SSATerminator
}

enum SSATerminator {
    case ret([SSAValue])
    case br(BlockID, args: [SSAValue])
    case brIf(cond: SSAValue, ifTrue: BlockID, ifFalse: BlockID, args: [SSAValue])
    case brTable(index: SSAValue, targets: [(BlockID, [SSAValue])], default: (BlockID, [SSAValue]))
}
```

### Block Parameters vs Phi Nodes

Traditional SSA uses phi nodes at merge points:
```
BB2:
  %x = phi [%a, BB0], [%b, BB1]
```

Block parameters are equivalent but cleaner:
```
BB2(%x):
  use %x

BB0:
  br BB2(%a)

BB1:
  br BB2(%b)
```

## Conversion Pipeline

### Phase 1: AST to SSA

```swift
class SSABuilder {
    var nextValueId = 0
    var blocks: [BlockID: SSABlock] = [:]
    var currentBlock: BlockID

    // Track current definition of each variable
    var variableDefs: [String: SSAValue] = [:]

    func newValue(type: WASMType) -> SSAValue {
        defer { nextValueId += 1 }
        return SSAValue(id: nextValueId, type: type)
    }

    func emit(_ kind: SSAOpKind, resultType: WASMType?) -> SSAValue? {
        let result = resultType.map { newValue(type: $0) }
        blocks[currentBlock]!.ops.append(SSAOp(result: result, kind: kind))
        return result
    }

    func convertExpression(_ expr: ExpressionNode) -> SSAValue {
        switch expr {
        case .literal(let value):
            return emit(.i32Const(value), resultType: .i32)!

        case .variable(let name):
            return variableDefs[name]!  // Look up current SSA value

        case .binary(let op, let left, let right):
            let l = convertExpression(left)
            let r = convertExpression(right)
            return emit(.add(l, r), resultType: l.type)!

        case .call(let name, let args):
            let argVals = args.map { convertExpression($0) }
            let funcIdx = lookupFunction(name)
            let resultType = functionReturnType(funcIdx)
            return emit(.call(funcIdx: funcIdx, args: argVals), resultType: resultType)!
        }
    }

    func convertAssignment(_ name: String, _ value: ExpressionNode) {
        let ssaValue = convertExpression(value)
        variableDefs[name] = ssaValue  // Update current def
    }
}
```

### Phase 2: Structured Control Flow Recovery

Convert arbitrary CFG back to WASM's structured control flow.

**Ramsey's Algorithm** (used by Waffle):

```swift
func recoverStructuredControlFlow(_ cfg: CFG) -> WASMBody {
    // Identify loop headers (blocks that are targets of back-edges)
    let loopHeaders = findLoopHeaders(cfg)

    // Identify merge points (blocks with multiple predecessors)
    let mergePoints = findMergePoints(cfg)

    // Build dominator tree
    let domTree = buildDominatorTree(cfg)

    // Emit structured code by traversing dominator tree
    return emitStructured(cfg.entry, domTree, loopHeaders, mergePoints)
}

func emitStructured(_ block: BlockID, ...) -> [WASMInstruction] {
    var result: [WASMInstruction] = []

    if loopHeaders.contains(block) {
        // This is a loop header - emit loop construct
        result.append(.loop(.void, body: emitLoopBody(block)))
    }

    // Emit block contents
    result += emitBlockOps(block)

    // Handle terminator
    switch cfg[block].terminator {
    case .br(let target, _):
        if isBackEdge(block, target) {
            result.append(.br(loopDepth(target)))
        } else if target == nextBlock {
            // Fall through
        } else {
            result.append(.br(blockDepth(target)))
        }

    case .brIf(let cond, let ifTrue, let ifFalse, _):
        result.append(.if(.void,
            then: emitStructured(ifTrue, ...),
            else: emitStructured(ifFalse, ...)))
    }

    return result
}
```

### Phase 3: Treeification (Value Scheduling)

Decide which values go on the stack vs into locals.

**Rule**: A value can be "stackified" (computed directly onto the stack) IFF:
1. It's used exactly once
2. Its use is the next instruction

```swift
struct Treeifier {
    var useCounts: [SSAValue: Int] = [:]

    func analyze(_ block: SSABlock) {
        // Count uses of each value
        for op in block.ops {
            for use in op.kind.uses() {
                useCounts[use, default: 0] += 1
            }
        }
    }

    func canStackify(_ value: SSAValue, at index: Int, in block: SSABlock) -> Bool {
        // Must be used exactly once
        guard useCounts[value] == 1 else { return false }

        // Must be defined immediately before use
        guard index > 0 else { return false }
        let prevOp = block.ops[index - 1]
        return prevOp.result == value
    }
}
```

**Tree Building** (from [Evan Wallace's algorithm](https://gist.github.com/evanw/58a8a5b8b4a1da32fcdcfbf9da87c82a)):

```swift
/// Tree representation for stackified code
indirect enum Tree {
    case const(Int32)
    case local(Int)
    case binop(String, Tree, Tree)
    case call(Int, [Tree])
}

func stackify(_ block: SSABlock) -> [Either<Tree, SSAOp>] {
    var result: [Either<Tree, SSAOp>] = []
    var treeCache: [SSAValue: Tree] = [:]

    // Process backwards
    for i in (0..<block.ops.count).reversed() {
        let op = block.ops[i]

        if let result = op.result, useCounts[result] == 1 {
            // Single use - can be inlined as a tree
            let tree = buildTree(op, treeCache)
            treeCache[result] = tree
        } else {
            // Multiple uses or side effects - emit as separate instruction
            result.insert(.right(op), at: 0)
        }
    }

    return result
}

func buildTree(_ op: SSAOp, _ cache: [SSAValue: Tree]) -> Tree {
    switch op.kind {
    case .i32Const(let v):
        return .const(v)
    case .add(let a, let b):
        let treeA = cache[a] ?? .local(localFor(a))
        let treeB = cache[b] ?? .local(localFor(b))
        return .binop("add", treeA, treeB)
    // ... etc
    }
}
```

### Phase 4: Localification (Register Allocation)

Assign locals to values that can't be stackified.

**Linear Scan Algorithm**:

```swift
struct LiveRange {
    let value: SSAValue
    let start: Int  // First use/def
    let end: Int    // Last use
}

func allocateLocals(_ block: SSABlock) -> [SSAValue: Int] {
    // Build live ranges
    var ranges: [LiveRange] = []
    for (i, op) in block.ops.enumerated() {
        if let result = op.result, useCounts[result]! > 1 {
            let end = findLastUse(result, in: block)
            ranges.append(LiveRange(value: result, start: i, end: end))
        }
    }

    // Sort by start point
    ranges.sort { $0.start < $1.start }

    // Linear scan allocation
    var assignment: [SSAValue: Int] = [:]
    var active: [(range: LiveRange, local: Int)] = []
    var freeLocals: [Int] = []
    var nextLocal = 0

    for range in ranges {
        // Expire old ranges
        active = active.filter { $0.range.end > range.start }
        for expired in active.filter({ $0.range.end <= range.start }) {
            freeLocals.append(expired.local)
        }

        // Allocate
        let local: Int
        if let free = freeLocals.popLast() {
            local = free
        } else {
            local = nextLocal
            nextLocal += 1
        }

        assignment[range.value] = local
        active.append((range, local))
    }

    return assignment
}
```

### Phase 5: WASM Emission

```swift
func emitWASM(_ tree: Tree) -> [WASMInstruction] {
    switch tree {
    case .const(let v):
        return [.i32Const(v)]
    case .local(let idx):
        return [.localGet(idx)]
    case .binop("add", let a, let b):
        return emitWASM(a) + emitWASM(b) + [.i32Add]
    case .call(let idx, let args):
        return args.flatMap { emitWASM($0) } + [.call(idx)]
    }
}
```

## Why SSA Guarantees Balance

With SSA + treeification:
- Every value is either on the stack (single-use, immediately consumed) or in a local
- Block boundaries automatically balance because structured control flow + blockparams handle merge points
- No possibility of "leftover" values - everything is explicitly consumed or stored

---

# Option C: Koopman's Intra-Block Scheduler

## Background

Philip Koopman's 1994 paper ["A Preliminary Exploration of Optimized Stack Code Generation"](https://users.ece.cmu.edu/~koopman/stack_compiler/stack_co.html) addresses a different problem: reducing redundant local variable loads within basic blocks.

**Key distinction**: This algorithm assumes code is already correct and balanced. It optimizes; it doesn't fix.

## The Problem It Solves

Consider this code:
```
a = x + 1
b = a + x   ; x is loaded again, redundantly
c = b + x   ; x is loaded AGAIN
```

Naive compilation:
```
local.get $x     ; load x
i32.const 1
i32.add
local.set $a     ; store a

local.get $a     ; load a
local.get $x     ; load x (REDUNDANT - we had it earlier!)
i32.add
local.set $b

local.get $b
local.get $x     ; load x (REDUNDANT again!)
i32.add
local.set $c
```

With stack scheduling, x could stay on the stack between uses, eliminating 2 loads.

## Algorithm Details

### Phase 1: Use-Reuse Analysis

```swift
struct VariableAccess {
    let variable: String
    let instructionIndex: Int
    let isRead: Bool
    let stackDepthBefore: Int
}

func analyzeBlock(_ block: [Instruction]) -> [VariableAccess] {
    var accesses: [VariableAccess] = []
    var stackDepth = 0

    for (i, instr) in block.enumerated() {
        switch instr {
        case .localGet(let name):
            accesses.append(VariableAccess(
                variable: name,
                instructionIndex: i,
                isRead: true,
                stackDepthBefore: stackDepth
            ))
            stackDepth += 1

        case .localSet(let name):
            accesses.append(VariableAccess(
                variable: name,
                instructionIndex: i,
                isRead: false,
                stackDepthBefore: stackDepth
            ))
            stackDepth -= 1

        case .i32Add, .i32Sub, .i32Mul:
            stackDepth -= 1  // pops 2, pushes 1

        case .i32Const:
            stackDepth += 1

        // ... etc for all instructions
        }
    }

    return accesses
}
```

### Phase 2: Find Use-Reuse Pairs

```swift
struct UseReusePair {
    let variable: String
    let firstUseIndex: Int
    let reuseIndex: Int
    let distance: Int  // Instructions between uses
}

func findPairs(_ accesses: [VariableAccess]) -> [UseReusePair] {
    var pairs: [UseReusePair] = []
    var lastRead: [String: Int] = [:]  // variable -> instruction index

    for access in accesses where access.isRead {
        if let prevIndex = lastRead[access.variable] {
            let distance = access.instructionIndex - prevIndex
            pairs.append(UseReusePair(
                variable: access.variable,
                firstUseIndex: prevIndex,
                reuseIndex: access.instructionIndex,
                distance: distance
            ))
        }
        lastRead[access.variable] = access.instructionIndex
    }

    return pairs
}
```

### Phase 3: Rank by Distance

```swift
func rankPairs(_ pairs: [UseReusePair]) -> [UseReusePair] {
    // Shorter distance = higher priority
    // "Nested uses of values on the stack would be scheduled optimally
    //  (from the inner usages out)"
    return pairs.sorted { $0.distance < $1.distance }
}
```

### Phase 4: Schedule Nearest-First

```swift
func schedule(_ block: inout [Instruction], pairs: [UseReusePair]) {
    // Track current stack state
    var stackContents: [(variable: String, depth: Int)] = []

    for pair in pairs.sorted(by: { $0.distance < $1.distance }) {
        // Check if variable is still on stack at reuse point
        if let stackEntry = stackContents.first(where: {
            $0.variable == pair.variable &&
            isValidAtIndex(pair.reuseIndex)
        }) {
            // Can eliminate the second load!
            // Replace local.get with stack manipulation
            let depth = stackEntry.depth
            if depth == 0 {
                // Value is on top - use DUP
                block[pair.reuseIndex] = .dup
            } else {
                // Value is buried - use PICK (if available) or local
                block[pair.reuseIndex] = .pick(depth)
            }
        }

        // Update stack model
        updateStackAfterOptimization(...)
    }
}
```

### Key Limitation: Cross-Block Values

From Koopman: "Generalized stack scheduling is a bit more difficult than register scheduling because stack depth must be uniform and consistent when control passes through branch targets."

**The algorithm REQUIRES the stack to be empty at block boundaries.**

```swift
// At any branch point:
assert(stackDepth == 0, "Stack must be empty at branch")

// After optimization, must still ensure:
// - If branches are consistent
// - Loop entries have empty stack
// - Function calls have correct argument count
```

## Why This Doesn't Fix Stack Imbalance

The Blitz3D compiler's problem is generating code where:
```
if (cond) then
    call SomeFunction()  ; leaves i32 on stack
end if
; Stack now has 1 extra value!
```

Koopman's algorithm:
1. Assumes input is already balanced
2. Never inserts drops
3. Only optimizes within blocks
4. Explicitly forbids values crossing block boundaries

It's an **optimization**, not a **correctness fix**.

## When It Would Be Useful

After fixing balance with Option A, this could reduce code size by:
- Eliminating redundant local loads
- Using DUP instead of second load
- Better stack utilization within blocks

Koopman reported "91% to 100% of redundant local variable accesses were eliminated" - but only the redundant ones, not all loads.

---

# Comparison Matrix

| Aspect | Option A (Validator) | Option B (SSA) | Option C (Scheduler) |
|--------|---------------------|----------------|---------------------|
| **Solves balance problem** | Yes | Yes | No |
| **Implementation effort** | 8-12 hours | 20-40 hours | 6-8 hours |
| **Existing code** | 80% done | 0% done | 0% done |
| **Complexity** | Medium | High | Low |
| **Spec compliance** | Exact | Derived | N/A |
| **Optimization potential** | Low | High | Medium |
| **Risk** | Low | High | N/A |
| **Prerequisites** | None | Major refactor | Balanced code |

---

# Recommendation

## Primary: Option A (Validator-Based)

**Rationale**:
1. `StackValidator.swift` already implements the core algorithm
2. Directly addresses the stack imbalance problem
3. Can be integrated incrementally
4. Guaranteed to produce spec-compliant output

**Next Steps**:
1. Add validator property to `StatementGeneration`
2. Call `validateInstruction()` as instructions are emitted
3. At `popCtrl()`, insert `.drop` for excess values
4. Balance if/else branches before emitting

## Future: Consider Option B

If the compiler needs significant optimization or the codebase grows, an SSA IR would be cleaner. But it's a major architectural change not justified for fixing ~10 failing files.

## Skip: Option C

Koopman's algorithm solves a different problem (optimization, not correctness) and requires already-balanced code as input.

---

# Sources

- [WebAssembly Validation Algorithm](https://webassembly.github.io/spec/core/appendix/algorithm.html) - Official WASM spec
- [Binaryen Stack IR](https://github.com/WebAssembly/binaryen/blob/main/src/wasm-stack.h) - Production implementation
- [Waffle SSA Framework](https://github.com/bytecodealliance/waffle) - Bytecode Alliance SSA IR
- [Stackify Algorithm Gist](https://gist.github.com/evanw/58a8a5b8b4a1da32fcdcfbf9da87c82a) - Evan Wallace's implementation
- [Koopman Stack Scheduling](https://users.ece.cmu.edu/~koopman/stack_compiler/stack_co.html) - Original 1994 paper
- [HN: WASM Is Not a Stack Machine](https://news.ycombinator.com/item?id=33093897) - Discussion of WASM's true nature
