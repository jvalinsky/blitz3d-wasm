//
//  WASMBinaryEncoder.swift
//  Blitz3DCompiler
//
//  Encodes WebAssembly modules to binary format
//

import Foundation

public struct WASMBinaryEncoder {
    private var bytes: [UInt8] = []
    
    public init() {}
    
    public mutating func encode(_ module: WASMModule) -> [UInt8] {
        bytes = []
        
        // Magic number and version
        writeBytes([0x00, 0x61, 0x73, 0x6D]) // WASM magic
        writeBytes([0x01, 0x00, 0x00, 0x00]) // Version 1
        
        // Type section
        if !module.types.isEmpty {
            encodeTypeSection(module.types)
        }
        
        // Import section (for runtime imports)
        if !module.imports.isEmpty {
            encodeImportSection(module.imports)
        }
        
        // Function section
        if !module.functions.isEmpty {
            encodeFunctionSection(module.functions)
        }
        
        // Table section
        if !module.tables.isEmpty {
            encodeTableSection(module.tables)
        }
        
        // Memory section
        if !module.memories.isEmpty {
            encodeMemorySection(module.memories)
        }
        
        // Global section
        if !module.globals.isEmpty {
            encodeGlobalSection(module.globals)
        }
        
        // Export section
        if !module.exports.isEmpty {
            encodeExportSection(module.exports)
        }
        
        // Code section
        if !module.code.isEmpty {
            encodeCodeSection(module.code)
        }
        
        // Data section
        if !module.data.isEmpty {
            encodeDataSection(module.data)
        }
        
        return bytes
    }
    
    private mutating func encodeTypeSection(_ types: [WASMFunctionType]) {
        let content: [UInt8] = encodeVector(types) { type -> [UInt8] in
            var result: [UInt8] = [0x60] // func type
            
            let params = encodeVector(type.parameters) { type -> UInt8 in
                switch type {
                case .i32: return 0x7F
                case .i64: return 0x7E
                case .f32: return 0x7D
                case .f64: return 0x7C
                case .v128: return 0x7B
                default: return 0x00
                }
            }
            result.append(contentsOf: params)
            
            let res = encodeVector(type.results) { type -> UInt8 in
                switch type {
                case .i32: return 0x7F
                case .i64: return 0x7E
                case .f32: return 0x7D
                case .f64: return 0x7C
                case .v128: return 0x7B
                default: return 0x00
                }
            }
            result.append(contentsOf: res)
            
            return result
        }
        
        writeSection(id: 1, content: content)
    }
    
    private mutating func encodeImportSection(_ imports: [WASMImport]) {
        var content: [UInt8] = []
        content.append(contentsOf: encodeVarUInt(imports.count))
        for imp in imports {
            encodeString(imp.module, into: &content)
            encodeString(imp.name, into: &content)
            switch imp.kind {
            case .function: 
                content.append(0x00)
                content.append(contentsOf: encodeVarUInt(imp.index))
            case .table: content.append(0x01)
            case .memory: content.append(0x02)
            case .global: content.append(0x03)
            }
        }
        
        if !content.isEmpty {
            writeSection(id: 2, content: content)
        }
    }
    
    private func encodeString(_ str: String, into bytes: inout [UInt8]) {
        let strBytes = [UInt8](str.utf8)
        bytes.append(contentsOf: encodeVarUInt(strBytes.count))
        bytes.append(contentsOf: strBytes)
    }
    
    private mutating func encodeFunctionSection(_ functions: [Int]) {
        let content = encodeVector(functions) { encodeVarUInt($0) }
        writeSection(id: 3, content: content)
    }
    
    private mutating func encodeTableSection(_ tables: [WASMTable]) {
        let content = encodeVector(tables) { table -> [UInt8] in
            var bytes: [UInt8] = []
            bytes.append(0x70) // funcref
            if let max = table.maximum {
                bytes.append(0x01) // flags (has max)
                bytes.append(contentsOf: encodeVarUInt(table.initial))
                bytes.append(contentsOf: encodeVarUInt(max))
            } else {
                bytes.append(0x00) // flags (no max)
                bytes.append(contentsOf: encodeVarUInt(table.initial))
            }
            return bytes
        }
        writeSection(id: 4, content: content)
    }
    
