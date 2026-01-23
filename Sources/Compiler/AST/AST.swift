//
//  AST.swift
//  Blitz3DCompiler
//
//  Abstract Syntax Tree node types for Blitz3D BASIC
//

public indirect enum StatementNode {
    case local(LocalDeclaration, SourceSpan)
    case global(GlobalDeclaration, SourceSpan)
    case constant(ConstantDeclaration, SourceSpan)
    case constants([ConstantDeclaration], SourceSpan)
    case dim(DimDeclaration, SourceSpan)
    case dims([DimDeclaration], SourceSpan)
    case function(FunctionNode, SourceSpan)
    case assignment(AssignmentNode, SourceSpan)
    case ifStatement(IfNode, SourceSpan)
    case whileLoop(WhileNode, SourceSpan)
    case forLoop(ForNode, SourceSpan)
    case forEach(ForEachNode, SourceSpan)
    case repeatLoop(RepeatNode, SourceSpan)
    case returnStatement(ExpressionNode?, SourceSpan)
    case exit(SourceSpan)
    case goto(String, SourceSpan)
    case gosub(String, SourceSpan)
    case functionCall(FunctionCallNode, SourceSpan)
    case typeDeclaration(TypeDeclarationNode, SourceSpan)
    case select(SelectNode, SourceSpan)
    case data([DataValue], SourceSpan)
    case read([IdentifierNode], SourceSpan)
    case restore(String?, SourceSpan)
    case label(String, SourceSpan)
    case delete(ExpressionNode, SourceSpan)  // Delete expr - removes instance from type collection
    case insert(ExpressionNode, InsertPosition, SourceSpan)  // Insert a Before/After b
    case empty(SourceSpan)
    
    public var span: SourceSpan {
        switch self {
        case .local(_, let s),
             .global(_, let s),
             .constant(_, let s),
             .constants(_, let s),
             .dim(_, let s),
             .dims(_, let s),
             .function(_, let s),
             .assignment(_, let s),
             .ifStatement(_, let s),
             .whileLoop(_, let s),
             .forLoop(_, let s),
             .forEach(_, let s),
             .repeatLoop(_, let s),
             .returnStatement(_, let s),
             .exit(let s),
             .goto(_, let s),
             .gosub(_, let s),
             .functionCall(_, let s),
             .typeDeclaration(_, let s),
             .select(_, let s),
             .data(_, let s),
             .read(_, let s),
             .restore(_, let s),
             .label(_, let s),
             .delete(_, let s),
             .insert(_, _, let s),
             .empty(let s):
            return s
        }
    }
}

public enum InsertPosition {
    case before(ExpressionNode)
    case after(ExpressionNode)
}

public struct SelectNode {
    public var expression: ExpressionNode
    public var cases: [CaseNode]
    public var defaultCase: [StatementNode]?
    
    public init(expression: ExpressionNode, cases: [CaseNode], defaultCase: [StatementNode]? = nil) {
        self.expression = expression
        self.cases = cases
        self.defaultCase = defaultCase
    }
}

/// Represents a single case value or range
public enum CaseValue {
    case single(ExpressionNode)
    case range(ExpressionNode, ExpressionNode)  // Case x To y
}

public struct CaseNode {
    public var values: [CaseValue]
    public var body: [StatementNode]

    // Legacy compatibility - expressions returns single values for non-range cases
    public var expressions: [ExpressionNode] {
        return values.compactMap { value in
            if case .single(let expr) = value {
                return expr
            }
            return nil
        }
    }

    public init(expressions: [ExpressionNode], body: [StatementNode]) {
        self.values = expressions.map { .single($0) }
        self.body = body
    }

    public init(values: [CaseValue], body: [StatementNode]) {
        self.values = values
        self.body = body
    }
}

public struct LocalDeclaration {
    public var variables: [IdentifierNode]
    public var initializers: [String: ExpressionNode]  // variable name -> initializer expression
    public var type: TypeAnnotation?
    public var span: SourceSpan

    public init(
        variables: [IdentifierNode],
        initializers: [String: ExpressionNode] = [:],
        type: TypeAnnotation? = nil,
        span: SourceSpan = .unknown
    ) {
        self.variables = variables
        self.initializers = initializers
        self.type = type
        self.span = span
    }
}

public struct DimDeclaration {
    public var name: String
    public var typeName: String?
    public var dimensions: [ExpressionNode]
    public var span: SourceSpan
    
    public init(name: String, typeName: String? = nil, dimensions: [ExpressionNode], span: SourceSpan = .unknown) {
        self.name = name
        self.typeName = typeName
        self.dimensions = dimensions
        self.span = span
    }
}

public struct GlobalDeclaration {
    public var variables: [IdentifierNode]
    public var initializers: [String: ExpressionNode]
    public var type: TypeAnnotation?
    public var span: SourceSpan
    
