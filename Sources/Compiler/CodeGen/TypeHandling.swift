//
//  TypeHandling.swift
//  Blitz3DCompiler
//
//  Type system and conversion utilities for WASM code generation
//

import Foundation

/// Represents type information for WASM generation
public struct TypeInfo {
    public let wasmType: WASMType
    public let typeName: String
    public let suffix: TypeSuffix?
    public let isArray: Bool
    
    public init(wasmType: WASMType, typeName: String, suffix: TypeSuffix? = nil, isArray: Bool = false) {
        self.wasmType = wasmType
        self.typeName = typeName
        self.suffix = suffix
        self.isArray = isArray
    }
}

/// Handles type mapping and conversion between Blitz3D types and WASM types
public struct TypeHandling {
    
    /// Maps Blitz3D type suffixes to WASM types
    private let typeSuffixMap: [TypeSuffix: WASMType] = [
        .integer: .i32,
        .float: .f32,
        .string: .i32  // String is a pointer
    ]
    
    /// Maps Blitz3D type names to WASM types
    private let typeNameMap: [String: WASMType] = [
        "int": .i32,
        "float": .f32,
        "double": .f64,
        "string": .i32,
        "byte": .i32,
        "short": .i32,
        "long": .i32,
        "void": .void
    ]
    
    /// Default type for unspecified expressions
    public var defaultType: WASMType = .i32
    
    public init() {}
    
    /// Get WASM type from type suffix
    public func wasmType(from suffix: TypeSuffix?) -> WASMType {
        guard let suffix = suffix else { return defaultType }
        return typeSuffixMap[suffix] ?? defaultType
    }
    
    /// Get WASM type from type name
    public func wasmType(from typeName: String) -> WASMType {
        return typeNameMap[typeName.lowercased()] ?? defaultType
    }
    
    /// Check if expression is a string
    public func isString(from expr: ExpressionNode) -> Bool {
        switch expr {
        case .stringLiteral:
            return true
        case .identifier(let id, _):
            return id.typeSuffix == .string || id.typeName?.lowercased() == "string"
        case .functionCall(let call, _):
            return call.name.hasSuffix("$")
        case .binary(let binaryOp, _):
            if binaryOp.op == "+" {
                return isString(from: binaryOp.left) || isString(from: binaryOp.right)
            }
            return false
        case .fieldAccess(let access, _):
            // Need to check field type... simplified for now
            return access.field.hasSuffix("$")
        default:
            return false
        }
    }
    
    /// Get WASM type from expression
    public func wasmType(from expr: ExpressionNode) -> WASMType {
        switch expr {
        case .integerLiteral:
            return .i32
            
        case .floatLiteral:
            return .f32
            
        case .stringLiteral:
            return .i32
            
        case .identifier(let identifier, _):
            return wasmType(from: identifier.typeSuffix)
            
        case .binary(let binaryOp, _):
            return resultType(for: binaryOp.op, leftType: wasmType(from: binaryOp.left), rightType: wasmType(from: binaryOp.right))
            
        case .unary(let unaryOp, _):
            return resultType(for: unaryOp.op, operandType: wasmType(from: unaryOp.expression))
            
        case .functionCall(let call, _):
            // Function call return type - simplified, assumes i32
            return defaultType
            
        case .arrayAccess(let access, _):
            // Array access returns i32 by default
            return .i32
            
        case .fieldAccess(let access, _):
            // Field access - simplified, assumes i32
            return .i32
            
        case .typeCast(let cast, _):
            return wasmType(from: cast.targetType.rawValue)
            
        case .new:
            return .i32
            
        case .first, .last:
            // Type collection operations return i32 (handles)
            return .i32
            
        case .before, .after, .handle, .objectCast:
            return .i32
        }
    }
    
    /// Get type info from type suffix
    public func typeInfo(from suffix: TypeSuffix?) -> TypeInfo {
        let wasmType = wasmType(from: suffix)
        let typeName: String
        
        switch suffix {
        case .integer:
            typeName = "int"
        case .float:
            typeName = "float"
        case .string:
            typeName = "string"
        case .none:
            typeName = "int"
            return TypeInfo(wasmType: .i32, typeName: typeName, suffix: nil)
        }
        
        return TypeInfo(wasmType: wasmType, typeName: typeName, suffix: suffix)
    }
    
    /// Get type info from type name
    public func typeInfo(from typeName: String) -> TypeInfo {
        let wasmType = wasmType(from: typeName)
        return TypeInfo(wasmType: wasmType, typeName: typeName)
    }
    
    /// Check if a type is numeric
    public func isNumeric(_ type: WASMType) -> Bool {
        switch type {
        case .i32, .i64, .f32, .f64:
            return true
        default:
            return false
        }
    }
    
    /// Check if types are compatible for operations
    public func areCompatible(_ type1: WASMType, _ type2: WASMType) -> Bool {
        // Numeric types are compatible with each other
        if isNumeric(type1) && isNumeric(type2) {
            return true
        }
        return type1 == type2
    }
    
    /// Get the common type for two types (promotion)
    public func commonType(_ type1: WASMType, _ type2: WASMType) -> WASMType {
        return max(type1, type2)
    }
    
    /// Get the result type of a binary operation
    public func resultType(for op: String, leftType: WASMType, rightType: WASMType) -> WASMType {
        switch op {
        case "+", "-", "*":
            // Arithmetic: use the "larger" type
            return max(leftType, rightType)
            
        case "/":
            return max(leftType, rightType)
            
        case "mod":
            return .i32
            
        case "=", "<>", "<", ">", "<=", ">=":
            // Comparison: always returns i32
            return .i32
            
        case "and", "or", "xor":
            // Bitwise/logical: use i32
            return .i32
            
        case "shl", "shr":
            return leftType
            
        case "pow":
            return max(leftType, rightType)
            
        default:
            return defaultType
        }
    }
    
