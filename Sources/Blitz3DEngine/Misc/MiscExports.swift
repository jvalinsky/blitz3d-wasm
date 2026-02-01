//
//  MiscExports.swift
//  Blitz3DEngine
//
//  Miscellaneous utility functions
//

import Foundation

@_cdecl("Forest_Pivot")
@MainActor
public func Forest_Pivot() -> Int32 {
    // SCPCB-specific: Get forest entity pivot
    return 0
}

@_cdecl("SX")
@MainActor
public func SX(_ entity: Int32) -> Float {
    // SCPCB-specific: Scaled X coordinate
    return 0.0
}

@_cdecl("SY")
@MainActor
public func SY(_ entity: Int32) -> Float {
    // SCPCB-specific: Scaled Y coordinate
    return 0.0
}

@_cdecl("ParticlePiv")
@MainActor
public func ParticlePiv(_ index: Int32) -> Int32 {
    // SCPCB-specific: Get particle pivot
    return 0
}

@_cdecl("D")
@MainActor
public func D(_ value: Float) -> Float {
    // SCPCB-specific: Debug utility function
    return value
}

@_cdecl("Temp")
@MainActor
public func Temp() -> Float {
    // SCPCB-specific: Temporary variable
    return 0.0
}

// Texture advanced functions

@_cdecl("TextureBumpEnvMat")
@MainActor
public func TextureBumpEnvMat(_ texture: Int32, _ mat00: Float, _ mat01: Float,
                                _ mat10: Float, _ mat11: Float) {
    // Set texture bump environment matrix
}

@_cdecl("TextureBumpEnvOffset")
@MainActor
public func TextureBumpEnvOffset(_ texture: Int32, _ offset: Float) {
    // Set texture bump environment offset
}

@_cdecl("TextureBumpEnvScale")
@MainActor
public func TextureBumpEnvScale(_ texture: Int32, _ scale: Float) {
    // Set texture bump environment scale
}

@_cdecl("TextureLODBias")
@MainActor
public func TextureLODBias(_ texture: Int32, _ bias: Float) {
    // Set texture LOD bias
}

// Directory functions

@_cdecl("CloseDir")
@MainActor
public func CloseDir(_ dir: Int32) {
    // Close directory handle
}

// Byte array I/O

@_cdecl("ReadBytes")
@MainActor
public func ReadBytes(_ bank: Int32, _ file: Int32, _ offset: Int32, _ count: Int32) -> Int32 {
    // Read bytes from file into bank
    return count
}

@_cdecl("WriteBytes")
@MainActor
public func WriteBytes(_ bank: Int32, _ file: Int32, _ offset: Int32, _ count: Int32) -> Int32 {
    // Write bytes from bank to file
    return count
}
