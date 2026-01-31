//
//  main.swift
//  Blitz3D Compiler - WASM Entry Point
//
//  A standalone compiler executable that can be compiled to WASM
//  for running entirely in the browser
//

import Blitz3DCompiler
import Foundation

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
        var outputFormat = "binary"  // or "wat" for text format

        for arg in args {
            if arg == "--wat" {
                outputFormat = "wat"
            }
        }

        // Parse the Blitz3D source
        var parser = Parser(source: source)
        let program = parser.parse()

        if parser.hasErrors {
            for error in parser.errors {
                fputs("\(error.description)\n", stderr)
            }
            exit(1)
        }

        // Generate WebAssembly
        var codeGen = CodeGenerator()
        let wasmModule = codeGen.generateFromIR(program)

        if codeGen.hasDiagnostics {
            for diagnostic in codeGen.diagnostics {
                fputs("\(diagnostic.description)\n", stderr)
            }
            exit(1)
        }

        if outputFormat == "wat" {
            // Output WebAssembly text format
            var watWriter = WASMTextWriter()
            let watText = watWriter.write(wasmModule)
            print(watText)
        } else {
            // Output binary format
            var encoder = WASMBinaryEncoder()
            let binary = encoder.encode(wasmModule)

            // Write binary to stdout
            FileHandle.standardOutput.write(Data(binary))
        }
    }
}
