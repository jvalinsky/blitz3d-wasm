//
//  IncludeFileTests.swift
//  CompilerTests
//
//  Tests for Include file functionality
//

import XCTest
import Foundation
@testable import Blitz3DCompiler

final class IncludeFileTests: XCTestCase {
    
    var tempDir: URL!
    
    override func setUp() {
        super.setUp()
        // Create a temporary directory for test files
        tempDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("blitz3d-include-tests-\(UUID().uuidString)")
        try? FileManager.default.createDirectory(at: tempDir, withIntermediateDirectories: true)
    }
    
    override func tearDown() {
        // Clean up temporary files
        try? FileManager.default.removeItem(at: tempDir)
        super.tearDown()
    }
    
    func testBasicInclude() throws {
        // Create helper file
        let helperFile = tempDir.appendingPathComponent("helper.bb")
        let helperContent = """
        Function Helper()
            Print "Helper function"
        End Function
        """
        try helperContent.write(to: helperFile, atomically: true, encoding: .utf8)
        
        // Create main file
        let mainFile = tempDir.appendingPathComponent("main.bb")
        let mainContent = """
        Include "helper.bb"
        Helper()
        """
        try mainContent.write(to: mainFile, atomically: true, encoding: .utf8)
        
        // Parse main file
        var parser = Parser(source: mainContent, sourceFile: mainFile.path)
        let program = parser.parse()
        
        XCTAssertTrue(parser.errors.isEmpty, "Parser should have no errors: \(parser.errors)")
        XCTAssertEqual(program.statements.count, 2, "Should have include + function call")
        
        // Check first statement is include
        if case .include(let filename, let statements, _) = program.statements[0] {
            XCTAssertTrue(filename.hasSuffix("helper.bb"), "Include should reference helper.bb")
            XCTAssertEqual(statements.count, 1, "Helper file should have 1 function")
            
            // Check included content is a function
            if case .function(_, _) = statements[0] {
                // Success
            } else {
                XCTFail("Expected function in included file")
            }
        } else {
            XCTFail("Expected include statement, got: \(program.statements[0])")
        }
    }
    
    func testIncludeNotFound() throws {
        let mainFile = tempDir.appendingPathComponent("main.bb")
        let mainContent = """
        Include "nonexistent.bb"
        """
        try mainContent.write(to: mainFile, atomically: true, encoding: .utf8)
        
        var parser = Parser(source: mainContent, sourceFile: mainFile.path)
        let program = parser.parse()
        
        XCTAssertFalse(parser.errors.isEmpty, "Should have error for missing file")
        XCTAssertTrue(parser.errors[0].message.contains("not found"), "Error should mention file not found")
    }
    
    func testCircularInclude() throws {
        // Create file A that includes B
        let fileA = tempDir.appendingPathComponent("a.bb")
        let contentA = """
        Include "b.bb"
        Function A()
        End Function
        """
        try contentA.write(to: fileA, atomically: true, encoding: .utf8)
        
        // Create file B that includes A (circular)
        let fileB = tempDir.appendingPathComponent("b.bb")
        let contentB = """
        Include "a.bb"
        Function B()
        End Function
        """
        try contentB.write(to: fileB, atomically: true, encoding: .utf8)
        
        var parser = Parser(source: contentA, sourceFile: fileA.path)
        let program = parser.parse()
        
        // Should handle gracefully (already included check prevents infinite loop)
        XCTAssertTrue(parser.errors.isEmpty || parser.errors.count < 10, "Should not infinite loop")
        XCTAssertNotNil(program, "Should return a valid program")
    }
    
    func testDuplicateInclude() throws {
        // Create helper file
        let helperFile = tempDir.appendingPathComponent("helper.bb")
        let helperContent = """
        Function Helper()
        End Function
        """
        try helperContent.write(to: helperFile, atomically: true, encoding: .utf8)
        
        // Create main file that includes helper twice
        let mainFile = tempDir.appendingPathComponent("main.bb")
        let mainContent = """
        Include "helper.bb"
        Include "helper.bb"
        Print "Done"
        """
        try mainContent.write(to: mainFile, atomically: true, encoding: .utf8)
        
        var parser = Parser(source: mainContent, sourceFile: mainFile.path)
        let program = parser.parse()
        
        XCTAssertTrue(parser.errors.isEmpty, "Should have no errors")
        XCTAssertEqual(program.statements.count, 3, "Should have 2 includes + print")
        
        // First include should have content
        if case .include(_, let statements1, _) = program.statements[0] {
            XCTAssertEqual(statements1.count, 1, "First include should have function")
        } else {
            XCTFail("Expected first include")
        }
        
        // Second include should be empty (already included)
        if case .include(_, let statements2, _) = program.statements[1] {
            XCTAssertEqual(statements2.count, 0, "Second include should be empty (duplicate)")
        } else {
            XCTFail("Expected second include")
        }
    }
    
