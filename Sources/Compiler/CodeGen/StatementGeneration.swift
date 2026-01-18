//
//  StatementGeneration.swift
//  Blitz3DCompiler
//
//  Statement compilation for WASM code generation
//

import Foundation

/// Manages statement compilation and code generation
public struct StatementGeneration {
    private var module: WASMModule
    private var typeIndexMap: [String: Int]
    
    // Dependencies
    private var localVariables: [String: LocalInfo] = [:]
    private var globalVariables: [String: GlobalInfo] = [:]
    private var arrayVariables: [String: ArrayInfo] = [:]
    private var userTypes: [String: UserTypeInfo] = [:]
    private var fieldOffsets: [String: [String: Int]] = [:]
    
    // Type handling
    private let typeHandling = TypeHandling()
    
    // Expression generator
    private var expressionGenerator: ((ExpressionNode) -> [WASMInstruction])?
    
    public init(module: WASMModule, typeIndexMap: [String: Int]) {
        self.module = module
        self.typeIndexMap = typeIndexMap
    }
    
    /// Configure dependencies
    public mutating func configure(
        localVariables: [String: LocalInfo],
        globalVariables: [String: GlobalInfo],
        arrayVariables: [String: ArrayInfo],
        userTypes: [String: UserTypeInfo],
        fieldOffsets: [String: [String: Int]],
        expressionGenerator: @escaping (ExpressionNode) -> [WASMInstruction]
    ) {
        self.localVariables = localVariables
        self.globalVariables = globalVariables
        self.arrayVariables = arrayVariables
        self.userTypes = userTypes
        self.fieldOffsets = fieldOffsets
        self.expressionGenerator = expressionGenerator
    }
    