    private mutating func encodeMemorySection(_ memories: [WASMMemory]) {
        let content = encodeVector(memories) { memory -> [UInt8] in
            var bytes: [UInt8] = []
            if let maximum = memory.maximum {
                bytes.append(0x01) // flags (has max)
                bytes.append(contentsOf: encodeVarUInt(memory.initial))
                bytes.append(contentsOf: encodeVarUInt(maximum))
            } else {
                bytes.append(0x00) // flags (no max)
                bytes.append(contentsOf: encodeVarUInt(memory.initial))
            }
            return bytes
        }
        writeSection(id: 5, content: content)
    }
    
    private mutating func encodeGlobalSection(_ globals: [WASMGlobal]) {
        let content = encodeVector(globals) { global -> [UInt8] in
            var bytes: [UInt8] = []
            
            let typeByte: UInt8
            switch global.type {
            case .i32: typeByte = 0x7F
            case .i64: typeByte = 0x7E
            case .f32: typeByte = 0x7D
            case .f64: typeByte = 0x7C
            default: typeByte = 0x00
            }
            bytes.append(typeByte)
            
            bytes.append(global.mutability ? 0x01 : 0x00)
            bytes.append(contentsOf: encodeInitExpr(global.initExpr))
            bytes.append(0x0B) // end expression
            return bytes
        }
        writeSection(id: 6, content: content)
    }
    
    private mutating func encodeExportSection(_ exports: [WASMExport]) {
        let content = encodeVector(exports) { exp -> [UInt8] in
            var bytes: [UInt8] = []
            encodeString(exp.name, into: &bytes)
            switch exp.kind {
            case .function: bytes.append(0x00)
            case .table: bytes.append(0x01)
            case .memory: bytes.append(0x02)
            case .global: bytes.append(0x03)
            }
            bytes.append(contentsOf: encodeVarUInt(exp.index))
            return bytes
        }
        writeSection(id: 7, content: content)
    }
    
    private mutating func encodeCodeSection(_ functions: [WASMFunction]) {
        let content: [UInt8] = encodeVector(functions) { function -> [UInt8] in
            var funcBody: [UInt8] = []
            
            // Local declarations
            let localsByType = groupLocalsByType(function.locals)
            funcBody.append(contentsOf: encodeVarUInt(localsByType.count))
            for (count, type) in localsByType {
                funcBody.append(contentsOf: encodeVarUInt(count))
                let typeByte: UInt8
                switch type {
                case .i32: typeByte = 0x7F
                case .i64: typeByte = 0x7E
                case .f32: typeByte = 0x7D
                case .f64: typeByte = 0x7C
                case .v128: typeByte = 0x7B
                default: typeByte = 0x00
                }
                funcBody.append(typeByte)
            }
            
            // Function body instructions
            funcBody.append(contentsOf: encodeInstructions(function.body))
            funcBody.append(0x0B) // end
            
            // Prefix with size of function body
            return encodeVarUInt(funcBody.count) + funcBody
        }
        writeSection(id: 10, content: content)
    }
    
    private mutating func encodeDataSection(_ data: [WASMData]) {
        let content = encodeVector(data) { dataSegment -> [UInt8] in
            var bytes: [UInt8] = []
            bytes.append(0x00) // passive (or active with mem 0)
            bytes.append(contentsOf: encodeInitExpr(dataSegment.offset))
            bytes.append(0x0B) // end expression
            bytes.append(contentsOf: encodeVarUInt(dataSegment.bytes.count))
            bytes.append(contentsOf: dataSegment.bytes)
            return bytes
        }
        writeSection(id: 11, content: content)
    }
    
    private mutating func encodeInstructions(_ instructions: [WASMInstruction]) -> [UInt8] {
        var bytes: [UInt8] = []
        
        for instruction in instructions {
            bytes.append(contentsOf: encodeInstruction(instruction))
        }
        
        return bytes
    }
    
