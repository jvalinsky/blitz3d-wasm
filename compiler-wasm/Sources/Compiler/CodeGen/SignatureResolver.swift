import Foundation

/// Centralized helper for resolving function signatures (imports and user functions)
struct SignatureResolver {
    let context: ModuleContext
    
    /// Resolve a function definition by its (case-insensitive) name.
    func definition(forName name: String) -> FunctionDefinition? {
        let lower = name.lowercased()
        
        if let def = context.functionDefinitions[lower] {
            return def
        }
        
        if let idx = context.functionIndexMap[lower],
           let defByIdx = context.functionDefinitionsByIndex[idx] {
            return defByIdx
        }
        
        return nil
    }
    
    /// Resolve a function definition by its module index.
    func definition(forIndex index: Int) -> FunctionDefinition? {
        return context.functionDefinitionsByIndex[index]
    }
}
