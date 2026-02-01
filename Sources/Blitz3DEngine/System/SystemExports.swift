//
//  SystemExports.swift
//  Blitz3DEngine
//
//  System information, debugging, and resource monitoring functions
//

import Foundation

/// Logs an error message to the console/error log.
///
/// - Parameter messageID: String handle containing the error message
///
/// - Returns: 1 to indicate the message was logged
///
/// - Note: Used for debugging and error reporting. Messages appear in the console
///         or debug output. In production builds, errors might be written to a log file.
///
/// Example:
/// ```
/// ErrorLog("Failed to load texture: missing file")
/// ```
@_cdecl("ErrorLog")
@MainActor
public func ErrorLog(_ messageID: Int32) -> Int32 {
    guard let message = StringManager.shared.getString(messageID) else { return 0 }
    print("ERROR: \(message)")
    return 1
}

/// Returns the total video memory available on the graphics card.
///
/// - Returns: Total video memory in megabytes
///
/// - Note: Uses WebGL debug info to detect GPU and estimate VRAM. Results are
///         heuristic-based but much better than hardcoded values. Conservative
///         estimates are preferred to avoid memory issues.
@_cdecl("TotalVidMem")
@MainActor
public func TotalVidMem() -> Int32 {
    // Query actual GPU via WebGL and estimate VRAM
    return queryAvailableVRAM()
}

/// Returns the available (free) video memory on the graphics card.
///
/// - Returns: Available video memory in megabytes
///
/// - Note: Uses WebGL debug info to detect GPU and estimate VRAM. Browsers don't
///         expose actual free VRAM, so we return the total estimate. Games should
///         use this conservatively for texture loading decisions.
@_cdecl("AvailVidMem")
@MainActor
public func AvailVidMem() -> Int32 {
    // Query actual GPU via WebGL and estimate VRAM
    // Return full estimate since we can't measure actual free memory
    return queryAvailableVRAM()
}

/// Retrieves system memory statistics using Web APIs.
///
/// - Parameters:
///   - memoryLoad: Percentage of physical memory in use (0-100)
///   - totalPhys: Total physical RAM in bytes
///   - availPhys: Available physical RAM in bytes
///   - totalPageFile: Total page file size in bytes
///   - availPageFile: Available page file space in bytes
///   - totalVirtual: Total virtual memory in bytes
///   - availVirtual: Available virtual memory in bytes
///
/// - Note: Uses navigator.deviceMemory and performance.memory to provide
///         real estimates. Values are approximate due to browser privacy
///         restrictions, but much better than hardcoded stubs.
@_cdecl("GlobalMemoryStatus")
@MainActor
public func GlobalMemoryStatus(_ memoryLoad: UnsafeMutablePointer<Int32>,
                                _ totalPhys: UnsafeMutablePointer<Int32>,
                                _ availPhys: UnsafeMutablePointer<Int32>,
                                _ totalPageFile: UnsafeMutablePointer<Int32>,
                                _ availPageFile: UnsafeMutablePointer<Int32>,
                                _ totalVirtual: UnsafeMutablePointer<Int32>,
                                _ availVirtual: UnsafeMutablePointer<Int32>) {
    let (totalRAM, availableRAM, load) = querySystemMemory()
    
    // Set all output parameters
    memoryLoad.pointee = load
    totalPhys.pointee = totalRAM
    availPhys.pointee = availableRAM
    
    // Web doesn't use page files - mirror RAM values for compatibility
    totalPageFile.pointee = totalRAM
    availPageFile.pointee = availableRAM
    totalVirtual.pointee = totalRAM
    availVirtual.pointee = availableRAM
}

/// Returns the number of textures currently loaded in video memory.
///
/// - Returns: Count of active textures
///
/// - Note: Useful for debugging texture leaks and optimizing memory usage.
///         Should decrease when FreeTexture is called. High counts may indicate
///         textures not being freed properly.
@_cdecl("ActiveTextures")
@MainActor
public func ActiveTextures() -> Int32 {
    // Will return count from texture manager
    return 0
}
