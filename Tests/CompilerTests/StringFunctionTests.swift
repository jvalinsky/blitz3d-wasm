//
//  StringFunctionTests.swift
//  CompilerTests
//
//  Tests for string function compilation
//

import XCTest
@testable import Blitz3DCompiler

final class StringFunctionTests: XCTestCase {
    
    func testStringLength() throws {
        let source = """
        Function TestLen()
            Local s$ = "hello"
            Local l = Len(s)
        End Function
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThan(module.code.count, 0)
    }
    
    func testStringLeft() throws {
        let source = """
        Function TestLeft()
            Local s$ = "hello"
            Local l$ = Left(s, 3)
        End Function
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThan(module.code.count, 0)
    }
    
    func testStringRight() throws {
        let source = """
        Function TestRight()
            Local s$ = "hello"
            Local r$ = Right(s, 3)
        End Function
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThan(module.code.count, 0)
    }
    
    func testStringMid() throws {
        let source = """
        Function TestMid()
            Local s$ = "hello"
            Local m$ = Mid(s, 2, 3)
        End Function
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThan(module.code.count, 0)
    }
    
    func testStringUpper() throws {
        let source = """
        Function TestUpper()
            Local s$ = "hello"
            Local u$ = Upper(s)
        End Function
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThan(module.code.count, 0)
    }
    
    func testStringLower() throws {
        let source = """
        Function TestLower()
            Local s$ = "HELLO"
            Local l$ = Lower(s)
        End Function
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThan(module.code.count, 0)
    }
    
    func testStringReplace() throws {
        let source = """
        Function TestReplace()
            Local s$ = "hello world"
            Local r$ = Replace(s, "world", "test")
        End Function
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThan(module.code.count, 0)
    }
    
    func testStringInstr() throws {
        let source = """
        Function TestInstr()
            Local s$ = "hello world"
            Local i = Instr(s, "world")
        End Function
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThan(module.code.count, 0)
    }
    
    func testStringTrim() throws {
        let source = """
        Function TestTrim()
            Local s$ = "  hello  "
            Local t$ = Trim(s)
        End Function
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThan(module.code.count, 0)
    }
    
    func testAsc() throws {
        let source = """
        Function TestAsc()
            Local s$ = "A"
            Local c = Asc(s)
        End Function
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThan(module.code.count, 0)
    }
    
    func testChr() throws {
        let source = """
        Function TestChr()
            Local c$ = Chr(65)
        End Function
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThan(module.code.count, 0)
    }
    
    func testHex() throws {
        let source = """
        Function TestHex()
            Local h$ = Hex(255)
        End Function
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThan(module.code.count, 0)
    }
    
    func testBin() throws {
        let source = """
        Function TestBin()
            Local b$ = Bin(10)
        End Function
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThan(module.code.count, 0)
    }
    
    func testSeededRandom() throws {
        let source = """
        Function TestSeededRnd()
            SeedRnd(12345)
            Local r1 = Rnd(0, 100)
            SeedRnd(12345)
            Local r2 = Rnd(0, 100)
            SeedRnd(0)
            Local r3 = Rnd(0, 1)
        End Function
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThan(module.code.count, 0)
    }
    
    func testCombinedStringFunctions() throws {
        let source = """
        Function ProcessString(text$)
            Local upper$ = Upper(text)
            Local len = Len(upper)
            Local first3$ = Left(upper, 3)
            Local found = Instr(first3, "A")
            Return found
        End Function
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        XCTAssertEqual(program.functions.count, 1)
        XCTAssertEqual(program.functions[0].name, "ProcessString")
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThan(module.code.count, 0)
    }
}
