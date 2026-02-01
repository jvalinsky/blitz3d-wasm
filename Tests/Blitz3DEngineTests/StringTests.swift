//
//  StringTests.swift
//  Blitz3DEngineTests
//
//  Unit tests for String functions
//

import XCTest
@testable import Blitz3DEngineWASM

final class StringTests: XCTestCase {
    
    @MainActor
    override func setUp() {
        super.setUp()
        // StringManager is a singleton, so tests share state
        // In production, you might want to add a reset method
    }
    
    // MARK: - String Length Tests
    
    @MainActor
    func testLen() {
        let id = StringManager.shared.storeString("Hello")
        XCTAssertEqual(Len(id), 5)
        
        let emptyID = StringManager.shared.storeString("")
        XCTAssertEqual(Len(emptyID), 0)
        
        let longID = StringManager.shared.storeString("Hello, World!")
        XCTAssertEqual(Len(longID), 13)
    }
    
    // MARK: - Substring Tests
    
    @MainActor
    func testMid() {
        let id = StringManager.shared.storeString("Hello, World!")
        
        let result1 = Mid(id, 1, 5)
        XCTAssertEqual(StringManager.shared.getString(result1), "Hello")
        
        let result2 = Mid(id, 8, 5)
        XCTAssertEqual(StringManager.shared.getString(result2), "World")
        
        let result3 = Mid(id, 1, 20)  // Beyond end
        XCTAssertEqual(StringManager.shared.getString(result3), "Hello, World!")
    }
    
    @MainActor
    func testLeft() {
        let id = StringManager.shared.storeString("Hello, World!")
        
        let result1 = Left(id, 5)
        XCTAssertEqual(StringManager.shared.getString(result1), "Hello")
        
        let result2 = Left(id, 0)
        XCTAssertEqual(StringManager.shared.getString(result2), "")
        
        let result3 = Left(id, 20)  // Beyond end
        XCTAssertEqual(StringManager.shared.getString(result3), "Hello, World!")
    }
    
    @MainActor
    func testRight() {
        let id = StringManager.shared.storeString("Hello, World!")
        
        let result1 = Right(id, 6)
        XCTAssertEqual(StringManager.shared.getString(result1), "World!")
        
        let result2 = Right(id, 0)
        XCTAssertEqual(StringManager.shared.getString(result2), "")
        
        let result3 = Right(id, 20)  // Beyond end
        XCTAssertEqual(StringManager.shared.getString(result3), "Hello, World!")
    }
    
    // MARK: - Case Conversion Tests
    
    @MainActor
    func testUpper() {
        let id1 = StringManager.shared.storeString("hello")
        let result1 = Upper(id1)
        XCTAssertEqual(StringManager.shared.getString(result1), "HELLO")
        
        let id2 = StringManager.shared.storeString("Hello, World!")
        let result2 = Upper(id2)
        XCTAssertEqual(StringManager.shared.getString(result2), "HELLO, WORLD!")
    }
    
    @MainActor
    func testLower() {
        let id1 = StringManager.shared.storeString("HELLO")
        let result1 = Lower(id1)
        XCTAssertEqual(StringManager.shared.getString(result1), "hello")
        
        let id2 = StringManager.shared.storeString("Hello, World!")
        let result2 = Lower(id2)
        XCTAssertEqual(StringManager.shared.getString(result2), "hello, world!")
    }
    
    // MARK: - Whitespace Tests
    
    @MainActor
    func testTrim() {
        let id1 = StringManager.shared.storeString("  hello  ")
        let result1 = Trim(id1)
        XCTAssertEqual(StringManager.shared.getString(result1), "hello")
        
        let id2 = StringManager.shared.storeString("hello")
        let result2 = Trim(id2)
        XCTAssertEqual(StringManager.shared.getString(result2), "hello")
    }
    
    @MainActor
    func testLTrim() {
        let id = StringManager.shared.storeString("  hello  ")
        let result = LTrim(id)
        XCTAssertEqual(StringManager.shared.getString(result), "hello  ")
    }
    
    @MainActor
    func testRTrim() {
        let id = StringManager.shared.storeString("  hello  ")
        let result = RTrim(id)
        XCTAssertEqual(StringManager.shared.getString(result), "  hello")
    }
    
    // MARK: - Search Tests
    
    @MainActor
    func testInstr() {
        let haystackID = StringManager.shared.storeString("Hello, World!")
        let needleID1 = StringManager.shared.storeString("World")
        let needleID2 = StringManager.shared.storeString("xyz")
        let needleID3 = StringManager.shared.storeString("o")
        
        XCTAssertEqual(Instr(haystackID, needleID1, 1), 8)  // "World" at position 8
        XCTAssertEqual(Instr(haystackID, needleID2, 1), 0)  // "xyz" not found
        XCTAssertEqual(Instr(haystackID, needleID3, 1), 5)  // First "o" at position 5
        XCTAssertEqual(Instr(haystackID, needleID3, 6), 9)  // Second "o" at position 9
    }
    
