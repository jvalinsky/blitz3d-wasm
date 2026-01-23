//
//  ParserTests.swift
//  CompilerTests
//

import XCTest
@testable import Blitz3DCompiler

final class ParserTests: XCTestCase {
    
    func testParseIntegerLiteral() throws {
        var parser = Parser(source: "Const x = 42")
        let program = parser.parse()
        
        XCTAssertEqual(program.statements.count, 1)
        if case .constant(let (decl, _)) = program.statements[0] {
            if case .integerLiteral(let (value, _)) = decl.value {
                XCTAssertEqual(value, 42)
            } else {
                XCTFail("Expected integer literal")
            }
        } else {
            XCTFail("Expected constant declaration")
        }
    }
    
    func testParseFloatLiteral() throws {
        var parser = Parser(source: "Const x = 3.14")
        let program = parser.parse()
        
        XCTAssertEqual(program.statements.count, 1)
        if case .constant(let (decl, _)) = program.statements[0] {
            if case .floatLiteral(let (value, _)) = decl.value {
                XCTAssertEqual(value, 3.14, accuracy: 0.01)
            } else {
                XCTFail("Expected float literal")
            }
        } else {
            XCTFail("Expected constant declaration")
        }
    }
    
    func testParseStringLiteral() throws {
        var parser = Parser(source: "Const x = \"hello\"")
        let program = parser.parse()
        
        XCTAssertEqual(program.statements.count, 1)
        if case .constant(let (decl, _)) = program.statements[0] {
            if case .stringLiteral(let (value, _)) = decl.value {
                XCTAssertEqual(value, "hello")
            } else {
                XCTFail("Expected string literal")
            }
        } else {
            XCTFail("Expected constant declaration")
        }
    }
    
    func testParseIdentifier() throws {
        var parser = Parser(source: "Const x = myVar")
        let program = parser.parse()
        
        XCTAssertEqual(program.statements.count, 1)
        if case .constant(let (decl, _)) = program.statements[0] {
            if case .identifier(let (id, _)) = decl.value {
                XCTAssertEqual(id.name, "myVar")
            } else {
                XCTFail("Expected identifier")
            }
        } else {
            XCTFail("Expected constant declaration")
        }
    }
    
    func testParseBinaryExpression() throws {
        var parser = Parser(source: "Const x = 1 + 2")
        let program = parser.parse()
        
        XCTAssertEqual(program.statements.count, 1)
        if case .constant(let (decl, _)) = program.statements[0] {
            if case .binary(let (binop, _)) = decl.value {
                XCTAssertEqual(binop.op, "+")
            } else {
                XCTFail("Expected binary expression")
            }
        } else {
            XCTFail("Expected constant declaration")
        }
    }
    
    func testParseAssignment() throws {
        var parser = Parser(source: "x = 42")
        let program = parser.parse()
        
        XCTAssertEqual(program.statements.count, 1)
        if case .assignment(let (assign, _)) = program.statements[0] {
            if case .identifier(let (id, _)) = assign.target {
                XCTAssertEqual(id.name, "x")
            } else {
                XCTFail("Expected identifier target")
            }
        } else {
            XCTFail("Expected assignment")
        }
    }
    
    func testParseLocalDeclaration() throws {
        var parser = Parser(source: "Local x, y")
        let program = parser.parse()
        
        XCTAssertEqual(program.statements.count, 1)
        if case .local(let (decl, _)) = program.statements[0] {
            XCTAssertEqual(decl.variables.count, 2)
            XCTAssertEqual(decl.variables[0].name, "x")
            XCTAssertEqual(decl.variables[1].name, "y")
        } else {
            XCTFail("Expected local declaration")
        }
    }
    
    func testParseGlobalDeclaration() throws {
        var parser = Parser(source: "Global count%")
        let program = parser.parse()
        
        XCTAssertEqual(program.statements.count, 1)
        if case .global(let (decl, _)) = program.statements[0] {
            XCTAssertEqual(decl.variables.count, 1)
            XCTAssertEqual(decl.variables[0].name, "count")
            XCTAssertEqual(decl.variables[0].typeSuffix, .integer)
        } else {
            XCTFail("Expected global declaration")
        }
    }
    
    func testParseConstant() throws {
        var parser = Parser(source: "Const MAX = 100")
        let program = parser.parse()
        
        XCTAssertEqual(program.statements.count, 1)
        if case .constant(let (decl, _)) = program.statements[0] {
            XCTAssertEqual(decl.name, "MAX")
        } else {
            XCTFail("Expected constant declaration")
        }
    }
    
