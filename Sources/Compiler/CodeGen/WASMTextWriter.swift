//
//  WASMTextWriter.swift
//  Blitz3DCompiler
//
//  Writes WebAssembly modules in text format (.wat)
//

public struct WASMTextWriter {
    private var indentLevel = 0
    private let indentString = "    "
    
    public init() {}
    
    public mutating func write(_ module: WASMModule) -> String {
        var output = "(module\n"
        
        for (index, type) in module.types.enumerated() {
            output += writeType(index: index, type: type)
        }
        
        for (index, imp) in module.imports.enumerated() {
            output += writeImport(index: index, imp: imp)
        }
        
        for table in module.tables {
            output += writeTable(table: table)
        }
        
        for memory in module.memories {
            output += writeMemory(memory: memory)
        }
        
        for global in module.globals {
            output += writeGlobal(global: global)
        }
        
        for exp in module.exports {
            output += writeExport(exp: exp)
        }
        
        // Write functions (declarations + bodies)
        for (index, typeIdx) in module.functions.enumerated() {
            if index < module.code.count {
                let funcBody = module.code[index]
                output += writeFunctionBody(index: index + module.imports.count, typeIndex: typeIdx, function: funcBody)
            } else {
                // Declaration only? (Should not happen with current CodeGenerator)
                output += "  (func \(index + module.imports.count) (type \(typeIdx)))\n"
            }
        }
        
        for data in module.data {
            output += writeData(data: data)
        }
        
        output += ")\n"
        return output
    }
    
    private mutating func writeType(index: Int, type: WASMFunctionType) -> String {
        let params = type.parameters.map { $0.rawValue }.joined(separator: " ")
        let results = type.results.map { $0.rawValue }.joined(separator: " ")
        let resStr = results.isEmpty ? "" : " (result \(results))"
        return "  (type \(index) (func (param \(params))\(resStr)))\n"
    }
    
    private mutating func writeImport(index: Int, imp: WASMImport) -> String {
        let kindStr: String
        switch imp.kind {
        case .function: kindStr = "func \(index) (type \(imp.index))"
        case .table: kindStr = "table \(imp.index)"
        case .memory: kindStr = "memory \(imp.index)"
        case .global: kindStr = "global \(imp.index)"
        }
        return "  (import \"\(imp.module)\" \"\(imp.name)\" (\(kindStr)))\n"
    }
    
    private mutating func writeFunction(funcIndex: Int, typeIndex: Int) -> String {
        return "  (func \(funcIndex) (type \(typeIndex)))\n"
    }
    
    private mutating func writeTable(table: WASMTable) -> String {
        let maxStr = table.maximum.map { " \($0)" } ?? ""
        return "  (table \(table.initial)\(maxStr) \(table.elementType.rawValue))\n"
    }
    
    private mutating func writeMemory(memory: WASMMemory) -> String {
        let maxStr = memory.maximum.map { " \($0)" } ?? ""
        return "  (memory \(memory.initial)\(maxStr))\n"
    }
    
    private mutating func writeGlobal(global: WASMGlobal) -> String {
        let mutStr = global.mutability ? " (mut \(global.type.rawValue))" : " \(global.type.rawValue)"
        let initStr = writeInitExpr(expr: global.initExpr)
        return "  (global\(mutStr)\(initStr))\n"
    }
    
    private mutating func writeExport(exp: WASMExport) -> String {
        let kindStr: String
        switch exp.kind {
        case .function: kindStr = "func"
        case .table: kindStr = "table"
        case .memory: kindStr = "memory"
        case .global: kindStr = "global"
        }
        return "  (export \"\(exp.name)\" (\(kindStr) \(exp.index)))\n"
    }
    
    private mutating func writeFunctionBody(index: Int, typeIndex: Int, function: WASMFunction) -> String {
        indentLevel += 1
        var output = "  (func \(index) (type \(typeIndex))\n"
        
        if !function.locals.isEmpty {
            output += "    (local"
            for local in function.locals {
                output += " \(local.rawValue)"
            }
            output += ")\n"
        }
        
        for instruction in function.body {
            output += writeInstruction(instruction)
        }
        
        output += "  )\n"
        indentLevel -= 1
        return output
    }
    
