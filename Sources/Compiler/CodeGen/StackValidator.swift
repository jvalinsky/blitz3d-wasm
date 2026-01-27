// StackValidator.swift
// WASM 3-Stack Validation System
// Based on: https://webassembly.github.io/spec/core/appendix/algorithm.html

import Foundation

/// Value types that can appear on the stack
enum StackValueType: Equatable, CustomStringConvertible {
    case i32
    case i64
    case f32
    case f64
    case bot  // Bottom type for unreachable code (matches anything)

    /// Check if this type matches expected type (with Bot polymorphism)
    func matches(_ expected: StackValueType) -> Bool {
        if self == .bot || expected == .bot {
            return true  // Bot matches anything
        }
        return self == expected
    }

    /// Convert from WASMType
    static func from(_ wasmType: WASMType) -> StackValueType {
        switch wasmType {
        case .i32: return .i32
        case .i64: return .i64
        case .f32: return .f32
        case .f64: return .f64
        default: return .i32  // Default to i32 for void/other
        }
    }

    /// Convert to WASMType
    func toWASMType() -> WASMType {
        switch self {
        case .i32: return .i32
        case .i64: return .i64
        case .f32: return .f32
        case .f64: return .f64
        case .bot: return .i32
        }
    }

    var description: String {
        switch self {
        case .i32: return "i32"
        case .i64: return "i64"
        case .f32: return "f32"
        case .f64: return "f64"
        case .bot: return "bot"
        }
    }
}

/// Control frame tracking block nesting
struct ControlFrame {
    let opcode: String  // "block", "loop", "if", etc.
    let startTypes: [StackValueType]  // Types at block start
    let endTypes: [StackValueType]    // Types at block end
    let valHeight: Int                // Value stack height at block start
    let initHeight: Int               // Init stack height at block start
    var unreachable: Bool             // Is remainder unreachable?
    
    /// Get label types (start for loop, end for others)
    func labelTypes() -> [StackValueType] {
        return opcode == "loop" ? startTypes : endTypes
    }
}

/// Type context for validator - provides local/global types
protocol ValidatorTypeContext: AnyObject {
    func localType(at index: Int) -> WASMType?
    func globalType(at index: Int) -> WASMType?
    func functionSignature(at index: Int) -> (params: [WASMType], results: [WASMType])?
}

/// WASM 3-Stack Validator
/// Tracks stack state during code generation to ensure valid WASM
class StackValidator {
    // The three stacks
    private var vals: [StackValueType] = []        // Value stack (operand types)
    private var ctrls: [ControlFrame] = []         // Control stack (block nesting)
    private var inits: Set<Int> = []               // Initialization stack (local indices)

    // Type context for local/global types
    weak var typeContext: ValidatorTypeContext?

    // Cached local types (for when we don't have full context)
    private var localTypes: [Int: StackValueType] = [:]
    private var globalTypes: [Int: StackValueType] = [:]

    // Errors encountered
    private(set) var errors: [String] = []

    // Function return type
    private var functionReturnTypes: [StackValueType] = []

    init(returnTypes: [WASMType] = []) {
        self.functionReturnTypes = returnTypes.map { StackValueType.from($0) }
        // Start with implicit function block
        ctrls.append(ControlFrame(
            opcode: "function",
            startTypes: [],
            endTypes: functionReturnTypes,
            valHeight: 0,
            initHeight: 0,
            unreachable: false
        ))
    }

    /// Set local variable type
    func setLocalType(_ index: Int, type: WASMType) {
        localTypes[index] = StackValueType.from(type)
        inits.insert(index)  // Mark as initialized if we're setting its type
    }

    /// Set global variable type
    func setGlobalType(_ index: Int, type: WASMType) {
        globalTypes[index] = StackValueType.from(type)
    }
    
    /// Initialize function locals (params + local vars)
    /// Call this at the start of function generation
    func initializeFunctionLocals(_ locals: [(index: Int, type: WASMType)]) {
        for (index, type) in locals {
            setLocalType(index, type: type)
        }
    }