    func testParseIfStatement() throws {
        var parser = Parser(source: "If x = 1 Then x = 2 EndIf")
        let program = parser.parse()
        
        XCTAssertEqual(program.statements.count, 1)
        if case .ifStatement(let (ifNode, _)) = program.statements[0] {
            if case .binary(let (cond, _)) = ifNode.condition {
                XCTAssertEqual(cond.op, "=")
            } else {
                XCTFail("Expected binary condition")
            }
            XCTAssertEqual(ifNode.thenBranch.count, 1)
        } else {
            XCTFail("Expected if statement")
        }
    }
    
    func testParseWhileLoop() throws {
        var parser = Parser(source: "While x < 10 Wend")
        let program = parser.parse()
        
        XCTAssertEqual(program.statements.count, 1)
        if case .whileLoop(let (whileNode, _)) = program.statements[0] {
            XCTAssertEqual(whileNode.body.count, 0)
        } else {
            XCTFail("Expected while loop")
        }
    }
    
    func testParseForLoop() throws {
        var parser = Parser(source: "For i = 1 To 10 Next")
        let program = parser.parse()
        
        XCTAssertEqual(program.statements.count, 1)
        if case .forLoop(let (forNode, _)) = program.statements[0] {
            XCTAssertEqual(forNode.variable.name, "i")
            XCTAssertNil(forNode.stepValue)
        } else {
            XCTFail("Expected for loop")
        }
    }
    
    func testParseForLoopWithStep() throws {
        var parser = Parser(source: "For i = 1 To 10 Step 2 Next")
        let program = parser.parse()
        
        XCTAssertEqual(program.statements.count, 1)
        if case .forLoop(let (forNode, _)) = program.statements[0] {
            XCTAssertNotNil(forNode.stepValue)
        } else {
            XCTFail("Expected for loop")
        }
    }
    
    func testParseRepeatUntil() throws {
        var parser = Parser(source: "Repeat Until x = 0")
        let program = parser.parse()
        
        XCTAssertEqual(program.statements.count, 1)
        if case .repeatLoop(let (repeatNode, _)) = program.statements[0] {
            XCTAssertEqual(repeatNode.body.count, 0)
        } else {
            XCTFail("Expected repeat loop")
        }
    }
    
    func testParseFunction() throws {
        var parser = Parser(source: "Function Test(x) End Function")
        let program = parser.parse()
        
        XCTAssertEqual(program.functions.count, 1)
        XCTAssertEqual(program.functions[0].name, "Test")
        XCTAssertEqual(program.functions[0].parameters.count, 1)
        XCTAssertEqual(program.functions[0].parameters[0].name, "x")
    }
    
    func testParseFunctionWithBody() throws {
        var parser = Parser(source: "Function Add(x, y) Return x + y End Function")
        let program = parser.parse()
        
        XCTAssertEqual(program.functions.count, 1)
        XCTAssertEqual(program.functions[0].body.count, 1)
        if case .returnStatement(let (expr, _)) = program.functions[0].body[0] {
            XCTAssertNotNil(expr)
        } else {
            XCTFail("Expected return statement")
        }
    }
    
    func testParseTypeDeclaration() throws {
        var parser = Parser(source: "Type TField End Type")
        let program = parser.parse()
        
        XCTAssertEqual(program.types.count, 1)
        XCTAssertEqual(program.types[0].name, "TField")
    }
    
    func testParseFieldAccess() throws {
        var parser = Parser(source: "Const x = obj\\field")
        let program = parser.parse()
        
        XCTAssertEqual(program.statements.count, 1)
        if case .constant(let (decl, _)) = program.statements[0] {
            if case .fieldAccess(let (access, _)) = decl.value {
                XCTAssertEqual(access.field, "field")
            } else {
                XCTFail("Expected field access")
            }
        } else {
            XCTFail("Expected constant declaration")
        }
    }
    
    func testParseFunctionCall() throws {
        var parser = Parser(source: "Print(\"hello\")")
        let program = parser.parse()
        
        XCTAssertEqual(program.statements.count, 1)
        if case .functionCall(let (call, _)) = program.statements[0] {
            XCTAssertEqual(call.name, "Print")
            XCTAssertEqual(call.arguments.count, 1)
        } else {
            XCTFail("Expected function call")
        }
    }
    
