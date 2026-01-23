
//
//  IREmitter.swift
//  Blitz3DCompiler
//
//  Emits WASM instructions from typed IR representation
//

import Foundation

public final class IREmitter {
    private var wasmModule: WASMModule
    private var typeIndexMap: [String: Int] = [:]
    private var functionIndexMap: [String: Int] = [:]
    private var globalIndexMap: [String: Int] = [:]
    private var stringLiterals: [String: Int32] = [:]
    private var nextStringAddress: Int32 = 1024
    
    public init() {
        self.wasmModule = WASMModule()
        setupRuntimeImports()
    }
    
    private func setupRuntimeImports() {
        wasmModule.imports.append(WASMImport(module: "blitz3d", name: "print", kind: .function, index: 0))
        wasmModule.imports.append(WASMImport(module: "blitz3d", name: "input", kind: .function, index: 1))
        wasmModule.imports.append(WASMImport(module: "blitz3d", name: "abort", kind: .function, index: 2))
        wasmModule.types.append(WASMFunctionType(parameters: [.i32], results: []))
        wasmModule.types.append(WASMFunctionType(parameters: [], results: [.i32]))
        wasmModule.types.append(WASMFunctionType(parameters: [], results: []))
        wasmModule.functions = [0, 1, 2]
    }
    
    public func emit(module irModule: IRModule) -> WASMModule {
        emitGlobals(from: irModule)
        emitFunctions(from: irModule)
        emitData(from: irModule)
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
            globalIndexMap[name] = wasmModule.globals.count - 1
        }
        
