//
//  WASM.swift
//  Blitz3DCompiler
//
//  WebAssembly types and instruction definitions
//

public enum WASMType: String, Equatable, Comparable, Sendable {
    case i32 = "i32"
    case i64 = "i64"
    case f32 = "f32"
    case f64 = "f64"
    case v128 = "v128"
    case void = "void"
    case funcref = "funcref"
    case externref = "externref"
    
    public var isNumeric: Bool {
        return self != .void && self != .funcref && self != .externref
    }
    
    public static func < (lhs: WASMType, rhs: WASMType) -> Bool {
        let order: [WASMType] = [.i32, .f32, .i64, .f64, .v128, .void, .funcref, .externref]
        guard let lhsIdx = order.firstIndex(of: lhs),
              let rhsIdx = order.firstIndex(of: rhs) else {
            return false
        }
        return lhsIdx < rhsIdx
    }
}

public enum WASMInstruction: Equatable, Sendable {
    case unreachable
    case nop
    case `return`
    case call(Int)
    case callIndirect(Int, Int)
    
    // Debug info
    indirect case sourceLocation(SourceSpan, WASMInstruction)
    
    case block(WASMType, [WASMInstruction])
    case loop(WASMType, [WASMInstruction])
    case br(Int)
    case brIf(Int)
    case brTable([Int], Int)
    case `if`(WASMType, [WASMInstruction], [WASMInstruction]?)
    case drop
    case select
    case localGet(Int)
    case localSet(Int)
    case localTee(Int)
    case globalGet(Int)
    case globalSet(Int)
    case tableGet(Int)
    case tableSet(Int)
    case i32Load(Int, Int)
    case i64Load(Int, Int)
    case f32Load(Int, Int)
    case f64Load(Int, Int)
    case i32Store(Int, Int)
    case i64Store(Int, Int)
    case f32Store(Int, Int)
    case f64Store(Int, Int)
    case memorySize
    case memoryGrow
    case i32Const(Int32)
    case i64Const(Int64)
    case f32Const(Float)
    case f64Const(Double)
    case i32EqZ
    case i32Eq
    case i32Ne
    case i32LtS
    case i32LtU
    case i32GtS
    case i32GtU
    case i32LeS
    case i32LeU
    case i32GeS
    case i32GeU
    case i64EqZ
    case i64Eq
    case i64Ne
    case i64LtS
    case i64LtU
    case i64GtS
    case i64GtU
    case i64LeS
    case i64LeU
    case i64GeS
    case i64GeU
    case f32Eq
    case f32Ne
    case f32Lt
    case f32Gt
    case f32Le
    case f32Ge
    case f64Eq
    case f64Ne
    case f64Lt
    case f64Gt
    case f64Le
    case f64Ge
    case i32Clz
    case i32Ctz
    case i32Popcnt
    case i32Add
    case i32Sub
    case i32Mul
    case i32DivS
    case i32DivU
    case i32RemS
    case i32RemU
    case i32And
    case i32Or
    case i32Xor
    case i32Shl
    case i32ShrS
    case i32ShrU
    case i32Rotl
    case i32Rotr
    case i64Clz
    case i64Ctz
    case i64Popcnt
    case i64Add
    case i64Sub
    case i64Mul
    case i64DivS
    case i64DivU
    case i64RemS
    case i64RemU
    case i64And
    case i64Or
    case i64Xor
    case i64Shl
    case i64ShrS
    case i64ShrU
    case i64Rotl
    case i64Rotr
    case f32Abs
    case f32Neg
    case f32Ceil
    case f32Floor
    case f32Trunc
    case f32Nearest
    case f32Sqrt
    case f32Add
    case f32Sub
    case f32Mul
    case f32Div
    case f32Min
    case f32Max
    case f32Copysign
    case f64Abs
    case f64Neg
    case f64Ceil
    case f64Floor
    case f64Trunc
    case f64Nearest
    case f64Sqrt
    case f64Add
    case f64Sub
    case f64Mul
    case f64Div
    case f64Min
    case f64Max
    case f64Copysign
    case i32WrapI64
    case i32TruncF32S
    case i32TruncF32U
    case i32TruncF64S
    case i32TruncF64U
    case i64ExtendI32S
    case i64ExtendI32U
    case i64TruncF32S
    case i64TruncF32U
    case i64TruncF64S
    case i64TruncF64U
    case f32ConvertI32S
    case f32ConvertI32U
    case f32ConvertI64S
    case f32ConvertI64U
    case f32DemoteF64
    case f64ConvertI32S
    case f64ConvertI32U
    case f64ConvertI64S
    case f64ConvertI64U
    case f64PromoteF32
    case f32ReinterpretI32
    case i32ReinterpretF32
    case f64ReinterpretI64
    case i64ReinterpretF64
    