    private mutating func encodeInstruction(_ instruction: WASMInstruction) -> [UInt8] {
        switch instruction {
        case .unreachable:
            return [0x00]
        case .nop:
            return [0x01]
        case .return:
            return [0x0F]
        case .call(let idx):
            return [0x10] + encodeVarUInt(idx)
        case .callIndirect(let typeIdx, let tableIdx): // Fix: Capture tableIdx
            return [0x11] + encodeVarUInt(typeIdx) + encodeVarUInt(tableIdx) // Fix: Encode tableIdx
        case .drop:
            return [0x1A]
        case .select:
            return [0x1B]
        case .localGet(let idx):
            return [0x20] + encodeVarUInt(idx)
        case .localSet(let idx):
            return [0x21] + encodeVarUInt(idx)
        case .localTee(let idx):
            return [0x22] + encodeVarUInt(idx)
        case .globalGet(let idx):
            return [0x23] + encodeVarUInt(idx)
        case .globalSet(let idx):
            return [0x24] + encodeVarUInt(idx)
        case .i32Load(let align, let offset): // Fix: Capture align and offset
            return [0x28] + encodeVarUInt(align) + encodeVarUInt(offset) // Fix: Encode align and offset
        case .i64Load(let align, let offset): // Fix: Capture align and offset
            return [0x29] + encodeVarUInt(align) + encodeVarUInt(offset) // Fix: Encode align and offset
        case .f32Load(let align, let offset): // Fix: Capture align and offset
            return [0x2A] + encodeVarUInt(align) + encodeVarUInt(offset) // Fix: Encode align and offset
        case .f64Load(let align, let offset): // Fix: Capture align and offset
            return [0x2B] + encodeVarUInt(align) + encodeVarUInt(offset) // Fix: Encode align and offset
        case .i32Store(let align, let offset): // Fix: Capture align and offset
            return [0x36] + encodeVarUInt(align) + encodeVarUInt(offset) // Fix: Encode align and offset
        case .i64Store(let align, let offset): // Fix: Capture align and offset
            return [0x37] + encodeVarUInt(align) + encodeVarUInt(offset) // Fix: Encode align and offset
        case .f32Store(let align, let offset): // Fix: Capture align and offset
            return [0x38] + encodeVarUInt(align) + encodeVarUInt(offset) // Fix: Encode align and offset
        case .f64Store(let align, let offset): // Fix: Capture align and offset
            return [0x39] + encodeVarUInt(align) + encodeVarUInt(offset) // Fix: Encode align and offset
        case .memorySize:
            return [0x3F, 0x00]
        case .memoryGrow:
            return [0x40, 0x00]
        case .i32Const(let val):
            return [0x41] + encodeSLEB128(Int64(val)) // Fix: Use SLEB128
        case .i64Const(let val):
            return [0x42] + encodeSLEB128(val) // Fix: Use SLEB128
        case .f32Const(let val):
            return [0x43] + encodeFloat32(val)
        case .f64Const(let val):
            return [0x44] + encodeFloat64(val)
        case .i32EqZ:
            return [0x45]
        case .i32Eq:
            return [0x46]
        case .i32Ne:
            return [0x47]
        case .i32LtS:
            return [0x48]
        case .i32LtU:
            return [0x49]
        case .i32GtS:
            return [0x4A]
        case .i32GtU:
            return [0x4B]
        case .i32LeS:
            return [0x4C]
        case .i32LeU:
            return [0x4D]
        case .i32GeS:
            return [0x4E]
        case .i32GeU:
            return [0x4F]
        case .i32Add:
            return [0x6A]
        case .i32Sub:
            return [0x6B]
        case .i32Mul:
            return [0x6C]
        case .i32DivS:
            return [0x6D]
        case .i32DivU:
            return [0x6E]
        case .i32RemS:
            return [0x6F]
        case .i32RemU:
            return [0x70]
        case .i32And:
            return [0x71]
        case .i32Or:
            return [0x72]
        case .i32Xor:
            return [0x73]
        case .i32Shl:
            return [0x74]
        case .i32ShrS:
            return [0x75]
        case .i32ShrU:
            return [0x76]
        case .i32Clz:
            return [0x67]
        case .i32Ctz:
            return [0x68]
        case .i32Popcnt:
            return [0x69]
        case .f32Eq:
            return [0x5B]
        case .f32Ne:
            return [0x5C]
        case .f32Lt:
            return [0x5D]
        case .f32Gt:
            return [0x5E]
        case .f32Le:
            return [0x5F]
        case .f32Ge:
            return [0x60]
        case .f32Add:
            return [0x92]
        case .f32Sub:
            return [0x93]
        case .f32Mul:
            return [0x94]
        case .f32Div:
            return [0x95]
        case .f32Sqrt:
            return [0x91]
        case .f32Neg:
            return [0x8C]
        case .f64Eq:
            return [0x61]
        case .f64Ne:
            return [0x62]
        case .f64Lt:
            return [0x63]
        case .f64Gt:
            return [0x64]
        case .f64Le:
            return [0x65]
        case .f64Ge:
            return [0x66]
        case .f64Add:
            return [0xA0]
        case .f64Sub:
            return [0xA1]
        case .f64Mul:
            return [0xA2]
        case .f64Div:
            return [0xA3]
        case .f64Sqrt:
            return [0x9F]
        case .f64Neg:
            return [0x9A]
        case .f32Abs: return [0x8B]
        case .f32Ceil: return [0x8D]
        case .f32Floor: return [0x8E]
        case .f32Trunc: return [0x8F]
        case .f32Nearest: return [0x90]
        case .f32Min: return [0x96]
        case .f32Max: return [0x97]
        case .f32Copysign: return [0x98]
        case .f64Abs: return [0x99]
        case .f64Ceil: return [0x9B]
        case .f64Floor: return [0x9C]
        case .f64Trunc: return [0x9D]
        case .f64Nearest: return [0x9E]
        case .f64Min: return [0xA4]
        case .f64Max: return [0xA5]
        case .f64Copysign: return [0xA6]
        case .i32WrapI64:
            return [0xA7]
        case .i32TruncF32S: return [0xA8]
        case .i32TruncF32U: return [0xA9]
        case .i32TruncF64S: return [0xAA]
        case .i32TruncF64U: return [0xAB]
        case .i64ExtendI32S:
            return [0xAC]
        case .i64ExtendI32U: return [0xAD]
        case .i64TruncF32S: return [0xAE]
        case .i64TruncF32U: return [0xAF]
        case .i64TruncF64S: return [0xB0]
        case .i64TruncF64U: return [0xB1]
        case .f32ConvertI32S:
            return [0xB2]
        case .f32ConvertI32U: return [0xB3]
        case .f32ConvertI64S: return [0xB4]
        case .f32ConvertI64U: return [0xB5]
        case .f32DemoteF64: return [0xB6]
        case .f64ConvertI32S:
            return [0xB7]
        case .f64ConvertI32U: return [0xB8]
        case .f64ConvertI64S: return [0xB9]
        case .f64ConvertI64U: return [0xBA]
        case .f64PromoteF32: return [0xBB]
        case .i32ReinterpretF32:
            return [0xBC]
        case .f32ReinterpretI32:
            return [0xBE]
        case .i64ReinterpretF64: return [0xBD]
        case .f64ReinterpretI64: return [0xBF]
        
        case .i64EqZ: return [0x50]
        case .i64Eq: return [0x51]
        case .i64Ne: return [0x52]
        case .i64LtS: return [0x53]
        case .i64LtU: return [0x54]
        case .i64GtS: return [0x55]
        case .i64GtU: return [0x56]
        case .i64LeS: return [0x57]
        case .i64LeU: return [0x58]
        case .i64GeS: return [0x59]
        case .i64GeU: return [0x5A]
        
        case .i32Rotl: return [0x77]
        case .i32Rotr: return [0x78]
        case .i64Clz: return [0x79]
        case .i64Ctz: return [0x7A]
        case .i64Popcnt: return [0x7B]
        case .i64Add: return [0x7C]
        case .i64Sub: return [0x7D]
        case .i64Mul: return [0x7E]
        case .i64DivS: return [0x7F]
        case .i64DivU: return [0x80]
        case .i64RemS: return [0x81]
        case .i64RemU: return [0x82]
        case .i64And: return [0x83]
        case .i64Or: return [0x84]
        case .i64Xor: return [0x85]
        case .i64Shl: return [0x86]
        case .i64ShrS: return [0x87]
        case .i64ShrU: return [0x88]
        case .i64Rotl: return [0x89]
        case .i64Rotr: return [0x8A]
        
        case .brTable(let targets, let defaultTarget):
            var res: [UInt8] = [0x0E]
            res.append(contentsOf: encodeVarUInt(targets.count))
            for target in targets {
                res.append(contentsOf: encodeVarUInt(target))
            }
            res.append(contentsOf: encodeVarUInt(defaultTarget))
            return res
            
        case .tableGet(let idx):
            return [0x25] + encodeVarUInt(idx)
        case .tableSet(let idx):
            return [0x26] + encodeVarUInt(idx)
            
        case .block(let type, let instrs):
            var blockBytes: [UInt8] = [0x02] // block
            
            let typeByte: UInt8
            switch type {
            case .void: typeByte = 0x40
            case .i32: typeByte = 0x7F
            case .i64: typeByte = 0x7E
            case .f32: typeByte = 0x7D
            case .f64: typeByte = 0x7C
            default: typeByte = 0x40
            }
            blockBytes.append(typeByte)
            
            blockBytes.append(contentsOf: encodeInstructions(instrs))
            blockBytes.append(0x0B) // end
            return blockBytes
        case .loop(let type, let instrs):
            var loopBytes: [UInt8] = [0x03] // loop
            
            let typeByte: UInt8
            switch type {
            case .void: typeByte = 0x40
            case .i32: typeByte = 0x7F
            case .i64: typeByte = 0x7E
            case .f32: typeByte = 0x7D
            case .f64: typeByte = 0x7C
            default: typeByte = 0x40
            }
            loopBytes.append(typeByte)
            
            loopBytes.append(contentsOf: encodeInstructions(instrs))
            loopBytes.append(0x0B) // end
            return loopBytes
        case .br(let idx):
            return [0x0C] + encodeVarUInt(idx)
        case .brIf(let idx):
            return [0x0D] + encodeVarUInt(idx)
        case .if(let type, let thenInstrs, let elseInstrs):
            var ifBytes: [UInt8] = [0x04] // if
            
            let typeByte: UInt8
            switch type {
            case .void: typeByte = 0x40
            case .i32: typeByte = 0x7F
            case .i64: typeByte = 0x7E
            case .f32: typeByte = 0x7D
            case .f64: typeByte = 0x7C
            default: typeByte = 0x40
            }
            ifBytes.append(typeByte)
            
            ifBytes.append(contentsOf: encodeInstructions(thenInstrs))
            if elseInstrs != nil {
                ifBytes.append(0x05) // else
                ifBytes.append(contentsOf: encodeInstructions(elseInstrs!))
            }
            ifBytes.append(0x0B) // end
            return ifBytes
            
        // Bulk Memory Operations (WASM 1.1)
        case .memoryInit(let dataIdx, let memoryIdx):
            return [0xFC, 0x08] + encodeVarUInt(dataIdx) + encodeVarUInt(memoryIdx)
        case .dataDrop(let dataIdx):
            return [0xFC, 0x09] + encodeVarUInt(dataIdx)
        case .memoryCopy(let destMemoryIdx, let srcMemoryIdx):
            return [0xFC, 0x0A] + encodeVarUInt(destMemoryIdx) + encodeVarUInt(srcMemoryIdx)
        case .memoryFill(let memoryIdx):
            return [0xFC, 0x0B] + encodeVarUInt(memoryIdx)
        case .tableInit(let elemIdx, let tableIdx):
            return [0xFC, 0x0C] + encodeVarUInt(elemIdx) + encodeVarUInt(tableIdx)
        case .elemDrop(let elemIdx):
            return [0xFC, 0x0D] + encodeVarUInt(elemIdx)
        case .tableCopy(let destTableIdx, let srcTableIdx):
            return [0xFC, 0x0E] + encodeVarUInt(destTableIdx) + encodeVarUInt(srcTableIdx)
        case .tableGrow(let tableIdx):
            return [0xFC, 0x0F] + encodeVarUInt(tableIdx)
        case .tableSize(let tableIdx):
            return [0xFC, 0x10] + encodeVarUInt(tableIdx)
        case .tableFill(let tableIdx):
            return [0xFC, 0x11] + encodeVarUInt(tableIdx)
            
        // SIMD Operations (WASM 1.1)
        case .v128Const(let bytes):
            return [0xFD, 0x0C] + bytes
        case .i32x4Add: return [0xFD, 0x6E]
        case .i32x4Sub: return [0xFD, 0x6D]
        case .i32x4Mul: return [0xFD, 0x6F]
        case .f32x4Add: return [0xFD, 0x94]
        case .f32x4Sub: return [0xFD, 0x95]
        case .f32x4Mul: return [0xFD, 0x96]
        case .f32x4Div: return [0xFD, 0x97]
        case .end:
            return [0x0B]
        }
    }
    
