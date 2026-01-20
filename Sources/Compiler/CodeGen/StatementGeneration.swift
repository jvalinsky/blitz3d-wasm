//
//  StatementGeneration.swift
//  Blitz3DCompiler
//
//  Statement compilation for WASM code generation
//

import Foundation

/// Manages statement compilation and code generation
public final class StatementGeneration: ValidatorTypeContext {
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
    private var currentReturnType: WASMType = .void
    
    // GOSUB support
    private var gosubReturnCounter: Int = 0
    private var gosubReturnMap: [Int: [WASMInstruction]] = [:]
    
    // Stack validation
    private var stackValidator: StackValidator?
    private var enableStackValidation: Bool = true  // Toggle for debugging - Phase 1 integration

    // Type context cache for validator
    private var localTypeCache: [Int: WASMType] = [:]
    private var globalTypeCache: [Int: WASMType] = [:]

    public init(context: ModuleContext) {
        self.context = context
        let validator = StackValidator()
        validator.typeContext = nil  // Will be set after self is initialized
        self.stackValidator = validator
    }
    
    /// Configure stack validator with type context (call after init)
    private func configureStackValidator() {
        stackValidator?.typeContext = self
    }

    /// Register a local variable type for stack validation
    public func registerLocalType(_ index: Int, type: WASMType) {
        localTypeCache[index] = type
        stackValidator?.setLocalType(index, type: type)
    }

    /// Register a global variable type for stack validation
    public func registerGlobalType(_ index: Int, type: WASMType) {
        globalTypeCache[index] = type
        stackValidator?.setGlobalType(index, type: type)
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
        self.gosubReturnCounter = 0
    }

