//
//  Parser.swift
//  Blitz3DCompiler
//
//  Recursive descent parser for Blitz3D BASIC
//

/// Represents a parsing error with location information
public struct ParseError: CustomStringConvertible {
    public let message: String
    public let line: Int
    public let column: Int
    public let sourceFile: String

    public var description: String {
        return "\(sourceFile):\(line):\(column): error: \(message)"
    }

    public init(message: String, line: Int, column: Int, sourceFile: String) {
        self.message = message
        self.line = line
        self.column = column
        self.sourceFile = sourceFile
    }

    public init(message: String, token: Token) {
        self.message = message
        self.line = token.line
        self.column = token.column
        self.sourceFile = token.sourceFile
    }
}

public struct Parser {
    private var lexer: Lexer
    private var currentToken: Token
    private var previousToken: Token
    private var sourceFile: String
    private(set) public var errors: [ParseError] = []

    public init(source: String, sourceFile: String = "unknown") {
        self.lexer = Lexer(source: source, sourceFile: sourceFile)
        self.sourceFile = sourceFile
        self.currentToken = Token(type: .endOfFile, text: "", line: 1, column: 1, sourceFile: sourceFile)
        self.previousToken = self.currentToken
        self.currentToken = self.lexer.nextToken()
    }

    /// Reports an error at the current token position
    private mutating func reportError(_ message: String) {
        errors.append(ParseError(message: message, token: currentToken))
    }

    /// Reports an error with a specific token
    private mutating func reportError(_ message: String, at token: Token) {
        errors.append(ParseError(message: message, token: token))
    }

    /// Attempts to synchronize to a known good state after an error
    private mutating func synchronize() {
        // Skip tokens until we find a statement boundary
        while currentToken.type != .endOfFile {
            // Stop at newlines (statement boundaries)
            if currentToken.type == .newline {
                advance()
                return
            }
            // Stop before keywords that start statements
            switch currentToken.type {
            case .keywordIf, .keywordWhile, .keywordFor, .keywordRepeat,
                 .keywordFunction, .keywordType, .keywordSelect,
                 .keywordLocal, .keywordGlobal, .keywordConst, .keywordDim,
                 .keywordReturn, .keywordExit, .keywordGoto, .keywordGosub:
                return
            default:
                advance()
            }
        }
    }

    /// Returns true if there were any parsing errors
    public var hasErrors: Bool {
        return !errors.isEmpty
    }

    /// Validates the parsed program for semantic errors
    /// Call this after parse() to check for label validation, etc.
    public mutating func validate(_ program: ProgramNode) {
        var labels = Set<String>()
        var gotoTargets: [(String, Int, Int, String)] = []  // (name, line, column, sourceFile)
        var gosubTargets: [(String, Int, Int, String)] = []

        // Collect constant names for validation
        var constantNames = Set<String>()
        for statement in program.statements {
            collectConstantNames(from: statement, constants: &constantNames)
        }

        // Collect labels and goto/gosub targets from main statements
        collectLabelsAndTargets(from: program.statements, labels: &labels, gotoTargets: &gotoTargets, gosubTargets: &gosubTargets)

        // Collect from function bodies
        for function in program.functions {
            collectLabelsAndTargets(from: function.body, labels: &labels, gotoTargets: &gotoTargets, gosubTargets: &gosubTargets)
        }

        // Validate Goto targets
        for (target, line, column, file) in gotoTargets {
            if !labels.contains(target) {
                errors.append(ParseError(message: "Goto target '\(target)' not found", line: line, column: column, sourceFile: file))
            }
        }

        // Validate Gosub targets
        for (target, line, column, file) in gosubTargets {
            if !labels.contains(target) {
                errors.append(ParseError(message: "Gosub target '\(target)' not found", line: line, column: column, sourceFile: file))
            }
        }

        // Validate Case values are constants
        validateCaseConstants(in: program.statements, constants: constantNames)
        for function in program.functions {
            validateCaseConstants(in: function.body, constants: constantNames)
        }
    }

    /// Collects constant names from statements
    private func collectConstantNames(from statement: StatementNode, constants: inout Set<String>) {
        switch statement {
        case .constant(let decl, _):
            constants.insert(decl.name)
        case .constants(let decls, _):
            for decl in decls {
                constants.insert(decl.name)
            }
        default:
            break
        }
    }

    /// Validates that Case values are constant expressions
    private mutating func validateCaseConstants(in statements: [StatementNode], constants: Set<String>) {
        for statement in statements {
            validateCaseConstantsRecursive(in: statement, constants: constants)
        }
    }

    /// Recursively validates Case constants in a statement
    private mutating func validateCaseConstantsRecursive(in statement: StatementNode, constants: Set<String>) {
        switch statement {
        case .select(let selectNode, _):
            for caseNode in selectNode.cases {
                for value in caseNode.values {
                    switch value {
                    case .single(let expr):
                        if !isConstantExpression(expr, constants: constants) {
                            errors.append(ParseError(
                                message: "Case value must be a constant expression",
                                line: 0, column: 0, sourceFile: sourceFile
                            ))
                        }
                    case .range(let start, let end):
                        if !isConstantExpression(start, constants: constants) {
                            errors.append(ParseError(
                                message: "Case range start must be a constant expression",
                                line: 0, column: 0, sourceFile: sourceFile
                            ))
                        }
                        if !isConstantExpression(end, constants: constants) {
                            errors.append(ParseError(
                                message: "Case range end must be a constant expression",
                                line: 0, column: 0, sourceFile: sourceFile
                            ))
                        }
                    }
                }
                // Also validate nested statements in case body
                validateCaseConstants(in: caseNode.body, constants: constants)
            }
            if let defaultCase = selectNode.defaultCase {
                validateCaseConstants(in: defaultCase, constants: constants)
            }

        case .ifStatement(let ifNode, _):
            validateCaseConstants(in: ifNode.thenBranch, constants: constants)
            for (_, branch) in ifNode.elseIfs {
                validateCaseConstants(in: branch, constants: constants)
            }
            validateCaseConstants(in: ifNode.elseBranch, constants: constants)

        case .whileLoop(let whileNode, _):
            validateCaseConstants(in: whileNode.body, constants: constants)

        case .forLoop(let forNode, _):
            validateCaseConstants(in: forNode.body, constants: constants)

        case .forEach(let forEachNode, _):
            validateCaseConstants(in: forEachNode.body, constants: constants)

        case .repeatLoop(let repeatNode, _):
            validateCaseConstants(in: repeatNode.body, constants: constants)

        default:
            break
        }
    }

