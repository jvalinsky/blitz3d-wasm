//
//  PlatformStubs.swift
//  Blitz3DEngine
//
//  Platform-specific function stubs for Windows API, ZIP operations, and video playback.
//  These functions are not needed for web execution but must exist for compilation compatibility.
//

import Foundation

// MARK: - Windows API Stubs

/// Sets a window's extended style attributes (Windows API stub).
///
/// - Parameters:
///   - hwnd: Window handle
///   - index: Attribute index to modify
///   - value: New value for the attribute
///
/// - Returns: Previous value, or 0 in web context
///
/// - Note: Windows-specific function. Stubbed for web - has no effect in browser.
@_cdecl("API_SetWindowLong")
@MainActor
public func API_SetWindowLong(_ hwnd: Int32, _ index: Int32, _ value: Int32) -> Int32 {
    return 0
}

/// Sets a window's position and size (Windows API stub).
///
/// - Parameters:
///   - hwnd: Window handle
///   - hwndAfter: Z-order placement
///   - x: Window X position
///   - y: Window Y position
///   - width: Window width
///   - height: Window height
///   - flags: Positioning flags
///
/// - Returns: 1 for success, 0 for failure
///
/// - Note: Windows-specific function. Stubbed for web - browser controls window management.
@_cdecl("API_SetWindowPos")
@MainActor
public func API_SetWindowPos(_ hwnd: Int32, _ hwndAfter: Int32, _ x: Int32, _ y: Int32,
                              _ width: Int32, _ height: Int32, _ flags: Int32) -> Int32 {
    return 0
}

/// Gets the handle of the window with keyboard focus (Windows API stub).
///
/// - Returns: Window handle, or 1 (always focused) in web context
///
/// - Note: Windows-specific function. In web, canvas always has focus when active.
@_cdecl("API_GetFocus")
@MainActor
public func API_GetFocus() -> Int32 {
    return 1  // Always has focus in web
}

/// Gets the file path of the current module (Windows API stub).
///
/// - Parameters:
///   - handle: Module handle
///   - buffer: Buffer to receive the path
///   - size: Buffer size
///
/// - Returns: Length of path, or 0 in web context
///
/// - Note: Windows-specific function. Web apps don't have a file system path.
@_cdecl("API_GetModuleFilename")
@MainActor
public func API_GetModuleFilename(_ handle: Int32, _ buffer: Int32, _ size: Int32) -> Int32 {
    return 0
}

// MARK: - ZLib/ZIP Stubs (handled by TypeScript VFS)

/// Calculates the maximum compressed size for a given input (zlib stub).
///
/// - Parameter sourceLen: Uncompressed data size
///
/// - Returns: Maximum size of compressed data
///
/// - Note: ZIP operations handled by TypeScript VFS. This returns the standard
///         zlib compression bound formula.
@_cdecl("ZlibWapi_CompressBound")
@MainActor
public func ZlibWapi_CompressBound(_ sourceLen: Int32) -> Int32 {
    return sourceLen + (sourceLen / 100) + 13
}

/// Compresses data using zlib (stub).
@_cdecl("ZlibWapi_Compress2")
@MainActor
public func ZlibWapi_Compress2(_ dest: Int32, _ destLen: Int32, _ source: Int32,
                                 _ sourceLen: Int32, _ level: Int32) -> Int32 {
    return 0
}

/// Uncompresses data using zlib (stub).
@_cdecl("ZlibWapi_Uncompress")
@MainActor
public func ZlibWapi_Uncompress(_ dest: Int32, _ destLen: Int32, _ source: Int32, _ sourceLen: Int32) -> Int32 {
    return 0
}

/// Opens a ZIP archive for reading (stub).
@_cdecl("ZlibWapi_UnzOpen")
@MainActor
public func ZlibWapi_UnzOpen(_ path: Int32) -> Int32 {
    return 0
}

/// Closes an open ZIP archive (stub).
@_cdecl("ZlibWapi_UnzClose")
@MainActor
public func ZlibWapi_UnzClose(_ file: Int32) -> Int32 {
    return 0
}

/// Locates a file within a ZIP archive (stub).
@_cdecl("ZlibWapi_UnzLocateFile")
@MainActor
public func ZlibWapi_UnzLocateFile(_ file: Int32, _ filename: Int32, _ caseSensitivity: Int32) -> Int32 {
    return 0
}

/// Opens the current file in a ZIP archive (stub).
@_cdecl("ZlibWapi_UnzOpenCurrentFile")
@MainActor
public func ZlibWapi_UnzOpenCurrentFile(_ file: Int32) -> Int32 {
    return 0
}

/// Opens the current file in a ZIP archive with password (stub).
@_cdecl("ZlibWapi_UnzOpenCurrentFilePassword")
@MainActor
public func ZlibWapi_UnzOpenCurrentFilePassword(_ file: Int32, _ password: Int32) -> Int32 {
    return 0
}

/// Reads data from current file in ZIP archive (stub).
@_cdecl("ZlibWapi_UnzReadCurrentFile")
@MainActor
public func ZlibWapi_UnzReadCurrentFile(_ file: Int32, _ buffer: Int32, _ len: Int32) -> Int32 {
    return 0
}

/// Closes the current file in a ZIP archive (stub).
@_cdecl("ZlibWapi_UnzCloseCurrentFile")
@MainActor
public func ZlibWapi_UnzCloseCurrentFile(_ file: Int32) -> Int32 {
    return 0
}

/// Gets information about current file in ZIP archive (stub).
@_cdecl("ZlibWapi_UnzGetCurrentFileInfo")
@MainActor
public func ZlibWapi_UnzGetCurrentFileInfo(_ file: Int32, _ info: Int32, _ filename: Int32,
                                            _ filenameSize: Int32, _ extra: Int32, _ extraSize: Int32,
                                            _ comment: Int32, _ commentSize: Int32) -> Int32 {
    return 0
}

