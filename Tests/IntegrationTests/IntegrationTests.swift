//
//  IntegrationTests.swift
//  CompilerTests
//
//  Integration tests that compile BASIC code and execute the resulting WASM
//

import XCTest
@testable import Blitz3DCompiler
import JavaScriptKit

final class IntegrationTests: XCTestCase {
    
    // MARK: - Asset Compilation Tests
    
    func testCompileWithEmbeddedData() throws {
        let source = """
        Function Main()
            Local message$
            Data "Hello from embedded data!"
            Read message$
            Print message$
        End Function
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        XCTAssertEqual(program.functions.count, 1)
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        // Should have data sections for the embedded string
        XCTAssertGreaterThan(module.data.count, 0, "Should have data section for embedded string")
        
        // Should compile to WASM binary
        var encoder = WASMBinaryEncoder()
        let wasmBytes = encoder.encode(module)
        XCTAssertGreaterThan(wasmBytes.count, 0, "WASM binary should not be empty")
    }
    
    func testCompileWithMultipleDataStatements() throws {
        let source = """
        Function Main()
            Local a%, b#, c$
            Data 42, 3.14, "test"
            Read a%, b#, c$
            Print a%
            Print b#
            Print c$
        End Function
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        // Should have data sections
        XCTAssertGreaterThan(module.data.count, 0)
        
        // Generate WASM
        var encoder = WASMBinaryEncoder()
        let wasmBytes = encoder.encode(module)
        XCTAssertGreaterThan(wasmBytes.count, 0)
    }
    
    func testCompileWithDataAndReadLoop() throws {
        let source = """
        Function Main()
            Local i, values[3]
            Data 10, 20, 30
            For i = 0 To 2
                Read values[i]
            Next
            Print values[0]
            Print values[1]
            Print values[2]
        End Function
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        // Should compile successfully
        var encoder = WASMBinaryEncoder()
        let wasmBytes = encoder.encode(module)
        XCTAssertGreaterThan(wasmBytes.count, 0)
    }
    
    func testCompileWithRestoreStatement() throws {
        let source = """
        Function Main()
            Local x, y
            Data 1, 2, 3
            Read x
            Print x
            Restore
            Read y
            Print y
        End Function
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        // Should have RestoreData import
        let restoreImport = module.imports.first { $0.name == "RestoreData" }
        XCTAssertNotNil(restoreImport, "RestoreData should be imported")
        
        var encoder = WASMBinaryEncoder()
        let wasmBytes = encoder.encode(module)
        XCTAssertGreaterThan(wasmBytes.count, 0)
    }
    
    func testCompileWithLabeledData() throws {
        let source = """
        Function Main()
            Local x
            Data 100, 200
            Restore start_data
            Read x
            Print x
            .start_data
            Data 300, 400
        End Function
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        var encoder = WASMBinaryEncoder()
        let wasmBytes = encoder.encode(module)
        XCTAssertGreaterThan(wasmBytes.count, 0)
    }
    
    // MARK: - WAT Output Tests
    
    func testGenerateWATWithDataSection() throws {
        let source = """
        Function Main()
            Local message$
            Data "Hello World"
            Read message$
            Print message$
        End Function
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        var writer = WASMTextWriter()
        let watOutput = writer.write(module)
        
        // WAT should contain data section
        XCTAssertTrue(watOutput.contains("(data"), "WAT should contain data section")
        XCTAssertTrue(watOutput.contains("Hello World"), "WAT should contain the embedded string")
    }
    
    func testWATDataSectionFormat() throws {
        let source = """
        Function Main()
            Data 42, "test", 3.14
        End Function
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        var writer = WASMTextWriter()
        let watOutput = writer.write(module)
        
        // Should have data with i32.const offset
        XCTAssertTrue(watOutput.contains("(data (i32.const"), "Data should use i32.const offset")
    }
    
    // MARK: - Binary Encoding Tests
    
    func testBinaryEncodeDataSection() throws {
        let source = """
        Function Main()
            Local value%
            Data 12345
            Read value%
            Print value%
        End Function
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        var encoder = WASMBinaryEncoder()
        let wasmBytes = encoder.encode(module)
        
        // WASM magic number
        XCTAssertEqual(wasmBytes[0], 0x00)
        XCTAssertEqual(wasmBytes[1], 0x61)
        XCTAssertEqual(wasmBytes[2], 0x73)
        XCTAssertEqual(wasmBytes[3], 0x6D) // "\0asm"
        
        // Version
        XCTAssertEqual(wasmBytes[4], 0x01)
        XCTAssertEqual(wasmBytes[5], 0x00)
        XCTAssertEqual(wasmBytes[6], 0x00)
        XCTAssertEqual(wasmBytes[7], 0x00)
    }
    
