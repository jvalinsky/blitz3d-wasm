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
        for statement in statements {
            if let type = scanStatement(statement, forVariable: variableName) {
                return type
            }
        }
        return nil
    }
    
    private func scanStatement(_ statement: StatementNode, forVariable name: String) -> WASMType? {
        switch statement {
        case .assignment(let assign):
            // Check if this is an assignment to our variable
            if case .identifier(let id) = assign.target, id.name == name {
                // If it has a type suffix, we found our hint!
                if let suffix = id.typeSuffix {
                    return typeHandling.wasmType(from: suffix)
                }
            }
            
        case .local(let decl):
            // Check if variable is declared with type suffix
            for id in decl.variables {
                if id.name == name, let suffix = id.typeSuffix {
                    return typeHandling.wasmType(from: suffix)
                }
            }
            
        case .global(let decl):
            // Check if variable is declared with type suffix
            for id in decl.variables {
                if id.name == name, let suffix = id.typeSuffix {
                    return typeHandling.wasmType(from: suffix)
                }
            }
            
        case .ifStatement(let ifNode):
            // Scan then branch
            if let type = scanForTypeHint(variableName: name, in: ifNode.thenBranch) {
                return type
            }
            // Scan else branch (elseBranch is [StatementNode], not optional)
            if !ifNode.elseBranch.isEmpty {
                if let type = scanForTypeHint(variableName: name, in: ifNode.elseBranch) {
                    return type
                }
            }
            
        case .whileLoop(let whileNode):
            if let type = scanForTypeHint(variableName: name, in: whileNode.body) {
                return type
            }
            
        case .forLoop(let forNode):
            // Check if loop variable matches
            if forNode.variable.name == name, let suffix = forNode.variable.typeSuffix {
                return typeHandling.wasmType(from: suffix)
            }
            if let type = scanForTypeHint(variableName: name, in: forNode.body) {
                return type
            }
            
        case .forEach(let forEachNode):
            // ForEach loops don't declare the variable, they iterate over existing types
            // So we can't infer type from forEach loop
            break
            
        case .repeatLoop(let repeatNode):
            if let type = scanForTypeHint(variableName: name, in: repeatNode.body) {
                return type
            }
            
        case .select(let selectNode):
            // Scan all cases
            for caseNode in selectNode.cases {
                if let type = scanForTypeHint(variableName: name, in: caseNode.body) {
                    return type
                }
            }
            if let defaultCase = selectNode.defaultCase {
                if let type = scanForTypeHint(variableName: name, in: defaultCase) {
                    return type
                }
            }
            
        default:
            // For other statement types, no type inference possible
            break
        }
        
        return nil
    }
}
