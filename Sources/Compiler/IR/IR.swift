
import Foundation

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
    
    case ifStmt(condition: IRValue, then: [IREffect], else: [IREffect]?)
    case whileStmt(condition: IRValue, body: [IREffect])
    case forStmt(variable: String, start: IRValue, end: IRValue, step: IRValue?, body: [IREffect])
    case repeatStmt(body: [IREffect], condition: IRValue)
    
    case returnStmt(value: IRValue?)
    case breakStmt
    case continueStmt
    
    case block(label: String, body: [IREffect])
    case branch(label: String)
    case branchIf(condition: IRValue, label: String)
}

public struct IRFunction {
    public var name: String
    public var parameters: [(String, IRType)]
    public var returnType: IRType
    public var locals: [(String, IRType)]
    public var body: [IREffect]
    
    public init(name: String, parameters: [(String, IRType)] = [], returnType: IRType = .void, locals: [(String, IRType)] = [], body: [IREffect] = []) {
        self.name = name
        self.parameters = parameters
        self.returnType = returnType
        self.locals = locals
        self.body = body
    }
}

public struct IRModule {
    public var functions: [IRFunction]
    public var globals: [(String, IRType, Bool)]
    public var imports: [(String, String, IRType)]
    
    public init(functions: [IRFunction] = [], globals: [(String, IRType, Bool)] = [], imports: [(String, String, IRType)] = []) {
        self.functions = functions
        self.globals = globals
        self.imports = imports
    }
}

public class IRBuilder {
    private var currentFunction: IRFunction?
    private var localIndexMap: [String: Int] = [:]
    private var nextLocalIndex: Int = 0
    
    public init() {}
    
    public func enterFunction(name: String, parameters: [(String, IRType)], returnType: IRType) {
        currentFunction = IRFunction(name: name, parameters: parameters, returnType: returnType)
        localIndexMap.removeAll()
        nextLocalIndex = 0
    }
    
    public func exitFunction() -> IRFunction? {
        defer { currentFunction = nil }
        return currentFunction
    }
    
    public func addLocal(name: String, type: IRType) {
        guard var funcRef = currentFunction else { return }
        localIndexMap[name] = nextLocalIndex
        funcRef.locals.append((name, type))
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
}
