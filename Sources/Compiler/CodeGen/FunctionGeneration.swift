//
//  FunctionGeneration.swift
//  Blitz3DCompiler
//
//  Function compilation and management for WASM code generation
//

import Foundation

/// Manages function generation and compilation
public struct FunctionGeneration {
    private var module: WASMModule
    private var typeIndexMap: [String: Int]
    private var functionIndexMap: [String: Int]
    
    // GOTO/Label support
    private var labelStateMap: [String: Int] = [:]
    private var gotoStateLocalIdx: Int = -1
    private var hasGotoInCurrentFunction: Bool = false
    
    // Variable management (will be injected)
    private var localVariables: [String: LocalInfo] = [:]
    
    // Type handling (will be injected)
    private var typeHandling: TypeHandling = TypeHandling()
    private var userTypes: [String: UserTypeInfo] = [:]
    
    // Statement generator (will be injected)
    private var statementGenerator: ((StatementNode, inout WASMFunction) -> Void)?
    
    public init(module: WASMModule, typeIndexMap: [String: Int], functionIndexMap: [String: Int]) {
        self.module = module
        self.typeIndexMap = typeIndexMap
        self.functionIndexMap = functionIndexMap
    }
    
    /// Configure dependencies
    public mutating func configure(
        localVariables: [String: LocalInfo],
        userTypes: [String: UserTypeInfo],
        statementGenerator: @escaping (StatementNode, inout WASMFunction) -> Void
    ) {
        self.localVariables = localVariables
        self.userTypes = userTypes
        self.statementGenerator = statementGenerator
    }
    
    /// Generate a function from AST node
    public mutating func generateFunction(_ functionNode: FunctionNode) {
        // Determine function type signature
        let typeSignature = functionSignature(for: functionNode)
        let typeIdx = typeIndexMap[typeSignature] ?? 0
        
        // Create new function
        var function = WASMFunction(typeIndex: typeIdx)
        
        // Clear local variables for this function
        var newLocalVariables: [String: LocalInfo] = [:]
        
        // Reset GOTO/Label tracking for this function
        labelStateMap = [:]
        gotoStateLocalIdx = -1
        hasGotoInCurrentFunction = false
        
        // Check if function uses GOTO/Labels and prepare state machine if needed
        let (labels, hasGoto) = collectLabelsAndGotos(functionNode.body)
        hasGotoInCurrentFunction = hasGoto
        
        if hasGoto && !labels.isEmpty {
            // Assign state numbers to each label (0 = start/normal flow)
            var stateNum = 1
            for label in labels.sorted() {
                labelStateMap[label] = stateNum
                stateNum += 1
            }
            // Add local variable for goto state tracking
            gotoStateLocalIdx = function.locals.count
            function.locals.append(.i32)
        }
        
        // Add parameters as locals
        for (index, param) in functionNode.parameters.enumerated() {
            function.locals.append(.i32)
            // Use type from annotation, default to i32
            let paramType = typeHandling.typeInfo(from: param.type?.rawValue ?? "Int")
            newLocalVariables[param.name] = LocalInfo(
                index: index + (hasGotoInCurrentFunction && !labels.isEmpty ? 1 : 0),
                type: paramType.wasmType
            )
        }
        
        // Update local variables reference
        localVariables = newLocalVariables
        
        // Generate body statements
        for statement in functionNode.body {
            statementGenerator?(statement, &function)
        }
        
        // Ensure return at end
        ensureReturn(function: &function, returnType: functionNode.returnType)
        
        // Add function to module
        let localFuncIdx = self.module.code.count
        let globalFuncIdx = self.module.imports.count + localFuncIdx
        
        self.module.code.append(function)
        self.module.functions.append(typeIdx)
        
        self.functionIndexMap[functionNode.name] = globalFuncIdx
        self.module.exports.append(WASMExport(name: functionNode.name, kind: .function, index: globalFuncIdx))
    }
    