    private mutating func encodeInitExpr(_ expr: WASMInitExpression) -> [UInt8] {
        switch expr {
        case .i32Const(let val):
            return [0x41] + encodeSLEB128(Int64(val))
        case .i64Const(let val):
            return [0x42] + encodeSLEB128(val)
        case .f32Const(let val):
            return [0x43] + encodeFloat32(val)
        case .f64Const(let val):
            return [0x44] + encodeFloat64(val)
        case .globalGet(let idx):
            return [0x23] + encodeVarUInt(idx)
        }
    }
    
    private func encodeSLEB128(_ value: Int64) -> [UInt8] {
        var v = value
        var result: [UInt8] = []
        var more = true
        while more {
            var byte = UInt8(bitPattern: Int8(v & 0x7F))
            v >>= 7
            if (v == 0 && (byte & 0x40) == 0) || (v == -1 && (byte & 0x40) != 0) {
                more = false
            } else {
                byte |= 0x80
            }
            result.append(byte)
        }
        return result
    }
    
    private func groupLocalsByType(_ locals: [WASMType]) -> [(count: Int, type: WASMType)] {
        var grouped: [(Int, WASMType)] = []
        for type in locals {
            if let last = grouped.last, last.1 == type {
                grouped[grouped.count - 1].0 += 1
            } else {
                grouped.append((1, type))
            }
        }
        return grouped
    }
    
