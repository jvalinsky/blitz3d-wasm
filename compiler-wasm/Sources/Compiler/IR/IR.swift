

public indirect enum IRValue {
    case constI32(Int32)
    case constF32(Float)
    case constStringPtr(Int32)
    
    case localGet(index: Int, type: IRType)
    case globalGet(index: Int, type: IRType)
    
    case binary(op: String, lhs: IRValue, rhs: IRValue, resultType: IRType)
    
    case call(name: String, args: [IRValue], resultType: IRType)
    
    case loadField(base: IRValue, fieldOffset: Int, fieldType: IRType)
    case loadArray(base: IRValue, index: IRValue, elementSize: Int, elementType: IRType)
    
    case convert(value: IRValue, from: IRType, to: IRType)
    
    // Type collection operations
    case first(typeName: String)
    case last(typeName: String)
    case before(value: IRValue)
    case after(value: IRValue)
    case handle(value: IRValue)
    case objectCast(typeName: String, value: IRValue)
    case new(typeName: String)
    
    public var type: IRType {
        switch self {
        case .constI32: return .i32
        case .constF32: return .f32
        case .constStringPtr: return .i32
        case .localGet(_, let type): return type
        case .globalGet(_, let type): return type
        case .binary(_, _, _, let resultType): return resultType
        case .call(_, _, let resultType): return resultType
        case .loadField(_, _, let fieldType): return fieldType
        case .loadArray(_, _, _, let elementType): return elementType
        case .convert(_, _, let to): return to
        case .first, .last, .before, .after, .handle, .objectCast, .new: return .i32
        }
    }
}

public indirect enum IREffect {
    case nop
    case discard(IRValue)
    case assign(target: String, value: IRValue)
    case assignLocal(index: Int, value: IRValue)
    case assignGlobal(index: Int, value: IRValue)
    case assignField(base: IRValue, fieldOffset: Int, fieldType: IRType, value: IRValue)
    case assignArray(base: IRValue, index: IRValue, elementSize: Int, elementType: IRType, value: IRValue)
    case delete(value: IRValue)
    
    case ifStmt(condition: IRValue, then: [IREffect], else: [IREffect]?)
    case whileStmt(condition: IRValue, body: [IREffect])
    case forStmt(index: Int, start: IRValue, end: IRValue, step: IRValue?, body: [IREffect])
    case repeatStmt(body: [IREffect], condition: IRValue)
    
    case returnStmt(value: IRValue?)
    case breakStmt
    case continueStmt
    
    case block(label: String, body: [IREffect])
    case loop(label: String, body: [IREffect])
    case selectStmt(value: IRValue, cases: [(Int32, [IREffect])], default: [IREffect]?)
    case label(String)
    case branch(label: String)
    case branchIf(condition: IRValue, label: String)
}

public struct IRFunction {
    public var name: String
    public var parameters: [(String, IRType, String?)]
    public var returnType: IRType
    public var returnTypeName: String?
    public var locals: [(String, IRType, String?)]
    public var body: [IREffect]
    
    public init(name: String, parameters: [(String, IRType, String?)] = [], returnType: IRType = .void, returnTypeName: String? = nil, locals: [(String, IRType, String?)] = [], body: [IREffect] = []) {
        self.name = name
        self.parameters = parameters
        self.returnType = returnType
        self.returnTypeName = returnTypeName
        self.locals = locals
        self.body = body
    }
}

public struct IRDataSegment {
    public let offset: Int32
    public let data: [UInt8]
}

public struct IRModule {
    public var functions: [IRFunction]
    public var globals: [(String, IRType, Bool)]
    public var imports: [(String, String, IRType)]
    public var data: [IRDataSegment] = []
    public var types: [String: IRTypeInfo] = [:]
    
    public init(functions: [IRFunction] = [], globals: [(String, IRType, Bool)] = [], imports: [(String, String, IRType)] = []) {
        self.functions = functions
        self.globals = globals
        self.imports = imports
    }
}

public struct IRTypeInfo {
    public let typeName: String
    public let fieldOffsets: [String: Int]
    public let fieldTypes: [String: IRType]
    public let fieldCustomTypes: [String: String]
    public let fieldDimensions: [String: [Int]]
    public let totalSize: Int
    public let headGlobalIndex: Int
    public let tailGlobalIndex: Int
    