    /// Checks if an expression is a constant (literal, const, or binary/unary on constants)
    private func isConstantExpression(_ expr: ExpressionNode, constants: Set<String>) -> Bool {
        switch expr {
        case .integerLiteral, .floatLiteral, .stringLiteral:
            return true

        case .identifier(let id, _):
            // Check if it's a known constant
            return constants.contains(id.name)

        case .unary(let unaryOp, _):
            return isConstantExpression(unaryOp.expression, constants: constants)

        case .binary(let binaryOp, _):
            return isConstantExpression(binaryOp.left, constants: constants) &&
                   isConstantExpression(binaryOp.right, constants: constants)

        default:
            return false
        }
    }

    /// Helper to collect labels and goto/gosub targets from statements
    private func collectLabelsAndTargets(
        from statements: [StatementNode],
        labels: inout Set<String>,
        gotoTargets: inout [(String, Int, Int, String)],
        gosubTargets: inout [(String, Int, Int, String)]
    ) {
        for statement in statements {
            collectLabelsAndTargetsRecursive(from: statement, labels: &labels, gotoTargets: &gotoTargets, gosubTargets: &gosubTargets)
        }
    }

    /// Recursively collect labels and targets from a statement
    private func collectLabelsAndTargetsRecursive(
        from statement: StatementNode,
        labels: inout Set<String>,
        gotoTargets: inout [(String, Int, Int, String)],
        gosubTargets: inout [(String, Int, Int, String)]
    ) {
        switch statement {
        case .label(let name, _):
            labels.insert(name)

        case .goto(let name, _):
            // We don't have exact token info here, so use defaults
            gotoTargets.append((name, 0, 0, sourceFile))

        case .gosub(let name, _):
            gosubTargets.append((name, 0, 0, sourceFile))

        case .ifStatement(let ifNode, _):
            collectLabelsAndTargets(from: ifNode.thenBranch, labels: &labels, gotoTargets: &gotoTargets, gosubTargets: &gosubTargets)
            for (_, elseIfBranch) in ifNode.elseIfs {
                collectLabelsAndTargets(from: elseIfBranch, labels: &labels, gotoTargets: &gotoTargets, gosubTargets: &gosubTargets)
            }
            collectLabelsAndTargets(from: ifNode.elseBranch, labels: &labels, gotoTargets: &gotoTargets, gosubTargets: &gosubTargets)

        case .whileLoop(let whileNode, _):
            collectLabelsAndTargets(from: whileNode.body, labels: &labels, gotoTargets: &gotoTargets, gosubTargets: &gosubTargets)

        case .forLoop(let forNode, _):
            collectLabelsAndTargets(from: forNode.body, labels: &labels, gotoTargets: &gotoTargets, gosubTargets: &gosubTargets)

        case .forEach(let forEachNode, _):
            collectLabelsAndTargets(from: forEachNode.body, labels: &labels, gotoTargets: &gotoTargets, gosubTargets: &gosubTargets)

        case .repeatLoop(let repeatNode, _):
            collectLabelsAndTargets(from: repeatNode.body, labels: &labels, gotoTargets: &gotoTargets, gosubTargets: &gosubTargets)

        case .select(let selectNode, _):
            for caseNode in selectNode.cases {
                collectLabelsAndTargets(from: caseNode.body, labels: &labels, gotoTargets: &gotoTargets, gosubTargets: &gosubTargets)
            }
            if let defaultCase = selectNode.defaultCase {
                collectLabelsAndTargets(from: defaultCase, labels: &labels, gotoTargets: &gotoTargets, gosubTargets: &gosubTargets)
            }

        default:
            break
        }
    }

    public mutating func parse() -> ProgramNode {
        var program = ProgramNode()
        var globalCount = 0
        var functionCount = 0

        var statementCount = 0
        while currentToken.type != .endOfFile {
            let startToken = currentToken
            statementCount += 1
            
            if currentToken.type == .newline {
                advance()
                continue
            }

            if let statement = parseTopLevelStatement() {
                switch statement {
                case .function(let funcNode, _):
                    functionCount += 1
                    print("DEBUG_PARSER: Added function '\(funcNode.name)' (#\(functionCount))")
                    program.functions.append(funcNode)
                case .typeDeclaration(let typeDecl, _):
                    let typeNode = TypeNode(name: typeDecl.typeName, fields: typeDecl.fields)
                    program.types.append(typeNode)
                case .empty:
                    break
                case .global:
                    globalCount += 1
                    print("DEBUG_PARSER: Found Global statement #\(globalCount) (after \(functionCount) functions)")
                    program.statements.append(statement)
                default:
                    program.statements.append(statement)
                }
                
                // Handle colon-separated statements on the same line
                while currentToken.type == .colon {
                    advance() // consume the colon
                    
                    // Skip any newlines after colon (malformed but be lenient)
                    while currentToken.type == .newline {
                        advance()
                    }
                    
                    // Parse next statement on same line
                    if let nextStatement = parseTopLevelStatement() {
                        switch nextStatement {
                        case .function(let funcNode, _):
                            program.functions.append(funcNode)
                        case .typeDeclaration(let typeDecl, _):
                            let typeNode = TypeNode(name: typeDecl.typeName, fields: typeDecl.fields)
                            program.types.append(typeNode)
                        case .empty:
                            break
                        default:
                            program.statements.append(nextStatement)
                        }
                    } else {
                        break
                    }
                }
            } else {
                // parseTopLevelStatement() returned nil - this is the problem!
                print("ERROR: parseTopLevelStatement() returned nil!")
                print("  Statement #\(statementCount)")
                print("  Token: type=\(currentToken.type) text='\(currentToken.text)'")
                print("  Position: After \(functionCount) functions, \(globalCount) globals")
                print("  Started at: type=\(startToken.type) text='\(startToken.text)'")
                
                // Report error and attempt recovery
                if currentToken.type != .endOfFile {
                    reportError("Unexpected token '\(currentToken.text)'")
                    synchronize()
                } else {
                    print("  Reason: EOF reached")
                    break  // Normal termination
                }
            }
        }

        print("DEBUG_PARSER: === PARSING COMPLETE ===")
        print("  Total items processed: \(statementCount)")
        print("  Functions found: \(functionCount)")
        print("  Globals found: \(globalCount)")
        print("  Final token: type=\(currentToken.type) text='\(currentToken.text)'")

        return program
    }
    
    private mutating func advance() {
        previousToken = currentToken
        currentToken = lexer.nextToken()
    }
    
    private func expect(_ type: TokenType) -> Bool {
        return currentToken.type == type
    }

    private mutating func startSpan() -> SourceLocation {
        return SourceLocation(line: currentToken.line, column: currentToken.column, sourceFile: currentToken.sourceFile)
    }

