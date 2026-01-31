
import Foundation

public final class ASTLowering {
    private let builder: IRBuilder
    private var symbolTable: IRSymbolTable
    private var typeHandling: TypeHandling
    private let context: ModuleContext
    
    private var irModuleData: [IRDataSegment] = []
    private var nextStringOffset: Int32 = 1024
    private var nextArrayOffset: Int32 = 65536
    private var stringLiteralMap: [String: Int32] = [:]
    private var dataPool: [DataValue] = []
    private var labelDataOffsets: [String: Int] = [:]
    private var currentDataIndex: Int = 0
    private var pendingDynamicGlobals: [String] = []
    
    // Gosub Support
    private var gosubReturnLabels: [Int: String] = [:] // ID : LabelName
    private var nextGosubId: Int = 1
    private var needsGosubDispatcher = false
    private let GOSUB_STACK_ADDR: Int32 = 65536 // Shadow stack starts at 64KB
    private let GOSUB_MAX_DEPTH: Int32 = 1024
    private var gosubSpGlobalIndex: Int?
    
    public init(context: ModuleContext) {
        self.builder = IRBuilder()
        self.symbolTable = IRSymbolTable()
        self.typeHandling = TypeHandling()
        self.context = context
    }
    
    public func lower(_ program: ProgramNode) -> IRModule {
        var irModule = IRModule()
        
        // Copy imports from context because IREmitter needs them (though IREmitter rebuilds them now, IRModule strictly doesn't have them)
        // But let's copy them just in case.
        
        irModuleData = []
        nextStringOffset = 1024
        stringLiteralMap.removeAll()
        dataPool.removeAll()
        labelDataOffsets.removeAll()
        currentDataIndex = 0
        
        // Reserve space for Gosub Shadow Stack
        // Stack range: [GOSUB_STACK_ADDR, GOSUB_STACK_ADDR + GOSUB_MAX_DEPTH * 4]
        nextArrayOffset = GOSUB_STACK_ADDR + (GOSUB_MAX_DEPTH * 4)
        
        // Register Gosub SP global
        let spName = "__gosub_sp"
        symbolTable.addVariable(spName, type: .i32, isLocal: false)
        gosubSpGlobalIndex = symbolTable.globalIndex(for: spName)
        irModule.globals.append((spName, .i32, true)) // Mutable global
        
        let dataPtrName = "__bb_data_ptr"
        symbolTable.addVariable(dataPtrName, type: .i32, isLocal: false)
        dataPtrGlobalIndex = symbolTable.globalIndex(for: dataPtrName)
        irModule.globals.append((dataPtrName, .i32, true)) 
        
        // 0. Pre-pass: Register all Constants
        for stmt in program.statements {
            if case .constants(let decls, _) = stmt {
                for constant in decls {
                    // Evaluate value
                    if let val = evaluateConstInt(constant.value) {
                        symbolTable.addConstant(constant.name, value: val)
                    }
                }
            } else if case .constant(let decl, _) = stmt {
                 // Single constant? Parser usually produces .constants for list
                 // But AST has both.
                 if let val = evaluateConstInt(decl.value) {
                     symbolTable.addConstant(decl.name, value: val)
                 }
            }
        }
        
        // 1. Register all Types first
        for typeNode in program.types {
            lowerTypeDeclaration(typeNode, to: &irModule)
        }
        
        // 2. Pre-pass: register all function signatures
        for function in program.functions {
            registerFunctionSignature(function)
        }
        
        // 3. Register Globals from statements
        for stmt in program.statements {
            if case .global(let decl, _) = stmt {
                for variable in decl.variables {
                    let irType = lowerTypeSuffix(from: variable.typeSuffix)
                    symbolTable.addVariable(variable.name, type: irType, typeName: variable.typeName, isLocal: false)
                    irModule.globals.append((variable.name, irType, true))
                }
            }
        }
        
        // 4. Lower all functions
        for function in program.functions {
            lowerFunction(function, to: &irModule)
        }
        
        // 5. Lower top-level code into _start
        lowerTopLevel(program.statements, to: &irModule)
        
        // 5b. Add pending dynamic globals (discovered during lowering)
        for globalName in pendingDynamicGlobals {
            irModule.globals.append((globalName, .i32, true))
        }
        pendingDynamicGlobals.removeAll()
        
        // 6. Serialize Data constants
        serializeDataPool(to: &irModule)
        
        irModule.data = irModuleData
        return irModule
    }
    
    private func lowerTypeDeclaration(_ typeNode: TypeNode, to module: inout IRModule) {
        var fieldOffsets: [String: Int] = [:]
        var fieldTypes: [String: IRType] = [:]
        var fieldDimensions: [String: [Int]] = [:]
        var currentOffset = 12 // Header: prev(4), next(4), typeID(4)
        
        for field in typeNode.fields {
            let type = lowerType(from: field.type)
            fieldOffsets[field.name.lowercased()] = currentOffset
            fieldTypes[field.name.lowercased()] = type
            
            // Calculate size for field arrays
            var elementCount = 1
            var dims: [Int] = []
            for dimExpr in field.dimensions {
                if let dim = evaluateConstInt(dimExpr) {
                    // Blitz3D: arr[10] means 11 elements (0 to 10)
                    let size = dim + 1
                    elementCount *= size
                    dims.append(size) // Store the actual size for indexing logic
                }
            }
            
            if !dims.isEmpty {
                fieldDimensions[field.name.lowercased()] = dims
            }
            
            currentOffset += 4 * elementCount // Everything 4 bytes for now in WASM32
        }
        
        // Register Head/Tail globals for this type
        let headName = "__bb_type_\(typeNode.name.lowercased())_head"
        let tailName = "__bb_type_\(typeNode.name.lowercased())_tail"
        
        symbolTable.addVariable(headName, type: .i32, isLocal: false)
        symbolTable.addVariable(tailName, type: .i32, isLocal: false)
        
        module.globals.append((headName, .i32, true))
        module.globals.append((tailName, .i32, true))
        
        let typeInfo = IRTypeInfo(
            typeName: typeNode.name,
            fieldOffsets: fieldOffsets,
            fieldTypes: fieldTypes,
            fieldDimensions: fieldDimensions,
            totalSize: currentOffset,
            headGlobalIndex: symbolTable.globalIndex(for: headName)!,
            tailGlobalIndex: symbolTable.globalIndex(for: tailName)!
        )
        
        symbolTable.addType(typeNode.name, info: typeInfo)
        module.types[typeNode.name.lowercased()] = typeInfo
        CompilerLogger.debug("DEBUG_LOWER: Registered type '\(typeNode.name.lowercased())'")
    }
    
