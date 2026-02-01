//
//  SystemExports.swift
//  Blitz3DEngine
//
//  System information and debug functions
//

import Foundation

@_cdecl("ErrorLog")
@MainActor
public func ErrorLog(_ messageID: Int32) -> Int32 {
    // Log error message
    guard let message = StringManager.shared.getString(messageID) else { return 0 }
    print("ERROR: \(message)")
    return 1
}

@_cdecl("TotalVidMem")
@MainActor
public func TotalVidMem() -> Int32 {
    // Get total video memory (MB)
    // Return reasonable estimate for web
    return 1024
}

@_cdecl("AvailVidMem")
@MainActor
public func AvailVidMem() -> Int32 {
    // Get available video memory (MB)
    return 512
}

@_cdecl("GlobalMemoryStatus")
@MainActor
public func GlobalMemoryStatus(_ memoryLoad: Int32, _ totalPhys: Int32, _ availPhys: Int32,
                                _ totalPageFile: Int32, _ availPageFile: Int32,
                                _ totalVirtual: Int32, _ availVirtual: Int32) {
    // Get system memory status (stub for web)
}

@_cdecl("ActiveTextures")
@MainActor
public func ActiveTextures() -> Int32 {
    // Get number of active textures
    return 0
}
