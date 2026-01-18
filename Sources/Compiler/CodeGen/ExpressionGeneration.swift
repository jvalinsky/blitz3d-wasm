//
//  ExpressionGeneration.swift
//  Blitz3DCompiler
//
//  Expression compilation for WASM code generation
//

import Foundation

/// Manages expression compilation and code generation
public struct ExpressionGeneration {
    private var module: WASMModule
    private var typeIndexMap: [String: Int]
    private var functionIndexMap: [String: Int]
    
    // Dependencies
    private var localVariables: [String: LocalInfo] = [:]
    private var globalVariables: [String: GlobalInfo] = [:]
    private var arrayVariables: [String: ArrayInfo] = [:]
    private var stringLiterals: [String: Int] = [:]
    private var userTypes: [String: UserTypeInfo] = [:]
    private var fieldOffsets: [String: [String: Int]] = [:]
    
    // Type handling
    private let typeHandling = TypeHandling()
    
    public init(module: WASMModule, typeIndexMap: [String: Int], functionIndexMap: [String: Int]) {
        self.module = module
        self.typeIndexMap = typeIndexMap
        self.functionIndexMap = functionIndexMap
    }
    
    /// Configure dependencies
    public mutating func configure(
        localVariables: [String: LocalInfo],
        globalVariables: [String: GlobalInfo],
        arrayVariables: [String: ArrayInfo],
        stringLiterals: [String: Int],
        userTypes: [String: UserTypeInfo],
        fieldOffsets: [String: [String: Int]]
    ) {
        self.localVariables = localVariables
        self.globalVariables = globalVariables
        self.arrayVariables = arrayVariables
        self.stringLiterals = stringLiterals
        self.userTypes = userTypes
        self.fieldOffsets = fieldOffsets
    }
    
    /// Generate WASM instructions for an expression
    public mutating func generate(_ expr: ExpressionNode) -> [WASMInstruction] {
        return generateWithInfo(expr).instrs
    }
    
    /// Generate WASM instructions along with type information
    public mutating func generateWithInfo(_ expr: ExpressionNode) -> (instrs: [WASMInstruction], type: WASMType) {
        switch expr {
        case .integerLiteral(let value):
            return ([.i32Const(Int32(value))], .i32)
            
        case .floatLiteral(let value):
            return ([.f32Const(Float(value))], .f32)
            
        case .stringLiteral(let value):
            let offset = addStringData(value)
            return ([.i32Const(Int32(offset))], .i32)
            
        case .identifier(let id):
            if let local = localVariables[id.name] {
                return ([.localGet(local.index)], local.type)
            }
            if let global = globalVariables[id.name] {
                return ([.globalGet(global.index)], global.type)
            }
            // Default to 0 if not found
            return ([.i32Const(0)], .i32)
            
        case .binary(let binop):
            return generateBinaryOp(binop)
            
        case .unary(let unaryOp):
            return generateUnaryOp(unaryOp)
            
        case .functionCall(let call):
            return generateFunctionCall(call)
            
        case .arrayAccess(let access):
            return generateArrayAccess(access)
            
        case .fieldAccess(let access):
            return generateFieldAccess(access)
            
        case .typeCast(let cast):
            return generateTypeCast(cast)
            
        case .new(let typeName):
            // new TypeName() - allocate instance
            if let typeInfo = userTypes[typeName] {
                // Call allocation function (placeholder)
                return ([.call(0)], .i32)
            }
            return ([.i32Const(0)], .i32)
            
        case .first(let typeName):
            // First TypeName - get first instance
            return ([.call(0)], .i32)
            
        case .last(let typeName):
            // Last TypeName - get last instance
            return ([.call(0)], .i32)
            
        case .before(let expr):
            // Before expr - get previous instance
            let exprInstrs = generate(expr)
            return (exprInstrs + [.call(0)], .i32)
            
        case .after(let expr):
            // After expr - get next instance
            let exprInstrs = generate(expr)
            return (exprInstrs + [.call(0)], .i32)
            
        case .handle(let expr):
            // Handle(expr) - convert instance to handle
            let exprInstrs = generate(expr)
            return (exprInstrs, .i32)
            
        case .objectCast(let typeName, let expr):
            // Object.TypeName(handle) - convert handle to instance
            let exprInstrs = generate(expr)
            return (exprInstrs, .i32)
        }
    }
    
