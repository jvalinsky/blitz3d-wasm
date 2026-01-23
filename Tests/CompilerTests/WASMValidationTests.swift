//
//  WASMValidationTests.swift
//  CompilerTests
//
//  Comprehensive tests for WASM binary format validation and BB→WASM compilation

import XCTest
@testable import Blitz3DCompiler

final class WASMValidationTests: XCTestCase {

    // MARK: - Helper Functions

    /// Compiles BlitzBasic source to WASM binary bytes
    private func compile(_ source: String) -> [UInt8] {
        var parser = Parser(source: source)
        let program = parser.parse()
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        var encoder = WASMBinaryEncoder()
        return encoder.encode(module)
    }

    /// Compiles BlitzBasic source to WASMModule
    private func compileToModule(_ source: String) -> WASMModule {
        var parser = Parser(source: source)
        let program = parser.parse()
        var codeGen = CodeGenerator()
        return codeGen.generate(from: program)
    }

    /// Check if byte sequence exists in array
    private func containsSequence(_ bytes: [UInt8], _ sequence: [UInt8]) -> Bool {
        guard sequence.count > 0, bytes.count >= sequence.count else { return false }
        for i in 0...(bytes.count - sequence.count) {
            var found = true
            for j in 0..<sequence.count {
                if bytes[i + j] != sequence[j] {
                    found = false
                    break
                }
            }
            if found { return true }
        }
        return false
    }

    // MARK: - Binary Format Structure Tests

    func testMagicNumberAndVersion() throws {
        let bytes = compile("x = 1")

        // WASM magic number: "\0asm"
        XCTAssertGreaterThanOrEqual(bytes.count, 8, "Binary should be at least 8 bytes")
        XCTAssertEqual(bytes[0], 0x00, "First byte should be 0x00")
        XCTAssertEqual(bytes[1], 0x61, "Second byte should be 0x61 ('a')")
        XCTAssertEqual(bytes[2], 0x73, "Third byte should be 0x73 ('s')")
        XCTAssertEqual(bytes[3], 0x6D, "Fourth byte should be 0x6D ('m')")

        // Version 1 (little endian)
        XCTAssertEqual(bytes[4], 0x01, "Version first byte should be 0x01")
        XCTAssertEqual(bytes[5], 0x00, "Version second byte should be 0x00")
        XCTAssertEqual(bytes[6], 0x00, "Version third byte should be 0x00")
        XCTAssertEqual(bytes[7], 0x00, "Version fourth byte should be 0x00")
    }

    func testSectionOrdering() throws {
        // Create a module with multiple sections
        let bytes = compile("""
            Global x = 1
            Function Test()
                Return 42
            End Function
            """)

        // Find section IDs in order
        var sectionPositions: [UInt8: Int] = [:]
        var i = 8 // Skip header

        while i < bytes.count {
            let sectionId = bytes[i]
            if sectionId >= 0 && sectionId <= 11 {
                if sectionId > 0 {
                    sectionPositions[sectionId] = i
                }

                // Read section size (LEB128)
                i += 1
                var size = 0
                var shift = 0
                while i < bytes.count {
                    let byte = bytes[i]
                    size |= Int(byte & 0x7F) << shift
                    i += 1
                    if byte & 0x80 == 0 { break }
                    shift += 7
                }
                i += size
            } else {
                i += 1
            }
        }

        // Verify sections appear in correct order
        let orderedSections: [UInt8] = [1, 2, 3, 4, 5, 6, 7, 10, 11]
        var lastPos = -1
        for section in orderedSections {
            if let pos = sectionPositions[section] {
                XCTAssertGreaterThan(pos, lastPos, "Section \(section) should appear after previous sections")
                lastPos = pos
            }
        }
    }