    /// Get local variable type
    private func getLocalType(_ index: Int) -> StackValueType {
        // First check cached types
        if let cached = localTypes[index] {
            return cached
        }
        // Then check context
        if let context = typeContext, let type = context.localType(at: index) {
            let stackType = StackValueType.from(type)
            localTypes[index] = stackType
            return stackType
        }
        // Default to i32
        return .i32
    }

    /// Get global variable type
    private func getGlobalType(_ index: Int) -> StackValueType {
        // First check cached types
        if let cached = globalTypes[index] {
            return cached
        }
        // Then check context
        if let context = typeContext, let type = context.globalType(at: index) {
            let stackType = StackValueType.from(type)
            globalTypes[index] = stackType
            return stackType
        }
        // Default to i32
        return .i32
    }
    
    // MARK: - Value Stack Operations
    
    /// Push a value type onto the stack
    func pushVal(_ type: StackValueType) {
        vals.append(type)
    }
    
    /// Pop a value from the stack (polymorphic if unreachable)
    @discardableResult
    func popVal() -> StackValueType {
        guard !ctrls.isEmpty else {
            errors.append("Control stack empty during popVal")
            return .bot
        }
        
        let frame = ctrls[0]
        
        // Special case: unreachable code with empty stack
        if vals.count == frame.valHeight && frame.unreachable {
            return .bot  // Polymorphic stack
        }
        
        // Check underflow
        if vals.count <= frame.valHeight {
            errors.append("Stack underflow: expected value but stack empty")
            return .bot
        }
        
        return vals.removeLast()
    }
    
    /// Pop a value and check it matches expected type
    @discardableResult
    func popVal(expect: StackValueType) -> StackValueType {
        let actual = popVal()
        
        if !actual.matches(expect) {
            errors.append("Type mismatch: expected \(expect), got \(actual)")
        }
        
        return actual
    }
    
    /// Push multiple values
    func pushVals(_ types: [StackValueType]) {
        for type in types {
            pushVal(type)
        }
    }
    
    /// Pop multiple values (in reverse order)
    @discardableResult
    func popVals(_ types: [StackValueType]) -> [StackValueType] {
        var popped: [StackValueType] = []
        for type in types.reversed() {
            popped.insert(popVal(expect: type), at: 0)
        }
        return popped
    }
    
    // MARK: - Control Stack Operations
    
    /// Push a control frame (enter block/loop/if)
    func pushCtrl(opcode: String, startTypes: [StackValueType], endTypes: [StackValueType]) {
        let frame = ControlFrame(
            opcode: opcode,
            startTypes: startTypes,
            endTypes: endTypes,
            valHeight: vals.count,
            initHeight: inits.count,
            unreachable: false
        )
        ctrls.insert(frame, at: 0)
        
        // Push start types onto value stack
        pushVals(startTypes)
    }
    
    /// Pop a control frame (exit block)
    /// Returns the frame and the number of excess values that need to be dropped
    @discardableResult
    func popCtrl() -> (frame: ControlFrame?, excessValues: Int) {
        guard !ctrls.isEmpty else {
            errors.append("Control stack empty during popCtrl")
            return (nil, 0)
        }

        let frame = ctrls[0]

        // Pop expected end types
        popVals(frame.endTypes)

        // Calculate excess values that need to be dropped
        let excessValues = max(0, vals.count - frame.valHeight)

        // Verify stack height and record excess
        if vals.count != frame.valHeight {
            errors.append("Stack height mismatch: expected \(frame.valHeight), got \(vals.count) (excess: \(excessValues))")
            // Clear excess values from tracking
            while vals.count > frame.valHeight {
                vals.removeLast()
            }
        }

        // Reset initialization to block start
        resetLocals(to: frame.initHeight)

        ctrls.removeFirst()
        return (frame, excessValues)
    }