    // MARK: - Binary Operations
    
    private mutating func generateBinaryOp(_ binop: BinaryOpNode) -> (instrs: [WASMInstruction], type: WASMType) {
        let leftResult = generateWithInfo(binop.left)
        let rightResult = generateWithInfo(binop.right)
        
        var instrs = leftResult.instrs + rightResult.instrs
        let resultType = typeHandling.resultType(for: binop.op, leftType: leftResult.type, rightType: rightResult.type)
        
        // Generate appropriate instruction based on operator and type
        switch binop.op {
        case "+":
            switch resultType {
            case .i32: instrs.append(.i32Add)
            case .i64: instrs.append(.i64Add)
            case .f32: instrs.append(.f32Add)
            case .f64: instrs.append(.f64Add)
            default: break
            }
            
        case "-":
            switch resultType {
            case .i32: instrs.append(.i32Sub)
            case .i64: instrs.append(.i64Sub)
            case .f32: instrs.append(.f32Sub)
            case .f64: instrs.append(.f64Sub)
            default: break
            }
            
        case "*":
            switch resultType {
            case .i32: instrs.append(.i32Mul)
            case .i64: instrs.append(.i64Mul)
            case .f32: instrs.append(.f32Mul)
            case .f64: instrs.append(.f64Mul)
            default: break
            }
            
        case "/":
            switch resultType {
            case .i32: instrs.append(.i32DivS)
            case .i64: instrs.append(.i64DivS)
            case .f32: instrs.append(.f32Div)
            case .f64: instrs.append(.f64Div)
            default: break
            }
            
        case "mod":
            instrs.append(.i32RemS)
            
        case "=":
            instrs.append(.i32Eq)
            return (instrs, .i32)
            
        case "<>":
            instrs.append(.i32Ne)
            return (instrs, .i32)
            
        case "<":
            switch leftResult.type {
            case .i32, .i64: instrs.append(.i32LtS)
            case .f32: instrs.append(.f32Lt)
            case .f64: instrs.append(.f64Lt)
            default: break
            }
            return (instrs, .i32)
            
        case ">":
            switch leftResult.type {
            case .i32, .i64: instrs.append(.i32GtS)
            case .f32: instrs.append(.f32Gt)
            case .f64: instrs.append(.f64Gt)
            default: break
            }
            return (instrs, .i32)
            
        case "<=":
            switch leftResult.type {
            case .i32, .i64: instrs.append(.i32LeS)
            case .f32: instrs.append(.f32Le)
            case .f64: instrs.append(.f64Le)
            default: break
            }
            return (instrs, .i32)
            
        case ">=":
            switch leftResult.type {
            case .i32, .i64: instrs.append(.i32GeS)
            case .f32: instrs.append(.f32Ge)
            case .f64: instrs.append(.f64Ge)
            default: break
            }
            return (instrs, .i32)
            
        case "and":
            instrs.append(.i32And)
            
        case "or":
            instrs.append(.i32Or)
            
        case "xor":
            instrs.append(.i32Xor)
            
        case "shl":
            instrs.append(.i32Shl)
            
        case "shr":
            instrs.append(.i32ShrU)
            
        case "pow":
            // Power operation - simplified, no direct WASM instruction
            // Would need runtime function call
            instrs.append(.call(0)) // pow function placeholder
            
        default:
            break
        }
        
        return (instrs, resultType)
    }
    
    // MARK: - Unary Operations
    
    private mutating func generateUnaryOp(_ unaryOp: UnaryOpNode) -> (instrs: [WASMInstruction], type: WASMType) {
        let operandResult = generateWithInfo(unaryOp.expression)
        var instrs = operandResult.instrs
        let resultType = typeHandling.resultType(for: unaryOp.op, operandType: operandResult.type)
        
        switch unaryOp.op {
        case "-":
            switch operandResult.type {
            case .i32: instrs.append(.i32Const(-1)); instrs.append(.i32Mul)
            case .i64: instrs.append(.i64Const(-1)); instrs.append(.i64Mul)
            case .f32: instrs.append(.f32Neg)
            case .f64: instrs.append(.f64Neg)
            default: break
            }
            
        case "not":
            switch operandResult.type {
            case .i32: instrs.append(.i32Const(-1)); instrs.append(.i32Xor)
            default: break
            }
            
        default:
            break
        }
        
        return (instrs, resultType)
    }
    
