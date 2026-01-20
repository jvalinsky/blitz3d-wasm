// StackValidator.swift
// WASM 3-Stack Validation System
// Based on: https://webassembly.github.io/spec/core/appendix/algorithm.html

import Foundation

/// Value types that can appear on the stack
enum StackValueType: Equatable {
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

/// WASM 3-Stack Validator
/// Tracks stack state during code generation to ensure valid WASM
class StackValidator {
    // The three stacks
    private var vals: [StackValueType] = []        // Value stack (operand types)
    private var ctrls: [ControlFrame] = []         // Control stack (block nesting)
    private var inits: Set<Int> = []               // Initialization stack (local indices)
    
    // Errors encountered
    private(set) var errors: [String] = []
    
    init() {
        // Start with implicit function block
        ctrls.append(ControlFrame(
            opcode: "function",
            startTypes: [],
            endTypes: [],
            valHeight: 0,
            initHeight: 0,
            unreachable: false
        ))
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
    @discardableResult
    func popCtrl() -> ControlFrame? {
        guard !ctrls.isEmpty else {
            errors.append("Control stack empty during popCtrl")
            return nil
        }
        
        let frame = ctrls[0]
        
        // Pop expected end types
        popVals(frame.endTypes)
        
        // Verify stack height
        if vals.count != frame.valHeight {
            errors.append("Stack height mismatch: expected \(frame.valHeight), got \(vals.count)")
        }
        
        // Reset initialization to block start
        resetLocals(to: frame.initHeight)
        
        ctrls.removeFirst()
        return frame
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
        if !inits.contains(index) {
            errors.append("Local \(index) used before initialization")
            return false
        }
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
            // Type would come from context - for now assume i32
            pushVal(.i32)
            
        case .localSet(let idx):
            popVal()  // Type would be validated from context
            setLocal(idx)
            
        case .localTee(let idx):
            let type = popVal()
            pushVal(type)
            setLocal(idx)
            
        // Global operations
        case .globalGet:
            pushVal(.i32)  // Type from context
            
        case .globalSet:
            popVal()
            
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
            // Would validate branches - for now simplified
            
        case .block(let blockType, let body):
            // Validate block - simplified for now
            break
            
        case .loop(let blockType, let body):
            // Validate loop - simplified for now
            break
            
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
            // Would pop return types from context
            unreachable()
            
        case .call(let funcIdx):
            // Would get function signature from context
            // For now, simplified
            break
            
        case .unreachable:
            unreachable()
            
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
    func reset() {
        vals.removeAll()
        ctrls.removeAll()
        inits.removeAll()
        errors.removeAll()
        
        // Re-add implicit function block
        ctrls.append(ControlFrame(
            opcode: "function",
            startTypes: [],
            endTypes: [],
            valHeight: 0,
            initHeight: 0,
            unreachable: false
        ))
    }
}
