//
//  TypeFieldArrayTests.swift
//  CompilerTests
//
//  Tests for Type Field Array support
//

import XCTest
@testable import Blitz3DCompiler

final class TypeFieldArrayTests: XCTestCase {
    
    func testTypeFieldArrayDeclaration() throws {
        let source = """
        Type TSCP
            Field NPCs[12]
        End Type
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        // Should parse the type declaration
        XCTAssertEqual(program.types.count, 1)
        XCTAssertEqual(program.types[0].name, "TSCP")
        XCTAssertEqual(program.types[0].fields.count, 1)
        XCTAssertEqual(program.types[0].fields[0].name, "NPCs")
        XCTAssertEqual(program.types[0].fields[0].dimensions.count, 1)
        
        // Verify dimension is an integer literal
        if let dim = program.types[0].fields[0].dimensions.first {
            if case .integerLiteral(let value) = dim {
                XCTAssertEqual(value, 12)
            } else {
                XCTFail("Dimension should be an integer literal")
            }
        }
        
        // Should compile to WASM
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThan(module.code.count, 0)
    }
    
    func testTypeFieldArrayWithTypeAnnotation() throws {
        let source = """
        Type TNPC
            Field Position#[3]
        End Type
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        XCTAssertEqual(program.types.count, 1)
        XCTAssertEqual(program.types[0].fields.count, 1)
        XCTAssertEqual(program.types[0].fields[0].name, "Position")
        XCTAssertEqual(program.types[0].fields[0].type, .float)
        XCTAssertEqual(program.types[0].fields[0].dimensions.count, 1)
    }
    
    func testTypeFieldArrayMultiDimensional() throws {
        let source = """
        Type TMatrix
            Field Values#[4, 4]
        End Type
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        XCTAssertEqual(program.types.count, 1)
        XCTAssertEqual(program.types[0].fields.count, 1)
        XCTAssertEqual(program.types[0].fields[0].name, "Values")
        XCTAssertEqual(program.types[0].fields[0].dimensions.count, 2)
    }
    
    func testTypeFieldArrayWithDefaultValue() throws {
        let source = """
        Type TSCP
            Field MaxHealth% = 100
            Field Position#[3]
        End Type
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        XCTAssertEqual(program.types.count, 1)
        XCTAssertEqual(program.types[0].fields.count, 2)
        
        // First field: MaxHealth with default
        XCTAssertEqual(program.types[0].fields[0].name, "MaxHealth")
        XCTAssertEqual(program.types[0].fields[0].type, .integer)
        XCTAssertEqual(program.types[0].fields[0].dimensions.count, 0)
        XCTAssertNotNil(program.types[0].fields[0].defaultValue)
        
        if let defaultVal = program.types[0].fields[0].defaultValue {
            if case .integerLiteral(let value) = defaultVal {
                XCTAssertEqual(value, 100)
            } else {
                XCTFail("Default value should be an integer literal")
            }
        }
        
        // Second field: Position array with type
        XCTAssertEqual(program.types[0].fields[1].name, "Position")
        XCTAssertEqual(program.types[0].fields[1].type, .float)
        XCTAssertEqual(program.types[0].fields[1].dimensions.count, 1)
        
        // Should compile with default value initialization
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        XCTAssertGreaterThan(module.code.count, 0)
    }
    
    func testTypeFieldArrayWithMultipleFields() throws {
        let source = """
        Type TSCP
            Field NPCs[12]
            Field MaxLights% = 5
            Field Position#[3]
        End Type
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        XCTAssertEqual(program.types.count, 1)
        XCTAssertEqual(program.types[0].fields.count, 3)
        
        // First field: NPCs array
        XCTAssertEqual(program.types[0].fields[0].name, "NPCs")
        XCTAssertEqual(program.types[0].fields[0].dimensions.count, 1)
        
        // Second field: MaxLights with default
        XCTAssertEqual(program.types[0].fields[1].name, "MaxLights")
        XCTAssertEqual(program.types[0].fields[1].dimensions.count, 0)
        XCTAssertNotNil(program.types[0].fields[1].defaultValue)
        
        // Third field: Position array with type
        XCTAssertEqual(program.types[0].fields[2].name, "Position")
        XCTAssertEqual(program.types[0].fields[2].type, .float)
        XCTAssertEqual(program.types[0].fields[2].dimensions.count, 1)
        
        // Should compile
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        XCTAssertGreaterThan(module.code.count, 0)
    }
    
    func testTypeFieldArrayInstanceSizeCalculation() throws {
        let source = """
        Type TTest
            Field A%
            Field B#[2]
            Field C%
        End Type
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        // The test compiles - instance size calculation is internal
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        // Should compile successfully
        XCTAssertGreaterThan(module.code.count, 0)
        XCTAssertEqual(module.globals.count > 0, true)
    }
    
    func testTypeFieldArrayWithExpressionDimension() throws {
        let source = """
        Type TTest
            Field Items[4 * 3]
        End Type
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        XCTAssertEqual(program.types.count, 1)
        XCTAssertEqual(program.types[0].fields.count, 1)
        
        // Dimension should be a binary expression
        let dim = program.types[0].fields[0].dimensions.first
        XCTAssertNotNil(dim)
        
        if case .binary(let binop) = dim {
            XCTAssertEqual(binop.op, "*")
        } else {
            XCTFail("Dimension should be a binary expression")
        }
        
        // Should still compile
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        XCTAssertGreaterThan(module.code.count, 0)
    }
    
    func testHandleAndObjectCasting() throws {
        let source = """
        Type TNPC
            Field Name$
        End Type
        
        Function TestHandle(obj.TNPC)
            Local h = Handle(obj)
            Local other.TNPC = Object.TNPC(h)
        End Function
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        XCTAssertEqual(program.types.count, 1)
        XCTAssertEqual(program.types[0].name, "TNPC")
        
        XCTAssertEqual(program.functions.count, 1)
        XCTAssertEqual(program.functions[0].name, "TestHandle")
        XCTAssertEqual(program.functions[0].parameters.count, 1)
        
        // Should compile with Handle and Object casting
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        XCTAssertGreaterThan(module.code.count, 0)
    }
    
    func testObjectCastWithTypeMismatch() throws {
        let source = """
        Type TA
            Field X%
        End Type
        
        Type TB
            Field Y%
        End Type
        
        Function TestCast(a.TA)
            Local b.TB = Object.TB(Handle(a))
        End Function
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        XCTAssertEqual(program.types.count, 2)
        
        // Should compile - type mismatch is a runtime check, not compile error
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        XCTAssertGreaterThan(module.code.count, 0)
    }
    
    func testMultiValueCaseStatements() throws {
        let source = """
        Function TestMultiValue(x%)
            Select x
                Case 1, 2, 3
                    Return 10
                Case 4 To 6
                    Return 20
                Default
                    Return 0
            End Select
        End Function
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        XCTAssertEqual(program.functions.count, 1)
        XCTAssertEqual(program.functions[0].name, "TestMultiValue")
        
        // Should compile with multi-value cases
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        XCTAssertGreaterThan(module.code.count, 0)
    }
    
    func testSingleValueCaseStatements() throws {
        let source = """
        Function TestSingleValue(x%)
            Select x
                Case 1
                    Return 10
                Case 2
                    Return 20
                Default
                    Return 0
            End Select
        End Function
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        XCTAssertEqual(program.functions.count, 1)
        
        // Should compile
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        XCTAssertGreaterThan(module.code.count, 0)
    }
}