    /// Get the result type of a unary operation
    public func resultType(for op: String, operandType: WASMType) -> WASMType {
        switch op {
        case "-", "not":
            return operandType
            
        default:
            return operandType
        }
    }
}

/// Extended type handling with array support
public struct ArrayTypeHandling {
    private let baseTypeHandling: TypeHandling
    
    /// Array element size in bytes
    private let elementSizes: [WASMType: Int] = [
        .i32: 4,
        .i64: 8,
        .f32: 4,
        .f64: 8
    ]
    
    public init() {
        self.baseTypeHandling = TypeHandling()
    }
    
    /// Get element type from array access
    public func elementType(for arrayType: WASMType) -> WASMType {
        return arrayType
    }
    
    /// Get element size in bytes
    public func elementSize(for type: WASMType) -> Int {
        return elementSizes[type] ?? 4
    }
    
    /// Calculate array memory layout
    public func calculateArrayLayout(dimensions: [Int], elementType: WASMType) -> ArrayLayout {
        guard !dimensions.isEmpty else {
            return ArrayLayout(totalSize: 0, elementCount: 0, strides: [], dimensions: [], elementSize: 4)
        }
        
        let elementSize = elementSize(for: elementType)
        
        // Calculate strides (offset to each dimension)
        var strides: [Int] = []
        var currentStride = elementSize
        
        for i in 0..<dimensions.count {
            strides.append(currentStride)
            currentStride *= dimensions[i]
        }
        
        let totalSize = currentStride
        let elementCount = dimensions.reduce(1, *)
        
        return ArrayLayout(
            totalSize: totalSize,
            elementCount: elementCount,
            strides: strides,
            dimensions: dimensions,
            elementSize: elementSize
        )
    }
}

/// Represents memory layout for an array
public struct ArrayLayout {
    public let totalSize: Int
    public let elementCount: Int
    public let strides: [Int]
    public let dimensions: [Int]
    public let elementSize: Int
    
    /// Calculate offset for multi-dimensional access
    public func offset(for indices: [Int]) -> Int {
        guard indices.count == strides.count else { return 0 }
        
        var offset = 0
        for i in 0..<indices.count {
            offset += indices[i] * strides[i]
        }
        
        return offset
    }
}

/// Extended type handling with user-defined type support
public struct UserTypeHandling {
    private var userTypes: [String: UserTypeInfo] = [:]
    private var fieldOffsets: [String: [String: Int]] = [:]
    
    public init() {}
    
    /// Register a user-defined type
    public mutating func registerType(_ typeName: String, fields: [String: String]) {
        var currentOffset = 0
        var offsets: [String: Int] = [:]
        var fieldTypes: [String: String] = [:]
        
        // Align fields to 4-byte boundaries
        for (fieldName, fieldType) in fields {
            let wasmType = TypeHandling().wasmType(from: fieldType)
            let typeSize = typeSize(for: wasmType)
            
            // Calculate aligned offset
            if currentOffset % typeSize != 0 {
                currentOffset = ((currentOffset / typeSize) + 1) * typeSize
            }
            
            offsets[fieldName] = currentOffset
            fieldTypes[fieldName] = fieldType
            currentOffset += typeSize
        }
        
        // Add space for prev/next pointers (linked list)
        currentOffset += 8  // Two 4-byte pointers
        
        userTypes[typeName] = UserTypeInfo(
            typeID: userTypes.count + 1,
            fieldOffsets: offsets,
            fieldTypes: fieldTypes,
            instanceSize: currentOffset
        )
        fieldOffsets[typeName] = offsets
    }
    
    /// Get field offset within a user type
    public func fieldOffset(type: String, field: String) -> Int? {
        return fieldOffsets[type]?[field]
    }
    
    /// Get field type
    public func fieldType(type: String, field: String) -> String? {
        return userTypes[type]?.fieldTypes[field]
    }
    
    /// Get type size
    public func typeSize(for typeName: String) -> Int {
        guard let userType = userTypes[typeName] else {
            return typeSize(for: TypeHandling().wasmType(from: typeName))
        }
        return userType.instanceSize
    }
    
    /// Get type size from WASM type
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

/// User-defined type information
public struct UserTypeInfo {
    public let typeID: Int
    public let fieldOffsets: [String: Int]
    public let fieldTypes: [String: String]
    public let fieldDimensions: [String: [Int]]  // Field name -> array dimensions (e.g., [" NPCs": [12]])
    public let fieldDefaults: [String: ExpressionNode]  // Field name -> default value expression
    public let instanceSize: Int
    
    // Global indices for WASM management
    public var firstGlobalIdx: Int = -1
    public var lastGlobalIdx: Int = -1
    public var freeHeadGlobalIdx: Int = -1
    
    public init(typeID: Int, fieldOffsets: [String: Int], fieldTypes: [String: String], fieldDimensions: [String: [Int]] = [:], fieldDefaults: [String: ExpressionNode] = [:], instanceSize: Int) {
        self.typeID = typeID
        self.fieldOffsets = fieldOffsets
        self.fieldTypes = fieldTypes
        self.fieldDimensions = fieldDimensions
        self.fieldDefaults = fieldDefaults
        self.instanceSize = instanceSize
    }
}

// MARK: - Operator Overloads for Type Comparison

func max(_ type1: WASMType, _ type2: WASMType) -> WASMType {
    let precedence: [WASMType: Int] = [.f64: 4, .f32: 3, .i64: 2, .i32: 1]
    let p1 = precedence[type1] ?? 0
    let p2 = precedence[type2] ?? 0
    return p1 >= p2 ? type1 : type2
}
