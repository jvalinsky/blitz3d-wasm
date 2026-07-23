//
//  ConstantOverflowTests.swift
//  CompilerTests
//
//  Regression test for a SIGTRAP compiler crash found while compiling SCPCB:
//  `Const C_WS_POPUP = $80000000` parses to the Swift Int 2147483648 (hex/binary
//  literals are unsigned bit patterns), and reading that constant back as an
//  identifier did `Int32(constValue)` — a trapping conversion — instead of
//  `Int32(truncatingIfNeeded:)` like integer literals already use.
//

import Testing
@testable import Blitz3DCompiler

struct ConstantOverflowTests {

    @Test func testHexConstantAboveInt32MaxDoesNotTrap() throws {
        let source = """
        Const C_WS_POPUP = $80000000

        Function Main()
            Local x = C_WS_POPUP
        End Function
        """
        var parser = Parser(source: source)
        let program = parser.parse()

        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)

        guard let mainExport = module.exports.first(where: { $0.name == "Main" }) else {
            Issue.record("Main function not exported")
            return
        }
        let funcIndex = mainExport.index - module.imports.count
        let mainFunction = module.code[funcIndex]

        let constants: [Int32] = mainFunction.body.compactMap {
            if case .i32Const(let v) = $0 { return v }
            return nil
        }
        // $80000000 truncated to 32 bits is Int32.min (bit pattern 0x80000000).
        XCTAssertTrue(constants.contains(Int32.min))
    }

    @Test func testBinaryConstantAboveInt32MaxDoesNotTrap() throws {
        let source = """
        Const C_FLAG = %10000000000000000000000000000000

        Function Main()
            Local x = C_FLAG
        End Function
        """
        var parser = Parser(source: source)
        let program = parser.parse()

        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)

        guard let mainExport = module.exports.first(where: { $0.name == "Main" }) else {
            Issue.record("Main function not exported")
            return
        }
        let funcIndex = mainExport.index - module.imports.count
        let mainFunction = module.code[funcIndex]

        let constants: [Int32] = mainFunction.body.compactMap {
            if case .i32Const(let v) = $0 { return v }
            return nil
        }
        XCTAssertTrue(constants.contains(Int32.min))
    }
}
