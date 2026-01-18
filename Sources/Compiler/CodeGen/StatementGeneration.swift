//
//  StatementGeneration.swift
//  Blitz3DCompiler
//
//  Statement compilation for WASM code generation
//

import Foundation

/// Manages statement compilation and code generation
public final class StatementGeneration {
    private var context: ModuleContext

    // Type handling
    private let typeHandling = TypeHandling()

    // Expression generator - weak reference to avoid retain cycles
    private weak var expressionGenerator: ExpressionGeneration?
    private weak var dataGenerator: DataGeneration?
    
    // GOTO/Label support
    private var labelStateMap: [String: Int] = [:]
    private var gotoStateLocalIdx: Int = -1
    
    // Control flow depth tracking
    private var currentDepth: Int = 0
    private var loopExitDepths: [Int] = []

    public init(context: ModuleContext) {
        self.context = context
    }

    /// Configure dependencies
    public func configure(expressionGenerator: ExpressionGeneration, dataGenerator: DataGeneration) {
        self.expressionGenerator = expressionGenerator
        self.dataGenerator = dataGenerator
    }
    
    /// Configure GOTO/Label support for the current function
    public func configureGotos(labelStateMap: [String: Int], gotoStateLocalIdx: Int) {
        self.labelStateMap = labelStateMap
        self.gotoStateLocalIdx = gotoStateLocalIdx
    }

    /// Update context after generation
    public func updateContext(_ newContext: ModuleContext) {
        self.context = newContext
    }
    
