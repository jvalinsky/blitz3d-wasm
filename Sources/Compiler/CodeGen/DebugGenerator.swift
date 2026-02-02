//
//  DebugGenerator.swift
//  Blitz3DCompiler
//
//  Manages debug metadata for live debugging instrumentation
//

import Foundation

public struct DebugFunctionInfo: Codable {
    public let id: Int
    public let name: String
    public let signature: String
    public let fileId: Int
    public let startLine: Int
    public let endLine: Int
}

public struct DebugFileInfo: Codable {
    public let id: Int
    public let path: String
}

public struct DebugMetadata: Codable {
    public let files: [DebugFileInfo]
    public let functions: [DebugFunctionInfo]
    public let types: [DebugTypeInfo]
    public let versions: DebugVersions?
}

public struct DebugVersions: Codable {
    public let bbdbgSchemaVersion: Int
    public let runtimeLayoutVersion: Int
}

public struct DebugFieldInfo: Codable {
    public let name: String
    public let offsetBytes: Int
    public let wasmType: String
    public let declaredType: String
    public let customTypeName: String?
    public let dimensions: [Int]?
}

public struct DebugTypeInfo: Codable {
    public let id: Int
    public let name: String
    public let instanceSizeBytes: Int
    public let fields: [DebugFieldInfo]
}

public class DebugGenerator {
    private var files: [String: Int] = [:]
    private var functions: [DebugFunctionInfo] = []
    private var typesById: [Int: DebugTypeInfo] = [:]
    private var nextFileId = 1
    
    // Increment whenever the JSON schema changes in a breaking way.
    private let bbdbgSchemaVersion = 2
    
    // Increment whenever runtime in-memory layouts (strings/types/arrays) change.
    // This is used by tooling to avoid decoding with stale assumptions.
    private let runtimeLayoutVersion = 1
    
    public init() {}
    
    public func registerFile(_ path: String) -> Int {
        if let id = files[path] {
            return id
        }
        let id = nextFileId
        nextFileId += 1
        files[path] = id
        return id
    }
    
    public func registerFunction(name: String, signature: String, span: SourceSpan) -> Int {
        let fileId = registerFile(span.start.sourceFile)
        let id = functions.count
        
        let info = DebugFunctionInfo(
            id: id,
            name: name,
            signature: signature,
            fileId: fileId,
            startLine: span.start.line,
            endLine: span.end.line
        )
        functions.append(info)
        return id
    }
    
    public func registerType(_ info: DebugTypeInfo) {
        // Type IDs are expected to be stable per compilation unit (1..N in declaration order).
        // If a type is registered multiple times, prefer the latest.
        typesById[info.id] = info
    }
    
    public func generateJSON() -> String {
        let fileList = files.map { DebugFileInfo(id: $0.value, path: $0.key) }
                           .sorted { $0.id < $1.id }
        
        let types = typesById.keys.sorted().compactMap { typesById[$0] }
        let versions = DebugVersions(bbdbgSchemaVersion: bbdbgSchemaVersion, runtimeLayoutVersion: runtimeLayoutVersion)
        let metadata = DebugMetadata(files: fileList, functions: functions, types: types, versions: versions)
        
        let encoder = JSONEncoder()
        encoder.outputFormatting = .prettyPrinted
        if let data = try? encoder.encode(metadata),
           let json = String(data: data, encoding: .utf8) {
            return json
        }
        return "{}"
    }
}
