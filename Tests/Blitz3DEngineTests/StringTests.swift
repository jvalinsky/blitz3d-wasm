//
//  StringTests.swift
//  Blitz3DEngineTests
//
//  Unit tests for String functions
//

import Testing
@testable import Blitz3DEngine

@Test @MainActor func len() {
    let id = StringManager.shared.storeString("Hello")
    #expect(Len(id) == 5)

    let emptyID = StringManager.shared.storeString("")
    #expect(Len(emptyID) == 0)

    let longID = StringManager.shared.storeString("Hello, World!")
    #expect(Len(longID) == 13)
}

@Test @MainActor func mid() {
    let id = StringManager.shared.storeString("Hello, World!")

    let result1 = Mid(id, 1, 5)
    #expect(StringManager.shared.getString(result1) == "Hello")

    let result2 = Mid(id, 8, 5)
    #expect(StringManager.shared.getString(result2) == "World")

    let result3 = Mid(id, 1, 20)
    #expect(StringManager.shared.getString(result3) == "Hello, World!")
}

@Test @MainActor func left() {
    let id = StringManager.shared.storeString("Hello, World!")

    let result1 = Left(id, 5)
    #expect(StringManager.shared.getString(result1) == "Hello")

    let result2 = Left(id, 0)
    #expect(StringManager.shared.getString(result2) == "")

    let result3 = Left(id, 20)
    #expect(StringManager.shared.getString(result3) == "Hello, World!")
}

@Test @MainActor func right() {
    let id = StringManager.shared.storeString("Hello, World!")

    let result1 = Right(id, 6)
    #expect(StringManager.shared.getString(result1) == "World!")

    let result2 = Right(id, 0)
    #expect(StringManager.shared.getString(result2) == "")

    let result3 = Right(id, 20)
    #expect(StringManager.shared.getString(result3) == "Hello, World!")
}

@Test @MainActor func upper() {
    let id1 = StringManager.shared.storeString("hello")
    let result1 = Upper(id1)
    #expect(StringManager.shared.getString(result1) == "HELLO")

    let id2 = StringManager.shared.storeString("Hello, World!")
    let result2 = Upper(id2)
    #expect(StringManager.shared.getString(result2) == "HELLO, WORLD!")
}

@Test @MainActor func lower() {
    let id1 = StringManager.shared.storeString("HELLO")
    let result1 = Lower(id1)
    #expect(StringManager.shared.getString(result1) == "hello")

    let id2 = StringManager.shared.storeString("Hello, World!")
    let result2 = Lower(id2)
    #expect(StringManager.shared.getString(result2) == "hello, world!")
}

@Test @MainActor func trim() {
    let id1 = StringManager.shared.storeString("  hello  ")
    let result1 = Trim(id1)
    #expect(StringManager.shared.getString(result1) == "hello")

    let id2 = StringManager.shared.storeString("hello")
    let result2 = Trim(id2)
    #expect(StringManager.shared.getString(result2) == "hello")
}

@Test @MainActor func lTrim() {
    let id = StringManager.shared.storeString("  hello  ")
    let result = LTrim(id)
    #expect(StringManager.shared.getString(result) == "hello  ")
}

@Test @MainActor func rTrim() {
    let id = StringManager.shared.storeString("  hello  ")
    let result = RTrim(id)
    #expect(StringManager.shared.getString(result) == "  hello")
}

@Test @MainActor func instr() {
    let haystackID = StringManager.shared.storeString("Hello, World!")
    let needleID1 = StringManager.shared.storeString("World")
    let needleID2 = StringManager.shared.storeString("xyz")
    let needleID3 = StringManager.shared.storeString("o")

    #expect(Instr(haystackID, needleID1, 1) == 8)
    #expect(Instr(haystackID, needleID2, 1) == 0)
    #expect(Instr(haystackID, needleID3, 1) == 5)
    #expect(Instr(haystackID, needleID3, 6) == 9)
}

@Test @MainActor func replace() {
    let stringID = StringManager.shared.storeString("Hello, World!")
    let findID = StringManager.shared.storeString("World")
    let replaceID = StringManager.shared.storeString("Swift")

    let result = Replace(stringID, findID, replaceID)
    #expect(StringManager.shared.getString(result) == "Hello, Swift!")

    let string2ID = StringManager.shared.storeString("foo bar foo baz foo")
    let find2ID = StringManager.shared.storeString("foo")
    let replace2ID = StringManager.shared.storeString("qux")

    let result2 = Replace(string2ID, find2ID, replace2ID)
    #expect(StringManager.shared.getString(result2) == "qux bar qux baz qux")
}

@Test @MainActor func asc() {
    let id = StringManager.shared.storeString("ABC")
    #expect(Asc(id) == 65)

    let id2 = StringManager.shared.storeString("Hello")
    #expect(Asc(id2) == 72)
}

@Test @MainActor func chr() {
    let result1 = Chr(65)
    #expect(StringManager.shared.getString(result1) == "A")

    let result2 = Chr(72)
    #expect(StringManager.shared.getString(result2) == "H")

    let result3 = Chr(32)
    #expect(StringManager.shared.getString(result3) == " ")
}

@Test @MainActor func stringRepeat() {
    let id = StringManager.shared.storeString("ab")

    let result1 = StringRepeat(id, 3)
    #expect(StringManager.shared.getString(result1) == "ababab")

    let result2 = StringRepeat(id, 0)
    #expect(StringManager.shared.getString(result2) == "")

    let result3 = StringRepeat(id, 1)
    #expect(StringManager.shared.getString(result3) == "ab")
}

@Test @MainActor func hex() {
    let result1 = Hex(255)
    #expect(StringManager.shared.getString(result1) == "FF")

    let result2 = Hex(16)
    #expect(StringManager.shared.getString(result2) == "10")

    let result3 = Hex(0)
    #expect(StringManager.shared.getString(result3) == "0")
}

@Test @MainActor func bin() {
    let result1 = Bin(5)
    #expect(StringManager.shared.getString(result1) == "101")

    let result2 = Bin(8)
    #expect(StringManager.shared.getString(result2) == "1000")

    let result3 = Bin(0)
    #expect(StringManager.shared.getString(result3) == "0")
}

@Test @MainActor func lSet() {
    let id = StringManager.shared.storeString("Hi")

    let result1 = LSet(id, 5)
    #expect(StringManager.shared.getString(result1) == "Hi   ")

    let result2 = LSet(id, 2)
    #expect(StringManager.shared.getString(result2) == "Hi")

    let result3 = LSet(id, 1)
    #expect(StringManager.shared.getString(result3) == "H")
}

@Test @MainActor func rSet() {
    let id = StringManager.shared.storeString("Hi")

    let result1 = RSet(id, 5)
    #expect(StringManager.shared.getString(result1) == "   Hi")

    let result2 = RSet(id, 2)
    #expect(StringManager.shared.getString(result2) == "Hi")

    let result3 = RSet(id, 1)
    #expect(StringManager.shared.getString(result3) == "i")
}

@Test @MainActor func stringConcat() {
    let id1 = StringManager.shared.storeString("Hello, ")
    let id2 = StringManager.shared.storeString("World!")

    let result = StringConcat(id1, id2)
    #expect(StringManager.shared.getString(result) == "Hello, World!")

    let emptyID = StringManager.shared.storeString("")
    let result2 = StringConcat(id1, emptyID)
    #expect(StringManager.shared.getString(result2) == "Hello, ")
}