    /// Generate code for a statement
    public func generateStatement(_ statement: StatementNode, function: inout WASMFunction) {
        switch statement {
        case .local(let decl):
            for id in decl.variables {
                let wasmType = typeHandling.typeInfo(from: id.typeSuffix).wasmType
                _ = context.variableManagement.registerLocal(id.name, type: wasmType, typeName: id.typeName)
                function.locals.append(wasmType)
            }
            
        case .global:
            break
            
        case .constant, .constants:
            break
            
        case .dim(let decl):
            var dims: [Int] = []
            var totalElements = 1
            for dimExpr in decl.dimensions {
                if case .integerLiteral(let value) = dimExpr {
                    dims.append(value)
                    totalElements *= (value + 1) // Blitz3D arrays are 0..N
                }
            }
            let wasmType = typeHandling.typeInfo(from: decl.typeName ?? "Int").wasmType
            let info = context.variableManagement.registerArray(decl.name, elementType: wasmType, dimensions: dims)
            
            // Initialize array memory to zero using memory.fill
            function.body.append(.i32Const(Int32(info.baseAddress))) // dest
            function.body.append(.i32Const(0))                      // value
            function.body.append(.i32Const(Int32(totalElements * info.elementSize))) // size
            function.body.append(.memoryFill(0))                    // memory 0
            
        case .assignment(let assign):
            guard let expressionGenerator = expressionGenerator else { break }
            let valueResult = expressionGenerator.generateWithInfo(assign.value)
            let targetType = getTargetType(from: assign.target)
            
            var finalInstrs = valueResult.instrs
            if valueResult.type != targetType {
                finalInstrs.append(contentsOf: convert(from: valueResult.type, to: targetType))
            }
            
            let targetTypeName = getTypeName(from: assign.target)
            if targetTypeName == "String" && targetType == .i32 && valueResult.type != .i32 {
                // ... string conversion logic ...
            }
            
            switch assign.target {
            case .identifier(let id):
                if let local = context.variableManagement.localInfo(for: id.name) {
                    function.body.append(contentsOf: finalInstrs)
                    function.body.append(.localSet(local.index))
                } else if let global = context.variableManagement.globalInfo(for: id.name) {
                    function.body.append(contentsOf: finalInstrs)
                    function.body.append(.globalSet(global.index))
                }
            case .arrayAccess(let access):
                if case .identifier(let arrayId) = access.array,
                   let array = context.variableManagement.arrayInfo(for: arrayId.name) {
                    var offset = 0
                    for (i, indexExpr) in access.indices.enumerated() {
                        let indexInstrs = expressionGenerator.generate(indexExpr)
                        function.body.append(contentsOf: indexInstrs)
                        offset += i * array.elementSize
                    }
                    function.body.append(.i32Const(Int32(offset)))
                    function.body.append(.i32Add)
                    function.body.append(contentsOf: finalInstrs)
                    function.body.append(.i32Store(2, 0))
                }
            case .fieldAccess(let access):
                let objInstrs = expressionGenerator.generate(access.object)
                function.body.append(contentsOf: objInstrs)
                if let typeName = getTypeName(from: access.object),
                   let fieldOffset = context.fieldOffsets[typeName]?[access.field] {
                    function.body.append(.i32Const(Int32(fieldOffset)))
                    function.body.append(.i32Add)
                    function.body.append(contentsOf: finalInstrs)
                    function.body.append(.i32Store(2, 0))
                }
            default:
                break
            }
            
        case .functionCall(let call):
            if let funcIdx = context.functionIndexMap[call.name] {
                var instrs: [WASMInstruction] = []
                for arg in call.arguments {
                    let argInstrs = expressionGenerator?.generate(arg) ?? []
                    instrs.append(contentsOf: argInstrs)
                }
                instrs.append(.call(funcIdx))
                function.body.append(contentsOf: instrs)
            }
            
        case .ifStatement(let ifNode):
            guard let expressionGenerator = expressionGenerator else { break }
            let condResult = expressionGenerator.generateWithInfo(ifNode.condition)
            function.body.append(contentsOf: condResult.instrs)
            if condResult.type == .f32 {
                function.body.append(.i32TruncF32S)
            }
            
            currentDepth += 1
            let thenBody = generateStatementBlock(ifNode.thenBranch, function: &function)
            var elseBody: [WASMInstruction]? = nil
            if !ifNode.elseBranch.isEmpty {
                elseBody = generateStatementBlock(ifNode.elseBranch, function: &function)
            }
            currentDepth -= 1
            function.body.append(.if(.void, thenBody, elseBody))
            
        case .whileLoop(let whileNode):
            guard let expressionGenerator = expressionGenerator else { break }
            
            currentDepth += 1 // block
            loopExitDepths.append(currentDepth)
            currentDepth += 1 // loop
            
            var loopInstrs: [WASMInstruction] = []
            let condResult = expressionGenerator.generateWithInfo(whileNode.condition)
            loopInstrs.append(contentsOf: condResult.instrs)
            if condResult.type == .f32 {
                loopInstrs.append(.i32TruncF32S)
            }
            loopInstrs.append(.i32EqZ)
            loopInstrs.append(.brIf(1))
            
            let bodyInstrs = generateStatementBlock(whileNode.body, function: &function)
            loopInstrs.append(contentsOf: bodyInstrs)
            loopInstrs.append(.br(0))
            
            currentDepth -= 2
            loopExitDepths.removeLast()
            
            function.body.append(.block(.void, [
                .loop(.void, loopInstrs)
            ]))
            
        case .forLoop(let forNode):
            guard let expressionGenerator = expressionGenerator else { break }
            if let local = context.variableManagement.localInfo(for: forNode.variable.name) {
                let startInstrs = expressionGenerator.generate(forNode.startValue)
                function.body.append(contentsOf: startInstrs)
                function.body.append(.localSet(local.index))
                
                currentDepth += 1 // block
                loopExitDepths.append(currentDepth)
                currentDepth += 1 // loop
                
                var loopInstrs: [WASMInstruction] = []
                loopInstrs.append(.localGet(local.index))
                let endInstrs = expressionGenerator.generate(forNode.endValue)
                loopInstrs.append(contentsOf: endInstrs)
                loopInstrs.append(.i32GtS)
                loopInstrs.append(.brIf(1))
                
                let bodyInstrs = generateStatementBlock(forNode.body, function: &function)
                loopInstrs.append(contentsOf: bodyInstrs)
                
                loopInstrs.append(.localGet(local.index))
                if let stepExpr = forNode.stepValue {
                    let stepInstrs = expressionGenerator.generate(stepExpr)
                    loopInstrs.append(contentsOf: stepInstrs)
                } else {
                    loopInstrs.append(.i32Const(1))
                }
                loopInstrs.append(.i32Add)
                loopInstrs.append(.localSet(local.index))
                loopInstrs.append(.br(0))
                
                currentDepth -= 2
                loopExitDepths.removeLast()
                
                function.body.append(.block(.void, [
                    .loop(.void, loopInstrs)
                ]))
            }
            
        case .forEach(let forEachNode):
            currentDepth += 1 // block
            loopExitDepths.append(currentDepth)
            currentDepth += 1 // loop
            
            var loopInstrs: [WASMInstruction] = []
            loopInstrs.append(.localGet(0))
            loopInstrs.append(.i32EqZ)
            loopInstrs.append(.brIf(1))
            loopInstrs.append(.localTee(1))
            
            let bodyInstrs = generateStatementBlock(forEachNode.body, function: &function)
            loopInstrs.append(contentsOf: bodyInstrs)
            
            loopInstrs.append(.localGet(0))
            loopInstrs.append(.call(0))
            loopInstrs.append(.localSet(0))
            loopInstrs.append(.br(0))
            
            currentDepth -= 2
            loopExitDepths.removeLast()
            
            function.body.append(.block(.void, [
                .loop(.void, loopInstrs)
            ]))
            
        case .repeatLoop(let repeatNode):
            currentDepth += 1 // block
            loopExitDepths.append(currentDepth)
            currentDepth += 1 // loop
            
            var loopInstrs: [WASMInstruction] = []
            let bodyInstrs = generateStatementBlock(repeatNode.body, function: &function)
            loopInstrs.append(contentsOf: bodyInstrs)
            
            let condResult = expressionGenerator?.generateWithInfo(repeatNode.condition) ?? ([], .i32)
            loopInstrs.append(contentsOf: condResult.instrs)
            if condResult.type == .f32 {
                loopInstrs.append(.i32TruncF32S)
            }
            loopInstrs.append(.i32EqZ)
            loopInstrs.append(.brIf(0))
            
            currentDepth -= 2
            loopExitDepths.removeLast()
            
            function.body.append(.block(.void, [
                .loop(.void, loopInstrs)
            ]))
            
        case .select(let selectNode):
            for caseNode in selectNode.cases {
                let bodyInstrs = generateStatementBlock(caseNode.body, function: &function)
                function.body.append(contentsOf: bodyInstrs)
            }
            if let defaultCase = selectNode.defaultCase {
                let bodyInstrs = generateStatementBlock(defaultCase, function: &function)
                function.body.append(contentsOf: bodyInstrs)
            }
            
        case .returnStatement(let expr):
            if let returnExpr = expr {
                let returnInstrs = expressionGenerator?.generate(returnExpr) ?? []
                function.body.append(contentsOf: returnInstrs)
            }
            function.body.append(.return)
            
        case .exit:
            if let targetDepth = loopExitDepths.last {
                function.body.append(.br(currentDepth - targetDepth))
            } else {
                function.body.append(.nop)
            }
            
        case .goto(let labelName):
            if gotoStateLocalIdx >= 0, let stateNum = labelStateMap[labelName] {
                function.body.append(.i32Const(Int32(stateNum)))
                function.body.append(.localSet(gotoStateLocalIdx))
                function.body.append(.br(0)) // Branch to start of state machine loop
            } else {
                // If no state machine, just a nop or unreachable
                function.body.append(.nop)
            }
            
        case .gosub(let labelName):
            if gotoStateLocalIdx >= 0, let stateNum = labelStateMap[labelName] {
                function.body.append(.i32Const(Int32(stateNum)))
                function.body.append(.localSet(gotoStateLocalIdx))
                function.body.append(.br(0))
            } else {
                function.body.append(.nop)
            }
            
        case .label(_):
            break
            
        case .typeDeclaration(let typeNode):
            var offsets: [String: Int] = [:]
            var currentOffset = 8
            var fieldTypes: [String: String] = [:]
            
            for field in typeNode.fields {
                let fieldWasmType = typeHandling.typeInfo(from: field.type?.rawValue ?? "Int").wasmType
                let fieldSize = typeSize(for: fieldWasmType)
                if currentOffset % fieldSize != 0 {
                    currentOffset = ((currentOffset / fieldSize) + 1) * fieldSize
                }
                offsets[field.name] = currentOffset
                fieldTypes[field.name] = field.type?.rawValue ?? "Int"
                currentOffset += fieldSize
            }
            
            context.userTypes[typeNode.typeName] = UserTypeInfo(
                fieldOffsets: offsets,
                fieldTypes: fieldTypes,
                instanceSize: currentOffset
            )
            context.fieldOffsets[typeNode.typeName] = offsets
            
        case .read(let identifiers):
            guard let dataPtrIdx = dataGenerator?.dataPtrIndex else { break }
            for id in identifiers {
                function.body.append(.globalGet(dataPtrIdx))
                function.body.append(.i32Load(2, 0))
                
                if let local = context.variableManagement.localInfo(for: id.name) {
                    function.body.append(.localSet(local.index))
                } else if let global = context.variableManagement.globalInfo(for: id.name) {
                    function.body.append(.globalSet(global.index))
                }
                
                function.body.append(.globalGet(dataPtrIdx))
                function.body.append(.i32Const(4))
                function.body.append(.i32Add)
                function.body.append(.globalSet(dataPtrIdx))
            }
            
        case .restore(let label):
            guard let dataPtrIdx = dataGenerator?.dataPtrIndex else { break }
            if let labelName = label, let offset = dataGenerator?.getDataOffset(for: labelName) {
                function.body.append(.i32Const(Int32(offset)))
                function.body.append(.globalSet(dataPtrIdx))
            } else {
                function.body.append(.i32Const(256))
                function.body.append(.globalSet(dataPtrIdx))
            }
            
        case .data, .delete, .insert, .empty, .function:
            break
        }
    }

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

