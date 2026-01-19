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
    
    // GOSUB support
    private var gosubReturnCounter: Int = 0
    private var gosubReturnMap: [Int: [WASMInstruction]] = [:]

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
        self.gosubReturnCounter = 0
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
                } else {
                    // Auto-declare implicit variable as global (Blitz3D behavior)
                    print("DEBUG_COMPILER: Auto-declaring implicit variable '\(id.name)' as global")
                    let wasmType = targetType
                    
                    // Register actual WASM global and track in VariableManagement
                    let actualGlobalIdx = context.registerGlobal(type: wasmType, mutability: true, initExpr: .i32Const(0))
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
                }
            default:
                break
            }
            
        case .functionCall(let call):
            let lowerName = call.name.lowercased()
            
            // Generate argument instructions
            var argInstrs: [WASMInstruction] = []
            let def = context.functionDefinitions[lowerName]
            
            for (i, arg) in call.arguments.enumerated() {
                let argResult = expressionGenerator?.generateWithInfo(arg) ?? ([], .i32)
                argInstrs.append(contentsOf: argResult.instrs)
                
                // Implicit casting if function definition exists
                if let def = def, i < def.params.count {
                    argInstrs.append(contentsOf: convert(from: argResult.type, to: def.params[i]))
                }
            }
            
            // Push default values for missing optional parameters
            if let def = def, call.arguments.count < def.params.count {
                for i in call.arguments.count..<def.params.count {
                    let targetType = def.params[i]
                    switch targetType {
                    case .i32, .i64: argInstrs.append(.i32Const(0))
                    case .f32: argInstrs.append(.f32Const(0))
                    case .f64: argInstrs.append(.f64Const(0))
                    default: argInstrs.append(.i32Const(0))
                    }
                }
            }
            
            if let funcIdx = context.functionIndexMap[lowerName] {
                function.body.append(contentsOf: argInstrs)
                function.body.append(.call(funcIdx))

                // If the function returns a value, drop it since it's being used as a statement
                if let def = def, !def.results.isEmpty {
                    function.body.append(.drop)
                }
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
                let thenBody = generateStatementBlock(thenBranch, function: &function)
                currentDepth -= 1

                var elseBody: [WASMInstruction]? = nil
                if let (nextCondition, nextThenBranch) = elseIfs.first {
                    elseBody = buildIfChain(condition: nextCondition,
                                           thenBranch: nextThenBranch,
                                           elseIfs: Array(elseIfs.dropFirst()),
                                           elseBranch: elseBranch)
                } else if !elseBranch.isEmpty {
                    currentDepth += 1
                    elseBody = generateStatementBlock(elseBranch, function: &function)
                    currentDepth -= 1
                }

                result.append(.if(.void, thenBody, elseBody))
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
                    loopInstrs.append(.if(.void, [
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
            let bodyInstrs = generateStatementBlock(forEachNode.body, function: &function)
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
            // Generate: if (selectExpr == case1_1 || selectExpr == case1_2 || ...) { case1_body }
            //          else if (selectExpr == case2_1 || ...) { case2_body }
            //          ...
            //          else { default_body }

            // Generate select expression and save to scratch global
            let selectExprInstrs = expressionGenerator?.generate(selectNode.expression) ?? []
            function.body.append(contentsOf: selectExprInstrs)
            function.body.append(.globalSet(context.scratchGlobalIdx))

            // Build a chain of if-else blocks for proper Select behavior
            var allCaseInstrs: [WASMInstruction] = []

            for caseNode in selectNode.cases {
                // Build match condition for this case
                var conditionInstrs: [WASMInstruction] = []

                for (valueIndex, caseValue) in caseNode.values.enumerated() {
                    switch caseValue {
                    case .single(let caseExpr):
                        // Load select expression
                        conditionInstrs.append(.globalGet(context.scratchGlobalIdx))
                        // Generate case expression
                        let caseExprInstrs = expressionGenerator?.generate(caseExpr) ?? []
                        conditionInstrs.append(contentsOf: caseExprInstrs)
                        // Compare: select == value
                        conditionInstrs.append(.i32Eq)

                    case .range(let fromExpr, let toExpr):
                        // Generate: (select >= from) && (select <= to)
                        // Part 1: select >= from
                        conditionInstrs.append(.globalGet(context.scratchGlobalIdx))
                        let fromInstrs = expressionGenerator?.generate(fromExpr) ?? []
                        conditionInstrs.append(contentsOf: fromInstrs)
                        conditionInstrs.append(.i32GeS)
                        // Part 2: select <= to
                        conditionInstrs.append(.globalGet(context.scratchGlobalIdx))
                        let toInstrs = expressionGenerator?.generate(toExpr) ?? []
                        conditionInstrs.append(contentsOf: toInstrs)
                        conditionInstrs.append(.i32LeS)
                        // Combine: AND
                        conditionInstrs.append(.i32And)
                    }

                    // OR with previous conditions
                    if valueIndex > 0 {
                        conditionInstrs.append(.i32Or)
                    }
                }

                // Generate case body
                let caseBodyInstrs = generateStatementBlock(caseNode.body, function: &function)

                // Wrap in if: if (condition) { body }
                allCaseInstrs.append(contentsOf: conditionInstrs)
                allCaseInstrs.append(.if(.void, caseBodyInstrs, nil))
            }

            function.body.append(contentsOf: allCaseInstrs)

            // Default case
            if let defaultCase = selectNode.defaultCase {
                let defaultBodyInstrs = generateStatementBlock(defaultCase, function: &function)
                function.body.append(contentsOf: defaultBodyInstrs)
            }
            
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
