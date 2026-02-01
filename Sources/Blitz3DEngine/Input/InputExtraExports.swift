//
//  InputExtraExports.swift
//  Blitz3DEngine
//
//  Additional input functions
//

import Foundation

@_cdecl("GetKey")
@MainActor
public func GetKey() -> Int32 {
    // Get ASCII code of last key pressed
    return 0
}

@_cdecl("MouseZSpeed")
@MainActor
public func MouseZSpeed() -> Int32 {
    // Get mouse wheel delta
    return 0
}
