//
//  VariableManagement.swift
//  Blitz3DCompiler
//
//  Variable tracking and management for code generation
//

import Foundation

/// Information about a local variable
public struct LocalInfo {
    public let index: Int
    public let type: WASMType
    public let typeName: String?
    public let dimensions: [Int]?
    
    public init(index: Int, type: WASMType, typeName: String? = nil, dimensions: [Int]? = nil) {
        self.index = index
        self.type = type
        self.typeName = typeName
        self.dimensions = dimensions
    }
}

/// Information about a global variable
public struct GlobalInfo {
    public let index: Int
    public let type: WASMType
    public let typeName: String?
    
    public init(index: Int, type: WASMType, typeName: String? = nil) {
        self.index = index
        self.type = type
        self.typeName = typeName
    }
}

/// Information about an array variable
public struct ArrayInfo {
    public let baseAddress: Int
    public let elementSize: Int
    public let elementType: WASMType
    public let dimensions: [Int]
    
    public init(baseAddress: Int, elementSize: Int, elementType: WASMType, dimensions: [Int]) {
        self.baseAddress = baseAddress
        self.elementSize = elementSize
        self.elementType = elementType
        self.dimensions = dimensions
    }
}

/// Manages variable tracking during code generation
public struct VariableManagement {
    private var localVariables: [String: LocalInfo] = [:]
    private var globalVariables: [String: GlobalInfo] = [:]
    private var arrayVariables: [String: ArrayInfo] = [:]
    private var stringLiterals: [String: Int] = [:]
    
    private var nextLocalIndex: Int = 0
    private var nextGlobalIndex: Int = 0
    private var nextArrayAddress: Int = 256 // Start arrays after reserved data
    
    public init() {}
    
    // MARK: - Local Variables
    
    /// Register a local variable
    public mutating func registerLocal(_ name: String, type: WASMType, typeName: String? = nil, dimensions: [Int]? = nil) -> LocalInfo {
        let info = LocalInfo(
            index: nextLocalIndex,
            type: type,
            typeName: typeName,
            dimensions: dimensions
        )
        localVariables[name] = info
        nextLocalIndex += 1
        return info
    }
    
    /// Get local variable info
    public func localInfo(for name: String) -> LocalInfo? {
        return localVariables[name]
    }
    
    /// Check if local variable exists
    public func hasLocal(_ name: String) -> Bool {
        return localVariables[name] != nil
    }
    
    /// Get all local variables
    public func allLocals() -> [String: LocalInfo] {
        return localVariables
    }

    /// Get all global variables
    public func allGlobals() -> [String: GlobalInfo] {
        return globalVariables
    }

    /// Get all array variables
    public func allArrays() -> [String: ArrayInfo] {
        return arrayVariables
    }

    /// Get all string literals
    public func allStringLiterals() -> [String: Int] {
        return stringLiterals
    }
    
    /// Clear all local variables (for new function)
    public mutating func clearLocals() {
        localVariables.removeAll()
        nextLocalIndex = 0
    }
    
    // MARK: - Global Variables
    
    /// Register a global variable
    public mutating func registerGlobal(_ name: String, type: WASMType, typeName: String? = nil) -> GlobalInfo {
        let info = GlobalInfo(
            index: nextGlobalIndex,
            type: type,
            typeName: typeName
        )
        globalVariables[name] = info
        nextGlobalIndex += 1
        return info
    }
    
    /// Register a global variable with a specific WASM index (for implicit variables)
    public mutating func registerGlobalWithIndex(_ name: String, type: WASMType, typeName: String? = nil, wasmIndex: Int) -> GlobalInfo {
        let info = GlobalInfo(
            index: wasmIndex,  // Use the actual WASM global index
            type: type,
            typeName: typeName
        )
        globalVariables[name] = info
        return info
    }
    
    /// Get global variable info
    public func globalInfo(for name: String) -> GlobalInfo? {
        return globalVariables[name]
    }
    
    /// Check if global variable exists
    public func hasGlobal(_ name: String) -> Bool {
        return globalVariables[name] != nil
    }
    
    // MARK: - Array Variables
    
    /// Register an array variable
    public mutating func registerArray(_ name: String, elementType: WASMType, dimensions: [Int]) -> ArrayInfo {
        let elementSize = typeSize(for: elementType)
        let totalSize = dimensions.reduce(elementSize) { $0 * $1 }
        
        let info = ArrayInfo(
            baseAddress: nextArrayAddress,
            elementSize: elementSize,
            elementType: elementType,
            dimensions: dimensions
        )
        arrayVariables[name] = info
        nextArrayAddress += totalSize
        return info
    }
    
    /// Get array variable info
    public func arrayInfo(for name: String) -> ArrayInfo? {
        return arrayVariables[name]
    }
    
    /// Check if array variable exists
    public func hasArray(_ name: String) -> Bool {
        return arrayVariables[name] != nil
    }
    
    // MARK: - String Literals
    