    private func evaluateConstInt(_ expr: ExpressionNode) -> Int? {
        switch expr {
        case .integerLiteral(let val, _):
            return val
        case .unary(let unary, _):
            if unary.op == "-", let val = evaluateConstInt(unary.expression) {
                return -val
            }
            return nil
        case .identifier(let id, _):
            return symbolTable.constantValue(for: id.name)
        default:
            return nil
        }
    }
    
    private let DATA_POOL_ADDR: Int32 = 131072
    private var dataPtrGlobalIndex: Int?

    private func serializeDataPool(to module: inout IRModule) {
        if dataPool.isEmpty { return }
        
        var buffer = Data()
        var offsets: [Int] = []
        
        for value in dataPool {
            offsets.append(buffer.count)
            switch value {
            case .integer(let v):
                var val = Int32(v)
                buffer.append(Data(bytes: &val, count: 4))
            case .float(let v):
                var val = Float32(v)
                buffer.append(Data(bytes: &val, count: 4))
            case .string(let v):
                buffer.append(v.data(using: .utf8)!)
                buffer.append(0) // Null terminator
            }
        }
        
        let segment = IRDataSegment(offset: DATA_POOL_ADDR, data: Array(buffer))
        irModuleData.append(segment)
    }
    
    private func lowerTopLevel(_ statements: [StatementNode], to module: inout IRModule) {
        // Reset Gosub state for top-level code
        gosubReturnLabels = [:]
        needsGosubDispatcher = false
        nextGosubId = 1
        
        symbolTable.clearLocals()
        builder.enterFunction(name: "_start", parameters: [], returnType: .void)
        
        var irBody: [IREffect] = []
        for statement in statements {
            switch statement {
            case .global(let decl, _):
                // Support `Global arr[... ]` sugar by lowering it as a Dim-style array allocation.
                for arrayDecl in decl.arrayDeclarations {
                    lowerDimDeclaration(arrayDecl, into: &irBody)
                }
                // Lower global initializers into _start
                for variable in decl.variables {
                    if let initializer = decl.initializers[variable.name] {
                        let value = lowerExpression(initializer)
                        if let globalIdx = symbolTable.globalIndex(for: variable.name) {
                            irBody.append(.assignGlobal(index: globalIdx, value: value))
                        }
                    }
                }
            case .typeDeclaration, .function, .constant, .constants:
                continue
            default:
                lowerStatement(statement, into: &irBody)
            }
        }
        
        for effect in irBody {
            builder.append(effect)
        }
        
        // Generate Gosub Dispatcher if used in top-level
        if needsGosubDispatcher {
            generateGosubDispatcher(into: &module)
        }
        
        if let startFunc = builder.exitFunction() {
            module.functions.append(startFunc)
        }
    }
    
    private func registerFunctionSignature(_ function: FunctionNode) {
        let paramTypes = function.parameters.map { lowerType(from: $0.type) }
        let resultType = lowerType(from: function.returnType)
        let wasmParams = paramTypes.map { irTypeToWASM($0) }
        let wasmResults = resultType == .void ? [] : [irTypeToWASM(resultType)]
        
        var defaults: [Int: ExpressionNode] = [:]
        for (i, param) in function.parameters.enumerated() {
            if let defaultValue = param.defaultValue {
                defaults[i] = defaultValue
            }
        }
        
        let def = FunctionDefinition(
            params: wasmParams,
            results: wasmResults,
            defaults: defaults.isEmpty ? nil : defaults
        )
        context.functionDefinitions[function.name.lowercased()] = def
    }
    

    
    private func allocateString(_ value: String) -> Int32 {
        if let existingOffset = stringLiteralMap[value] {
            return existingOffset
        }
        
        // Blitz3D String Layout:
        // Offset 0: RefCount (4 bytes)
        // Offset 4: Length (4 bytes)
        // Offset 8: Characters...
        // Offset 8+N: Null terminator
        
        var buffer = Data()
        // RefCount: 1 (static constant)
        var refCount: Int32 = 1
        buffer.append(Data(bytes: &refCount, count: 4))
        
        // Length
        var length: Int32 = Int32(value.utf8.count)
        buffer.append(Data(bytes: &length, count: 4))
        
        // Data + Null
        buffer.append(value.data(using: .utf8)!)
        buffer.append(0)
        
        let offset = nextStringOffset
        let data = IRDataSegment(offset: offset, data: Array(buffer))
        irModuleData.append(data)
        
        // Align next offset to 4 bytes
        let totalSize = buffer.count
        nextStringOffset += Int32((totalSize + 3) & ~3)
        
        stringLiteralMap[value] = offset
        // nextStringOffset is already updated above
        return offset
    }
    
    private func lowerFunction(_ function: FunctionNode, to module: inout IRModule) {
        let parameters = function.parameters.map { ($0.name, lowerType(from: $0.type), $0.typeName) }
        let returnType = lowerType(from: function.returnType)
        
        // Reset Gosub state for new function
        gosubReturnLabels = [:]
        needsGosubDispatcher = false
        
        symbolTable.clearLocals()
        builder.enterFunction(name: function.name, parameters: parameters, returnType: returnType, returnTypeName: function.returnTypeName)
        
        for param in function.parameters {
            let irType = lowerType(from: param.type)
            symbolTable.addVariable(param.name, type: irType, typeName: param.typeName, isLocal: true)
        }
        
        var irBody: [IREffect] = []
        for statement in function.body {
            lowerStatement(statement, into: &irBody)
        }
        
        for effect in irBody {
            builder.append(effect)
        }
        
        // Generate Gosub Dispatcher if used in this function
        if needsGosubDispatcher {
            generateGosubDispatcher(into: &module)
        }
        
        if let irFunc = builder.exitFunction() {
            module.functions.append(irFunc)
        }
    }
    