    /// Generate code for a statement
    public mutating func generateStatement(_ statement: StatementNode, function: inout WASMFunction) {
        switch statement {
        case .local(let decl):
            for id in decl.variables {
                let wasmType = typeHandling.typeInfo(from: id.typeSuffix).wasmType
                localVariables[id.name] = LocalInfo(index: localVariables.count, type: wasmType)
                function.locals.append(wasmType)
            }
            
        case .global(let decl):
            for id in decl.variables {
                let wasmType = typeHandling.typeInfo(from: id.typeSuffix).wasmType
                globalVariables[id.name] = GlobalInfo(index: globalVariables.count, type: wasmType)
                module.globals.append(WASMGlobal(type: wasmType, initExpr: .i32Const(0)))
            }
            
        case .constant, .constants:
            break
            
        case .dim(let decl):
            var dims: [Int] = []
            for dimExpr in decl.dimensions {
                if case .integerLiteral(let value) = dimExpr {
                    dims.append(value)
                }
            }
            let wasmType = typeHandling.typeInfo(from: decl.typeName ?? "Int").wasmType
            arrayVariables[decl.name] = ArrayInfo(
                baseAddress: arrayVariables.count * 256,
                elementSize: typeSize(for: wasmType),
                elementType: wasmType,
                dimensions: dims
            )
            
        case .assignment(let assign):
            let valueInstrs = expressionGenerator?(assign.value) ?? []
            function.body.append(contentsOf: valueInstrs)
            
            switch assign.target {
            case .identifier(let id):
                if let local = localVariables[id.name] {
                    function.body.append(.localSet(local.index))
                } else if let global = globalVariables[id.name] {
                    function.body.append(.globalSet(global.index))
                }
            case .arrayAccess(let access):
                if case .identifier(let arrayId) = access.array,
                   let array = arrayVariables[arrayId.name] {
                    var offset = 0
                    for (i, indexExpr) in access.indices.enumerated() {
                        let indexInstrs = expressionGenerator?(indexExpr) ?? []
                        function.body.append(contentsOf: indexInstrs)
                        offset += i * array.elementSize
                    }
                    function.body.append(.i32Const(Int32(offset)))
                    function.body.append(.i32Add)
                    function.body.append(.i32Store(2, 0))
                }
            default:
                break
            }
            
        case .functionCall(let call):
            var instrs: [WASMInstruction] = []
            for arg in call.arguments {
                let argInstrs = expressionGenerator?(arg) ?? []
                instrs.append(contentsOf: argInstrs)
            }
            instrs.append(.call(0))
            function.body.append(contentsOf: instrs)
            
        case .ifStatement(let ifNode):
            let condInstrs = expressionGenerator?(ifNode.condition) ?? []
            function.body.append(contentsOf: condInstrs)
            function.body.append(.i32EqZ)
            function.body.append(.brIf(1))
            for stmt in ifNode.thenBranch {
                generateStatement(stmt, function: &function)
            }
            function.body.append(.br(0))
            if !ifNode.elseBranch.isEmpty {
                for stmt in ifNode.elseBranch {
                    generateStatement(stmt, function: &function)
                }
            }
            
        case .whileLoop(let whileNode):
            let loopStart = function.body.count
            let condInstrs = expressionGenerator?(whileNode.condition) ?? []
            function.body.append(contentsOf: condInstrs)
            function.body.append(.i32EqZ)
            function.body.append(.brIf(1))
            for stmt in whileNode.body {
                generateStatement(stmt, function: &function)
            }
            function.body.append(.br(0))
            
        case .forLoop(let forNode):
            guard let local = localVariables[forNode.variable.name] else { break }
            let startInstrs = expressionGenerator?(forNode.startValue) ?? []
            function.body.append(contentsOf: startInstrs)
            function.body.append(.localSet(local.index))
            let loopStart = function.body.count
            function.body.append(.localGet(local.index))
            let endInstrs = expressionGenerator?(forNode.endValue) ?? []
            function.body.append(contentsOf: endInstrs)
            function.body.append(.i32GtS)
            function.body.append(.brIf(1))
            for stmt in forNode.body {
                generateStatement(stmt, function: &function)
            }
            function.body.append(.localGet(local.index))
            if let stepExpr = forNode.stepValue {
                let stepInstrs = expressionGenerator?(stepExpr) ?? []
                function.body.append(contentsOf: stepInstrs)
            } else {
                function.body.append(.i32Const(1))
            }
            function.body.append(.i32Add)
            function.body.append(.localSet(local.index))
            function.body.append(.br(0))
            
        case .forEach(let forEachNode):
            let loopStart = function.body.count
            function.body.append(.localGet(0))
            function.body.append(.i32EqZ)
            function.body.append(.brIf(1))
            function.body.append(.localTee(1))
            for stmt in forEachNode.body {
                generateStatement(stmt, function: &function)
            }
            function.body.append(.localGet(0))
            function.body.append(.call(0))
            function.body.append(.localSet(0))
            function.body.append(.br(0))
            
        case .repeatLoop(let repeatNode):
            let loopStart = function.body.count
            for stmt in repeatNode.body {
                generateStatement(stmt, function: &function)
            }
            let condInstrs = expressionGenerator?(repeatNode.condition) ?? []
            function.body.append(contentsOf: condInstrs)
            function.body.append(.i32EqZ)
            function.body.append(.brIf(0))
            
        case .select(let selectNode):
            for caseNode in selectNode.cases {
                for stmt in caseNode.body {
                    generateStatement(stmt, function: &function)
                }
                function.body.append(.br(0))
            }
            if let defaultCase = selectNode.defaultCase {
                for stmt in defaultCase {
                    generateStatement(stmt, function: &function)
                }
            }
            
        case .returnStatement(let expr):
            if let returnExpr = expr {
                let returnInstrs = expressionGenerator?(returnExpr) ?? []
                function.body.append(contentsOf: returnInstrs)
            }
            function.body.append(.return)
            
        case .exit:
            function.body.append(.br(0))
            
        case .goto, .gosub, .label:
            break
            
        case .typeDeclaration(let typeNode):
            var offsets: [String: Int] = [:]
            var currentOffset = 8
            var fieldTypes: [String: String] = [:]
            
            for field in typeNode.fields {
                let fieldWasmType = typeHandling.typeInfo(from: nil).wasmType
                let fieldSize = typeSize(for: fieldWasmType)
                if currentOffset % fieldSize != 0 {
                    currentOffset = ((currentOffset / fieldSize) + 1) * fieldSize
                }
                offsets[field.name] = currentOffset
                fieldTypes[field.name] = "Int"
                currentOffset += fieldSize
            }
            
            userTypes[typeNode.typeName] = UserTypeInfo(
                fieldOffsets: offsets,
                fieldTypes: fieldTypes,
                instanceSize: currentOffset
            )
            fieldOffsets[typeNode.typeName] = offsets
            
        case .data, .read, .restore, .delete, .insert, .empty, .function:
            break
        }
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