    // MARK: - Multi-file Project Tests
    
    func testCompileWithIncludeStatement() throws {
        let mainSource = """
        Include "test_utils.bb"
        Function Main()
            Print GetMessage()
        End Function
        """
        
        let utilsSource = """
        Function GetMessage$()
            Return "Hello from included file!"
        End Function
        """
        
        // Parse and combine sources
        var parser = Parser(source: mainSource)
        let mainProgram = parser.parse()
        
        var utilsParser = Parser(source: utilsSource)
        let utilsProgram = utilsParser.parse()
        
        // Combine programs
        var combinedProgram = ProgramNode()
        combinedProgram.statements = mainProgram.statements
        combinedProgram.functions = mainProgram.functions + utilsProgram.functions
        combinedProgram.types = mainProgram.types + utilsProgram.types
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: combinedProgram)
        
        // Should have both functions
        XCTAssertGreaterThanOrEqual(module.code.count, 2)
        
        // Both functions should be exported
        let mainExport = module.exports.first { $0.name == "Main" }
        let getMessageExport = module.exports.first { $0.name == "GetMessage" }
        XCTAssertNotNil(mainExport)
        XCTAssertNotNil(getMessageExport)
    }
    
    // MARK: - Asset Manifest Tests
    
    func testAssetManifestGeneration() throws {
        let source = """
        Function Main()
            Local message$
            Data "Test asset content"
            Read message$
            Print message$
        End Function
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        // Should have data sections
        XCTAssertGreaterThan(module.data.count, 0)
        
        // Generate binary
        var encoder = WASMBinaryEncoder()
        let wasmBytes = encoder.encode(module)
        
        // Verify WASM structure
        XCTAssertEqual(wasmBytes[0], 0x00, "WASM magic byte 1")
        XCTAssertEqual(wasmBytes[1], 0x61, "WASM magic byte 2")
        XCTAssertEqual(wasmBytes[2], 0x73, "WASM magic byte 3")
        XCTAssertEqual(wasmBytes[3], 0x6D, "WASM magic byte 4 (asm)")
        XCTAssertEqual(wasmBytes[4], 0x01, "WASM version byte 1")
        XCTAssertEqual(wasmBytes[5], 0x00, "WASM version byte 2")
        XCTAssertEqual(wasmBytes[6], 0x00, "WASM version byte 3")
        XCTAssertEqual(wasmBytes[7], 0x00, "WASM version byte 4")
    }
    
    // MARK: - Complex Data Structures
    
    func testCompileNestedData() throws {
        let source = """
        Function Main()
            Local x, y, z
            Data 1, 2, 3
            Data 4, 5, 6
            Data 7, 8, 9
            Read x, y, z
            Print x
            Read x, y, z
            Print x
            Read x, y, z
            Print x
        End Function
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        // Should have multiple data sections
        XCTAssertGreaterThanOrEqual(module.data.count, 1)
        
        var encoder = WASMBinaryEncoder()
        let wasmBytes = encoder.encode(module)
        XCTAssertGreaterThan(wasmBytes.count, 0)
    }
    
    func testCompileDataWithExpressions() throws {
        let source = """
        Function Main()
            Local result
            Data 10 + 5, 2 * 3, "test" + "ing"
            Read result
            Print result
        End Function
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThanOrEqual(module.code.count, 1)
    }
    
    // MARK: - Edge Cases
    
    func testCompileEmptyData() throws {
        let source = """
        Function Main()
            Data
            Print "Done"
        End Function
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThanOrEqual(module.code.count, 1)
    }
    
    func testCompileDataWithSingleValue() throws {
        let source = """
        Function Main()
            Local value
            Data 42
            Read value
            Print value
        End Function
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThan(module.data.count, 0)
    }
}
