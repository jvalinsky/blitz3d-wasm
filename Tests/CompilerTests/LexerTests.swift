//
//  LexerTests.swift
//  CompilerTests
//

import XCTest
@testable import Blitz3DCompiler

final class LexerTests: XCTestCase {
    
    func testBasicTokens() throws {
        var lexer = Lexer(source: "Local x = 42", sourceFile: "test.bb")
        let tokens = lexer.tokenize()
        
        // Should have: Local, x, =, 42, EOF
        XCTAssertGreaterThanOrEqual(tokens.count, 4)
        XCTAssertEqual(tokens[0].type, .keywordLocal)
        XCTAssertEqual(tokens[1].type, .identifier)
        XCTAssertEqual(tokens[2].type, .equals)
        XCTAssertEqual(tokens[3].type, .integerLiteral)
    }
    
    func testKeywords() throws {
        var lexer = Lexer(source: "Function Test()", sourceFile: "test.bb")
        let tokens = lexer.tokenize()
        
        XCTAssertEqual(tokens[0].type, .keywordFunction)
        XCTAssertEqual(tokens[1].type, .identifier)
        XCTAssertEqual(tokens[2].type, .leftParen)
        XCTAssertEqual(tokens[3].type, .rightParen)
    }
    
    func testStringLiteral() throws {
        var lexer = Lexer(source: "x = \"hello\"", sourceFile: "test.bb")
        let tokens = lexer.tokenize()
        
        // Find the string literal token
        let stringToken = tokens.first { $0.type == .stringLiteral }
        XCTAssertNotNil(stringToken)
        XCTAssertEqual(stringToken?.text, "hello")
    }
    
    func testFloatLiteral() throws {
        var lexer = Lexer(source: "x = 3.14", sourceFile: "test.bb")
        let tokens = lexer.tokenize()
        
        let floatToken = tokens.first { $0.type == .floatLiteral }
        XCTAssertNotNil(floatToken)
        XCTAssertEqual(floatToken?.text, "3.14")
    }
    
    func testIntegerLiteral() throws {
        var lexer = Lexer(source: "x = 42", sourceFile: "test.bb")
        let tokens = lexer.tokenize()
        
        let intToken = tokens.first { $0.type == .integerLiteral }
        XCTAssertNotNil(intToken)
        XCTAssertEqual(intToken?.text, "42")
    }
    
    func testOperators() throws {
        var lexer = Lexer(source: "a <> b <= c", sourceFile: "test.bb")
        let tokens = lexer.tokenize()
        
        XCTAssertEqual(tokens[0].type, .identifier)  // a
        XCTAssertEqual(tokens[1].type, .notEquals)  // <>
        XCTAssertEqual(tokens[2].type, .identifier)  // b
        XCTAssertEqual(tokens[3].type, .lessThanOrEqual)  // <=
    }
    
    func testEndOfFile() throws {
        var lexer = Lexer(source: "x = 1", sourceFile: "test.bb")
        let tokens = lexer.tokenize()
        
        let lastToken = tokens.last!
        XCTAssertEqual(lastToken.type, .endOfFile)
    }
    
    func testSCPCBKeywords() throws {
        let source = """
        If x = 1 Then
            While y < 10
                For i = 1 To 10 Step 2
                    Return
                Next
            Wend
        EndIf
        """
        var lexer = Lexer(source: source, sourceFile: "test.bb")
        let tokens = lexer.tokenize()
        
        // Verify key keywords are recognized
        let ifToken = tokens.first { $0.type == .keywordIf }
        XCTAssertNotNil(ifToken)
        
        let thenToken = tokens.first { $0.type == .keywordThen }
        XCTAssertNotNil(thenToken)
        
        let whileToken = tokens.first { $0.type == .keywordWhile }
        XCTAssertNotNil(whileToken)
        
        let forToken = tokens.first { $0.type == .keywordFor }
        XCTAssertNotNil(forToken)
        
        let returnToken = tokens.first { $0.type == .keywordReturn }
        XCTAssertNotNil(returnToken)
    }
    
    func testColonSeparator() throws {
        var lexer = Lexer(source: "x = 1 : y = 2", sourceFile: "test.bb")
        let tokens = lexer.tokenize()
        
        let colonToken = tokens.first { $0.type == .colon }
        XCTAssertNotNil(colonToken)
    }

    func testEqualsSemicolonLine_IsComment() throws {
        // SCPCB/IDE metadata lines sometimes start with "=;".
        let source = """
        =; ID: 123
        Function Main()
            Return
        End Function
        """
        var lexer = Lexer(source: source, sourceFile: "test.bb")
        let tokens = lexer.tokenize()

        let firstNonNewline = tokens.first(where: { $0.type != .newline })
        XCTAssertEqual(firstNonNewline?.type, .keywordFunction, "Lexer should skip '=;' lines")
    }
    
    func testFieldAccess() throws {
        var lexer = Lexer(source: "obj\\xfield", sourceFile: "test.bb")
        let tokens = lexer.tokenize()
        
        XCTAssertEqual(tokens[0].type, .identifier)  // obj
        XCTAssertEqual(tokens[1].type, .backslash)  // \
        XCTAssertEqual(tokens[2].type, .identifier)  // xfield
    }
}
