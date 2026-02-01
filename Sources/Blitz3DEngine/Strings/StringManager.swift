//
//  StringManager.swift
//  Blitz3DEngine
//
//  String management for Blitz3D compatibility
//

import Foundation

/// Manages string storage and operations for WASM interop
@MainActor
public class StringManager {
    public static let shared = StringManager()
    
    private var stringTable: [Int32: String] = [:]
    private var nextStringID: Int32 = 1
    
    private init() {}
    
    /// Store a string and return its ID
    public func storeString(_ string: String) -> Int32 {
        let id = nextStringID
        nextStringID += 1
        stringTable[id] = string
        return id
    }
    
    /// Get a string by ID
    public func getString(_ id: Int32) -> String? {
        return stringTable[id]
    }
    
    /// Free a string from the table
    public func freeString(_ id: Int32) {
        stringTable.removeValue(forKey: id)
    }
    
    /// Get string length
    public func length(_ id: Int32) -> Int32 {
        guard let string = stringTable[id] else { return 0 }
        return Int32(string.count)
    }
    
    /// Extract substring (Mid)
    public func mid(_ id: Int32, start: Int32, length: Int32) -> Int32 {
        guard let string = stringTable[id] else { return storeString("") }
        
        let startIndex = max(0, Int(start) - 1)  // Blitz3D is 1-indexed
        guard startIndex < string.count else { return storeString("") }
        
        let start = string.index(string.startIndex, offsetBy: startIndex)
        let endOffset = min(startIndex + Int(length), string.count)
        let end = string.index(string.startIndex, offsetBy: endOffset)
        
        let substring = String(string[start..<end])
        return storeString(substring)
    }
    
    /// Get leftmost characters
    public func left(_ id: Int32, length: Int32) -> Int32 {
        return mid(id, start: 1, length: length)
    }
    
    /// Get rightmost characters
    public func right(_ id: Int32, length: Int32) -> Int32 {
        guard let string = stringTable[id] else { return storeString("") }
        let len = Int32(string.count)
        let start = max(1, len - length + 1)
        return mid(id, start: start, length: length)
    }
    
    /// Convert to uppercase
    public func upper(_ id: Int32) -> Int32 {
        guard let string = stringTable[id] else { return storeString("") }
        return storeString(string.uppercased())
    }
    
    /// Convert to lowercase
    public func lower(_ id: Int32) -> Int32 {
        guard let string = stringTable[id] else { return storeString("") }
        return storeString(string.lowercased())
    }
    
    /// Trim whitespace from both ends
    public func trim(_ id: Int32) -> Int32 {
        guard let string = stringTable[id] else { return storeString("") }
        return storeString(string.trimmingCharacters(in: .whitespaces))
    }
    
    /// Trim whitespace from left
    public func lTrim(_ id: Int32) -> Int32 {
        guard let string = stringTable[id] else { return storeString("") }
        var result = string
        while result.first?.isWhitespace == true {
            result.removeFirst()
        }
        return storeString(result)
    }
    
    /// Trim whitespace from right
    public func rTrim(_ id: Int32) -> Int32 {
        guard let string = stringTable[id] else { return storeString("") }
        var result = string
        while result.last?.isWhitespace == true {
            result.removeLast()
        }
        return storeString(result)
    }
    
    /// Find substring position (1-indexed, 0 = not found)
    public func instr(_ haystackID: Int32, _ needleID: Int32, start: Int32 = 1) -> Int32 {
        guard let haystack = stringTable[haystackID],
              let needle = stringTable[needleID] else { return 0 }
        
        let startIndex = max(0, Int(start) - 1)
        guard startIndex < haystack.count else { return 0 }
        
        let searchStart = haystack.index(haystack.startIndex, offsetBy: startIndex)
        guard let range = haystack.range(of: needle, range: searchStart..<haystack.endIndex) else {
            return 0
        }
        
        let position = haystack.distance(from: haystack.startIndex, to: range.lowerBound)
        return Int32(position + 1)  // Blitz3D is 1-indexed
    }
    
    /// Replace all occurrences
    public func replace(_ stringID: Int32, _ findID: Int32, _ replaceID: Int32) -> Int32 {
        guard let string = stringTable[stringID],
              let find = stringTable[findID],
              let replace = stringTable[replaceID] else {
            return storeString("")
        }
        
        let result = string.replacingOccurrences(of: find, with: replace)
        return storeString(result)
    }
    
    /// Get character code at position (1-indexed)
    public func asc(_ id: Int32, position: Int32 = 1) -> Int32 {
        guard let string = stringTable[id] else { return 0 }
        
        let index = Int(position) - 1
        guard index >= 0 && index < string.count else { return 0 }
        
        let charIndex = string.index(string.startIndex, offsetBy: index)
        let char = string[charIndex]
        return Int32(char.unicodeScalars.first?.value ?? 0)
    }
    
    /// Create string from character code
    public func chr(_ code: Int32) -> Int32 {
        guard let scalar = UnicodeScalar(UInt32(code)) else {
            return storeString("")
        }
        return storeString(String(Character(scalar)))
    }
    
    /// Repeat a string n times
    public func stringRepeat(_ id: Int32, count: Int32) -> Int32 {
        guard let string = stringTable[id] else { return storeString("") }
        let repeated = String(repeating: string, count: Int(count))
        return storeString(repeated)
    }
    
    /// Convert integer to hex string
    public func hex(_ value: Int32) -> Int32 {
        let hexString = String(format: "%X", value)
        return storeString(hexString)
    }
    
    /// Convert integer to binary string
    public func bin(_ value: Int32) -> Int32 {
        let binString = String(value, radix: 2)
        return storeString(binString)
    }
    
    /// Left-justify string in field of given width
    public func lSet(_ id: Int32, width: Int32) -> Int32 {
        guard let string = stringTable[id] else { return storeString("") }
        let w = Int(width)
        if string.count >= w {
            return mid(id, start: 1, length: width)
        }
        let padding = String(repeating: " ", count: w - string.count)
        return storeString(string + padding)
    }
    
    /// Right-justify string in field of given width
    public func rSet(_ id: Int32, width: Int32) -> Int32 {
        guard let string = stringTable[id] else { return storeString("") }
        let w = Int(width)
        if string.count >= w {
            return right(id, length: width)
        }
        let padding = String(repeating: " ", count: w - string.count)
        return storeString(padding + string)
    }
    
    /// Concatenate two strings
    public func concat(_ id1: Int32, _ id2: Int32) -> Int32 {
        let str1 = stringTable[id1] ?? ""
        let str2 = stringTable[id2] ?? ""
        return storeString(str1 + str2)
    }
}