    public func setCurrentReturnType(_ type: WASMType) {
        self.currentReturnType = type
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
                let localInfo = context.variableManagement.registerLocal(id.name, type: wasmType, typeName: id.typeName)
                function.locals.append(wasmType)
                
                // Register with stack validator for type tracking
                registerLocalType(localInfo.index, type: wasmType)

                // Generate assignment for initializer if present
                if let initializer = decl.initializers[id.name],
                   let expressionGenerator = expressionGenerator {
                    let valueResult = expressionGenerator.generateWithInfo(initializer)
                    var instrs = valueResult.instrs
                    if valueResult.type != wasmType {
                        instrs.append(contentsOf: convert(from: valueResult.type, to: wasmType))
                    }
                    function.body.append(contentsOf: instrs)
                    if let local = context.variableManagement.localInfo(for: id.name) {
                        function.body.append(.localSet(local.index))
                    }
                }
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
            
            // DEBUG: Track assignments to identify type mismatches
            print("DEBUG_ASSIGN: \(assign.target) = <expr>")
            
            let valueResult = expressionGenerator.generateWithInfo(assign.value)
            let targetType = getTargetType(from: assign.target)
            
            print("  Value type: \(valueResult.type), Target type: \(targetType)")
            
            var finalInstrs = valueResult.instrs
            if valueResult.type != targetType {
                print("  CONVERTING: \(valueResult.type) → \(targetType)")
                finalInstrs.append(contentsOf: convert(from: valueResult.type, to: targetType))
            }
            
            let targetTypeName = getTypeName(from: assign.target)
            if targetTypeName == "String" && targetType == .i32 && valueResult.type != .i32 {
                // ... string conversion logic ...
            }
            
            switch assign.target {
            case .identifier(let id):
                print("DEBUG_ASSIGN_LOOKUP: Looking up '\(id.name)'")
                
                if let local = context.variableManagement.localInfo(for: id.name) {
                    print("  → Found as local[\(local.index)] type=\(local.type)")
                    function.body.append(contentsOf: finalInstrs)
                    function.body.append(.localSet(local.index))
                } else if let global = context.variableManagement.globalInfo(for: id.name) {
                    print("  → Found as global[\(global.index)] type=\(global.type)")
                    function.body.append(contentsOf: finalInstrs)
                    function.body.append(.globalSet(global.index))
                } else {
                    // Auto-declare implicit variable as global (Blitz3D behavior)
                    print("  → NOT FOUND, auto-declaring as global")
                    let wasmType = targetType
                    
                    // Register actual WASM global and track in VariableManagement
                    let actualGlobalIdx = context.registerGlobalWithDefaultInit(type: wasmType, mutability: true)
                    _ = context.variableManagement.registerGlobalWithIndex(id.name, type: wasmType, typeName: nil, wasmIndex: actualGlobalIdx)
                    
                    function.body.append(contentsOf: finalInstrs)
                    function.body.append(.globalSet(actualGlobalIdx))
                }
            case .arrayAccess(let access):
                if case .identifier(let arrayId) = access.array,
                   let array = context.variableManagement.arrayInfo(for: arrayId.name) {
                    // Start with base address
                    function.body.append(.i32Const(Int32(array.baseAddress)))

                    // Calculate index offset
                    for (i, indexExpr) in access.indices.enumerated() {
                        let indexInstrs = expressionGenerator.generate(indexExpr)
                        function.body.append(contentsOf: indexInstrs)

                        // Multiply by stride for multi-dimensional arrays
                        if i > 0 && i < array.dimensions.count {
                            var stride = array.elementSize
                            for j in 0..<i {
                                stride *= (array.dimensions[j] + 1)
                            }
                            function.body.append(.i32Const(Int32(stride)))
                            function.body.append(.i32Mul)
                        } else {
                            function.body.append(.i32Const(Int32(array.elementSize)))
                            function.body.append(.i32Mul)
                        }

                        if i > 0 {
                            function.body.append(.i32Add)
                        }
                    }
                    function.body.append(.i32Add)
                    function.body.append(contentsOf: finalInstrs)

                    // Use proper store instruction based on element type
                    switch array.elementType {
                    case .i32:
                        function.body.append(.i32Store(2, 0))
                    case .f32:
                        function.body.append(.f32Store(2, 0))
                    case .i64:
                        function.body.append(.i64Store(2, 0))
                    case .f64:
                        function.body.append(.f64Store(2, 0))
                    default:
                        function.body.append(.i32Store(2, 0))
                    }
                } else if case .fieldAccess(let fieldAccess) = access.array {
                    // Assignment to Field Array: obj.field[index] = value
                    // 1. Generate Field Access (returns instrs for base address)
                    let objInstrs = expressionGenerator.generate(fieldAccess.object)
                    function.body.append(contentsOf: objInstrs) // [objPtr]
                    
                    if let typeName = getTypeName(from: fieldAccess.object),
                       let fieldOffset = context.fieldOffsets[typeName]?[fieldAccess.field] {
                        
                        function.body.append(.i32Const(Int32(fieldOffset)))
                        function.body.append(.i32Add) // [fieldBaseAddr]
                        
                        let fieldTypeStr = context.userTypes[typeName]?.fieldTypes[fieldAccess.field] ?? "Int"
                        let elementType = typeHandling.wasmType(from: fieldTypeStr)
                        let elementSize = context.typeSize(for: elementType)
                        
                        // Calculate offset: index * size
                        if access.indices.count >= 1 {
                            let indexInstrs = expressionGenerator.generate(access.indices[0])
                            function.body.append(contentsOf: indexInstrs) // [addr, index]
                            
                            if elementSize > 1 {
                                function.body.append(.i32Const(Int32(elementSize)))
                                function.body.append(.i32Mul)
                            }
                            
                            function.body.append(.i32Add) // [addr + offset]
                        }
                        
                        // Append Value (RHS)
                        function.body.append(contentsOf: finalInstrs) // [addr, value]
                        
                        // Store
                        switch elementType {
                        case .i32: function.body.append(.i32Store(2, 0))
                        case .f32: function.body.append(.f32Store(2, 0))
                        case .i64: function.body.append(.i64Store(2, 0))
                        case .f64: function.body.append(.f64Store(2, 0))
                        default:   function.body.append(.i32Store(2, 0))
                        }
                    }
                }
            case .fieldAccess(let access):
                let objInstrs = expressionGenerator.generate(access.object)
                function.body.append(contentsOf: objInstrs)
                if let typeName = getTypeName(from: access.object),
                   let fieldOffset = context.fieldOffsets[typeName]?[access.field] {
                    function.body.append(.i32Const(Int32(fieldOffset)))
                    function.body.append(.i32Add)
                    function.body.append(contentsOf: finalInstrs)

                    // Use proper store instruction based on field type
                    let fieldTypeStr = context.userTypes[typeName]?.fieldTypes[access.field] ?? "Int"
                    let fieldType = typeHandling.wasmType(from: fieldTypeStr)
                    switch fieldType {
                    case .i32:
                        function.body.append(.i32Store(2, 0))
                    case .f32:
                        function.body.append(.f32Store(2, 0))
                    case .i64:
                        function.body.append(.i64Store(2, 0))
                    case .f64:
                        function.body.append(.f64Store(2, 0))
                    default:
                        function.body.append(.i32Store(2, 0))
                    }
                } else {
                    // Type resolution failed, but we pushed the object pointer. Drop it to safe stack.
                    print("DEBUG_COMPILER: WARNING! Failed to resolve field access for assignment: \(access.field). Dropping object pointer.")
                    function.body.append(.drop)
                }
            default:
                break
            }
            
        case .functionCall(let call):
            guard let expressionGenerator = expressionGenerator else { break }
            let (instrs, type) = expressionGenerator.generateWithInfo(.functionCall(call))
            function.body.append(contentsOf: instrs)
            
            // Should always drop the result as we are in a statement context
            // ExpressionGeneration ensures void functions return a dummy 0 (i32)
            if type != .void {
                function.body.append(.drop)
                print("DEBUG_STMT: Dropped return value of type \(type) for call statement")
            } else {
                print("DEBUG_STMT: No drop needed (void) for call statement")
            }
            
        case .ifStatement(let ifNode):
            guard let expressionGenerator = expressionGenerator else { break }

            // Handle elseIfs by converting them to nested if-else statements
            func buildIfChain(condition: ExpressionNode,
                             thenBranch: [StatementNode],
                             elseIfs: [(ExpressionNode, [StatementNode])],
                             elseBranch: [StatementNode]) -> [WASMInstruction] {
                var result: [WASMInstruction] = []

                let condResult = expressionGenerator.generateWithInfo(condition)
                result.append(contentsOf: condResult.instrs)
                if condResult.type == .f32 {
                    result.append(.i32TruncF32S)
                }

                currentDepth += 1
                var thenBody = generateStatementBlock(thenBranch, function: &function)
                currentDepth -= 1

                var elseBody: [WASMInstruction]? = nil
                if let (nextCondition, nextThenBranch) = elseIfs.first {
                    var elseBranch = buildIfChain(condition: nextCondition,
                                           thenBranch: nextThenBranch,
                                           elseIfs: Array(elseIfs.dropFirst()),
                                           elseBranch: elseBranch)
                    elseBody = elseBranch
                } else if !elseBranch.isEmpty {
                    currentDepth += 1
                    var elseBranchBody = generateStatementBlock(elseBranch, function: &function)
                    currentDepth -= 1
                    elseBody = elseBranchBody
                }
                
                // Validate and balance if/else branches using stack validator
                var balancedThen = thenBody
                var balancedElse = elseBody

                // DISABLED: Stack validation for if/else branches
                // Issue: calculateStackDelta doesn't have function signatures,
                // so it can't accurately track stack effects of function calls.
                // This causes spurious drop instructions.
                // TODO: Pass function signatures to calculateStackDelta
                if false && enableStackValidation {
                    let (thenDrops, elseDrops) = StackValidator.balanceBranches(
                        thenBranch: thenBody,
                        elseBranch: elseBody ?? [],
                        localTypes: localTypeCache,
                        globalTypes: globalTypeCache
                    )

                    if thenDrops > 0 {
                        print("DEBUG_STACK: If branch has \(thenDrops) excess value(s), adding drops")
                        for _ in 0..<thenDrops {
                            balancedThen.append(.drop)
                        }
                    }

                    if elseDrops > 0 {
                        print("DEBUG_STACK: Else branch has \(elseDrops) excess value(s), adding drops")
                        if balancedElse == nil {
                            balancedElse = []
                        }
                        for _ in 0..<elseDrops {
                            balancedElse!.append(.drop)
                        }
                    }
                }

                result.append(.if(.void, balancedThen, balancedElse))
                return result
            }

            function.body.append(contentsOf: buildIfChain(condition: ifNode.condition,
                                                         thenBranch: ifNode.thenBranch,
                                                         elseIfs: ifNode.elseIfs,
                                                         elseBranch: ifNode.elseBranch))
            
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
            
            var bodyInstrs = generateStatementBlock(whileNode.body, function: &function)
            // DISABLED: Balance loop body
            // Same issue as if/else - no function signatures
            loopInstrs.append(contentsOf: bodyInstrs)
            loopInstrs.append(.br(0))
            
            currentDepth -= 2
            loopExitDepths.removeLast()
            
            function.body.append(.block(.void, [
                .loop(.void, loopInstrs)
            ]))
            
        case .forLoop(let forNode):
            guard let expressionGenerator = expressionGenerator else { break }
            var loopLocal = context.variableManagement.localInfo(for: forNode.variable.name)
            if loopLocal == nil {
                // Implicit loop variable -> Register as Local Int
                let registered = context.variableManagement.registerLocal(forNode.variable.name, type: .i32)
                loopLocal = registered
                function.locals.append(.i32)
                
                // Register with stack validator for type tracking
                registerLocalType(registered.index, type: .i32)
                print("DEBUG_COMPILER: Auto-registered implicit For-Loop variable '\(forNode.variable.name)' as Local .i32")
            }
            
            if let local = loopLocal {
                let startInstrs = expressionGenerator.generate(forNode.startValue)
                function.body.append(contentsOf: startInstrs)
                function.body.append(.localSet(local.index))

                currentDepth += 1 // block
                loopExitDepths.append(currentDepth)
                currentDepth += 1 // loop

                var loopInstrs: [WASMInstruction] = []

                // Determine step direction at compile time if possible
                var stepIsNegative = false
                var stepIsConstant = false
                var stepValue: Int = 1

                if let stepExpr = forNode.stepValue {
                    // Try to evaluate step as constant
                    if case .integerLiteral(let v) = stepExpr {
                        stepValue = v
                        stepIsConstant = true
                        stepIsNegative = v < 0
                    } else if case .unary(let unary) = stepExpr, unary.op == "-" {
                        if case .integerLiteral(let v) = unary.expression {
                            stepValue = -v
                            stepIsConstant = true
                            stepIsNegative = true
                        }
                    }
                } else {
                    // No step provided, default to 1 (constant)
                    stepIsConstant = true
                    stepIsNegative = false
                }

                // Loop condition check
                loopInstrs.append(.localGet(local.index))
                let endInstrs = expressionGenerator.generate(forNode.endValue)
                loopInstrs.append(contentsOf: endInstrs)

                if stepIsConstant {
                    // Use appropriate comparison based on step direction
                    if stepIsNegative {
                        // For negative step: exit when i < end
                        loopInstrs.append(.i32LtS)
                    } else {
                        // For positive step: exit when i > end
                        loopInstrs.append(.i32GtS)
                    }
                    loopInstrs.append(.brIf(1))
                } else {
                    // Runtime step direction check
                    // Save end value to scratch global 2
                    loopInstrs.append(.globalSet(context.scratchGlobal2Idx))

                    // Generate step and check sign (use default 1 if not provided)
                    if let stepExpr = forNode.stepValue {
                        let stepInstrs = expressionGenerator.generate(stepExpr)
                        loopInstrs.append(contentsOf: stepInstrs)
                    } else {
                        loopInstrs.append(.i32Const(1))
                    }
                    loopInstrs.append(.i32Const(0))
                    loopInstrs.append(.i32LtS) // step < 0 ?

                    // if (step < 0) { exit if i < end } else { exit if i > end }
                    // Use select to choose the right comparison without leaving a value on stack
                    loopInstrs.append(.if(.i32, [
                        // Negative step: check i < end
                        .localGet(local.index),
                        .globalGet(context.scratchGlobal2Idx),
                        .i32LtS
                    ], [
                        // Positive step: check i > end
                        .localGet(local.index),
                        .globalGet(context.scratchGlobal2Idx),
                        .i32GtS
                    ]))
                    loopInstrs.append(.drop) // Drop the comparison result from if
                    loopInstrs.append(.brIf(1))
                }

                var bodyInstrs = generateStatementBlock(forNode.body, function: &function)
                // DISABLED: Balance loop body  
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
            guard let typeInfo = context.userTypes[forEachNode.typeName],
                  let iterator = context.variableManagement.localInfo(for: forEachNode.iteratorName) else { break }
            
            currentDepth += 1 // block
            loopExitDepths.append(currentDepth)
            currentDepth += 1 // loop
            
            // Initialization: it = type_first
            function.body.append(.globalGet(typeInfo.firstGlobalIdx))
            function.body.append(.localSet(iterator.index))
            
            var loopInstrs: [WASMInstruction] = []
            
            // it == 0? exit
            loopInstrs.append(.localGet(iterator.index))
            loopInstrs.append(.i32EqZ)
            loopInstrs.append(.brIf(1)) // exit block
            
            // body
            var bodyInstrs = generateStatementBlock(forEachNode.body, function: &function)
            // DISABLED: Balance loop body
            loopInstrs.append(contentsOf: bodyInstrs)
            
            // it = it.next
            loopInstrs.append(.localGet(iterator.index))
            loopInstrs.append(.i32Load(2, 4)) // offset 4 is __next
            loopInstrs.append(.localSet(iterator.index))
            
            // loop
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
            var bodyInstrs = generateStatementBlock(repeatNode.body, function: &function)
            // DISABLED: Balance loop body
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
            // Generate: block { if (cond) { body; br 1 } ... default }
            currentDepth += 1
            
            var blockInstrs: [WASMInstruction] = []
            
            // 1. Generate select expression and save to appropriate scratch global
            let (selectInstrs, selectType) = expressionGenerator?.generateWithInfo(selectNode.expression) ?? ([], .i32)
            blockInstrs.append(contentsOf: selectInstrs)
            
            let scratchIdx: Int
            if selectType == .f32 {
                scratchIdx = context.scratchGlobalFloatIdx
                blockInstrs.append(.globalSet(scratchIdx))
            } else {
                scratchIdx = context.scratchGlobalIdx 
                // Convert to i32 if needed (e.g. i64) - for now assume i32 compatible or already converted
                blockInstrs.append(.globalSet(scratchIdx))
            }

            // 2. Generate cases
            for caseNode in selectNode.cases {
                var conditionInstrs: [WASMInstruction] = []

                for (valueIndex, caseValue) in caseNode.values.enumerated() {
                    switch caseValue {
                    case .single(let caseExpr):
                        if selectType == .f32 {
                            conditionInstrs.append(.globalGet(scratchIdx)) // f32
                            let (caseInstrs, caseType) = expressionGenerator?.generateWithInfo(caseExpr) ?? ([], .f32)
                            conditionInstrs.append(contentsOf: caseInstrs)
                            if caseType != .f32 {
                                conditionInstrs.append(contentsOf: convert(from: caseType, to: .f32))
                            }
                            conditionInstrs.append(.f32Eq)
                        } else {
                            conditionInstrs.append(.globalGet(scratchIdx)) // i32
                            let (caseInstrs, caseType) = expressionGenerator?.generateWithInfo(caseExpr) ?? ([], .i32)
                            conditionInstrs.append(contentsOf: caseInstrs)
                            if caseType != .i32 {
                                conditionInstrs.append(contentsOf: convert(from: caseType, to: .i32))
                            }
                            conditionInstrs.append(.i32Eq)
                        }

                    case .range(let fromExpr, let toExpr):
                        if selectType == .f32 {
                            // >= from
                            conditionInstrs.append(.globalGet(scratchIdx))
                            let (fromInstrs, fromType) = expressionGenerator?.generateWithInfo(fromExpr) ?? ([], .f32)
                            conditionInstrs.append(contentsOf: fromInstrs)
                            if fromType != .f32 { conditionInstrs.append(contentsOf: convert(from: fromType, to: .f32)) }
                            conditionInstrs.append(.f32Ge)
                            
                            // <= to
                            conditionInstrs.append(.globalGet(scratchIdx))
                            let (toInstrs, toType) = expressionGenerator?.generateWithInfo(toExpr) ?? ([], .f32)
                            conditionInstrs.append(contentsOf: toInstrs)
                            if toType != .f32 { conditionInstrs.append(contentsOf: convert(from: toType, to: .f32)) }
                            conditionInstrs.append(.f32Le)
                            
                            conditionInstrs.append(.i32And)
                        } else {
                            // >= from
                            conditionInstrs.append(.globalGet(scratchIdx))
                            let (fromInstrs, fromType) = expressionGenerator?.generateWithInfo(fromExpr) ?? ([], .i32)
                            conditionInstrs.append(contentsOf: fromInstrs)
                            if fromType != .i32 { conditionInstrs.append(contentsOf: convert(from: fromType, to: .i32)) }
                            conditionInstrs.append(.i32GeS)
                            
                            // <= to
                            conditionInstrs.append(.globalGet(scratchIdx))
                            let (toInstrs, toType) = expressionGenerator?.generateWithInfo(toExpr) ?? ([], .i32)
                            conditionInstrs.append(contentsOf: toInstrs)
                            if toType != .i32 { conditionInstrs.append(contentsOf: convert(from: toType, to: .i32)) }
                            conditionInstrs.append(.i32LeS)
                            
                            conditionInstrs.append(.i32And)
                        }
                    }

                    if valueIndex > 0 {
                        conditionInstrs.append(.i32Or)
                    }
                }

                // Generate case body
                var caseBodyInstrs = generateStatementBlock(caseNode.body, function: &function)
                caseBodyInstrs.append(.br(1)) // Exit Select block
                
                // if (condition) { body; br 1 }
                blockInstrs.append(contentsOf: conditionInstrs)
                blockInstrs.append(.if(.void, caseBodyInstrs, nil))
            }

            // 3. Default case
            if let defaultCase = selectNode.defaultCase {
                let defaultBodyInstrs = generateStatementBlock(defaultCase, function: &function)
                blockInstrs.append(contentsOf: defaultBodyInstrs)
            }
            
            function.body.append(.block(.void, blockInstrs))
            currentDepth -= 1
            
        case .returnStatement(let expr):
            // Check if we are in a GOSUB return context (stack not empty)
            if gotoStateLocalIdx >= 0 {
                function.body.append(.globalGet(context.gosubStackPtrIdx))
                function.body.append(.i32Const(131072)) // Initial stack ptr
                function.body.append(.i32GtU)
                function.body.append(.if(.void, [
                    .globalGet(context.gosubStackPtrIdx),
                    .i32Const(4),
                    .i32Sub,
                    .globalSet(context.gosubStackPtrIdx),
                    .globalGet(context.gosubStackPtrIdx),
                    .i32Load(2, 0),
                    .localSet(gotoStateLocalIdx),
                    .br(currentDepth + 2) // Back to state machine loop (beyond return if AND chunk if)
                ], nil))
            }
            
            if let returnExpr = expr {
                var returnInstrs = expressionGenerator?.generateWithInfo(returnExpr)
                if let returnInfo = returnInstrs {
                    function.body.append(contentsOf: returnInfo.instrs)
                    if returnInfo.type != currentReturnType {
                        function.body.append(contentsOf: convert(from: returnInfo.type, to: currentReturnType))
                    }
                }
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
                function.body.append(.br(0)) // Branch to loop start to re-evaluate state
            } else {
                function.body.append(.nop)
            }
            
        case .gosub(let labelName):
            if gotoStateLocalIdx >= 0, let stateNum = labelStateMap[labelName] {
                // 1. Assign unique return ID
                gosubReturnCounter += 1
                let returnID = 1000 + gosubReturnCounter
                
                // 2. Push returnID to stack
                function.body.append(.globalGet(context.gosubStackPtrIdx))
                function.body.append(.i32Const(Int32(returnID)))
                function.body.append(.i32Store(2, 0))
                
                function.body.append(.globalGet(context.gosubStackPtrIdx))
                function.body.append(.i32Const(4))
                function.body.append(.i32Add)
                function.body.append(.globalSet(context.gosubStackPtrIdx))
                
                // 3. Set target state and jump
                function.body.append(.i32Const(Int32(stateNum)))
                function.body.append(.localSet(gotoStateLocalIdx))
                function.body.append(.br(0)) // Branch to loop start
                
                // 4. Mark return point (placeholder)
                function.body.append(.nop)
            } else {
                function.body.append(.nop)
            }
            
        case .label(let name):
            // The label itself is just a state ID check point
            if labelStateMap[name] != nil {
                // We'll wrap segments in checks:
                // if (gotoState == stateNum) { gotoState = 0; ... }
                // This is actually better done in generateFunction's loop
                // but for now we'll emit a nop
                function.body.append(.nop)
            }
            
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
                typeID: context.userTypes.count + 1,
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
            
        case .delete(let expr):
            guard let typeName = getTypeName(from: expr),
                  let typeInfo = context.userTypes[typeName],
                  let expressionGenerator = expressionGenerator else { break }
            
            let objInstrs = expressionGenerator.generate(expr)
            function.body.append(contentsOf: objInstrs)
            function.body.append(.localSet(0)) // local 0: obj
            
            // 1. Unstitch
            // if (obj.prev != 0) obj.prev.next = obj.next
            // else first = obj.next
            function.body.append(.localGet(0))
            function.body.append(.i32Load(2, 0)) // obj.prev
            function.body.append(.if(.void, [
                .localGet(0),
                .i32Load(2, 0), // prev
                .localGet(0),
                .i32Load(2, 4), // next
                .i32Store(2, 4) // prev.next = obj.next
            ], [
                .localGet(0),
                .i32Load(2, 4), // next
                .globalSet(typeInfo.firstGlobalIdx) // first = next
            ]))
            
            // if (obj.next != 0) obj.next.prev = obj.prev
            // else last = obj.prev
            function.body.append(.localGet(0))
            function.body.append(.i32Load(2, 4)) // obj.next
            function.body.append(.if(.void, [
                .localGet(0),
                .i32Load(2, 4), // next
                .localGet(0),
                .i32Load(2, 0), // prev
                .i32Store(2, 0) // next.prev = obj.prev
            ], [
                .localGet(0),
                .i32Load(2, 0), // prev
                .globalSet(typeInfo.lastGlobalIdx) // last = prev
            ]))
            
            // 2. Recycle
            // obj.next = freeHead
            // freeHead = obj
            function.body.append(.localGet(0))
            function.body.append(.globalGet(typeInfo.freeHeadGlobalIdx))
            function.body.append(.i32Store(2, 4)) // using next field for free list
            
            function.body.append(.localGet(0))
            function.body.append(.globalSet(typeInfo.freeHeadGlobalIdx))
            
            // Invalidate typeID for safety
            function.body.append(.localGet(0))
            function.body.append(.i32Const(0))
            function.body.append(.i32Store(2, 8))
            
        case .insert(let objExpr, let position):
            // Insert a Before b  OR  Insert a After b
            // Moves 'a' in the linked list to be before/after 'b'
            guard let typeName = getTypeName(from: objExpr),
                  let typeInfo = context.userTypes[typeName],
                  let expressionGenerator = expressionGenerator else { break }

            // Generate 'a' (the object to move)
            let objInstrs = expressionGenerator.generate(objExpr)
            function.body.append(contentsOf: objInstrs)
            function.body.append(.globalSet(context.scratchGlobalIdx)) // scratch = a

            // First, unstitch 'a' from its current position
            // if (a.prev != 0) a.prev.next = a.next else first = a.next
            function.body.append(.globalGet(context.scratchGlobalIdx))
            function.body.append(.i32Load(2, 0)) // a.prev
            function.body.append(.if(.void, [
                // a.prev.next = a.next
                .globalGet(context.scratchGlobalIdx),
                .i32Load(2, 0), // prev
                .globalGet(context.scratchGlobalIdx),
                .i32Load(2, 4), // next
                .i32Store(2, 4) // prev.next = a.next
            ], [
                // first = a.next
                .globalGet(context.scratchGlobalIdx),
                .i32Load(2, 4),
                .globalSet(typeInfo.firstGlobalIdx)
            ]))

            // if (a.next != 0) a.next.prev = a.prev else last = a.prev
            function.body.append(.globalGet(context.scratchGlobalIdx))
            function.body.append(.i32Load(2, 4)) // a.next
            function.body.append(.if(.void, [
                // a.next.prev = a.prev
                .globalGet(context.scratchGlobalIdx),
                .i32Load(2, 4), // next
                .globalGet(context.scratchGlobalIdx),
                .i32Load(2, 0), // prev
                .i32Store(2, 0) // next.prev = a.prev
            ], [
                // last = a.prev
                .globalGet(context.scratchGlobalIdx),
                .i32Load(2, 0),
                .globalSet(typeInfo.lastGlobalIdx)
            ]))

            // Now stitch 'a' into new position
            switch position {
            case .before(let targetExpr):
                // Insert a Before b
                let targetInstrs = expressionGenerator.generate(targetExpr)
                function.body.append(contentsOf: targetInstrs)
                function.body.append(.globalSet(context.scratchGlobal2Idx)) // scratch2 = b

                // a.next = b
                function.body.append(.globalGet(context.scratchGlobalIdx))
                function.body.append(.globalGet(context.scratchGlobal2Idx))
                function.body.append(.i32Store(2, 4))

                // a.prev = b.prev
                function.body.append(.globalGet(context.scratchGlobalIdx))
                function.body.append(.globalGet(context.scratchGlobal2Idx))
                function.body.append(.i32Load(2, 0)) // b.prev
                function.body.append(.i32Store(2, 0))

                // if (b.prev != 0) b.prev.next = a else first = a
                function.body.append(.globalGet(context.scratchGlobal2Idx))
                function.body.append(.i32Load(2, 0)) // b.prev
                function.body.append(.if(.void, [
                    .globalGet(context.scratchGlobal2Idx),
                    .i32Load(2, 0), // b.prev
                    .globalGet(context.scratchGlobalIdx),
                    .i32Store(2, 4) // b.prev.next = a
                ], [
                    .globalGet(context.scratchGlobalIdx),
                    .globalSet(typeInfo.firstGlobalIdx) // first = a
                ]))

                // b.prev = a
                function.body.append(.globalGet(context.scratchGlobal2Idx))
                function.body.append(.globalGet(context.scratchGlobalIdx))
                function.body.append(.i32Store(2, 0))

            case .after(let targetExpr):
                // Insert a After b
                let targetInstrs = expressionGenerator.generate(targetExpr)
                function.body.append(contentsOf: targetInstrs)
                function.body.append(.globalSet(context.scratchGlobal2Idx)) // scratch2 = b

                // a.prev = b
                function.body.append(.globalGet(context.scratchGlobalIdx))
                function.body.append(.globalGet(context.scratchGlobal2Idx))
                function.body.append(.i32Store(2, 0))

                // a.next = b.next
                function.body.append(.globalGet(context.scratchGlobalIdx))
                function.body.append(.globalGet(context.scratchGlobal2Idx))
                function.body.append(.i32Load(2, 4)) // b.next
                function.body.append(.i32Store(2, 4))

                // if (b.next != 0) b.next.prev = a else last = a
                function.body.append(.globalGet(context.scratchGlobal2Idx))
                function.body.append(.i32Load(2, 4)) // b.next
                function.body.append(.if(.void, [
                    .globalGet(context.scratchGlobal2Idx),
                    .i32Load(2, 4), // b.next
                    .globalGet(context.scratchGlobalIdx),
                    .i32Store(2, 0) // b.next.prev = a
                ], [
                    .globalGet(context.scratchGlobalIdx),
                    .globalSet(typeInfo.lastGlobalIdx) // last = a
                ]))

                // b.next = a
                function.body.append(.globalGet(context.scratchGlobal2Idx))
                function.body.append(.globalGet(context.scratchGlobalIdx))
                function.body.append(.i32Store(2, 4))
            }

        case .data, .empty, .function:
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
            print("DEBUG_TARGET: Checking type for '\(id.name)', suffix: \(id.typeSuffix?.rawValue ?? "none")")
            
            // CRITICAL FIX: Check type suffix FIRST before registry lookup
            // This ensures float variables (x#) are recognized as f32 even during initial assignment
            if let suffix = id.typeSuffix {
                let type = typeHandling.wasmType(from: suffix)
                print("  → From suffix: \(type)")
                return type
            }
            
            // Then check if variable is already registered
            if let local = context.variableManagement.localInfo(for: id.name) {
                print("  → From local registry: \(local.type)")
                return local.type
            }
            if let global = context.variableManagement.globalInfo(for: id.name) {
                print("  → From global registry: \(global.type)")
                return global.type
            }
            print("  → DEFAULT: i32")
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

    /// Balance if/else branches to have same stack effect
    /// Conservative approach: only balance when we detect obvious imbalance
    private func balanceIfBranches(then thenBody: [WASMInstruction], else elseBody: [WASMInstruction]?) -> ([WASMInstruction], [WASMInstruction]?) {
        // CONSERVATIVE: Don't try to calculate stack delta for complex code
        // Instead, check for obvious patterns that need balancing
        
        // Pattern 1: One branch ends with a call that returns a value, other doesn't
        let thenEndsWithValueCall = endsWithValueProducingCall(thenBody)
        let elseEndsWithValueCall = elseBody.map { endsWithValueProducingCall($0) } ?? false
        
        if thenEndsWithValueCall && !elseEndsWithValueCall {
            // Then produces value, else doesn't - drop the value from then
            var balanced = thenBody
            balanced.append(.drop)
            return (balanced, elseBody)
        }
        
        if elseEndsWithValueCall && !thenEndsWithValueCall, let elseBody = elseBody {
            // Else produces value, then doesn't - drop the value from else
            var balanced = elseBody
            balanced.append(.drop)
            return (thenBody, balanced)
        }
        
        // Otherwise, assume branches are already balanced or will be caught by validation
        return (thenBody, elseBody)
    }
    
    /// Check if instruction sequence ends with a call that returns a non-void value
    private func endsWithValueProducingCall(_ instructions: [WASMInstruction]) -> Bool {
        guard let lastInstr = instructions.last else { return false }
        
        if case .call(let funcIdx) = lastInstr {
            if let def = context.functionDefinitionsByIndex[funcIdx] {
                return !def.results.isEmpty
            }
        }
        
        return false
    }
    
    /// Legacy balanceStack - used for non-if contexts
    /// Returns instructions unchanged to avoid incorrect drops
    private func balanceStack(_ instructions: [WASMInstruction], targetDelta: Int = 0) -> [WASMInstruction] {
        // For now, just return unchanged
        // Only use balanceIfBranches for if statements
        return instructions
    }
    
    /// Calculate net stack effect of a sequence of instructions
    private func calculateStackDelta(_ instructions: [WASMInstruction]) -> Int {
        var delta = 0
        for instr in instructions {
            switch instr {
            // Push 1
            case .i32Const, .i64Const, .f32Const, .f64Const:
                delta += 1
            case .localGet, .globalGet:
                delta += 1
            case .call(let funcIdx):
                if let def = context.functionDefinitionsByIndex[funcIdx] {
                    delta -= def.params.count
                    delta += def.results.count
                } else {
                    // Fallback if index not found (shouldn't happen)
                    delta += 0
                }
                
            // Pop 1
            case .localSet, .globalSet, .drop:
                delta -= 1
                
            // Binary ops: pop 2, push 1 (net -1)
            case .i32Add, .i32Sub, .i32Mul, .i32DivS, .i32DivU, .i32RemS, .i32RemU:
                delta -= 1
            case .i64Add, .i64Sub, .i64Mul, .i64DivS, .i64DivU, .i64RemS, .i64RemU:
                delta -= 1
            case .f32Add, .f32Sub, .f32Mul, .f32Div:
                delta -= 1
            case .f64Add, .f64Sub, .f64Mul, .f64Div:
                delta -= 1
            case .i32And, .i32Or, .i32Xor, .i32Shl, .i32ShrS, .i32ShrU, .i32Rotl, .i32Rotr:
                delta -= 1
            case .i32Eq, .i32Ne, .i32LtS, .i32LtU, .i32GtS, .i32GtU, .i32LeS, .i32LeU, .i32GeS, .i32GeU:
                delta -= 1
            case .f32Eq, .f32Ne, .f32Lt, .f32Gt, .f32Le, .f32Ge:
                delta -= 1
                
            // Unary ops: pop 1, push 1 (net 0)
            case .i32EqZ, .i64EqZ:
                // Actually pop 1, push 1 (net 0)
                break
            case .f32ConvertI32S, .f32ConvertI32U, .f32ConvertI64S, .f32ConvertI64U:
                // pop 1, push 1 (net 0)
                break
            case .i32TruncF32S, .i32TruncF32U, .i32TruncF64S, .i32TruncF64U:
                // pop 1, push 1 (net 0)
                break
            case .f32Neg, .f32Abs, .f32Sqrt:
                // pop 1, push 1 (net 0)
                break
                
            // Control flow
            case .if(let blockType, let thenBody, let elseBody):
                delta -= 1  // condition consumed
                // Both branches should have same effect after balancing
                let thenDelta = calculateStackDelta(thenBody)
                if let elseBody = elseBody {
                    let elseDelta = calculateStackDelta(elseBody)
                    // Use the minimum (safer estimate)
                    delta += min(thenDelta, elseDelta)
                } else {
                    // No else branch - then must be balanced to 0
                    delta += 0
                }
                
            case .block(let blockType, let body):
                let bodyDelta = calculateStackDelta(body)
                delta += bodyDelta
                
            case .loop(let blockType, let body):
                let bodyDelta = calculateStackDelta(body)
                delta += bodyDelta
                
            case .br:
                // br doesn't consume from stack (unconditional branch)
                break
            case .brIf:
                // brIf consumes condition
                delta -= 1
                
            case .return:
                // return ends the function, stack doesn't matter after
                break
                
            // Memory ops
            case .i32Load, .i64Load, .f32Load, .f64Load:
                // pop 1 (address), push 1 (value) (net 0)
                break
            case .i32Store, .i64Store, .f32Store, .f64Store:
                delta -= 2  // pop address and value
                
            default:
                break
            }
        }
        return delta
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
        case .arrayAccess(let access):
            // Check if it's a field array access: obj.field[index]
            if case .fieldAccess(let fieldAccess) = access.array,
               let objType = getTypeName(from: fieldAccess.object),
               let fieldType = context.userTypes[objType]?.fieldTypes[fieldAccess.field] {
                // If the field is an array of CustomType, return CustomType
                // fieldType is "CustomType" or "Int" etc.
                return fieldType
            }
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
    
    // MARK: - Stack Validation

    /// Validate a sequence of instructions and insert drops as needed
    private func validateInstructions(_ instructions: [WASMInstruction]) -> [WASMInstruction] {
        guard enableStackValidation else {
            return instructions
        }

        // Use the static method for balance calculation with type context
        var balanced = instructions
        let dropsAdded = StackValidator.balanceToTarget(
            &balanced,
            targetDelta: 0,  // Loop bodies should have net zero stack effect
            localTypes: localTypeCache,
            globalTypes: globalTypeCache
        )

        if dropsAdded > 0 {
            print("DEBUG_STACK: Inserting \(dropsAdded) drop(s) to balance loop body")
        }

        return balanced
    }

    /// Validate and balance a block of instructions to a specific target
    private func validateAndBalance(_ instructions: [WASMInstruction], targetDelta: Int = 0) -> [WASMInstruction] {
        guard enableStackValidation else {
            return instructions
        }

        var balanced = instructions
        let dropsAdded = StackValidator.balanceToTarget(
            &balanced,
            targetDelta: targetDelta,
            localTypes: localTypeCache,
            globalTypes: globalTypeCache
        )

        if dropsAdded > 0 {
            print("DEBUG_STACK: Inserting \(dropsAdded) drop(s) to achieve target delta \(targetDelta)")
        }

        return balanced
    }

    /// Reset stack validator for new function
    public func resetStackValidator(returnType: WASMType = .void) {
        localTypeCache.removeAll()
        globalTypeCache.removeAll()

        let returnTypes: [WASMType] = returnType == .void ? [] : [returnType]
        stackValidator?.reset(returnTypes: returnTypes)
    }

    /// Get stack validation report
    public func getStackValidationReport() -> [String] {
        return stackValidator?.errors ?? []
    }

    /// Check if stack validation passed
    public func isStackValid() -> Bool {
        return stackValidator?.isValid ?? true
    }
    
    // MARK: - ValidatorTypeContext
    
    func localType(at index: Int) -> WASMType? {
        // Check cache first
        if let cached = localTypeCache[index] {
            return cached
        }
        return nil
    }
    
    func globalType(at index: Int) -> WASMType? {
        // Check cache first
        if let cached = globalTypeCache[index] {
            return cached
        }
        return nil
    }
    
    func functionSignature(at index: Int) -> (params: [WASMType], results: [WASMType])? {
        // For now, return nil - function signatures would need to be tracked separately
        // The validator will use a default assumption when signatures aren't available
        return nil
    }
}