    private mutating func endSpan(from start: SourceLocation) -> SourceSpan {
        let endLoc = SourceLocation(line: previousToken.line, column: previousToken.column, sourceFile: previousToken.sourceFile)
        return SourceSpan(start: start, end: endLoc)
    }
    
    private mutating func consume(_ type: TokenType) -> Bool {
        if expect(type) {
            advance()
            return true
        }
        return false
    }
    
    private mutating func parseTopLevelStatement() -> StatementNode? {
        switch currentToken.type {
        case .keywordFunction:
            return parseFunction()
        case .keywordType:
            return parseTypeDeclaration()
        case .keywordLocal:
            return parseLocalDeclaration()
        case .keywordGlobal:
            return parseGlobalDeclaration()
        case .keywordConst:
            return parseConstantDeclaration()
        case .keywordDim:
            return parseDimDeclaration()
        case .keywordInclude:
            advance()
            if currentToken.type == .stringLiteral {
                advance()
                return .empty(endSpan(from: startSpan()))
            }
            return nil
        default:
            return parseStatement()
        }
    }
    
    private mutating func parseFunction() -> StatementNode? {
        let start = startSpan()
        advance() // consume 'Function'

        guard expect(.identifier) else {
            reportError("Expected function name after 'Function'")
            return nil
        }
        var name = currentToken.text
        var returnType: TypeAnnotation? = nil
        var explicitReturnTypeSuffix = false

        // Parse return type from function name suffix
        if name.hasSuffix("%") {
            returnType = .integer
            explicitReturnTypeSuffix = true
            name = String(name.dropLast())
        } else if name.hasSuffix("#") {
            returnType = .float
            explicitReturnTypeSuffix = true
            name = String(name.dropLast())
        } else if name.hasSuffix("$") {
            returnType = .string
            explicitReturnTypeSuffix = true
            name = String(name.dropLast())
        }
        advance()

        var parameters: [ParameterNode] = []
        if consume(.leftParen) {
            if !expect(.rightParen) {
                while true {
                    if expect(.identifier) {
                        let paramStart = startSpan()
                        var paramName = currentToken.text
                        var paramType: TypeAnnotation? = nil

                        // Parse type suffix from parameter name
                        if paramName.hasSuffix("%") {
                            paramType = .integer
                            paramName = String(paramName.dropLast())
                        } else if paramName.hasSuffix("#") {
                            paramType = .float
                            paramName = String(paramName.dropLast())
                        } else if paramName.hasSuffix("$") {
                            paramType = .string
                            paramName = String(paramName.dropLast())
                        }

                        advance()

                        // Also check for explicit type annotation (param.TypeName)
                        if consume(.period) {
                            if expect(.identifier) {
                                let typeName = currentToken.text
                                if let annotation = TypeAnnotation(rawValue: typeName) {
                                    paramType = annotation
                                }
                                advance()
                            }
                        }

                        parameters.append(ParameterNode(name: paramName, type: paramType, span: endSpan(from: paramStart)))
                        if consume(.comma) {
                            continue
                        }
                    }
                    break
                }
            }
            _ = consume(.rightParen)
        }
        
        var body: [StatementNode] = []
        print("DEBUG: Parsing function '\(name)' body...")
        var iterationCount = 0
        while !isEndFunction() && !expect(.endOfFile) {
            iterationCount += 1
            if iterationCount > 1000 {
                print("ERROR: Function body loop exceeded 1000 iterations!")
                break
            }
            
            // Skip newlines in function body
            if currentToken.type == .newline {
                advance()
                continue
            }
            
            if let stmt = parseStatement() {
                if name == "UpdateLauncher" && body.count >= 15 {
                    print("  Statement #\(body.count + 1): \(stmt), currentToken now at line \(currentToken.line)")
                }
                body.append(stmt)
                
                // Handle colon-separated statements on the same line
                while currentToken.type == .colon {
                    advance() // consume the colon
                    
                    // Skip any newlines after colon
                    while currentToken.type == .newline {
                        advance()
                    }
                    
                    // Check if we hit End Function
                    if isEndFunction() {
                        break
                    }
                    
                    // Parse next statement
                    if let nextStmt = parseStatement() {
                        body.append(nextStmt)
                    } else {
                        break
                    }
                }
            } else {
                // Unknown statement - report error and try to recover
                reportError("Unexpected token '\(currentToken.text)' in function body")
                advance()
            }
        }
        
        // Consume "End Function"
        _ = consume(.keywordEndFunction)
        print("DEBUG: Finished parsing function '\(name)', found \(body.count) statements in body")
        print("DEBUG: Current token after End Function: type=\(currentToken.type) text='\(currentToken.text)'")
        
        return .function(FunctionNode(name: name, parameters: parameters, body: body, returnType: returnType, explicitReturnTypeSuffix: explicitReturnTypeSuffix, span: endSpan(from: start)), endSpan(from: start))
    }
    
    private func isEndFunction() -> Bool {
        let result = currentToken.type == .keywordEndFunction
        return result
    }
    
    private mutating func parseTypeDeclaration() -> StatementNode? {
        let start = startSpan()
        advance() // consume 'Type'

        guard expect(.identifier) else {
            reportError("Expected type name after 'Type'")
            return nil
        }
        let typeName = currentToken.text
        advance()
        
        var fields: [FieldNode] = []
        
        while !isEndType() && !expect(.endOfFile) {
            if consume(.keywordField) {
                repeat {
                    if expect(.identifier) {
                        var name = currentToken.text
                        var typeAnnotation: TypeAnnotation? = nil
                        var dimensions: [ExpressionNode] = []
                        var defaultValue: ExpressionNode? = nil
                        
                        // Handle type suffix (%, #, $)
                        if name.hasSuffix("%") {
                            typeAnnotation = .integer
                            name = String(name.dropLast())
                        } else if name.hasSuffix("#") {
                            typeAnnotation = .float
                            name = String(name.dropLast())
                        } else if name.hasSuffix("$") {
                            typeAnnotation = .string
                            name = String(name.dropLast())
                        }
                        
                        advance()
                        
                        // Handle explicit Type annotation (Field x.Int)
                        if consume(.period) {
                            if expect(.identifier) {
                                let typeName = currentToken.text
                                if let annotation = TypeAnnotation(rawValue: typeName) {
                                    typeAnnotation = annotation
                                }
                                advance()
                            }
                        }
                        
                        // Handle fixed array [size]
                        if consume(.leftBracket) {
                            var dims: [ExpressionNode] = []
                            repeat {
                                let expr = parseExpression()
                                dims.append(expr)
                            } while consume(.comma)
                            _ = consume(.rightBracket)
                            dimensions = dims
                        }
                        
                        // Handle default value = expression
                        if consume(.equals) {
                            defaultValue = parseExpression()
                        }
                        
                        fields.append(FieldNode(name: name, type: typeAnnotation, dimensions: dimensions, defaultValue: defaultValue))
                    }
                } while consume(.comma)
            } else {
                advance()
            }
        }
        
        // Consume "End Type"
        if expect(.keywordEndType) {
            advance()
        } else if expect(.identifier) && currentToken.text == "End" {
            advance()
            _ = consume(.keywordType)
        }

        let span = endSpan(from: start)
        let node = TypeDeclarationNode(typeName: typeName, variable: IdentifierNode(name: typeName, span: span), fields: fields, span: span)
        return .typeDeclaration(node, span)
    }
    
