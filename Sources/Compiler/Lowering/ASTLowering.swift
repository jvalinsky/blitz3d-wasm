
import Foundation

public final class ASTLowering {
    private let builder: IRBuilder
    private var symbolTable: IRSymbolTable
    private var typeHandling: TypeHandling
    
    private var irModuleData: [IRDataSegment] = []
    private var nextStringOffset: Int32 = 1024
    private var nextArrayOffset: Int32 = 65536
    
    public init() {
        self.builder = IRBuilder()
        self.symbolTable = IRSymbolTable()
        self.typeHandling = TypeHandling()
    }
    
    public func lower(_ program: ProgramNode) -> IRModule {
        var irModule = IRModule()
        irModuleData = []
        nextStringOffset = 1024
        
        for function in program.functions {
            lowerFunction(function, to: &irModule)
        }
        
        irModule.data = irModuleData
        return irModule
    }
    
    private func allocateString(_ value: String) -> Int32 {
        var bytes = Array(value.utf8)
        bytes.append(0) // Null terminator
        
        let offset = nextStringOffset
        let data = IRDataSegment(offset: offset, data: Data(bytes))
        irModuleData.append(data)
        
        nextStringOffset += Int32(bytes.count)
        return offset
    }
    
    private func lowerFunction(_ function: FunctionNode, to module: inout IRModule) {
        let returnType = lowerType(from: function.returnType)
        let parameters = function.parameters.map { ($0.name, lowerType(from: $0.type)) }
        
        builder.enterFunction(name: function.name, parameters: parameters, returnType: returnType)
        
        for param in function.parameters {
            let irType = lowerType(from: param.type)
            symbolTable.addVariable(param.name, type: irType, isLocal: true)
        }
        
        var irBody: [IREffect] = []
        for statement in function.body {
            lowerStatement(statement, into: &irBody)
        }
        
        for effect in irBody {
            builder.append(effect)
        }
        
        if let irFunc = builder.exitFunction() {
            module.functions.append(irFunc)
        }
    }
    
    private func lowerStatement(_ statement: StatementNode, into body: inout [IREffect]) {
        switch statement {
        case .local(let decl, _):
            for variable in decl.variables {
                let irType = lowerTypeSuffix(from: variable.typeSuffix)
                builder.addLocal(name: variable.name, type: irType)
                symbolTable.addVariable(variable.name, type: irType, isLocal: true)
                
                if let initializer = decl.initializers[variable.name] {
                    let value = lowerExpression(initializer)
                    body.append(.assignLocal(index: symbolTable.localIndex(for: variable.name)!, value: value))
                }
            }
            
        case .global:
            break
            
        case .constant, .constants:
            break
            
        case .dim(let decl, _):
            let irType: IRType = .i32 // Default to i32 for now
            let elementSize = 4
            
            // For simplicity, assume dimensions are constant integers
            var dimSizes: [Int] = []
            var totalElements = 1
            for dimExpr in decl.dimensions {
                if case .integerLiteral(let val, _) = dimExpr {
                    let size = val + 1 // Blitz3D arrays are 0...val
                    dimSizes.append(size)
                    totalElements *= size
                } else {
                    dimSizes.append(11) // Fallback for dynamic
                    totalElements *= 11
                }
            }
            
            let arrayInfo = IRArrayInfo(
                baseAddress: Int(nextArrayOffset),
                elementSize: elementSize,
                dimensions: dimSizes,
                elementType: irType
            )
            symbolTable.addArray(decl.name, info: arrayInfo)
            nextArrayOffset += Int32(totalElements * elementSize)
            
        case .dims(let decls, _):
            for decl in decls {
                lowerStatement(.dim(decl, .unknown), into: &body)
            }
            
        case .assignment(let assign, _):
            let value = lowerExpression(assign.value)
            
            switch assign.target {
            case .identifier(let id, _):
                if let localIdx = symbolTable.localIndex(for: id.name) {
                    body.append(.assignLocal(index: localIdx, value: value))
                } else if let globalIdx = symbolTable.globalIndex(for: id.name) {
                    body.append(.assignGlobal(index: globalIdx, value: value))
                } else {
                    body.append(.assign(target: id.name, value: value))
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
                        value: value
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
                        value: value
                    ))
                }
                
            default:
                break
            }
            
