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
/// - Note: In web contexts, returns an estimate (1024MB) since browsers don't
///         expose actual GPU memory. Useful for performance profiling and
///         determining if high-resolution textures can be loaded.
@_cdecl("TotalVidMem")
@MainActor
public func TotalVidMem() -> Int32 {
    // Return reasonable estimate for web (1GB)
    return 1024
}

/// Returns the available (free) video memory on the graphics card.
///
/// - Returns: Available video memory in megabytes
///
/// - Note: In web contexts, returns an estimate (512MB). In native builds,
///         this would query actual GPU memory. Useful for detecting memory
///         pressure and adjusting texture quality dynamically.
@_cdecl("AvailVidMem")
@MainActor
public func AvailVidMem() -> Int32 {
    // Return reasonable estimate for web (512MB free)
    return 512
}

/// Retrieves system memory statistics.
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
/// - Note: This is a Windows API-style function. In web contexts, most values
///         are stubbed since browsers don't expose detailed memory information.
///         Maintained for compatibility with Windows-based Blitz3D code.
@_cdecl("GlobalMemoryStatus")
@MainActor
public func GlobalMemoryStatus(_ memoryLoad: Int32, _ totalPhys: Int32, _ availPhys: Int32,
                                _ totalPageFile: Int32, _ availPageFile: Int32,
                                _ totalVirtual: Int32, _ availVirtual: Int32) {
    // Stubbed for web - browsers don't expose detailed memory stats
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