    /// Peek at current control frame without modifying
    func currentCtrl() -> ControlFrame? {
        return ctrls.first
    }

    /// Get number of control frames (block nesting depth)
    var controlDepth: Int {
        return ctrls.count
    }
    
    /// Mark current block as unreachable
    func unreachable() {
        guard !ctrls.isEmpty else { return }
        
        // Clear value stack to current block height
        let targetHeight = ctrls[0].valHeight
        if vals.count > targetHeight {
            vals.removeLast(vals.count - targetHeight)
        }
        
        // Mark frame as unreachable
        ctrls[0].unreachable = true
    }
    
    // MARK: - Initialization Stack Operations
    
    /// Mark a local as initialized
    func setLocal(_ index: Int) {
        inits.insert(index)
    }
    
    /// Check if a local is initialized
    func getLocal(_ index: Int) -> Bool {
        // Blitz3D defaults all locals to 0, so they're implicitly initialized
        // Skip initialization checking for Blitz3D compatibility
        return true
    }
    
    /// Reset initialization status to a previous state
    private func resetLocals(to height: Int) {
        // Note: This is simplified - full implementation would track which locals
        // were initialized at each height
        // For now, we keep all initializations (conservative)
    }
    
    // MARK: - Instruction Validation
    
    /// Validate a WASM instruction's stack effect
    func validateInstruction(_ instr: WASMInstruction) {
        CompilerLogger.trace("VALIDATE: \(instr) (Depth: \(vals.count))")
        switch instr {
        // Constants
        case .i32Const:
            pushVal(.i32)
        case .i64Const:
            pushVal(.i64)
        case .f32Const:
            pushVal(.f32)
        case .f64Const:
            pushVal(.f64)
            
        // Binary operations
        case .i32Add, .i32Sub, .i32Mul, .i32DivS, .i32DivU, .i32RemS, .i32RemU:
            popVal(expect: .i32)
            popVal(expect: .i32)
            pushVal(.i32)
            
        case .i64Add, .i64Sub, .i64Mul, .i64DivS, .i64DivU, .i64RemS, .i64RemU:
            popVal(expect: .i64)
            popVal(expect: .i64)
            pushVal(.i64)
            
        case .f32Add, .f32Sub, .f32Mul, .f32Div:
            popVal(expect: .f32)
            popVal(expect: .f32)
            pushVal(.f32)
            
        case .f64Add, .f64Sub, .f64Mul, .f64Div:
            popVal(expect: .f64)
            popVal(expect: .f64)
            pushVal(.f64)
            
        // Bitwise operations
        case .i32And, .i32Or, .i32Xor, .i32Shl, .i32ShrS, .i32ShrU:
            popVal(expect: .i32)
            popVal(expect: .i32)
            pushVal(.i32)
            
        case .i64And, .i64Or, .i64Xor, .i64Shl, .i64ShrS, .i64ShrU:
            popVal(expect: .i64)
            popVal(expect: .i64)
            pushVal(.i64)
            
        // Comparisons
        case .i32Eq, .i32Ne, .i32LtS, .i32LtU, .i32GtS, .i32GtU, .i32LeS, .i32LeU, .i32GeS, .i32GeU:
            popVal(expect: .i32)
            popVal(expect: .i32)
            pushVal(.i32)
            
        case .i64Eq, .i64Ne, .i64LtS, .i64LtU, .i64GtS, .i64GtU, .i64LeS, .i64LeU, .i64GeS, .i64GeU:
            popVal(expect: .i64)
            popVal(expect: .i64)
            pushVal(.i32)  // Comparisons return i32
            
        case .f32Eq, .f32Ne, .f32Lt, .f32Gt, .f32Le, .f32Ge:
            popVal(expect: .f32)
            popVal(expect: .f32)
            pushVal(.i32)
            
        case .f64Eq, .f64Ne, .f64Lt, .f64Gt, .f64Le, .f64Ge:
            popVal(expect: .f64)
            popVal(expect: .f64)
            pushVal(.i32)
            
        // Unary operations
        case .i32Clz, .i32Ctz, .i32Popcnt, .i32EqZ:
            popVal(expect: .i32)
            pushVal(.i32)
            
        case .i64Clz, .i64Ctz, .i64Popcnt, .i64EqZ:
            popVal(expect: .i64)
            pushVal(.i32)  // i64.eqz returns i32
            
        case .f32Abs, .f32Neg, .f32Ceil, .f32Floor, .f32Trunc, .f32Nearest, .f32Sqrt:
            popVal(expect: .f32)
            pushVal(.f32)
            
        case .f64Abs, .f64Neg, .f64Ceil, .f64Floor, .f64Trunc, .f64Nearest, .f64Sqrt:
            popVal(expect: .f64)
            pushVal(.f64)
            
        // Type conversions
        case .f32ConvertI32S, .f32ConvertI32U:
            popVal(expect: .i32)
            pushVal(.f32)
            
        case .f64ConvertI32S, .f64ConvertI32U:
            popVal(expect: .i32)
            pushVal(.f64)
            
        case .i32TruncF32S, .i32TruncF32U:
            popVal(expect: .f32)
            pushVal(.i32)
            
        case .i32TruncF64S, .i32TruncF64U:
            popVal(expect: .f64)
            pushVal(.i32)
            
        // Stack operations
        case .drop:
            popVal()
            
        case .select:
            popVal(expect: .i32)  // Condition
            let t1 = popVal()
            let t2 = popVal()
            // Both must be same type
            if !t1.matches(t2) && t1 != .bot && t2 != .bot {
                errors.append("select: operands must be same type, got \(t1) and \(t2)")
            }
            pushVal(t1 == .bot ? t2 : t1)
            
        // Local operations
        case .localGet(let idx):
            _ = getLocal(idx)
            let type = getLocalType(idx)
            pushVal(type)

        case .localSet(let idx):
            let expectedType = getLocalType(idx)
            popVal(expect: expectedType)
            setLocal(idx)

        case .localTee(let idx):
            let expectedType = getLocalType(idx)
            let actualType = popVal(expect: expectedType)
            pushVal(actualType == .bot ? expectedType : actualType)
            setLocal(idx)

        // Global operations
        case .globalGet(let idx):
            let type = getGlobalType(idx)
            pushVal(type)

        case .globalSet(let idx):
            let expectedType = getGlobalType(idx)
            popVal(expect: expectedType)
            
        // Memory operations (using your actual instruction set)
        case .i32Load:
            popVal(expect: .i32)  // Address
            pushVal(.i32)
            
        case .i64Load:
            popVal(expect: .i32)
            pushVal(.i64)
            
        case .f32Load:
            popVal(expect: .i32)
            pushVal(.f32)
            
        case .f64Load:
            popVal(expect: .i32)
            pushVal(.f64)
            
        case .i32Store:
            popVal(expect: .i32)  // Value
            popVal(expect: .i32)  // Address
            
        case .i64Store:
            popVal(expect: .i64)
            popVal(expect: .i32)
            
        case .f32Store:
            popVal(expect: .f32)
            popVal(expect: .i32)
            
        case .f64Store:
            popVal(expect: .f64)
            popVal(expect: .i32)
            
        // Control flow
        case .if(let blockType, let thenBranch, let elseBranch):
            popVal(expect: .i32)  // Condition
            let endTypes: [StackValueType] = blockType == .void ? [] : [StackValueType.from(blockType)]
            pushCtrl(opcode: "if", startTypes: [], endTypes: endTypes)

            // Validate then branch
            for instr in thenBranch {
                validateInstruction(instr)
            }

            if let elseBranch = elseBranch {
                // Switch to else - reset stack to frame height but keep types
                let frame = ctrls[0]
                while vals.count > frame.valHeight {
                    vals.removeLast()
                }
                ctrls[0].unreachable = false

                // Validate else branch
                for instr in elseBranch {
                    validateInstruction(instr)
                }
            }

            let (_, excess) = popCtrl()
            if excess > 0 {
                errors.append("if: \(excess) excess value(s) need dropping")
            }
            pushVals(endTypes)

        case .block(let blockType, let body):
            let endTypes: [StackValueType] = blockType == .void ? [] : [StackValueType.from(blockType)]
            pushCtrl(opcode: "block", startTypes: [], endTypes: endTypes)

            for instr in body {
                validateInstruction(instr)
            }

            let (_, excess) = popCtrl()
            if excess > 0 {
                errors.append("block: \(excess) excess value(s) need dropping")
            }
            pushVals(endTypes)

        case .loop(let blockType, let body):
            let endTypes: [StackValueType] = blockType == .void ? [] : [StackValueType.from(blockType)]
            // Loops branch to start, so startTypes are what you need for br 0
            pushCtrl(opcode: "loop", startTypes: [], endTypes: endTypes)

            for instr in body {
                validateInstruction(instr)
            }

            let (_, excess) = popCtrl()
            if excess > 0 {
                errors.append("loop: \(excess) excess value(s) need dropping")
            }
            pushVals(endTypes)

        case .br(let depth):
            if depth >= ctrls.count {
                errors.append("br: invalid depth \(depth)")
            } else {
                let types = ctrls[depth].labelTypes()
                popVals(types)
                unreachable()
            }

        case .brIf(let depth):
            popVal(expect: .i32)
            if depth >= ctrls.count {
                errors.append("br_if: invalid depth \(depth)")
            } else {
                let types = ctrls[depth].labelTypes()
                let popped = popVals(types)
                pushVals(popped)  // Push back (conditional)
            }

        case .return:
            // Pop function return types
            popVals(functionReturnTypes)
            unreachable()

        case .call(let funcIdx):
            // Get function signature from context
            if let context = typeContext,
               let sig = context.functionSignature(at: funcIdx) {
                // Pop parameters (in reverse order)
                for param in sig.params.reversed() {
                    popVal(expect: StackValueType.from(param))
                }
                // Push results
                for result in sig.results {
                    pushVal(StackValueType.from(result))
                }
            } else {
                // Unknown function - can't validate properly
                // For now, assume no stack effect (conservative)
                // This is a known limitation - proper fix requires passing function signatures
            }

        case .callIndirect(let typeIdx, _):
            popVal(expect: .i32)  // Table index
            // Would need type context to validate properly

        case .unreachable:
            unreachable()

        case .end:
            // End of block - handled by parent
            break

        // Bulk memory operations
        case .memoryFill:
            popVal(expect: .i32)  // size
            popVal(expect: .i32)  // value
            popVal(expect: .i32)  // dest

        case .memoryCopy:
            popVal(expect: .i32)  // size
            popVal(expect: .i32)  // src
            popVal(expect: .i32)  // dest

        case .memorySize:
            pushVal(.i32)

        case .memoryGrow:
            popVal(expect: .i32)  // pages
            pushVal(.i32)         // previous size
            
        case .sourceLocation(_, let inner):
            validateInstruction(inner)

        default:
            // Unknown instruction - skip validation
            break
        }
    }
    