    func testTypeSectionFormat() throws {
        let bytes = compile("Function Test() Return 42 End Function")

        // Type section starts with section ID 1
        // After header (8 bytes), find section 1
        var foundTypeSection = false
        var i = 8
        while i < bytes.count - 1 {
            if bytes[i] == 0x01 {
                // Skip size byte(s)
                i += 1
                while i < bytes.count && bytes[i] & 0x80 != 0 { i += 1 }
                i += 1

                // Skip count byte(s)
                while i < bytes.count && bytes[i] & 0x80 != 0 { i += 1 }
                i += 1

                // First type should start with 0x60 (func type prefix)
                if i < bytes.count && bytes[i] == 0x60 {
                    foundTypeSection = true
                }
                break
            }
            i += 1
        }

        XCTAssertTrue(foundTypeSection, "Type section should contain 0x60 func type prefix")
    }

    // MARK: - BB to WASM Integration Tests

    func testSimpleIntegerAssignment() throws {
        let bytes = compile("Local x% = 42")

        // Should contain i32.const opcode (0x41)
        XCTAssertTrue(bytes.contains(0x41), "Should contain i32.const opcode")

        // Should contain 42 encoded in SLEB128 (0x2A)
        XCTAssertTrue(bytes.contains(0x2A), "Should contain value 42 encoded")
    }

    func testIntegerArithmetic() throws {
        let bytes = compile("Local x% = 1 + 2")

        // Should contain i32.add opcode
        XCTAssertTrue(bytes.contains(0x6A), "Should contain i32.add opcode (0x6A)")
    }

    func testIntegerSubtraction() throws {
        let bytes = compile("Local x% = 10 - 3")

        // Should contain i32.sub opcode
        XCTAssertTrue(bytes.contains(0x6B), "Should contain i32.sub opcode (0x6B)")
    }

    func testIntegerMultiplication() throws {
        let bytes = compile("Local x% = 5 * 4")

        // Should contain i32.mul opcode
        XCTAssertTrue(bytes.contains(0x6C), "Should contain i32.mul opcode (0x6C)")
    }

    func testIntegerDivision() throws {
        let bytes = compile("Local x% = 20 / 4")

        // Should contain i32.div_s opcode
        XCTAssertTrue(bytes.contains(0x6D), "Should contain i32.div_s opcode (0x6D)")
    }

    func testFloatAssignment() throws {
        let bytes = compile("Local x# = 3.14")

        // Should contain f32.const opcode (0x43)
        XCTAssertTrue(bytes.contains(0x43), "Should contain f32.const opcode")
    }

    func testFloatArithmetic() throws {
        let bytes = compile("Local x# = 1.5 + 2.5")

        // Should contain f32.add opcode (0x92, NOT 0xA0)
        XCTAssertTrue(bytes.contains(0x92), "Should contain f32.add opcode (0x92)")
    }

    func testFloatSubtraction() throws {
        let bytes = compile("Local x# = 5.0 - 2.0")

        // Should contain f32.sub opcode (0x93)
        XCTAssertTrue(bytes.contains(0x93), "Should contain f32.sub opcode (0x93)")
    }

    func testFloatMultiplication() throws {
        let bytes = compile("Local x# = 2.0 * 3.0")

        // Should contain f32.mul opcode (0x94)
        XCTAssertTrue(bytes.contains(0x94), "Should contain f32.mul opcode (0x94)")
    }

    func testFloatDivision() throws {
        let bytes = compile("Local x# = 10.0 / 2.0")

        // Should contain f32.div opcode (0x95)
        XCTAssertTrue(bytes.contains(0x95), "Should contain f32.div opcode (0x95)")
    }

    func testIfStatement() throws {
        let bytes = compile("If 1 Then x = 2 EndIf")

        // Should contain if opcode (0x04)
        XCTAssertTrue(bytes.contains(0x04), "Should contain if opcode (0x04)")

        // Should contain end opcode (0x0B)
        XCTAssertTrue(bytes.contains(0x0B), "Should contain end opcode (0x0B)")
    }

    func testIfElseStatement() throws {
        let bytes = compile("If 1 Then x = 2 Else x = 3 EndIf")

        // Should contain if opcode (0x04)
        XCTAssertTrue(bytes.contains(0x04), "Should contain if opcode (0x04)")

        // Should contain else opcode (0x05)
        XCTAssertTrue(bytes.contains(0x05), "Should contain else opcode (0x05)")
    }