    private func isEndType() -> Bool {
        if expect(.keywordEndType) { return true }
        if expect(.identifier) && currentToken.text == "End" {
            // Check next token? Can't peek easily.
            // But we can check if it's "End Type" by assuming "End" followed by "Type" is the terminator.
            // However, inside loop we rely on this.
            // Let's assume if we see "End", it might be "End Type".
            // Since "End" is not a valid field declaration start, it's safe to assume it's terminating the block if followed by Type.
            return true // Simplified check, we'll verify "Type" when consuming.
        }
        return false
    }
    
    private mutating func parseLocalDeclaration() -> StatementNode? {
        let start = startSpan()
        advance() // consume 'Local'

        var variables: [IdentifierNode] = []
        var initializers: [String: ExpressionNode] = [:]

        repeat {
            if expect(.identifier) {
                let itemStart = startSpan()
                var name = currentToken.text
                var typeSuffix: TypeSuffix? = nil
                var typeName: String? = nil

                if name.hasSuffix("%") {
                    typeSuffix = .integer
                    name = String(name.dropLast())
                } else if name.hasSuffix("#") {
                    typeSuffix = .float
                    name = String(name.dropLast())
                } else if name.hasSuffix("$") {
                    typeSuffix = .string
                    name = String(name.dropLast())
                }
                advance()

                if consume(.period) {
                    if expect(.identifier) {
                        typeName = currentToken.text
                        advance()
                    }
                }

                let id = IdentifierNode(name: name, typeSuffix: typeSuffix, typeName: typeName, span: endSpan(from: itemStart))
                variables.append(id)

                // Consume optional initializer
                if consume(.equals) {
                    let expr = parseExpression()
                    initializers[name] = expr
                }
            }
        } while consume(.comma)

        return .local(LocalDeclaration(variables: variables, initializers: initializers, span: endSpan(from: start)), endSpan(from: start))
    }
    
    private mutating func parseGlobalDeclaration() -> StatementNode? {
        let start = startSpan()
        advance() // consume 'Global'

        var variables: [IdentifierNode] = []
        var initializers: [String: ExpressionNode] = [:]

        repeat {
            if expect(.identifier) {
                let itemStart = startSpan()
                var name = currentToken.text
                var typeSuffix: TypeSuffix? = nil
                var typeName: String? = nil

                if name.hasSuffix("%") {
                    typeSuffix = .integer
                    name = String(name.dropLast())
                } else if name.hasSuffix("#") {
                    typeSuffix = .float
                    name = String(name.dropLast())
                } else if name.hasSuffix("$") {
                    typeSuffix = .string
                    name = String(name.dropLast())
                }
                advance()

                if consume(.period) {
                    if expect(.identifier) {
                        typeName = currentToken.text
                        advance()
                    }
                }

                let id = IdentifierNode(name: name, typeSuffix: typeSuffix, typeName: typeName, span: endSpan(from: itemStart))
                variables.append(id)

                // Consume optional initializer
                if consume(.equals) {
                    let expr = parseExpression()
                    initializers[name] = expr
                }
            }
        } while consume(.comma)

        return .global(GlobalDeclaration(variables: variables, initializers: initializers, span: endSpan(from: start)), endSpan(from: start))
    }
    
    private mutating func parseConstantDeclaration() -> StatementNode? {
        advance() // consume 'Const'
        
        var constants: [ConstantDeclaration] = []
        
        repeat {
            guard expect(.identifier) else {
                break
            }
            let name = currentToken.text
            advance()
            
            _ = consume(.equals)
            let value = parseExpression()
            constants.append(ConstantDeclaration(name: name, value: value, span: endSpan(from: startSpan())))
        } while consume(.comma)
        
        if constants.count == 1 {
            return .constant(constants[0], constants[0].span)
        } else {
            return .constants(constants, endSpan(from: startSpan()))
        }
    }
    
    private mutating func parseDimDeclaration() -> StatementNode? {
        let start = startSpan()
        advance() // consume 'Dim'

        guard expect(.identifier) else {
            reportError("Expected array name after 'Dim'")
            return nil
        }
        let name = currentToken.text
        advance()

        var typeName: String? = nil
        if consume(.period) {
            if expect(.identifier) {
                typeName = currentToken.text
                advance()
            }
        }

        guard consume(.leftParen) else {
            reportError("Expected '(' after array name in Dim")
            return nil
        }
        var dimensions: [ExpressionNode] = []
        repeat {
            dimensions.append(parseExpression())
        } while consume(.comma)
        _ = consume(.rightParen)
        
        return .dim(DimDeclaration(name: name, typeName: typeName, dimensions: dimensions, span: endSpan(from: start)), endSpan(from: start))
    }
    