    private func lowerStatement(_ statement: StatementNode, into body: inout [IREffect]) {
        switch statement {
        case .local(let decl, _):
            for arrayDecl in decl.arrayDeclarations {
                lowerDimDeclaration(arrayDecl, into: &body)
            }
            for variable in decl.variables {
                let irType = lowerTypeSuffix(from: variable.typeSuffix)
                builder.addLocal(name: variable.name, type: irType, typeName: variable.typeName)
                symbolTable.addVariable(variable.name, type: irType, typeName: variable.typeName, isLocal: true)
                
                if let initializer = decl.initializers[variable.name] {
                    let value = lowerExpression(initializer)
                    body.append(.assignLocal(index: symbolTable.localIndex(for: variable.name)!, value: value))
                }
            }
            
        case .global(let decl, _):
            for arrayDecl in decl.arrayDeclarations {
                lowerDimDeclaration(arrayDecl, into: &body)
            }
            break
            
        case .constant, .constants:
            break
            
        case .dim(let decl, _):
            lowerDimDeclaration(decl, into: &body)
            
        case .dims(let decls, _):
            for decl in decls {
                lowerDimDeclaration(decl, into: &body)
            }
            
        case .assignment(let assign, _):
            let value = lowerExpression(assign.value)
            
            switch assign.target {
            case .identifier(let id, _):
                if let localIdx = symbolTable.localIndex(for: id.name) {
                    let targetType = symbolTable.type(of: id.name) ?? lowerTypeSuffix(from: id.typeSuffix)
                    body.append(.assignLocal(index: localIdx, value: coerce(value, to: targetType)))
                } else if let globalIdx = symbolTable.globalIndex(for: id.name) {
                    let targetType = symbolTable.type(of: id.name) ?? lowerTypeSuffix(from: id.typeSuffix)
                    body.append(.assignGlobal(index: globalIdx, value: coerce(value, to: targetType)))
                } else {
                    // Implicit local declaration
                    let irType: IRType
                    if let typeName = id.typeName {
                         // Typed implicit declaration: t.MyType = ...
                         // Custom types are pointers (i32)
                         irType = .i32
                    } else {
                         // Infers from suffix or default
                         irType = lowerTypeSuffix(from: id.typeSuffix)
                    }
                    
                    builder.addLocal(name: id.name, type: irType, typeName: id.typeName)
                    symbolTable.addVariable(id.name, type: irType, typeName: id.typeName, isLocal: true)
                    
                    if let newIdx = symbolTable.localIndex(for: id.name) {
                        body.append(.assignLocal(index: newIdx, value: coerce(value, to: irType)))
                    }
                }
                
            case .arrayAccess(let access, _):
                if case .identifier(let arrayId, _) = access.array,
                   let arrayInfo = symbolTable.arrayInfo(for: arrayId.name) {
                    let baseAddr = builder.buildConstI32(Int32(arrayInfo.baseAddress))
                    let flatIndex = flattenIndex(indices: access.indices, dimensions: arrayInfo.dimensions)
                    
                    body.append(.assignArray(
                        base: baseAddr,
                        index: flatIndex,
                        elementSize: arrayInfo.elementSize,
                        elementType: arrayInfo.elementType,
                        value: coerce(value, to: arrayInfo.elementType)
                    ))
                } else if case .fieldAccess(let fieldAccess, _) = access.array,
                          let typeName = getTypeName(from: fieldAccess.object),
                          let fieldOffset = symbolTable.fieldOffset(type: typeName, field: fieldAccess.field),
                          let fieldType = symbolTable.fieldType(type: typeName, field: fieldAccess.field) {
                    
                    let baseObj = lowerExpression(fieldAccess.object)
                    let baseAddr = builder.buildBinary("+", lhs: baseObj, rhs: builder.buildConstI32(Int32(fieldOffset)), resultType: .i32)
                    
                    let dims = symbolTable.fieldDimensions(type: typeName, field: fieldAccess.field) ?? []
                    let flatIndex = flattenIndex(indices: access.indices, dimensions: dims)
                    
                    body.append(.assignArray(
                         base: baseAddr,
                         index: flatIndex,
                         elementSize: 4, // Fields are usually 4 bytes
                         elementType: fieldType,
                         value: coerce(value, to: fieldType)
                    ))
                }
                
            case .fieldAccess(let access, _):
                if let typeName = getTypeName(from: access.object),
                   let fieldOffset = symbolTable.fieldOffset(type: typeName, field: access.field),
                   let fieldType = symbolTable.fieldType(type: typeName, field: access.field) {
                    let baseValue = lowerExpression(access.object)
                    body.append(.assignField(
                        base: baseValue,
                        fieldOffset: fieldOffset,
                        fieldType: fieldType,
                        value: coerce(value, to: fieldType)
                    ))
                }
                
            case .functionCall(let call, _):
                if let arrayInfo = symbolTable.arrayInfo(for: call.name) {
                    let baseAddr: IRValue
                    if let ptrIdx = arrayInfo.dynamicPointerGlobalIndex {
                         baseAddr = .globalGet(index: ptrIdx, type: .i32)
                    } else {
                         baseAddr = builder.buildConstI32(Int32(arrayInfo.baseAddress))
                    }
                    
                    let flatIndex = flattenIndex(indices: call.arguments, dimensions: arrayInfo.dimensions)
                    body.append(.assignArray(
                        base: baseAddr,
                        index: flatIndex,
                        elementSize: arrayInfo.elementSize,
                        elementType: arrayInfo.elementType,
                        value: coerce(value, to: arrayInfo.elementType)
                    ))
                }
                
            default:
                break
            }
            
        case .functionCall(let call, _):
            let callValue = lowerCall(call)
            body.append(.discard(callValue))
            
        case .ifStatement(let ifNode, _):
            let condition = lowerExpression(ifNode.condition)
            
            var thenBody: [IREffect] = []
            for stmt in ifNode.thenBranch {
                lowerStatement(stmt, into: &thenBody)
            }
            
            var elseBody: [IREffect]?
            if !ifNode.elseBranch.isEmpty {
                var elseEffects: [IREffect] = []
                for stmt in ifNode.elseBranch {
                    lowerStatement(stmt, into: &elseEffects)
                }
                elseBody = elseEffects
            }
            
            body.append(builder.buildIf(condition, then: thenBody, else: elseBody))
            
        case .whileLoop(let whileNode, _):
            let condition = lowerExpression(whileNode.condition)
            
            var loopBody: [IREffect] = []
            for stmt in whileNode.body {
                lowerStatement(stmt, into: &loopBody)
            }
            
            body.append(builder.buildWhile(condition, body: loopBody))
            
        case .forLoop(let forNode, _):
            let start = lowerExpression(forNode.startValue)
            let end = lowerExpression(forNode.endValue)
            let step = forNode.stepValue.map { lowerExpression($0) } ?? builder.buildConstI32(1)
            
            let loopVarType = lowerTypeSuffix(from: forNode.variable.typeSuffix)
            builder.addLocal(name: forNode.variable.name, type: loopVarType)
            symbolTable.addVariable(forNode.variable.name, type: loopVarType, isLocal: true)
            
            guard let localIdx = symbolTable.localIndex(for: forNode.variable.name) else {
                return
            }
            
            var loopBody: [IREffect] = []
            for stmt in forNode.body {
                lowerStatement(stmt, into: &loopBody)
            }
            
            body.append(.forStmt(
                index: localIdx,
                start: start,
                end: end,
                step: step,
                body: loopBody
            ))
            
        case .repeatLoop(let repeatNode, _):
            var repeatBody: [IREffect] = []
            for stmt in repeatNode.body {
                lowerStatement(stmt, into: &repeatBody)
            }
            let condition = lowerExpression(repeatNode.condition)
            
            body.append(.repeatStmt(body: repeatBody, condition: condition))
            
        case .returnStatement(let expr, _):
            if let returnExpr = expr {
                let value = lowerExpression(returnExpr)
                body.append(builder.buildReturn(value))
            } else {
                // Bare Return is treated as Gosub Return if we've seen Gosubs,
                // otherwise it's a void function return.
                // In Blitz3D, Return is primarily for Gosub.
                needsGosubDispatcher = true
                body.append(builder.buildBranch("__gosub_dispatch"))
            }
            
        case .exit(_):
            body.append(.breakStmt)
            
        case .label(let name, _):
            body.append(builder.buildLabel(name))
            labelDataOffsets[name] = dataPool.count
            
        case .goto(let label, _):
            body.append(builder.buildBranch(label))
            
        case .gosub(let label, _):
            // ... (keep start)
            let returnId = nextGosubId
            nextGosubId += 1
            let returnLabel = "__gosub_ret_\(returnId)"
            gosubReturnLabels[returnId] = returnLabel
            
            // 1. Push return ID: stack[sp] = id; sp++
            if let spIdx = gosubSpGlobalIndex {
                let spValue = IRValue.globalGet(index: spIdx, type: .i32)
                
                // mem[GOSUB_STACK_ADDR + sp * 4] = returnId
                let addr = builder.buildBinary("+", 
                    lhs: builder.buildConstI32(GOSUB_STACK_ADDR), 
                    rhs: builder.buildBinary("*", lhs: spValue, rhs: builder.buildConstI32(4), resultType: .i32),
                    resultType: .i32)
                
                body.append(.assignField(base: addr, fieldOffset: 0, fieldType: .i32, value: .constI32(Int32(returnId))))
                
                // sp++
                body.append(.assignGlobal(index: spIdx, value: builder.buildBinary("+", lhs: spValue, rhs: builder.buildConstI32(1), resultType: .i32)))
            }
            
            // 2. Branch to target
            body.append(builder.buildBranch(label))
            
            // 3. Define return label
            body.append(builder.buildLabel(returnLabel))
            
        case .forEach(let forEachNode, _):
            guard let typeInfo = symbolTable.typeInfo(for: forEachNode.typeName) else { break }
            
            // Implicitly register iterator if not already present
            if symbolTable.localIndex(for: forEachNode.iteratorName) == nil {
                builder.addLocal(name: forEachNode.iteratorName, type: .i32, typeName: forEachNode.typeName)
                symbolTable.addVariable(forEachNode.iteratorName, type: .i32, typeName: forEachNode.typeName, isLocal: true)
            }
            
            guard let itIdx = symbolTable.localIndex(for: forEachNode.iteratorName) else { break }
            
            // it = Type_Head
            body.append(.assignLocal(index: itIdx, value: .globalGet(index: typeInfo.headGlobalIndex, type: .i32)))
            
            // Loop condition: while it != 0
            let condition = builder.buildBinary("<>", lhs: .localGet(index: itIdx, type: .i32), rhs: builder.buildConstI32(0), resultType: .i32)
            
            var loopBody: [IREffect] = []
            for stmt in forEachNode.body {
                lowerStatement(stmt, into: &loopBody)
            }
            
            // it = it.next (offset 4)
            let nextVal = IRValue.loadField(base: .localGet(index: itIdx, type: .i32), fieldOffset: 4, fieldType: .i32)
            loopBody.append(.assignLocal(index: itIdx, value: nextVal))
            
            body.append(.whileStmt(condition: condition, body: loopBody))
            
        case .data(let values, _):
            dataPool.append(contentsOf: values)
            
        case .read(let identifiers, _):
            for id in identifiers {
                let typeHint: Int32 = id.name.hasSuffix("$") ? 3 : (id.name.hasSuffix("#") ? 2 : 1)
                let val = IRValue.call(name: "ReadData", args: [builder.buildConstI32(typeHint)], resultType: .i32)
                
                if let localIdx = symbolTable.localIndex(for: id.name) {
                    body.append(.assignLocal(index: localIdx, value: val))
                } else if let globalIdx = symbolTable.globalIndex(for: id.name) {
                    body.append(.assignGlobal(index: globalIdx, value: val))
                }
            }
            
        case .restore(let label, _):
            body.append(.discard(.call(name: "RestoreData", args: [builder.buildConstI32(0)], resultType: .void)))
            
        case .typeDeclaration:
            break
            
        case .read, .restore:
            break
            
        case .delete(let expr, _):
            let value = lowerExpression(expr)
            body.append(.delete(value: value))
            
        case .insert(_, _, _):
            break
            
        case .select(let selectNode, _):
            let expr = lowerExpression(selectNode.expression)
            
            // Lower Select Case to an If-Else chain in IR
            // For optimized performance, we could use a switch-like structure,
            // but If-Else is always safe and supports ranges easily.
            
            var currentEffect: IREffect? = nil
            
            // Build from bottom up (default case first)
            var lastElse: [IREffect]? = nil
            if let defaultBody = selectNode.defaultCase {
                var irDefaultBody: [IREffect] = []
                for stmt in defaultBody {
                    lowerStatement(stmt, into: &irDefaultBody)
                }
                lastElse = irDefaultBody
            }
            
            for caseNode in selectNode.cases.reversed() {
                var condition: IRValue? = nil
                
                for value in caseNode.values {
                    let caseCond: IRValue
                    switch value {
                    case .single(let caseExpr):
                        caseCond = builder.buildBinary("=", lhs: expr, rhs: lowerExpression(caseExpr), resultType: .i32)
                    case .range(let start, let end):
                        let low = builder.buildBinary(">=", lhs: expr, rhs: lowerExpression(start), resultType: .i32)
                        let high = builder.buildBinary("<=", lhs: expr, rhs: lowerExpression(end), resultType: .i32)
                        caseCond = builder.buildBinary("And", lhs: low, rhs: high, resultType: .i32)
                    }
                    
                    if let existing = condition {
                        condition = builder.buildBinary("Or", lhs: existing, rhs: caseCond, resultType: .i32)
                    } else {
                        condition = caseCond
                    }
                }
                
                var thenBody: [IREffect] = []
                for stmt in caseNode.body {
                    lowerStatement(stmt, into: &thenBody)
                }
                
                let ifStmt = builder.buildIf(condition!, then: thenBody, else: lastElse)
                lastElse = [ifStmt]
            }
            
            if let firstIf = lastElse?.first {
                body.append(firstIf)
            }
            
        case .function, .forEach, .data, .empty:
            break
        }
    }

