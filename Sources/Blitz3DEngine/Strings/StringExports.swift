//
//  StringExports.swift
//  Blitz3DEngine
//
//  WASM exports for Blitz3D String functions
//

import Foundation

// MARK: - String Inspection

@_cdecl("Len")
@MainActor
public func Len(_ stringID: Int32) -> Int32 {
    return StringManager.shared.length(stringID)
}

@_cdecl("Asc")
@MainActor
public func Asc(_ stringID: Int32) -> Int32 {
    return StringManager.shared.asc(stringID, position: 1)
}

// MARK: - Substring Operations

@_cdecl("Mid")
@MainActor
public func Mid(_ stringID: Int32, _ start: Int32, _ length: Int32) -> Int32 {
    return StringManager.shared.mid(stringID, start: start, length: length)
}

@_cdecl("Left")
@MainActor
public func Left(_ stringID: Int32, _ length: Int32) -> Int32 {
    return StringManager.shared.left(stringID, length: length)
}

@_cdecl("Right")
@MainActor
public func Right(_ stringID: Int32, _ length: Int32) -> Int32 {
    return StringManager.shared.right(stringID, length: length)
}

// MARK: - Case Conversion

@_cdecl("Upper")
@MainActor
public func Upper(_ stringID: Int32) -> Int32 {
    return StringManager.shared.upper(stringID)
}

@_cdecl("Lower")
@MainActor
public func Lower(_ stringID: Int32) -> Int32 {
    return StringManager.shared.lower(stringID)
}

// MARK: - Whitespace Operations

@_cdecl("Trim")
@MainActor
public func Trim(_ stringID: Int32) -> Int32 {
    return StringManager.shared.trim(stringID)
}

@_cdecl("LTrim")
@MainActor
public func LTrim(_ stringID: Int32) -> Int32 {
    return StringManager.shared.lTrim(stringID)
}

@_cdecl("RTrim")
@MainActor
public func RTrim(_ stringID: Int32) -> Int32 {
    return StringManager.shared.rTrim(stringID)
}

// MARK: - Search and Replace

@_cdecl("Instr")
@MainActor
public func Instr(_ haystackID: Int32, _ needleID: Int32, _ start: Int32) -> Int32 {
    return StringManager.shared.instr(haystackID, needleID, start: start)
}

@_cdecl("Replace")
@MainActor
public func Replace(_ stringID: Int32, _ findID: Int32, _ replaceID: Int32) -> Int32 {
    return StringManager.shared.replace(stringID, findID, replaceID)
}

// MARK: - Character Operations

@_cdecl("Chr")
@MainActor
public func Chr(_ code: Int32) -> Int32 {
    return StringManager.shared.chr(code)
}

// MARK: - String Generation

@_cdecl("StringRepeat")
@MainActor
public func StringRepeat(_ stringID: Int32, _ count: Int32) -> Int32 {
    return StringManager.shared.stringRepeat(stringID, count: count)
}

// MARK: - Number Formatting

@_cdecl("Hex")
@MainActor
public func Hex(_ value: Int32) -> Int32 {
    return StringManager.shared.hex(value)
}

@_cdecl("Bin")
@MainActor
public func Bin(_ value: Int32) -> Int32 {
    return StringManager.shared.bin(value)
}

// MARK: - Justification

@_cdecl("LSet")
@MainActor
public func LSet(_ stringID: Int32, _ width: Int32) -> Int32 {
    return StringManager.shared.lSet(stringID, width: width)
}

@_cdecl("RSet")
@MainActor
public func RSet(_ stringID: Int32, _ width: Int32) -> Int32 {
    return StringManager.shared.rSet(stringID, width: width)
}

// MARK: - Concatenation

@_cdecl("StringConcat")
@MainActor
public func StringConcat(_ id1: Int32, _ id2: Int32) -> Int32 {
    return StringManager.shared.concat(id1, id2)
}

// MARK: - String Storage Management

@_cdecl("StoreString")
@MainActor
public func StoreString(_ cString: UnsafePointer<CChar>) -> Int32 {
    let string = String(cString: cString)
    return StringManager.shared.storeString(string)
}

@_cdecl("GetStringPtr")
@MainActor
public func GetStringPtr(_ stringID: Int32) -> UnsafePointer<CChar>? {
    guard let string = StringManager.shared.getString(stringID) else { return nil }
    #if arch(wasm32)
    // For WASM, use withCString (caller must copy if needed to persist)
    return string.withCString { $0 }
    #else
    // For native builds with Objective-C runtime
    return (string as NSString).utf8String
    #endif
}

@_cdecl("FreeString")
@MainActor
public func FreeString(_ stringID: Int32) {
    StringManager.shared.freeString(stringID)
}

// MARK: - Additional String Functions

@_cdecl("CurrentDate")
@MainActor
public func CurrentDate() -> Int32 {
    let formatter = DateFormatter()
    formatter.dateFormat = "dd MMM yyyy"
    let dateString = formatter.string(from: Date())
    return StringManager.shared.storeString(dateString)
}

@_cdecl("CurrentTime")
@MainActor
public func CurrentTime() -> Int32 {
    let formatter = DateFormatter()
    formatter.dateFormat = "HH:mm:ss"
    let timeString = formatter.string(from: Date())
    return StringManager.shared.storeString(timeString)
}
