
//
//  IREmitter.swift
//  Blitz3DCompiler
//
//  Emits WASM instructions from typed IR representation
//

import Foundation

public final class IREmitter {
    private var wasmModule: WASMModule
    private var typeMetadataMap: [String: IRTypeInfo] = [:]
    private var context: ModuleContext?
    private var functionIndexMap: [String: Int] = [:]
    private var globalIndexMap: [String: Int] = [:]
    private var currentFunc: IRFunction?
    private var debugFunctionSpans: [String: SourceSpan] = [:]
    
    public init(module: WASMModule? = nil, context: ModuleContext? = nil) {
        self.context = context
        self.debugFunctionSpans = context?.debugFunctionSpans ?? [:]
        if let m = module {
            self.wasmModule = m
            rebuildIndexMaps()
        } else {
            self.wasmModule = WASMModule()
            setupRuntimeImports()
        }
    }
    
    private func rebuildIndexMaps() {
        // Rebuild function index map from existing imports
        var funcIndex = 0
        for imp in wasmModule.imports {
            if case .function = imp.kind {
                functionIndexMap[imp.name.lowercased()] = funcIndex
                funcIndex += 1
            }
        }
        
        // Rebuild from existing functions (if any)
        for (i, _) in wasmModule.code.enumerated() {
             // We generally assume no code yet, but if there were:
             if i < wasmModule.functionNames.count {
                 functionIndexMap[wasmModule.functionNames[i].lowercased()] = funcIndex
                 funcIndex += 1
             }
        }
    }
    
    private func setupRuntimeImports() {
        // Core runtime imports
        // Index 0: PrintInt(i32) -> void
        wasmModule.imports.append(WASMImport(module: "env", name: "PrintInt", kind: .function, index: 0))
        wasmModule.types.append(WASMFunctionType(parameters: [.i32], results: []))
        functionIndexMap["printint"] = 0
        
        // Index 1: PrintString(i32) -> void
        wasmModule.imports.append(WASMImport(module: "env", name: "PrintString", kind: .function, index: 1))
        wasmModule.types.append(WASMFunctionType(parameters: [.i32], results: []))
        functionIndexMap["printstring"] = 1
        
        // Index 2: __bb_new_object(size: i32, head: i32, tail: i32) -> ptr: i32
        wasmModule.imports.append(WASMImport(module: "env", name: "__bb_new_object", kind: .function, index: 2))
        wasmModule.types.append(WASMFunctionType(parameters: [.i32, .i32, .i32], results: [.i32]))
        functionIndexMap["__bb_new_object"] = 2
        
        // Index 3: __bb_delete_object(ptr: i32) -> void
        wasmModule.imports.append(WASMImport(module: "env", name: "__bb_delete_object", kind: .function, index: 0)) // uses type 0
        functionIndexMap["__bb_delete_object"] = 3
    }
    
    public func emit(module irModule: IRModule) -> WASMModule {
        self.typeMetadataMap = irModule.types
        emitGlobals(from: irModule)
        emitFunctions(from: irModule)
        emitData(from: irModule)
        
        // Export memory
        wasmModule.exports.append(WASMExport(name: "memory", kind: .memory, index: 0))
        
        return wasmModule
    }
    
    private func emitData(from irModule: IRModule) {
        for dataSegment in irModule.data {
            wasmModule.data.append(WASMData(memoryIndex: 0, offset: .i32Const(dataSegment.offset), bytes: Array(dataSegment.data)))
        }
    }
    
    private func emitGlobals(from irModule: IRModule) {
        for (name, type, _) in irModule.globals {
            let wasmType = irTypeToWASM(type)
            let initExpr: WASMInitExpression = .i32Const(0)
            wasmModule.globals.append(WASMGlobal(type: wasmType, mutability: true, initExpr: initExpr))
            globalIndexMap[name.lowercased()] = wasmModule.globals.count - 1
        }
    }
    