    private func lowerDimDeclaration(_ decl: DimDeclaration, into body: inout [IREffect]) {
        let irType: IRType = .i32
        let elementSize = 4

        var isDynamic = false
        var dimSizes: [Int] = []
        var totalElements = 1
        var runtimeSize: IRValue? = nil

        for dimExpr in decl.dimensions {
            if let size = evaluateConstInt(dimExpr) {
                let actualSize = size + 1
                dimSizes.append(actualSize)
                totalElements *= actualSize

                if let existingSize = runtimeSize {
                    runtimeSize = builder.buildBinary("*", lhs: existingSize, rhs: builder.buildConstI32(Int32(actualSize)), resultType: .i32)
                } else {
                    runtimeSize = builder.buildConstI32(Int32(actualSize))
                }
            } else {
                isDynamic = true
                let exprVal = lowerExpression(dimExpr)
                let actualSize = builder.buildBinary("+", lhs: exprVal, rhs: builder.buildConstI32(1), resultType: .i32)
                dimSizes.append(0) // Marker for dynamic

                if let existingSize = runtimeSize {
                    runtimeSize = builder.buildBinary("*", lhs: existingSize, rhs: actualSize, resultType: .i32)
                } else {
                    runtimeSize = actualSize
                }
            }
        }

        if isDynamic, let totalSize = runtimeSize {
            // Register global pointer for dynamic array
            let ptrName = "__arr_\(decl.name.lowercased())_ptr"
            symbolTable.addVariable(ptrName, type: .i32, isLocal: false)
            let globalIdx = symbolTable.globalIndex(for: ptrName)!

            // Add to pending globals to be added to module later
            pendingDynamicGlobals.append(ptrName)

            // Calculate size in bytes
            let sizeInBytes = builder.buildBinary("*", lhs: totalSize, rhs: builder.buildConstI32(4), resultType: .i32)

            // Allocate from `__bb_data_ptr` (simple bump allocator) to avoid depending on CodeGenerator-only helpers.
            if let dataPtrIdx = dataPtrGlobalIndex {
                let oldPtr = IRValue.globalGet(index: dataPtrIdx, type: .i32)
                body.append(.assignGlobal(index: globalIdx, value: oldPtr))

                let newPtr = builder.buildBinary("+", lhs: oldPtr, rhs: sizeInBytes, resultType: .i32)
                body.append(.assignGlobal(index: dataPtrIdx, value: newPtr))
            } else {
                body.append(.assignGlobal(index: globalIdx, value: builder.buildConstI32(0)))
            }

            let arrayInfo = IRArrayInfo(
                baseAddress: 0,
                elementSize: elementSize,
                dimensions: dimSizes,
                elementType: irType,
                dynamicPointerGlobalIndex: globalIdx
            )
            symbolTable.addArray(decl.name, info: arrayInfo)

        } else {
            let arrayInfo = IRArrayInfo(
                baseAddress: Int(nextArrayOffset),
                elementSize: elementSize,
                dimensions: dimSizes,
                elementType: irType
            )
            symbolTable.addArray(decl.name, info: arrayInfo)
            nextArrayOffset += Int32(totalElements * elementSize)
        }
    }
    