    // MARK: - Validation Results
    
    /// Check if validation succeeded
    var isValid: Bool {
        return errors.isEmpty
    }
    
    /// Get current stack depth (for debugging)
    var stackDepth: Int {
        return vals.count
    }
    
    /// Reset validator to initial state
    func reset(returnTypes: [WASMType] = []) {
        vals.removeAll()
        ctrls.removeAll()
        inits.removeAll()
        errors.removeAll()
        localTypes.removeAll()
        globalTypes.removeAll()
        functionReturnTypes = returnTypes.map { StackValueType.from($0) }

        // Re-add implicit function block
        ctrls.append(ControlFrame(
            opcode: "function",
            startTypes: [],
            endTypes: functionReturnTypes,
            valHeight: 0,
            initHeight: 0,
            unreachable: false
        ))
    }

    /// Get current stack types (for debugging/analysis)
    var currentStackTypes: [StackValueType] {
        return vals
    }

    /// Get current stack height relative to base frame
    var stackHeightFromBase: Int {
        guard let frame = ctrls.last else { return vals.count }
        return vals.count - frame.valHeight
    }

    /// Calculate the excess values at current point
    var currentExcessValues: Int {
        guard let frame = ctrls.first else { return vals.count }
        return max(0, vals.count - frame.valHeight)
    }
}