    private func emitFunctions(from irModule: IRModule) {
        for irFunc in irModule.functions {
            let wasmFunc = emitFunction(irFunc)
            wasmModule.code.append(wasmFunc)
            wasmModule.functionNames.append(irFunc.name)
            
            let funcIdx = wasmModule.imports.count + wasmModule.code.count - 1
            functionIndexMap[irFunc.name.lowercased()] = funcIdx
            
            // Export the function
            // Use original name for export
            wasmModule.exports.append(WASMExport(name: irFunc.name, kind: .function, index: funcIdx))
            
            // Also export "main" as "main" if it's named "Main" for consistency
            if irFunc.name == "Main" {
                 wasmModule.exports.append(WASMExport(name: "main", kind: .function, index: funcIdx))
            }
        }
    }
    
    private func emitFunction(_ irFunc: IRFunction) -> WASMFunction {
        let paramTypes = irFunc.parameters.map { irTypeToWASM($0.1) }
        let returnType = irTypeToWASM(irFunc.returnType)
        let results = returnType == .void ? [] : [returnType]
        
        let typeIndex = getOrCreateFunctionType(parameters: paramTypes, results: results)
        wasmModule.functions.append(typeIndex)
        
        // `IRFunction.locals` does not include parameters, but IR local indices do.
        // WASM locals are declared separately from parameters, so we must declare *all*
        // locals in their original order, without skipping by parameter count.
        let locals: [WASMType] = irFunc.locals.map { irTypeToWASM($0.1) }
        
        self.currentFunc = irFunc
        
        var body: [WASMInstruction] = []
        var debugFuncId: Int?
        if let gen = context?.debugGenerator,
           let indices = context?.debugIndices,
           let span = debugFunctionSpans[irFunc.name.lowercased()] {
            let signature = functionSignature(for: irFunc)
            let funcId = gen.registerFunction(name: irFunc.name, signature: signature, span: span)
            debugFuncId = funcId
            let enterSeq: [WASMInstruction] = [
                .i32Const(Int32(funcId)),
                .call(indices.enter)
            ]
            body.append(.sourceLocation(span, .block(.void, enterSeq)))
        }

        for effect in irFunc.body {
            var labelStack: [LabelFrame] = []
            body.append(contentsOf: emitEffect(effect, labelStack: &labelStack))
        }
        
        self.currentFunc = nil

        // Ensure all functions end with a valid return sequence.
        if body.last != .return {
            switch irFunc.returnType {
            case .void:
                body.append(.return)
            case .i32:
                body.append(.i32Const(0))
                body.append(.return)
            case .f32:
                body.append(.f32Const(0))
                body.append(.return)
            }
        }

        if let funcId = debugFuncId, let indices = context?.debugIndices {
            body = injectDebugLeave(body, leaveIdx: indices.leave, funcId: funcId)
        }
        
        return WASMFunction(typeIndex: typeIndex, locals: locals, body: body)
    }