    private func getTargetType(from expr: ExpressionNode) -> WASMType {
        switch expr {
        case .identifier(let id):
            if let local = context.variableManagement.localInfo(for: id.name) {
                return local.type
            }
            if let global = context.variableManagement.globalInfo(for: id.name) {
                return global.type
            }
        case .arrayAccess(let access):
            if case .identifier(let arrayId) = access.array,
               let array = context.variableManagement.arrayInfo(for: arrayId.name) {
                return array.elementType
            }
        case .fieldAccess(let access):
            if let typeName = getTypeName(from: access.object),
               let fieldType = context.userTypes[typeName]?.fieldTypes[access.field] {
                return typeHandling.wasmType(from: fieldType)
            }
        default:
            break
        }
        return .i32
    }

    private func generateStatementBlock(_ statements: [StatementNode], function: inout WASMFunction) -> [WASMInstruction] {
        let savedBody = function.body
        function.body = []
        for statement in statements {
            generateStatement(statement, function: &function)
        }
        let blockBody = function.body
        function.body = savedBody
        return blockBody
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
    
    private func typeSize(for wasmType: WASMType) -> Int {
        switch wasmType {
        case .i32, .f32:
            return 4
        case .i64, .f64:
            return 8
        default:
            return 4
        }
    }
}
