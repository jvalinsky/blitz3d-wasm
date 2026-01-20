//
//  FunctionGeneration.swift
//  Blitz3DCompiler
//
//  Function compilation and management for WASM code generation
//

import Foundation

/// Manages function generation and compilation
public final class FunctionGeneration {
    private var context: ModuleContext

    // GOTO/Label support
    private var labelStateMap: [String: Int] = [:]
    private var gotoStateLocalIdx: Int = -1
    private var hasGotoInCurrentFunction: Bool = false

    // Type handling
    private var typeHandling: TypeHandling = TypeHandling()

    // Statement generator (will be injected)
    private weak var statementGenerator: StatementGeneration?

    public init(context: ModuleContext) {
        self.context = context
    }

    /// Configure dependencies
    public func configure(statementGenerator: StatementGeneration) {
        self.statementGenerator = statementGenerator
    }

    /// Update context after generation
    public func updateContext(_ newContext: ModuleContext) {
        self.context = newContext
    }
    
    /// Generate a function from AST node
    public func generateFunction(_ functionNode: FunctionNode) {
        // Determine function type signature
        let typeSignature = functionSignature(for: functionNode)
        let typeIdx = context.typeIndexMap[typeSignature] ?? 0
        print("DEBUG: Function \(functionNode.name) signature='\(typeSignature)' typeIdx=\(typeIdx)")
        
        // Create new function
        var function = WASMFunction(typeIndex: typeIdx)
        
        // Reset GOTO/Label tracking for this function
        labelStateMap = [:]
        gotoStateLocalIdx = -1
        hasGotoInCurrentFunction = false
        
        // Check if function uses GOTO/Labels and prepare state machine if needed
        let (labels, hasGoto, _) = collectLabelsAndGotos(functionNode.body)
        hasGotoInCurrentFunction = hasGoto
        
        // Initialize local variables tracking
        context.variableManagement.clearLocals()
        
        var sortedLabels: [String] = []
        
        // 1. Register Parameters (indices 0..N-1)
        var newLocalVariables: [String: LocalInfo] = [:]
        for (index, param) in functionNode.parameters.enumerated() {
            let paramType = typeHandling.typeInfo(from: param.type?.rawValue ?? "Int")
            // Register directly to variable management to get correct index
            let info = context.variableManagement.registerLocal(param.name, type: paramType.wasmType, typeName: param.type?.rawValue)
            // Store for local reference if needed (though we rely on VariableManagement)
            newLocalVariables[param.name] = info
        }
        
        // 2. Register Goto State Local (index N)
        if hasGoto && !labels.isEmpty {
            sortedLabels = labels.sorted()
            var stateNum = 1
            for label in sortedLabels {
                labelStateMap[label] = stateNum
                stateNum += 1
            }
            
            // Register implicit goto state variable
            gotoStateLocalIdx = context.variableManagement.nextLocalIdx
            function.locals.append(.i32)
            _ = context.variableManagement.registerLocal("__gotoState", type: .i32)
        }
        
        // Configure statement generator
        statementGenerator?.configureGotos(labelStateMap: labelStateMap, gotoStateLocalIdx: gotoStateLocalIdx)

        // Propagate return type
        let returnWasmType: WASMType
        if let typeAnnot = functionNode.returnType {
            returnWasmType = typeHandling.wasmType(from: typeAnnot.rawValue)
        } else {
            returnWasmType = typeHandling.wasmType(from: "Int")
        }
        statementGenerator?.setCurrentReturnType(returnWasmType)

        // Reset stack validator for new function with return type
        statementGenerator?.resetStackValidator(returnType: returnWasmType)

        // Register parameter types with stack validator
        for (index, param) in functionNode.parameters.enumerated() {
            let paramType = typeHandling.typeInfo(from: param.type?.rawValue ?? "Int")
            statementGenerator?.registerLocalType(index, type: paramType.wasmType)
        }

        // Register goto state local type if present
        if gotoStateLocalIdx >= 0 {
            statementGenerator?.registerLocalType(gotoStateLocalIdx, type: .i32)
        }
        
        if hasGotoInCurrentFunction {
            // Initial state: 0 (start of function)
            function.body.append(.i32Const(0))
            function.body.append(.localSet(gotoStateLocalIdx))
            
            var loopInstrs: [WASMInstruction] = []
            
            // 1. Check for termination state
            // if (gotoState == -1) br 2 (exit state machine block)
            loopInstrs.append(.localGet(gotoStateLocalIdx))
            loopInstrs.append(.i32Const(-1))
            loopInstrs.append(.i32Eq)
            loopInstrs.append(.if(.void, [.br(2)], nil))
            
            // Divide body into chunks by labels and GOSUBs
            var currentChunk: [StatementNode] = []
            var currentState = 0
            var gosubCounter = 0
            
            for statement in functionNode.body {
                switch statement {
                case .label(let name):
                    if let stateNum = labelStateMap[name] {
                        loopInstrs.append(contentsOf: generateChunk(state: currentState, nextState: stateNum, statements: currentChunk, function: &function))
                        currentChunk = []
                        currentState = stateNum
                    }
                case .gosub:
                    gosubCounter += 1
                    let returnState = 1000 + gosubCounter
                    currentChunk.append(statement)
                    loopInstrs.append(contentsOf: generateChunk(state: currentState, nextState: returnState, statements: currentChunk, function: &function))
                    currentChunk = []
                    currentState = returnState
                default:
                    currentChunk.append(statement)
                }
            }
            // Flush final chunk
            loopInstrs.append(contentsOf: generateChunk(state: currentState, nextState: -1, statements: currentChunk, function: &function))
            
            function.body.append(.block(.void, [
                .loop(.void, loopInstrs)
            ]))
        } else {
            // Generate body statements normally
            for statement in functionNode.body {
                statementGenerator?.generateStatement(statement, function: &function)
            }
        }

        // Ensure return at end
        ensureReturn(function: &function, returnType: functionNode.returnType)

        // Validate local variable indices
        let paramCount = functionNode.parameters.count + (gotoStateLocalIdx >= 0 ? 1 : 0)
        let maxLocalIndex = context.variableManagement.maxLocalIndex()
        let declaredLocals = function.locals.count + paramCount
        if maxLocalIndex >= declaredLocals {
            print("ERROR: Function '\(functionNode.name)' - Local index \(maxLocalIndex) exceeds declared locals count \(declaredLocals) (params: \(paramCount), locals: \(function.locals.count))")
        }

        // Add function to module
        let localFuncIdx = self.context.module.code.count
        let globalFuncIdx = self.context.module.imports.count + localFuncIdx

        self.context.module.code.append(function)
        self.context.module.functions.append(typeIdx)

        self.context.functionIndexMap[functionNode.name.lowercased()] = globalFuncIdx

        let exportName: String
        switch functionNode.returnType {
        case .integer:
            exportName = functionNode.name + "%"
        case .float:
            exportName = functionNode.name + "#"
        case .string:
            exportName = functionNode.name + "$"
        case .void, .none:
            exportName = functionNode.name
        }
        self.context.module.exports.append(WASMExport(name: exportName, kind: .function, index: globalFuncIdx))
    }
    
