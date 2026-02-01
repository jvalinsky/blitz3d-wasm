//
//  DisplayExports.swift
//  Blitz3DEngine
//
//  Display and graphics mode functions
//

import Foundation

@_cdecl("ClearSurface")
@MainActor
public func ClearSurface(_ surface: Int32, _ clearVertices: Int32, _ clearTriangles: Int32) {
    // Clear surface geometry
}

@_cdecl("ClearWorld")
@MainActor
public func ClearWorld(_ entities: Int32, _ brushes: Int32, _ textures: Int32) {
    // Clear world objects
}

@_cdecl("AntiAlias")
@MainActor
public func AntiAlias(_ enable: Int32) {
    // Enable/disable antialiasing
}

@_cdecl("WireFrame")
@MainActor
public func WireFrame(_ enable: Int32) {
    // Enable/disable wireframe rendering
}

@_cdecl("GraphicsBuffer")
@MainActor
public func GraphicsBuffer() -> Int32 {
    // Get graphics buffer handle
    return 1
}

@_cdecl("GfxModeWidth")
@MainActor
public func GfxModeWidth(_ mode: Int32) -> Int32 {
    // Get graphics mode width
    // Common resolutions: 800, 1024, 1280, 1920
    switch mode {
    case 0: return 800
    case 1: return 1024
    case 2: return 1280
    case 3: return 1920
    default: return 1024
    }
}

@_cdecl("GfxModeHeight")
@MainActor
public func GfxModeHeight(_ mode: Int32) -> Int32 {
    // Get graphics mode height
    switch mode {
    case 0: return 600
    case 1: return 768
    case 2: return 720
    case 3: return 1080
    default: return 768
    }
}

@_cdecl("CountGfxDrivers")
@MainActor
public func CountGfxDrivers() -> Int32 {
    // Return number of graphics drivers
    // Web has one driver: WebGL
    return 1
}

@_cdecl("GfxDriverName")
@MainActor
public func GfxDriverName(_ driver: Int32) -> Int32 {
    // Get graphics driver name
    let name = driver == 0 ? "WebGL" : "Unknown"
    return StringManager.shared.storeString(name)
}

@_cdecl("CopyRect")
@MainActor
public func CopyRect(_ srcX: Int32, _ srcY: Int32, _ width: Int32, _ height: Int32, 
                      _ dstX: Int32, _ dstY: Int32, _ srcBuffer: Int32, _ dstBuffer: Int32) {
    // Copy rectangle between buffers
}

@_cdecl("TrisRendered")
@MainActor
public func TrisRendered() -> Int32 {
    // Get number of triangles rendered last frame
    return 0
}
