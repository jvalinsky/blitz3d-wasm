//
//  DataGeneration.swift
//  Blitz3DCompiler
//
//  DATA, READ, and RESTORE management for WASM code generation
//

import Foundation

public struct DataBlock {
    public var label: String?
    public var values: [DataValue]
    public var offset: Int
    
    public init(label: String? = nil, values: [DataValue], offset: Int) {
        self.label = label
        self.values = values
        self.offset = offset
    }
}

public final class DataGeneration {
    private var context: ModuleContext
    private var dataStatements: [DataBlock] = []
    private var dataOffsetMap: [String: Int] = [:]
    // DATA is laid out in linear memory starting at a fixed base.
    // We keep offsets absolute (memory addresses) to simplify RESTORE label handling.
    private let dataBaseAddress: Int = 256
    private var currentDataOffset: Int = 256
    public private(set) var dataPtrIndex: Int = -1
    
    public init(context: ModuleContext) {
        self.context = context
    }
    
    public func setup() {
        let dataPtrGlobal = WASMGlobal(type: .i32, mutability: true, initExpr: .i32Const(Int32(truncatingIfNeeded: dataBaseAddress)))
        dataPtrIndex = context.module.globals.count
        context.module.globals.append(dataPtrGlobal)
    }
    
    public func collectDataStatements(_ statements: [StatementNode], label: String? = nil) {
        var currentLabel = label
        for statement in statements {
            switch statement {
            case .label(let name, _):
                currentLabel = name
            case .data(let values, _):
                let block = DataBlock(label: currentLabel, values: values, offset: currentDataOffset)
                dataStatements.append(block)
                if let lbl = currentLabel {
                    dataOffsetMap[lbl] = currentDataOffset
                }
                for value in values {
                    switch value {
                    case .integer:
                        currentDataOffset += 4
                    case .float:
                        currentDataOffset += 4
                    case .string(let str):
                        // Store DATA strings using the Blitz3D string layout:
                        // [refCount:i32][len:i32][utf8 bytes...][0]
                        // Then pad to 4 bytes so subsequent numeric loads remain aligned.
                        let byteLen = str.utf8.count
                        let size = 8 + byteLen + 1
                        let padded = (size + 3) & ~3
                        currentDataOffset += padded
                    }
                }
            case .function(let funcNode, _):
                collectDataStatements(funcNode.body, label: nil)
            case .ifStatement(let ifNode, _):
                collectDataStatements(ifNode.thenBranch, label: currentLabel)
                for (_, elseBranch) in ifNode.elseIfs {
                    collectDataStatements(elseBranch, label: currentLabel)
                }
                collectDataStatements(ifNode.elseBranch, label: currentLabel)
            case .whileLoop(let whileNode, _):
                collectDataStatements(whileNode.body, label: currentLabel)
            case .forLoop(let forNode, _):
                collectDataStatements(forNode.body, label: currentLabel)
            case .forEach(let forEachNode, _):
                collectDataStatements(forEachNode.body, label: currentLabel)
            case .repeatLoop(let repeatNode, _):
                collectDataStatements(repeatNode.body, label: currentLabel)
            case .select(let selectNode, _):
                for caseNode in selectNode.cases {
                    collectDataStatements(caseNode.body, label: currentLabel)
                }
                if let defaultCase = selectNode.defaultCase {
                    collectDataStatements(defaultCase, label: currentLabel)
                }
            default:
                break
            }
        }
    }
    
    public func serializeDataSection() {
        var dataOffset = dataBaseAddress
        for block in dataStatements {
            for value in block.values {
                switch value {
                case .integer(let intVal):
                    let bytes = intVal.toBytes()
                    let data = WASMData(memoryIndex: 0, offset: .i32Const(Int32(truncatingIfNeeded: dataOffset)), bytes: bytes)
                    context.module.data.append(data)
                    dataOffset += 4
                case .float(let floatVal):
                    let bytes = floatVal.toBytes()
                    let data = WASMData(memoryIndex: 0, offset: .i32Const(Int32(truncatingIfNeeded: dataOffset)), bytes: bytes)
                    context.module.data.append(data)
                    dataOffset += 4
                case .string(let str):
                    // Encode as a Blitz3D string object with a static refcount of 1.
                    let utf8Bytes = Array(str.utf8)
                    let len = utf8Bytes.count

                    var bytes: [UInt8] = []
                    bytes.append(contentsOf: Int(1).toBytes())     // refCount
                    bytes.append(contentsOf: Int(len).toBytes())   // length
                    bytes.append(contentsOf: utf8Bytes)
                    bytes.append(0) // null terminator

                    // Pad to 4 bytes for consistent pointer math.
                    while (bytes.count & 3) != 0 {
                        bytes.append(0)
                    }

                    let data = WASMData(memoryIndex: 0, offset: .i32Const(Int32(truncatingIfNeeded: dataOffset)), bytes: bytes)
                    context.module.data.append(data)
                    dataOffset += bytes.count
                }
            }
        }
    }
    
    public func getDataOffset(for label: String) -> Int? {
        return dataOffsetMap[label]
    }
}
