//
//  ExpressionGeneration.swift
//  Blitz3DCompiler
//
//  Expression compilation for WASM code generation
//

import Foundation

/// Manages expression compilation and code generation
public final class ExpressionGeneration {
    private var context: ModuleContext

    // Type handling
    private let typeHandling = TypeHandling()

    public init(context: ModuleContext) {
        self.context = context
    }

    /// Configure dependencies from context
    public func configure() {
        // No longer caching variables or function map locally
    }

    /// Update context after generation (for side effects like adding data)
    public func updateContext(_ newContext: ModuleContext) {
        self.context = newContext
    }
    
    /// Generate WASM instructions for an expression
    public func generate(_ expr: ExpressionNode) -> [WASMInstruction] {
        return generateWithInfo(expr).instrs
    }
    
    /// Generate WASM instructions along with type information
    public func generateWithInfo(_ expr: ExpressionNode) -> (instrs: [WASMInstruction], type: WASMType) {
        switch expr {
        case .integerLiteral(let value):
            return ([.i32Const(Int32(value))], .i32)
            
        case .floatLiteral(let value):
            return ([.f32Const(Float(value))], .f32)
            
        case .stringLiteral(let value):
            let offset = addStringData(value)
            return ([.i32Const(Int32(offset))], .i32)
            
        case .identifier(let id):
            if let local = context.variableManagement.localInfo(for: id.name) {
                return ([.localGet(local.index)], local.type)
            }
            if let global = context.variableManagement.globalInfo(for: id.name) {
                return ([.globalGet(global.index)], global.type)
            }
            // Auto-declare implicit variable as global (Blitz3D behavior)
            print("DEBUG_COMPILER: Auto-declaring implicit variable '\(id.name)' as global (read)")
            let actualGlobalIdx = context.registerGlobal(type: .i32, mutability: true, initExpr: .i32Const(0))
            _ = context.variableManagement.registerGlobalWithIndex(id.name, type: .i32, typeName: nil, wasmIndex: actualGlobalIdx)
            return ([.globalGet(actualGlobalIdx)], .i32)
            
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
            guard let typeInfo = context.userTypes[typeName] else {
                return ([.i32Const(0)], .i32)
            }
            
            var instrs: [WASMInstruction] = []
            
            // 1. Allocation logic (Pool + Bump fallback)
            // if (freeHead != 0) {
            //   obj = freeHead;
            //   freeHead = obj.next;
            // } else {
            //   obj = heapPointer;
            //   heapPointer += size;
            // }
            
            // Store result in scratch global
            instrs.append(.globalGet(typeInfo.freeHeadGlobalIdx))
            instrs.append(.if(.i32, [
                // Pool Path
                .globalGet(typeInfo.freeHeadGlobalIdx),
                .globalSet(context.scratchGlobalIdx),  // obj = freeHead
                .globalGet(context.scratchGlobalIdx),
                .i32Load(2, 4),  // obj.next
                .globalSet(typeInfo.freeHeadGlobalIdx),  // freeHead = obj.next
                .globalGet(context.scratchGlobalIdx)  // result
            ], [
                // Bump Path
                .globalGet(context.heapPointerIdx),
                .globalSet(context.scratchGlobalIdx),  // obj = heapPointer
                .globalGet(context.scratchGlobalIdx),
                .i32Const(Int32(typeInfo.instanceSize)),
                .i32Add,
                .globalSet(context.heapPointerIdx),  // heapPointer += size
                .globalGet(context.scratchGlobalIdx)  // result
            ]))
            
            // 2. Initialize header
            // obj.prev = last
            instrs.append(.globalGet(context.scratchGlobalIdx))
            instrs.append(.globalGet(typeInfo.lastGlobalIdx))
            instrs.append(.i32Store(2, 0)) // offset 0
            
            // obj.next = 0
            instrs.append(.globalGet(context.scratchGlobalIdx))
            instrs.append(.i32Const(0))
            instrs.append(.i32Store(2, 4)) // offset 4
            
            // obj.typeID = typeID
            instrs.append(.globalGet(context.scratchGlobalIdx))
            instrs.append(.i32Const(Int32(typeInfo.typeID)))
            instrs.append(.i32Store(2, 8)) // offset 8
            
            // 2b. Initialize fields with default values
            for (fieldName, defaultExpr) in typeInfo.fieldDefaults {
                // Skip array fields - they don't get scalar default initialization
                if typeInfo.fieldDimensions[fieldName] != nil {
                    continue
                }
                
                if let fieldOffset = typeInfo.fieldOffsets[fieldName] {
                    // Get field type
                    let fieldTypeStr = typeInfo.fieldTypes[fieldName] ?? "Int"
                    let fieldType = typeHandling.wasmType(from: fieldTypeStr)
                    
                    // Generate default value expression
                    let valueInstrs = generate(defaultExpr)
                    instrs.append(contentsOf: valueInstrs)
                    
                    // Store value in scratch global 2
                    instrs.append(.globalSet(context.scratchGlobal2Idx))
                    
                    // Compute field address: obj + offset
                    instrs.append(.globalGet(context.scratchGlobalIdx))
                    instrs.append(.i32Const(Int32(fieldOffset)))
                    instrs.append(.i32Add)
                    
                    // Load value from scratch global 2
                    instrs.append(.globalGet(context.scratchGlobal2Idx))
                    
                    // Store the value
                    switch fieldType {
                    case .i32:
                        instrs.append(.i32Store(2, 0))
                    case .f32:
                        instrs.append(.f32Store(2, 0))
                    case .i64:
                        instrs.append(.i64Store(2, 0))
                    case .f64:
                        instrs.append(.f64Store(2, 0))
                    default:
                        instrs.append(.i32Store(2, 0))
                    }
                }
            }
            
            // 3. Stitch: if (last != 0) last.next = obj
            instrs.append(.globalGet(typeInfo.lastGlobalIdx))
            instrs.append(.if(.void, [
                .globalGet(typeInfo.lastGlobalIdx),
                .globalGet(context.scratchGlobalIdx),
                .i32Store(2, 4) // last.next = obj
            ], nil))
            
            // if (first == 0) first = obj
            instrs.append(.globalGet(typeInfo.firstGlobalIdx))
            instrs.append(.i32EqZ)
            instrs.append(.if(.void, [
                .globalGet(context.scratchGlobalIdx),
                .globalSet(typeInfo.firstGlobalIdx)
            ], nil))
            
            // last = obj
            instrs.append(.globalGet(context.scratchGlobalIdx))
            instrs.append(.globalSet(typeInfo.lastGlobalIdx))
            
            // return obj
            instrs.append(.globalGet(context.scratchGlobalIdx))
            
            return (instrs, .i32)
            
        case .first(let typeName):
            // First TypeName - get first instance
            if let typeInfo = context.userTypes[typeName] {
                return ([.globalGet(typeInfo.firstGlobalIdx)], .i32)
            }
            return ([.i32Const(0)], .i32)
            
        case .last(let typeName):
            // Last TypeName - get last instance
            if let typeInfo = context.userTypes[typeName] {
                return ([.globalGet(typeInfo.lastGlobalIdx)], .i32)
            }
            return ([.i32Const(0)], .i32)
            
        case .before(let expr):
            // Before expr - get previous instance (offset 0)
            let exprInstrs = generate(expr)
            return (exprInstrs + [.i32Load(2, 0)], .i32)
            
        case .after(let expr):
            // After expr - get next instance (offset 4)
            let exprInstrs = generate(expr)
            return (exprInstrs + [.i32Load(2, 4)], .i32)
            
        case .handle(let expr):
            // Handle(expr) - convert instance to handle
            // In linear memory, instance pointer IS the handle
            let exprInstrs = generate(expr)
            return (exprInstrs, .i32)
            
        case .objectCast(let typeName, let expr):
            // Object.TypeName(handle) - convert handle to instance
            // We should add type safety check here using offset 8 (typeID)
            let exprInstrs = generate(expr)
            var instrs = exprInstrs
            
            // Store handle in scratch global
            instrs.append(.globalSet(context.scratchGlobalIdx))
            
            // Load typeID from the handle
            instrs.append(.globalGet(context.scratchGlobalIdx))
            instrs.append(.i32Load(2, 8)) // load typeID from offset 8
            
            // Check if typeID matches
            if let typeInfo = context.userTypes[typeName] {
                instrs.append(.i32Const(Int32(typeInfo.typeID)))
                instrs.append(.i32Eq)
                instrs.append(.if(.i32, [
                    .globalGet(context.scratchGlobalIdx)  // Return original handle if valid
                ], [
                    .i32Const(0)  // Return 0 if type mismatch
                ]))
            } else {
                // Unknown type, just return the handle
                instrs.append(.globalGet(context.scratchGlobalIdx))
            }
            return (instrs, .i32)
        }
    }
    
