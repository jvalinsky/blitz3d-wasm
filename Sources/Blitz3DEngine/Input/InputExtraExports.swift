//
//  InputExtraExports.swift
//  Blitz3DEngine
//
//  Additional keyboard and mouse input functions
//

import Foundation

/// Returns the ASCII code of the last key that was pressed.
///
/// - Returns: ASCII code of last key press, or 0 if no key pressed
///
/// - Note: Unlike KeyHit which only returns once per press, GetKey can return
///         the same value multiple times if held. Useful for text input where
///         you need the actual character code. For game controls, use KeyDown/KeyHit instead.
///
/// Example ASCII codes:
/// - 65-90: Uppercase letters A-Z
/// - 97-122: Lowercase letters a-z
/// - 48-57: Numbers 0-9
/// - 32: Spacebar
/// - 13: Enter/Return
@_cdecl("GetKey")
@MainActor
public func GetKey() -> Int32 {
    // Will return ASCII code from input system
    return 0
}

/// Returns the mouse wheel scroll delta since last frame.
///
/// - Returns: Positive for scroll up, negative for scroll down, 0 for no scroll
///
/// - Note: Values typically range from -3 to +3 depending on scroll speed.
///         Useful for zooming, menu scrolling, and weapon selection.
///         The value resets each frame, so you get the delta, not absolute position.
@_cdecl("MouseZSpeed")
@MainActor
public func MouseZSpeed() -> Int32 {
    // Will return mouse wheel delta from input system
    return 0
}