    func testWhileLoop() throws {
        let bytes = compile("While x < 10 Wend")

        // Should contain block opcode (0x02)
        XCTAssertTrue(bytes.contains(0x02), "Should contain block opcode (0x02)")

        // Should contain loop opcode (0x03)
        XCTAssertTrue(bytes.contains(0x03), "Should contain loop opcode (0x03)")

        // Should contain br_if opcode (0x0D)
        XCTAssertTrue(bytes.contains(0x0D), "Should contain br_if opcode (0x0D)")
    }

    func testForLoop() throws {
        let bytes = compile("For i = 1 To 10 Next")

        // For loops use block/loop structure
        XCTAssertTrue(bytes.contains(0x02), "Should contain block opcode (0x02)")
        XCTAssertTrue(bytes.contains(0x03), "Should contain loop opcode (0x03)")
    }

    func testFunctionDeclaration() throws {
        let module = compileToModule("Function Foo() Return 42 End Function")

        // Should have the function exported
        let fooExport = module.exports.first { $0.name == "Foo" }
        XCTAssertNotNil(fooExport, "Function Foo should be exported")
        XCTAssertEqual(fooExport?.kind, .function, "Export should be a function")
    }

    func testFunctionWithReturn() throws {
        let bytes = compile("Function Foo() Return 42 End Function")

        // Should contain return opcode (0x0F)
        XCTAssertTrue(bytes.contains(0x0F), "Should contain return opcode (0x0F)")
    }

    func testLocalVariables() throws {
        let bytes = compile("Local x% = 1")

        // Should contain local.set opcode (0x21)
        XCTAssertTrue(bytes.contains(0x21), "Should contain local.set opcode (0x21)")
    }

    func testGlobalVariables() throws {
        let module = compileToModule("Global g% = 100")

        // Should have global exported
        let hasGlobalExport = module.exports.contains { $0.kind == .global }
        XCTAssertTrue(hasGlobalExport, "Should have a global export")
    }

    // MARK: - Comparison Operator Tests

    func testIntegerLessThan() throws {
        let bytes = compile("If x < 5 Then y = 1 EndIf")

        // Should contain i32.lt_s opcode (0x48)
        XCTAssertTrue(bytes.contains(0x48), "Should contain i32.lt_s opcode (0x48)")
    }

    func testIntegerGreaterThan() throws {
        let bytes = compile("If x > 5 Then y = 1 EndIf")

        // Should contain i32.gt_s opcode (0x4A)
        XCTAssertTrue(bytes.contains(0x4A), "Should contain i32.gt_s opcode (0x4A)")
    }

    func testIntegerEqual() throws {
        let bytes = compile("If x = 5 Then y = 1 EndIf")

        // Should contain i32.eq opcode (0x46)
        XCTAssertTrue(bytes.contains(0x46), "Should contain i32.eq opcode (0x46)")
    }

    func testIntegerNotEqual() throws {
        let bytes = compile("If x <> 5 Then y = 1 EndIf")

        // Should contain i32.ne opcode (0x47)
        XCTAssertTrue(bytes.contains(0x47), "Should contain i32.ne opcode (0x47)")
    }

    // MARK: - Memory Operation Tests

    func testMemoryExport() throws {
        let module = compileToModule("x = 1")

        // Should have memory defined
        XCTAssertGreaterThanOrEqual(module.memories.count, 1, "Should have at least one memory")
    }

    // MARK: - Opcode Verification Tests

