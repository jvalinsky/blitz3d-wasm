//
//  CompilerWASM.swift
//  Blitz3D Compiler - WASM Entry Point
//
//  Provides a WASI-compatible interface for the compiler
//  Enables compiling Blitz3D code entirely in the browser
//

import Foundation
import Blitz3DCompiler

/// WASM-compatible compiler interface
/// Designed to be called from JavaScript via WASI
struct CompilerWASM {
    
    /// Compile Blitz3D source code to WebAssembly
    /// Returns: WASM binary data or error message
    static func compile(source: String, options: CompilerOptions = .default) -> Result<Data, String> {
        do {
            // Parse the source code
            let parser = Parser()
            let program = try parser.parse(source: source)
            
            // Generate WebAssembly
            var codeGen = CodeGenerator()
            
            // Apply optimizations if enabled
            if options.optimize {
                // Constant folding, strength reduction, etc.
            }
            
            let wasmModule = try codeGen.generateFromIR(program)
            
            // Encode to binary format
            let encoder = WASMBinaryEncoder()
            let wasmBinary = try encoder.encode(wasmModule)
            
            return .success(wasmBinary)
        } catch let error as CompilerError {
            return .failure(error.description)
        } catch {
            return .failure("Compilation failed: \(error)")
        }
    }
    
    /// Compile and return JSON result for JavaScript interop
    static func compileToJSON(source: String, optionsJSON: String = "{}") -> String {
        // Parse options from JSON
        let options = CompilerOptions.from(json: optionsJSON)
        
        let result = compile(source: source, options: options)
        
        switch result {
        case .success(let wasmData):
            // Encode WASM binary as base64 for JSON transport
            let base64 = wasmData.base64EncodedString()
            return """
            {
                "success": true,
                "wasm": "\(base64)",
                "size": \(wasmData.count)
            }
            """
            
        case .failure(let error):
            // Escape error message for JSON
            let escapedError = error
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
        // Simple JSON parsing (in real implementation, use proper JSON parser)
        var options = CompilerOptions.default
        
        if json.contains("\"optimize\":false") {
            options.optimize = false
        }
        if json.contains("\"debugInfo\":true") {
            options.debugInfo = true
        }
        if json.contains("\"sourceMap\":true") {
            options.sourceMap = true
        }
        if json.contains("\"commandBuffer\":true") {
            options.commandBuffer = true
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
