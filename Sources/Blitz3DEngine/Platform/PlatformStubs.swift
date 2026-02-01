//
//  PlatformStubs.swift
//  Blitz3DEngine
//
//  Platform-specific function stubs (Windows API, ZIP, Video)
//  These are not needed for web but must exist for compilation
//

import Foundation

// MARK: - Windows API Stubs

@_cdecl("API_SetWindowLong")
@MainActor
public func API_SetWindowLong(_ hwnd: Int32, _ index: Int32, _ value: Int32) -> Int32 {
    return 0
}

@_cdecl("API_SetWindowPos")
@MainActor
public func API_SetWindowPos(_ hwnd: Int32, _ hwndAfter: Int32, _ x: Int32, _ y: Int32,
                              _ width: Int32, _ height: Int32, _ flags: Int32) -> Int32 {
    return 0
}

@_cdecl("API_GetFocus")
@MainActor
public func API_GetFocus() -> Int32 {
    return 1 // Always has focus in web
}

@_cdecl("API_GetModuleFilename")
@MainActor
public func API_GetModuleFilename(_ handle: Int32, _ buffer: Int32, _ size: Int32) -> Int32 {
    return 0
}

// MARK: - ZLib/ZIP Stubs (VFS handles this in TypeScript)

@_cdecl("ZlibWapi_CompressBound")
@MainActor
public func ZlibWapi_CompressBound(_ sourceLen: Int32) -> Int32 {
    return sourceLen + (sourceLen / 100) + 13
}

@_cdecl("ZlibWapi_Compress2")
@MainActor
public func ZlibWapi_Compress2(_ dest: Int32, _ destLen: Int32, _ source: Int32,
                                 _ sourceLen: Int32, _ level: Int32) -> Int32 {
    return 0
}

@_cdecl("ZlibWapi_Uncompress")
@MainActor
public func ZlibWapi_Uncompress(_ dest: Int32, _ destLen: Int32, _ source: Int32, _ sourceLen: Int32) -> Int32 {
    return 0
}

@_cdecl("ZlibWapi_UnzOpen")
@MainActor
public func ZlibWapi_UnzOpen(_ path: Int32) -> Int32 {
    return 0
}

@_cdecl("ZlibWapi_UnzClose")
@MainActor
public func ZlibWapi_UnzClose(_ file: Int32) -> Int32 {
    return 0
}

@_cdecl("ZlibWapi_UnzLocateFile")
@MainActor
public func ZlibWapi_UnzLocateFile(_ file: Int32, _ filename: Int32, _ caseSensitivity: Int32) -> Int32 {
    return 0
}

@_cdecl("ZlibWapi_UnzOpenCurrentFile")
@MainActor
public func ZlibWapi_UnzOpenCurrentFile(_ file: Int32) -> Int32 {
    return 0
}

@_cdecl("ZlibWapi_UnzOpenCurrentFilePassword")
@MainActor
public func ZlibWapi_UnzOpenCurrentFilePassword(_ file: Int32, _ password: Int32) -> Int32 {
    return 0
}

@_cdecl("ZlibWapi_UnzReadCurrentFile")
@MainActor
public func ZlibWapi_UnzReadCurrentFile(_ file: Int32, _ buffer: Int32, _ len: Int32) -> Int32 {
    return 0
}

@_cdecl("ZlibWapi_UnzCloseCurrentFile")
@MainActor
public func ZlibWapi_UnzCloseCurrentFile(_ file: Int32) -> Int32 {
    return 0
}

@_cdecl("ZlibWapi_UnzGetCurrentFileInfo")
@MainActor
public func ZlibWapi_UnzGetCurrentFileInfo(_ file: Int32, _ info: Int32, _ filename: Int32,
                                            _ filenameSize: Int32, _ extra: Int32, _ extraSize: Int32,
                                            _ comment: Int32, _ commentSize: Int32) -> Int32 {
    return 0
}

@_cdecl("ZlibWapi_UnzGoToFirstFile")
@MainActor
public func ZlibWapi_UnzGoToFirstFile(_ file: Int32) -> Int32 {
    return 0
}

@_cdecl("ZlibWapi_UnzGoToNextFile")
@MainActor
public func ZlibWapi_UnzGoToNextFile(_ file: Int32) -> Int32 {
    return 0
}

@_cdecl("ZlibWapi_UnzGetGlobalInfo")
@MainActor
public func ZlibWapi_UnzGetGlobalInfo(_ file: Int32, _ info: Int32) -> Int32 {
    return 0
}

@_cdecl("ZlibWapi_UnzGetGlobalComment")
@MainActor
public func ZlibWapi_UnzGetGlobalComment(_ file: Int32, _ comment: Int32, _ commentSize: Int32) -> Int32 {
    return 0
}

@_cdecl("ZlibWapi_ZipOpen")
@MainActor
public func ZlibWapi_ZipOpen(_ path: Int32, _ append: Int32) -> Int32 {
    return 0
}

@_cdecl("ZlibWapi_ZipClose")
@MainActor
public func ZlibWapi_ZipClose(_ file: Int32, _ comment: Int32) -> Int32 {
    return 0
}

@_cdecl("ZlibWapi_ZipOpenNewFileInZip")
@MainActor
public func ZlibWapi_ZipOpenNewFileInZip(_ file: Int32, _ filename: Int32, _ info: Int32,
                                          _ extraLocal: Int32, _ extraLocalSize: Int32,
                                          _ extraGlobal: Int32, _ extraGlobalSize: Int32,
                                          _ comment: Int32, _ method: Int32, _ level: Int32) -> Int32 {
    return 0
}

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

@_cdecl("ZlibWapi_ZipWriteFileInZip")
@MainActor
public func ZlibWapi_ZipWriteFileInZip(_ file: Int32, _ buffer: Int32, _ len: Int32) -> Int32 {
    return 0
}

@_cdecl("ZlibWapi_ZipCloseFileInZip")
@MainActor
public func ZlibWapi_ZipCloseFileInZip(_ file: Int32) -> Int32 {
    return 0
}

@_cdecl("ZlibWapi_Crc32")
@MainActor
public func ZlibWapi_Crc32(_ crc: Int32, _ buffer: Int32, _ len: Int32) -> Int32 {
    return 0
}

@_cdecl("ZlibWapi_Adler32")
@MainActor
public func ZlibWapi_Adler32(_ adler: Int32, _ buffer: Int32, _ len: Int32) -> Int32 {
    return 0
}

// MARK: - Video Playback Stubs

@_cdecl("BlitzMovie_Open")
@MainActor
public func BlitzMovie_Open(_ path: Int32) -> Int32 {
    return 0
}

@_cdecl("BlitzMovie_Close")
@MainActor
public func BlitzMovie_Close(_ movie: Int32) {
}

@_cdecl("BlitzMovie_GetWidth")
@MainActor
public func BlitzMovie_GetWidth(_ movie: Int32) -> Int32 {
    return 640
}

@_cdecl("BlitzMovie_GetHeight")
@MainActor
public func BlitzMovie_GetHeight(_ movie: Int32) -> Int32 {
    return 480
}

@_cdecl("BlitzMovie_OpenDecodeToImage")
@MainActor
public func BlitzMovie_OpenDecodeToImage(_ movie: Int32, _ image: Int32) -> Int32 {
    return 0
}

@_cdecl("BlitzMovie_Play")
@MainActor
public func BlitzMovie_Play(_ movie: Int32) {
}

@_cdecl("BlitzMovie_Stop")
@MainActor
public func BlitzMovie_Stop(_ movie: Int32) {
}