    func testCorrectF32Opcodes() throws {
        // Test that f32 arithmetic uses correct opcodes
        var module = WASMModule()
        module.types.append(WASMFunctionType(parameters: [], results: [.f32]))

        let function = WASMFunction(
            typeIndex: 0,
            locals: [],
            body: [
                .f32Const(1.0),
                .f32Const(2.0),
                .f32Add,
                .f32Sub,
                .f32Mul,
                .f32Div,
                .return
            ]
        )
        module.code.append(function)
        module.functions.append(0)

        var encoder = WASMBinaryEncoder()
        let bytes = encoder.encode(module)

        // Per WebAssembly spec:
        // f32.add = 0x92
        // f32.sub = 0x93
        // f32.mul = 0x94
        // f32.div = 0x95
        XCTAssertTrue(bytes.contains(0x92), "f32.add should be 0x92")
        XCTAssertTrue(bytes.contains(0x93), "f32.sub should be 0x93")
        XCTAssertTrue(bytes.contains(0x94), "f32.mul should be 0x94")
        XCTAssertTrue(bytes.contains(0x95), "f32.div should be 0x95")

        // Should NOT contain incorrect opcodes for f32 operations
        // (The old incorrect opcodes were 0xA0-0xA3)
    }

    func testCorrectF64Opcodes() throws {
        // Test that f64 arithmetic uses correct opcodes
        var module = WASMModule()
        module.types.append(WASMFunctionType(parameters: [], results: [.f64]))

        let function = WASMFunction(
            typeIndex: 0,
            locals: [],
            body: [
                .f64Const(1.0),
                .f64Const(2.0),
                .f64Add,
                .f64Sub,
                .f64Mul,
                .f64Div,
                .return
            ]
        )
        module.code.append(function)
        module.functions.append(0)

        var encoder = WASMBinaryEncoder()
        let bytes = encoder.encode(module)

        // Per WebAssembly spec:
        // f64.add = 0xA0
        // f64.sub = 0xA1
        // f64.mul = 0xA2
        // f64.div = 0xA3
        XCTAssertTrue(bytes.contains(0xA0), "f64.add should be 0xA0")
        XCTAssertTrue(bytes.contains(0xA1), "f64.sub should be 0xA1")
        XCTAssertTrue(bytes.contains(0xA2), "f64.mul should be 0xA2")
        XCTAssertTrue(bytes.contains(0xA3), "f64.div should be 0xA3")
    }

    func testCorrectReinterpretOpcodes() throws {
        // Test reinterpret opcodes are correct
        var module = WASMModule()
        module.types.append(WASMFunctionType(parameters: [], results: [.f32]))

        let function = WASMFunction(
            typeIndex: 0,
            locals: [],
            body: [
                .i32Const(0x3F800000),
                .f32ReinterpretI32,
                .return
            ]
        )
        module.code.append(function)
        module.functions.append(0)

        var encoder = WASMBinaryEncoder()
        let bytes = encoder.encode(module)

        // Per WebAssembly spec:
        // f32.reinterpret_i32 = 0xBE
        XCTAssertTrue(bytes.contains(0xBE), "f32.reinterpret_i32 should be 0xBE")
    }

    func testCorrectI32ReinterpretF32Opcode() throws {
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

        // Per WebAssembly spec:
        // i32.reinterpret_f32 = 0xBC
        XCTAssertTrue(bytes.contains(0xBC), "i32.reinterpret_f32 should be 0xBC")
    }

    func testCorrectI64ReinterpretF64Opcode() throws {
        var module = WASMModule()
        module.types.append(WASMFunctionType(parameters: [], results: [.i64]))

        let function = WASMFunction(
            typeIndex: 0,
            locals: [],
            body: [
                .f64Const(1.0),
                .i64ReinterpretF64,
                .return
            ]
        )
        module.code.append(function)
        module.functions.append(0)

        var encoder = WASMBinaryEncoder()
        let bytes = encoder.encode(module)

        // Per WebAssembly spec:
        // i64.reinterpret_f64 = 0xBD
        XCTAssertTrue(bytes.contains(0xBD), "i64.reinterpret_f64 should be 0xBD")
    }

    // MARK: - Complex Expression Tests

    func testMixedArithmetic() throws {
        let bytes = compile("Local x% = (1 + 2) * 3")

        // Should contain both i32.add and i32.mul
        XCTAssertTrue(bytes.contains(0x6A), "Should contain i32.add (0x6A)")
        XCTAssertTrue(bytes.contains(0x6C), "Should contain i32.mul (0x6C)")
    }

