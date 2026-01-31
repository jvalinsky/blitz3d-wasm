//
//  main.swift
//  Blitz3D Compiler - WASM Entry Point
//
//  A standalone compiler executable that can be compiled to WASM
//  for running entirely in the browser
//

import Foundation
import Blitz3DCompiler

/// Read entire stdin
func readStdin() -> String? {
    var input = ""
    while let line = readLine(strippingNewline: false) {
        input += line
    }
    return input.isEmpty ? nil : input
}

/// Main entry point
@main
struct CompilerMain {
    static func main() throws {
        // Read source from stdin
        guard let source = readStdin() else {
            fputs("Error: No input provided\n", stderr)
            exit(1)
        }
        
        // Parse command line arguments
        let args = CommandLine.arguments.dropFirst()
        var optimize = false
        var outputFormat = "binary" // or "wat" for text format
        
        for arg in args {
            if arg == "--optimize" || arg == "-O" {
                optimize = true
            } else if arg == "--wat" {
                outputFormat = "wat"
            }
        }
        
        do {
            // Parse the Blitz3D source
            let parser = Parser()
            let program = try parser.parse(source: source)
            
            // Generate WebAssembly
            var codeGen = CodeGenerator()
            let wasmModule = try codeGen.generateFromIR(program)
            
            if outputFormat == "wat" {
                // Output WebAssembly text format
                let watWriter = WASMTextWriter()
                let watText = watWriter.write(wasmModule)
                print(watText)
            } else {
                // Output binary format
                let encoder = WASMBinaryEncoder()
                let binary = try encoder.encode(wasmModule)
                
                // Write binary to stdout
                FileHandle.standardOutput.write(binary)
            }
            
        } catch let error as CompilerError {
            fputs("Compilation error: \(error.description)\n", stderr)
            exit(1)
        } catch {
            fputs("Compilation failed: \(error)\n", stderr)
            exit(1)
        }
    }
}