    private mutating func parseStatement() -> StatementNode? {
        let start = startSpan()
        switch currentToken.type {
        case .keywordIf:
            return parseIfStatement()
        case .keywordWhile:
            return parseWhileStatement()
        case .keywordFor:
            return parseForStatement()
        case .keywordRepeat:
            return parseRepeatStatement()
        case .keywordLocal:
            return parseLocalDeclaration()
        case .keywordGlobal:
            return parseGlobalDeclaration()
        case .keywordConst:
            return parseConstantDeclaration()
        case .keywordDim:
            return parseDimDeclaration()
        case .keywordReturn:
            advance()
            // Check if this is a bare Return (followed by statement-ending keywords)
            if currentToken.type == .endOfFile ||
               currentToken.type == .colon ||
               currentToken.type == .keywordEndIf ||
               currentToken.type == .keywordElse ||
               currentToken.type == .keywordElseIf ||
               currentToken.type == .keywordWend ||
               currentToken.type == .keywordNext ||
               currentToken.type == .keywordUntil ||
               (currentToken.type == .identifier && currentToken.text == "End") {
                return .returnStatement(nil, endSpan(from: start))
            }
            let value = parseExpression()
            return .returnStatement(value, endSpan(from: start))
        case .keywordExit:
            advance()
            return .exit(endSpan(from: start))
        case .keywordGoto:
            advance()
            if expect(.identifier) {
                let name = currentToken.text
                advance()
                return .goto(name, endSpan(from: start))
            }
            reportError("Expected label name after 'Goto'")
            return nil
        case .keywordGosub:
            advance()
            if expect(.identifier) {
                let name = currentToken.text
                advance()
                return .gosub(name, endSpan(from: start))
            }
            reportError("Expected label name after 'Gosub'")
            return nil
        case .keywordData:
            return parseDataStatement()
        case .keywordRead:
            return parseReadStatement()
        case .keywordRestore:
            return parseRestoreStatement()
        case .keywordDelete:
            advance()
            // Check for "Delete Each TypeName" pattern
            if consume(.keywordEach) {
                if expect(.identifier) {
                    let typeName = currentToken.text
                    advance()
                    // Delete Each is handled as delete with First of type
                    let span = endSpan(from: start)
                    return .delete(.first(typeName, span), span)
                }
            }
            let expr = parseExpression()
            return .delete(expr, endSpan(from: start))
        case .keywordInsert:
            advance()
            let insertExpr = parseExpression()
            if consume(.keywordBefore) {
                let targetExpr = parseExpression()
                return .insert(insertExpr, .before(targetExpr), endSpan(from: start))
            } else if consume(.keywordAfter) {
                let targetExpr = parseExpression()
                return .insert(insertExpr, .after(targetExpr), endSpan(from: start))
            }
            return nil
        case .identifier, .keywordNew, .keywordFirst, .keywordLast:
            return parseIdentifierStatement()
        case .keywordSelect:
            return parseSelectStatement()
        case .period:
            advance()
            if expect(.identifier) {
                let name = currentToken.text
                advance()
                return .label(name, endSpan(from: start))
            }
            return nil
        default:
            return nil
        }
    }
    
    private func isStatementStart() -> Bool {
        switch currentToken.type {
        case .keywordIf, .keywordWhile, .keywordFor, .keywordRepeat,
             .keywordReturn, .keywordExit, .keywordGoto, .keywordGosub,
             .keywordSelect, .keywordData, .keywordRead, .keywordRestore,
             .keywordDelete, .keywordInsert,
             .keywordLocal, .keywordGlobal, .keywordConst, .keywordDim,
             .identifier, .keywordNew, .keywordFirst, .keywordLast:
            return true
        default:
            return false
        }
    }
    
    private mutating func parseIfStatement() -> StatementNode? {
        let start = startSpan()
        advance() // consume 'If'
        let condition = parseExpression()
        
        _ = consume(.keywordThen)
        
        var thenBranch: [StatementNode] = []
        var elseIfs: [(ExpressionNode, [StatementNode])] = []
        var elseBranch: [StatementNode] = []
        
        // Parse then branch
        if consume(.colon) || isStatementStart() {
            // Single line
            while !expect(.keywordElse) && !expect(.keywordElseIf) &&
                  !expect(.keywordEndIf) && !expect(.endOfFile) && !expect(.newline) {
                if let stmt = parseStatement() {
                    thenBranch.append(stmt)
                    
                    // Handle colon-separated statements on same line
                    while currentToken.type == .colon {
                        advance() // consume the colon
                        
                        // Check if we hit end conditions
                        if expect(.keywordElse) || expect(.keywordElseIf) || 
                           expect(.keywordEndIf) || expect(.endOfFile) || expect(.newline) {
                            break
                        }
                        
                        // Parse next statement
                        if let nextStmt = parseStatement() {
                            thenBranch.append(nextStmt)
                        } else {
                            break
                        }
                    }
                } else {
                    advance()
                }
            }
        } else {
            // Multi-line
            while !expect(.keywordElse) && !expect(.keywordElseIf) &&
                  !expect(.keywordEndIf) && !expect(.endOfFile) {
                if currentToken.type == .newline {
                    advance()
                    continue
                }
                if let stmt = parseStatement() {
                    thenBranch.append(stmt)
                } else {
                    advance()
                }
            }
        }
        
        // Check for ElseIf or Else
        while expect(.keywordElseIf) {
            advance() // consume 'ElseIf'
            let elseifCondition = parseExpression()
            _ = consume(.keywordThen)
            
            var elseifThen: [StatementNode] = []
            
            if consume(.colon) || isStatementStart() {
                 // Single line ElseIf
                 while !expect(.keywordElse) && !expect(.keywordElseIf) &&
                       !expect(.keywordEndIf) && !expect(.endOfFile) && !expect(.newline) {
                     if let stmt = parseStatement() {
                         elseifThen.append(stmt)
                         
                         // Handle colon-separated statements on same line
                         while currentToken.type == .colon {
                             advance() // consume the colon
                             
                             // Check if we hit end conditions
                             if expect(.keywordElse) || expect(.keywordElseIf) || 
                                expect(.keywordEndIf) || expect(.endOfFile) || expect(.newline) {
                                 break
                             }
                             
                             // Parse next statement
                             if let nextStmt = parseStatement() {
                                 elseifThen.append(nextStmt)
                             } else {
                                 break
                             }
                         }
                     } else {
                         advance()
                     }
                 }
            } else {
                 // Multi-line ElseIf
                 while !expect(.keywordElse) && !expect(.keywordElseIf) &&
                       !expect(.keywordEndIf) && !expect(.endOfFile) {
                     if currentToken.type == .newline {
                         advance()
                         continue
                     }
                     if let stmt = parseStatement() {
                         elseifThen.append(stmt)
                     } else {
                         advance()
                     }
                 }
            }
            elseIfs.append((elseifCondition, elseifThen))
        }
        
        if expect(.keywordElse) {
            advance() // consume 'Else'
            // Else handles both single and multi-line naturally because newline is skipped or terminates single line?
            // Actually, for Else:
            // If Single Line If: Else must be on same line.
            // If Multi Line If: Else is on new line.
            
            // Blitz3D syntax:
            // If A Then B Else C (Single line)
            // If A Then
            //   B
            // Else
            //   C
            // EndIf
            
            // My "Multi-line" check above handles it. But for Else, we need to know if we are in single line mode?
            // Actually, if we are in multi-line mode, we consumed everything until 'Else'.
            // So now we are at 'Else'.
            
            // We need to parse Else body.
            // Is Else body single line or multi line?
            // It depends on if it's followed by newline?
            // If A Then ... Else \n ... EndIf -> Multi
            // If A Then ... Else C \n -> Single
            
            if consume(.colon) || isStatementStart() {
                 // Single line Else
                 while !expect(.keywordEndIf) && !expect(.endOfFile) && !expect(.newline) {
                     if let stmt = parseStatement() {
                         elseBranch.append(stmt)
                         
                         // Handle colon-separated statements on same line
                         while currentToken.type == .colon {
                             advance() // consume the colon
                             
                             // Check if we hit end conditions
                             if expect(.keywordEndIf) || expect(.endOfFile) || expect(.newline) {
                                 break
                             }
                             
                             // Parse next statement
                             if let nextStmt = parseStatement() {
                                 elseBranch.append(nextStmt)
                             } else {
                                 break
                             }
                         }
                     } else {
                         advance()
                     }
                 }
            } else {
                 // Multi-line Else
                 while !expect(.keywordEndIf) && !expect(.endOfFile) {
                     if currentToken.type == .newline {
                         advance()
                         continue
                     }
                     if let stmt = parseStatement() {
                         elseBranch.append(stmt)
                     } else {
                         advance()
                     }
                 }
            }
        }
        
        _ = consume(.keywordEndIf)
        
        return .ifStatement(IfNode(condition: condition, thenBranch: thenBranch, elseIfs: elseIfs, elseBranch: elseBranch, span: endSpan(from: start)), endSpan(from: start))
    }
    
