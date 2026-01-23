//
//  TypeInference.swift
//  Blitz3DCompiler
//
//  Type inference for auto-declared variables using forward scanning
//

import Foundation

/// Infers variable types by scanning forward in the AST
public class TypeInference {
    private var cache: [String: WASMType] = [:]
    private let typeHandling: TypeHandling
    
    /// Cap work per inference to avoid pathological scans on very large functions.
    private static let maxStatementsVisited = 20_000
    
    public init(typeHandling: TypeHandling) {
        self.typeHandling = typeHandling
    }
    
    /// Clear the inference cache (call when starting a new function)
    public func clearCache() {
        cache.removeAll()
    }
    
    /// Infer the type of a variable by scanning forward in the AST
    /// Returns the inferred type if found, nil otherwise
    public func inferVariableType(name: String, fromStatements statements: [StatementNode]) -> WASMType? {
        // Check cache first
        if let cachedType = cache[name] {
            print("DEBUG_INFERENCE: Cache hit for '\(name)' → \(cachedType)")
            return cachedType
        }
        
        print("DEBUG_INFERENCE: Scanning for '\(name)' type hints...")
        
        // Scan statements for first assignment with type suffix
        if let inferredType = scanForTypeHint(variableName: name, in: statements) {
            print("DEBUG_INFERENCE: Found type hint for '\(name)' → \(inferredType)")
            cache[name] = inferredType
            return inferredType
        }
        
        print("DEBUG_INFERENCE: No type hint found for '\(name)'")
        return nil
    }
    
    // MARK: - Private Scanning Methods
    
    private func scanForTypeHint(variableName: String, in statements: [StatementNode]) -> WASMType? {
        // Iterative traversal avoids recursion-depth failure on huge nested if/elseIf chains (e.g. Main.bb).
        var stack = Array(statements.reversed())
        var visited = 0

        while let statement = stack.popLast() {
            visited += 1
            if visited > Self.maxStatementsVisited { return nil }

            if let type = scanStatementShallow(statement, forVariable: variableName) {
                return type
            }

            // Push nested statement blocks for traversal.
            switch statement {
            case .ifStatement(let ifNode, _):
                if !ifNode.elseBranch.isEmpty {
                    stack.append(contentsOf: ifNode.elseBranch.reversed())
                }
                // elseIf bodies (in order)
                for (_, body) in ifNode.elseIfs.reversed() {
                    stack.append(contentsOf: body.reversed())
                }
                stack.append(contentsOf: ifNode.thenBranch.reversed())

            case .whileLoop(let whileNode, _):
                stack.append(contentsOf: whileNode.body.reversed())

            case .forLoop(let forNode, _):
                stack.append(contentsOf: forNode.body.reversed())

            case .repeatLoop(let repeatNode, _):
                stack.append(contentsOf: repeatNode.body.reversed())

            case .select(let selectNode, _):
                if let defaultCase = selectNode.defaultCase {
                    stack.append(contentsOf: defaultCase.reversed())
                }
                for caseNode in selectNode.cases.reversed() {
                    stack.append(contentsOf: caseNode.body.reversed())
                }

            default:
                break
            }
        }

        return nil
    }

    private func scanStatementShallow(_ statement: StatementNode, forVariable name: String) -> WASMType? {
        switch statement {
        case .assignment(let assign, _):
            if case .identifier(let id, _) = assign.target, id.name == name, let suffix = id.typeSuffix {
                return typeHandling.wasmType(from: suffix)
            }
        case .local(let decl, _):
            for id in decl.variables {
                if id.name == name, let suffix = id.typeSuffix {
                    return typeHandling.wasmType(from: suffix)
                }
            }
        case .global(let decl, _):
            for id in decl.variables {
                if id.name == name, let suffix = id.typeSuffix {
                    return typeHandling.wasmType(from: suffix)
                }
            }
        case .forLoop(let forNode, _):
            if forNode.variable.name == name, let suffix = forNode.variable.typeSuffix {
                return typeHandling.wasmType(from: suffix)
            }
        default:
            break
        }
        return nil
    }
}
