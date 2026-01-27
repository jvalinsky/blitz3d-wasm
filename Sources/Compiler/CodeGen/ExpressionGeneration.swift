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
            print("DEBUG_COMPILER: Auto-declaring implicit variable '\(id.name)' as global (read)")
            
            // CRITICAL FIX: Infer type using forward scanning first
            // This handles cases like: ScrollMenuHeight used without suffix, then ScrollMenuHeight# = ...
            let wasmType: WASMType
            
            // Strategy 1: Try forward scanning for type hints
            if let inferredType = context.typeInference.inferVariableType(
                name: id.name,
                fromStatements: context.currentFunctionBody
            ) {
                wasmType = inferredType
                print("  → Inferred from forward scan: \(wasmType)")
            }
            // Strategy 2: Check type suffix on current use
            else if let suffix = id.typeSuffix {
                wasmType = typeHandling.wasmType(from: suffix)
                print("  → Inferred from suffix: \(wasmType)")
            }
            // Strategy 3: Default to i32
            else {
                wasmType = typeHandling.typeInfo(from: id.name).wasmType
                print("  → Inferred from name (default): \(wasmType)")
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
                .i32Const(Int32(truncatingIfNeeded: typeInfo.instanceSize)),
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
            if let typeInfo = context.userTypes[typeName] {
                return ([.globalGet(typeInfo.firstGlobalIdx)], .i32)
            }
            return ([.i32Const(0)], .i32)
            
        case .last(let typeName, _):
            // Last TypeName - get last instance
            if let typeInfo = context.userTypes[typeName] {
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
            if let typeInfo = context.userTypes[typeName] {
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
                print("DEBUG_COMPILER: Generating call to CreateCamera. Index: \(funcIdx)")
            }
            
            // Handle Extra Arguments (Stack Imbalance Fix)
            // If def is missing, check WASM signature for param count!
            var expectedArgCount = call.arguments.count
            
            // Resolve function type to get accurate param count
            var paramCountFromWasm: Int? = nil
            if Int(funcIdx) < context.module.imports.count {
                 let importEntry = context.module.imports[Int(funcIdx)]
                 if importEntry.kind == .function {
                      let typeIdx = importEntry.index
                      if typeIdx < context.module.types.count {
                          paramCountFromWasm = context.module.types[typeIdx].parameters.count
                      }
                 }
            } else {
                 let localFuncIdx = Int(funcIdx) - context.module.imports.count
                 if localFuncIdx < context.module.functions.count {
                      let typeIdx = context.module.functions[localFuncIdx]
                      if typeIdx < context.module.types.count {
                          paramCountFromWasm = context.module.types[typeIdx].parameters.count
                      }
                 }
            }
            
            // Always trust the module's function type for arity when available.
            // (SignatureResolver definitions can drift; the module type is the validation source of truth.)
            if let wasmCount = paramCountFromWasm {
                expectedArgCount = wasmCount
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
                if let def = def, i < def.params.count {
                    instrs.append(contentsOf: convert(from: argResult.type, to: def.params[i]))
                } else if let wasmCount = paramCountFromWasm, i < wasmCount {
                    // Logic to convert to WASM param type? 
                    // We need type lookup again. 
                    // Simplify: Just push. WASM validation will catch bad types, but stack count will be correct.
                }
            }
            
            // 2. Generate side-effects for extra arguments but DROP results immediately
            for i in argsToPush..<call.arguments.count {
                print("DEBUG_COMPILER: Dropping extra argument \(i) for \(internalName)")
                let argResult = generateWithInfo(call.arguments[i])
                instrs.append(contentsOf: argResult.instrs)
                instrs.append(.drop)
            }
            
            // Pad missing args to match signature for imports (auto-imports rely on this)
            let targetParamCount = paramCountFromWasm ?? def?.params.count ?? call.arguments.count
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

            // Determine ACTUAL return type from WASM Module (Source of Truth)
            // This fixes mismatch between Heuristic (f32) and Stub (i32)
            // Determine ACTUAL return type from WASM Module (Source of Truth)
            // This fixes mismatch between Heuristic (f32) and Stub (i32)
            if Int(funcIdx) < context.module.imports.count {
                 let importEntry = context.module.imports[Int(funcIdx)]
                 // importEntry.index IS the type index for functions
                 if importEntry.kind == .function {
                      let typeIdx = importEntry.index
                      if typeIdx < context.module.types.count {
                          let typeFn = context.module.types[typeIdx]
                          actualWasmReturnType = typeFn.results.first ?? .void
                      }
                 }
            } else {
                 // Local function
                 let localFuncIdx = Int(funcIdx) - context.module.imports.count
                 if localFuncIdx < context.module.functions.count {
                      let typeIdx = context.module.functions[localFuncIdx]
                      if typeIdx < context.module.types.count {
                          let typeFn = context.module.types[typeIdx]
                          actualWasmReturnType = typeFn.results.first ?? .void
                      }
                 }
            }
            
            // Determine EXPECTED return type (prefer resolved signature, fall back to actual, minimal heuristics)
            if let def = def {
                returnType = def.results.first ?? .void
            } else if actualWasmReturnType != .void {
                returnType = actualWasmReturnType
            } else if call.name.hasSuffix("#") {
                returnType = .f32
            } else {
                returnType = actualWasmReturnType // Fallback to truth (likely .void here)
            }
            
        // If truth != expected, convert
        if actualWasmReturnType != returnType {
             instrs.append(contentsOf: convert(from: actualWasmReturnType, to: returnType))
        }

        } else {
            // Function not found - same fallback logic
            print("DEBUG_COMPILER: WARNING! Function \(internalName) not found in map. Defaulting to 0/0.0.")
            for _ in call.arguments {
                instrs.append(.drop) // Drop logic here is simpler: we pushed nothing yet? No, original code pushed.
                // Wait, I cleared instrs above.
                // For unknown function, we can't clear, we must loop and drop.
            }
            // Re-generate args and drop them (simulated side effects)
            instrs = [] 
            for arg in call.arguments {
                let res = generateWithInfo(arg)
                instrs.append(contentsOf: res.instrs)
                instrs.append(.drop)
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
                let fieldType = context.userTypes[typeName]?.fieldTypes[fieldAccess.field] ?? "Int"
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
        
        // Add field offset
        if let typeName = getTypeName(from: access.object),
           let fieldOffset = context.fieldOffsets[typeName]?[access.field] {
            instrs.append(.i32Const(Int32(truncatingIfNeeded: fieldOffset)))
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
               let fieldType = context.userTypes[objType]?.fieldTypes[access.field] {
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
               let fieldType = context.userTypes[objType]?.fieldTypes[fieldAccess.field] {
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
