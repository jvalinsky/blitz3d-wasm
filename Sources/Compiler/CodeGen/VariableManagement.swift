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
}