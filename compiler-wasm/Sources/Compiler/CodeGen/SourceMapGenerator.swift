//
//  SourceMapGenerator.swift
//  Blitz3DCompiler
//
//  Generates WASM source maps (Source Map V3) for debugger integration
//

import Foundation

/// A single mapping from WASM bytecode offset to source location
public struct SourceMapping: Codable {
    public let wasmOffset: Int      // Byte offset in WASM binary
    public let sourceLine: Int      // Original source line (1-indexed)
    public let sourceColumn: Int    // Original source column (1-indexed)
    public let sourceIndex: Int     // Index into sources array
    
    public init(wasmOffset: Int, sourceLine: Int, sourceColumn: Int, sourceIndex: Int) {
        self.wasmOffset = wasmOffset
        self.sourceLine = sourceLine
        self.sourceColumn = sourceColumn
        self.sourceIndex = sourceIndex
    }
}

/// Generates WASM source maps in Source Map V3 format
public class SourceMapGenerator {
    private var mappings: [SourceMapping] = []
    private var sources: [String] = []
    private var sourceIndexMap: [String: Int] = [:]
    
    public init() {}
    
    /// Add a mapping from WASM offset to source location
    public func addMapping(wasmOffset: Int, span: SourceSpan) {
        guard span.start.line > 0 else { return }  // Skip unknown spans
        
        let sourceFile = span.start.sourceFile
        let sourceIndex = getOrCreateSourceIndex(sourceFile)
        
        let mapping = SourceMapping(
            wasmOffset: wasmOffset,
            sourceLine: span.start.line,
            sourceColumn: span.start.column,
            sourceIndex: sourceIndex
        )
        mappings.append(mapping)
    }
    
    /// Shift all mapping offsets by a delta
    /// Used when generating code into a temporary buffer and then embedding it
    public func shiftMappings(by delta: Int) {
        mappings = mappings.map { mapping in
            SourceMapping(
                wasmOffset: mapping.wasmOffset + delta,
                sourceLine: mapping.sourceLine,
                sourceColumn: mapping.sourceColumn,
                sourceIndex: mapping.sourceIndex
            )
        }
    }
    
    /// Get or create a source file index
    private func getOrCreateSourceIndex(_ sourceFile: String) -> Int {
        if let existing = sourceIndexMap[sourceFile] {
            return existing
        }
        let index = sources.count
        sources.append(sourceFile)
        sourceIndexMap[sourceFile] = index
        return index
    }
    
    /// Generate source map JSON
    public func generateJSON(wasmFile: String) -> String {
        // Sort mappings by WASM offset
        let sortedMappings = mappings.sorted { $0.wasmOffset < $1.wasmOffset }
        
        // Generate Base64 VLQ encoded mappings
        let encodedMappings = generateMappingsString(sortedMappings)
        
        // Build JSON structure
        let sourceMap: [String: Any] = [
            "version": 3,
            "file": wasmFile,
            "sources": sources,
            "names": [] as [String],
            "mappings": encodedMappings
        ]
        
        // Serialize to JSON
        if let jsonData = try? JSONSerialization.data(withJSONObject: sourceMap, options: .prettyPrinted),
           let jsonString = String(data: jsonData, encoding: .utf8) {
            return jsonString
        }
        return "{}"
    }
    
    /// Generate the VLQ-encoded mappings string
    /// For WASM: line is always 0: column represents byte offset
    private func generateMappingsString(_ mappings: [SourceMapping]) -> String {
        var result = ""
        var prevOffset = 0
        var prevSourceIndex = 0
        var prevSourceLine = 0
        var prevSourceColumn = 0
        
        for (i, mapping) in mappings.enumerated() {
            if i > 0 { result += "," }
            
            // Field 1: Column (WASM byte offset) relative to previous
            let offsetDelta = mapping.wasmOffset - prevOffset
            result += encodeVLQ(offsetDelta)
            
            // Field 2: Source index relative to previous
            let sourceIndexDelta = mapping.sourceIndex - prevSourceIndex
            result += encodeVLQ(sourceIndexDelta)
            
            // Field 3: Source line (0-indexed) relative to previous
            let lineDelta = (mapping.sourceLine - 1) - prevSourceLine
            result += encodeVLQ(lineDelta)
            
            // Field 4: Source column relative to previous
            let columnDelta = mapping.sourceColumn - prevSourceColumn
            result += encodeVLQ(columnDelta)
            
            // Update state
            prevOffset = mapping.wasmOffset
            prevSourceIndex = mapping.sourceIndex
            prevSourceLine = mapping.sourceLine - 1
            prevSourceColumn = mapping.sourceColumn
        }
        
        return result
    }
    
    /// Encode an integer as Base64 VLQ
    private func encodeVLQ(_ value: Int) -> String {
        let base64Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
        var result = ""
        
        // Convert to unsigned with sign bit in LSB
        var vlq = value < 0 ? ((-value) << 1) | 1 : value << 1
        
        repeat {
            var digit = vlq & 0x1F  // 5 bits
            vlq >>= 5
            
            if vlq > 0 {
                digit |= 0x20  // Set continuation bit
            }
            
            let index = base64Chars.index(base64Chars.startIndex, offsetBy: digit)
            result.append(base64Chars[index])
        } while vlq > 0
        
        return result
    }
    
    /// Get current mapping count
    public var count: Int { mappings.count }
    
    /// Get all sources
    public var sourceFiles: [String] { sources }
}