    /// Generate function call instructions
    public func generateFunctionCallInstrs(_ call: FunctionCallNode, function: inout WASMFunction) -> [WASMInstruction] {
        var instrs: [WASMInstruction] = []
        
        // Generate argument instructions
        for arg in call.arguments {
            // Simplified: assume all args are i32
            instrs.append(.i32Const(0)) // Placeholder
        }
        
        // Look up function index
        if let funcIdx = functionIndexMap[call.name] {
            instrs.append(.call(Int(funcIdx)))
        } else {
            // Function not found, use unreachable as placeholder
            instrs.append(.unreachable)
        }
        
        return instrs
    }
    
    // MARK: - Private Helpers
    
    /// Determine function signature string
    private func functionSignature(for function: FunctionNode) -> String {
        let paramTypes = function.parameters.map { _ in "i32" }
        let returnType = function.returnType?.rawValue ?? "i32"
        return "(\(paramTypes.joined(separator: ", "))) -> \(returnType)"
    }
    
    /// Ensure function ends with return statement
    private func ensureReturn(function: inout WASMFunction, returnType: TypeAnnotation?) {
        // Check if last instruction is already a return
        if function.body.last == .return {
            return
        }
        
        // Add default return value based on return type annotation
        let returnWasmType = typeHandling.wasmType(from: returnType?.rawValue ?? "i32")
        switch returnWasmType {
        case .i32, .i64:
            function.body.append(.i32Const(0))
        case .f32:
            function.body.append(.f32Const(0))
        case .f64:
            function.body.append(.f64Const(0))
        default:
            function.body.append(.i32Const(0))
        }
        
        function.body.append(.return)
    }
    
    /// Collect labels and GOTO usage in statements
    private func collectLabelsAndGotos(_ statements: [StatementNode]) -> (labels: Set<String>, hasGoto: Bool) {
        var labels: Set<String> = []
        var hasGoto = false
        
        for statement in statements {
            switch statement {
            case .label(let name):
                labels.insert(name)
            case .goto:
                hasGoto = true
            case .gosub:
                hasGoto = true
            case .ifStatement(let ifNode):
                let thenLabels = collectLabelsAndGotos(ifNode.thenBranch)
                labels.formUnion(thenLabels.labels)
                hasGoto = hasGoto || thenLabels.hasGoto
                
                for (_, elseIfBranch) in ifNode.elseIfs {
                    let elseIfLabels = collectLabelsAndGotos(elseIfBranch)
                    labels.formUnion(elseIfLabels.labels)
                    hasGoto = hasGoto || elseIfLabels.hasGoto
                }
                
                let elseBranch = ifNode.elseBranch
                if !elseBranch.isEmpty {
                    let elseLabels = collectLabelsAndGotos(elseBranch)
                    labels.formUnion(elseLabels.labels)
                    hasGoto = hasGoto || elseLabels.hasGoto
                }
                
            case .whileLoop(let whileNode):
                let loopLabels = collectLabelsAndGotos(whileNode.body)
                labels.formUnion(loopLabels.labels)
                hasGoto = hasGoto || loopLabels.hasGoto
                
            case .forLoop(let forNode):
                let forLabels = collectLabelsAndGotos(forNode.body)
                labels.formUnion(forLabels.labels)
                hasGoto = hasGoto || forLabels.hasGoto
                
            case .repeatLoop(let repeatNode):
                let repeatLabels = collectLabelsAndGotos(repeatNode.body)
                labels.formUnion(repeatLabels.labels)
                hasGoto = hasGoto || repeatLabels.hasGoto
                
            case .forEach(let forEachNode):
                let eachLabels = collectLabelsAndGotos(forEachNode.body)
                labels.formUnion(eachLabels.labels)
                hasGoto = hasGoto || eachLabels.hasGoto
                
            case .select(let selectNode):
                let selectLabels = collectLabelsAndGotos(selectNode.cases.flatMap { $0.body })
                labels.formUnion(selectLabels.labels)
                hasGoto = hasGoto || selectLabels.hasGoto
                
                if let defaultCase = selectNode.defaultCase {
                    let defaultLabels = collectLabelsAndGotos(defaultCase)
                    labels.formUnion(defaultLabels.labels)
                    hasGoto = hasGoto || defaultLabels.hasGoto
                }
                
            default:
                break
            }
        }
        
        return (labels, hasGoto)
    }
}

