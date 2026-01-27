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
    private let dedupeIncludes: Bool
    private var includeStack: [String] = []
    
    public init(dedupeIncludes: Bool = true) {
        self.dedupeIncludes = dedupeIncludes
    }

    public enum PreprocessorError: Error, CustomStringConvertible {
        case circularInclude(stack: [String], next: String)

        public var description: String {
            switch self {
            case .circularInclude(let stack, let next):
                return "Circular Include detected: \(stack.joined(separator: " -> ")) -> \(next)"
            }
        }
    }
    
    public struct PreprocessedSource {
        public let source: String
        /// merged line (1-based) -> (file path, original line number)
        public let lineMap: [Int: (file: String, line: Int)]
    }
    
    public mutating func process(file: String) throws -> String {
        let url = URL(fileURLWithPath: file)
        rootDirectory = url.deletingLastPathComponent().path
        if dedupeIncludes {
            includedFiles.insert(url.path)
        }
        includeStack = [url.path]
        
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

    private func resolveCaseInsensitivePath(baseDirectory: String, relativePath: String) -> String? {
        let fm = FileManager.default
        let normalized = relativePath.replacingOccurrences(of: "\\", with: "/")
        let components = normalized.split(separator: "/").map(String.init).filter { !$0.isEmpty }

        var current = baseDirectory
        for component in components {
            if component == "." { continue }
            if component == ".." {
                current = (current as NSString).deletingLastPathComponent
                continue
            }

            guard let entries = try? fm.contentsOfDirectory(atPath: current) else {
                return nil
            }

            if let match = entries.first(where: { $0.lowercased() == component.lowercased() }) {
                current = (current as NSString).appendingPathComponent(match)
            } else {
                return nil
            }
        }

        return URL(fileURLWithPath: current).standardized.path
    }

    private func resolveIncludePath(_ includePath: String) -> String {
        let normalized = includePath.replacingOccurrences(of: "\\", with: "/")
        let candidate = (rootDirectory as NSString).appendingPathComponent(normalized)

        if FileManager.default.fileExists(atPath: candidate) {
            return URL(fileURLWithPath: candidate).standardized.path
        }

        if let resolved = resolveCaseInsensitivePath(baseDirectory: rootDirectory, relativePath: normalized) {
            return resolved
        }

        // Fall back to the candidate path; caller will surface the read error.
        return URL(fileURLWithPath: candidate).standardized.path
    }

    /// Preprocess a file and return merged source plus a line map back to original files.
    /// This is opt-in to avoid disrupting existing call sites.
    public mutating func processWithMap(file: String) throws -> PreprocessedSource {
        let url = URL(fileURLWithPath: file)
        rootDirectory = url.deletingLastPathComponent().path
        if dedupeIncludes {
            includedFiles.insert(url.path)
        }
        includeStack = [url.path]
        
        let (src, map) = try processFileWithMap(path: url.path)
        return PreprocessedSource(source: src, lineMap: map)
    }
    
    private mutating func processFileWithMap(path: String) throws -> (String, [Int: (file: String, line: Int)]) {
        var result = ""
        var lineMap: [Int: (file: String, line: Int)] = [:]
        var source = ""
        do {
            source = try String(contentsOfFile: path, encoding: .utf8)
        } catch {
             source = try String(contentsOfFile: path, encoding: .windowsCP1252)
        }
        let lines = source.components(separatedBy: .newlines)
        
        for (idx, rawLine) in lines.enumerated() {
            let lineNumber = idx + 1
            let trimmed = rawLine.trimmingCharacters(in: .whitespaces)
            if trimmed.lowercased().hasPrefix("include ") {
                let parts = trimmed.split(separator: "\"", maxSplits: 2)
                if parts.count >= 2 {
                    let includePath = String(parts[1])
                    // Inline include content is treated as literal
                    if includePath.contains("\n") {
                        result += includePath + "\n"
                        let mergedLine = result.components(separatedBy: .newlines).count - 1
                        lineMap[mergedLine] = (file: path, line: lineNumber)
                    } else {
                        // Resolve include file (case-insensitive) and merge with mapping
                        let canonical = resolveIncludePath(includePath)
                        let url = URL(fileURLWithPath: canonical)
                        
                        if includeStack.contains(canonical) {
                            throw PreprocessorError.circularInclude(stack: includeStack, next: canonical)
                        }
                        if dedupeIncludes && includedFiles.contains(canonical) {
                            continue
                        }
                        if dedupeIncludes {
                            includedFiles.insert(canonical)
                        }
                        includeStack.append(canonical)
                        defer { _ = includeStack.popLast() }
                        
                        let oldRoot = rootDirectory
                        rootDirectory = url.deletingLastPathComponent().path
                        
                        // Handle encoding fallback in recursion target?
                        // Actually processFileWithMap opens the file encoded utf8.
                        // We need to fix that too.
                        // Ideally pass a hint or handle inside processFileWithMap.
                        // But processFileWithMap takes 'path' and opens it.
                        // Let's modify processFileWithMap to try fallback.
                        // (We need to edit line 76 separately or let the recursive call handle it)
                        
                        let (incSrc, incMap) = try processFileWithMap(path: canonical)
                        
                        rootDirectory = oldRoot
                        
                        let currentLineOffset = result.components(separatedBy: .newlines).count - 1
                        result += incSrc
                        // Shift included map lines by current offset
                        for (merged, origin) in incMap {
                            lineMap[merged + currentLineOffset] = origin
                        }
                    }
                } else {
                    result += rawLine + "\n"
                    let mergedLine = result.components(separatedBy: .newlines).count - 1
                    lineMap[mergedLine] = (file: path, line: lineNumber)
                }
            } else {
                result += rawLine + "\n"
                let mergedLine = result.components(separatedBy: .newlines).count - 1
                lineMap[mergedLine] = (file: path, line: lineNumber)
            }
        }
        
        return (result, lineMap)
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
        // Resolve path relative to CURRENT rootDirectory (case-insensitive)
        let canonicalPath = resolveIncludePath(path)
        let url = URL(fileURLWithPath: canonicalPath)
        
        if includeStack.contains(canonicalPath) {
            throw PreprocessorError.circularInclude(stack: includeStack, next: canonicalPath)
        }
        if dedupeIncludes && includedFiles.contains(canonicalPath) {
            CompilerLogger.debug("DEBUG: Skipping already included file: \(path)")
            return
        }
        if dedupeIncludes {
            includedFiles.insert(canonicalPath)
        }
        includeStack.append(canonicalPath)
        defer { _ = includeStack.popLast() }
        CompilerLogger.debug("DEBUG: Including file: \(path) -> \(canonicalPath)")
        
        // Try UTF-8 first, fallback to Windows-1252
        var source = ""
        do {
            source = try String(contentsOfFile: canonicalPath, encoding: .utf8)
        } catch {
             // Fallback to Windows-1252 (Latin1 equivalent)
             source = try String(contentsOfFile: canonicalPath, encoding: .windowsCP1252)
        }
        
        // Save current root, update for recursion, then restore
        let oldRoot = rootDirectory
        CompilerLogger.debug("DEBUG: Included \(path). Switching root from \(oldRoot) to \(url.deletingLastPathComponent().path)")
        rootDirectory = url.deletingLastPathComponent().path
        
        // RECURSION: processSource calls includeFile, which uses the updated rootDirectory
        let processedSource = try processSource(source)
        result += processedSource + "\n"
        
        CompilerLogger.debug("DEBUG: Restoring root to \(oldRoot)")
        rootDirectory = oldRoot
    }
}