    private func lowerExpression(_ expression: ExpressionNode) -> IRValue {
        switch expression {
        case .integerLiteral(let value, _):
            return builder.buildConstI32(Int32(truncatingIfNeeded: value))
            
        case .floatLiteral(let value, _):
            return builder.buildConstF32(Float(value))
            
        case .stringLiteral(let value, _):
            let ptr = allocateString(value)
            return .constStringPtr(ptr)
            
        case .identifier(let id, _):
            if let localIdx = symbolTable.localIndex(for: id.name) {
                let type = symbolTable.type(of: id.name) ?? .i32
                return .localGet(index: localIdx, type: type)
            } else if let globalIdx = symbolTable.globalIndex(for: id.name) {
                let type = symbolTable.type(of: id.name) ?? .i32
                return .globalGet(index: globalIdx, type: type)
            }
            return builder.buildConstI32(0)
            
        case .binary(let binop, _):
            let lhs = lowerExpression(binop.left)
            let rhs = lowerExpression(binop.right)
            
            // Check for string concatenation
            if binop.op == "+" && (isStringExpression(binop.left) || isStringExpression(binop.right)) {
                // Ensure both are strings. If one is int/float, we might need conversion (Str$)
                // For now assuming implicit or explicit conversion exists or user provides strings.
                // Actually Blitz3D allows "Str" + 123.
                
                // TODO: Handle Int/Float to String conversion if needed. 
                // Currently assuming strings.
                
                return .call(name: "StringConcat", args: [lhs, rhs], resultType: .i32)
            }
            
            let op = binop.op
            let isComparison = op == "=" || op == "<>" || op == "<" || op == ">" || op == "<=" || op == ">="
            let isIntegerOnly = op == "And" || op == "Or" || op == "Xor" || op == "Shl" || op == "Shr" || op == "mod"
            let operandType: IRType = isIntegerOnly ? .i32 : commonType(lhs.type, rhs.type)

            let lhsC = coerce(lhs, to: operandType)
            let rhsC = coerce(rhs, to: operandType)
            let resultType: IRType = isComparison ? .i32 : operandType
            return builder.buildBinary(op, lhs: lhsC, rhs: rhsC, resultType: resultType)
            
        case .unary(let unary, _):
            let operand = lowerExpression(unary.expression)
            
            switch unary.op {
            case "Not":
                let opnd = coerce(operand, to: .i32)
                return builder.buildBinary("Xor", lhs: opnd, rhs: builder.buildConstI32(-1), resultType: .i32)
            case "-":
                if operand.type == .i32 {
                    if case .constI32(let v) = operand {
                        return .constI32(-v)
                    }
                    return builder.buildBinary("-", lhs: builder.buildConstI32(0), rhs: operand, resultType: .i32)
                } else {
                    if case .constF32(let v) = operand {
                        return .constF32(-v)
                    }
                    return builder.buildBinary("-", lhs: builder.buildConstF32(0), rhs: operand, resultType: .f32)
                }
            default:
                return operand
            }
            
        case .functionCall(let call, _):
            return lowerCall(call)
            
        case .fieldAccess(let access, _):
            if let typeName = getTypeName(from: access.object),
               let fieldOffset = symbolTable.fieldOffset(type: typeName, field: access.field),
               let fieldType = symbolTable.fieldType(type: typeName, field: access.field) {
                let baseValue = lowerExpression(access.object)
                return IRValue.loadField(base: baseValue, fieldOffset: fieldOffset, fieldType: fieldType)
            }
            return builder.buildConstI32(0)
            
        case .arrayAccess(let access, _):
            if case .identifier(let arrayId, _) = access.array,
               let arrayInfo = symbolTable.arrayInfo(for: arrayId.name) {
                let baseAddr = builder.buildConstI32(Int32(arrayInfo.baseAddress))
                let flatIndex = flattenIndex(indices: access.indices, dimensions: arrayInfo.dimensions)
                return IRValue.loadArray(base: baseAddr, index: flatIndex, elementSize: arrayInfo.elementSize, elementType: arrayInfo.elementType)
            } else if case .fieldAccess(let fieldAccess, _) = access.array,
               let typeName = getTypeName(from: fieldAccess.object),
               let fieldOffset = symbolTable.fieldOffset(type: typeName, field: fieldAccess.field),
               let fieldType = symbolTable.fieldType(type: typeName, field: fieldAccess.field) {
                
                let baseValue = lowerExpression(fieldAccess.object)
                let fieldAddr = builder.buildBinary("+", lhs: baseValue, rhs: builder.buildConstI32(Int32(fieldOffset)), resultType: .i32)
                
                let dims = symbolTable.fieldDimensions(type: typeName, field: fieldAccess.field) ?? []
                let flatIndex = flattenIndex(indices: access.indices, dimensions: dims)
                return IRValue.loadArray(base: fieldAddr, index: flatIndex, elementSize: 4, elementType: fieldType)
            }
            return builder.buildConstI32(0)
            
        case .new(let typeName, _):
            return .new(typeName: typeName)
            
        case .first(let typeName, _):
            return .first(typeName: typeName)
            
        case .last(let typeName, _):
            return .last(typeName: typeName)
            
        case .before(let expr, _):
            return .before(value: lowerExpression(expr))
            
        case .after(let expr, _):
            return .after(value: lowerExpression(expr))
            
        case .handle(let expr, _):
            return .handle(value: lowerExpression(expr))
            
        case .objectCast(let typeName, let expr, _):
            return .objectCast(typeName: typeName, value: lowerExpression(expr))
            
        case .typeCast(let cast, _):
            let value = lowerExpression(cast.expression)
            let targetType = lowerType(from: cast.targetType)
            return .convert(value: value, from: value.type, to: targetType)
            
        default:
            return builder.buildConstI32(0)
        }
    }
    