// MARK: - Static Balance Checking

extension StackValidator {
    /// Calculate the net stack delta of an instruction sequence
    /// Returns (netDelta, errors) where netDelta is the stack height change
    static func calculateStackDelta(_ instructions: [WASMInstruction],
                                    localTypes: [Int: WASMType] = [:],
                                    globalTypes: [Int: WASMType] = [:],
                                    functionSignatures: [Int: (params: [WASMType], results: [WASMType])] = [:],
                                    context: ValidatorTypeContext? = nil) -> (delta: Int, errors: [String]) {
        let validator = StackValidator()
        validator.typeContext = context

        // Set up type context
        for (idx, type) in localTypes {
            validator.setLocalType(idx, type: type)
        }
        for (idx, type) in globalTypes {
            validator.setGlobalType(idx, type: type)
        }

        // Validate each instruction
        for instr in instructions {
            validator.validateInstruction(instr)
        }

        return (validator.stackDepth, validator.errors)
    }

    /// Balance two branches to have the same stack effect
    /// Returns the instructions needed to balance each branch (drops to add)
    static func balanceBranches(thenBranch: [WASMInstruction],
                                 elseBranch: [WASMInstruction],
                                 localTypes: [Int: WASMType] = [:],
                                 globalTypes: [Int: WASMType] = [:]) -> (thenDrops: Int, elseDrops: Int) {
        let (thenDelta, _) = calculateStackDelta(thenBranch, localTypes: localTypes, globalTypes: globalTypes)
        let (elseDelta, _) = calculateStackDelta(elseBranch, localTypes: localTypes, globalTypes: globalTypes)

        // Both branches should have the same stack effect
        // Add drops to the branch with more values
        if thenDelta > elseDelta {
            return (thenDelta - elseDelta, 0)
        } else if elseDelta > thenDelta {
            return (0, elseDelta - thenDelta)
        } else {
            return (0, 0)
        }
    }

