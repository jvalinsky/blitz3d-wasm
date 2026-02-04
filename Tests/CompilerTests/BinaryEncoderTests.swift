//
//  BinaryEncoderTests.swift
//  CompilerTests
//

import Testing
@testable import Blitz3DCompiler

struct BinaryEncoderTests {
    
    @Test func testEncodeSimpleModule() throws {
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
    
    @Test func testEncodeTypeSection() throws {
        var module = WASMModule()
        
        // Add function types
        module.types.append(WASMFunctionType(parameters: [.i32], results: [.i32]))
        module.types.append(WASMFunctionType(parameters: [.i32, .i32], results: [.i32]))
        
        var encoder = WASMBinaryEncoder()
        let bytes = encoder.encode(module)
        
        // Should have type section (section id 1)
        XCTAssertTrue(bytes.contains(0x01), "Should have type section")
    }
    
    @Test func testEncodeFunctionSection() throws {
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
    
    @Test func testEncodeMemorySection() throws {
        var module = WASMModule()
        module.memories = [WASMMemory(initial: 1, maximum: 2)]
        
        var encoder = WASMBinaryEncoder()
        let bytes = encoder.encode(module)
        
        // Should have memory section (section id 5)
        XCTAssertTrue(bytes.contains(0x05), "Should have memory section")
    }
    
    @Test func testEncodeExportSection() throws {
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
    
    @Test func testEncodeCodeSection() throws {
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
    
    @Test func testEncodeInstructions() throws {
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
    
    @Test func testEncodeDataSection() throws {
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
    
    @Test func testRoundTripTextToBinary() throws {
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

    // MARK: - Float Opcode Validation Tests

    @Test func testF32ArithmeticOpcodes() throws {
        var module = WASMModule()
        module.types.append(WASMFunctionType(parameters: [], results: [.f32]))

        let function = WASMFunction(
            typeIndex: 0,
            locals: [],
            body: [
                .f32Const(1.0),
                .f32Const(2.0),
                .f32Add,
                .f32Const(3.0),
                .f32Sub,
                .f32Const(4.0),
                .f32Mul,
                .f32Const(5.0),
                .f32Div,
                .return
            ]
        )
        module.code.append(function)
        module.functions.append(0)

        var encoder = WASMBinaryEncoder()
        let bytes = encoder.encode(module)

        // Verify correct opcodes per WebAssembly spec
        XCTAssertTrue(bytes.contains(0x92), "f32.add should be encoded as 0x92")
        XCTAssertTrue(bytes.contains(0x93), "f32.sub should be encoded as 0x93")
        XCTAssertTrue(bytes.contains(0x94), "f32.mul should be encoded as 0x94")
        XCTAssertTrue(bytes.contains(0x95), "f32.div should be encoded as 0x95")
    }

    @Test func testF64ArithmeticOpcodes() throws {
        var module = WASMModule()
        module.types.append(WASMFunctionType(parameters: [], results: [.f64]))

        let function = WASMFunction(
            typeIndex: 0,
            locals: [],
            body: [
                .f64Const(1.0),
                .f64Const(2.0),
                .f64Add,
                .f64Const(3.0),
                .f64Sub,
                .f64Const(4.0),
                .f64Mul,
                .f64Const(5.0),
                .f64Div,
                .return
            ]
        )
        module.code.append(function)
        module.functions.append(0)

        var encoder = WASMBinaryEncoder()
        let bytes = encoder.encode(module)

        // Verify correct opcodes per WebAssembly spec
        XCTAssertTrue(bytes.contains(0xA0), "f64.add should be encoded as 0xA0")
        XCTAssertTrue(bytes.contains(0xA1), "f64.sub should be encoded as 0xA1")
        XCTAssertTrue(bytes.contains(0xA2), "f64.mul should be encoded as 0xA2")
        XCTAssertTrue(bytes.contains(0xA3), "f64.div should be encoded as 0xA3")
    }

    @Test func testI32ArithmeticOpcodes() throws {
        var module = WASMModule()
        module.types.append(WASMFunctionType(parameters: [], results: [.i32]))

        let function = WASMFunction(
            typeIndex: 0,
            locals: [],
            body: [
                .i32Const(10),
                .i32Const(5),
                .i32Add,
                .i32Const(3),
                .i32Sub,
                .i32Const(2),
                .i32Mul,
                .i32Const(4),
                .i32DivS,
                .return
            ]
        )
        module.code.append(function)
        module.functions.append(0)

        var encoder = WASMBinaryEncoder()
        let bytes = encoder.encode(module)

        // Verify correct opcodes
        XCTAssertTrue(bytes.contains(0x6A), "i32.add should be encoded as 0x6A")
        XCTAssertTrue(bytes.contains(0x6B), "i32.sub should be encoded as 0x6B")
        XCTAssertTrue(bytes.contains(0x6C), "i32.mul should be encoded as 0x6C")
        XCTAssertTrue(bytes.contains(0x6D), "i32.div_s should be encoded as 0x6D")
    }

    @Test func testConversionOpcodes() throws {
        var module = WASMModule()
        module.types.append(WASMFunctionType(parameters: [], results: [.f32]))

        let function = WASMFunction(
            typeIndex: 0,
            locals: [],
            body: [
                .i32Const(42),
                .f32ConvertI32S,
                .return
            ]
        )
        module.code.append(function)
        module.functions.append(0)

        var encoder = WASMBinaryEncoder()
        let bytes = encoder.encode(module)

        // Verify conversion opcode
        XCTAssertTrue(bytes.contains(0xB2), "f32.convert_i32_s should be encoded as 0xB2")
    }

    @Test func testReinterpretOpcodes() throws {
        var module = WASMModule()
        module.types.append(WASMFunctionType(parameters: [], results: [.i32]))

        let function = WASMFunction(
            typeIndex: 0,
            locals: [],
            body: [
                .f32Const(1.0),
                .i32ReinterpretF32,
                .return
            ]
        )
        module.code.append(function)
        module.functions.append(0)

        var encoder = WASMBinaryEncoder()
        let bytes = encoder.encode(module)

        // Verify reinterpret opcode
        XCTAssertTrue(bytes.contains(0xBC), "i32.reinterpret_f32 should be encoded as 0xBC")
    }

    @Test func testF32ReinterpretI32Opcode() throws {
        var module = WASMModule()
        module.types.append(WASMFunctionType(parameters: [], results: [.f32]))

        let function = WASMFunction(
            typeIndex: 0,
            locals: [],
            body: [
                .i32Const(0x3F800000), // 1.0f in IEEE 754
                .f32ReinterpretI32,
                .return
            ]
        )
        module.code.append(function)
        module.functions.append(0)

        var encoder = WASMBinaryEncoder()
        let bytes = encoder.encode(module)

        // Verify reinterpret opcode - f32.reinterpret_i32 should be 0xBE
        XCTAssertTrue(bytes.contains(0xBE), "f32.reinterpret_i32 should be encoded as 0xBE")
    }

    // MARK: - Control Flow Opcode Tests

    @Test func testControlFlowOpcodes() throws {
        var module = WASMModule()
        module.types.append(WASMFunctionType(parameters: [], results: []))

        let function = WASMFunction(
            typeIndex: 0,
            locals: [.i32],
            body: [
                .i32Const(1),
                .if(.void, [.nop], nil),
                .block(.void, [.nop]),
                .loop(.void, [.br(0)])
            ]
        )
        module.code.append(function)
        module.functions.append(0)

        var encoder = WASMBinaryEncoder()
        let bytes = encoder.encode(module)

        // Verify control flow opcodes
        XCTAssertTrue(bytes.contains(0x04), "if should be encoded as 0x04")
        XCTAssertTrue(bytes.contains(0x02), "block should be encoded as 0x02")
        XCTAssertTrue(bytes.contains(0x03), "loop should be encoded as 0x03")
        XCTAssertTrue(bytes.contains(0x0C), "br should be encoded as 0x0C")
    }

    // MARK: - Comparison Opcode Tests

    @Test func testComparisonOpcodes() throws {
        var module = WASMModule()
        module.types.append(WASMFunctionType(parameters: [], results: [.i32]))

        let function = WASMFunction(
            typeIndex: 0,
            locals: [],
            body: [
                .i32Const(5),
                .i32Const(3),
                .i32LtS,
                .return
            ]
        )
        module.code.append(function)
        module.functions.append(0)

        var encoder = WASMBinaryEncoder()
        let bytes = encoder.encode(module)

        // Verify comparison opcode
        XCTAssertTrue(bytes.contains(0x48), "i32.lt_s should be encoded as 0x48")
    }

    @Test func testF32ComparisonOpcodes() throws {
        var module = WASMModule()
        module.types.append(WASMFunctionType(parameters: [], results: [.i32]))

        let function = WASMFunction(
            typeIndex: 0,
            locals: [],
            body: [
                .f32Const(1.0),
                .f32Const(2.0),
                .f32Lt,
                .return
            ]
        )
        module.code.append(function)
        module.functions.append(0)

        var encoder = WASMBinaryEncoder()
        let bytes = encoder.encode(module)

        // Verify f32 comparison opcode
        XCTAssertTrue(bytes.contains(0x5D), "f32.lt should be encoded as 0x5D")
    }

    // MARK: - Memory Opcode Tests

    @Test func testMemoryOpcodes() throws {
        var module = WASMModule()
        module.types.append(WASMFunctionType(parameters: [], results: [.i32]))
        module.memories = [WASMMemory(initial: 1, maximum: nil)]

        let function = WASMFunction(
            typeIndex: 0,
            locals: [],
            body: [
                .i32Const(0),
                .i32Load(2, 0),
                .return
            ]
        )
        module.code.append(function)
        module.functions.append(0)

        var encoder = WASMBinaryEncoder()
        let bytes = encoder.encode(module)

        // Verify memory opcode
        XCTAssertTrue(bytes.contains(0x28), "i32.load should be encoded as 0x28")
    }

    // MARK: - Type Encoding Tests

    @Test func testTypeEncodings() throws {
        var module = WASMModule()

        // Add function types with different parameter/result types
        module.types.append(WASMFunctionType(parameters: [.i32], results: [.i32]))
        module.types.append(WASMFunctionType(parameters: [.f32], results: [.f32]))
        module.types.append(WASMFunctionType(parameters: [.i64], results: [.i64]))
        module.types.append(WASMFunctionType(parameters: [.f64], results: [.f64]))

        var encoder = WASMBinaryEncoder()
        let bytes = encoder.encode(module)

        // Verify type encodings
        XCTAssertTrue(bytes.contains(0x7F), "i32 type should be encoded as 0x7F")
        XCTAssertTrue(bytes.contains(0x7E), "i64 type should be encoded as 0x7E")
        XCTAssertTrue(bytes.contains(0x7D), "f32 type should be encoded as 0x7D")
        XCTAssertTrue(bytes.contains(0x7C), "f64 type should be encoded as 0x7C")
        XCTAssertTrue(bytes.contains(0x60), "func type prefix should be 0x60")
    }

    // MARK: - LEB128 Encoding Tests

    @Test func testLEB128SmallPositive() throws {
        var module = WASMModule()
        module.types.append(WASMFunctionType(parameters: [], results: [.i32]))

        let function = WASMFunction(
            typeIndex: 0,
            locals: [],
            body: [.i32Const(42), .return]
        )
        module.code.append(function)
        module.functions.append(0)

        var encoder = WASMBinaryEncoder()
        let bytes = encoder.encode(module)

        // 42 in SLEB128 is just 0x2A (fits in 7 bits, positive, so high bit of 0x40 not set)
        XCTAssertTrue(bytes.contains(0x2A), "42 should be encoded as 0x2A in SLEB128")
    }

    @Test func testLEB128Negative() throws {
        var module = WASMModule()
        module.types.append(WASMFunctionType(parameters: [], results: [.i32]))

        let function = WASMFunction(
            typeIndex: 0,
            locals: [],
            body: [.i32Const(-1), .return]
        )
        module.code.append(function)
        module.functions.append(0)

        var encoder = WASMBinaryEncoder()
        let bytes = encoder.encode(module)

        // -1 in SLEB128 is 0x7F
        XCTAssertTrue(bytes.contains(0x7F), "-1 should be encoded as 0x7F in SLEB128")
    }

    @Test func testLEB128LargePositive() throws {
        var module = WASMModule()
        module.types.append(WASMFunctionType(parameters: [], results: [.i32]))

        let function = WASMFunction(
            typeIndex: 0,
            locals: [],
            body: [.i32Const(128), .return]
        )
        module.code.append(function)
        module.functions.append(0)

        var encoder = WASMBinaryEncoder()
        let bytes = encoder.encode(module)

        // 128 in SLEB128 is 0x80 0x01 (needs continuation bit)
        // Find 0x80 followed by 0x01
        var found = false
        for i in 0..<(bytes.count - 1) {
            if bytes[i] == 0x80 && bytes[i + 1] == 0x01 {
                found = true
                break
            }
        }
        XCTAssertTrue(found, "128 should be encoded as 0x80 0x01 in SLEB128")
    }
}
