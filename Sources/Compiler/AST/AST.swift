//
//  AST.swift
//  Blitz3DCompiler
//
//  Abstract Syntax Tree node types for Blitz3D BASIC
//

public indirect enum StatementNode {
    case local(LocalDeclaration)
    case global(GlobalDeclaration)
    case constant(ConstantDeclaration)
    case constants([ConstantDeclaration])
    case dim(DimDeclaration)
    case function(FunctionNode)
    case assignment(AssignmentNode)
    case ifStatement(IfNode)
    case whileLoop(WhileNode)
    case forLoop(ForNode)
    case forEach(ForEachNode)
    case repeatLoop(RepeatNode)
    case returnStatement(ExpressionNode?)
    case exit
    case goto(String)
    case gosub(String)
    case functionCall(FunctionCallNode)
    case typeDeclaration(TypeDeclarationNode)
    case select(SelectNode)
    case data([DataValue])
    case read([IdentifierNode])
    case restore(String?)
    case label(String)
    case delete(ExpressionNode)  // Delete expr - removes instance from type collection
    case insert(ExpressionNode, InsertPosition)  // Insert a Before/After b
    case empty
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

    public init(variables: [IdentifierNode], initializers: [String: ExpressionNode] = [:], type: TypeAnnotation? = nil) {
        self.variables = variables
        self.initializers = initializers
        self.type = type
    }
}

public struct DimDeclaration {
    public var name: String
    public var typeName: String?
    public var dimensions: [ExpressionNode]
    
    public init(name: String, typeName: String? = nil, dimensions: [ExpressionNode]) {
        self.name = name
        self.typeName = typeName
        self.dimensions = dimensions
    }
}

public struct GlobalDeclaration {
    public var variables: [IdentifierNode]
    public var initializers: [String: ExpressionNode]
    public var type: TypeAnnotation?

    public init(variables: [IdentifierNode], initializers: [String: ExpressionNode] = [:], type: TypeAnnotation? = nil) {
        self.variables = variables
        self.initializers = initializers
        self.type = type
    }
}

public struct ConstantDeclaration {
    public var name: String
    public var value: ExpressionNode
    
    public init(name: String, value: ExpressionNode) {
        self.name = name
        self.value = value
    }
}

public struct AssignmentNode {
    public var target: ExpressionNode
    public var value: ExpressionNode
    
    public init(target: ExpressionNode, value: ExpressionNode) {
        self.target = target
        self.value = value
    }
}

public struct IfNode {
    public var condition: ExpressionNode
    public var thenBranch: [StatementNode]
    public var elseIfs: [(ExpressionNode, [StatementNode])]
    public var elseBranch: [StatementNode]
    
    public init(condition: ExpressionNode, thenBranch: [StatementNode], elseIfs: [(ExpressionNode, [StatementNode])] = [], elseBranch: [StatementNode] = []) {
        self.condition = condition
        self.thenBranch = thenBranch
        self.elseIfs = elseIfs
        self.elseBranch = elseBranch
    }
}

public struct WhileNode {
    public var condition: ExpressionNode
    public var body: [StatementNode]
    
    public init(condition: ExpressionNode, body: [StatementNode]) {
        self.condition = condition
        self.body = body
    }
}

public struct ForNode {
    public var variable: IdentifierNode
    public var startValue: ExpressionNode
    public var endValue: ExpressionNode
    public var stepValue: ExpressionNode?
    public var body: [StatementNode]
    
    public init(variable: IdentifierNode, startValue: ExpressionNode, endValue: ExpressionNode, stepValue: ExpressionNode? = nil, body: [StatementNode]) {
        self.variable = variable
        self.startValue = startValue
        self.endValue = endValue
        self.stepValue = stepValue
        self.body = body
    }
}

public struct ForEachNode {
    public var iteratorName: String
    public var typeName: String
    public var body: [StatementNode]
    
