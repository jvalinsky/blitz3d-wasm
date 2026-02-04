import Foundation

/// Centralized helper for resolving function signatures (imports and user functions)
struct SignatureResolver {
    let context: ModuleContext

    private static let typeSuffixes: [Character] = ["%", "#", "$"]

    /// Returns candidate lookup keys for a Blitz name.
    ///
    /// Blitz3D is case-insensitive, and many real-world codebases omit the type
    /// suffix at the call site even when the definition uses one (e.g.
    /// `Function CreateNPC%(...)` called as `CreateNPC(...)`).
    ///
    /// We keep exact-name resolution first, then try common type suffix variants.
    private func candidateKeys(for rawName: String) -> [String] {
        let lower = rawName.lowercased()
        if let last = lower.last, Self.typeSuffixes.contains(last) {
            return [lower]
        }
        // Prefer the unsuffixed name first to avoid changing behavior if both
        // `Foo` and `Foo%` exist.
        return [lower, lower + "%", lower + "#", lower + "$"]
    }

    /// Resolve a function definition and the canonical internal name we should call.
    func resolveCall(forName name: String) -> (resolvedName: String, def: FunctionDefinition)? {
        for key in candidateKeys(for: name) {
            if let def = context.functionDefinitions[key] {
                return (key, def)
            }
            if let idx = context.functionIndexMap[key],
               let defByIdx = context.functionDefinitionsByIndex[idx] {
                return (key, defByIdx)
            }
        }
        return nil
    }
    
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
