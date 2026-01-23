
import Foundation

public final class ASTLowering {
    private let builder: IRBuilder
    private var symbolTable: IRSymbolTable
    private var typeHandling: TypeHandling
    
    private var irModuleData: [IRDataSegment] = []
    private var nextStringOffset: Int32 = 1024
    
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
                    let indexValue = lowerExpression(access.indices[0])
                    
                    body.append(.assignArray(
                        base: baseAddr,
                        index: indexValue,
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
            
            let initialValue = lowerExpression(forNode.startValue)
            body.append(.assignLocal(index: localIdx, value: initialValue))
            
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
            
        case .dim, .dims:
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
                let indexValue = lowerExpression(access.indices[0])
                return IRValue.loadArray(base: baseAddr, index: indexValue, elementSize: arrayInfo.elementSize, elementType: arrayInfo.elementType)
            }
            return builder.buildConstI32(0)
            
        case .typeCast, .new, .first, .last, .before, .after, .handle, .objectCast:
            return builder.buildConstI32(0)
        }
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
        if isLocal {
            locals[name] = (nextLocalIndex, type)
            nextLocalIndex += 1
        } else {
            globals[name] = (nextGlobalIndex, type)
            nextGlobalIndex += 1
        }
    }
    
    func localIndex(for name: String) -> Int? {
        return locals[name]?.index
    }
    
    func globalIndex(for name: String) -> Int? {
        return globals[name]?.index
    }
    
    func type(of name: String) -> IRType? {
        return locals[name]?.type ?? globals[name]?.type
    }
    
    func typeName(for name: String) -> String? {
        return nil
    }
    
    func addArray(_ name: String, info: IRArrayInfo) {
        arrays[name] = info
    }
    
    func arrayInfo(for name: String) -> IRArrayInfo? {
        return arrays[name]
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