    /// Generate function call instructions
    public func generateFunctionCallInstrs(_ call: FunctionCallNode, function: inout WASMFunction) -> [WASMInstruction] {
        var instrs: [WASMInstruction] = []
        for _ in call.arguments {
            instrs.append(.i32Const(0))
        }
        if let funcIdx = context.functionIndexMap[call.name.lowercased()] {
            instrs.append(.call(Int(funcIdx)))
        } else {
            instrs.append(.unreachable)
        }
        return instrs
    }
    
    // MARK: - Private Helpers
    
    private func functionSignature(for functionNode: FunctionNode) -> String {
        let paramTypes = functionNode.parameters.map { 
            typeHandling.wasmType(from: $0.type?.rawValue ?? "Int").rawValue
        }
        let returnType: WASMType
        if let returnTypeNode = functionNode.returnType {
            returnType = typeHandling.wasmType(from: returnTypeNode.rawValue)
        } else {
            returnType = typeHandling.wasmType(from: "Int")
        }
        let resStr = (returnType == .void) ? "void" : returnType.rawValue
        return "(\(paramTypes.joined(separator: ", "))) -> \(resStr)"
    }
    
    private func ensureReturn(function: inout WASMFunction, returnType: TypeAnnotation?) {
        if function.body.last == .return { return }
        
        let returnWasmType: WASMType
        if let typeAnnot = returnType {
            returnWasmType = typeHandling.wasmType(from: typeAnnot.rawValue)
        } else {
            returnWasmType = typeHandling.wasmType(from: "Int")
        }
        
        print("Ensuring return for \(returnType?.rawValue ?? "nil") -> \(returnWasmType)")
        switch returnWasmType {
        case .i32, .i64: function.body.append(.i32Const(0))
        case .f32: function.body.append(.f32Const(0))
        case .f64: function.body.append(.f64Const(0))
        case .void: break
        default: function.body.append(.i32Const(0))
        }
        function.body.append(.return)
    }
    