    private mutating func parseWhileStatement() -> StatementNode? {
        let start = startSpan()
        advance() // consume 'While'
        let condition = parseExpression()
        
        var body: [StatementNode] = []
        while !expect(.keywordWend) && !expect(.endOfFile) {
            if let stmt = parseStatement() {
                body.append(stmt)
            } else {
                advance()
            }
        }
        
        _ = consume(.keywordWend)

        let span = endSpan(from: start)
        return .whileLoop(WhileNode(condition: condition, body: body, span: span), span)
    }
    
    private mutating func parseForStatement() -> StatementNode? {
        let start = startSpan()
        advance() // consume 'For'

        guard expect(.identifier) else {
            reportError("Expected variable name after 'For'")
            return nil
        }
        let firstIdentifier = currentToken.text
        advance()
        
        // Check for ForEach pattern: "For x.Type = Each TypeName"
        if consume(.period) && expect(.identifier) {
            // Type annotation (e.g., "x.Type") - consumed but not needed since eachTypeName provides the type
            _ = currentToken.text
            advance()
            
            if consume(.equals) && expect(.keywordEach) && expect(.identifier) {
                let eachTypeName = currentToken.text
                advance()
                
                var body: [StatementNode] = []
                while !expect(.keywordNext) && !expect(.endOfFile) {
                    if let stmt = parseStatement() {
                        body.append(stmt)
                    } else {
                        advance()
                    }
                }
                
                _ = consume(.keywordNext)

                let span = endSpan(from: start)
                return .forEach(ForEachNode(iteratorName: firstIdentifier, typeName: eachTypeName, body: body, span: span), span)
            }
        }
        
        // Regular For...Next loop
        let variable = IdentifierNode(name: firstIdentifier)
        _ = consume(.equals)
        let startValue = parseExpression()
        _ = consume(.keywordTo)
        let endValue = parseExpression()
        
        var stepValue: ExpressionNode? = nil
        if expect(.keywordStep) {
            advance()
            stepValue = parseExpression()
        }
        
        var body: [StatementNode] = []
        while !expect(.keywordNext) && !expect(.endOfFile) {
            if let stmt = parseStatement() {
                body.append(stmt)
            } else {
                advance()
            }
        }
        
        _ = consume(.keywordNext)
        
        return .forLoop(ForNode(variable: variable, startValue: startValue, endValue: endValue, stepValue: stepValue, body: body, span: endSpan(from: start)), endSpan(from: start))
    }
    
    private mutating func parseRepeatStatement() -> StatementNode? {
        let start = startSpan()
        advance() // consume 'Repeat'
        
        var body: [StatementNode] = []
        while !expect(.keywordUntil) && !expect(.keywordForever) && !expect(.endOfFile) {
            if let stmt = parseStatement() {
                body.append(stmt)
            } else {
                advance()
            }
        }
        
        if expect(.keywordForever) {
            // Infinite loop - use True as condition
            _ = consume(.keywordForever)
            return .repeatLoop(RepeatNode(body: body, condition: .integerLiteral(1, .unknown), span: endSpan(from: start)), endSpan(from: start))
        }
        
        _ = consume(.keywordUntil)
        let condition = parseExpression()
        
        return .repeatLoop(RepeatNode(body: body, condition: condition, span: endSpan(from: start)), endSpan(from: start))
    }
    
    private mutating func parseDataStatement() -> StatementNode? {
        let start = startSpan()
        advance() // consume 'Data'
        
        var values: [DataValue] = []
        
        repeat {
            let value = parseDataValue()
            values.append(value)
        } while consume(.comma)
        
        return .data(values, endSpan(from: start))
    }
    
    private mutating func parseDataValue() -> DataValue {
        switch currentToken.type {
        case .integerLiteral:
            let value = Int(currentToken.text) ?? 0
            advance()
            return .integer(value)
            
        case .floatLiteral:
            let value = Double(currentToken.text) ?? 0.0
            advance()
            return .float(value)
            
        case .stringLiteral:
            let text = currentToken.text
            advance()
            return .string(text)
            
        default:
            // Try to parse as identifier (might be a constant)
            if expect(.identifier) {
                let text = currentToken.text
                advance()
                // For now, treat identifiers as string literals (they'll be resolved at runtime)
                return .string(text)
            }
            advance()
            return .integer(0)
        }
    }
    
    private mutating func parseReadStatement() -> StatementNode? {
        let start = startSpan()
        advance() // consume 'Read'
        
        var variables: [IdentifierNode] = []
        
        repeat {
            if expect(.identifier) {
                let name = currentToken.text
                var typeSuffix: TypeSuffix? = nil
                if name.hasSuffix("%") {
                    typeSuffix = .integer
                } else if name.hasSuffix("#") {
                    typeSuffix = .float
                } else if name.hasSuffix("$") {
                    typeSuffix = .string
                }
                let cleanName = name.replacingOccurrences(of: "%", with: "")
                    .replacingOccurrences(of: "#", with: "")
                    .replacingOccurrences(of: "$", with: "")
                variables.append(IdentifierNode(name: cleanName, typeSuffix: typeSuffix))
                advance()
            }
        } while consume(.comma)
        
        return .read(variables, endSpan(from: start))
    }
    