    public init(
        variables: [IdentifierNode],
        initializers: [String: ExpressionNode] = [:],
        type: TypeAnnotation? = nil,
        span: SourceSpan = .unknown
    ) {
        self.variables = variables
        self.initializers = initializers
        self.type = type
        self.span = span
    }
}

public struct ConstantDeclaration {
    public var name: String
    public var value: ExpressionNode
    public var span: SourceSpan
    
    public init(name: String, value: ExpressionNode, span: SourceSpan = .unknown) {
        self.name = name
        self.value = value
        self.span = span
    }
}

public struct AssignmentNode {
    public var target: ExpressionNode
    public var value: ExpressionNode
    public var span: SourceSpan
    
    public init(target: ExpressionNode, value: ExpressionNode, span: SourceSpan = .unknown) {
        self.target = target
        self.value = value
        self.span = span
    }
}

public struct IfNode {
    public var condition: ExpressionNode
    public var thenBranch: [StatementNode]
    public var elseIfs: [(ExpressionNode, [StatementNode])]
    public var elseBranch: [StatementNode]
    public var span: SourceSpan
    
    public init(condition: ExpressionNode, thenBranch: [StatementNode], elseIfs: [(ExpressionNode, [StatementNode])] = [], elseBranch: [StatementNode] = [], span: SourceSpan = .unknown) {
        self.condition = condition
        self.thenBranch = thenBranch
        self.elseIfs = elseIfs
        self.elseBranch = elseBranch
        self.span = span
    }
}

public struct WhileNode {
    public var condition: ExpressionNode
    public var body: [StatementNode]
    public var span: SourceSpan
    
    public init(condition: ExpressionNode, body: [StatementNode], span: SourceSpan = .unknown) {
        self.condition = condition
        self.body = body
        self.span = span
    }
}

public struct ForNode {
    public var variable: IdentifierNode
    public var startValue: ExpressionNode
    public var endValue: ExpressionNode
    public var stepValue: ExpressionNode?
    public var body: [StatementNode]
    public var span: SourceSpan
    
    public init(variable: IdentifierNode, startValue: ExpressionNode, endValue: ExpressionNode, stepValue: ExpressionNode? = nil, body: [StatementNode], span: SourceSpan = .unknown) {
        self.variable = variable
        self.startValue = startValue
        self.endValue = endValue
        self.stepValue = stepValue
        self.body = body
        self.span = span
    }
}

public struct ForEachNode {
    public var iteratorName: String
    public var typeName: String
    public var body: [StatementNode]
    public var span: SourceSpan
    
    public init(iteratorName: String, typeName: String, body: [StatementNode], span: SourceSpan = .unknown) {
        self.iteratorName = iteratorName
        self.typeName = typeName
        self.body = body
        self.span = span
    }
}

public struct RepeatNode {
    public var body: [StatementNode]
    public var condition: ExpressionNode
    public var span: SourceSpan
    
    public init(body: [StatementNode], condition: ExpressionNode, span: SourceSpan = .unknown) {
        self.body = body
        self.condition = condition
        self.span = span
    }
}

public struct TypeDeclarationNode {
    public var typeName: String
    public var variable: IdentifierNode
    public var fields: [FieldNode]
    public var span: SourceSpan
    
    public init(typeName: String, variable: IdentifierNode, fields: [FieldNode] = [], span: SourceSpan = .unknown) {
        self.typeName = typeName
        self.variable = variable
        self.fields = fields
        self.span = span
    }
}

public indirect enum ExpressionNode {
    case binary(BinaryOpNode, SourceSpan)
    case unary(UnaryOpNode, SourceSpan)
    case integerLiteral(Int, SourceSpan)
    case floatLiteral(Double, SourceSpan)
    case stringLiteral(String, SourceSpan)
    case identifier(IdentifierNode, SourceSpan)
    case functionCall(FunctionCallNode, SourceSpan)
    case arrayAccess(ArrayAccessNode, SourceSpan)
    case fieldAccess(FieldAccessNode, SourceSpan)
    case typeCast(TypeCastNode, SourceSpan)
    case new(String, SourceSpan)
    // Type collection operations
    case first(String, SourceSpan)       // First TypeName - returns first instance of type
    case last(String, SourceSpan)        // Last TypeName - returns last instance of type
    case before(ExpressionNode, SourceSpan)  // Before expr - returns previous instance in list
    case after(ExpressionNode, SourceSpan)   // After expr - returns next instance in list
    case handle(ExpressionNode, SourceSpan)  // Handle(expr) - converts type instance to integer handle
    case objectCast(String, ExpressionNode, SourceSpan)  // Object.TypeName(handle) - converts handle to type
    
    public var span: SourceSpan {
        switch self {
        case .binary(_, let s),
             .unary(_, let s),
             .integerLiteral(_, let s),
             .floatLiteral(_, let s),
             .stringLiteral(_, let s),
             .identifier(_, let s),
             .functionCall(_, let s),
             .arrayAccess(_, let s),
             .fieldAccess(_, let s),
             .typeCast(_, let s),
             .new(_, let s),
             .first(_, let s),
             .last(_, let s),
             .before(_, let s),
             .after(_, let s),
             .handle(_, let s),
             .objectCast(_, _, let s):
            return s
        }
    }
}