    private func functionSignature(for function: IRFunction) -> String {
        let paramTypes = function.parameters.map { irTypeToWASM($0.1).rawValue }
        let returnType = irTypeToWASM(function.returnType)
        let result = returnType == .void ? "void" : returnType.rawValue
        return "(\(paramTypes.joined(separator: ", "))) -> \(result)"
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
                    result.append(.sourceLocation(span, .block(.void, processed)))
                }
            default:
                result.append(instr)
            }
        }
        return result
    }
    
    private struct LabelFrame {
        enum Kind {
            case block
            case loop
        }
        
        let label: String
        let kind: Kind
    }
    
    private func depth(toLabel label: String, in labelStack: [LabelFrame]) -> Int? {
        guard let idx = labelStack.lastIndex(where: { $0.label == label }) else { return nil }
        return (labelStack.count - 1) - idx
    }
    
    private func nearestLoopIndex(in labelStack: [LabelFrame]) -> Int? {
        return labelStack.lastIndex(where: { $0.kind == .loop })
    }
    
    private func nearestBreakTargetDepth(in labelStack: [LabelFrame]) -> Int? {
        guard let loopIdx = nearestLoopIndex(in: labelStack) else { return nil }
        
        // Prefer the nearest block frame that encloses the loop, to break out of the loop.
        // (In WASM, `br` to a loop continues; to break, you branch to an outer block.)
        if loopIdx > 0 {
            if let blockIdx = labelStack[0..<loopIdx].lastIndex(where: { $0.kind == .block }) {
                return (labelStack.count - 1) - blockIdx
            }
        }
        
        // Fallback: jump one level beyond the loop itself.
        return (labelStack.count - 1) - loopIdx + 1
    }
    
    private func nearestContinueTargetDepth(in labelStack: [LabelFrame]) -> Int? {
        guard let loopIdx = nearestLoopIndex(in: labelStack) else { return nil }
        return (labelStack.count - 1) - loopIdx
    }
    
    private func emitEffect(_ effect: IREffect, labelStack: inout [LabelFrame]) -> [WASMInstruction] {
        switch effect {
        case .nop:
            return []
            
        case .discard(let value):
            var instructions = emitValue(value)
            if value.type != .void {
                instructions.append(.drop)
            }
            return instructions
            
        case .assign(let target, let value):
            return emitValue(value) + [.globalSet(globalIndexMap[target.lowercased()] ?? 0)]
            
        case .assignLocal(let index, let value):
            validateLocalIndex(index)
            return emitValue(value) + [.localSet(index)]
            
        case .assignGlobal(let index, let value):
            return emitValue(value) + [.globalSet(index)]
            
        case .assignField(let base, let fieldOffset, let fieldType, let value):
            let baseInstrs = emitValue(base)
            let valueInstrs = emitValue(value)
            let store = storeInstruction(type: fieldType, align: naturalAlignExponent(for: fieldType), offset: fieldOffset)
            return baseInstrs + valueInstrs + [store]
            
        case .assignArray(let base, let index, let elementSize, let elementType, let value):
            let baseInstrs = emitValue(base)
            let indexInstrs = emitValue(index)
            let valueInstrs = emitValue(value)
            let addrInstrs: [WASMInstruction] = baseInstrs + indexInstrs + [.i32Const(Int32(elementSize)), .i32Mul, .i32Add]
            let store = storeInstruction(type: elementType, align: alignExponent(forElementSize: elementSize, cappedToNaturalFor: elementType), offset: 0)
            return addrInstrs + valueInstrs + [store]
            
        case .delete(let value):
            return emitValue(value) + [.call(getFunctionIndex(for: "__bb_delete_object"))]
            
        case .ifStmt(let condition, let thenBody, let elseBody):
            let condInstrs = emitValue(condition)
            let thenInstrs = thenBody.flatMap { emitEffect($0, labelStack: &labelStack) }
            let elseInstrs = elseBody?.flatMap { emitEffect($0, labelStack: &labelStack) }
            return condInstrs + [.if(.void, thenInstrs, elseInstrs)]
            
        case .whileStmt(let condition, let body):
            let condInstrs = emitValue(condition)
            
            // Provide a predictable loop structure for `break`/`continue`.
            let exitLabel = "__while_exit"
            let loopLabel = "__while_loop"
            
            labelStack.append(LabelFrame(label: exitLabel, kind: .block))
            labelStack.append(LabelFrame(label: loopLabel, kind: .loop))
            let bodyInstrs = body.flatMap { emitEffect($0, labelStack: &labelStack) }
            _ = labelStack.popLast()
            _ = labelStack.popLast()
            
            return [.block(.void, [
                .loop(.void, condInstrs + [.i32EqZ, .brIf(1)] + bodyInstrs + [.br(0)])
            ])]
            
        case .forStmt(let index, let start, let end, let step, let body):
            // For loops:
            // 1. Initial assignment (start)
            // 2. Block
            // 3. Loop
            // 4. Check condition
            // 5. Body
            // 6. Increment (index = index + step)
            // 7. Branch to Loop
            
            let startInstrs = emitValue(start)
            let endInstrs = emitValue(end)
            
            // To handle both positive and negative steps, we check the sign of the step
            // If step is a constant, we can optimize. If not, we need a runtime check.
            var stepVal: Int32 = 1
            var isConstantStep = false
            if case .constI32(let s) = step {
                stepVal = s
                isConstantStep = true
            }
            
            let stepInstrs = step.map { emitValue($0) } ?? [.i32Const(1)]
            
            // Provide a predictable loop structure for `break`/`continue`.
            let exitLabel = "__for_exit"
            let loopLabel = "__for_loop"
            labelStack.append(LabelFrame(label: exitLabel, kind: .block))
            labelStack.append(LabelFrame(label: loopLabel, kind: .loop))
            let bodyInstrs = body.flatMap { emitEffect($0, labelStack: &labelStack) }
            _ = labelStack.popLast()
            _ = labelStack.popLast()
            
            var loopInstrs: [WASMInstruction] = []
            
            if isConstantStep && stepVal > 0 {
                // index > end -> exit
                loopInstrs = [.localGet(index)] + endInstrs + [.i32GtS, .brIf(1)]
            } else if isConstantStep && stepVal < 0 {
                // index < end -> exit
                loopInstrs = [.localGet(index)] + endInstrs + [.i32LtS, .brIf(1)]
            } else {
                // Runtime check: (step > 0 && index > end) || (step < 0 && index < end)
                // For now, let's stick to the constant optimization or default to positive
                loopInstrs = [.localGet(index)] + endInstrs + [.i32GtS, .brIf(1)]
            }
            
            return startInstrs + [.localSet(index), .block(.void, [
                .loop(.void, 
                    loopInstrs +
                    bodyInstrs +
                    [.localGet(index)] + stepInstrs + [.i32Add, .localSet(index), .br(0)]
                )
            ])]
            
        case .repeatStmt(let body, let condition):
            // Provide a predictable loop structure for `break`/`continue`.
            let exitLabel = "__repeat_exit"
            let loopLabel = "__repeat_loop"
            labelStack.append(LabelFrame(label: exitLabel, kind: .block))
            labelStack.append(LabelFrame(label: loopLabel, kind: .loop))
            let bodyInstrs = body.flatMap { emitEffect($0, labelStack: &labelStack) }
            _ = labelStack.popLast()
            _ = labelStack.popLast()
            let condInstrs = emitValue(condition)
            
            return [.block(.void, [
                .loop(.void, bodyInstrs + condInstrs + [.i32EqZ, .brIf(0)])
            ])]
            
        case .returnStmt(let value):
            if let v = value {
                return emitValue(v) + [.return]
            } else if let f = currentFunc, f.returnType != .void {
                // If function expects a return value but none provided, push default
                switch f.returnType {
                case .i32: return [.i32Const(0), .return]
                case .f32: return [.f32Const(0), .return]
                case .void: return [.return]
                }
            }
            return [.return]
            
        case .breakStmt:
            if let depth = nearestBreakTargetDepth(in: labelStack) {
                return [.br(depth)]
            }
            return [.br(0)]
            
        case .continueStmt:
            if let depth = nearestContinueTargetDepth(in: labelStack) {
                return [.br(depth)]
            }
            return [.br(0)]
            
        case .block(let label, let body):
            labelStack.append(LabelFrame(label: label, kind: .block))
            let bodyInstrs = body.flatMap { emitEffect($0, labelStack: &labelStack) }
            _ = labelStack.popLast()
            return [.block(.void, bodyInstrs)]
            
        case .loop(let label, let body):
            labelStack.append(LabelFrame(label: label, kind: .loop))
            let bodyInstrs = body.flatMap { emitEffect($0, labelStack: &labelStack) }
            _ = labelStack.popLast()
            return [.loop(.void, bodyInstrs)]
            
        case .selectStmt(let value, let cases, let defaultCase):
            // Emit as br_table for O(1) state machine dispatch
            // selectStmt(value, [(0, body0), (1, body1), ...], default)
            //
            // WASM structure:
            //   block $exit
            //     block $case_n
            //       block $case_n-1
            //         ...
            //         block $case_0
            //           block $default
            //             value
            //             br_table $case_0 $case_1 ... $case_n $default
            //           end ;; $default
            //           <default body>
            //           br $exit
            //         end ;; $case_0
            //         <case 0 body>
            //         br $exit
            //       end ;; $case_1
            //       <case 1 body>
            //       br $exit
            //     end ;; $case_n
            //     <case n body>
            //   end ;; $exit
            
            if cases.isEmpty {
                return defaultCase?.flatMap { emitEffect($0, labelStack: &labelStack) } ?? []
            }
            
            // Sort cases by state ID to build contiguous table
            let sortedCases = cases.sorted { $0.0 < $1.0 }
            
            // Find max state ID
            let maxStateId = Int(sortedCases.last?.0 ?? 0)
            
            // Build br_table targets array (index -> block depth)
            // Block 0 is default, blocks 1..n are cases
            // br_table targets[i] = depth to reach case i's block
            
            // We'll use a simpler structure:
            // block $exit {
            //   block $default { block $0 { block $1 { ... value, br_table ... } case_n } ... case_0 } default
            // }
            
            // Depth calculation: innermost block is at depth 0
            // We have: exit(outermost), then case blocks from high to low, then default(innermost)
            // Total blocks = 1 (exit) + numCases + 1 (default)
            
            let numCases = sortedCases.count
            let exitDepth = numCases + 1  // To break out completely
            
            // Build target array: for each possible state 0..maxStateId
            var targets: [Int] = []
            var stateToDepth: [Int32: Int] = [:]
            
            // Case blocks are numbered from innermost:
            // - default block = depth 0
            // - case with highest stateId = depth 1
            // - case with second highest = depth 2
            // ... etc
            for (i, (stateId, _)) in sortedCases.enumerated().reversed() {
                // Case i (from sorted) gets depth (numCases - i)
                stateToDepth[stateId] = numCases - i
            }
            
            // Build contiguous target array
            for i in 0...maxStateId {
                if let depth = stateToDepth[Int32(i)] {
                    targets.append(depth)
                } else {
                    targets.append(0)  // Unknown state goes to default
                }
            }
            
            let defaultDepth = 0
            let valueInstrs = emitValue(value)
            
            // Build nested blocks from inside out
            // Innermost: default block with br_table
            var result: [WASMInstruction] = valueInstrs + [.brTable(targets, defaultDepth)]
            
            // Wrap default block
            let defaultBody = defaultCase?.flatMap { emitEffect($0, labelStack: &labelStack) } ?? []
            result = [.block(.void, result)] + defaultBody + [.br(numCases)]
            
            // Wrap case blocks (from highest stateId to lowest)
            for i in (0..<numCases).reversed() {
                let (_, caseBody) = sortedCases[i]
                let bodyInstrs = caseBody.flatMap { emitEffect($0, labelStack: &labelStack) }
                // Depth to exit: we're inside (numCases - i) blocks at this point
                // Need to break to exit block which is at depth (numCases - i)
                result = [.block(.void, result)] + bodyInstrs + [.br(numCases - i)]
            }
            
            // Wrap exit block
            result = [.block(.void, result)]
            
            return result
            
        case .branch(let label):
            if let depth = depth(toLabel: label, in: labelStack) {
                return [.br(depth)]
            }
            return [.br(0)]
            
        case .branchIf(let condition, let label):
            if let depth = depth(toLabel: label, in: labelStack) {
                return emitValue(condition) + [.brIf(depth)]
            }
            return emitValue(condition) + [.brIf(0)]
            
        case .label:
            return []
        }
    }
    
    private func emitValue(_ value: IRValue) -> [WASMInstruction] {
        switch value {
        case .constI32(let val):
            return [.i32Const(val)]
            
        case .constF32(let val):
            return [.f32Const(val)]
            
        case .constStringPtr(let ptr):
            return [.i32Const(ptr)]
            
        case .localGet(let index, _):
            validateLocalIndex(index)
            return [.localGet(index)]
            
        case .globalGet(let index, _):
            return [.globalGet(index)]
            
        case .binary(let op, let lhs, let rhs, let resultType):
            let lhsInstrs = emitValue(lhs)
            let rhsInstrs = emitValue(rhs)
            let isIntegerOnly = op == "And" || op == "Or" || op == "Xor" || op == "Shl" || op == "Shr" || op == "mod"
            let opcodeType: WASMType
            if isIntegerOnly {
                opcodeType = .i32
            } else if lhs.type == .f32 || rhs.type == .f32 {
                opcodeType = .f32
            } else {
                opcodeType = .i32
            }
            _ = resultType // kept for IR typing, but opcode selection depends on operand types
            return lhsInstrs + rhsInstrs + binaryOpInstrs(op, wasmType: opcodeType)
            
        case .call(let name, let args, _):
            let argInstrs = args.flatMap { emitValue($0) }
            let funcIndex = functionIndexMap[name.lowercased()] ?? getFunctionIndex(for: name)
            return argInstrs + [.call(funcIndex)]
            
        case .loadField(let base, let fieldOffset, let fieldType):
            let load = loadInstruction(type: fieldType, align: naturalAlignExponent(for: fieldType), offset: fieldOffset)
            return emitValue(base) + [load]
            
        case .loadArray(let base, let index, let elementSize, let elementType):
            let baseInstrs = emitValue(base)
            let indexInstrs = emitValue(index)
            let addrInstrs: [WASMInstruction] = baseInstrs + indexInstrs + [.i32Const(Int32(elementSize)), .i32Mul, .i32Add]
            let load = loadInstruction(type: elementType, align: alignExponent(forElementSize: elementSize, cappedToNaturalFor: elementType), offset: 0)
            return addrInstrs + [load]
            
        case .convert(let val, let from, let to):
            return emitValue(val) + conversionInstrs(from: from, to: to)
            
        case .first(let typeName):
            guard let typeInfo = typeMetadataMap[typeName.lowercased()] else { return [.i32Const(0)] }
            return [.globalGet(typeInfo.headGlobalIndex)]
            
        case .last(let typeName):
            guard let typeInfo = typeMetadataMap[typeName.lowercased()] else { return [.i32Const(0)] }
            return [.globalGet(typeInfo.tailGlobalIndex)]
            
        case .before(let value):
            // Linked-list header layout: [prev:i32, next:i32]
            return emitValue(value) + [.i32Load(2, 0)]
            
        case .after(let value):
            // Linked-list header layout: [prev:i32, next:i32]
            return emitValue(value) + [.i32Load(2, 4)]
            
        case .handle(let value):
            return emitValue(value)
            
        case .objectCast(_, let value):
            return emitValue(value)
            
        case .new(let typeName):
            guard let typeInfo = typeMetadataMap[typeName.lowercased()] else { return [.unreachable] }
            return [
                .i32Const(Int32(typeInfo.totalSize)),
                .i32Const(Int32(typeInfo.headGlobalIndex)),
                .i32Const(Int32(typeInfo.tailGlobalIndex)),
                .call(getFunctionIndex(for: "__bb_new_object"))
            ]
        }
    }

    private func naturalAlignExponent(for irType: IRType) -> Int {
        switch irType {
        case .i32, .f32:
            return 2 // 4-byte alignment
        case .void:
            return 0
        }
    }

    private func alignExponent(forElementSize elementSize: Int, cappedToNaturalFor irType: IRType) -> Int {
        guard elementSize > 0 else { return 0 }

        // WASM memarg alignment is the log2 of the alignment in bytes.
        // Validators also require it not exceed the natural alignment for the instruction.
        let requested: Int
        if elementSize & (elementSize - 1) == 0 {
            var tmp = elementSize
            var exp = 0
            while tmp > 1 {
                tmp >>= 1
                exp += 1
            }
            requested = exp
        } else {
            requested = 0
        }

        return min(requested, naturalAlignExponent(for: irType))
    }

    private func loadInstruction(type: IRType, align: Int, offset: Int) -> WASMInstruction {
        switch type {
        case .f32:
            return .f32Load(align, offset)
        case .i32, .void:
            return .i32Load(align, offset)
        }
    }

    private func storeInstruction(type: IRType, align: Int, offset: Int) -> WASMInstruction {
        switch type {
        case .f32:
            return .f32Store(align, offset)
        case .i32, .void:
            return .i32Store(align, offset)
        }
    }
    
    private func binaryOpInstrs(_ op: String, wasmType: WASMType) -> [WASMInstruction] {
        switch (op, wasmType) {
        case ("+", .i32): return [.i32Add]
        case ("-", .i32): return [.i32Sub]
        case ("*", .i32): return [.i32Mul]
        case ("/", .i32): return [.i32DivS]
        case ("mod", .i32): return [.i32RemS]
        case ("And", .i32): return [.i32And]
        case ("Or", .i32): return [.i32Or]
        case ("Xor", .i32): return [.i32Xor]
        case ("Shl", .i32): return [.i32Shl]
        case ("Shr", .i32): return [.i32ShrS]
        case ("=", .i32): return [.i32Eq]
        case ("<>", .i32): return [.i32Ne]
        case ("<", .i32): return [.i32LtS]
        case (">", .i32): return [.i32GtS]
        case ("<=", .i32): return [.i32LeS]
        case (">=", .i32): return [.i32GeS]
        case ("+", .f32): return [.f32Add]
        case ("-", .f32): return [.f32Sub]
        case ("*", .f32): return [.f32Mul]
        case ("/", .f32): return [.f32Div]
        case ("=", .f32): return [.f32Eq]
        case ("<>", .f32): return [.f32Ne]
        case ("<", .f32): return [.f32Lt]
        case (">", .f32): return [.f32Gt]
        case ("<=", .f32): return [.f32Le]
        case (">=", .f32): return [.f32Ge]
        default: return [.unreachable]
        }
    }
    
    private func conversionInstrs(from: IRType, to: IRType) -> [WASMInstruction] {
        switch (from, to) {
        case (.i32, .f32): return [.f32ConvertI32S]
        case (.f32, .i32): return [.i32TruncF32S]
        default: return []
        }
    }
    
    private func irTypeToWASM(_ irType: IRType) -> WASMType {
        switch irType {
        case .i32: return .i32
        case .f32: return .f32
        case .void: return .void
        }
    }
    
    private func getOrCreateFunctionType(parameters: [WASMType], results: [WASMType]) -> Int {
        let type = WASMFunctionType(parameters: parameters, results: results)
        for (index, existingType) in wasmModule.types.enumerated() {
            if existingType.parameters == type.parameters && existingType.results == type.results {
                return index
            }
        }
        wasmModule.types.append(type)
        return wasmModule.types.count - 1
    }
    
    private func getFunctionIndex(for name: String) -> Int {
        let lower = name.lowercased()
        if let idx = functionIndexMap[lower] {
            return idx
        }
        if let context = context, let idx = context.functionIndexMap[lower] {
            return idx
        }
        return 0
    }

    private func validateLocalIndex(_ index: Int) {
        guard let f = currentFunc else { return }
        let maxIdx = f.parameters.count + f.locals.count
        if index < 0 || index >= maxIdx {
            // This is a compiler bug indicator
            print("FATAL: IR local index \(index) out of range (max \(maxIdx-1)) in function \(f.name)")
        }
    }
}