    private mutating func parseRestoreStatement() -> StatementNode? {
        let start = startSpan()
        advance() // consume 'Restore'
        
        // Optional label
        if expect(.identifier) {
            let label = currentToken.text
            advance()
            return .restore(label, endSpan(from: start))
        }
        
        return .restore(nil, endSpan(from: start))
    }
    
    private mutating func parseSelectStatement() -> StatementNode? {
        let start = startSpan()
        advance() // consume 'Select'
        let expression = parseExpression()
        
        var cases: [CaseNode] = []
        var defaultCase: [StatementNode]? = nil
        
        while !expect(.keywordEndSelect) && !expect(.endOfFile) {
            if currentToken.type == .newline {
                advance()
                continue
            }
            
            if consume(.keywordCase) {
                // Parse case values (comma separated, may include ranges with "To")
                var caseValues: [CaseValue] = []
                repeat {
                    let firstExpr = parseExpression()
                    // Check for "To" keyword indicating a range
                    if consume(.keywordTo) {
                        let secondExpr = parseExpression()
                        caseValues.append(.range(firstExpr, secondExpr))
                    } else {
                        caseValues.append(.single(firstExpr))
                    }
                } while consume(.comma)

                // Parse body until next Case, Default, or End Select
                var body: [StatementNode] = []
                while !expect(.keywordCase) && !expect(.keywordDefault) && !expect(.keywordEndSelect) && !expect(.endOfFile) {
                    if currentToken.type == .newline {
                        advance()
                        continue
                    }
                    if let stmt = parseStatement() {
                        body.append(stmt)
                    } else {
                        advance()
                    }
                }
                cases.append(CaseNode(values: caseValues, body: body))
            } else if consume(.keywordDefault) {
                var body: [StatementNode] = []
                while !expect(.keywordCase) && !expect(.keywordDefault) && !expect(.keywordEndSelect) && !expect(.endOfFile) {
                    if currentToken.type == .newline {
                        advance()
                        continue
                    }
                    if let stmt = parseStatement() {
                        body.append(stmt)
                    } else {
                        advance()
                    }
                }
                defaultCase = body
            } else {
                advance()
            }
        }
        _ = consume(.keywordEndSelect)
        
        let span = endSpan(from: start)
        return .select(SelectNode(expression: expression, cases: cases, defaultCase: defaultCase), span)
    }
    
    private mutating func parseIdentifierStatement() -> StatementNode? {
        let start = startSpan()
        let expr = parsePostfixExpression()
        
        // Check for assignment (expr = ...)
        if consume(.equals) {
            let value = parseExpression()
            return .assignment(AssignmentNode(target: expr, value: value, span: endSpan(from: start)), endSpan(from: start))
        }
        
        // If it was just a primary/postfix without assignment, it might be a function call
        // (already handled by parsePostfixExpression)
        if case .functionCall(let call, _) = expr {
            return .functionCall(call, endSpan(from: start))
        }
        
        // In Blitz3D, a function call can also be without parentheses: Print "Hello"
        if case .identifier(let id, _) = expr {
            // Check if there's an expression following it (argument)
            // But be careful not to consume next statement
            if isExpressionStart() {
                var args: [ExpressionNode] = []
                args.append(parseExpression())
                while consume(.comma) {
                    args.append(parseExpression())
                }
                return .functionCall(FunctionCallNode(name: id.name, arguments: args, span: endSpan(from: start)), endSpan(from: start))
            }
        }
        
        return nil
    }
    
    private func isExpressionStart() -> Bool {
        switch currentToken.type {
        case .integerLiteral, .floatLiteral, .stringLiteral, .identifier,
             .leftParen, .keywordNew, .keywordFirst, .keywordLast,
             .keywordTrue, .keywordFalse, .keywordNull, .keywordInt, .keywordFloat, .keywordStr:
            return true
        default:
            return false
        }
    }
    
    private mutating func parseExpression() -> ExpressionNode {
        return parseOrExpression()
    }
    
    private mutating func parseOrExpression() -> ExpressionNode {
        var left = parseAndExpression()
        
        while expect(.keywordOr) || expect(.keywordXor) {
            let startLoc = left.span.start
            let op = currentToken.text
            advance()
            let right = parseAndExpression()
            let span = endSpan(from: startLoc)
            left = .binary(BinaryOpNode(left: left, op: op, right: right, span: span), span)
        }
        
        return left
    }
    
    private mutating func parseAndExpression() -> ExpressionNode {
        var left = parseComparisonExpression()
        
        while expect(.keywordAnd) {
            let startLoc = left.span.start
            let op = currentToken.text
            advance()
            let right = parseComparisonExpression()
            let span = endSpan(from: startLoc)
            left = .binary(BinaryOpNode(left: left, op: op, right: right, span: span), span)
        }
        
        return left
    }
    
    private mutating func parseComparisonExpression() -> ExpressionNode {
        var left = parseShiftExpression()
        
        if expect(.equals) || expect(.notEquals) || expect(.lessThan) ||
           expect(.greaterThan) || expect(.lessThanOrEqual) || expect(.greaterThanOrEqual) {
            let startLoc = left.span.start
            let op = currentToken.text
            advance()
            let right = parseShiftExpression()
            let span = endSpan(from: startLoc)
            left = .binary(BinaryOpNode(left: left, op: op, right: right, span: span), span)
        }
        
        return left
    }
    
    private mutating func parseShiftExpression() -> ExpressionNode {
        var left = parseAddSubExpression()
        
        while expect(.keywordShl) || expect(.keywordShr) || expect(.keywordSar) {
            let startLoc = left.span.start
            let op = currentToken.text
            advance()
            let right = parseAddSubExpression()
            let span = endSpan(from: startLoc)
            left = .binary(BinaryOpNode(left: left, op: op, right: right, span: span), span)
        }
        
        return left
    }
    
    private mutating func parseAddSubExpression() -> ExpressionNode {
        var left = parseMulDivModExpression()
        
        while expect(.plus) || expect(.minus) {
            let startLoc = left.span.start
            let op = currentToken.text
            advance()
            let right = parseMulDivModExpression()
            let span = endSpan(from: startLoc)
            left = .binary(BinaryOpNode(left: left, op: op, right: right, span: span), span)
        }
        
        return left
    }
    
    private mutating func parseMulDivModExpression() -> ExpressionNode {
        var left = parseUnaryExpression()
        
        while expect(.multiply) || expect(.divide) || expect(.keywordMod) {
            let startLoc = left.span.start
            let op = currentToken.text
            advance()
            let right = parseUnaryExpression()
            let span = endSpan(from: startLoc)
            left = .binary(BinaryOpNode(left: left, op: op, right: right, span: span), span)
        }
        
        return left
    }
    