    // Bulk Memory Operations (WASM 1.1)
    case memoryInit(Int, Int) // dataIdx, memoryIdx
    case dataDrop(Int)        // dataIdx
    case memoryCopy(Int, Int) // destMemoryIdx, srcMemoryIdx
    case memoryFill(Int)      // memoryIdx
    case tableInit(Int, Int)  // elemIdx, tableIdx
    case elemDrop(Int)        // elemIdx
    case tableCopy(Int, Int)  // destTableIdx, srcTableIdx
    case tableGrow(Int)       // tableIdx
    case tableSize(Int)       // tableIdx
    case tableFill(Int)       // tableIdx
    
    // SIMD Operations (WASM 1.1)
    case v128Const([UInt8])
    case i32x4Add
    case i32x4Sub
    case i32x4Mul
    case f32x4Add
    case f32x4Sub
    case f32x4Mul
    case f32x4Div
    
    // Control flow end
    case end
}

public struct WASMFunction: Sendable {
    public var typeIndex: Int
    public var locals: [WASMType]
    public var body: [WASMInstruction]
    
    public var debugLocations: [(instructionIndex: Int, span: SourceSpan)] = []
    
    public init(typeIndex: Int, locals: [WASMType] = [], body: [WASMInstruction] = []) {
        self.typeIndex = typeIndex
        self.locals = locals
        self.body = body
    }
}

public struct WASMGlobal: Sendable {
    public var type: WASMType
    public var mutability: Bool
    public var initExpr: WASMInitExpression
    
    public init(type: WASMType, mutability: Bool = false, initExpr: WASMInitExpression) {
        self.type = type
        self.mutability = mutability
        self.initExpr = initExpr
    }
}

public enum WASMInitExpression: Sendable {
    case i32Const(Int32)
    case i64Const(Int64)
    case f32Const(Float)
    case f64Const(Double)
    case globalGet(Int)
}

public struct WASMMemory: Sendable {
    public var initial: Int
    public var maximum: Int?
    
    public init(initial: Int, maximum: Int? = nil) {
        self.initial = initial
        self.maximum = maximum
    }
}

public struct WASMExport {
    public var name: String
    public var kind: WASMExportKind
    public var index: Int
    
    public init(name: String, kind: WASMExportKind, index: Int) {
        self.name = name
        self.kind = kind
        self.index = index
    }
}

public enum WASMExportKind {
    case function
    case table
    case memory
    case global
}

public struct WASMImport {
    public var module: String
    public var name: String
    public var kind: WASMExportKind
    public var index: Int // For function type index
    
    public init(module: String, name: String, kind: WASMExportKind, index: Int) {
        self.module = module
        self.name = name
        self.kind = kind
        self.index = index
    }
}

public struct WASMModule {
    public var types: [WASMFunctionType]
    public var imports: [WASMImport]
    public var functions: [Int]
    public var tables: [WASMTable]
    public var memories: [WASMMemory]
    public var globals: [WASMGlobal]
    public var exports: [WASMExport]
    public var code: [WASMFunction]
    public var data: [WASMData]
    public var functionNames: [String]  // For WASM name section (debug info)
    public var sourceMapURL: String?     // URL for source map (embedded in WASM)
    
    public init() {
        self.types = []
        self.imports = []
        self.functions = []
        self.tables = []
        self.memories = [WASMMemory(initial: 256, maximum: 512)]
        self.globals = []
        self.exports = []
        self.code = []
        self.data = []
        self.functionNames = []
    }
}

public struct WASMFunctionType {
    public var parameters: [WASMType]
    public var results: [WASMType]
    
    public init(parameters: [WASMType] = [], results: [WASMType] = []) {
        self.parameters = parameters
        self.results = results
    }
}

public struct WASMTable {
    public var elementType: WASMType
    public var initial: Int
    public var maximum: Int?
    
    public init(elementType: WASMType = .funcref, initial: Int, maximum: Int? = nil) {
        self.elementType = elementType
        self.initial = initial
        self.maximum = maximum
    }
}

public struct WASMData {
    public var memoryIndex: Int
    public var offset: WASMInitExpression
    public var bytes: [UInt8]
    
    public init(memoryIndex: Int = 0, offset: WASMInitExpression, bytes: [UInt8]) {
        self.memoryIndex = memoryIndex
        self.offset = offset
        self.bytes = bytes
    }
}

extension Int {
    public func toBytes() -> [UInt8] {
        return [
            UInt8((self >> 0) & 0xFF),
            UInt8((self >> 8) & 0xFF),
            UInt8((self >> 16) & 0xFF),
            UInt8((self >> 24) & 0xFF)
        ]
    }
}

extension Double {
    public func toBytes() -> [UInt8] {
        let floatValue = Float(self)
        let intValue = floatValue.bitPattern
        return [
            UInt8((Int(intValue) >> 0) & 0xFF),
            UInt8((Int(intValue) >> 8) & 0xFF),
            UInt8((Int(intValue) >> 16) & 0xFF),
            UInt8((Int(intValue) >> 24) & 0xFF)
        ]
    }
}