    // MARK: - Function Calls
    
    private mutating func generateFunctionCall(_ call: FunctionCallNode) -> (instrs: [WASMInstruction], type: WASMType) {
        var instrs: [WASMInstruction] = []
        
        // Generate argument instructions
        for arg in call.arguments {
            let argInstrs = generate(arg)
            instrs.append(contentsOf: argInstrs)
        }
        
        // Call function
        if let funcIdx = functionIndexMap[call.name] {
            instrs.append(.call(Int(funcIdx)))
        } else {
            instrs.append(.call(0)) // Placeholder
        }
        
        // Assume i32 return type (simplified)
        return (instrs, .i32)
    }
    
    // MARK: - Array Access
    
    private mutating func generateArrayAccess(_ access: ArrayAccessNode) -> (instrs: [WASMInstruction], type: WASMType) {
        var instrs: [WASMInstruction] = []
        
        // Get array base address
        if case .identifier(let arrayId) = access.array,
           let array = arrayVariables[arrayId.name] {
            instrs.append(.i32Const(Int32(array.baseAddress)))
            
            // Calculate offset
            var currentOffset = 0
            for (index, indexExpr) in access.indices.enumerated() {
                let indexInstrs = generate(indexExpr)
                instrs.append(contentsOf: indexInstrs)
                
                if index > 0 {
                    // Multiply by stride
                    instrs.append(.i32Const(Int32(array.strides[index])))
                    instrs.append(.i32Mul)
                }
                
                if index > 0 {
                    instrs.append(.i32Const(Int32(array.strides[index])))
                    instrs.append(.i32Mul)
                }
            }
            
            // Load value
            switch array.elementType {
            case .i32:
                instrs.append(.i32Load(2, 0))
            case .f32:
                instrs.append(.f32Load(2, 0))
            case .i64:
                instrs.append(.i64Load(2, 0))
            case .f64:
                instrs.append(.f64Load(2, 0))
            default:
                instrs.append(.i32Load(2, 0))
            }
            
            return (instrs, array.elementType)
        }
        
        return ([.i32Const(0)], .i32)
    }
    
    // MARK: - Field Access
    
    private mutating func generateFieldAccess(_ access: FieldAccessNode) -> (instrs: [WASMInstruction], type: WASMType) {
        var instrs: [WASMInstruction] = []
        
        // Get object pointer
        let objectInstrs = generate(access.object)
        instrs.append(contentsOf: objectInstrs)
        
        // Add field offset
        // We need to determine the type from the object
        // This is simplified - a full implementation would track types
        
        // Check for known field offsets
        for (typeName, offsets) in fieldOffsets {
            if let fieldOffset = offsets[access.field] {
                instrs.append(.i32Const(Int32(fieldOffset)))
                instrs.append(.i32Add)
                
                // Load field value
                instrs.append(.i32Load(2, 0))
                return (instrs, .i32)
            }
        }
        
        return ([.i32Const(0)], .i32)
    }
    
    // MARK: - Type Cast
    
    private mutating func generateTypeCast(_ cast: TypeCastNode) -> (instrs: [WASMInstruction], type: WASMType) {
        let exprInstrs = generate(cast.expression)
        let targetType = typeHandling.typeInfo(from: cast.targetType.rawValue).wasmType
        return (exprInstrs, targetType)
    }
    
    // MARK: - Helper Functions
    
    private mutating func addStringData(_ str: String) -> Int {
        // Calculate offset
        var bytes: [UInt8] = []
        for char in str.utf8 {
            bytes.append(char)
        }
        bytes.append(0)
        
        var offset = 256
        for segment in module.data {
            offset += segment.bytes.count
        }
        
        let data = WASMData(memoryIndex: 0, offset: .i32Const(Int32(offset)), bytes: bytes)
        module.data.append(data)
        
        return offset
    }
}

/// Array layout helper extension
extension ArrayInfo {
    var strides: [Int] {
        guard !dimensions.isEmpty else { return [] }
        
        var strides: [Int] = []
        var currentStride = elementSize
        
        for i in 0..<dimensions.count {
            strides.append(currentStride)
            if i < dimensions.count - 1 {
                currentStride *= dimensions[i]
            }
        }
        
        return strides
    }
}