    @MainActor
    func testReplace() {
        let stringID = StringManager.shared.storeString("Hello, World!")
        let findID = StringManager.shared.storeString("World")
        let replaceID = StringManager.shared.storeString("Swift")
        
        let result = Replace(stringID, findID, replaceID)
        XCTAssertEqual(StringManager.shared.getString(result), "Hello, Swift!")
        
        // Replace all occurrences
        let string2ID = StringManager.shared.storeString("foo bar foo baz foo")
        let find2ID = StringManager.shared.storeString("foo")
        let replace2ID = StringManager.shared.storeString("qux")
        
        let result2 = Replace(string2ID, find2ID, replace2ID)
        XCTAssertEqual(StringManager.shared.getString(result2), "qux bar qux baz qux")
    }
    
    // MARK: - Character Tests
    
    @MainActor
    func testAsc() {
        let id = StringManager.shared.storeString("ABC")
        
        XCTAssertEqual(Asc(id), 65)  // 'A'
        
        let id2 = StringManager.shared.storeString("Hello")
        XCTAssertEqual(Asc(id2), 72)  // 'H'
    }
    
    @MainActor
    func testChr() {
        let result1 = Chr(65)
        XCTAssertEqual(StringManager.shared.getString(result1), "A")
        
        let result2 = Chr(72)
        XCTAssertEqual(StringManager.shared.getString(result2), "H")
        
        let result3 = Chr(32)  // Space
        XCTAssertEqual(StringManager.shared.getString(result3), " ")
    }
    
    // MARK: - String Generation Tests
    
    @MainActor
    func testStringRepeat() {
        let id = StringManager.shared.storeString("ab")
        
        let result1 = StringRepeat(id, 3)
        XCTAssertEqual(StringManager.shared.getString(result1), "ababab")
        
        let result2 = StringRepeat(id, 0)
        XCTAssertEqual(StringManager.shared.getString(result2), "")
        
        let result3 = StringRepeat(id, 1)
        XCTAssertEqual(StringManager.shared.getString(result3), "ab")
    }
    
    // MARK: - Number Formatting Tests
    
    @MainActor
    func testHex() {
        let result1 = Hex(255)
        XCTAssertEqual(StringManager.shared.getString(result1), "FF")
        
        let result2 = Hex(16)
        XCTAssertEqual(StringManager.shared.getString(result2), "10")
        
        let result3 = Hex(0)
        XCTAssertEqual(StringManager.shared.getString(result3), "0")
    }
    
    @MainActor
    func testBin() {
        let result1 = Bin(5)
        XCTAssertEqual(StringManager.shared.getString(result1), "101")
        
        let result2 = Bin(8)
        XCTAssertEqual(StringManager.shared.getString(result2), "1000")
        
        let result3 = Bin(0)
        XCTAssertEqual(StringManager.shared.getString(result3), "0")
    }
    
    // MARK: - Justification Tests
    
    @MainActor
    func testLSet() {
        let id = StringManager.shared.storeString("Hi")
        
        let result1 = LSet(id, 5)
        XCTAssertEqual(StringManager.shared.getString(result1), "Hi   ")
        
        let result2 = LSet(id, 2)
        XCTAssertEqual(StringManager.shared.getString(result2), "Hi")
        
        let result3 = LSet(id, 1)
        XCTAssertEqual(StringManager.shared.getString(result3), "H")
    }
    
    @MainActor
    func testRSet() {
        let id = StringManager.shared.storeString("Hi")
        
        let result1 = RSet(id, 5)
        XCTAssertEqual(StringManager.shared.getString(result1), "   Hi")
        
        let result2 = RSet(id, 2)
        XCTAssertEqual(StringManager.shared.getString(result2), "Hi")
        
        let result3 = RSet(id, 1)
        XCTAssertEqual(StringManager.shared.getString(result3), "i")
    }
    
    // MARK: - Concatenation Tests
    
    @MainActor
    func testStringConcat() {
        let id1 = StringManager.shared.storeString("Hello, ")
        let id2 = StringManager.shared.storeString("World!")
        
        let result = StringConcat(id1, id2)
        XCTAssertEqual(StringManager.shared.getString(result), "Hello, World!")
        
        let emptyID = StringManager.shared.storeString("")
        let result2 = StringConcat(id1, emptyID)
        XCTAssertEqual(StringManager.shared.getString(result2), "Hello, ")
    }
}