    // Encoding helpers
    private mutating func writeBytes(_ bytes: [UInt8]) {
        self.bytes.append(contentsOf: bytes)
    }
    
    private mutating func writeSection(id: UInt8, content: [UInt8]) {
        writeBytes([id])
        writeVarUInt(Int(content.count))
        writeBytes(content)
    }
    
    private mutating func writeVarUInt(_ value: Int) {
        var v = value
        var result: [UInt8] = []
        repeat {
            var byte = UInt8(v & 0x7F)
            v >>= 7
            if v > 0 {
                byte |= 0x80
            }
            result.append(byte)
        } while v > 0
        writeBytes(result)
    }
    
    private func encodeVarUInt(_ value: Int) -> [UInt8] {
        var v = value
        var result: [UInt8] = []
        repeat {
            var byte = UInt8(v & 0x7F)
            v >>= 7
            if v > 0 {
                byte |= 0x80
            }
            result.append(byte)
        } while v > 0
        return result
    }
    
    private func encodeInt32(_ value: Int32) -> [UInt8] {
        let uintValue = UInt32(bitPattern: value)
        return [
            UInt8(uintValue & 0xFF),
            UInt8((uintValue >> 8) & 0xFF),
            UInt8((uintValue >> 16) & 0xFF),
            UInt8((uintValue >> 24) & 0xFF)
        ]
    }
    