    private func generateChunk(state: Int, nextState: Int, statements: [StatementNode], function: inout WASMFunction) -> [WASMInstruction] {
        var chunkInstrs: [WASMInstruction] = []
        
        // if (gotoState == state) { ... }
        chunkInstrs.append(.localGet(gotoStateLocalIdx))
        chunkInstrs.append(.i32Const(Int32(state)))
        chunkInstrs.append(.i32Eq)
        
        var thenBody: [WASMInstruction] = []
        
        // 1. Reset state (we are currently executing this chunk)
        thenBody.append(.i32Const(0))
        thenBody.append(.localSet(gotoStateLocalIdx))
        
        // 2. Generate statements for this chunk
        var tempFunc = WASMFunction(typeIndex: function.typeIndex, locals: function.locals)
        for stmt in statements {
            statementGenerator?.generateStatement(stmt, function: &tempFunc)
        }
        thenBody.append(contentsOf: tempFunc.body)
        
        // 3. Fall through to next label (if any)
        if nextState != -1 {
            // Only fall through if we didn't GOTO somewhere else in the middle of the chunk
            thenBody.append(.localGet(gotoStateLocalIdx))
            thenBody.append(.i32EqZ)
            thenBody.append(.if(.void, [
                .i32Const(Int32(nextState)),
                .localSet(gotoStateLocalIdx)
            ], nil))
        } else {
            // End of function
            thenBody.append(.i32Const(-1))
            thenBody.append(.localSet(gotoStateLocalIdx))
            thenBody.append(.br(2)) // Exit block
        }
        
        // 4. Restart loop to check next state
        thenBody.append(.br(1)) // Target the surrounding loop, not the 'if'
        
        chunkInstrs.append(.if(.void, thenBody, nil))
        return chunkInstrs
    }

    private func collectLabelsAndGotos(_ statements: [StatementNode]) -> (labels: Set<String>, hasGoto: Bool, gosubCount: Int) {
        var labels: Set<String> = []
        var hasGoto = false
        var gosubCount = 0
        for statement in statements {
            switch statement {
            case .label(let name): labels.insert(name)
            case .goto: hasGoto = true
            case .gosub: hasGoto = true; gosubCount += 1
            case .ifStatement(let ifNode):
                let thenLabels = collectLabelsAndGotos(ifNode.thenBranch)
                labels.formUnion(thenLabels.labels); hasGoto = hasGoto || thenLabels.hasGoto; gosubCount += thenLabels.gosubCount
                for (_, elseIfBranch) in ifNode.elseIfs {
                    let elseIfLabels = collectLabelsAndGotos(elseIfBranch)
                    labels.formUnion(elseIfLabels.labels); hasGoto = hasGoto || elseIfLabels.hasGoto; gosubCount += elseIfLabels.gosubCount
                }
                if !ifNode.elseBranch.isEmpty {
                    let elseLabels = collectLabelsAndGotos(ifNode.elseBranch)
                    labels.formUnion(elseLabels.labels); hasGoto = hasGoto || elseLabels.hasGoto; gosubCount += elseLabels.gosubCount
                }
            case .whileLoop(let whileNode):
                let loopLabels = collectLabelsAndGotos(whileNode.body)
                labels.formUnion(loopLabels.labels); hasGoto = hasGoto || loopLabels.hasGoto; gosubCount += loopLabels.gosubCount
            case .forLoop(let forNode):
                let forLabels = collectLabelsAndGotos(forNode.body)
                labels.formUnion(forLabels.labels); hasGoto = hasGoto || forLabels.hasGoto; gosubCount += forLabels.gosubCount
            case .repeatLoop(let repeatNode):
                let repeatLabels = collectLabelsAndGotos(repeatNode.body)
                labels.formUnion(repeatLabels.labels); hasGoto = hasGoto || repeatLabels.hasGoto; gosubCount += repeatLabels.gosubCount
            case .forEach(let eachNode):
                let eachLabels = collectLabelsAndGotos(eachNode.body)
                labels.formUnion(eachLabels.labels); hasGoto = hasGoto || eachLabels.hasGoto; gosubCount += eachLabels.gosubCount
            case .select(let selectNode):
                for caseNode in selectNode.cases {
                    let caseLabels = collectLabelsAndGotos(caseNode.body)
                    labels.formUnion(caseLabels.labels); hasGoto = hasGoto || caseLabels.hasGoto; gosubCount += caseLabels.gosubCount
                }
                if let defaultCase = selectNode.defaultCase {
                    let defaultLabels = collectLabelsAndGotos(defaultCase)
                    labels.formUnion(defaultLabels.labels); hasGoto = hasGoto || defaultLabels.hasGoto; gosubCount += defaultLabels.gosubCount
                }
            default: break
            }
        }
        return (labels, hasGoto, gosubCount)
    }
}
