//
//  ColorExports.swift
//  Blitz3DEngine
//
//  Color component extraction utilities
//

import Foundation

/// Extracts the red component from an RGB color value.
///
/// - Parameter rgb: 24-bit RGB color value (format: 0x00RRGGBB)
///
/// - Returns: Red component as an integer (0-255)
///
/// - Note: Useful for decomposing colors returned by ReadPixel or for
///         color manipulation. Works with standard RGB color format.
///
/// Example:
/// ```
/// let color = 0xFF8040  // Orange
/// let red = ColorRed(color)  // Returns 255
/// ```
@_cdecl("ColorRed")
@MainActor
public func ColorRed(_ rgb: Int32) -> Int32 {
    return (rgb >> 16) & 0xFF
}

/// Extracts the green component from an RGB color value.
///
/// - Parameter rgb: 24-bit RGB color value (format: 0x00RRGGBB)
///
/// - Returns: Green component as an integer (0-255)
///
/// - Note: Useful for decomposing colors returned by ReadPixel or for
///         color manipulation. Works with standard RGB color format.
///
/// Example:
/// ```
/// let color = 0xFF8040  // Orange
/// let green = ColorGreen(color)  // Returns 128
/// ```
@_cdecl("ColorGreen")
@MainActor
public func ColorGreen(_ rgb: Int32) -> Int32 {
    return (rgb >> 8) & 0xFF
}

/// Extracts the blue component from an RGB color value.
///
/// - Parameter rgb: 24-bit RGB color value (format: 0x00RRGGBB)
///
/// - Returns: Blue component as an integer (0-255)
///
/// - Note: Useful for decomposing colors returned by ReadPixel or for
///         color manipulation. Works with standard RGB color format.
///
/// Example:
/// ```
/// let color = 0xFF8040  // Orange
/// let blue = ColorBlue(color)  // Returns 64
/// ```
@_cdecl("ColorBlue")
@MainActor
public func ColorBlue(_ rgb: Int32) -> Int32 {
    return rgb & 0xFF
}