    public init(iteratorName: String, typeName: String, body: [StatementNode]) {
        self.iteratorName = iteratorName
        self.typeName = typeName
        self.body = body
    }
}

public struct RepeatNode {
    public var body: [StatementNode]
    public var condition: ExpressionNode
    
    public init(body: [StatementNode], condition: ExpressionNode) {
        self.body = body
        self.condition = condition
    }
}

public struct TypeDeclarationNode {
    public var typeName: String
    public var variable: IdentifierNode
    public var fields: [FieldNode]
    
    public init(typeName: String, variable: IdentifierNode, fields: [FieldNode] = []) {
        self.typeName = typeName
        self.variable = variable
        self.fields = fields
    }
}

public indirect enum ExpressionNode {
    case binary(BinaryOpNode)
    case unary(UnaryOpNode)
    case integerLiteral(Int)
    case floatLiteral(Double)
    case stringLiteral(String)
    case identifier(IdentifierNode)
    case functionCall(FunctionCallNode)
    case arrayAccess(ArrayAccessNode)
    case fieldAccess(FieldAccessNode)
    case typeCast(TypeCastNode)
    case new(String)
    // Type collection operations
    case first(String)       // First TypeName - returns first instance of type
    case last(String)        // Last TypeName - returns last instance of type
    case before(ExpressionNode)  // Before expr - returns previous instance in list
    case after(ExpressionNode)   // After expr - returns next instance in list
    case handle(ExpressionNode)  // Handle(expr) - converts type instance to integer handle
    case objectCast(String, ExpressionNode)  // Object.TypeName(handle) - converts handle to type
}

public struct BinaryOpNode {
    public var left: ExpressionNode
    public var op: String
    public var right: ExpressionNode
    
    public init(left: ExpressionNode, op: String, right: ExpressionNode) {
        self.left = left
        self.op = op
        self.right = right
    }
}

public struct UnaryOpNode {
    public var op: String
    public var expression: ExpressionNode
    
    public init(op: String, expression: ExpressionNode) {
        self.op = op
        self.expression = expression
    }
}

public struct IdentifierNode {
    public var name: String
    public var typeSuffix: TypeSuffix?
    public var typeName: String?
    
    public init(name: String, typeSuffix: TypeSuffix? = nil, typeName: String? = nil) {
        self.name = name
        self.typeSuffix = typeSuffix
        self.typeName = typeName
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
    
    public init(name: String, arguments: [ExpressionNode] = []) {
        self.name = name
        self.arguments = arguments
    }
}

public struct ArrayAccessNode {
    public var array: ExpressionNode
    public var indices: [ExpressionNode]
    
    public init(array: ExpressionNode, indices: [ExpressionNode]) {
        self.array = array
        self.indices = indices
    }
}

public struct FieldAccessNode {
    public var object: ExpressionNode
    public var field: String
    
    public init(object: ExpressionNode, field: String) {
        self.object = object
        self.field = field
    }
}

public struct TypeCastNode {
    public var expression: ExpressionNode
    public var targetType: TypeAnnotation
    
    public init(expression: ExpressionNode, targetType: TypeAnnotation) {
        self.expression = expression
        self.targetType = targetType
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
    
    public init(name: String, parameters: [ParameterNode] = [], body: [StatementNode] = [], returnType: TypeAnnotation? = nil, explicitReturnTypeSuffix: Bool = false) {
        self.name = name
        self.parameters = parameters
        self.body = body
        self.returnType = returnType
        self.explicitReturnTypeSuffix = explicitReturnTypeSuffix
    }
}

public struct ParameterNode {
    public var name: String
    public var type: TypeAnnotation?
    
    public init(name: String, type: TypeAnnotation? = nil) {
        self.name = name
        self.type = type
    }
}

public struct TypeNode {
    public var name: String
    public var fields: [FieldNode]
    
    public init(name: String, fields: [FieldNode] = []) {
        self.name = name
        self.fields = fields
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