/// Moves to first file in ZIP archive (stub).
@_cdecl("ZlibWapi_UnzGoToFirstFile")
@MainActor
public func ZlibWapi_UnzGoToFirstFile(_ file: Int32) -> Int32 {
    return 0
}

/// Moves to next file in ZIP archive (stub).
@_cdecl("ZlibWapi_UnzGoToNextFile")
@MainActor
public func ZlibWapi_UnzGoToNextFile(_ file: Int32) -> Int32 {
    return 0
}

/// Gets global information about ZIP archive (stub).
@_cdecl("ZlibWapi_UnzGetGlobalInfo")
@MainActor
public func ZlibWapi_UnzGetGlobalInfo(_ file: Int32, _ info: Int32) -> Int32 {
    return 0
}

/// Gets global comment from ZIP archive (stub).
@_cdecl("ZlibWapi_UnzGetGlobalComment")
@MainActor
public func ZlibWapi_UnzGetGlobalComment(_ file: Int32, _ comment: Int32, _ commentSize: Int32) -> Int32 {
    return 0
}

/// Opens a ZIP archive for writing (stub).
@_cdecl("ZlibWapi_ZipOpen")
@MainActor
public func ZlibWapi_ZipOpen(_ path: Int32, _ append: Int32) -> Int32 {
    return 0
}

/// Closes a ZIP archive after writing (stub).
@_cdecl("ZlibWapi_ZipClose")
@MainActor
public func ZlibWapi_ZipClose(_ file: Int32, _ comment: Int32) -> Int32 {
    return 0
}

/// Opens a new file within a ZIP archive for writing (stub).
@_cdecl("ZlibWapi_ZipOpenNewFileInZip")
@MainActor
public func ZlibWapi_ZipOpenNewFileInZip(_ file: Int32, _ filename: Int32, _ info: Int32,
                                          _ extraLocal: Int32, _ extraLocalSize: Int32,
                                          _ extraGlobal: Int32, _ extraGlobalSize: Int32,
                                          _ comment: Int32, _ method: Int32, _ level: Int32) -> Int32 {
    return 0
}

/// Opens a new file within a ZIP archive with extended options (stub).
@_cdecl("ZlibWapi_ZipOpenNewFileInZip3")
@MainActor
public func ZlibWapi_ZipOpenNewFileInZip3(_ file: Int32, _ filename: Int32, _ info: Int32,
                                           _ extraLocal: Int32, _ extraLocalSize: Int32,
                                           _ extraGlobal: Int32, _ extraGlobalSize: Int32,
                                           _ comment: Int32, _ method: Int32, _ level: Int32,
                                           _ raw: Int32, _ windowBits: Int32, _ memLevel: Int32,
                                           _ strategy: Int32, _ password: Int32, _ crc: Int32) -> Int32 {
    return 0
}

/// Writes data to current file in ZIP archive (stub).
@_cdecl("ZlibWapi_ZipWriteFileInZip")
@MainActor
public func ZlibWapi_ZipWriteFileInZip(_ file: Int32, _ buffer: Int32, _ len: Int32) -> Int32 {
    return 0
}

/// Closes current file in ZIP archive after writing (stub).
@_cdecl("ZlibWapi_ZipCloseFileInZip")
@MainActor
public func ZlibWapi_ZipCloseFileInZip(_ file: Int32) -> Int32 {
    return 0
}

/// Calculates CRC32 checksum (stub).
@_cdecl("ZlibWapi_Crc32")
@MainActor
public func ZlibWapi_Crc32(_ crc: Int32, _ buffer: Int32, _ len: Int32) -> Int32 {
    return 0
}

/// Calculates Adler32 checksum (stub).
@_cdecl("ZlibWapi_Adler32")
@MainActor
public func ZlibWapi_Adler32(_ adler: Int32, _ buffer: Int32, _ len: Int32) -> Int32 {
    return 0
}

// MARK: - Video Playback Stubs

/// Opens a video file for playback (stub).
///
/// - Parameter path: Path to video file
///
/// - Returns: Movie handle, or 0 if failed
///
/// - Note: Video playback not implemented in web version. Can be replaced with
///         HTML5 video element if needed.
@_cdecl("BlitzMovie_Open")
@MainActor
public func BlitzMovie_Open(_ path: Int32) -> Int32 {
    return 0
}

/// Closes an open movie (stub).
@_cdecl("BlitzMovie_Close")
@MainActor
public func BlitzMovie_Close(_ movie: Int32) -> Int32 {
    return 1
}

/// Gets the width of a movie (stub).
@_cdecl("BlitzMovie_GetWidth")
@MainActor
public func BlitzMovie_GetWidth(_ movie: Int32) -> Int32 {
    return 640
}

/// Gets the height of a movie (stub).
@_cdecl("BlitzMovie_GetHeight")
@MainActor
public func BlitzMovie_GetHeight(_ movie: Int32) -> Int32 {
    return 480
}

/// Opens movie decoding to an image buffer (stub).
@_cdecl("BlitzMovie_OpenDecodeToImage")
@MainActor
public func BlitzMovie_OpenDecodeToImage(_ movie: Int32, _ image: Int32) -> Int32 {
    return 0
}

/// Starts movie playback (stub).
@_cdecl("BlitzMovie_Play")
@MainActor
public func BlitzMovie_Play(_ movie: Int32) -> Int32 {
    return 1
}

/// Stops movie playback (stub).
@_cdecl("BlitzMovie_Stop")
@MainActor
public func BlitzMovie_Stop(_ movie: Int32) -> Int32 {
    return 1
}