    private mutating func writeData(data: WASMData) -> String {
        let offsetStr = writeInitExpr(expr: data.offset)
        var hexStr = ""
        for byte in data.bytes {
            let highNibble = byte >> 4
            let lowNibble = byte & 0x0F
            let hexChars = "0123456789abcdef"
            let highChar = hexChars.index(hexChars.startIndex, offsetBy: Int(highNibble))
            let lowChar = hexChars.index(hexChars.startIndex, offsetBy: Int(lowNibble))
            hexStr.append(hexChars[highChar])
            hexStr.append(hexChars[lowChar])
            hexStr.append(" ")
        }
        if !hexStr.isEmpty {
            hexStr.removeLast()
        }
        return "  (data\(offsetStr) \"\(hexStr)\")\n"
    }
    
    private mutating func writeInitExpr(expr: WASMInitExpression) -> String {
        switch expr {
        case .i32Const(let val): return " (i32.const \(val))"
        case .i64Const(let val): return " (i64.const \(val))"
        case .f32Const(let val): return " (f32.const \(val))"
        case .f64Const(let val): return " (f64.const \(val))"
        case .globalGet(let idx): return " (global.get \(idx))"
        }
    }
    
    private mutating func writeInstruction(_ instruction: WASMInstruction) -> String {
        let prefix = String(repeating: indentString, count: indentLevel + 1)
        
        switch instruction {
        case .unreachable:
            return "\(prefix)unreachable\n"
        case .nop:
            return "\(prefix)nop\n"
        case .return:
            return "\(prefix)return\n"
        case .call(let idx):
            return "\(prefix)call \(idx)\n"
        case .callIndirect(let typeIdx, let tableIdx):
            return "\(prefix)call_indirect (type \(typeIdx)) \(tableIdx)\n"
        case .block(let type, let instrs):
            return writeBlock(keyword: "block", type: type, instructions: instrs, prefix: prefix)
        case .loop(let type, let instrs):
            return writeBlock(keyword: "loop", type: type, instructions: instrs, prefix: prefix)
        case .br(let idx):
            return "\(prefix)br \(idx)\n"
        case .brIf(let idx):
            return "\(prefix)br_if \(idx)\n"
        case .brTable(let targets, let defaultTarget):
            let targetsStr = targets.map { "\($0)" }.joined(separator: " ")
            return "\(prefix)br_table \(targetsStr) \(defaultTarget)\n"
        case .if(let type, let thenInstrs, let elseInstrs):
            return writeIf(type: type, thenInstrs: thenInstrs, elseInstrs: elseInstrs, prefix: prefix)
        case .drop:
            return "\(prefix)drop\n"
        case .select:
            return "\(prefix)select\n"
        case .localGet(let idx):
            return "\(prefix)local.get \(idx)\n"
        case .localSet(let idx):
            return "\(prefix)local.set \(idx)\n"
        case .localTee(let idx):
            return "\(prefix)local.tee \(idx)\n"
        case .globalGet(let idx):
            return "\(prefix)global.get \(idx)\n"
        case .globalSet(let idx):
            return "\(prefix)global.set \(idx)\n"
        case .tableGet(let idx):
            return "\(prefix)table.get \(idx)\n"
        case .tableSet(let idx):
            return "\(prefix)table.set \(idx)\n"
        case .i32Load(let align, let offset):
            return "\(prefix)i32.load \(align) \(offset)\n"
        case .i64Load(let align, let offset):
            return "\(prefix)i64.load \(align) \(offset)\n"
        case .f32Load(let align, let offset):
            return "\(prefix)f32.load \(align) \(offset)\n"
        case .f64Load(let align, let offset):
            return "\(prefix)f64.load \(align) \(offset)\n"
        case .i32Store(let align, let offset):
            return "\(prefix)i32.store \(align) \(offset)\n"
        case .i64Store(let align, let offset):
            return "\(prefix)i64.store \(align) \(offset)\n"
        case .f32Store(let align, let offset):
            return "\(prefix)f32.store \(align) \(offset)\n"
        case .f64Store(let align, let offset):
            return "\(prefix)f64.store \(align) \(offset)\n"
        case .memorySize:
            return "\(prefix)memory.size\n"
        case .memoryGrow:
            return "\(prefix)memory.grow\n"
        case .i32Const(let val):
            return "\(prefix)i32.const \(val)\n"
        case .i64Const(let val):
            return "\(prefix)i64.const \(val)\n"
        case .f32Const(let val):
            return "\(prefix)f32.const \(val)\n"
        case .f64Const(let val):
            return "\(prefix)f64.const \(val)\n"
        case .i32EqZ:
            return "\(prefix)i32.eqz\n"
        case .i32Eq:
            return "\(prefix)i32.eq\n"
        case .i32Ne:
            return "\(prefix)i32.ne\n"
        case .i32LtS:
            return "\(prefix)i32.lt_s\n"
        case .i32LtU:
            return "\(prefix)i32.lt_u\n"
        case .i32GtS:
            return "\(prefix)i32.gt_s\n"
        case .i32GtU:
            return "\(prefix)i32.gt_u\n"
        case .i32LeS:
            return "\(prefix)i32.le_s\n"
        case .i32LeU:
            return "\(prefix)i32.le_u\n"
        case .i32GeS:
            return "\(prefix)i32.ge_s\n"
        case .i32GeU:
            return "\(prefix)i32.ge_u\n"
        case .i64EqZ:
            return "\(prefix)i64.eqz\n"
        case .i64Eq:
            return "\(prefix)i64.eq\n"
        case .i64Ne:
            return "\(prefix)i64.ne\n"
        case .i64LtS:
            return "\(prefix)i64.lt_s\n"
        case .i64LtU:
            return "\(prefix)i64.lt_u\n"
        case .i64GtS:
            return "\(prefix)i64.gt_s\n"
        case .i64GtU:
            return "\(prefix)i64.gt_u\n"
        case .i64LeS:
            return "\(prefix)i64.le_s\n"
        case .i64LeU:
            return "\(prefix)i64.le_u\n"
        case .i64GeS:
            return "\(prefix)i64.ge_s\n"
        case .i64GeU:
            return "\(prefix)i64.ge_u\n"
        case .f32Eq:
            return "\(prefix)f32.eq\n"
        case .f32Ne:
            return "\(prefix)f32.ne\n"
        case .f32Lt:
            return "\(prefix)f32.lt\n"
        case .f32Gt:
            return "\(prefix)f32.gt\n"
        case .f32Le:
            return "\(prefix)f32.le\n"
        case .f32Ge:
            return "\(prefix)f32.ge\n"
        case .f64Eq:
            return "\(prefix)f64.eq\n"
        case .f64Ne:
            return "\(prefix)f64.ne\n"
        case .f64Lt:
            return "\(prefix)f64.lt\n"
        case .f64Gt:
            return "\(prefix)f64.gt\n"
        case .f64Le:
            return "\(prefix)f64.le\n"
        case .f64Ge:
            return "\(prefix)f64.ge\n"
        case .i32Clz:
            return "\(prefix)i32.clz\n"
        case .i32Ctz:
            return "\(prefix)i32.ctz\n"
        case .i32Popcnt:
            return "\(prefix)i32.popcnt\n"
        case .i32Add:
            return "\(prefix)i32.add\n"
        case .i32Sub:
            return "\(prefix)i32.sub\n"
        case .i32Mul:
            return "\(prefix)i32.mul\n"
        case .i32DivS:
            return "\(prefix)i32.div_s\n"
        case .i32DivU:
            return "\(prefix)i32.div_u\n"
        case .i32RemS:
            return "\(prefix)i32.rem_s\n"
        case .i32RemU:
            return "\(prefix)i32.rem_u\n"
        case .i32And:
            return "\(prefix)i32.and\n"
        case .i32Or:
            return "\(prefix)i32.or\n"
        case .i32Xor:
            return "\(prefix)i32.xor\n"
        case .i32Shl:
            return "\(prefix)i32.shl\n"
        case .i32ShrS:
            return "\(prefix)i32.shr_s\n"
        case .i32ShrU:
            return "\(prefix)i32.shr_u\n"
        case .i32Rotl:
            return "\(prefix)i32.rotl\n"
        case .i32Rotr:
            return "\(prefix)i32.rotr\n"
        case .i64Clz:
            return "\(prefix)i64.clz\n"
        case .i64Ctz:
            return "\(prefix)i64.ctz\n"
        case .i64Popcnt:
            return "\(prefix)i64.popcnt\n"
        case .i64Add:
            return "\(prefix)i64.add\n"
        case .i64Sub:
            return "\(prefix)i64.sub\n"
        case .i64Mul:
            return "\(prefix)i64.mul\n"
        case .i64DivS:
            return "\(prefix)i64.div_s\n"
        case .i64DivU:
            return "\(prefix)i64.div_u\n"
        case .i64RemS:
            return "\(prefix)i64.rem_s\n"
        case .i64RemU:
            return "\(prefix)i64.rem_u\n"
        case .i64And:
            return "\(prefix)i64.and\n"
        case .i64Or:
            return "\(prefix)i64.or\n"
        case .i64Xor:
            return "\(prefix)i64.xor\n"
        case .i64Shl:
            return "\(prefix)i64.shl\n"
        case .i64ShrS:
            return "\(prefix)i64.shr_s\n"
        case .i64ShrU:
            return "\(prefix)i64.shr_u\n"
        case .i64Rotl:
            return "\(prefix)i64.rotl\n"
        case .i64Rotr:
            return "\(prefix)i64.rotr\n"
        case .f32Abs:
            return "\(prefix)f32.abs\n"
        case .f32Neg:
            return "\(prefix)f32.neg\n"
        case .f32Ceil:
            return "\(prefix)f32.ceil\n"
        case .f32Floor:
            return "\(prefix)f32.floor\n"
        case .f32Trunc:
            return "\(prefix)f32.trunc\n"
        case .f32Nearest:
            return "\(prefix)f32.nearest\n"
        case .f32Sqrt:
            return "\(prefix)f32.sqrt\n"
        case .f32Add:
            return "\(prefix)f32.add\n"
        case .f32Sub:
            return "\(prefix)f32.sub\n"
        case .f32Mul:
            return "\(prefix)f32.mul\n"
        case .f32Div:
            return "\(prefix)f32.div\n"
        case .f32Min:
            return "\(prefix)f32.min\n"
        case .f32Max:
            return "\(prefix)f32.max\n"
        case .f32Copysign:
            return "\(prefix)f32.copysign\n"
        case .f64Abs:
            return "\(prefix)f64.abs\n"
        case .f64Neg:
            return "\(prefix)f64.neg\n"
        case .f64Ceil:
            return "\(prefix)f64.ceil\n"
        case .f64Floor:
            return "\(prefix)f64.floor\n"
        case .f64Trunc:
            return "\(prefix)f64.trunc\n"
        case .f64Nearest:
            return "\(prefix)f64.nearest\n"
        case .f64Sqrt:
            return "\(prefix)f64.sqrt\n"
        case .f64Add:
            return "\(prefix)f64.add\n"
        case .f64Sub:
            return "\(prefix)f64.sub\n"
        case .f64Mul:
            return "\(prefix)f64.mul\n"
        case .f64Div:
            return "\(prefix)f64.div\n"
        case .f64Min:
            return "\(prefix)f64.min\n"
        case .f64Max:
            return "\(prefix)f64.max\n"
        case .f64Copysign:
            return "\(prefix)f64.copysign\n"
        case .i32WrapI64:
            return "\(prefix)i32.wrap_i64\n"
        case .i32TruncF32S:
            return "\(prefix)i32.trunc_f32_s\n"
        case .i32TruncF32U:
            return "\(prefix)i32.trunc_f32_u\n"
        case .i32TruncF64S:
            return "\(prefix)i32.trunc_f64_s\n"
        case .i32TruncF64U:
            return "\(prefix)i32.trunc_f64_u\n"
        case .i64ExtendI32S:
            return "\(prefix)i64.extend_i32_s\n"
        case .i64ExtendI32U:
            return "\(prefix)i64.extend_i32_u\n"
        case .i64TruncF32S:
            return "\(prefix)i64.trunc_f32_s\n"
        case .i64TruncF32U:
            return "\(prefix)i64.trunc_f32_u\n"
        case .i64TruncF64S:
            return "\(prefix)i64.trunc_f64_s\n"
        case .i64TruncF64U:
            return "\(prefix)i64.trunc_f64_u\n"
        case .f32ConvertI32S:
            return "\(prefix)f32.convert_i32_s\n"
        case .f32ConvertI32U:
            return "\(prefix)f32.convert_i32_u\n"
        case .f32ConvertI64S:
            return "\(prefix)f32.convert_i64_s\n"
        case .f32ConvertI64U:
            return "\(prefix)f32.convert_i64_u\n"
        case .f32DemoteF64:
            return "\(prefix)f32.demote_f64\n"
        case .f64ConvertI32S:
            return "\(prefix)f64.convert_i32_s\n"
        case .f64ConvertI32U:
            return "\(prefix)f64.convert_i32_u\n"
        case .f64ConvertI64S:
            return "\(prefix)f64.convert_i64_s\n"
        case .f64ConvertI64U:
            return "\(prefix)f64.convert_i64_u\n"
        case .f64PromoteF32:
            return "\(prefix)f64.promote_f32\n"
        case .i32ReinterpretF32:
            return "\(prefix)i32.reinterpret_f32\n"
        case .f32ReinterpretI32:
            return "\(prefix)f32.reinterpret_i32\n"
        case .i64ReinterpretF64:
            return "\(prefix)i64.reinterpret_f64\n"
        case .f64ReinterpretI64:
            return "\(prefix)f64.reinterpret_i64\n"
            
        // Bulk Memory Operations (WASM 1.1)
        case .memoryInit(let dataIdx, let memoryIdx):
            return "\(prefix)memory.init \(dataIdx) \(memoryIdx)\n"
        case .dataDrop(let dataIdx):
            return "\(prefix)data.drop \(dataIdx)\n"
        case .memoryCopy(let destMemoryIdx, let srcMemoryIdx):
            return "\(prefix)memory.copy \(destMemoryIdx) \(srcMemoryIdx)\n"
        case .memoryFill(let memoryIdx):
            return "\(prefix)memory.fill \(memoryIdx)\n"
        case .tableInit(let elemIdx, let tableIdx):
            return "\(prefix)table.init \(elemIdx) \(tableIdx)\n"
        case .elemDrop(let elemIdx):
            return "\(prefix)elem.drop \(elemIdx)\n"
        case .tableCopy(let destTableIdx, let srcTableIdx):
            return "\(prefix)table.copy \(destTableIdx) \(srcTableIdx)\n"
        case .tableGrow(let tableIdx):
            return "\(prefix)table.grow \(tableIdx)\n"
        case .tableSize(let tableIdx):
            return "\(prefix)table.size \(tableIdx)\n"
        case .tableFill(let tableIdx):
            return "\(prefix)table.fill \(tableIdx)\n"
            
        // SIMD Operations (WASM 1.1)
        case .v128Const(let bytes):
            let bytesStr = bytes.map { String(format: "0x%02X", $0) }.joined(separator: " ")
            return "\(prefix)v128.const \(bytesStr)\n"
        case .i32x4Add: return "\(prefix)i32x4.add\n"
        case .i32x4Sub: return "\(prefix)i32x4.sub\n"
        case .i32x4Mul: return "\(prefix)i32x4.mul\n"
        case .f32x4Add: return "\(prefix)f32x4.add\n"
        case .f32x4Sub: return "\(prefix)f32x4.sub\n"
        case .f32x4Mul: return "\(prefix)f32x4.mul\n"
        case .f32x4Div: return "\(prefix)f32x4.div\n"
        }
    }
    
    private mutating func writeBlock(keyword: String, type: WASMType, instructions: [WASMInstruction], prefix: String) -> String {
        var result = "\(prefix)\(keyword)"
        if type != .void {
            result += " (result \(type.rawValue))"
        }
        result += "\n"
        indentLevel += 1
        for instr in instructions {
            result += writeInstruction(instr)
        }
        indentLevel -= 1
        result += "\(prefix)end\n"
        return result
    }
    
    private mutating func writeIf(type: WASMType, thenInstrs: [WASMInstruction], elseInstrs: [WASMInstruction]?, prefix: String) -> String {
        var result = "\(prefix)if"
        if type != .void {
            result += " (result \(type.rawValue))"
        }
        result += "\n"
        indentLevel += 1
        for instr in thenInstrs {
            result += writeInstruction(instr)
        }
        if let elseInstrs = elseInstrs {
            result += "\(prefix)else\n"
            for instr in elseInstrs {
                result += writeInstruction(instr)
            }
        }
        indentLevel -= 1
        result += "\(prefix)end\n"
        return result
    }
}