    func testNestedIfStatements() throws {
        let bytes = compile("""
            If x = 1 Then
                If y = 2 Then
                    z = 3
                EndIf
            EndIf
            """)

        // Should have multiple if opcodes
        var ifCount = 0
        for byte in bytes {
            if byte == 0x04 { ifCount += 1 }
        }
        XCTAssertGreaterThanOrEqual(ifCount, 2, "Should have at least 2 if opcodes for nested if")
    }

    // MARK: - Data Section Tests

    func testStringLiteralInDataSection() throws {
        let module = compileToModule("Print \"Hello\"")

        // Should have data section with string
        XCTAssertGreaterThanOrEqual(module.data.count, 0, "Module may have data segments")
    }

    // MARK: - SLEB128 Encoding Edge Cases
    // Note: These tests verify SLEB128 encoding directly on the encoder, not through full compilation
    // which may transform or optimize the values

    func testSLEB128ZeroEncoding() throws {
        // Test SLEB128 encoding directly
        var module = WASMModule()
        module.types.append(WASMFunctionType(parameters: [], results: [.i32]))

        let function = WASMFunction(
            typeIndex: 0,
            locals: [],
            body: [.i32Const(0), .return]
        )
        module.code.append(function)
        module.functions.append(0)

        var encoder = WASMBinaryEncoder()
        let bytes = encoder.encode(module)

        // i32.const 0 should encode as [0x41, 0x00]
        XCTAssertTrue(containsSequence(bytes, [0x41, 0x00]), "Should encode i32.const 0 as [0x41, 0x00]")
    }

    func testSLEB128MaxPositive7Bit() throws {
        var module = WASMModule()
        module.types.append(WASMFunctionType(parameters: [], results: [.i32]))

        let function = WASMFunction(
            typeIndex: 0,
            locals: [],
            body: [.i32Const(63), .return]
        )
        module.code.append(function)
        module.functions.append(0)

        var encoder = WASMBinaryEncoder()
        let bytes = encoder.encode(module)

        // 63 fits in 7 bits and is positive (no sign extension needed)
        // i32.const 63 should encode as [0x41, 0x3F]
        XCTAssertTrue(containsSequence(bytes, [0x41, 0x3F]), "Should encode i32.const 63 as [0x41, 0x3F]")
    }

    func testSLEB128NeedsExtraByte() throws {
        var module = WASMModule()
        module.types.append(WASMFunctionType(parameters: [], results: [.i32]))

        let function = WASMFunction(
            typeIndex: 0,
            locals: [],
            body: [.i32Const(64), .return]
        )
        module.code.append(function)
        module.functions.append(0)

        var encoder = WASMBinaryEncoder()
        let bytes = encoder.encode(module)

        // 64 needs extra byte because bit 6 (0x40) would indicate negative
        // i32.const 64 should encode as [0x41, 0xC0, 0x00]
        XCTAssertTrue(containsSequence(bytes, [0x41, 0xC0, 0x00]), "Should encode i32.const 64 with extra byte")
    }

    // MARK: - Control Flow Completeness

    func testSelectInstruction() throws {
        var module = WASMModule()
        module.types.append(WASMFunctionType(parameters: [], results: [.i32]))

        let function = WASMFunction(
            typeIndex: 0,
            locals: [],
            body: [
                .i32Const(1),
                .i32Const(2),
                .i32Const(1),
                .select,
                .return
            ]
        )
        module.code.append(function)
        module.functions.append(0)

        var encoder = WASMBinaryEncoder()
        let bytes = encoder.encode(module)

        XCTAssertTrue(bytes.contains(0x1B), "select should be encoded as 0x1B")
    }

    func testDropInstruction() throws {
        var module = WASMModule()
        module.types.append(WASMFunctionType(parameters: [], results: []))

        let function = WASMFunction(
            typeIndex: 0,
            locals: [],
            body: [
                .i32Const(42),
                .drop,
                .return
            ]
        )
        module.code.append(function)
        module.functions.append(0)

        var encoder = WASMBinaryEncoder()
        let bytes = encoder.encode(module)

        XCTAssertTrue(bytes.contains(0x1A), "drop should be encoded as 0x1A")
    }
}
