//
//  FontExports.swift
//  Blitz3DEngine
//
//  Font and text measurement functions
//

import Foundation

@_cdecl("FontWidth")
@MainActor
public func FontWidth(_ font: Int32) -> Int32 {
    // Get average character width of font
    // Return reasonable default
    return 8
}

@_cdecl("FontHeight")
@MainActor
public func FontHeight(_ font: Int32) -> Int32 {
    // Get character height of font
    return 16
}

@_cdecl("StringWidth")
@MainActor
public func StringWidth(_ stringID: Int32) -> Int32 {
    // Get pixel width of string with current font
    guard let string = StringManager.shared.getString(stringID) else { return 0 }
    return Int32(string.count * 8) // 8 pixels per character (monospace estimate)
}

@_cdecl("StringHeight")
@MainActor
public func StringHeight(_ stringID: Int32) -> Int32 {
    // Get pixel height of string with current font
    return 16 // Standard font height
}