    /// Insert drops to balance instructions to a target delta
    static func balanceToTarget(_ instructions: inout [WASMInstruction],
                                 targetDelta: Int,
                                 localTypes: [Int: WASMType] = [:],
                                 globalTypes: [Int: WASMType] = [:],
                                 context: ValidatorTypeContext? = nil) -> Int {
        let (actualDelta, errors) = calculateStackDelta(instructions, localTypes: localTypes, globalTypes: globalTypes, context: context)

        // CRITICAL FIX: Only add drops if we have actual excess values on the stack
        // actualDelta must be positive AND greater than target
        let excessValues = actualDelta - targetDelta

        if excessValues > 0 && actualDelta > 0 {
            // Log diagnostic for debugging
            if !errors.isEmpty {
                CompilerLogger.warn("STACK_VALIDATOR_WARNING: Adding \(excessValues) drops with \(errors.count) validation errors present")
            }

            for _ in 0..<excessValues {
                instructions.append(.drop)
            }
        } else if excessValues > 0 && actualDelta <= 0 {
            // Stack underflow detected - DO NOT add drops
            CompilerLogger.error("STACK_VALIDATOR_ERROR: Cannot balance to target=\(targetDelta). actualDelta=\(actualDelta) indicates underflow")
            // Return 0 to indicate no drops were added
            return 0
        }

        return max(0, excessValues)
    }
}