    private mutating func parseUnaryExpression() -> ExpressionNode {
        let start = startSpan()
        if expect(.minus) {
            advance()
            let expr = parseUnaryExpression()
            return .unary(UnaryOpNode(op: "-", expression: expr, span: endSpan(from: start)), endSpan(from: start))
        }
        
        if expect(.keywordNot) {
            advance()
            let expr = parseUnaryExpression()
            return .unary(UnaryOpNode(op: "Not", expression: expr, span: endSpan(from: start)), endSpan(from: start))
        }
        
        return parsePostfixExpression()
    }
    
    private mutating func parsePostfixExpression() -> ExpressionNode {
        var expr = parsePrimary()
        
        while true {
            if consume(.backslash) {
                let startLoc = expr.span.start
                // Field names can be identifiers or keywords in Blitz3D
                if expect(.identifier) || expect(.keywordField) || expect(.keywordNew) ||
                   expect(.keywordFirst) || expect(.keywordLast) || expect(.keywordDelete) {
                    let field = currentToken.text
                    advance()
                    let span = endSpan(from: startLoc)
                    let node = FieldAccessNode(object: expr, field: field, span: span)
                    expr = .fieldAccess(node, span)
                    continue
                }
            }
            
            if expect(.leftParen) {
                let startLoc = expr.span.start
                var args: [ExpressionNode] = []
                _ = consume(.leftParen)
                if !expect(.rightParen) {
                    while true {
                        args.append(parseExpression())
                        if consume(.comma) {
                            continue
                        }
                        break
                    }
                }
                _ = consume(.rightParen)
                
                // Get function name from identifier
                if case .identifier(let id, _) = expr {
                    let span = endSpan(from: startLoc)
                    let node = FunctionCallNode(name: id.name, arguments: args, span: span)
                    expr = .functionCall(node, span)
                }
                continue
            }
            
            if expect(.leftBracket) {
                let startLoc = expr.span.start
                var indices: [ExpressionNode] = []
                _ = consume(.leftBracket)
                if !expect(.rightBracket) {
                    while true {
                        indices.append(parseExpression())
                        if consume(.comma) {
                            continue
                        }
                        break
                    }
                }
                _ = consume(.rightBracket)
                let span = endSpan(from: startLoc)
                let node = ArrayAccessNode(array: expr, indices: indices, span: span)
                expr = .arrayAccess(node, span)
                continue
            }
            
            break
        }
        
        return expr
    }
    
    private mutating func parsePrimary() -> ExpressionNode {
        let start = startSpan()
        switch currentToken.type {
        case .integerLiteral:
            let value = Int(currentToken.text) ?? 0
            advance()
            return .integerLiteral(value, endSpan(from: start))
            
        case .floatLiteral:
            let value = Double(currentToken.text) ?? 0.0
            advance()
            return .floatLiteral(value, endSpan(from: start))
            
        case .stringLiteral:
            let text = currentToken.text
            advance()
            return .stringLiteral(text, endSpan(from: start))
            
        case .identifier:
            var name = currentToken.text
            var typeSuffix: TypeSuffix? = nil
            if name.hasSuffix("%") {
                typeSuffix = .integer
                name = String(name.dropLast())
            } else if name.hasSuffix("#") {
                typeSuffix = .float
                name = String(name.dropLast())
            } else if name.hasSuffix("$") {
                typeSuffix = .string
                name = String(name.dropLast())
            }
            advance()
            return .identifier(IdentifierNode(name: name, typeSuffix: typeSuffix, span: endSpan(from: start)), endSpan(from: start))
            
        case .keywordTrue:
            advance()
            return .integerLiteral(1, endSpan(from: start))
            
        case .keywordFalse:
            advance()
            return .integerLiteral(0, endSpan(from: start))
            
        case .keywordNull:
            advance()
            let span = endSpan(from: start)
            return .identifier(IdentifierNode(name: "Null", span: span), span)
            
        case .keywordNew:
            advance()
            if expect(.identifier) {
                let name = currentToken.text
                advance()
                return .new(name, endSpan(from: start))
            }
            return .integerLiteral(0, endSpan(from: start))

        case .keywordFirst:
            advance()
            if expect(.identifier) {
                let typeName = currentToken.text
                advance()
                return .first(typeName, endSpan(from: start))
            }
            return .integerLiteral(0, endSpan(from: start))

        case .keywordLast:
            advance()
            if expect(.identifier) {
                let typeName = currentToken.text
                advance()
                return .last(typeName, endSpan(from: start))
            }
            return .integerLiteral(0, endSpan(from: start))

        case .keywordBefore:
            advance()
            let expr = parsePostfixExpression()
            return .before(expr, endSpan(from: start))

        case .keywordAfter:
            advance()
            let expr = parsePostfixExpression()
            return .after(expr, endSpan(from: start))

        case .keywordHandle:
            advance()
            _ = consume(.leftParen)
            let expr = parseExpression()
            _ = consume(.rightParen)
            return .handle(expr, endSpan(from: start))

        case .keywordObject:
            advance()
            _ = consume(.period)
            if expect(.identifier) {
                let typeName = currentToken.text
                advance()
                _ = consume(.leftParen)
                let handle = parseExpression()
                _ = consume(.rightParen)
                return .objectCast(typeName, handle, endSpan(from: start))
            }
            return .integerLiteral(0, endSpan(from: start))

        case .leftParen:
            advance()
            let expr = parseExpression()
            _ = consume(.rightParen)
            return expr
            
        case .keywordInt, .keywordFloat, .keywordStr:
            return parseTypeCast()
            
        default:
            return .integerLiteral(0, endSpan(from: start))
        }
    }
    
    private mutating func parseTypeCast() -> ExpressionNode {
        let start = startSpan()
        let castType: TypeAnnotation
        switch currentToken.type {
        case .keywordInt:
            castType = .integer
        case .keywordFloat:
            castType = .float
        case .keywordStr:
            castType = .string
        default:
            return .integerLiteral(0, endSpan(from: start))
        }
        advance()
        
        _ = consume(.leftParen)
        let expr = parseExpression()
        _ = consume(.rightParen)
        
        return .typeCast(TypeCastNode(expression: expr, targetType: castType, span: endSpan(from: start)), endSpan(from: start))
    }
    
    private mutating func parseTypeSuffix() -> TypeSuffix? {
        switch currentToken.type {
        case .intSuffix:
            advance()
            return .integer
        case .floatSuffix:
            advance()
            return .float
        case .stringSuffix:
            advance()
            return .string
        default:
            return nil
        }
    }
}