    private func lowerCall(_ call: FunctionCallNode) -> IRValue {
        if let arrayInfo = symbolTable.arrayInfo(for: call.name) {
            let baseAddr: IRValue
            if let ptrIdx = arrayInfo.dynamicPointerGlobalIndex {
                 baseAddr = .globalGet(index: ptrIdx, type: .i32)
            } else {
                 baseAddr = builder.buildConstI32(Int32(arrayInfo.baseAddress))
            }
            let flatIndex = flattenIndex(indices: call.arguments, dimensions: arrayInfo.dimensions)
            return .loadArray(base: baseAddr, index: flatIndex, elementSize: arrayInfo.elementSize, elementType: arrayInfo.elementType)
        }
        
        // Special handling for Print overloading
        if call.name.lowercased() == "print" {
            if let arg = call.arguments.first {
                let lowerArg = lowerExpression(arg)
                
                var isString = false
                if case .stringLiteral = arg {
                     isString = true
                } else if case .binary = arg {
                     isString = true 
                } else if case .identifier(let id, _) = arg,
                          (id.typeSuffix == .string || symbolTable.type(of: id.name) == .i32 && id.name.hasSuffix("$")) {
                     isString = true
                } else if case .functionCall(let subCall, _) = arg, subCall.name.hasSuffix("$") {
                     isString = true
                }
                
                if isString {
                    return .call(name: "printstring", args: [lowerArg], resultType: .void)
                } else if lowerArg.type == .f32 {
                     return .call(name: "printfloat", args: [lowerArg], resultType: .void)
                } else {
                    return .call(name: "printint", args: [lowerArg], resultType: .void)
                }
            } else {
                // Empty Print: print a newline
                let emptyStr = allocateString("")
                return .call(name: "printstring", args: [.constStringPtr(emptyStr)], resultType: .void)
            }
        }

        var args = call.arguments.map { lowerExpression($0) }
        
        // Check if this is a type cast: TypeName(handle)
        if symbolTable.typeInfo(for: call.name) != nil && args.count == 1 {
            CompilerLogger.debug("DEBUG_LOWER: Lowering '\(call.name)' as .objectCast")
            return .objectCast(typeName: call.name, value: args[0])
        }

        CompilerLogger.debug("DEBUG_LOWER: Resolving call to '\(call.name)' at \(call.span.start)")
        let resolver = SignatureResolver(context: context)
        
        if let def = resolver.definition(forName: call.name) {
            let expectedCount = def.params.count
            if args.count < expectedCount {
                for i in args.count..<expectedCount {
                    if let defaultValue = def.defaults?[i] {
                        args.append(lowerExpression(defaultValue))
                    } else {
                        args.append(.constI32(0))
                    }
                }
            }

            // Coerce arguments to the expected signature types.
            if !def.params.isEmpty {
                for i in 0..<min(args.count, def.params.count) {
                    let expected = irType(from: def.params[i])
                    args[i] = coerce(args[i], to: expected)
                }
            }
            
            let irResult = irType(from: def.results.first ?? .void)
            return .call(name: call.name.lowercased(), args: args, resultType: irResult)
        }

        if context.canAutoImport(call.name) {
            // Register an auto-import using the *typed* call-site arguments.
            // This is critical for WASM validation: the import signature must match what we push.
            let params = args.map { irTypeToWASM($0.type) }
            let results: [WASMType]
            if call.name.hasSuffix("#") {
                results = [.f32]
            } else {
                // Strings and opaque handles are represented as i32 pointers/indices.
                results = [.i32]
            }
            _ = context.registerAutoImport(name: call.name, params: params, results: results)
            if let def = resolver.definition(forName: call.name) {
                let irResult = irType(from: def.results.first ?? .void)
                // Coerce arguments to the registered signature types.
                if !def.params.isEmpty {
                    for i in 0..<min(args.count, def.params.count) {
                        let expected = irType(from: def.params[i])
                        args[i] = coerce(args[i], to: expected)
                    }
                }
                return .call(name: call.name.lowercased(), args: args, resultType: irResult)
            }
        }

        CompilerLogger.warn("ERROR: Unknown function '\(call.name)' at \(call.span.start)")
        return .call(name: call.name.lowercased(), args: args, resultType: .i32)
    }
    

    
    private func flattenIndex(indices: [ExpressionNode], dimensions: [Int]) -> IRValue {
        // Array indices are always i32 in the generated WASM.
        var flatIndex = coerce(lowerExpression(indices[0]), to: .i32)
        for i in 1..<indices.count {
            let dimSize = i < dimensions.count ? dimensions[i] : 1
            flatIndex = builder.buildBinary("*", lhs: flatIndex, rhs: builder.buildConstI32(Int32(dimSize)), resultType: .i32)
            let idx = coerce(lowerExpression(indices[i]), to: .i32)
            flatIndex = builder.buildBinary("+", lhs: flatIndex, rhs: idx, resultType: .i32)
        }
        return flatIndex
    }
    
