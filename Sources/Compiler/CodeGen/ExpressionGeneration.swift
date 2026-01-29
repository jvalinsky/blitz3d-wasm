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
    public func generateWithInfo(_ expr: ExpressionNode, allowVoidAsValue: Bool = false) -> (instrs: [WASMInstruction], type: WASMType) {
        switch expr {
        case .integerLiteral(let value, _):
            return ([.i32Const(Int32(truncatingIfNeeded: value))], .i32)
            
        case .floatLiteral(let value, _):
            return ([.f32Const(Float(value))], .f32)
            
        case .stringLiteral(let value, _):
            let offset = addStringData(value)
            return ([.i32Const(Int32(truncatingIfNeeded: offset))], .i32)
            
        case .identifier(let id, _):
            if let local = context.variableManagement.localInfo(for: id.name) {
                return ([.localGet(local.index)], local.type)
            }
            if let global = context.variableManagement.globalInfo(for: id.name) {
                return ([.globalGet(global.index)], global.type)
            }
            // Auto-declare implicit variable as global (Blitz3D behavior)
            CompilerLogger.debug("DEBUG_COMPILER: Auto-declaring implicit variable '\(id.name)' as global (read)")
            
            // CRITICAL FIX: Infer type using forward scanning first
            // This handles cases like: ScrollMenuHeight used without suffix, then ScrollMenuHeight# = ...
            let wasmType: WASMType
            
            // Strategy 1: Try forward scanning for type hints
            if let inferredType = context.typeInference.inferVariableType(
                name: id.name,
                fromStatements: context.currentFunctionBody
            ) {
                wasmType = inferredType
                CompilerLogger.debug("  → Inferred from forward scan: \(wasmType)")
            }
            // Strategy 2: Check type suffix on current use
            else if let suffix = id.typeSuffix {
                wasmType = typeHandling.wasmType(from: suffix)
                CompilerLogger.debug("  → Inferred from suffix: \(wasmType)")
            }
            // Strategy 3: Default to i32
            else {
                wasmType = typeHandling.typeInfo(from: id.name).wasmType
                CompilerLogger.debug("  → Inferred from name (default): \(wasmType)")
            }
            
            let actualGlobalIdx = context.registerGlobalWithDefaultInit(type: wasmType, mutability: true)
            _ = context.variableManagement.registerGlobalWithIndex(id.name, type: wasmType, typeName: nil, wasmIndex: actualGlobalIdx)
            return ([.globalGet(actualGlobalIdx)], wasmType)
            
        case .binary(let binop, _):
            return generateBinaryOp(binop)
            
        case .unary(let unaryOp, _):
            return generateUnaryOp(unaryOp)
            
        case .functionCall(let call, _):
            return generateFunctionCall(call, allowVoidAsValue: allowVoidAsValue)
            
        case .arrayAccess(let access, _):
            return generateArrayAccess(access)
            
        case .fieldAccess(let access, _):
            return generateFieldAccess(access)
            
        case .typeCast(let cast, _):
            return generateTypeCast(cast)
            
        case .new(let typeName, _):
            // new TypeName() - allocate instance
            guard let typeInfo = context.userTypes[typeName.lowercased()] else {
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
            
            // Store result in scratch global (no stack result needed - we use the global)
            instrs.append(.globalGet(typeInfo.freeHeadGlobalIdx))
            instrs.append(.if(.void, [
                // Pool Path
                .globalGet(typeInfo.freeHeadGlobalIdx),
                .globalSet(context.scratchGlobalIdx),  // obj = freeHead
                .globalGet(context.scratchGlobalIdx),
                .i32Load(2, 4),  // obj.next
                .globalSet(typeInfo.freeHeadGlobalIdx)  // freeHead = obj.next
            ], [
                // Bump Path
                .globalGet(context.heapPointerIdx),
                .globalSet(context.scratchGlobalIdx),  // obj = heapPointer
                .globalGet(context.scratchGlobalIdx),
                .i32Const(Int32(truncatingIfNeeded: typeInfo.instanceSize)),
                .i32Add,
                .globalSet(context.heapPointerIdx)  // heapPointer += size
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
            instrs.append(.i32Const(Int32(truncatingIfNeeded: typeInfo.typeID)))
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
                    
                    // Generate default value expression with type info
                    let valueResult = generateWithInfo(defaultExpr)
                    instrs.append(contentsOf: valueResult.instrs)
                    
                    // Convert to field type if needed
                    if valueResult.type != fieldType {
                        instrs.append(contentsOf: convert(from: valueResult.type, to: fieldType))
                    }
                    
                    // Store value in appropriate scratch global based on type
                    let scratchIdx = (fieldType == .f32 || fieldType == .f64) 
                        ? context.scratchGlobalFloatIdx 
                        : context.scratchGlobal2Idx
                    instrs.append(.globalSet(scratchIdx))
                    
                    // Compute field address: obj + offset
                    instrs.append(.globalGet(context.scratchGlobalIdx))
                    instrs.append(.i32Const(Int32(truncatingIfNeeded: fieldOffset)))
                    instrs.append(.i32Add)
                    
                    // Load value from appropriate scratch global
                    instrs.append(.globalGet(scratchIdx))
                    
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
            
        case .first(let typeName, _):
            // First TypeName - get first instance
            if let typeInfo = context.userTypes[typeName.lowercased()] {
                return ([.globalGet(typeInfo.firstGlobalIdx)], .i32)
            }
            return ([.i32Const(0)], .i32)
            
        case .last(let typeName, _):
            // Last TypeName - get last instance
            if let typeInfo = context.userTypes[typeName.lowercased()] {
                return ([.globalGet(typeInfo.lastGlobalIdx)], .i32)
            }
            return ([.i32Const(0)], .i32)
            
        case .before(let expr, _):
            // Before expr - get previous instance (offset 0)
            let exprInstrs = generate(expr)
            return (exprInstrs + [.i32Load(2, 0)], .i32)
            
        case .after(let expr, _):
            // After expr - get next instance (offset 4)
            let exprInstrs = generate(expr)
            return (exprInstrs + [.i32Load(2, 4)], .i32)
            
        case .handle(let expr, _):
            // Handle(expr) - convert instance to handle
            // In linear memory, instance pointer IS the handle
            let exprInstrs = generate(expr)
            return (exprInstrs, .i32)
            
        case .objectCast(let typeName, let expr, _):
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
            if let typeInfo = context.userTypes[typeName.lowercased()] {
                instrs.append(.i32Const(Int32(truncatingIfNeeded: typeInfo.typeID)))
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
        

        // Determine operation type with strict float promotion
        // Bitwise ops ALWAYS use i32, regardless of operand types
        let bitwiseOps = ["and", "or", "xor", "shl", "shr"]
        let isBitwise = bitwiseOps.contains(binop.op.lowercased())
        
        var opType = isBitwise ? .i32 : typeHandling.commonType(leftResult.type, rightResult.type)
        if !isBitwise && (leftResult.type == .f32 || rightResult.type == .f32) {
             if opType != .f64 { opType = .f32 }
        }
        if binop.op.lowercased() == "pow" {
            // Force pow to operate in f32 to match runtime import signature
            opType = .f32
        }

        let comparisonOps = ["=", "<>", "<", ">", "<=", ">="]
        let isComparison = comparisonOps.contains(binop.op)
        let resultType = isComparison ? .i32 : opType
        
        var instrs = leftResult.instrs
        instrs.append(contentsOf: convert(from: leftResult.type, to: opType))
        
        instrs.append(contentsOf: rightResult.instrs)
        instrs.append(contentsOf: convert(from: rightResult.type, to: opType))
        
        // Generate appropriate instruction based on operator and type
        switch binop.op.lowercased() {
        case "+":
            if typeHandling.isString(from: binop.left) || typeHandling.isString(from: binop.right) {
                // String concatenation
                if let concatIdx = context.functionIndexMap["__stringconcat"] {
                    // Need to reset instrs and rebuild for string call
                    instrs = []
                    
                    // Left operand
                    instrs.append(contentsOf: leftResult.instrs)
                    if !typeHandling.isString(from: binop.left) {
                        if leftResult.type == .i32 {
                            if let intToStrIdx = context.functionIndexMap["inttostring"] {
                                instrs.append(.call(intToStrIdx))
                            }
                        } else if leftResult.type == .f32 {
                            if let floatToStrIdx = context.functionIndexMap["floattostring"] {
                                instrs.append(.call(floatToStrIdx))
                            }
                        }
                    }
                    
                    // Right operand
                    instrs.append(contentsOf: rightResult.instrs)
                    if !typeHandling.isString(from: binop.right) {
                        if rightResult.type == .i32 {
                            if let intToStrIdx = context.functionIndexMap["inttostring"] {
                                instrs.append(.call(intToStrIdx))
                            }
                        } else if rightResult.type == .f32 {
                            if let floatToStrIdx = context.functionIndexMap["floattostring"] {
                                instrs.append(.call(floatToStrIdx))
                            }
                        }
                    }
                    
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
            if opType == .f32 {
                // x - y * trunc(x / y)
                // We use the already generated and converted instrs for left/right
                // but we need to rearrange them.
                // Current instrs has [left] [right]
                // We'll use scratch globals to make it cleaner.
                
                // Clear and rebuild for mod
                instrs = []
                
                // Left operand (x)
                instrs.append(contentsOf: leftResult.instrs)
                instrs.append(contentsOf: convert(from: leftResult.type, to: .f32))
                instrs.append(.globalSet(context.scratchGlobalFloatIdx))
                
                // Right operand (y)
                instrs.append(contentsOf: rightResult.instrs)
                instrs.append(contentsOf: convert(from: rightResult.type, to: .f32))
                instrs.append(.globalSet(context.scratchGlobalFloat2Idx))
                
                // Stack: x - y * trunc(x / y)
                instrs.append(.globalGet(context.scratchGlobalFloatIdx))  // [x]
                instrs.append(.globalGet(context.scratchGlobalFloat2Idx)) // [x, y]
                instrs.append(.globalGet(context.scratchGlobalFloatIdx))  // [x, y, x]
                instrs.append(.globalGet(context.scratchGlobalFloat2Idx)) // [x, y, x, y]
                instrs.append(.f32Div)                                   // [x, y, x/y]
                instrs.append(.f32Trunc)                                  // [x, y, trunc(x/y)]
                instrs.append(.f32Mul)                                   // [x, y*trunc(x/y)]
                instrs.append(.f32Sub)                                   // [x - y*trunc(x/y)]
            } else if opType == .f64 {
                // Similar for f64 if we had scratchGlobalDoubleIdx
                // For now, fall back to i32 if not f32
                instrs.append(.i32RemS)
            } else {
                instrs.append(.i32RemS)
            }
            
        case "=":
            if typeHandling.isString(from: binop.left) || typeHandling.isString(from: binop.right) {
                if let equalIdx = context.functionIndexMap["stringequal"] {
                    instrs = leftResult.instrs
                    instrs.append(contentsOf: rightResult.instrs)
                    instrs.append(.call(equalIdx))
                    return (instrs, .i32)
                }
            }
            switch opType {
            case .i32, .i64: instrs.append(.i32Eq)
            case .f32: instrs.append(.f32Eq)
            case .f64: instrs.append(.f64Eq)
            default: break
            }
            return (instrs, .i32)
            
        case "<>":
            if typeHandling.isString(from: binop.left) || typeHandling.isString(from: binop.right) {
                if let equalIdx = context.functionIndexMap["stringequal"] {
                    instrs = leftResult.instrs
                    instrs.append(contentsOf: rightResult.instrs)
                    instrs.append(.call(equalIdx))
                    instrs.append(.i32EqZ) // Not equal if stringequal returns 0
                    return (instrs, .i32)
                }
            }
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
            
        case "pow", "^":
            // Convert both operands to f32 for pow
            instrs = []
            instrs.append(contentsOf: leftResult.instrs)
            instrs.append(contentsOf: convert(from: leftResult.type, to: .f32))
            instrs.append(contentsOf: rightResult.instrs)
            instrs.append(contentsOf: convert(from: rightResult.type, to: .f32))
            if let powIdx = context.functionIndexMap["pow"] {
                instrs.append(.call(powIdx))
            } else {
                // Fallback: import pow if available from env
                let powIdx = context.registerAutoImport(name: "pow", params: [.f32, .f32], results: [.f32])
                instrs.append(.call(powIdx))
            }
            return (instrs, .f32)
            
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
    
    private func generateFunctionCall(_ call: FunctionCallNode, allowVoidAsValue: Bool) -> (instrs: [WASMInstruction], type: WASMType) {
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
        
        // Check if this is actually an array access (Blitz3D uses parentheses for both)
        // Arrays are declared with Dim and tracked in variableManagement
        if let array = context.variableManagement.arrayInfo(for: internalName) {
            // This is an array access, not a function call
            // Generate array read using the arguments as indices
            instrs.append(.i32Const(Int32(truncatingIfNeeded: array.baseAddress)))
            
            let strides = array.strides
            for (index, indexExpr) in call.arguments.enumerated() {
                let indexResult = generateWithInfo(indexExpr)
                instrs.append(contentsOf: indexResult.instrs)
                instrs.append(contentsOf: convert(from: indexResult.type, to: .i32))
                
                // Multiply by stride for this dimension
                let stride = index < strides.count ? strides[index] : array.elementSize
                instrs.append(.i32Const(Int32(truncatingIfNeeded: stride)))
                instrs.append(.i32Mul)
                
                // Add to running offset
                if index > 0 {
                    instrs.append(.i32Add)
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
        
        let signatureResolver = SignatureResolver(context: context)
        let def = signatureResolver.definition(forName: internalName)
        
        // Generate argument instructions
        // Call function
        var returnType: WASMType = .i32
        var actualWasmReturnType: WASMType = .void
        
		        if let funcIdx = context.functionIndexMap[internalName] {
            if internalName == "createcamera" {
                CompilerLogger.debug("DEBUG_COMPILER: Generating call to CreateCamera. Index: \(funcIdx)")
            }
            
	            // Resolve imported function type (available immediately) for accurate arity/types.
	            // For local (user-defined) functions, rely on pre-registered signatures (forward calls must work
	            // even before the function body is emitted into module.functions).
	            func getImportedFunctionType(funcIndex: Int) -> WASMFunctionType? {
	                var functionImportIndex = 0
	                for imp in context.module.imports {
	                    guard imp.kind == .function else { continue }
	                    if functionImportIndex == funcIndex {
	                        let typeIdx = imp.index
	                        guard typeIdx >= 0 && typeIdx < context.module.types.count else { return nil }
	                        return context.module.types[typeIdx]
	                    }
	                    functionImportIndex += 1
	                }
	                return nil
	            }
	            
		            let importedType = getImportedFunctionType(funcIndex: Int(funcIdx))

                    if context.enableCommandBufferABI,
                       let lowered = generateCommandBufferLowering(
                        internalName: internalName,
                        call: call,
                        funcIdx: Int(funcIdx),
                        def: def,
                        importedType: importedType
                       ) {
                        return lowered
                    }
		            
		            // Handle Extra Arguments (Stack Imbalance Fix)
		            var expectedArgCount = call.arguments.count
		            if let importedType {
		                expectedArgCount = importedType.parameters.count
	            } else if let def = def {
	                expectedArgCount = def.params.count
	            }

	            // Re-implement argument generation loop to be safer
	            instrs = [] // Reset instructions from previous loop
	            let argsToPush = min(call.arguments.count, expectedArgCount)

            // 1. Generate arguments that WILL be consumed
            for i in 0..<argsToPush {
                let argResult = generateWithInfo(call.arguments[i])
                instrs.append(contentsOf: argResult.instrs)

                // CRITICAL FIX: Always attempt type conversion
                var targetType: WASMType?

	                // Strategy 1: Use resolved signature definition (most accurate)
	                if let def = def, i < def.params.count {
	                    targetType = def.params[i]
	                }
	                // Strategy 2: Fall back to imported WASM type (handles missing defs for imports)
	                else if let importedType, i < importedType.parameters.count {
	                    targetType = importedType.parameters[i]
	                }

                // Apply conversion if we have a target type
                if let targetType = targetType, argResult.type != targetType {
                    CompilerLogger.debug("DEBUG_ARG_CONVERT: \(call.name) arg[\(i)] converting \(argResult.type) -> \(targetType)")
                    instrs.append(contentsOf: convert(from: argResult.type, to: targetType))
                } else if targetType == nil {
                    CompilerLogger.debug("DEBUG_ARG_WARNING: \(call.name) arg[\(i)] has unknown target type, passing \(argResult.type) as-is")
                }
            }
            
            // 2. Generate side-effects for extra arguments but DROP results immediately
            for i in argsToPush..<call.arguments.count {
                CompilerLogger.debug("DEBUG_COMPILER: Dropping extra argument \(i) for \(internalName)")
                let argResult = generateWithInfo(call.arguments[i])
                instrs.append(contentsOf: argResult.instrs)
                if argResult.type != .void {
                    instrs.append(.drop)
                }
            }
            
	            // Pad missing args to match signature for imports (auto-imports rely on this)
	            let targetParamCount = importedType?.parameters.count ?? def?.params.count ?? call.arguments.count
	            if call.arguments.count < targetParamCount {
	                let padCount = targetParamCount - call.arguments.count
                for i in 0..<padCount {
                    let paramIdx = call.arguments.count + i
                    if let def = def, paramIdx < def.params.count {
                        if let defaultExpr = def.defaults?[paramIdx] {
                            // Generate code for the default value
                            let result = generateWithInfo(defaultExpr)
                            instrs.append(contentsOf: result.instrs)
                            
                            // Coerce to expected parameter type if needed
                            if result.type != def.params[paramIdx] {
                                instrs.append(contentsOf: convert(from: result.type, to: def.params[paramIdx]))
                            }
                        } else {
                            // Fallback to zero if no default value provided
                            switch def.params[paramIdx] {
                            case .f32: instrs.append(.f32Const(0))
                            default: instrs.append(.i32Const(0))
                            }
                        }
                    } else {
                        instrs.append(.i32Const(0))
                    }
                }
            }

	            instrs.append(.call(Int(funcIdx)))

	            // Determine ACTUAL return type.
	            // - Imports: trust the module type (available immediately and authoritative for validation).
	            // - Locals: trust the pre-registered signature (forward calls happen before module.functions is populated).
	            if let importedType {
	                actualWasmReturnType = importedType.results.first ?? .void
	            } else if let def = def {
	                actualWasmReturnType = def.results.first ?? .void
	            } else if let idxDef = context.functionDefinitionsByIndex[Int(funcIdx)] {
	                actualWasmReturnType = idxDef.results.first ?? .void
	            } else {
	                actualWasmReturnType = .void
	            }
	            
	            // Determine the language-visible return type, but never pretend a void-returning WASM function returns a value.
	            // The module signature is the validation source-of-truth.
	            returnType = actualWasmReturnType
	            if actualWasmReturnType != .void, let defReturnType = def?.results.first, defReturnType != .void {
	                returnType = defReturnType
	            }
	            
	            // If truth != visible type, convert (only meaningful when a value is actually produced).
	            if actualWasmReturnType != .void, actualWasmReturnType != returnType {
	                instrs.append(contentsOf: convert(from: actualWasmReturnType, to: returnType))
	            }

	        } else {
            // Function not found - same fallback logic
            CompilerLogger.warn("DEBUG_COMPILER: WARNING! Function \(internalName) not found in map. Defaulting to 0/0.0.")
            // Re-generate args and drop them (simulated side effects)
            instrs = [] 
            for arg in call.arguments {
                let res = generateWithInfo(arg)
                instrs.append(contentsOf: res.instrs)
                if res.type != .void {
                    instrs.append(.drop)
                }
            }
            
            if internalName.hasSuffix("#") || 
               internalName.hasSuffix("value") || 
               ["distance", "min", "max", "abs", "sgn", "ceil", "floor"].contains(internalName) {
                instrs.append(.f32Const(0.0)) 
                returnType = .f32
            } else {
                instrs.append(.i32Const(0))
                returnType = .i32
            }
        }
        
        // If a void-returning call is used in a value context, coerce with a warning to keep stack sane
        var finalType = returnType
        if finalType == .void && !allowVoidAsValue {
            context.reportDiagnostic(
                "Function '\(call.name)' returns void but is used in a value context",
                span: call.span
            )
            // Preserve stack safety so later codegen can continue, but mark as an error.
            instrs.append(.i32Const(0))
            finalType = .i32
        }
        
        return (instrs, finalType)
    }

    // MARK: - Track B: Command Buffer ABI lowerings

    private func generateCommandBufferLowering(
        internalName: String,
        call: FunctionCallNode,
        funcIdx: Int,
        def: FunctionDefinition?,
        importedType: WASMFunctionType?
    ) -> (instrs: [WASMInstruction], type: WASMType)? {
        guard context.cmdBufPtrGlobalIdx >= 0 else { return nil }

        switch internalName {
        case "createcube":
            return generateCmdCreateEntity(call: call, funcIdx: funcIdx, def: def, importedType: importedType, entityType: 1)
        case "createmesh":
            return generateCmdCreateEntity(call: call, funcIdx: funcIdx, def: def, importedType: importedType, entityType: 2)
        case "freeentity":
            return generateCmdDestroyEntity(call: call, funcIdx: funcIdx, def: def, importedType: importedType)
        case "hideentity":
            return generateCmdSetVisibility(call: call, funcIdx: funcIdx, def: def, importedType: importedType, visible: 0)
        case "showentity":
            return generateCmdSetVisibility(call: call, funcIdx: funcIdx, def: def, importedType: importedType, visible: 1)
        case "positionentity":
            return generateCmdSetPosition(call: call, funcIdx: funcIdx, def: def, importedType: importedType)
        case "rotateentity":
            return generateCmdSetRotationEuler(call: call, funcIdx: funcIdx, def: def, importedType: importedType)
        case "scaleentity":
            return generateCmdSetScale(call: call, funcIdx: funcIdx, def: def, importedType: importedType)
        case "moveentity":
            return generateCmdMoveEntity(call: call, funcIdx: funcIdx, def: def, importedType: importedType)
        case "turnentity":
            return generateCmdTurnEntity(call: call, funcIdx: funcIdx, def: def, importedType: importedType)
        case "entityparent":
            return generateCmdSetParent(call: call, funcIdx: funcIdx, def: def, importedType: importedType)
        case "entityx":
            return generateCmdGetEntPosF32(call: call, funcIdx: funcIdx, def: def, importedType: importedType, component: 0)
        case "entityy":
            return generateCmdGetEntPosF32(call: call, funcIdx: funcIdx, def: def, importedType: importedType, component: 1)
        case "entityz":
            return generateCmdGetEntPosF32(call: call, funcIdx: funcIdx, def: def, importedType: importedType, component: 2)
        case "entitypitch":
            return generateCmdGetEntF32(call: call, funcIdx: funcIdx, def: def, importedType: importedType, byteOffset: 20)
        case "entityyaw":
            return generateCmdGetEntF32(call: call, funcIdx: funcIdx, def: def, importedType: importedType, byteOffset: 24)
        case "entityroll":
            return generateCmdGetEntF32(call: call, funcIdx: funcIdx, def: def, importedType: importedType, byteOffset: 28)
        case "entityvisible":
            return generateCmdGetEntI32(call: call, funcIdx: funcIdx, def: def, importedType: importedType, byteOffset: 4)
        default:
            return nil
        }
    }

    private func expectedParamCount(def: FunctionDefinition?, importedType: WASMFunctionType?, fallback: Int) -> Int {
        if let importedType { return importedType.parameters.count }
        if let def { return def.params.count }
        return fallback
    }

    private func paramType(def: FunctionDefinition?, importedType: WASMFunctionType?, index: Int) -> WASMType? {
        if let def, index < def.params.count { return def.params[index] }
        if let importedType, index < importedType.parameters.count { return importedType.parameters[index] }
        return nil
    }

    private func emitPaddedArgsStored(
        call: FunctionCallNode,
        def: FunctionDefinition?,
        importedType: WASMFunctionType?,
        expectedCount: Int,
        stores: [Int: (global: Int, type: WASMType)]
    ) -> [WASMInstruction] {
        var instrs: [WASMInstruction] = []

        let argsToPush = min(call.arguments.count, expectedCount)

        for i in 0..<argsToPush {
            let argResult = generateWithInfo(call.arguments[i])
            instrs.append(contentsOf: argResult.instrs)

            let targetType = paramType(def: def, importedType: importedType, index: i)
            if let targetType, argResult.type != targetType {
                instrs.append(contentsOf: convert(from: argResult.type, to: targetType))
            }

            if let store = stores[i] {
                instrs.append(.globalSet(store.global))
            } else if argResult.type != .void {
                instrs.append(.drop)
            }
        }

        // Extra arguments (side effects only)
        for i in argsToPush..<call.arguments.count {
            let argResult = generateWithInfo(call.arguments[i])
            instrs.append(contentsOf: argResult.instrs)
            if argResult.type != .void { instrs.append(.drop) }
        }

        // Pad missing args to match signature
        if call.arguments.count < expectedCount {
            for paramIdx in call.arguments.count..<expectedCount {
                let t = paramType(def: def, importedType: importedType, index: paramIdx) ?? .i32
                if let defaultExpr = def?.defaults?[paramIdx] {
                    let r = generateWithInfo(defaultExpr)
                    instrs.append(contentsOf: r.instrs)
                    if r.type != t {
                        instrs.append(contentsOf: convert(from: r.type, to: t))
                    }
                } else {
                    switch t {
                    case .f32: instrs.append(.f32Const(0))
                    default: instrs.append(.i32Const(0))
                    }
                }

                if let store = stores[paramIdx] {
                    instrs.append(.globalSet(store.global))
                } else {
                    // Preserve side effects, but don't leave values on stack.
                    if t != .void { instrs.append(.drop) }
                }
            }
        }

        return instrs
    }

    private func emitFallbackImportCall(funcIdx: Int, paramStores: [(global: Int, type: WASMType)]) -> [WASMInstruction] {
        var instrs: [WASMInstruction] = []
        for s in paramStores {
            instrs.append(.globalGet(s.global))
        }
        instrs.append(.call(funcIdx))
        return instrs
    }

    // Track B: EntityX/Y/Z with global-space support (uses WASM authoritative parent + local transforms).
    // component: 0=x, 1=y, 2=z
    private func generateCmdGetEntPosF32(
        call: FunctionCallNode,
        funcIdx: Int,
        def: FunctionDefinition?,
        importedType: WASMFunctionType?,
        component: Int
    ) -> (instrs: [WASMInstruction], type: WASMType) {
        let expected = expectedParamCount(def: def, importedType: importedType, fallback: 2)
        let entG = context.scratchGlobalIdx
        let globalG = context.scratchGlobal2Idx
        let stores: [Int: (global: Int, type: WASMType)] = [
            0: (entG, .i32),
            1: (globalG, .i32),
        ]

        var instrs: [WASMInstruction] = []
        instrs.append(contentsOf: emitPaddedArgsStored(call: call, def: def, importedType: importedType, expectedCount: expected, stores: stores))

        let fallback = emitFallbackImportCall(funcIdx: funcIdx, paramStores: [(entG, .i32), (globalG, .i32)])

        guard context.cmdBufPtrGlobalIdx >= 0 else {
            instrs.append(contentsOf: fallback)
            return (instrs, .f32)
        }

        let basePtrG = context.cmdBufPtrGlobalIdx
        let entPtrG = context.scratchGlobal3Idx
        let parentIdG = context.scratchGlobal4Idx

        let xG = context.scratchGlobalFloatIdx
        let yG = context.scratchGlobalFloat2Idx
        let zG = context.scratchGlobalFloat3Idx

        let tmp0 = context.scratchGlobalFloat4Idx
        let tmp1 = context.scratchGlobalFloat5Idx
        let tmp2 = context.scratchGlobalFloat6Idx

        // Offsets in entity slot
        let offParent: Int32 = 0
        let offPosX: Int32 = 8
        let offPosY: Int32 = 12
        let offPosZ: Int32 = 16
        let offPitch: Int32 = 20
        let offYaw: Int32 = 24
        let offRoll: Int32 = 28
        let offSx: Int32 = 32
        let offSy: Int32 = 36
        let offSz: Int32 = 40

        let cosIdx = context.functionIndexMap["cos"] ?? -1
        let sinIdx = context.functionIndexMap["sin"] ?? -1

        // body when cmdbuf enabled
        let elseBranch: [WASMInstruction] = {
            var b: [WASMInstruction] = []
            b.append(contentsOf: emitEnsureEntityStateTable())
            b.append(contentsOf: emitEntPtrToScratch(entIdGlobal: entG))
            b.append(.globalGet(entPtrG))
            b.append(.i32EqZ)
            b.append(.if(.f32, fallback, {
                // if (global == 0) return local
                let localLoad: [WASMInstruction] = {
                    let off: Int32 = component == 0 ? offPosX : (component == 1 ? offPosY : offPosZ)
                    return [.globalGet(entPtrG), .f32Load(2, Int(off))]
                }()

                // global-space: walk parent chain and apply parent transforms to position
                var globalLoad: [WASMInstruction] = []

                // init current pos from local
                globalLoad.append(.globalGet(entPtrG)); globalLoad.append(.f32Load(2, Int(offPosX))); globalLoad.append(.globalSet(xG))
                globalLoad.append(.globalGet(entPtrG)); globalLoad.append(.f32Load(2, Int(offPosY))); globalLoad.append(.globalSet(yG))
                globalLoad.append(.globalGet(entPtrG)); globalLoad.append(.f32Load(2, Int(offPosZ))); globalLoad.append(.globalSet(zG))
                // parentId = *(i32*)(ent+0)
                globalLoad.append(.globalGet(entPtrG)); globalLoad.append(.i32Load(2, Int(offParent))); globalLoad.append(.globalSet(parentIdG))

                // reuse globalG as depth counter (clobber OK in global branch)
                globalLoad.append(.i32Const(0))
                globalLoad.append(.globalSet(globalG))

                // block { loop { ... } }
                globalLoad.append(.block(.void, [
                    .loop(.void, {
                        var loopBody: [WASMInstruction] = []

                        // if (parentId == 0) break
                        loopBody.append(.globalGet(parentIdG))
                        loopBody.append(.i32EqZ)
                        loopBody.append(.brIf(1))

                        // if (depth >= 32) break
                        loopBody.append(.globalGet(globalG))
                        loopBody.append(.i32Const(32))
                        loopBody.append(.i32GeU)
                        loopBody.append(.brIf(1))

                        // depth++
                        loopBody.append(.globalGet(globalG))
                        loopBody.append(.i32Const(1))
                        loopBody.append(.i32Add)
                        loopBody.append(.globalSet(globalG))

                        // parentPtr = entStatePtr + parentId*slotBytes (emitEntPtrToScratch writes to entPtrG)
                        loopBody.append(contentsOf: emitEntPtrToScratch(entIdGlobal: parentIdG))
                        // if (parentPtr == 0) break
                        loopBody.append(.globalGet(entPtrG))
                        loopBody.append(.i32EqZ)
                        loopBody.append(.brIf(1))

                        // Apply parent scale
                        loopBody.append(contentsOf: [.globalGet(xG), .globalGet(entPtrG), .f32Load(2, Int(offSx)), .f32Mul, .globalSet(xG)])
                        loopBody.append(contentsOf: [.globalGet(yG), .globalGet(entPtrG), .f32Load(2, Int(offSy)), .f32Mul, .globalSet(yG)])
                        loopBody.append(contentsOf: [.globalGet(zG), .globalGet(entPtrG), .f32Load(2, Int(offSz)), .f32Mul, .globalSet(zG)])

                        // Apply parent rotation in Blitz3D order: Ry * Rx * Rz * v
                        // This means apply Z (roll) first, then X (pitch), then Y (yaw)
                        if cosIdx >= 0 && sinIdx >= 0 {
                            // Rotate Z (roll)
                            loopBody.append(.globalGet(entPtrG)); loopBody.append(.f32Load(2, Int(offRoll))); loopBody.append(.call(cosIdx)); loopBody.append(.globalSet(tmp0))
                            loopBody.append(.globalGet(entPtrG)); loopBody.append(.f32Load(2, Int(offRoll))); loopBody.append(.call(sinIdx)); loopBody.append(.globalSet(tmp1))
                            loopBody.append(.globalGet(xG)); loopBody.append(.globalSet(tmp2))
                            // x = x*cos - y*sin
                            loopBody.append(contentsOf: [
                                .globalGet(tmp2), .globalGet(tmp0), .f32Mul,
                                .globalGet(yG), .globalGet(tmp1), .f32Mul,
                                .f32Sub,
                                .globalSet(xG),
                            ])
                            // y = x*sin + y*cos
                            loopBody.append(contentsOf: [
                                .globalGet(tmp2), .globalGet(tmp1), .f32Mul,
                                .globalGet(yG), .globalGet(tmp0), .f32Mul,
                                .f32Add,
                                .globalSet(yG),
                            ])

                            // Rotate X (pitch)
                            loopBody.append(.globalGet(entPtrG)); loopBody.append(.f32Load(2, Int(offPitch))); loopBody.append(.call(cosIdx)); loopBody.append(.globalSet(tmp0))
                            loopBody.append(.globalGet(entPtrG)); loopBody.append(.f32Load(2, Int(offPitch))); loopBody.append(.call(sinIdx)); loopBody.append(.globalSet(tmp1))
                            // tmp2 = y
                            loopBody.append(.globalGet(yG)); loopBody.append(.globalSet(tmp2))
                            // y = y*cos - z*sin
                            loopBody.append(contentsOf: [
                                .globalGet(tmp2), .globalGet(tmp0), .f32Mul,
                                .globalGet(zG), .globalGet(tmp1), .f32Mul,
                                .f32Sub,
                                .globalSet(yG),
                            ])
                            // z = y*sin + z*cos
                            loopBody.append(contentsOf: [
                                .globalGet(tmp2), .globalGet(tmp1), .f32Mul,
                                .globalGet(zG), .globalGet(tmp0), .f32Mul,
                                .f32Add,
                                .globalSet(zG),
                            ])

                            // Rotate Y (yaw)
                            loopBody.append(.globalGet(entPtrG)); loopBody.append(.f32Load(2, Int(offYaw))); loopBody.append(.call(cosIdx)); loopBody.append(.globalSet(tmp0))
                            loopBody.append(.globalGet(entPtrG)); loopBody.append(.f32Load(2, Int(offYaw))); loopBody.append(.call(sinIdx)); loopBody.append(.globalSet(tmp1))
                            loopBody.append(.globalGet(xG)); loopBody.append(.globalSet(tmp2))
                            // x = x*cos + z*sin
                            loopBody.append(contentsOf: [
                                .globalGet(tmp2), .globalGet(tmp0), .f32Mul,
                                .globalGet(zG), .globalGet(tmp1), .f32Mul,
                                .f32Add,
                                .globalSet(xG),
                            ])
                            // z = z*cos - x*sin
                            loopBody.append(contentsOf: [
                                .globalGet(zG), .globalGet(tmp0), .f32Mul,
                                .globalGet(tmp2), .globalGet(tmp1), .f32Mul,
                                .f32Sub,
                                .globalSet(zG),
                            ])
                        }

                        // Add parent translation
                        loopBody.append(contentsOf: [
                            .globalGet(xG),
                            .globalGet(entPtrG), .f32Load(2, Int(offPosX)),
                            .f32Add,
                            .globalSet(xG),
                        ])
                        loopBody.append(contentsOf: [
                            .globalGet(yG),
                            .globalGet(entPtrG), .f32Load(2, Int(offPosY)),
                            .f32Add,
                            .globalSet(yG),
                        ])
                        loopBody.append(contentsOf: [
                            .globalGet(zG),
                            .globalGet(entPtrG), .f32Load(2, Int(offPosZ)),
                            .f32Add,
                            .globalSet(zG),
                        ])

                        // parentId = parent.parent
                        loopBody.append(.globalGet(entPtrG))
                        loopBody.append(.i32Load(2, Int(offParent)))
                        loopBody.append(.globalSet(parentIdG))

                        // continue
                        loopBody.append(.br(0))
                        return loopBody
                    }()),
                ]))

                // return selected component
                if component == 0 { globalLoad.append(.globalGet(xG)) }
                else if component == 1 { globalLoad.append(.globalGet(yG)) }
                else { globalLoad.append(.globalGet(zG)) }

                return [
                    .globalGet(globalG),
                    .i32EqZ,
                    .if(.f32, localLoad, globalLoad),
                ]
            }()))
            return b
        }()

        instrs.append(.globalGet(basePtrG))
        instrs.append(.i32EqZ)
        instrs.append(.if(.f32, fallback, elseBranch))
        return (instrs, .f32)
    }

    private func generateCmdGetEntF32(
        call: FunctionCallNode,
        funcIdx: Int,
        def: FunctionDefinition?,
        importedType: WASMFunctionType?,
        byteOffset: Int32
    ) -> (instrs: [WASMInstruction], type: WASMType) {
        let expected = expectedParamCount(def: def, importedType: importedType, fallback: 2)
        let entG = context.scratchGlobalIdx
        let globalG = context.scratchGlobal2Idx
        let stores: [Int: (global: Int, type: WASMType)] = [
            0: (entG, .i32),
            1: (globalG, .i32),
        ]

        var instrs: [WASMInstruction] = []
        instrs.append(contentsOf: emitPaddedArgsStored(call: call, def: def, importedType: importedType, expectedCount: expected, stores: stores))

        // Fallback: call import (JS authoritative) if CMDB not enabled at runtime.
        let fallback = emitFallbackImportCall(funcIdx: funcIdx, paramStores: [(entG, .i32), (globalG, .i32)])

        guard context.cmdBufPtrGlobalIdx >= 0 else {
            instrs.append(contentsOf: fallback)
            return (instrs, .f32)
        }

        let basePtrG = context.cmdBufPtrGlobalIdx
        let entPtrG = context.scratchGlobal3Idx

        // if (__CmdBufPtr == 0) -> fallback
        // else -> ensure table; entPtr; if entPtr==0 -> fallback; else load f32
        let thenBranch = fallback
        let elseBranch: [WASMInstruction] = {
            var b: [WASMInstruction] = []
            b.append(contentsOf: emitEnsureEntityStateTable())
            b.append(contentsOf: emitEntPtrToScratch(entIdGlobal: entG))
            b.append(.globalGet(entPtrG))
            b.append(.i32EqZ)
            b.append(.if(.f32, fallback, [
                .globalGet(entPtrG),
                .f32Load(2, Int(byteOffset)),
            ]))
            return b
        }()

        instrs.append(.globalGet(basePtrG))
        instrs.append(.i32EqZ)
        instrs.append(.if(.f32, thenBranch, elseBranch))
        return (instrs, .f32)
    }

    private func generateCmdGetEntI32(
        call: FunctionCallNode,
        funcIdx: Int,
        def: FunctionDefinition?,
        importedType: WASMFunctionType?,
        byteOffset: Int32
    ) -> (instrs: [WASMInstruction], type: WASMType) {
        let expected = expectedParamCount(def: def, importedType: importedType, fallback: 2)
        let entG = context.scratchGlobalIdx
        let globalG = context.scratchGlobal2Idx
        let stores: [Int: (global: Int, type: WASMType)] = [
            0: (entG, .i32),
            1: (globalG, .i32),
        ]

        var instrs: [WASMInstruction] = []
        instrs.append(contentsOf: emitPaddedArgsStored(call: call, def: def, importedType: importedType, expectedCount: expected, stores: stores))

        let fallback = emitFallbackImportCall(funcIdx: funcIdx, paramStores: [(entG, .i32), (globalG, .i32)])

        guard context.cmdBufPtrGlobalIdx >= 0 else {
            instrs.append(contentsOf: fallback)
            return (instrs, .i32)
        }

        let basePtrG = context.cmdBufPtrGlobalIdx
        let entPtrG = context.scratchGlobal3Idx

        let thenBranch = fallback
        let elseBranch: [WASMInstruction] = {
            var b: [WASMInstruction] = []
            b.append(contentsOf: emitEnsureEntityStateTable())
            b.append(contentsOf: emitEntPtrToScratch(entIdGlobal: entG))
            b.append(.globalGet(entPtrG))
            b.append(.i32EqZ)
            b.append(.if(.i32, fallback, [
                .globalGet(entPtrG),
                .i32Load(2, Int(byteOffset)),
            ]))
            return b
        }()

        instrs.append(.globalGet(basePtrG))
        instrs.append(.i32EqZ)
        instrs.append(.if(.i32, thenBranch, elseBranch))
        return (instrs, .i32)
    }

    // CMDB layout constants (must match web/src/shared/command_buffer.ts)
    private var cmdbHeaderBytes: Int32 { 24 }
    private var cmdbOffTotalBytes: Int32 { 8 }
    private var cmdbOffWriteOff: Int32 { 12 }
    private var cmdbOffFlags: Int32 { 20 }
    private var cmdbFlagOverflow: Int32 { 1 }

    // Entity state table layout (bytes)
    // slotSize = 48
    //  0: parent i32
    //  4: visible i32
    //  8: posX f32
    // 12: posY f32
    // 16: posZ f32
    // 20: pitch f32
    // 24: yaw f32
    // 28: roll f32
    // 32: sclX f32
    // 36: sclY f32
    // 40: sclZ f32
    // 44: reserved
    private var entSlotBytes: Int32 { 48 }

    private func generateCmdSetParent(
        call: FunctionCallNode,
        funcIdx: Int,
        def: FunctionDefinition?,
        importedType: WASMFunctionType?
    ) -> (instrs: [WASMInstruction], type: WASMType) {
        let expected = expectedParamCount(def: def, importedType: importedType, fallback: 3)
        let entG = context.scratchGlobalIdx
        let parentG = context.scratchGlobal2Idx
        let globalG = context.scratchGlobal4Idx

        let stores: [Int: (global: Int, type: WASMType)] = [
            0: (entG, .i32),
            1: (parentG, .i32),
            2: (globalG, .i32),
        ]
        var instrs: [WASMInstruction] = []
        instrs.append(contentsOf: emitPaddedArgsStored(call: call, def: def, importedType: importedType, expectedCount: expected, stores: stores))

        let fallback = emitFallbackImportCall(funcIdx: funcIdx, paramStores: [(entG, .i32), (parentG, .i32), (globalG, .i32)])

        let opcode: Int32 = 13
        let byteLen: Int32 = 20

        let writePayload: (_ cmdPtrGlobal: Int) -> [WASMInstruction] = { cmdPtrG in
            var b: [WASMInstruction] = []
            b.append(.globalGet(cmdPtrG))
            b.append(.i32Const(opcode))
            b.append(.i32Store(2, 0))
            b.append(.globalGet(cmdPtrG))
            b.append(.i32Const(byteLen))
            b.append(.i32Store(2, 4))

            b.append(.globalGet(cmdPtrG))
            b.append(.i32Const(8))
            b.append(.i32Add)
            b.append(.globalGet(entG))
            b.append(.i32Store(2, 0))

            b.append(.globalGet(cmdPtrG))
            b.append(.i32Const(12))
            b.append(.i32Add)
            b.append(.globalGet(parentG))
            b.append(.i32Store(2, 0))

            b.append(.globalGet(cmdPtrG))
            b.append(.i32Const(16))
            b.append(.i32Add)
            b.append(.globalGet(globalG))
            b.append(.i32Store(2, 0))
            return b
        }

        let updateState: [WASMInstruction] = {
            let entPtrG = context.scratchGlobal3Idx
            var b: [WASMInstruction] = []
            b.append(contentsOf: emitEnsureEntityStateTable())
            b.append(contentsOf: emitEntPtrToScratch(entIdGlobal: entG))
            b.append(.globalGet(entPtrG))
            b.append(.i32EqZ)
            b.append(.if(.void, [], [
                .globalGet(entPtrG),
                .globalGet(parentG),
                .i32Store(2, 0),
            ]))
            return b
        }()

        instrs.append(contentsOf: updateState)
        instrs.append(contentsOf: emitCmdWriteCommon(byteLen: byteLen, writePayload: writePayload, fallback: fallback, returnsValue: false, returnValueInstrs: []))
        return (instrs, .void)
    }

    private func emitEnsureEntityStateTable() -> [WASMInstruction] {
        guard context.cmdEntStatePtrGlobalIdx >= 0,
              context.cmdEntStateCapGlobalIdx >= 0,
              context.heapPointerIdx >= 0
        else { return [] }

        let ptrG = context.cmdEntStatePtrGlobalIdx
        let capG = context.cmdEntStateCapGlobalIdx
        let heapG = context.heapPointerIdx

        // scratch usage
        let gTmp = context.scratchGlobal3Idx
        let gTmp2 = context.scratchGlobal4Idx

        // Allocate a fixed-capacity table once (v1).
        let cap: Int32 = 32768
        let bytes: Int32 = cap &* entSlotBytes

        // if (ptr == 0) { ptr = heap; cap=cap; heap += bytes; grow memory if needed }
        var body: [WASMInstruction] = []
        body.append(.globalGet(ptrG))
        body.append(.i32EqZ)
        body.append(.if(.void, [
            // ptr = heap
            .globalGet(heapG),
            .globalSet(ptrG),
            // cap = const
            .i32Const(cap),
            .globalSet(capG),
            // heap = heap + bytes
            .globalGet(heapG),
            .i32Const(bytes),
            .i32Add,
            .globalSet(heapG),

            // Ensure memory big enough for heap.
            // needed = heap
            .globalGet(heapG),
            .globalSet(gTmp),
            // curBytes = memory.size * 65536
            .memorySize,
            .i32Const(65536),
            .i32Mul,
            .globalSet(gTmp2),
            // if (needed > curBytes) grow
            .globalGet(gTmp),
            .globalGet(gTmp2),
            .i32GtU,
            .if(.void, [
                // delta = needed - curBytes
                .globalGet(gTmp),
                .globalGet(gTmp2),
                .i32Sub,
                // pages = (delta + 65535) / 65536
                .i32Const(65535),
                .i32Add,
                .i32Const(65536),
                .i32DivU,
                .memoryGrow,
                .drop,
            ], nil),
        ], nil))
        return body
    }

	    private func emitEntPtrToScratch(entIdGlobal: Int) -> [WASMInstruction] {
	        // scratchGlobal3Idx = entPtr (or 0 if no table / id out of range)
	        // NOTE: Uses capG directly (not cached in a scratch global) to avoid
	        // collisions when the caller stores a value in scratchGlobal4Idx.
	        guard context.cmdEntStatePtrGlobalIdx >= 0, context.cmdEntStateCapGlobalIdx >= 0 else { return [] }
	        let ptrG = context.cmdEntStatePtrGlobalIdx
	        let capG = context.cmdEntStateCapGlobalIdx
	        let outPtrG = context.scratchGlobal3Idx

	        // if (entId == 0 || entId >= cap) ptr=0 else ptr=base + entId*slotBytes
	        return [
	            .globalGet(entIdGlobal),
	            .i32EqZ,
	            .if(.i32, [
	                .i32Const(0),
	            ], [
	                .globalGet(entIdGlobal),
	                .globalGet(capG),
	                .i32GeU,
	                .if(.i32, [
	                    .i32Const(0),
	                ], [
	                    .globalGet(ptrG),
	                    .globalGet(entIdGlobal),
	                    .i32Const(entSlotBytes),
	                    .i32Mul,
	                    .i32Add,
	                ]),
	            ]),
	            .globalSet(outPtrG),
	        ]
	    }

    private func emitCmdWriteCommon(
        byteLen: Int32,
        writePayload: (_ cmdPtrGlobal: Int) -> [WASMInstruction],
        fallback: [WASMInstruction],
        returnsValue: Bool,
        returnValueInstrs: [WASMInstruction]
    ) -> [WASMInstruction] {
        // Structure:
        // if (__CmdBufPtr == 0) { fallback } else { if (overflow) { setFlag; fallback } else { write; returnValue } }
        let basePtrG = context.cmdBufPtrGlobalIdx

        // Reusable globals
        let gWriteOff = context.scratchGlobal4Idx
        let gTmp = context.scratchGlobal3Idx

        // Write path body (assumes cmdBufPtr != 0 and enough capacity)
        let writeBody: [WASMInstruction] = {
            var b: [WASMInstruction] = []
            // writeOff = *(u32*)(base+12)
            b.append(.globalGet(basePtrG))
            b.append(.i32Load(2, Int(cmdbOffWriteOff)))
            b.append(.globalSet(gWriteOff))

            // cmdPtr = base + 24 + writeOff
            b.append(.globalGet(basePtrG))
            b.append(.i32Const(cmdbHeaderBytes))
            b.append(.i32Add)
            b.append(.globalGet(gWriteOff))
            b.append(.i32Add)
            b.append(.globalSet(gTmp)) // cmdPtr

            // opcode/len written by payload closure, then bump writeOff
            b.append(contentsOf: writePayload(gTmp))

            // *(u32*)(base+12) = writeOff + byteLen
            b.append(.globalGet(basePtrG))
            b.append(.globalGet(gWriteOff))
            b.append(.i32Const(byteLen))
            b.append(.i32Add)
            b.append(.i32Store(2, Int(cmdbOffWriteOff)))

            b.append(contentsOf: returnValueInstrs)
            return b
        }()

        // Overflow check body
        let overflowCheck: [WASMInstruction] = {
            var b: [WASMInstruction] = []
            // writeOff in gWriteOff (loaded again for simplicity)
            b.append(.globalGet(basePtrG))
            b.append(.i32Load(2, Int(cmdbOffWriteOff)))
            b.append(.globalSet(gWriteOff))

            // cap = totalBytes - headerBytes
            // if (writeOff + byteLen > cap) overflow
            b.append(.globalGet(gWriteOff))
            b.append(.i32Const(byteLen))
            b.append(.i32Add) // needed
            b.append(.globalGet(basePtrG))
            b.append(.i32Load(2, Int(cmdbOffTotalBytes)))
            b.append(.i32Const(cmdbHeaderBytes))
            b.append(.i32Sub) // cap
            b.append(.i32GtU)
            return b
        }()

        // Overflow branch: set flag and run fallback
        let overflowBranch: [WASMInstruction] = {
            var b: [WASMInstruction] = []
            b.append(.globalGet(basePtrG))
            b.append(.globalGet(basePtrG))
            b.append(.i32Load(2, Int(cmdbOffFlags)))
            b.append(.i32Const(cmdbFlagOverflow))
            b.append(.i32Or)
            b.append(.i32Store(2, Int(cmdbOffFlags)))
            b.append(contentsOf: fallback)
            return b
        }()

        var body: [WASMInstruction] = []

        let resultType: WASMType = returnsValue ? .i32 : .void

        let elseBranch: [WASMInstruction] = overflowCheck + [
            .if(resultType, overflowBranch, writeBody),
        ]

        body.append(.globalGet(basePtrG))
        body.append(.i32EqZ)
        body.append(.if(resultType, fallback, elseBranch))

        return body
    }

    // CreateCube/CreateMesh -> CMDB CreateEntity and return WASM-owned id.
    private func generateCmdCreateEntity(
        call: FunctionCallNode,
        funcIdx: Int,
        def: FunctionDefinition?,
        importedType: WASMFunctionType?,
        entityType: Int32
    ) -> (instrs: [WASMInstruction], type: WASMType) {
        let expected = expectedParamCount(def: def, importedType: importedType, fallback: 1)
        // parent only (index 0)
        let parentG = context.scratchGlobalIdx
        let stores: [Int: (global: Int, type: WASMType)] = [
            0: (parentG, .i32),
        ]
        var instrs: [WASMInstruction] = []
        instrs.append(contentsOf: emitPaddedArgsStored(call: call, def: def, importedType: importedType, expectedCount: expected, stores: stores))

        // fallback call: load params and call import (returns i32)
        let fallback = emitFallbackImportCall(funcIdx: funcIdx, paramStores: [(parentG, .i32)])

        // cmd write: allocate id, emit CreateEntity(entityType,parent,id)
        let idG = context.scratchGlobal2Idx
        let nextIdG = context.cmdNextEntityIdGlobalIdx
        let opcode: Int32 = 1
        let byteLen: Int32 = 20 // 8 hdr + 12 payload

        let writePayload: (_ cmdPtrGlobal: Int) -> [WASMInstruction] = { cmdPtrG in
            var b: [WASMInstruction] = []
            // id = nextId; nextId = id + 1
            b.append(.globalGet(nextIdG))
            b.append(.globalSet(idG))
            b.append(.globalGet(idG))
            b.append(.i32Const(1))
            b.append(.i32Add)
            b.append(.globalSet(nextIdG))

            // *(u32*)(cmdPtr+0)=opcode; *(u32*)(cmdPtr+4)=byteLen
            b.append(.globalGet(cmdPtrG))
            b.append(.i32Const(opcode))
            b.append(.i32Store(2, 0))
            b.append(.globalGet(cmdPtrG))
            b.append(.i32Const(byteLen))
            b.append(.i32Store(2, 4))

            // payload
            b.append(.globalGet(cmdPtrG))
            b.append(.i32Const(8))
            b.append(.i32Add)
            b.append(.i32Const(entityType))
            b.append(.i32Store(2, 0))

            b.append(.globalGet(cmdPtrG))
            b.append(.i32Const(12))
            b.append(.i32Add)
            b.append(.globalGet(parentG))
            b.append(.i32Store(2, 0))

            b.append(.globalGet(cmdPtrG))
            b.append(.i32Const(16))
            b.append(.i32Add)
            b.append(.globalGet(idG))
            b.append(.i32Store(2, 0))

            return b
        }

	        // Update WASM-side authoritative state table for this entity.
	        let initState: [WASMInstruction] = {
	            let entPtrG = context.scratchGlobal3Idx
	            var b: [WASMInstruction] = []
	            b.append(contentsOf: emitEnsureEntityStateTable())
	            b.append(contentsOf: emitEntPtrToScratch(entIdGlobal: idG))
	            // if (entPtr != 0) { init fields }
	            var thenBody: [WASMInstruction] = []
	            // parent
	            thenBody.append(.globalGet(entPtrG))
	            thenBody.append(.globalGet(parentG))
	            thenBody.append(.i32Store(2, 0))
	            // visible = 1
	            thenBody.append(.globalGet(entPtrG))
	            thenBody.append(.i32Const(1))
	            thenBody.append(.i32Store(2, 4))
	            // pos = 0
	            thenBody.append(contentsOf: [.globalGet(entPtrG), .f32Const(0.0), .f32Store(2, 8)])
	            thenBody.append(contentsOf: [.globalGet(entPtrG), .f32Const(0.0), .f32Store(2, 12)])
	            thenBody.append(contentsOf: [.globalGet(entPtrG), .f32Const(0.0), .f32Store(2, 16)])
	            // rot = 0
	            thenBody.append(contentsOf: [.globalGet(entPtrG), .f32Const(0.0), .f32Store(2, 20)])
	            thenBody.append(contentsOf: [.globalGet(entPtrG), .f32Const(0.0), .f32Store(2, 24)])
	            thenBody.append(contentsOf: [.globalGet(entPtrG), .f32Const(0.0), .f32Store(2, 28)])
	            // scl = 1
	            thenBody.append(contentsOf: [.globalGet(entPtrG), .f32Const(1.0), .f32Store(2, 32)])
	            thenBody.append(contentsOf: [.globalGet(entPtrG), .f32Const(1.0), .f32Store(2, 36)])
	            thenBody.append(contentsOf: [.globalGet(entPtrG), .f32Const(1.0), .f32Store(2, 40)])

	            b.append(.globalGet(entPtrG))
	            b.append(.i32EqZ)
	            b.append(.if(.void, [], thenBody))
	            return b
	        }()

        let cmd = emitCmdWriteCommon(
            byteLen: byteLen,
            writePayload: writePayload,
            fallback: fallback,
            returnsValue: true,
            returnValueInstrs: [.globalGet(idG)]
        )
        instrs.append(contentsOf: initState)
        instrs.append(contentsOf: cmd)
        return (instrs, .i32)
    }

    private func generateCmdDestroyEntity(
        call: FunctionCallNode,
        funcIdx: Int,
        def: FunctionDefinition?,
        importedType: WASMFunctionType?
    ) -> (instrs: [WASMInstruction], type: WASMType) {
        let expected = expectedParamCount(def: def, importedType: importedType, fallback: 1)
        let entG = context.scratchGlobalIdx
        let stores: [Int: (global: Int, type: WASMType)] = [0: (entG, .i32)]
        var instrs: [WASMInstruction] = []
        instrs.append(contentsOf: emitPaddedArgsStored(call: call, def: def, importedType: importedType, expectedCount: expected, stores: stores))

        let fallback = emitFallbackImportCall(funcIdx: funcIdx, paramStores: [(entG, .i32)])

        let opcode: Int32 = 2
        let byteLen: Int32 = 12 // 8 hdr + 4 payload

        let writePayload: (_ cmdPtrGlobal: Int) -> [WASMInstruction] = { cmdPtrG in
            var b: [WASMInstruction] = []
            b.append(.globalGet(cmdPtrG))
            b.append(.i32Const(opcode))
            b.append(.i32Store(2, 0))
            b.append(.globalGet(cmdPtrG))
            b.append(.i32Const(byteLen))
            b.append(.i32Store(2, 4))

            b.append(.globalGet(cmdPtrG))
            b.append(.i32Const(8))
            b.append(.i32Add)
            b.append(.globalGet(entG))
            b.append(.i32Store(2, 0))
            return b
        }

        // Best-effort: mark entity as not visible in WASM state.
	        let updateState: [WASMInstruction] = {
	            let entPtrG = context.scratchGlobal3Idx
	            var b: [WASMInstruction] = []
	            b.append(contentsOf: emitEnsureEntityStateTable())
	            b.append(contentsOf: emitEntPtrToScratch(entIdGlobal: entG))
	            b.append(.globalGet(entPtrG))
	            b.append(.i32EqZ)
	            b.append(.if(.void, [], [
	                .globalGet(entPtrG),
	                .i32Const(0),
	                .i32Store(2, 4),
	            ]))
	            return b
	        }()

        instrs.append(contentsOf: updateState)
        instrs.append(contentsOf: emitCmdWriteCommon(byteLen: byteLen, writePayload: writePayload, fallback: fallback, returnsValue: false, returnValueInstrs: []))
        return (instrs, .void)
    }

    private func generateCmdSetVisibility(
        call: FunctionCallNode,
        funcIdx: Int,
        def: FunctionDefinition?,
        importedType: WASMFunctionType?,
        visible: Int32
    ) -> (instrs: [WASMInstruction], type: WASMType) {
        let expected = expectedParamCount(def: def, importedType: importedType, fallback: 1)
        let entG = context.scratchGlobalIdx
        let stores: [Int: (global: Int, type: WASMType)] = [0: (entG, .i32)]
        var instrs: [WASMInstruction] = []
        instrs.append(contentsOf: emitPaddedArgsStored(call: call, def: def, importedType: importedType, expectedCount: expected, stores: stores))

        let fallback = emitFallbackImportCall(funcIdx: funcIdx, paramStores: [(entG, .i32)])

        let opcode: Int32 = 5
        let byteLen: Int32 = 16 // 8 hdr + 8 payload

        let writePayload: (_ cmdPtrGlobal: Int) -> [WASMInstruction] = { cmdPtrG in
            var b: [WASMInstruction] = []
            b.append(.globalGet(cmdPtrG))
            b.append(.i32Const(opcode))
            b.append(.i32Store(2, 0))
            b.append(.globalGet(cmdPtrG))
            b.append(.i32Const(byteLen))
            b.append(.i32Store(2, 4))

            b.append(.globalGet(cmdPtrG))
            b.append(.i32Const(8))
            b.append(.i32Add)
            b.append(.globalGet(entG))
            b.append(.i32Store(2, 0))

            b.append(.globalGet(cmdPtrG))
            b.append(.i32Const(12))
            b.append(.i32Add)
            b.append(.i32Const(visible))
            b.append(.i32Store(2, 0))
            return b
        }

	        let updateState: [WASMInstruction] = {
	            let entPtrG = context.scratchGlobal3Idx
	            var b: [WASMInstruction] = []
	            b.append(contentsOf: emitEnsureEntityStateTable())
	            b.append(contentsOf: emitEntPtrToScratch(entIdGlobal: entG))
	            b.append(.globalGet(entPtrG))
	            b.append(.i32EqZ)
	            b.append(.if(.void, [], [
	                .globalGet(entPtrG),
	                .i32Const(visible),
	                .i32Store(2, 4),
	            ]))
	            return b
	        }()

        instrs.append(contentsOf: updateState)
        instrs.append(contentsOf: emitCmdWriteCommon(byteLen: byteLen, writePayload: writePayload, fallback: fallback, returnsValue: false, returnValueInstrs: []))
        return (instrs, .void)
    }

    private func generateCmdSetPosition(
        call: FunctionCallNode,
        funcIdx: Int,
        def: FunctionDefinition?,
        importedType: WASMFunctionType?
    ) -> (instrs: [WASMInstruction], type: WASMType) {
        let expected = expectedParamCount(def: def, importedType: importedType, fallback: 5)
        let entG = context.scratchGlobalIdx
        let globalG = context.scratchGlobal2Idx
        let xG = context.scratchGlobalFloatIdx
        let yG = context.scratchGlobalFloat2Idx
        let zG = context.scratchGlobalFloat3Idx

        let stores: [Int: (global: Int, type: WASMType)] = [
            0: (entG, .i32),
            1: (xG, .f32),
            2: (yG, .f32),
            3: (zG, .f32),
            4: (globalG, .i32),
        ]
        var instrs: [WASMInstruction] = []
        instrs.append(contentsOf: emitPaddedArgsStored(call: call, def: def, importedType: importedType, expectedCount: expected, stores: stores))

        let fallback = emitFallbackImportCall(funcIdx: funcIdx, paramStores: [(entG, .i32), (xG, .f32), (yG, .f32), (zG, .f32), (globalG, .i32)])

        let opcode: Int32 = 8
        let byteLen: Int32 = 24

        let writePayload: (_ cmdPtrGlobal: Int) -> [WASMInstruction] = { cmdPtrG in
            var b: [WASMInstruction] = []
            b.append(.globalGet(cmdPtrG))
            b.append(.i32Const(opcode))
            b.append(.i32Store(2, 0))
            b.append(.globalGet(cmdPtrG))
            b.append(.i32Const(byteLen))
            b.append(.i32Store(2, 4))

            // id
            b.append(.globalGet(cmdPtrG))
            b.append(.i32Const(8))
            b.append(.i32Add)
            b.append(.globalGet(entG))
            b.append(.i32Store(2, 0))

            // x,y,z
            b.append(.globalGet(cmdPtrG))
            b.append(.i32Const(12))
            b.append(.i32Add)
            b.append(.globalGet(xG))
            b.append(.f32Store(2, 0))

            b.append(.globalGet(cmdPtrG))
            b.append(.i32Const(16))
            b.append(.i32Add)
            b.append(.globalGet(yG))
            b.append(.f32Store(2, 0))

            b.append(.globalGet(cmdPtrG))
            b.append(.i32Const(20))
            b.append(.i32Add)
            b.append(.globalGet(zG))
            b.append(.f32Store(2, 0))

            return b
        }

	        let updateState: [WASMInstruction] = {
	            let entPtrG = context.scratchGlobal3Idx
	            var b: [WASMInstruction] = []
	            b.append(contentsOf: emitEnsureEntityStateTable())
	            b.append(contentsOf: emitEntPtrToScratch(entIdGlobal: entG))
	            b.append(.globalGet(entPtrG))
	            b.append(.i32EqZ)
	            b.append(.if(.void, [], [
	                .globalGet(entPtrG), .globalGet(xG), .f32Store(2, 8),
	                .globalGet(entPtrG), .globalGet(yG), .f32Store(2, 12),
	                .globalGet(entPtrG), .globalGet(zG), .f32Store(2, 16),
	            ]))
	            return b
	        }()

        instrs.append(contentsOf: updateState)
        instrs.append(contentsOf: emitCmdWriteCommon(byteLen: byteLen, writePayload: writePayload, fallback: fallback, returnsValue: false, returnValueInstrs: []))
        return (instrs, .void)
    }

    private func generateCmdSetRotationEuler(
        call: FunctionCallNode,
        funcIdx: Int,
        def: FunctionDefinition?,
        importedType: WASMFunctionType?
    ) -> (instrs: [WASMInstruction], type: WASMType) {
        let expected = expectedParamCount(def: def, importedType: importedType, fallback: 5)
        let entG = context.scratchGlobalIdx
        let globalG = context.scratchGlobal2Idx
        let pG = context.scratchGlobalFloatIdx
        let yG = context.scratchGlobalFloat2Idx
        let rG = context.scratchGlobalFloat3Idx

        let stores: [Int: (global: Int, type: WASMType)] = [
            0: (entG, .i32),
            1: (pG, .f32),
            2: (yG, .f32),
            3: (rG, .f32),
            4: (globalG, .i32),
        ]
        var instrs: [WASMInstruction] = []
        instrs.append(contentsOf: emitPaddedArgsStored(call: call, def: def, importedType: importedType, expectedCount: expected, stores: stores))

        let fallback = emitFallbackImportCall(funcIdx: funcIdx, paramStores: [(entG, .i32), (pG, .f32), (yG, .f32), (rG, .f32), (globalG, .i32)])

        let opcode: Int32 = 9
        let byteLen: Int32 = 28

        let writePayload: (_ cmdPtrGlobal: Int) -> [WASMInstruction] = { cmdPtrG in
            var b: [WASMInstruction] = []
            b.append(.globalGet(cmdPtrG))
            b.append(.i32Const(opcode))
            b.append(.i32Store(2, 0))
            b.append(.globalGet(cmdPtrG))
            b.append(.i32Const(byteLen))
            b.append(.i32Store(2, 4))

            b.append(.globalGet(cmdPtrG))
            b.append(.i32Const(8))
            b.append(.i32Add)
            b.append(.globalGet(entG))
            b.append(.i32Store(2, 0))

            b.append(.globalGet(cmdPtrG))
            b.append(.i32Const(12))
            b.append(.i32Add)
            b.append(.globalGet(pG))
            b.append(.f32Store(2, 0))

            b.append(.globalGet(cmdPtrG))
            b.append(.i32Const(16))
            b.append(.i32Add)
            b.append(.globalGet(yG))
            b.append(.f32Store(2, 0))

            b.append(.globalGet(cmdPtrG))
            b.append(.i32Const(20))
            b.append(.i32Add)
            b.append(.globalGet(rG))
            b.append(.f32Store(2, 0))

            b.append(.globalGet(cmdPtrG))
            b.append(.i32Const(24))
            b.append(.i32Add)
            b.append(.globalGet(globalG))
            b.append(.i32Store(2, 0))

            return b
        }

	        let updateState: [WASMInstruction] = {
	            let entPtrG = context.scratchGlobal3Idx
	            var b: [WASMInstruction] = []
	            b.append(contentsOf: emitEnsureEntityStateTable())
	            b.append(contentsOf: emitEntPtrToScratch(entIdGlobal: entG))
	            b.append(.globalGet(entPtrG))
	            b.append(.i32EqZ)
	            b.append(.if(.void, [], [
	                .globalGet(entPtrG), .globalGet(pG), .f32Store(2, 20),
	                .globalGet(entPtrG), .globalGet(yG), .f32Store(2, 24),
	                .globalGet(entPtrG), .globalGet(rG), .f32Store(2, 28),
	            ]))
	            return b
	        }()

        instrs.append(contentsOf: updateState)
        instrs.append(contentsOf: emitCmdWriteCommon(byteLen: byteLen, writePayload: writePayload, fallback: fallback, returnsValue: false, returnValueInstrs: []))
        return (instrs, .void)
    }

    private func generateCmdSetScale(
        call: FunctionCallNode,
        funcIdx: Int,
        def: FunctionDefinition?,
        importedType: WASMFunctionType?
    ) -> (instrs: [WASMInstruction], type: WASMType) {
        let expected = expectedParamCount(def: def, importedType: importedType, fallback: 4)
        let entG = context.scratchGlobalIdx
        let xG = context.scratchGlobalFloatIdx
        let yG = context.scratchGlobalFloat2Idx
        let zG = context.scratchGlobalFloat3Idx

        let stores: [Int: (global: Int, type: WASMType)] = [
            0: (entG, .i32),
            1: (xG, .f32),
            2: (yG, .f32),
            3: (zG, .f32),
        ]
        var instrs: [WASMInstruction] = []
        instrs.append(contentsOf: emitPaddedArgsStored(call: call, def: def, importedType: importedType, expectedCount: expected, stores: stores))

        let fallback = emitFallbackImportCall(funcIdx: funcIdx, paramStores: [(entG, .i32), (xG, .f32), (yG, .f32), (zG, .f32)])

        let opcode: Int32 = 10
        let byteLen: Int32 = 24

        let writePayload: (_ cmdPtrGlobal: Int) -> [WASMInstruction] = { cmdPtrG in
            var b: [WASMInstruction] = []
            b.append(.globalGet(cmdPtrG))
            b.append(.i32Const(opcode))
            b.append(.i32Store(2, 0))
            b.append(.globalGet(cmdPtrG))
            b.append(.i32Const(byteLen))
            b.append(.i32Store(2, 4))

            b.append(.globalGet(cmdPtrG))
            b.append(.i32Const(8))
            b.append(.i32Add)
            b.append(.globalGet(entG))
            b.append(.i32Store(2, 0))

            b.append(.globalGet(cmdPtrG))
            b.append(.i32Const(12))
            b.append(.i32Add)
            b.append(.globalGet(xG))
            b.append(.f32Store(2, 0))

            b.append(.globalGet(cmdPtrG))
            b.append(.i32Const(16))
            b.append(.i32Add)
            b.append(.globalGet(yG))
            b.append(.f32Store(2, 0))

            b.append(.globalGet(cmdPtrG))
            b.append(.i32Const(20))
            b.append(.i32Add)
            b.append(.globalGet(zG))
            b.append(.f32Store(2, 0))

            return b
        }

	        let updateState: [WASMInstruction] = {
	            let entPtrG = context.scratchGlobal3Idx
	            var b: [WASMInstruction] = []
	            b.append(contentsOf: emitEnsureEntityStateTable())
	            b.append(contentsOf: emitEntPtrToScratch(entIdGlobal: entG))
	            b.append(.globalGet(entPtrG))
	            b.append(.i32EqZ)
	            b.append(.if(.void, [], [
	                .globalGet(entPtrG), .globalGet(xG), .f32Store(2, 32),
	                .globalGet(entPtrG), .globalGet(yG), .f32Store(2, 36),
	                .globalGet(entPtrG), .globalGet(zG), .f32Store(2, 40),
	            ]))
	            return b
	        }()

        instrs.append(contentsOf: updateState)
        instrs.append(contentsOf: emitCmdWriteCommon(byteLen: byteLen, writePayload: writePayload, fallback: fallback, returnsValue: false, returnValueInstrs: []))
        return (instrs, .void)
    }

    private func generateCmdMoveEntity(
        call: FunctionCallNode,
        funcIdx: Int,
        def: FunctionDefinition?,
        importedType: WASMFunctionType?
    ) -> (instrs: [WASMInstruction], type: WASMType) {
        let expected = expectedParamCount(def: def, importedType: importedType, fallback: 4)
        let entG = context.scratchGlobalIdx
        let xG = context.scratchGlobalFloatIdx
        let yG = context.scratchGlobalFloat2Idx
        let zG = context.scratchGlobalFloat3Idx

        let stores: [Int: (global: Int, type: WASMType)] = [
            0: (entG, .i32),
            1: (xG, .f32),
            2: (yG, .f32),
            3: (zG, .f32),
        ]
        var instrs: [WASMInstruction] = []
        instrs.append(contentsOf: emitPaddedArgsStored(call: call, def: def, importedType: importedType, expectedCount: expected, stores: stores))

        let fallback = emitFallbackImportCall(funcIdx: funcIdx, paramStores: [(entG, .i32), (xG, .f32), (yG, .f32), (zG, .f32)])

        let opcode: Int32 = 11
        let byteLen: Int32 = 24

        let writePayload: (_ cmdPtrGlobal: Int) -> [WASMInstruction] = { cmdPtrG in
            var b: [WASMInstruction] = []
            b.append(.globalGet(cmdPtrG))
            b.append(.i32Const(opcode))
            b.append(.i32Store(2, 0))
            b.append(.globalGet(cmdPtrG))
            b.append(.i32Const(byteLen))
            b.append(.i32Store(2, 4))

            b.append(.globalGet(cmdPtrG))
            b.append(.i32Const(8))
            b.append(.i32Add)
            b.append(.globalGet(entG))
            b.append(.i32Store(2, 0))

            b.append(.globalGet(cmdPtrG))
            b.append(.i32Const(12))
            b.append(.i32Add)
            b.append(.globalGet(xG))
            b.append(.f32Store(2, 0))

            b.append(.globalGet(cmdPtrG))
            b.append(.i32Const(16))
            b.append(.i32Add)
            b.append(.globalGet(yG))
            b.append(.f32Store(2, 0))

            b.append(.globalGet(cmdPtrG))
            b.append(.i32Const(20))
            b.append(.i32Add)
            b.append(.globalGet(zG))
            b.append(.f32Store(2, 0))

            return b
        }

        // Update WASM authoritative position.
        // v1: apply yaw-only rotation (good enough for most SCPCB movement; avoids full Euler math).
	        let updateState: [WASMInstruction] = {
	            let entPtrG = context.scratchGlobal3Idx
	            let yawG = context.scratchGlobalFloat4Idx
	            let cosYG = context.scratchGlobalFloat5Idx
	            let sinYG = context.scratchGlobalFloat6Idx
	            let dxwG = context.scratchGlobalFloat4Idx // reuse yaw scratch after trig computed

            let cosIdx = context.functionIndexMap["cos"] ?? -1
            let sinIdx = context.functionIndexMap["sin"] ?? -1

	            var b: [WASMInstruction] = []
	            b.append(contentsOf: emitEnsureEntityStateTable())
	            b.append(contentsOf: emitEntPtrToScratch(entIdGlobal: entG))
	            b.append(.globalGet(entPtrG))
	            b.append(.i32EqZ)
	
	            var thenBody: [WASMInstruction] = []
	            // yaw = *(f32*)(ent+24)
	            thenBody.append(.globalGet(entPtrG))
	            thenBody.append(.f32Load(2, 24))
	            thenBody.append(.globalSet(yawG))
	
	            // cosYaw / sinYaw (Blitz3D trig uses degrees; runtime should implement that).
	            // If missing, fall back to identity rotation.
	            if cosIdx >= 0 {
	                thenBody.append(.globalGet(yawG))
	                thenBody.append(.call(cosIdx))
	                thenBody.append(.globalSet(cosYG))
	            } else {
	                thenBody.append(.f32Const(1.0))
	                thenBody.append(.globalSet(cosYG))
	            }
	            if sinIdx >= 0 {
	                thenBody.append(.globalGet(yawG))
	                thenBody.append(.call(sinIdx))
	                thenBody.append(.globalSet(sinYG))
	            } else {
	                thenBody.append(.f32Const(0.0))
	                thenBody.append(.globalSet(sinYG))
	            }
	
	            // dxw = dx*cos + dz*sin
	            thenBody.append(contentsOf: [
	                .globalGet(xG), .globalGet(cosYG), .f32Mul,
	                .globalGet(zG), .globalGet(sinYG), .f32Mul,
	                .f32Add,
	                .globalSet(dxwG),
	            ])
	            // dzw (store into zG scratch): dz*cos - dx*sin
	            thenBody.append(contentsOf: [
	                .globalGet(zG), .globalGet(cosYG), .f32Mul,
	                .globalGet(xG), .globalGet(sinYG), .f32Mul,
	                .f32Sub,
	                .globalSet(zG),
	            ])
	
	            // posX += dxw
	            thenBody.append(contentsOf: [
	                .globalGet(entPtrG),
	                .globalGet(entPtrG), .f32Load(2, 8),
	                .globalGet(dxwG),
	                .f32Add,
	                .f32Store(2, 8),
	            ])
	            // posY += dy
	            thenBody.append(contentsOf: [
	                .globalGet(entPtrG),
	                .globalGet(entPtrG), .f32Load(2, 12),
	                .globalGet(yG),
	                .f32Add,
	                .f32Store(2, 12),
	            ])
	            // posZ += dzw
	            thenBody.append(contentsOf: [
	                .globalGet(entPtrG),
	                .globalGet(entPtrG), .f32Load(2, 16),
	                .globalGet(zG),
	                .f32Add,
	                .f32Store(2, 16),
	            ])
	
	            b.append(.if(.void, [], thenBody))
	            return b
	        }()

        instrs.append(contentsOf: updateState)
        instrs.append(contentsOf: emitCmdWriteCommon(byteLen: byteLen, writePayload: writePayload, fallback: fallback, returnsValue: false, returnValueInstrs: []))
        return (instrs, .void)
    }

    private func generateCmdTurnEntity(
        call: FunctionCallNode,
        funcIdx: Int,
        def: FunctionDefinition?,
        importedType: WASMFunctionType?
    ) -> (instrs: [WASMInstruction], type: WASMType) {
        let expected = expectedParamCount(def: def, importedType: importedType, fallback: 5)
        let entG = context.scratchGlobalIdx
        let globalG = context.scratchGlobal2Idx
        let pG = context.scratchGlobalFloatIdx
        let yG = context.scratchGlobalFloat2Idx
        let rG = context.scratchGlobalFloat3Idx

        let stores: [Int: (global: Int, type: WASMType)] = [
            0: (entG, .i32),
            1: (pG, .f32),
            2: (yG, .f32),
            3: (rG, .f32),
            4: (globalG, .i32),
        ]
        var instrs: [WASMInstruction] = []
        instrs.append(contentsOf: emitPaddedArgsStored(call: call, def: def, importedType: importedType, expectedCount: expected, stores: stores))

        let fallback = emitFallbackImportCall(funcIdx: funcIdx, paramStores: [(entG, .i32), (pG, .f32), (yG, .f32), (rG, .f32), (globalG, .i32)])

        let opcode: Int32 = 12
        let byteLen: Int32 = 28

        let writePayload: (_ cmdPtrGlobal: Int) -> [WASMInstruction] = { cmdPtrG in
            var b: [WASMInstruction] = []
            b.append(.globalGet(cmdPtrG))
            b.append(.i32Const(opcode))
            b.append(.i32Store(2, 0))
            b.append(.globalGet(cmdPtrG))
            b.append(.i32Const(byteLen))
            b.append(.i32Store(2, 4))

            b.append(.globalGet(cmdPtrG))
            b.append(.i32Const(8))
            b.append(.i32Add)
            b.append(.globalGet(entG))
            b.append(.i32Store(2, 0))

            b.append(.globalGet(cmdPtrG))
            b.append(.i32Const(12))
            b.append(.i32Add)
            b.append(.globalGet(pG))
            b.append(.f32Store(2, 0))

            b.append(.globalGet(cmdPtrG))
            b.append(.i32Const(16))
            b.append(.i32Add)
            b.append(.globalGet(yG))
            b.append(.f32Store(2, 0))

            b.append(.globalGet(cmdPtrG))
            b.append(.i32Const(20))
            b.append(.i32Add)
            b.append(.globalGet(rG))
            b.append(.f32Store(2, 0))

            b.append(.globalGet(cmdPtrG))
            b.append(.i32Const(24))
            b.append(.i32Add)
            b.append(.globalGet(globalG))
            b.append(.i32Store(2, 0))

            return b
        }

	        let updateState: [WASMInstruction] = {
	            let entPtrG = context.scratchGlobal3Idx
	            var b: [WASMInstruction] = []
	            b.append(contentsOf: emitEnsureEntityStateTable())
	            b.append(contentsOf: emitEntPtrToScratch(entIdGlobal: entG))
	            b.append(.globalGet(entPtrG))
	            b.append(.i32EqZ)
	            b.append(.if(.void, [], [
	                // pitch += dp
	                .globalGet(entPtrG),
	                .globalGet(entPtrG), .f32Load(2, 20),
	                .globalGet(pG), .f32Add,
	                .f32Store(2, 20),
	                // yaw += dy
	                .globalGet(entPtrG),
	                .globalGet(entPtrG), .f32Load(2, 24),
	                .globalGet(yG), .f32Add,
	                .f32Store(2, 24),
	                // roll += dr
	                .globalGet(entPtrG),
	                .globalGet(entPtrG), .f32Load(2, 28),
	                .globalGet(rG), .f32Add,
	                .f32Store(2, 28),
	            ]))
	            return b
	        }()

        instrs.append(contentsOf: updateState)
        instrs.append(contentsOf: emitCmdWriteCommon(byteLen: byteLen, writePayload: writePayload, fallback: fallback, returnsValue: false, returnValueInstrs: []))
        return (instrs, .void)
    }
    
    // MARK: - Array Access
    
    private func generateArrayAccess(_ access: ArrayAccessNode) -> (instrs: [WASMInstruction], type: WASMType) {
        var instrs: [WASMInstruction] = []
        
        // Case 1: Regular array variable (Dim array[10])
        if case .identifier(let arrayId, _) = access.array,
           let array = context.variableManagement.arrayInfo(for: arrayId.name) {
            instrs.append(.i32Const(Int32(truncatingIfNeeded: array.baseAddress)))
            
            // Calculate offset: sum of (index * stride) for each dimension
            let strides = array.strides
            for (index, indexExpr) in access.indices.enumerated() {
                let indexResult = generateWithInfo(indexExpr)
                instrs.append(contentsOf: indexResult.instrs)
                instrs.append(contentsOf: convert(from: indexResult.type, to: .i32))
                
                // Multiply by stride for this dimension
                // For 1D arrays: stride[0] = elementSize
                // For multi-dimensional: stride[i] = product of previous dimensions * elementSize
                let stride = index < strides.count ? strides[index] : array.elementSize
                instrs.append(.i32Const(Int32(truncatingIfNeeded: stride)))
                instrs.append(.i32Mul)
                
                // Add to running offset
                if index > 0 {
                    instrs.append(.i32Add)
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
        if case .fieldAccess(let fieldAccess, _) = access.array {
            if let typeName = getTypeName(from: fieldAccess.object),
               let dimensions = context.fieldDimensions[typeName]?[fieldAccess.field],
               !dimensions.isEmpty {
                
                // Generate the field access to get base pointer
                let baseInstrs = generate(.fieldAccess(fieldAccess, fieldAccess.span))
                instrs.append(contentsOf: baseInstrs)
                
                // Get element type and size
                let fieldType = context.userTypes[typeName.lowercased()]?.fieldTypes[fieldAccess.field] ?? "Int"
                let elementType = typeHandling.wasmType(from: fieldType)
                let elementSize = context.typeSize(for: elementType)
                
                // For 1D array: address = base + index * elementSize
                // For multi-dimensional, we'd need strides
                // Simplified: assume 1D or row-major for now
                if access.indices.count >= 1 {
                    let indexResult = generateWithInfo(access.indices[0])
                    instrs.append(contentsOf: indexResult.instrs)
                    instrs.append(contentsOf: convert(from: indexResult.type, to: .i32))
                    
                    if elementSize > 1 {
                        instrs.append(.i32Const(Int32(truncatingIfNeeded: elementSize)))
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
        
        // Add field offset (use lowercased names for lookup)
        if let typeName = getTypeName(from: access.object),
           let fieldOffset = context.fieldOffsets[typeName.lowercased()]?[access.field.lowercased()] {
            CompilerLogger.debug("DEBUG_FIELD_ACCESS: type=\(typeName) field=\(access.field) offset=\(fieldOffset)")
            instrs.append(.i32Const(Int32(truncatingIfNeeded: fieldOffset)))
            instrs.append(.i32Add)
            
            // Check if this field is an array
            let fieldDimensions = context.fieldDimensions[typeName.lowercased()]?[access.field.lowercased()]
            let fieldType = context.userTypes[typeName.lowercased()]?.fieldTypes[access.field.lowercased()] ?? "Int"
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
        let (exprInstrs, exprType) = generateWithInfo(cast.expression)
        let targetType = typeHandling.typeInfo(from: cast.targetType.rawValue).wasmType
        
        var instrs = exprInstrs
        instrs.append(contentsOf: convert(from: exprType, to: targetType))
        
        return (instrs, targetType)
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
        case (_, .void): return source != .void ? [.drop] : []
        default: return []
        }
    }
    
    private func getTypeName(from expr: ExpressionNode) -> String? {
        switch expr {
        case .identifier(let id, _):
            if let local = context.variableManagement.localInfo(for: id.name) {
                return local.typeName
            }
            if let global = context.variableManagement.globalInfo(for: id.name) {
                return global.typeName
            }
        case .fieldAccess(let access, _):
            if let objType = getTypeName(from: access.object),
               let fieldType = context.userTypes[objType.lowercased()]?.fieldTypes[access.field] {
                return fieldType
            }
        case .new(let type, _):
            return type
        case .first(let type, _):
            return type
        case .last(let type, _):
            return type
        case .before(let subExpr, _):
            return getTypeName(from: subExpr)
        case .after(let subExpr, _):
            return getTypeName(from: subExpr)
        case .arrayAccess(let access, _):
            // Check if it's a field array access: obj.field[index]
            if case .fieldAccess(let fieldAccess, _) = access.array,
               let objType = getTypeName(from: fieldAccess.object),
               let fieldType = context.userTypes[objType.lowercased()]?.fieldTypes[fieldAccess.field] {
                return fieldType
            }
        case .objectCast(let type, _, _):
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
        let len = Int32(truncatingIfNeeded: utf8Bytes.count)
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

        let data = WASMData(memoryIndex: 0, offset: .i32Const(Int32(truncatingIfNeeded: offset)), bytes: bytes)
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