    public init(typeName: String, fieldOffsets: [String: Int], fieldTypes: [String: IRType], fieldCustomTypes: [String: String] = [:], fieldDimensions: [String: [Int]] = [:], totalSize: Int, headGlobalIndex: Int, tailGlobalIndex: Int) {
        self.typeName = typeName
        self.fieldOffsets = fieldOffsets
        self.fieldTypes = fieldTypes
        self.fieldCustomTypes = fieldCustomTypes
        self.fieldDimensions = fieldDimensions
        self.totalSize = totalSize
        self.headGlobalIndex = headGlobalIndex
        self.tailGlobalIndex = tailGlobalIndex
    }
}

public struct IRArrayInfo {
    public let baseAddress: Int
    public let elementSize: Int
    public let dimensions: [Int]
    public let elementType: IRType
    public let dynamicPointerGlobalIndex: Int? // If set, baseAddress is ignored (or used as default/offset)
    
    public init(baseAddress: Int, elementSize: Int, dimensions: [Int], elementType: IRType, dynamicPointerGlobalIndex: Int? = nil) {
        self.baseAddress = baseAddress
        self.elementSize = elementSize
        self.dimensions = dimensions
        self.elementType = elementType
        self.dynamicPointerGlobalIndex = dynamicPointerGlobalIndex
    }
}

public class IRBuilder {
    private var currentFunction: IRFunction?
    private var localIndexMap: [String: Int] = [:]
    private var nextLocalIndex: Int = 0
    
    public init() {}
    
    public func enterFunction(name: String, parameters: [(String, IRType, String?)], returnType: IRType, returnTypeName: String? = nil) {
        currentFunction = IRFunction(name: name, parameters: parameters, returnType: returnType, returnTypeName: returnTypeName)
        localIndexMap.removeAll()
        nextLocalIndex = 0
        
        // Add parameters to local index map
        for param in parameters {
            localIndexMap[param.0.lowercased()] = nextLocalIndex
            nextLocalIndex += 1
        }
    }
    
    public func exitFunction() -> IRFunction? {
        defer { currentFunction = nil }
        return currentFunction
    }
    
    public func addLocal(name: String, type: IRType, typeName: String? = nil) {
        guard var funcRef = currentFunction else { return }
        localIndexMap[name.lowercased()] = nextLocalIndex
        funcRef.locals.append((name, type, typeName))
        currentFunction = funcRef
        nextLocalIndex += 1
    }
    
    public func append(_ effect: IREffect) {
        guard var funcRef = currentFunction else { return }
        funcRef.body.append(effect)
        currentFunction = funcRef
    }
    
    public func buildConstI32(_ value: Int32) -> IRValue {
        return .constI32(value)
    }
    
    public func buildConstF32(_ value: Float) -> IRValue {
        return .constF32(value)
    }
    
    public func buildLocalGet(_ name: String, type: IRType) -> IRValue? {
        guard let index = localIndexMap[name] else { return nil }
        return .localGet(index: index, type: type)
    }
    
    public func buildBinary(_ op: String, lhs: IRValue, rhs: IRValue, resultType: IRType) -> IRValue {
        return .binary(op: op, lhs: lhs, rhs: rhs, resultType: resultType)
    }
    
    public func buildDiscard(_ value: IRValue) -> IREffect {
        return .discard(value)
    }
    
    public func buildAssign(_ target: String, _ value: IRValue) -> IREffect {
        return .assign(target: target, value: value)
    }
    
    public func buildReturn(_ value: IRValue?) -> IREffect {
        return .returnStmt(value: value)
    }
    
    public func buildIf(_ condition: IRValue, then: [IREffect], else: [IREffect]?) -> IREffect {
        return .ifStmt(condition: condition, then: then, else: `else`)
    }
    
    public func buildWhile(_ condition: IRValue, body: [IREffect]) -> IREffect {
        return .whileStmt(condition: condition, body: body)
    }
    
    public func buildLabel(_ name: String) -> IREffect {
        return .label(name)
    }
    
    public func buildBranch(_ label: String) -> IREffect {
        return .branch(label: label)
    }
}