    // MARK: - Binary Operations
    
    private func generateBinaryOp(_ binop: BinaryOpNode) -> (instrs: [WASMInstruction], type: WASMType) {
        let leftResult = generateWithInfo(binop.left)
        let rightResult = generateWithInfo(binop.right)
        
        let comparisonOps = ["=", "<>", "<", ">", "<=", ">="]
        let isComparison = comparisonOps.contains(binop.op)
        
        let opType = typeHandling.commonType(leftResult.type, rightResult.type)
        let resultType = isComparison ? .i32 : opType
        
        var instrs = leftResult.instrs
        instrs.append(contentsOf: convert(from: leftResult.type, to: opType))
        
        instrs.append(contentsOf: rightResult.instrs)
        instrs.append(contentsOf: convert(from: rightResult.type, to: opType))
        
        // Generate appropriate instruction based on operator and type
        switch binop.op {
        case "+":
            if typeHandling.isString(from: binop.left) || typeHandling.isString(from: binop.right) {
                // String concatenation
                if let concatIdx = context.functionIndexMap["__stringconcat"] {
                    // Need to reset instrs and rebuild for string call
                    instrs = leftResult.instrs
                    instrs.append(contentsOf: rightResult.instrs)
                    instrs.append(.call(concatIdx))
                    return (instrs, .i32)
                }
            }
            switch opType {
            case .i32: instrs.append(.i32Add)
            case .i64: instrs.append(.i64Add)
            case .f32: instrs.append(.f32Add)
            case .f64: instrs.append(.f64Add)
            default: break
            }
            
        case "-":
            switch opType {
            case .i32: instrs.append(.i32Sub)
            case .i64: instrs.append(.i64Sub)
            case .f32: instrs.append(.f32Sub)
            case .f64: instrs.append(.f64Sub)
            default: break
            }
            
        case "*":
            switch opType {
            case .i32: instrs.append(.i32Mul)
            case .i64: instrs.append(.i64Mul)
            case .f32: instrs.append(.f32Mul)
            case .f64: instrs.append(.f64Mul)
            default: break
            }
            
        case "/":
            switch opType {
            case .i32: instrs.append(.i32DivS)
            case .i64: instrs.append(.i64DivS)
            case .f32: instrs.append(.f32Div)
            case .f64: instrs.append(.f64Div)
            default: break
            }
            
        case "mod":
            instrs.append(.i32RemS)
            
        case "=":
            switch opType {
            case .i32, .i64: instrs.append(.i32Eq)
            case .f32: instrs.append(.f32Eq)
            case .f64: instrs.append(.f64Eq)
            default: break
            }
            return (instrs, .i32)
            
        case "<>":
            switch opType {
            case .i32, .i64: instrs.append(.i32Ne)
            case .f32: instrs.append(.f32Ne)
            case .f64: instrs.append(.f64Ne)
            default: break
            }
            return (instrs, .i32)
            
        case "<":
            switch opType {
            case .i32, .i64: instrs.append(.i32LtS)
            case .f32: instrs.append(.f32Lt)
            case .f64: instrs.append(.f64Lt)
            default: break
            }
            return (instrs, .i32)
            
        case ">":
            switch opType {
            case .i32, .i64: instrs.append(.i32GtS)
            case .f32: instrs.append(.f32Gt)
            case .f64: instrs.append(.f64Gt)
            default: break
            }
            return (instrs, .i32)
            
        case "<=":
            switch opType {
            case .i32, .i64: instrs.append(.i32LeS)
            case .f32: instrs.append(.f32Le)
            case .f64: instrs.append(.f64Le)
            default: break
            }
            return (instrs, .i32)
            
        case ">=":
            switch opType {
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
    
    private func generateUnaryOp(_ unaryOp: UnaryOpNode) -> (instrs: [WASMInstruction], type: WASMType) {
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
    
    private func generateFunctionCall(_ call: FunctionCallNode) -> (instrs: [WASMInstruction], type: WASMType) {
        var instrs: [WASMInstruction] = []
        
        // Map Blitz3D names to internal names
        var internalName = call.name.lowercased()
        if internalName.hasSuffix("$") {
            internalName = String(internalName.dropLast())
        } else if internalName.hasSuffix("#") {
            internalName = String(internalName.dropLast())
        } else if internalName.hasSuffix("%") {
            internalName = String(internalName.dropLast())
        }
        
        let def = context.functionDefinitions[internalName]
        
        // Generate argument instructions
        for (i, arg) in call.arguments.enumerated() {
            let argResult = generateWithInfo(arg)
            instrs.append(contentsOf: argResult.instrs)
            
            if let def = def, i < def.params.count {
                instrs.append(contentsOf: convert(from: argResult.type, to: def.params[i]))
            }
        }
        
        // Push default values for missing optional parameters
        if let def = def, call.arguments.count < def.params.count {
            for i in call.arguments.count..<def.params.count {
                let targetType = def.params[i]
                switch targetType {
                case .i32, .i64: instrs.append(.i32Const(0))
                case .f32: instrs.append(.f32Const(0))
                case .f64: instrs.append(.f64Const(0))
                default: instrs.append(.i32Const(0))
                }
            }
        }
        
        // Call function
        if let funcIdx = context.functionIndexMap[internalName] {
            if internalName == "createcamera" {
                print("DEBUG_COMPILER: Generating call to CreateCamera. Index: \(funcIdx)")
            }
            instrs.append(.call(Int(funcIdx)))
        } else {
            print("DEBUG_COMPILER: WARNING! Function \(internalName) not found in map. Defaulting to 0.")
            instrs.append(.call(0)) // Placeholder
        }
        
        // Determine return type
        var returnType: WASMType = .i32
        if let def = def {
            if let firstResult = def.results.first {
                returnType = firstResult
            } else {
                returnType = .void
            }
        } else if call.name.hasSuffix("#") {
            returnType = .f32
        } else if ["sin", "cos", "tan", "asin", "acos", "atan", "atan2", "exp", "log", "log10", "sqr", "rnd", "entityx", "entityy", "entityz", "entitypitch", "entityyaw", "entityroll", "entitydistance", "collisionx", "collisiony", "collisionz", "collisionnx", "collisionny", "collisionnz"].contains(internalName) {
            returnType = .f32
        }
        
        // If the function returns void but is used in an expression, push a dummy 0
        if returnType == .void {
            instrs.append(.i32Const(0))
            returnType = .i32
        }
        
        return (instrs, returnType)
    }
    
    // MARK: - Array Access
    
    private func generateArrayAccess(_ access: ArrayAccessNode) -> (instrs: [WASMInstruction], type: WASMType) {
        var instrs: [WASMInstruction] = []
        
        // Case 1: Regular array variable (Dim array[10])
        if case .identifier(let arrayId) = access.array,
           let array = context.variableManagement.arrayInfo(for: arrayId.name) {
            instrs.append(.i32Const(Int32(array.baseAddress)))
            
            // Calculate offset
            for (index, indexExpr) in access.indices.enumerated() {
                let indexInstrs = generate(indexExpr)
                instrs.append(contentsOf: indexInstrs)
                
                if index > 0 {
                    // Multiply by stride
                    instrs.append(.i32Const(Int32(array.strides[index])))
                    instrs.append(.i32Mul)
                }
            }
            
            instrs.append(.i32Add)
            
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
        
        // Case 2: Field array access (obj.field[index])
        if case .fieldAccess(let fieldAccess) = access.array {
            if let typeName = getTypeName(from: fieldAccess.object),
               let dimensions = context.fieldDimensions[typeName]?[fieldAccess.field],
               !dimensions.isEmpty {
                
                // Generate the field access to get base pointer
                let baseInstrs = generate(.fieldAccess(fieldAccess))
                instrs.append(contentsOf: baseInstrs)
                
                // Get element type and size
                let fieldType = context.userTypes[typeName]?.fieldTypes[fieldAccess.field] ?? "Int"
                let elementType = typeHandling.wasmType(from: fieldType)
                let elementSize = context.typeSize(for: elementType)
                
                // For 1D array: address = base + index * elementSize
                // For multi-dimensional, we'd need strides
                // Simplified: assume 1D or row-major for now
                if access.indices.count >= 1 {
                    let indexInstrs = generate(access.indices[0])
                    instrs.append(contentsOf: indexInstrs)
                    
                    if elementSize != 4 {
                        instrs.append(.i32Const(Int32(elementSize)))
                        instrs.append(.i32Mul)
                    }
                    
                    instrs.append(.i32Add)
                }
                
                // Load the element value
                switch elementType {
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
                
                return (instrs, elementType)
            }
        }
        
        return ([.i32Const(0)], .i32)
    }
    
    // MARK: - Field Access
    
    private func generateFieldAccess(_ access: FieldAccessNode) -> (instrs: [WASMInstruction], type: WASMType) {
        var instrs: [WASMInstruction] = []
        
        // Get object pointer
        let objectInstrs = generate(access.object)
        instrs.append(contentsOf: objectInstrs)
        
        // Add field offset
        if let typeName = getTypeName(from: access.object),
           let fieldOffset = context.fieldOffsets[typeName]?[access.field] {
            instrs.append(.i32Const(Int32(fieldOffset)))
            instrs.append(.i32Add)
            
            // Check if this field is an array
            let fieldDimensions = context.fieldDimensions[typeName]?[access.field]
            let fieldType = context.userTypes[typeName]?.fieldTypes[access.field] ?? "Int"
            let wasmType = typeHandling.wasmType(from: fieldType)
            
            // If field is an array, return address (pointer to array base)
            // The ArrayAccess generator will handle indexing
            if fieldDimensions != nil && !fieldDimensions!.isEmpty {
                // Return the address as i32 (pointer to the array)
                return (instrs, .i32)
            }
            
            // For scalar fields, load the value
            switch wasmType {
            case .i32: instrs.append(.i32Load(2, 0))
            case .f32: instrs.append(.f32Load(2, 0))
            case .i64: instrs.append(.i64Load(2, 0))
            case .f64: instrs.append(.f64Load(2, 0))
            default: instrs.append(.i32Load(2, 0))
            }
            return (instrs, wasmType)
        }
        
        return ([.i32Const(0)], .i32)
    }
    
    // MARK: - Type Cast
    
    private func generateTypeCast(_ cast: TypeCastNode) -> (instrs: [WASMInstruction], type: WASMType) {
        let exprInstrs = generate(cast.expression)
        let targetType = typeHandling.typeInfo(from: cast.targetType.rawValue).wasmType
        return (exprInstrs, targetType)
    }
    
    // MARK: - Helper Functions
    
    private func convert(from source: WASMType, to target: WASMType) -> [WASMInstruction] {
        if source == target { return [] }
        
        switch (source, target) {
        case (.i32, .f32): return [.f32ConvertI32S]
        case (.f32, .i32): return [.i32TruncF32S]
        case (.i32, .i64): return [.i64ExtendI32S]
        case (.i64, .i32): return [.i32WrapI64]
        case (.f32, .f64): return [.f64PromoteF32]
        case (.f64, .f32): return [.f32DemoteF64]
        default: return []
        }
    }
    
    private func getTypeName(from expr: ExpressionNode) -> String? {
        switch expr {
        case .identifier(let id):
            if let local = context.variableManagement.localInfo(for: id.name) {
                return local.typeName
            }
            if let global = context.variableManagement.globalInfo(for: id.name) {
                return global.typeName
            }
        case .fieldAccess(let access):
            if let objType = getTypeName(from: access.object),
               let fieldType = context.userTypes[objType]?.fieldTypes[access.field] {
                return fieldType
            }
        case .new(let type):
            return type
        case .first(let type):
            return type
        case .last(let type):
            return type
        case .before(let subExpr):
            return getTypeName(from: subExpr)
        case .after(let subExpr):
            return getTypeName(from: subExpr)
        case .objectCast(let type, _):
            return type
        default:
            break
        }
        return nil
    }

    private func addStringData(_ str: String) -> Int {
        var bytes: [UInt8] = []
        
        // 1. Add RefCount (4 bytes)
        bytes.append(contentsOf: [0x01, 0x00, 0x00, 0x00])
        
        // 2. Add Length (4 bytes)
        let utf8Bytes = Array(str.utf8)
        let len = Int32(utf8Bytes.count)
        bytes.append(UInt8(len & 0xFF))
        bytes.append(UInt8((len >> 8) & 0xFF))
        bytes.append(UInt8((len >> 16) & 0xFF))
        bytes.append(UInt8((len >> 24) & 0xFF))
        
        // 3. Add Data
        bytes.append(contentsOf: utf8Bytes)
        
        // 4. Add Null Terminator
        bytes.append(0)

        var offset = 256
        for segment in context.module.data {
            offset += segment.bytes.count
        }

        let data = WASMData(memoryIndex: 0, offset: .i32Const(Int32(offset)), bytes: bytes)
        context.module.data.append(data)

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