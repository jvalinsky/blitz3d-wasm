//
//  ConstantFolding.swift
//  Blitz3D Compiler
//
//  Constant folding optimization pass
//  Evaluates compile-time constant expressions
//

import Foundation

/// Constant folding optimization pass
/// Evaluates expressions with constant operands at compile time
public struct ConstantFoldingPass {
    
    public init() {}
    
    /// Apply constant folding to an IR module
    public func run(on module: inout IRModule) {
        for i in 0..<module.functions.count {
            optimizeFunction(&module.functions[i])
        }
    }
    
    private func optimizeFunction(_ function: inout IRFunction) {
        function.body = optimizeEffects(function.body)
    }
    
    private func optimizeEffects(_ effects: [IREffect]) -> [IREffect] {
        effects.map { optimizeEffect($0) }
    }
    
    private func optimizeEffect(_ effect: IREffect) -> IREffect {
        switch effect {
        case .assign(let target, let value):
            return .assign(target: target, value: optimizeValue(value))
            
        case .assignLocal(let index, let value):
            return .assignLocal(index: index, value: optimizeValue(value))
            
        case .assignGlobal(let index, let value):
            return .assignGlobal(index: index, value: optimizeValue(value))
            
        case .assignField(let base, let offset, let type, let value):
            return .assignField(
                base: optimizeValue(base),
                fieldOffset: offset,
                fieldType: type,
                value: optimizeValue(value)
            )
            
        case .assignArray(let base, let index, let size, let type, let value):
            return .assignArray(
                base: optimizeValue(base),
                index: optimizeValue(index),
                elementSize: size,
                elementType: type,
                value: optimizeValue(value)
            )
            
        case .ifStmt(let cond, let thenBranch, let elseBranch):
            let optimizedCond = optimizeValue(cond)
            
            // Constant condition - eliminate dead branch
            if case .constI32(let val) = optimizedCond {
                if val != 0 {
                    // Condition is always true - return then branch only
                    return thenBranch.isEmpty ? .nop : .block(label: "", body: optimizeEffects(thenBranch))
                } else {
                    // Condition is always false - return else branch only
                    if let elseBranch = elseBranch {
                        return elseBranch.isEmpty ? .nop : .block(label: "", body: optimizeEffects(elseBranch))
                    } else {
                        return .nop
                    }
                }
            }
            
            return .ifStmt(
                condition: optimizedCond,
                then: optimizeEffects(thenBranch),
                else: elseBranch.map { optimizeEffects($0) }
            )
            
        case .whileStmt(let cond, let body):
            let optimizedCond = optimizeValue(cond)
            
            // Constant false condition - eliminate loop
            if case .constI32(0) = optimizedCond {
                return .nop
            }
            
            return .whileStmt(
                condition: optimizedCond,
                body: optimizeEffects(body)
            )
            
        case .forStmt(let index, let start, let end, let step, let body):
            return .forStmt(
                index: index,
                start: optimizeValue(start),
                end: optimizeValue(end),
                step: step.map { optimizeValue($0) },
                body: optimizeEffects(body)
            )
            
        case .repeatStmt(let body, let cond):
            return .repeatStmt(
                body: optimizeEffects(body),
                condition: optimizeValue(cond)
            )
            
        case .returnStmt(let value):
            return .returnStmt(value: value.map { optimizeValue($0) })
            
        case .selectStmt(let value, let cases, let defaultCase):
            return .selectStmt(
                value: optimizeValue(value),
                cases: cases.map { (val, effects) in (val, optimizeEffects(effects)) },
                default: defaultCase.map { optimizeEffects($0) }
            )
            
        case .block(let label, let body):
            return .block(label: label, body: optimizeEffects(body))
            
        case .loop(let label, let body):
            return .loop(label: label, body: optimizeEffects(body))
            
        case .branchIf(let cond, let label):
            let optimizedCond = optimizeValue(cond)
            
            // Constant condition
            if case .constI32(let val) = optimizedCond {
                if val != 0 {
                    // Always branch - convert to unconditional
                    return .branch(label: label)
                } else {
                    // Never branch - eliminate
                    return .nop
                }
            }
            
            return .branchIf(condition: optimizedCond, label: label)
            
        case .discard(let value):
            return .discard(optimizeValue(value))
            
        case .delete(let value):
            return .delete(value: optimizeValue(value))
            
        case .nop, .breakStmt, .continueStmt, .label, .branch:
            return effect
        }
    }
    
    private func optimizeValue(_ value: IRValue) -> IRValue {
        switch value {
        case .binary(let op, let lhs, let rhs, let resultType):
            let optimizedLhs = optimizeValue(lhs)
            let optimizedRhs = optimizeValue(rhs)
            
            // Try to fold binary operations
            if let folded = tryFoldBinary(op, optimizedLhs, optimizedRhs, resultType) {
                return folded
            }
            
            // Try strength reduction
            if let reduced = tryStrengthReduce(op, optimizedLhs, optimizedRhs, resultType) {
                return reduced
            }
            
            return .binary(op: op, lhs: optimizedLhs, rhs: optimizedRhs, resultType: resultType)
            
        case .call(let name, let args, let resultType):
            return .call(name: name, args: args.map { optimizeValue($0) }, resultType: resultType)
            
        case .loadField(let base, let offset, let type):
            return .loadField(base: optimizeValue(base), fieldOffset: offset, fieldType: type)
            
        case .loadArray(let base, let index, let size, let type):
            return .loadArray(
                base: optimizeValue(base),
                index: optimizeValue(index),
                elementSize: size,
                elementType: type
            )
            
        case .convert(let val, let from, let to):
            let optimizedVal = optimizeValue(val)
            
            // Fold conversions of constants
            switch (optimizedVal, from, to) {
            case (.constI32(let i), .i32, .f32):
                return .constF32(Float(i))
            case (.constF32(let f), .f32, .i32):
                return .constI32(Int32(f))
            case (let v, let f, let t) where f == t:
                // No-op conversion
                return v
            default:
                return .convert(value: optimizedVal, from: from, to: to)
            }
            
        case .before(let val):
            return .before(value: optimizeValue(val))
            
        case .after(let val):
            return .after(value: optimizeValue(val))
            
        case .handle(let val):
            return .handle(value: optimizeValue(val))
            
        case .objectCast(let typeName, let val):
            return .objectCast(typeName: typeName, value: optimizeValue(val))
            
        // Leaf nodes - no optimization needed
        case .constI32, .constF32, .constStringPtr,
             .localGet, .globalGet, .first, .last, .new:
            return value
        }
    }
    