public struct BinaryOpNode {
    public var left: ExpressionNode
    public var op: String
    public var right: ExpressionNode
    public var span: SourceSpan
    
    public init(left: ExpressionNode, op: String, right: ExpressionNode, span: SourceSpan = .unknown) {
        self.left = left
        self.op = op
        self.right = right
        self.span = span
    }
}

public struct UnaryOpNode {
    public var op: String
    public var expression: ExpressionNode
    public var span: SourceSpan
    
    public init(op: String, expression: ExpressionNode, span: SourceSpan = .unknown) {
        self.op = op
        self.expression = expression
        self.span = span
    }
}

public struct IdentifierNode {
    public var name: String
    public var typeSuffix: TypeSuffix?
    public var typeName: String?
    public var span: SourceSpan
    
    public init(name: String, typeSuffix: TypeSuffix? = nil, typeName: String? = nil, span: SourceSpan = .unknown) {
        self.name = name
        self.typeSuffix = typeSuffix
        self.typeName = typeName
        self.span = span
    }
}

public enum TypeSuffix: String {
    case integer = "%"
    case float = "#"
    case string = "$"
}

public struct FunctionCallNode {
    public var name: String
    public var arguments: [ExpressionNode]
    public var span: SourceSpan
    
    public init(name: String, arguments: [ExpressionNode] = [], span: SourceSpan = .unknown) {
        self.name = name
        self.arguments = arguments
        self.span = span
    }
}

public struct ArrayAccessNode {
    public var array: ExpressionNode
    public var indices: [ExpressionNode]
    public var span: SourceSpan
    
    public init(array: ExpressionNode, indices: [ExpressionNode], span: SourceSpan = .unknown) {
        self.array = array
        self.indices = indices
        self.span = span
    }
}

public struct FieldAccessNode {
    public var object: ExpressionNode
    public var field: String
    public var span: SourceSpan
    
    public init(object: ExpressionNode, field: String, span: SourceSpan = .unknown) {
        self.object = object
        self.field = field
        self.span = span
    }
}

public struct TypeCastNode {
    public var expression: ExpressionNode
    public var targetType: TypeAnnotation
    public var span: SourceSpan
    
    public init(expression: ExpressionNode, targetType: TypeAnnotation, span: SourceSpan = .unknown) {
        self.expression = expression
        self.targetType = targetType
        self.span = span
    }
}

public enum TypeAnnotation: String {
    case integer = "Int"
    case float = "Float"
    case string = "String"
    case void = "void"
}

public struct ProgramNode {
    public var statements: [StatementNode]
    public var functions: [FunctionNode]
    public var types: [TypeNode]
    
    public init(statements: [StatementNode] = [], functions: [FunctionNode] = [], types: [TypeNode] = []) {
        self.statements = statements
        self.functions = functions
        self.types = types
    }
}

public struct FunctionNode {
    public var name: String
    public var parameters: [ParameterNode]
    public var body: [StatementNode]
    public var returnType: TypeAnnotation?
    public var explicitReturnTypeSuffix: Bool  // true if suffix was explicitly written
    public var span: SourceSpan
    
    public init(name: String, parameters: [ParameterNode] = [], body: [StatementNode] = [], returnType: TypeAnnotation? = nil, explicitReturnTypeSuffix: Bool = false, span: SourceSpan = .unknown) {
        self.name = name
        self.parameters = parameters
        self.body = body
        self.returnType = returnType
        self.explicitReturnTypeSuffix = explicitReturnTypeSuffix
        self.span = span
    }
}

public struct ParameterNode {
    public var name: String
    public var type: TypeAnnotation?
    public var span: SourceSpan
    
    public init(name: String, type: TypeAnnotation? = nil, span: SourceSpan = .unknown) {
        self.name = name
        self.type = type
        self.span = span
    }
}

public struct TypeNode {
    public var name: String
    public var fields: [FieldNode]
    public var span: SourceSpan
    
    public init(name: String, fields: [FieldNode] = [], span: SourceSpan = .unknown) {
        self.name = name
        self.fields = fields
        self.span = span
    }
}

public struct FieldNode {
    public var name: String
    public var type: TypeAnnotation?
    public var dimensions: [ExpressionNode]
    public var defaultValue: ExpressionNode?
    
    public init(name: String, type: TypeAnnotation? = nil, dimensions: [ExpressionNode] = [], defaultValue: ExpressionNode? = nil) {
        self.name = name
        self.type = type
        self.dimensions = dimensions
        self.defaultValue = defaultValue
    }
}

public enum DataValue {
    case integer(Int)
    case float(Double)
    case string(String)
}