    private func encodeInt64(_ value: Int64) -> [UInt8] {
        let uintValue = UInt64(bitPattern: value)
        return [
            UInt8(uintValue & 0xFF),
            UInt8((uintValue >> 8) & 0xFF),
            UInt8((uintValue >> 16) & 0xFF),
            UInt8((uintValue >> 24) & 0xFF),
            UInt8((uintValue >> 32) & 0xFF),
            UInt8((uintValue >> 40) & 0xFF),
            UInt8((uintValue >> 48) & 0xFF),
            UInt8((uintValue >> 56) & 0xFF)
        ]
    }
    
    private func encodeFloat32(_ value: Float) -> [UInt8] {
        let uintValue = value.bitPattern
        return [
            UInt8(uintValue & 0xFF),
            UInt8((uintValue >> 8) & 0xFF),
            UInt8((uintValue >> 16) & 0xFF),
            UInt8((uintValue >> 24) & 0xFF)
        ]
    }
    
    private func encodeFloat64(_ value: Double) -> [UInt8] {
        let uintValue = value.bitPattern
        return [
            UInt8(uintValue & 0xFF),
            UInt8((uintValue >> 8) & 0xFF),
            UInt8((uintValue >> 16) & 0xFF),
            UInt8((uintValue >> 24) & 0xFF),
            UInt8((uintValue >> 32) & 0xFF),
            UInt8((uintValue >> 40) & 0xFF),
            UInt8((uintValue >> 48) & 0xFF),
            UInt8((uintValue >> 56) & 0xFF)
        ]
    }
    
    private mutating func encodeString(_ str: String) {
        let bytes = [UInt8](str.utf8)
        writeVarUInt(bytes.count)
        writeBytes(bytes)
    }
    
    private func encodeVector<T>(_ items: [T], transform: (T) -> UInt8) -> [UInt8] {
        var result = encodeVarUInt(items.count)
        for item in items {
            result.append(transform(item))
        }
        return result
    }
    
    private func encodeVector<T>(_ items: [T], transform: (T) -> [UInt8]) -> [UInt8] {
        var result = encodeVarUInt(items.count)
        for item in items {
            result.append(contentsOf: transform(item))
        }
        return result
    }
}
