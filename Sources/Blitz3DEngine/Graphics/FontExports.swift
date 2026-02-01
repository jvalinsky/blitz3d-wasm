//
//  FontExports.swift
//  Blitz3DEngine
//
//  Font metrics and text measurement functions
//

import Foundation

/// Returns the average character width of a font.
///
/// - Parameter font: Handle to the font
///
/// - Returns: Average width in pixels of characters in the font
///
/// - Note: For monospace fonts, this is the fixed width of all characters.
///         For proportional fonts, this is an average. Useful for calculating
///         text spacing and layout.
@_cdecl("FontWidth")
@MainActor
public func FontWidth(_ font: Int32) -> Int32 {
    // Return reasonable default for standard fonts
    return 8
}

/// Returns the height of a font from baseline to top.
///
/// - Parameter font: Handle to the font
///
/// - Returns: Height in pixels of the font
///
/// - Note: This is the line height - the vertical space needed for a line of text.
///         Useful for calculating multi-line text layout and line spacing.
@_cdecl("FontHeight")
@MainActor
public func FontHeight(_ font: Int32) -> Int32 {
    // Return reasonable default for standard fonts
    return 16
}

/// Calculates the pixel width that a string would occupy when rendered.
///
/// - Parameter stringID: Handle to the string to measure
///
/// - Returns: Width in pixels that the string would occupy
///
/// - Note: Uses the current font. Essential for text centering, right-alignment,
///         and ensuring text fits within UI boundaries. For proportional fonts,
///         this varies based on the specific characters in the string.
@_cdecl("StringWidth")
@MainActor
public func StringWidth(_ stringID: Int32) -> Int32 {
    guard let string = StringManager.shared.getString(stringID) else { return 0 }
    // Estimate using monospace calculation (8 pixels per character)
    return Int32(string.count * 8)
}

/// Returns the height in pixels that a string would occupy when rendered.
///
/// - Parameter stringID: Handle to the string to measure
///
/// - Returns: Height in pixels that the string would occupy
///
/// - Note: For single-line text, this equals FontHeight. For multi-line text
///         (with newlines), this would be FontHeight * number_of_lines.
@_cdecl("StringHeight")
@MainActor
public func StringHeight(_ stringID: Int32) -> Int32 {
    // Standard font height
    return 16
}