        for (name, _, _) in irModule.imports {
            let wasmType: WASMType = .i32
            let initExpr: WASMInitExpression = .i32Const(0)
            wasmModule.globals.append(WASMGlobal(type: wasmType, mutability: true, initExpr: initExpr))
            globalIndexMap[name] = wasmModule.globals.count - 1
        }
    }
    
    private func emitFunctions(from irModule: IRModule) {
        for irFunc in irModule.functions {
            let wasmFunc = emitFunction(irFunc)
            wasmModule.code.append(wasmFunc)
            wasmModule.functionNames.append(irFunc.name)
            functionIndexMap[irFunc.name] = wasmModule.functions.count + wasmModule.code.count - 1
        }
    }
    
    private func emitFunction(_ irFunc: IRFunction) -> WASMFunction {
        let paramTypes = irFunc.parameters.map { irTypeToWASM($0.1) }
        let returnType = irTypeToWASM(irFunc.returnType)
        let results = returnType == .void ? [] : [returnType]
        
        let typeIndex = getOrCreateFunctionType(parameters: paramTypes, results: results)
        wasmModule.functions.append(typeIndex)
        
        var locals: [WASMType] = []
        // irFunc.locals includes parameters at the beginning, so we skip them for WASMFunction locals
        if irFunc.locals.count > irFunc.parameters.count {
            for i in irFunc.parameters.count..<irFunc.locals.count {
                locals.append(irTypeToWASM(irFunc.locals[i].1))
            }
        }
        
        var body: [WASMInstruction] = []
        for effect in irFunc.body {
            body.append(contentsOf: emitEffect(effect))
        }
        
        if irFunc.returnType == .void {
            body.append(.return)
        }
        
        return WASMFunction(typeIndex: typeIndex, locals: locals, body: body)
    }
    
    private func emitEffect(_ effect: IREffect) -> [WASMInstruction] {
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
            return emitValue(value) + [.globalSet(globalIndexMap[target] ?? 0)]
            
        case .assignLocal(let index, let value):
            return emitValue(value) + [.localSet(index)]
            
        case .assignGlobal(let index, let value):
            return emitValue(value) + [.globalSet(index)]
            
        case .assignField(let base, let fieldOffset, let fieldType, let value):
            let baseInstrs = emitValue(base)
            let valueInstrs = emitValue(value)
            let wasmType = irTypeToWASM(fieldType)
            return baseInstrs + valueInstrs + storeFieldInstrs(wasmType, fieldOffset: fieldOffset)
            
        case .assignArray(let base, let index, let elementSize, let elementType, let value):
            let baseInstrs = emitValue(base)
            let indexInstrs = emitValue(index)
            let valueInstrs = emitValue(value)
            let wasmType = irTypeToWASM(elementType)
            // Offset calculation: base + index * elementSize
            var offsetInstrs: [WASMInstruction] = indexInstrs + [.i32Const(Int32(elementSize)), .i32Mul, .i32Add]
            return baseInstrs + offsetInstrs + valueInstrs + storeArrayInstrs(wasmType, elementSize: 0)
            
        case .ifStmt(let condition, let thenBody, let elseBody):
            let condInstrs = emitValue(condition)
            var thenInstrs: [WASMInstruction] = []
            for effect in thenBody {
                thenInstrs.append(contentsOf: emitEffect(effect))
            }
            var elseInstrs: [WASMInstruction]?
            if let elseBody = elseBody {
                var temp: [WASMInstruction] = []
                for effect in elseBody {
                    temp.append(contentsOf: emitEffect(effect))
                }
                elseInstrs = temp
            }
            return condInstrs + [.if(.void, thenInstrs, elseInstrs)]
            
        case .whileStmt(let condition, let body):
            let condInstrs = emitValue(condition)
            var bodyInstrs: [WASMInstruction] = []
            for effect in body {
                bodyInstrs.append(contentsOf: emitEffect(effect))
            }
            
            return [.block(.void, [
                .loop(.void, condInstrs + [.i32EqZ, .brIf(1)] + bodyInstrs + [.br(0)])
            ])]
            
        case .forStmt(let index, let start, let end, let step, let body):
            // For loops:
            // 1. Initial assignment (start)
            // 2. Block
            // 3. Loop
            // 4. Check condition (index <= end if step > 0, index >= end if step < 0)
            // 5. Body
            // 6. Increment (index = index + step)
            // 7. Branch to Loop
            
            let startInstrs = emitValue(start)
            let endInstrs = emitValue(end)
            let stepInstrs = step.map { emitValue($0) } ?? [.i32Const(1)]
            
            var bodyInstrs: [WASMInstruction] = []
            for effect in body {
                bodyInstrs.append(contentsOf: emitEffect(effect))
            }
            
            // Simplified loop for now (assuming step is positive)
            return startInstrs + [.localSet(index), .block(.void, [
                .loop(.void, 
                    [.localGet(index)] + endInstrs + [.i32GtS, .brIf(1)] +
                    bodyInstrs +
                    [.localGet(index)] + stepInstrs + [.i32Add, .localSet(index), .br(0)]
                )
            ])]
            
        case .repeatStmt(let body, let condition):
            var bodyInstrs: [WASMInstruction] = []
            for effect in body {
                bodyInstrs.append(contentsOf: emitEffect(effect))
            }
            let condInstrs = emitValue(condition)
            
            return [.loop(.void, bodyInstrs + condInstrs + [.i32EqZ, .brIf(0)])]
            
        case .returnStmt(let value):
            if let v = value {
                return emitValue(v) + [.return]
            }
            return [.return]
            
        case .breakStmt:
            return [.br(0)]
            
        case .continueStmt:
            return [.br(0)]
            
        case .block(let label, let body):
            var instrs: [WASMInstruction] = [.block(.void, [])]
            for effect in body {
                instrs.append(contentsOf: emitEffect(effect))
            }
            instrs.append(.end)
            return instrs
            
        case .branch(let label):
            return [.br(0)]
            
        case .branchIf(let condition, let label):
            return emitValue(condition) + [.brIf(0)]
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
            
        case .localGet(let index, let type):
            return [.localGet(index)]
            
        case .globalGet(let index, let type):
            return [.globalGet(index)]
            
        case .binary(let op, let lhs, let rhs, let resultType):
            let lhsInstrs = emitValue(lhs)
            let rhsInstrs = emitValue(rhs)
            let wasmType = irTypeToWASM(resultType)
            return lhsInstrs + rhsInstrs + binaryOpInstrs(op, wasmType: wasmType)
            
        case .call(let name, let args, let resultType):
            let argInstrs = args.flatMap { emitValue($0) }
            let funcIndex = functionIndexMap[name] ?? getFunctionIndex(for: name)
            return argInstrs + [.call(funcIndex)]
            
        case .loadField(let base, let fieldOffset, let fieldType):
            let baseInstrs = emitValue(base)
            let wasmType = irTypeToWASM(fieldType)
            return baseInstrs + loadFieldInstrs(wasmType, fieldOffset: fieldOffset)
            
        case .loadArray(let base, let index, let elementSize, let elementType):
            let baseInstrs = emitValue(base)
            let indexInstrs = emitValue(index)
            let wasmType = irTypeToWASM(elementType)
            return baseInstrs + indexInstrs + loadArrayInstrs(wasmType, elementSize: elementSize)
            
        case .convert(let val, let from, let to):
            let valInstrs = emitValue(val)
            return valInstrs + conversionInstrs(from: from, to: to)
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
            
        default:
            return [.unreachable]
        }
    }
    
    private func loadFieldInstrs(_ wasmType: WASMType, fieldOffset: Int) -> [WASMInstruction] {
        switch wasmType {
        case .i32: return [.i32Load(fieldOffset, 0)]
        case .f32: return [.f32Load(fieldOffset, 0)]
        default: return [.i32Load(fieldOffset, 0)]
        }
    }
    
    private func storeFieldInstrs(_ wasmType: WASMType, fieldOffset: Int) -> [WASMInstruction] {
        switch wasmType {
        case .i32: return [.i32Store(fieldOffset, 0)]
        case .f32: return [.f32Store(fieldOffset, 0)]
        default: return [.i32Store(fieldOffset, 0)]
        }
    }
    
    private func loadArrayInstrs(_ wasmType: WASMType, elementSize: Int) -> [WASMInstruction] {
        switch wasmType {
        case .i32: return [.i32Load(0, 0)]
        case .f32: return [.f32Load(0, 0)]
        default: return [.i32Load(0, 0)]
        }
    }
    
    private func storeArrayInstrs(_ wasmType: WASMType, elementSize: Int) -> [WASMInstruction] {
        switch wasmType {
        case .i32: return [.i32Store(0, 0)]
        case .f32: return [.f32Store(0, 0)]
        default: return [.i32Store(0, 0)]
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
        if let idx = functionIndexMap[name] {
            return idx
        }
        return 0
    }
}
