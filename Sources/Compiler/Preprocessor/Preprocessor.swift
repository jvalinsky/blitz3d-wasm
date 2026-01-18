//
//  Preprocessor.swift
//  Blitz3DCompiler
//
//  Handles textual inclusion of source files
//

import Foundation

public struct Preprocessor {
    private var includedFiles: Set<String> = []
    private var rootDirectory: String = ""
    
    public init() {}
    
    public mutating func process(file: String) throws -> String {
        let url = URL(fileURLWithPath: file)
        rootDirectory = url.deletingLastPathComponent().path
        includedFiles.insert(url.path)
        
        let source = try String(contentsOfFile: file, encoding: .utf8)
        return try processSource(source)
    }
    
    public mutating func process(source: String) throws -> String {
        // For testing: process source string without file context
        // Handle Include statements with inline content
        var result = ""
        let lines = source.components(separatedBy: .newlines)
        
        for line in lines {
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            if trimmed.lowercased().hasPrefix("include ") {
                // Parse include path
                let parts = trimmed.split(separator: "\"", maxSplits: 2)
                if parts.count >= 2 {
                    let includePath = String(parts[1])
                    // For testing, we check if this looks like inline content
                    // If the path contains newlines, it's actually inline content
                    if includePath.contains("\n") {
                        // This is inline content disguised as an include
                        result += includePath + "\n"
                    }
                    // Otherwise, skip (we can't resolve file includes in this mode)
                } else {
                    result += line + "\n"
                }
            } else {
                result += line + "\n"
            }
        }
        
        return result
    }
    
    private mutating func processSource(_ source: String) throws -> String {
        var result = ""
        let lines = source.components(separatedBy: .newlines)
        
        for line in lines {
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            if trimmed.lowercased().hasPrefix("include ") {
                // Parse include path
                let parts = trimmed.split(separator: "\"", maxSplits: 2)
                if parts.count >= 2 {
                    let includePath = String(parts[1])
                    try includeFile(includePath, into: &result)
                } else {
                    // Invalid include syntax, just keep it? or error?
                    result += line + "\n"
                }
            } else {
                result += line + "\n"
            }
        }
        
        return result
    }
    
    private mutating func includeFile(_ path: String, into result: inout String) throws {
        let fullPath = (rootDirectory as NSString).appendingPathComponent(path)
        let url = URL(fileURLWithPath: fullPath)
        let canonicalPath = url.standardized.path
        
        // Avoid cycles and duplicates if desired (Blitz3D allows multiple includes? usually yes)
        // But for safety let's warn or check. SCPCB might include same utility files.
        // Actually Blitz3D include is copy-paste. If a file defines globals, including it twice causes errors.
        // We should track included files to prevent double inclusion if that's the semantics, 
        // OR simply rely on the user code to be correct.
        // Given SCPCB likely has include guards or structure, simple textual inclusion is safest.
        
        // However, if we process recursively:
        let source = try String(contentsOfFile: canonicalPath, encoding: .utf8)
        
        // Process the included content recursively
        let processedSource = try processSource(source)
        result += processedSource + "\n"
    }
}