        case .functionCall(let call, _):
            let args = call.arguments.map { lowerExpression($0) }
            let resultType = lowerFunctionSignature(call.name).resultType
            let callValue = IRValue.call(name: call.name.lowercased(), args: args, resultType: resultType)
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
                body.append(builder.buildReturn(nil))
            }
            
        case .exit(_):
            body.append(.breakStmt)
            
        case .goto, .gosub, .label:
            break
            
        case .typeDeclaration:
            break
            
        case .read, .restore:
            break
            
        case .delete, .insert:
            break
            
        case .select:
            break
            
        case .function, .forEach, .data, .empty:
            break
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
            let resultType = commonType(lhs.type, rhs.type)
            
            return builder.buildBinary(binop.op, lhs: lhs, rhs: rhs, resultType: resultType)
            
        case .unary(let unary, _):
            let operand = lowerExpression(unary.expression)
            
            switch unary.op {
            case "Not":
                return builder.buildBinary("Xor", lhs: operand, rhs: builder.buildConstI32(-1), resultType: .i32)
            case "-":
                if operand.type == .i32 {
                    return builder.buildBinary("Sub", lhs: builder.buildConstI32(0), rhs: operand, resultType: .i32)
                } else {
                    return builder.buildBinary("Sub", lhs: builder.buildConstF32(0), rhs: operand, resultType: .f32)
                }
            default:
                return operand
            }
            
        case .functionCall(let call, _):
            let args = call.arguments.map { lowerExpression($0) }
            let signature = lowerFunctionSignature(call.name)
            return IRValue.call(name: call.name.lowercased(), args: args, resultType: signature.resultType)
            
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
            }
            return builder.buildConstI32(0)
            
        case .typeCast, .new, .first, .last, .before, .after, .handle, .objectCast:
            return builder.buildConstI32(0)
        }
    }
    
    private func flattenIndex(indices: [ExpressionNode], dimensions: [Int]) -> IRValue {
        // Formula for flat index: idx0 * (d1 * d2 * ...) + idx1 * (d2 * ...) + ...
        // Assuming row-major layout
        
        var flatIndex = lowerExpression(indices[0])
        for i in 1..<indices.count {
            let dimSize = i < dimensions.count ? dimensions[i] : 1
            flatIndex = builder.buildBinary("*", lhs: flatIndex, rhs: builder.buildConstI32(Int32(dimSize)), resultType: .i32)
            flatIndex = builder.buildBinary("+", lhs: flatIndex, rhs: lowerExpression(indices[i]), resultType: .i32)
        }
        return flatIndex
    }
    
    private func lowerTypeSuffix(from typeSuffix: TypeSuffix?) -> IRType {
        guard let suffix = typeSuffix else { return .i32 }
        switch suffix {
        case .integer: return .i32
        case .float: return .f32
        case .string: return .i32
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
        // Create a minimal context for signature resolution
        let module = WASMModule()
        let context = ModuleContext(module: module)
        
        // Register built-in imports so they can be resolved
        let builtInImports: [(String, [WASMType], [WASMType])] = [
            ("PrintInt", [.i32], []),
            ("PrintString", [.i32], []),
            ("Graphics3D", [.i32, .i32, .i32, .i32], []),
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
    
    private func commonType(_ lhs: IRType, _ rhs: IRType) -> IRType {
        if lhs == .f32 || rhs == .f32 {
            return .f32
        }
        return .i32
    }
    
    private func getTypeName(from expression: ExpressionNode) -> String? {
        switch expression {
        case .identifier(let id, _):
            return symbolTable.typeName(for: id.name)
        default:
            return nil
        }
    }
}

private class IRSymbolTable {
    private var locals: [String: (index: Int, type: IRType)] = [:]
    private var globals: [String: (index: Int, type: IRType)] = [:]
    private var arrays: [String: IRArrayInfo] = [:]
    private var types: [String: IRTypeInfo] = [:]
    private var nextLocalIndex: Int = 0
    private var nextGlobalIndex: Int = 0
    
    func addVariable(_ name: String, type: IRType, isLocal: Bool) {
        let key = name.lowercased()
        if isLocal {
            locals[key] = (nextLocalIndex, type)
            nextLocalIndex += 1
        } else {
            globals[key] = (nextGlobalIndex, type)
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
        return nil
    }
    
    func addArray(_ name: String, info: IRArrayInfo) {
        arrays[name.lowercased()] = info
    }
    
    func arrayInfo(for name: String) -> IRArrayInfo? {
        return arrays[name.lowercased()]
    }
    
    func addType(_ name: String, info: IRTypeInfo) {
        types[name] = info
    }
    
    func fieldOffset(type: String, field: String) -> Int? {
        return types[type]?.fieldOffsets[field]
    }
    
    func fieldType(type: String, field: String) -> IRType? {
        guard let fieldTypes = types[type]?.fieldTypes else { return nil }
        guard let _ = fieldTypes[field] else { return nil }
        return .i32
    }
}

private struct IRArrayInfo {
    let baseAddress: Int
    let elementSize: Int
    let dimensions: [Int]
    let elementType: IRType
}

private struct IRTypeInfo {
    let fieldOffsets: [String: Int]
    let fieldTypes: [String: String]
}