    /// Register a string literal and return its offset
    public mutating func registerStringLiteral(_ str: String, addData: (String) -> Int) -> Int {
        if let existing = stringLiterals[str] {
            return existing
        }
        let offset = addData(str)
        stringLiterals[str] = offset
        return offset
    }
    
    /// Get string literal offset
    public func stringLiteralOffset(_ str: String) -> Int? {
        return stringLiterals[str]
    }
    
    // MARK: - Utility
    
    /// Get the size of a type in bytes
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
    
    /// Reset all state (for new module generation)
    public mutating func reset() {
        localVariables.removeAll()
        globalVariables.removeAll()
        arrayVariables.removeAll()
        stringLiterals.removeAll()
        nextLocalIndex = 0
        nextGlobalIndex = 0
        nextArrayAddress = 256
    }
    
    /// Get total count of local variables
    public var localCount: Int {
        return localVariables.count
    }
    
    /// Get total count of global variables
    public var globalCount: Int {
        return globalVariables.count
    }

    /// Get the maximum local index currently assigned
    /// Returns -1 if no locals have been registered
    public func maxLocalIndex() -> Int {
        return localVariables.values.map { $0.index }.max() ?? -1
    }

    /// Get the next local index that will be assigned
    public var nextLocalIdx: Int {
        return nextLocalIndex
    }
}

public struct FunctionDefinition {
    public let params: [WASMType]
    public let results: [WASMType]
    
    public init(params: [WASMType], results: [WASMType]) {
        self.params = params
        self.results = results
    }
}

/// Context passed to generation modules containing shared state
public final class ModuleContext {
    public var module: WASMModule
    public var variableManagement: VariableManagement
    public var typeIndexMap: [String: Int]
    public var functionIndexMap: [String: Int]
    public var functionDefinitions: [String: FunctionDefinition]
    public var functionDefinitionsByIndex: [Int: FunctionDefinition] = [:]
    public var userTypes: [String: UserTypeInfo]
    public var fieldOffsets: [String: [String: Int]]
    public var fieldDimensions: [String: [String: [Int]]]  // typeName -> [fieldName: dimensions]
    
    // Type inference for auto-declared variables
    public var typeInference: TypeInference
    
    // Current function body (for type inference during auto-declaration)
    public var currentFunctionBody: [StatementNode] = []
    
    // Internal WASM Global indices
    public var heapPointerIdx: Int = -1
    public var dataPtrIdx: Int = -1
    public var typeCollectionGlobalIdx: Int = -1
    public var gosubStackPtrIdx: Int = -1
    public var stringHeapPtrIdx: Int = -1
    public var scratchGlobalIdx: Int = -1  // For temporary storage
    public var scratchGlobal2Idx: Int = -1  // For temporary storage
    public var scratchGlobalFloatIdx: Int = -1 // For temporary float storage
    public var scratchGlobalFloat2Idx: Int = -1 // For temporary float storage
    
    public init(module: WASMModule,
                variableManagement: VariableManagement = VariableManagement(),
                typeIndexMap: [String: Int] = [:],
                functionIndexMap: [String: Int] = [:],
                functionDefinitions: [String: FunctionDefinition] = [:],
                userTypes: [String: UserTypeInfo] = [:],
                fieldOffsets: [String: [String: Int]] = [:],
                fieldDimensions: [String: [String: [Int]]] = [:]) {
        self.module = module
        self.variableManagement = variableManagement
        self.typeIndexMap = typeIndexMap
        self.functionIndexMap = functionIndexMap
        self.functionDefinitions = functionDefinitions
        self.userTypes = userTypes
        self.fieldOffsets = fieldOffsets
        self.fieldDimensions = fieldDimensions
        
        // Initialize type inference with TypeHandling
        self.typeInference = TypeInference(typeHandling: TypeHandling())
    }

    /// Register a WASM global and return its index
    public func registerGlobal(type: WASMType, mutability: Bool, initExpr: WASMInitExpression) -> Int {
        let idx = module.globals.count
        module.globals.append(WASMGlobal(type: type, mutability: mutability, initExpr: initExpr))
        return idx
    }

    /// Register a WASM global with a default zero initializer for its type
    public func registerGlobalWithDefaultInit(type: WASMType, mutability: Bool) -> Int {
        let initExpr: WASMInitExpression
        switch type {
        case .f32:
            initExpr = .f32Const(0.0)
        case .f64:
            initExpr = .f64Const(0.0)
        case .i64:
            initExpr = .i64Const(0)
        default:
            initExpr = .i32Const(0)
        }
        return registerGlobal(type: type, mutability: mutability, initExpr: initExpr)
    }

    /// Add a string literal to the module's data section
    public func addStringData(_ str: String) -> Int {
        var bytes: [UInt8] = []
        for char in str.utf8 {
            bytes.append(char)
        }
        bytes.append(0)

        var offset = 256
        for segment in module.data {
            offset += segment.bytes.count
        }

        let data = WASMData(memoryIndex: 0, offset: .i32Const(Int32(offset)), bytes: bytes)
        module.data.append(data)
        return offset
    }

    /// Get type size in bytes
    public func typeSize(for wasmType: WASMType) -> Int {
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