/// Generate ForEach loop instructions
public func generateForEachInstrs(_ forEachNode: ForEachNode, function: inout WASMFunction, typeInfo: UserTypeInfo?) -> [WASMInstruction] {
    var instrs: [WASMInstruction] = []
    
    guard let userType = typeInfo else {
        return instrs
    }
    
    // Get first instance of type (First TypeName)
    instrs.append(.i32Const(0)) // placeholder for type collection base
    instrs.append(.call(0)) // placeholder for First_ function call
    
    // Start of loop
    instrs.append(.block(.void, [])) // Use block as label
    let loopStart = instrs.count - 1
    
    // Check if iterator is null (end of list)
    instrs.append(.localGet(0)) // Assuming iterator is in local 0
    instrs.append(.i32EqZ)
    
    // Branch to end if null
    let loopEnd = instrs.count
    instrs.append(.brIf(Int(loopEnd - loopStart))) // Adjusted brIf target
    
    // Assign current instance to loop variable
    instrs.append(.localTee(1)) // Store in second local
    
    // Loop body would be inserted here
    
    // Get next instance (After expr)
    instrs.append(.localGet(0))
    instrs.append(.call(0)) // placeholder for After_ function call
    
    // Store back to iterator
    instrs.append(.localSet(0))
    
    // Branch back to start
    instrs.append(.br(Int(loopStart)))
    
    // End of loop
    // Block will end naturally
    
    return instrs
}

/// Generate For loop instructions
public func generateForInstrs(_ forNode: ForNode, function: inout WASMFunction) -> [WASMInstruction] {
    var instrs: [WASMInstruction] = []
    
    // Start of loop
    let loopStart = instrs.count
    
    // Compare: variable <= endValue
    instrs.append(.localGet(0)) // variable
    instrs.append(.i32Const(0)) // placeholder for endValue
    instrs.append(.i32GtS) // variable > endValue?
    
    // Branch if greater than end (exit loop)
    let loopEnd = instrs.count
    instrs.append(.brIf(Int(loopEnd - loopStart))) // Exit loop
    
    // Loop body would be inserted here
    
    // Increment: variable + step
    instrs.append(.localGet(0)) // variable
    instrs.append(.i32Const(1)) // placeholder for stepValue
    instrs.append(.i32Add)
    instrs.append(.localSet(0)) // Store back
    
    // Branch to start
    instrs.append(.br(Int(loopStart)))
    
    return instrs
}

/// Generate While loop instructions
public func generateWhileInstrs(_ whileNode: WhileNode, function: inout WASMFunction) -> [WASMInstruction] {
    var instrs: [WASMInstruction] = []
    
    // Start of loop
    let loopStart = instrs.count
    
    // Evaluate condition
    // Condition instructions would be generated
    
    instrs.append(.i32Const(0)) // Placeholder for condition
    instrs.append(.i32EqZ)
    
    // Branch if false (condition is 0)
    let loopEnd = instrs.count
    instrs.append(.brIf(Int(loopEnd - loopStart))) // Exit loop
    
    // Loop body would be inserted here
    
    // Branch back to start
    instrs.append(.br(Int(loopStart)))
    
    return instrs
}

/// Generate Repeat loop instructions
public func generateRepeatInstrs(_ repeatNode: RepeatNode, function: inout WASMFunction) -> [WASMInstruction] {
    var instrs: [WASMInstruction] = []
    
    // Start of loop
    let loopStart = instrs.count
    
    // Loop body would be inserted here
    
    // Evaluate until condition
    instrs.append(.i32Const(0)) // Placeholder for condition
    instrs.append(.i32EqZ) // Negate: until means "until condition is true"
    
    // Branch back if condition is false (keep looping)
    instrs.append(.brIf(Int(loopStart)))
    
    return instrs
}