    /// Try to fold binary operations with constant operands
    private func tryFoldBinary(
        _ op: String,
        _ lhs: IRValue,
        _ rhs: IRValue,
        _ resultType: IRType
    ) -> IRValue? {
        // Integer operations
        if case .constI32(let a) = lhs, case .constI32(let b) = rhs {
            let result: Int32?
            
            switch op {
            case "+": result = a &+ b
            case "-": result = a &- b
            case "*": result = a &* b
            case "/": result = b != 0 ? a / b : nil
            case "Mod": result = b != 0 ? a % b : nil
            case "Shl": result = a << (b & 31)
            case "Shr": result = a >> (b & 31)
            case "Sar": result = a >> (b & 31) // Arithmetic shift
            case "And": result = a & b
            case "Or": result = a | b
            case "Xor": result = a ^ b
            case "=": result = a == b ? 1 : 0
            case "<>": result = a != b ? 1 : 0
            case "<": result = a < b ? 1 : 0
            case "<=": result = a <= b ? 1 : 0
            case ">": result = a > b ? 1 : 0
            case ">=": result = a >= b ? 1 : 0
            default: result = nil
            }
            
            if let res = result {
                return .constI32(res)
            }
        }
        
        // Float operations
        if case .constF32(let a) = lhs, case .constF32(let b) = rhs {
            let result: Float?
            
            switch op {
            case "+": result = a + b
            case "-": result = a - b
            case "*": result = a * b
            case "/": result = b != 0 ? a / b : nil
            case "Pow": result = pow(a, b)
            default: result = nil
            }
            
            if let res = result {
                return resultType == .i32 ? .constI32(0) : .constF32(res)
            }
            
            // Float comparisons return integers
            let intResult: Int32?
            switch op {
            case "=": intResult = a == b ? 1 : 0
            case "<>": intResult = a != b ? 1 : 0
            case "<": intResult = a < b ? 1 : 0
            case "<=": intResult = a <= b ? 1 : 0
            case ">": intResult = a > b ? 1 : 0
            case ">=": intResult = a >= b ? 1 : 0
            default: intResult = nil
            }
            
            if let res = intResult {
                return .constI32(res)
            }
        }
        
        return nil
    }
    
    /// Strength reduction: replace expensive operations with cheaper ones
    private func tryStrengthReduce(
        _ op: String,
        _ lhs: IRValue,
        _ rhs: IRValue,
        _ resultType: IRType
    ) -> IRValue? {
        // x + 0 = x
        if op == "+" {
            if case .constI32(0) = rhs { return lhs }
            if case .constF32(0) = rhs { return lhs }
            if case .constI32(0) = lhs { return rhs }
            if case .constF32(0) = lhs { return rhs }
        }
        
        // x - 0 = x
        if op == "-" {
            if case .constI32(0) = rhs { return lhs }
            if case .constF32(0) = rhs { return lhs }
        }
        
        // x * 0 = 0
        if op == "*" {
            if case .constI32(0) = rhs { return .constI32(0) }
            if case .constI32(0) = lhs { return .constI32(0) }
            if case .constF32(0) = rhs { return .constF32(0) }
            if case .constF32(0) = lhs { return .constF32(0) }
        }
        
        // x * 1 = x
        if op == "*" {
            if case .constI32(1) = rhs { return lhs }
            if case .constF32(1) = rhs { return lhs }
            if case .constI32(1) = lhs { return rhs }
            if case .constF32(1) = lhs { return rhs }
        }
        
        // x / 1 = x
        if op == "/" {
            if case .constI32(1) = rhs { return lhs }
            if case .constF32(1) = rhs { return lhs }
        }
        
        // x * power-of-2 => x << log2(n) (integers only)
        if op == "*", case .constI32(let n) = rhs, n > 0 {
            if n.nonzeroBitCount == 1 {
                let shift = Int32(n.trailingZeroBitCount)
                return .binary(op: "Shl", lhs: lhs, rhs: .constI32(shift), resultType: resultType)
            }
        }
        
        // x / power-of-2 => x >> log2(n) (integers only, when positive)
        if op == "/", case .constI32(let n) = rhs, n > 0 {
            if n.nonzeroBitCount == 1 {
                let shift = Int32(n.trailingZeroBitCount)
                // Note: This is only valid for unsigned or known-positive values
                // For signed division, we'd need to ensure non-negative
                return .binary(op: "Shr", lhs: lhs, rhs: .constI32(shift), resultType: resultType)
            }
        }
        
        return nil
    }
}
