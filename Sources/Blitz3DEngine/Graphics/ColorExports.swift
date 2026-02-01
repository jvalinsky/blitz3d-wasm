//
//  ColorExports.swift
//  Blitz3DEngine
//
//  Color utility functions
//

import Foundation

@_cdecl("ColorRed")
@MainActor
public func ColorRed(_ rgb: Int32) -> Int32 {
    // Extract red component from RGB value
    return (rgb >> 16) & 0xFF
}

@_cdecl("ColorGreen")
@MainActor
public func ColorGreen(_ rgb: Int32) -> Int32 {
    // Extract green component from RGB value
    return (rgb >> 8) & 0xFF
}

@_cdecl("ColorBlue")
@MainActor
public func ColorBlue(_ rgb: Int32) -> Int32 {
    // Extract blue component from RGB value
    return rgb & 0xFF
}
