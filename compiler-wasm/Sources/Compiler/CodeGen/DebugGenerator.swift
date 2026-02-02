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
}

public class DebugGenerator {
    private var files: [String: Int] = [:]
    private var functions: [DebugFunctionInfo] = []
    private var nextFileId = 1
    
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
    
    public func generateJSON() -> String {
        let fileList = files.map { DebugFileInfo(id: $0.value, path: $0.key) }
                           .sorted { $0.id < $1.id }
        
        let metadata = DebugMetadata(files: fileList, functions: functions)
        
        let encoder = JSONEncoder()
        encoder.outputFormatting = .prettyPrinted
        if let data = try? encoder.encode(metadata),
           let json = String(data: data, encoding: .utf8) {
            return json
        }
        return "{}"
    }
}