    func testParseArrayAccess() throws {
        var parser = Parser(source: "Const x = arr[0]")
        let program = parser.parse()
        
        XCTAssertEqual(program.statements.count, 1)
        if case .constant(let (decl, _)) = program.statements[0] {
            if case .arrayAccess(let (access, _)) = decl.value {
                XCTAssertEqual(access.indices.count, 1)
            } else {
                XCTFail("Expected array access")
            }
        } else {
            XCTFail("Expected constant declaration")
        }
    }
    
    func testParseReturnStatement() throws {
        var parser = Parser(source: "Function Test() Return 42 End Function")
        let program = parser.parse()
        
        XCTAssertEqual(program.functions.count, 1)
        if case .returnStatement(let (expr, _)) = program.functions[0].body[0] {
            if case .integerLiteral(let (value, _)) = expr {
                XCTAssertEqual(value, 42)
            } else {
                XCTFail("Expected integer literal")
            }
        } else {
            XCTFail("Expected return statement")
        }
    }
    
    func testParseReturnWithoutValue() throws {
        var parser = Parser(source: "Function Test() Return End Function")
        let program = parser.parse()
        
        XCTAssertEqual(program.functions.count, 1)
        if case .returnStatement(let (expr, _)) = program.functions[0].body[0] {
            XCTAssertNil(expr)
        } else {
            XCTFail("Expected return statement")
        }
    }
    
    func testParseExitStatement() throws {
        var parser = Parser(source: "Exit")
        let program = parser.parse()
        
        XCTAssertEqual(program.statements.count, 1)
        if case .exit = program.statements[0] {
            // Success
        } else {
            XCTFail("Expected exit statement")
        }
    }
    
    func testParseComplexExpression() throws {
        var parser = Parser(source: "Const x = a + b * c - d / e")
        let program = parser.parse()
        
        XCTAssertEqual(program.statements.count, 1)
        if case .constant(let (decl, _)) = program.statements[0] {
            if case .binary(let (binop, _)) = decl.value {
                XCTAssertEqual(binop.op, "-")
            } else {
                XCTFail("Expected binary expression")
            }
        } else {
            XCTFail("Expected constant declaration")
        }
    }
    
    func testParseComparison() throws {
        var parser = Parser(source: "Const x = x >= y And z <> w")
        let program = parser.parse()
        
        XCTAssertEqual(program.statements.count, 1)
        if case .constant(let (decl, _)) = program.statements[0] {
            if case .binary(let (outer, _)) = decl.value {
                XCTAssertEqual(outer.op, "And")
            } else {
                XCTFail("Expected binary And expression")
            }
        } else {
            XCTFail("Expected constant declaration")
        }
    }
    
    func testParseMultipleStatements() throws {
        var parser = Parser(source: "x = 1 : y = 2 : z = 3")
        let program = parser.parse()
        
        XCTAssertEqual(program.statements.count, 3)
    }
    
    func testParseNotExpression() throws {
        var parser = Parser(source: "Const x = Not x")
        let program = parser.parse()
        
        XCTAssertEqual(program.statements.count, 1)
        if case .constant(let (decl, _)) = program.statements[0] {
            if case .unary(let (unary, _)) = decl.value {
                XCTAssertEqual(unary.op, "Not")
            } else {
                XCTFail("Expected unary expression")
            }
        } else {
            XCTFail("Expected constant declaration")
        }
    }
    
    func testParseTypeSuffixes() throws {
        var parser = Parser(source: "Const x = x% + y# + z$")
        let program = parser.parse()
        
        XCTAssertEqual(program.statements.count, 1)
    }
    
    func testParseGoto() throws {
        var parser = Parser(source: "Goto label")
        let program = parser.parse()
        
        XCTAssertEqual(program.statements.count, 1)
        if case .goto(let (label, _)) = program.statements[0] {
            XCTAssertEqual(label, "label")
        } else {
            XCTFail("Expected goto statement")
        }
    }
    
    func testParseGosub() throws {
        var parser = Parser(source: "Gosub subroutine")
        let program = parser.parse()
        
        XCTAssertEqual(program.statements.count, 1)
        if case .gosub(let (label, _)) = program.statements[0] {
            XCTAssertEqual(label, "subroutine")
        } else {
            XCTFail("Expected gosub statement")
        }
    }
}