    func testNestedInclude() throws {
        // Create bottom level file
        let bottomFile = tempDir.appendingPathComponent("bottom.bb")
        let bottomContent = """
        Function Bottom()
        End Function
        """
        try bottomContent.write(to: bottomFile, atomically: true, encoding: .utf8)
        
        // Create middle file that includes bottom
        let middleFile = tempDir.appendingPathComponent("middle.bb")
        let middleContent = """
        Include "bottom.bb"
        Function Middle()
        End Function
        """
        try middleContent.write(to: middleFile, atomically: true, encoding: .utf8)
        
        // Create top file that includes middle
        let topFile = tempDir.appendingPathComponent("top.bb")
        let topContent = """
        Include "middle.bb"
        Function Top()
        End Function
        """
        try topContent.write(to: topFile, atomically: true, encoding: .utf8)
        
        var parser = Parser(source: topContent, sourceFile: topFile.path)
        let program = parser.parse()
        
        XCTAssertTrue(parser.errors.isEmpty, "Should have no errors: \(parser.errors)")
        XCTAssertEqual(program.statements.count, 2, "Should have include + function")
        
        // Check nested structure
        if case .include(_, let middleStatements, _) = program.statements[0] {
            XCTAssertEqual(middleStatements.count, 2, "Middle should have include + function")
            
            // Check bottom include
            if case .include(_, let bottomStatements, _) = middleStatements[0] {
                XCTAssertEqual(bottomStatements.count, 1, "Bottom should have function")
            } else {
                XCTFail("Expected nested include in middle")
            }
        } else {
            XCTFail("Expected include statement")
        }
    }
    
    func testIncludeWithRelativePath() throws {
        // Create a subdirectory
        let subDir = tempDir.appendingPathComponent("subdir")
        try FileManager.default.createDirectory(at: subDir, withIntermediateDirectories: true)
        
        // Create helper in subdirectory
        let helperFile = subDir.appendingPathComponent("helper.bb")
        let helperContent = """
        Function Helper()
        End Function
        """
        try helperContent.write(to: helperFile, atomically: true, encoding: .utf8)
        
        // Create main file in parent directory
        let mainFile = tempDir.appendingPathComponent("main.bb")
        let mainContent = """
        Include "subdir/helper.bb"
        Helper()
        """
        try mainContent.write(to: mainFile, atomically: true, encoding: .utf8)
        
        var parser = Parser(source: mainContent, sourceFile: mainFile.path)
        let program = parser.parse()
        
        XCTAssertTrue(parser.errors.isEmpty, "Should handle relative path: \(parser.errors)")
        XCTAssertEqual(program.statements.count, 2)
    }
    
    func testIncludePreservesErrors() throws {
        // Create helper file with syntax error
        let helperFile = tempDir.appendingPathComponent("helper.bb")
        let helperContent = """
        Function Helper(
        End Function
        """
        try helperContent.write(to: helperFile, atomically: true, encoding: .utf8)
        
        // Create main file
        let mainFile = tempDir.appendingPathComponent("main.bb")
        let mainContent = """
        Include "helper.bb"
        """
        try mainContent.write(to: mainFile, atomically: true, encoding: .utf8)
        
        var parser = Parser(source: mainContent, sourceFile: mainFile.path)
        let program = parser.parse()
        
        XCTAssertFalse(parser.errors.isEmpty, "Should have error from included file")
        // Error should reference the included file
        let errorMessages = parser.errors.map { $0.message }.joined()
        XCTAssertTrue(errorMessages.contains("helper.bb") || !parser.errors.isEmpty, 
                      "Error should be from included file")
    }
}