    private func lowerTypeSuffix(from typeSuffix: TypeSuffix?) -> IRType {
        guard let suffix = typeSuffix else { return .i32 }
        switch suffix {
        case .integer: return .i32
        case .float: return .f32
        case .string: return .i32
        case .object: return .i32
        }
    }
    
    private func lowerType(from typeAnnotation: TypeAnnotation?) -> IRType {
        guard let annotation = typeAnnotation else { return .i32 }
        switch annotation {
        case .integer:
            return .i32
        case .float:
            return .f32
        case .string:
            return .i32
        case .void:
            return .void
        }
    }
    
    private func lowerFunctionSignature(_ name: String) -> (params: [IRType], resultType: IRType) {
        let module = WASMModule()
        let context = ModuleContext(module: module)
        let builtInImports: [(String, [WASMType], [WASMType])] = [
            ("PrintInt", [.i32], []),
            ("printint", [.i32], []),
            ("PrintFloat", [.f32], []),
            ("printfloat", [.f32], []),
            ("PrintString", [.i32], []),
            ("printstring", [.i32], []),
            ("Graphics3D", [.i32, .i32, .i32, .i32], []),
            ("AppTitle", [.i32, .i32], []),
            ("GraphicsWidth", [], [.i32]),
            ("GraphicsHeight", [], [.i32]),
            ("WindowWidth", [], [.i32]),
            ("WindowHeight", [], [.i32]),
            ("CreatePivot", [.i32], [.i32]),
            ("NameEntity", [.i32, .i32], []),
            ("EntityName", [.i32], [.i32]),
            ("CountChildren", [.i32], [.i32]),
            ("GetChild", [.i32, .i32], [.i32]),
            ("GetParent", [.i32], [.i32]),
            ("FindChild", [.i32, .i32], [.i32]),
            ("EntityClass", [.i32], [.i32]),
            ("EntityPick", [.i32, .f32], [.i32]),
            ("LinePick", [.f32, .f32, .f32, .f32, .f32, .f32, .f32], [.i32]),
            ("PickedX", [], [.f32]),
            ("PickedY", [], [.f32]),
            ("PickedZ", [], [.f32]),
            ("PickedNX", [], [.f32]),
            ("PickedNY", [], [.f32]),
            ("PickedNZ", [], [.f32]),
            ("PickedEntity", [], [.i32]),
            ("PickedSurface", [], [.i32]),
            ("PickedTriangle", [], [.i32]),
            ("EntityOrder", [.i32, .i32], []),
            ("EntityAutoFade", [.i32, .f32, .f32], []),
            ("MilliSecs", [], [.i32]),
            ("FSOUND_Stream_GetTime", [.i32], [.i32]),
            ("GetEntityBrush", [.i32], [.i32]),
        ]
        for (name, params, results) in builtInImports {
            _ = context.registerAutoImport(name: name, params: params, results: results)
        }
        let resolver = SignatureResolver(context: context)
        if let def = resolver.definition(forName: name.lowercased()) {
            let params = def.params.map { irType(from: $0) }
            let resultType = def.results.isEmpty ? .void : irType(from: def.results[0])
            return (params, resultType)
        }
        return ([], .i32)
    }
    
