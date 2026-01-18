//
//  BinaryEncoderTests.swift
//  CompilerTests
//

import XCTest
@testable import Blitz3DCompiler

final class BinaryEncoderTests: XCTestCase {
    
    func testEncodeSimpleModule() throws {
        var module = WASMModule()
        
        // Add a simple function type: () -> i32
        module.types.append(WASMFunctionType(parameters: [], results: [.i32]))
        
        // Add a function with body: return 42
        let function = WASMFunction(
            typeIndex: 0,
            locals: [],
            body: [.i32Const(42), .return]
        )
        module.code.append(function)
        module.functions.append(0)
        
        // Export the function
        module.exports.append(WASMExport(name: "test", kind: .function, index: 0))
        
        var encoder = WASMBinaryEncoder()
        let bytes = encoder.encode(module)
        
        // Should have magic number and version (8 bytes) + at least some sections
        XCTAssertGreaterThanOrEqual(bytes.count, 8)
        
        // Check magic number
        XCTAssertEqual(bytes[0], 0x00)
        XCTAssertEqual(bytes[1], 0x61)
        XCTAssertEqual(bytes[2], 0x73)
        XCTAssertEqual(bytes[3], 0x6D) // "asm"
        
        // Check version
        XCTAssertEqual(bytes[4], 0x01)
        XCTAssertEqual(bytes[5], 0x00)
        XCTAssertEqual(bytes[6], 0x00)
        XCTAssertEqual(bytes[7], 0x00)
    }
    
    func testEncodeTypeSection() throws {
        var module = WASMModule()
        
        // Add function types
        module.types.append(WASMFunctionType(parameters: [.i32], results: [.i32]))
        module.types.append(WASMFunctionType(parameters: [.i32, .i32], results: [.i32]))
        
        var encoder = WASMBinaryEncoder()
        let bytes = encoder.encode(module)
        
        // Should have type section (section id 1)
        XCTAssertTrue(bytes.contains(0x01), "Should have type section")
    }
    
    func testEncodeFunctionSection() throws {
        var module = WASMModule()
        
        // Add function type
        module.types.append(WASMFunctionType(parameters: [], results: []))
        
        // Add function
        module.functions.append(0)
        module.code.append(WASMFunction(typeIndex: 0, locals: [], body: []))
        
        var encoder = WASMBinaryEncoder()
        let bytes = encoder.encode(module)
        
        // Should have function section (section id 3)
        XCTAssertTrue(bytes.contains(0x03), "Should have function section")
    }
    
    func testEncodeMemorySection() throws {
        var module = WASMModule()
        module.memories = [WASMMemory(initial: 1, maximum: 2)]
        
        var encoder = WASMBinaryEncoder()
        let bytes = encoder.encode(module)
        
        // Should have memory section (section id 5)
        XCTAssertTrue(bytes.contains(0x05), "Should have memory section")
    }
    
    func testEncodeExportSection() throws {
        var module = WASMModule()
        
        // Add function type
        module.types.append(WASMFunctionType(parameters: [], results: []))
        
        // Add function
        module.functions.append(0)
        module.code.append(WASMFunction(typeIndex: 0, locals: [], body: []))
        
        // Export it
        module.exports.append(WASMExport(name: "main", kind: .function, index: 0))
        
        var encoder = WASMBinaryEncoder()
        let bytes = encoder.encode(module)
        
        // Should have export section (section id 7)
        XCTAssertTrue(bytes.contains(0x07), "Should have export section")
    }
    
    func testEncodeCodeSection() throws {
        var module = WASMModule()
        
        // Add function type
        module.types.append(WASMFunctionType(parameters: [], results: []))
        
        // Add function with body
        module.functions.append(0)
        let function = WASMFunction(
            typeIndex: 0,
            locals: [.i32],
            body: [.i32Const(0), .return]
        )
        module.code.append(function)
        
        var encoder = WASMBinaryEncoder()
        let bytes = encoder.encode(module)
        
        // Should have code section (section id 10)
        XCTAssertTrue(bytes.contains(0x0A), "Should have code section")
    }
    
    func testEncodeInstructions() throws {
        // Test encoding of various instructions by encoding a module
        var module = WASMModule()
        module.types.append(WASMFunctionType(parameters: [], results: []))
        
        // Create a function with various instructions
        let function = WASMFunction(
            typeIndex: 0,
            locals: [.i32],
            body: [
                .i32Const(42),
                .localGet(0),
                .i32Add,
                .return
            ]
        )
        module.code.append(function)
        module.functions.append(0)
        
        var encoder = WASMBinaryEncoder()
        let bytes = encoder.encode(module)
        
        // Should have valid WASM binary
        XCTAssertGreaterThan(bytes.count, 8)
        
        // Check that i32.const is encoded (opcode 0x41)
        XCTAssertTrue(bytes.contains(0x41), "Should contain i32.const opcode")
        
        // Check that local.get is encoded (opcode 0x20)
        XCTAssertTrue(bytes.contains(0x20), "Should contain local.get opcode")
        
        // Check that i32.add is encoded (opcode 0x6A)
        XCTAssertTrue(bytes.contains(0x6A), "Should contain i32.add opcode")
        
        // Check that return is encoded (opcode 0x0F)
        XCTAssertTrue(bytes.contains(0x0F), "Should contain return opcode")
    }
    
    func testEncodeDataSection() throws {
        var module = WASMModule()
        
        // Add data segment
        let data = WASMData(
            memoryIndex: 0,
            offset: .i32Const(0),
            bytes: [0x48, 0x65, 0x6C, 0x6C, 0x6F] // "Hello"
        )
        module.data.append(data)
        
        var encoder = WASMBinaryEncoder()
        let bytes = encoder.encode(module)
        
        // Should have data section (section id 11)
        XCTAssertTrue(bytes.contains(0x0B), "Should have data section")
    }
    
    func testRoundTripTextToBinary() throws {
        // Create a simple module
        var module = WASMModule()
        module.types.append(WASMFunctionType(parameters: [], results: [.i32]))
        
        let function = WASMFunction(
            typeIndex: 0,
            locals: [],
            body: [.i32Const(123), .return]
        )
        module.code.append(function)
        module.functions.append(0)
        module.exports.append(WASMExport(name: "test", kind: .function, index: 0))
        
        // Encode to binary
        var encoder = WASMBinaryEncoder()
        let binary = encoder.encode(module)
        
        // Should produce valid WASM binary
        XCTAssertGreaterThan(binary.count, 8)
        
        // Magic number check
        XCTAssertEqual(binary[0], 0x00)
        XCTAssertEqual(binary[1], 0x61)
        XCTAssertEqual(binary[2], 0x73)
        XCTAssertEqual(binary[3], 0x6D)
        
        // Version check
        XCTAssertEqual(binary[4], 0x01)
    }
}
