//
//  CompilerWASM.swift
//  Blitz3D Compiler - WASM Entry Point
//
//  Provides a WASI-compatible interface for the compiler
//  Enables compiling Blitz3D code entirely in the browser
//

import Foundation
import Blitz3DCompiler

struct CompilerError: Error, CustomStringConvertible {
    let message: String
    var description: String { message }
}

/// WASM-compatible compiler interface
struct CompilerWASM {
    
    static func compile(source: String, options: CompilerOptions = .default) -> Result<Data, CompilerError> {
        do {
            var parser = Parser(source: source, sourceFile: "stdin")
            let program = parser.parse()
            
            if parser.hasErrors {
                return .failure(CompilerError(message: parser.errors.map { $0.description }.joined(separator: "\n")))
            }
            
            var codeGen = CodeGenerator()
            if !options.autoImports.isEmpty {
                codeGen.enableAutoImports(Set(options.autoImports.map { $0.lowercased() }))
            }
            if options.commandBuffer {
                codeGen.enableCommandBuffer()
            }
            let wasmModule = codeGen.generateFromIR(program)
            
            if codeGen.hasDiagnostics {
                return .failure(CompilerError(message: codeGen.diagnostics.map { $0.description }.joined(separator: "\n")))
            }
            
            var encoder = WASMBinaryEncoder()
            let wasmBinary = encoder.encode(wasmModule)
            
            return .success(Data(wasmBinary))
        } catch {
            return .failure(CompilerError(message: "Compilation failed: \(error)"))
        }
    }
    
    static func compileToJSON(source: String, optionsJSON: String = "{}") -> String {
        let options = CompilerOptions.from(json: optionsJSON)
        let result = compile(source: source, options: options)
        
        switch result {
        case .success(let wasmData):
            let base64 = wasmData.base64EncodedString()
            return """
            {
                "success": true,
                "wasm": "\(base64)",
                "size": \(wasmData.count)
            }
            """
        case .failure(let error):
            let escapedError = error.description
                .replacingOccurrences(of: "\\", with: "\\\\")
                .replacingOccurrences(of: "\"", with: "\\\"")
                .replacingOccurrences(of: "\n", with: "\\n")
            return """
            {
                "success": false,
                "error": "\(escapedError)"
            }
            """
        }
    }
}

/// Compiler configuration options
struct CompilerOptions {
    var optimize: Bool
    var debugInfo: Bool
    var sourceMap: Bool
    var autoImports: [String]
    var commandBuffer: Bool
    
    static let `default` = CompilerOptions(
        optimize: true,
        debugInfo: false,
        sourceMap: false,
        autoImports: [],
        commandBuffer: false
    )
    
    static func from(json: String) -> CompilerOptions {
        // Options are passed as a JSON-ish object from JS. We intentionally use
        // a very lightweight parser here (instead of Foundation JSON parsing)
        // because this runs inside WASI and should avoid heavy Foundation
        // internals.
        var options = CompilerOptions.default

        if json.contains("\"optimize\":false") { options.optimize = false }
        if json.contains("\"debugInfo\":true") { options.debugInfo = true }
        if json.contains("\"sourceMap\":true") { options.sourceMap = true }
        if json.contains("\"commandBuffer\":true") { options.commandBuffer = true }

        // Parse: "autoImports": ["A","B",...]
        if let keyRange = json.range(of: "\"autoImports\"") {
            let tail = json[keyRange.upperBound...]
            if let openBracket = tail.firstIndex(of: "[") {
                var i = tail.index(after: openBracket)
                var inString = false
                var escape = false
                var current = ""
                var values: [String] = []

                while i < tail.endIndex {
                    let ch = tail[i]
                    if inString {
                        if escape {
                            current.append(ch)
                            escape = false
                        } else if ch == "\\" {
                            escape = true
                        } else if ch == "\"" {
                            inString = false
                            values.append(current)
                            current = ""
                        } else {
                            current.append(ch)
                        }
                    } else {
                        if ch == "\"" {
                            inString = true
                            current = ""
                        } else if ch == "]" {
                            break
                        }
                    }
                    i = tail.index(after: i)
                }

                if !values.isEmpty {
                    options.autoImports = values
                }
            }
        }

        return options
    }
}

/// WASI entry point - can be called from JavaScript
@_cdecl("compile_blitz3d")
public func compile_blitz3d(
    sourcePtr: UnsafePointer<UInt8>,
    sourceLen: Int32,
    optionsPtr: UnsafePointer<UInt8>?,
    optionsLen: Int32,
    resultPtr: UnsafeMutablePointer<UnsafePointer<UInt8>?>,
    resultLen: UnsafeMutablePointer<Int32>
) -> Int32 {
    // Convert C strings to Swift strings
    let sourceData = Data(bytes: sourcePtr, count: Int(sourceLen))
    guard let source = String(data: sourceData, encoding: .utf8) else {
        return -1 // Invalid UTF-8
    }
    
    let optionsJSON: String
    if let optionsPtr = optionsPtr {
        let optionsData = Data(bytes: optionsPtr, count: Int(optionsLen))
        optionsJSON = String(data: optionsData, encoding: .utf8) ?? "{}"
    } else {
        optionsJSON = "{}"
    }
    
    // Compile
    let resultJSON = CompilerWASM.compileToJSON(source: source, optionsJSON: optionsJSON)
    
    // Return result
    let resultData = resultJSON.data(using: .utf8)!
    let buffer = UnsafeMutablePointer<UInt8>.allocate(capacity: resultData.count)
    resultData.copyBytes(to: buffer, count: resultData.count)
    
    resultPtr.pointee = UnsafePointer(buffer)
    resultLen.pointee = Int32(resultData.count)
    
    return 0 // Success
}

/// Simple REPL entry point for testing
@main
struct CompilerREPL {
    static func main() {
        print("Blitz3D WASM Compiler")
        print("Enter 'quit' to exit")
        print("")
        
        while true {
            print("> ", terminator: "")
            fflush(stdout)
            
            guard let line = readLine() else {
                break
            }
            
            if line.trimmingCharacters(in: .whitespaces) == "quit" {
                break
            }
            
            let result = CompilerWASM.compileToJSON(source: line)
            print(result)
        }
    }
}