    private func irType(from wasmType: WASMType) -> IRType {
        switch wasmType {
        case .i32: return .i32
        case .f32: return .f32
        case .void: return .void
        default: return .i32
        }
    }
    
    private func irTypeToWASM(_ irType: IRType) -> WASMType {
        switch irType {
        case .i32: return .i32
        case .f32: return .f32
        case .void: return .void
        }
    }
    
    private func commonType(_ lhs: IRType, _ rhs: IRType) -> IRType {
        if lhs == .f32 || rhs == .f32 {
            return .f32
        }
        return .i32
    }

    private func coerce(_ value: IRValue, to target: IRType) -> IRValue {
        guard value.type != target else { return value }
        guard target != .void else { return value }
        return .convert(value: value, from: value.type, to: target)
    }
    
    private func getTypeName(from expression: ExpressionNode) -> String? {
        switch expression {
        case .identifier(let id, _):
            return symbolTable.typeName(for: id.name)
        case .functionCall(let call, _):
            // Check if call was an array access or object return
            if let info = symbolTable.arrayInfo(for: call.name) {
                // ...
            }
            return nil
        default:
            return nil
        }
    }

    private func generateGosubDispatcher(into module: inout IRModule) {
        // Label the dispatcher entry
        builder.append(builder.buildLabel("__gosub_dispatch"))
        
        if let spIdx = gosubSpGlobalIndex {
            // 1. sp--
            let oldSp = IRValue.globalGet(index: spIdx, type: .i32)
            let newSp = builder.buildBinary("-", lhs: oldSp, rhs: builder.buildConstI32(1), resultType: .i32)
            builder.append(.assignGlobal(index: spIdx, value: newSp))
            
            // 2. id = stack[newSp]
            let addr = builder.buildBinary("+", 
                lhs: builder.buildConstI32(GOSUB_STACK_ADDR), 
                rhs: builder.buildBinary("*", lhs: newSp, rhs: builder.buildConstI32(4), resultType: .i32),
                resultType: .i32)
            
            let idValue = IRValue.loadField(base: addr, fieldOffset: 0, fieldType: .i32)
            
            // 3. SelectStmt to branch to return labels
            var cases: [(Int32, [IREffect])] = []
            for (id, label) in gosubReturnLabels {
                cases.append((Int32(id), [builder.buildBranch(label)]))
            }
            
            // Default case if ID is invalid: return from function (or trap)
            builder.append(.selectStmt(value: idValue, cases: cases, default: [builder.buildReturn(nil)]))
        } else {
            builder.append(builder.buildReturn(nil))
        }
    }
}

private class IRSymbolTable {
    private var locals: [String: (index: Int, type: IRType, typeName: String?)] = [:]
    private var globals: [String: (index: Int, type: IRType, typeName: String?)] = [:]
    private var arrays: [String: IRArrayInfo] = [:]
    private var types: [String: IRTypeInfo] = [:]
    private var constants: [String: Int] = [:] // Map name -> value
    private var nextLocalIndex: Int = 0
    private var nextGlobalIndex: Int = 0
    
    func clearLocals() {
        locals.removeAll()
        nextLocalIndex = 0
    }
    
    func addVariable(_ name: String, type: IRType, typeName: String? = nil, isLocal: Bool) {
        let key = name.lowercased()
        if isLocal {
            locals[key] = (nextLocalIndex, type, typeName)
            nextLocalIndex += 1
        } else {
            globals[key] = (nextGlobalIndex, type, typeName)
            nextGlobalIndex += 1
        }
    }
    
    func localIndex(for name: String) -> Int? {
        return locals[name.lowercased()]?.index
    }
    
    func globalIndex(for name: String) -> Int? {
        return globals[name.lowercased()]?.index
    }
    
    func type(of name: String) -> IRType? {
        let key = name.lowercased()
        return locals[key]?.type ?? globals[key]?.type
    }
    
    func typeName(for name: String) -> String? {
        let key = name.lowercased()
        return locals[key]?.typeName ?? globals[key]?.typeName
    }
    
    func addArray(_ name: String, info: IRArrayInfo) {
        arrays[name.lowercased()] = info
    }
    
    func arrayInfo(for name: String) -> IRArrayInfo? {
        return arrays[name.lowercased()]
    }
    
    func typeInfo(for name: String) -> IRTypeInfo? {
        return types[name.lowercased()]
    }
    
    func addType(_ name: String, info: IRTypeInfo) {
        types[name.lowercased()] = info
    }
    
    func fieldOffset(type: String, field: String) -> Int? {
        return types[type.lowercased()]?.fieldOffsets[field.lowercased()]
    }
    
    func fieldType(type: String, field: String) -> IRType? {
        return types[type.lowercased()]?.fieldTypes[field.lowercased()]
    }
    
    func fieldDimensions(type: String, field: String) -> [Int]? {
        return types[type.lowercased()]?.fieldDimensions[field.lowercased()]
    }
    
    func addConstant(_ name: String, value: Int) {
        constants[name.lowercased()] = value
    }
    
    func constantValue(for name: String) -> Int? {
        return constants[name.lowercased()]
    }
}

extension ASTLowering {
    private func isStringExpression(_ expr: ExpressionNode) -> Bool {
        switch expr {
        case .stringLiteral: return true
        case .identifier(let id, _):
            return id.typeSuffix == .string || id.name.hasSuffix("$") || (symbolTable.typeName(for: id.name) == "String")
        case .functionCall(let call, _):
            return call.name.hasSuffix("$") // Simple heuristic for built-ins like Str$
        case .binary(let bin, _):
            return isStringExpression(bin.left) || isStringExpression(bin.right)
        default:
            return false
        }
    }
}
