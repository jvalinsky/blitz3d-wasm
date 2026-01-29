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
        
        // Create new function
        var function = WASMFunction(typeIndex: typeIdx)
        
        // Reset GOTO/Label tracking for this function
        labelStateMap = [:]
        gotoStateLocalIdx = -1
        hasGotoInCurrentFunction = false
        
        // Set current function body for type inference
        context.currentFunctionBody = functionNode.body
        context.typeInference.clearCache()
        
        // Check if function uses GOTO/Labels and prepare state machine if needed
        let (labels, hasGoto, _) = collectLabelsAndGotos(functionNode.body)
        hasGotoInCurrentFunction = hasGoto
        
        // Initialize local variables tracking
        context.variableManagement.clearLocals()
        
        // Debug: Register function and inject 'enter'
        var debugFuncId: Int?
        if let gen = context.debugGenerator, let indices = context.debugIndices {
            let funcId = gen.registerFunction(name: functionNode.name, signature: typeSignature, span: functionNode.span)
            debugFuncId = funcId
            
            function.body.append(.i32Const(Int32(funcId)))
            function.body.append(.call(indices.enter))
        }
        
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
            
            // Pre-build all state chunks
            var stateChunks: [(Int, [StatementNode])] = []
            var currentChunk: [StatementNode] = []
            var currentState = 0
            var gosubCounter = 0
            var maxState = 0
            
            for statement in functionNode.body {
                switch statement {
                case .label(let name, _):
                    if let stateNum = labelStateMap[name] {
                        stateChunks.append((currentState, currentChunk))
                        currentChunk = []
                        currentState = stateNum
                        maxState = max(maxState, stateNum)
                    }
                case .gosub:
                    gosubCounter += 1
                    let returnState = 1000 + gosubCounter
                    currentChunk.append(statement)
                    stateChunks.append((currentState, currentChunk))
                    currentChunk = []
                    currentState = returnState
                    maxState = max(maxState, returnState)
                default:
                    currentChunk.append(statement)
                }
            }
            // Flush final chunk with special termination state
            stateChunks.append((currentState, currentChunk))
            
            // Build br_table dispatch using nested blocks
            // Structure:
            //   block $exit {
            //     loop $dispatch {
            //       block $default { block $0 { block $1 { ... gotoState, br_table ... } chunk_n } ... chunk_0 } default
            //       br $dispatch  ; continue loop
            //     }
            //   }
            
            let numStates = stateChunks.count
            
            // Build target array for br_table
            // state → depth offset to reach its block
            var stateToBlockIndex: [Int: Int] = [:]
            for (i, (state, _)) in stateChunks.enumerated() {
                stateToBlockIndex[state] = i
            }
            
            // Build contiguous target array (0..maxState+1)
            // From inside the innermost block, to reach chunk at blockIdx b,
            // we need to exit (numStates - 1 - b) blocks: depth = numStates - 1 - b
            var targets: [Int] = []
            for i in 0...max(maxState, 0) {
                if let blockIdx = stateToBlockIndex[i] {
                    targets.append(numStates - 1 - blockIdx)
                } else {
                    targets.append(0) // Unknown state → default (terminate)
                }
            }
            
            // Handle -1 (termination) by exiting outer block
            // From inside the if: depth 0=if, 1..numStates=state blocks,
            // numStates+1=loop, numStates+2=$exit block
            let terminationCheck: [WASMInstruction] = [
                .localGet(gotoStateLocalIdx),
                .i32Const(-1),
                .i32Eq,
                .if(.void, [.br(numStates + 2)], nil)  // Break to $exit
            ]
            
            // br_table dispatch
            let brTableDispatch: [WASMInstruction] = [
                .localGet(gotoStateLocalIdx)
            ] + [.brTable(targets, 0)]
            
            // Build from inside out: innermost is br_table + termination check
            var innermost: [WASMInstruction] = terminationCheck + brTableDispatch
            
            // Wrap each state chunk in a block, from last to first
            for (stateIdx, (state, statements)) in stateChunks.enumerated().reversed() {
                // Generate this chunk's body
                var chunkBody: [WASMInstruction] = []
                var tempFunc = WASMFunction(typeIndex: function.typeIndex, locals: function.locals)
                for stmt in statements {
                    statementGenerator?.generateStatement(stmt, function: &tempFunc)
                }
                chunkBody.append(contentsOf: tempFunc.body)

                // CRITICAL: Copy back any new locals declared in this chunk to main function
                // Without this, locals declared in GOTO chunks are registered in VariableManagement
                // but never added to function.locals, causing validation errors
                if tempFunc.locals.count > function.locals.count {
                    let newLocals = tempFunc.locals[function.locals.count...]
                    function.locals.append(contentsOf: newLocals)
                }
                
                // Determine next state for fall-through
                let nextStateIdx = stateIdx + 1
                if nextStateIdx < stateChunks.count {
                    let nextState = stateChunks[nextStateIdx].0
                    // Fall through: if we didn't GOTO, set next state
                    chunkBody.append(.localGet(gotoStateLocalIdx))
                    chunkBody.append(.i32EqZ)
                    chunkBody.append(.if(.void, [
                        .i32Const(Int32(nextState)),
                        .localSet(gotoStateLocalIdx)
                    ], nil))
                } else {
                    // End of function: set termination state
                    chunkBody.append(.i32Const(-1))
                    chunkBody.append(.localSet(gotoStateLocalIdx))
                }
                
                // Continue loop: chunk at stateIdx has stateIdx enclosing blocks
                // between it and the loop, so br(stateIdx) targets the loop
                chunkBody.append(.br(stateIdx))
                
                // Wrap previous in block, then add this chunk's body
                innermost = [.block(.void, innermost)] + chunkBody
            }
            
            // Wrap in loop and exit block
            function.body.append(.block(.void, [
                .loop(.void, innermost)
            ]))
        } else {
            // Generate body statements normally
            for statement in functionNode.body {
                statementGenerator?.generateStatement(statement, function: &function)
            }
        }

        // Ensure return at end
        ensureReturn(function: &function, returnType: functionNode.returnType)
        
        // Debug: Inject 'leave' hook before returns
        if let funcId = debugFuncId, let indices = context.debugIndices {
             function.body = injectDebugLeave(function.body, leaveIdx: indices.leave, funcId: funcId)
        }

        // Validate local variable indices
        let paramCount = functionNode.parameters.count + (gotoStateLocalIdx >= 0 ? 1 : 0)
        let maxLocalIndex = context.variableManagement.maxLocalIndex()
        let declaredLocals = function.locals.count + paramCount
        if maxLocalIndex >= declaredLocals {
            CompilerLogger.warn("ERROR: Function '\(functionNode.name)' - Local index \(maxLocalIndex) exceeds declared locals count \(declaredLocals) (params: \(paramCount), locals: \(function.locals.count))")
        }

        // Add function to module
        let localFuncIdx = self.context.module.code.count
        let globalFuncIdx = self.context.module.imports.count + localFuncIdx

        self.context.module.code.append(function)
        self.context.module.functions.append(typeIdx)
        self.context.module.functionNames.append(functionNode.name)  // For WASM name section

        self.context.functionIndexMap[functionNode.name.lowercased()] = globalFuncIdx
        self.context.functionOriginalNames[functionNode.name.lowercased()] = functionNode.name

        // Note: Function export is handled by CodeGenerator to avoid duplicates
        // CodeGenerator exports all functions from functionIndexMap
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
            case .label(let name, _): labels.insert(name)
            case .goto: hasGoto = true
            case .gosub: hasGoto = true; gosubCount += 1
            case .ifStatement(let ifNode, _):
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
            case .whileLoop(let whileNode, _):
                let loopLabels = collectLabelsAndGotos(whileNode.body)
                labels.formUnion(loopLabels.labels); hasGoto = hasGoto || loopLabels.hasGoto; gosubCount += loopLabels.gosubCount
            case .forLoop(let forNode, _):
                let forLabels = collectLabelsAndGotos(forNode.body)
                labels.formUnion(forLabels.labels); hasGoto = hasGoto || forLabels.hasGoto; gosubCount += forLabels.gosubCount
            case .repeatLoop(let repeatNode, _):
                let repeatLabels = collectLabelsAndGotos(repeatNode.body)
                labels.formUnion(repeatLabels.labels); hasGoto = hasGoto || repeatLabels.hasGoto; gosubCount += repeatLabels.gosubCount
            case .forEach(let eachNode, _):
                let eachLabels = collectLabelsAndGotos(eachNode.body)
                labels.formUnion(eachLabels.labels); hasGoto = hasGoto || eachLabels.hasGoto; gosubCount += eachLabels.gosubCount
            case .select(let selectNode, _):
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

    private func injectDebugLeave(_ instrs: [WASMInstruction], leaveIdx: Int, funcId: Int) -> [WASMInstruction] {
        var result: [WASMInstruction] = []
        for instr in instrs {
            switch instr {
            case .return:
                result.append(.i32Const(Int32(funcId)))
                result.append(.call(leaveIdx))
                result.append(.return)
            case .block(let type, let inner):
                result.append(.block(type, injectDebugLeave(inner, leaveIdx: leaveIdx, funcId: funcId)))
            case .loop(let type, let inner):
                result.append(.loop(type, injectDebugLeave(inner, leaveIdx: leaveIdx, funcId: funcId)))
            case .if(let type, let thenBody, let elseBody):
                let newThen = injectDebugLeave(thenBody, leaveIdx: leaveIdx, funcId: funcId)
                let newElse = elseBody.map { injectDebugLeave($0, leaveIdx: leaveIdx, funcId: funcId) }
                result.append(.if(type, newThen, newElse))
            case .sourceLocation(let span, let inner):
                 let processed = injectDebugLeave([inner], leaveIdx: leaveIdx, funcId: funcId)
                 if processed.count == 1 {
                     result.append(.sourceLocation(span, processed[0]))
                 } else {
                     // Wrap expanded instructions in a block to preserve source mapping
                     result.append(.sourceLocation(span, .block(.void, processed)))
                 }
            default:
                result.append(instr)
            }
        }
        return result
    }
}
