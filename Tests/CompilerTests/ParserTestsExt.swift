import XCTest

@testable import Blitz3DCompiler

final class ParserTestsExt: XCTestCase {

    func testParseFunctionCallWithWhitespace() throws {
        // Case 1: Text (x) - Parentheses wrap single argument
        // Should parse as CallNode("Text", [Identifier("x")])
        var parser1 = Parser(source: "Text (x)")
        let program1 = parser1.parse()
        XCTAssertEqual(program1.statements.count, 1)
        if case .functionCall(let call, _) = program1.statements[0] {
            XCTAssertEqual(call.name, "Text")
            XCTAssertEqual(call.arguments.count, 1)
            if case .identifier(let id, _) = call.arguments[0] {
                XCTAssertEqual(id.name, "x")
            } else {
                XCTFail("Expected identifier argument, got \(call.arguments[0])")
            }
        } else {
            XCTFail("Expected function call")
        }

        // Case 2: Text (x), y - Parentheses wrap first argument only
        // Should parse as CallNode("Text", [Identifier("x"), Identifier("y")])
        // This relies on lookahead seeing the comma after (x)
        var parser2 = Parser(source: "Text (x), y")
        let program2 = parser2.parse()
        XCTAssertEqual(program2.statements.count, 1)
        if case .functionCall(let call, _) = program2.statements[0] {
            XCTAssertEqual(call.name, "Text")
            XCTAssertEqual(call.arguments.count, 2)
            if case .identifier(let id, _) = call.arguments[0] {
                XCTAssertEqual(id.name, "x")
            }
            if case .identifier(let id, _) = call.arguments[1] {
                XCTAssertEqual(id.name, "y")
            }
        }

        // Case 3: Text (x, y) - Parentheses wrap all arguments (comma inside)
        // Should parse as CallNode("Text", [Identifier("x"), Identifier("y")])
        // This relies on lookahead seeing the EOF/Terminator after )
        var parser3 = Parser(source: "Text (x, y)")
        let program3 = parser3.parse()
        XCTAssertEqual(program3.statements.count, 1)
        if case .functionCall(let call, _) = program3.statements[0] {
            XCTAssertEqual(call.name, "Text")
            XCTAssertEqual(call.arguments.count, 2)
        }

        // Case 4: Expression context - a = GraphicsWidth ()
        // Should parse as Assignment(a, Call("GraphicsWidth", []))
        var parser4 = Parser(source: "a = GraphicsWidth ()")
        let program4 = parser4.parse()
        XCTAssertEqual(program4.statements.count, 1)
        if case .assignment(let assign, _) = program4.statements[0] {
            if case .functionCall(let call, _) = assign.value {
                XCTAssertEqual(call.name, "GraphicsWidth")
                XCTAssertEqual(call.arguments.count, 0)
            } else {
                XCTFail("Expected function call in assignment")
            }
        }

        // Case 5: Text (x) + y
        // Should parse as Call("Text", [Binary(x + y)])
        // Because lookahead sees + which is not a terminator, so it treats (x) as expression start
        var parser5 = Parser(source: "Text (x) + y")
        let program5 = parser5.parse()
        XCTAssertEqual(program5.statements.count, 1)
        if case .functionCall(let call, _) = program5.statements[0] {
            XCTAssertEqual(call.arguments.count, 1)
            // Argument should be binary op
            if case .binary(let bin, _) = call.arguments[0] {
                XCTAssertEqual(bin.op, "+")
            } else {
                XCTFail("Expected binary expression as argument")
            }
        }
    }
}
