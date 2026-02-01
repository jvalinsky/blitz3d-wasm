//
//  DisplayExports.swift
//  Blitz3DEngine
//
//  Display, graphics mode, and rendering configuration functions
//

import Foundation

/// Clears all geometry data from a surface.
///
/// - Parameters:
///   - surface: Handle to the surface to clear
///   - clearVertices: 1 to clear vertex data, 0 to preserve
///   - clearTriangles: 1 to clear triangle/index data, 0 to preserve
///
/// - Note: Useful for procedurally regenerating mesh geometry each frame.
@_cdecl("ClearSurface")
@MainActor
public func ClearSurface(_ surface: Int32, _ clearVertices: Int32, _ clearTriangles: Int32) {
    // Surface clearing will be handled by geometry system
}

/// Frees all entities, brushes, and textures in the world.
///
/// - Parameters:
///   - entities: 1 to free all entities, 0 to preserve
///   - brushes: 1 to free all brushes, 0 to preserve
///   - textures: 1 to free all textures, 0 to preserve
///
/// - Note: This is a bulk cleanup operation. Be careful as it will free ALL objects
///         of the specified types, including cameras and lights.
@_cdecl("ClearWorld")
@MainActor
public func ClearWorld(_ entities: Int32, _ brushes: Int32, _ textures: Int32) {
    // World clearing will be handled by scene management
}

/// Enables or disables antialiasing (edge smoothing) for 3D rendering.
///
/// - Parameter enable: 1 to enable antialiasing, 0 to disable
///
/// - Note: Antialiasing reduces jagged edges on geometry but may impact performance.
///         In web contexts, this maps to MSAA or other browser-supported AA methods.
@_cdecl("AntiAlias")
@MainActor
public func AntiAlias(_ enable: Int32) {
    // Antialiasing will be configured in rendering system
}

/// Enables or disables wireframe rendering mode.
///
/// - Parameter enable: 1 for wireframe mode, 0 for normal solid rendering
///
/// - Note: Wireframe mode renders only polygon edges, useful for debugging geometry
///         or creating special visual effects.
@_cdecl("WireFrame")
@MainActor
public func WireFrame(_ enable: Int32) {
    // Wireframe mode will be handled by renderer
}

/// Returns the handle to the current graphics buffer.
///
/// - Returns: Graphics buffer handle (typically 1 for the backbuffer)
///
/// - Note: In Blitz3D, this is used with SetBuffer to control where drawing occurs.
@_cdecl("GraphicsBuffer")
@MainActor
public func GraphicsBuffer() -> Int32 {
    return 1
}

/// Returns the width in pixels for a given graphics mode.
///
/// - Parameter mode: Graphics mode index (0-3)
///
/// - Returns: Width in pixels for the specified mode
///
/// - Note: Mode 0=800, 1=1024, 2=1280, 3=1920. Used for enumerating available
///         display resolutions.
@_cdecl("GfxModeWidth")
@MainActor
public func GfxModeWidth(_ mode: Int32) -> Int32 {
    // Return common resolutions
    switch mode {
    case 0: return 800
    case 1: return 1024
    case 2: return 1280
    case 3: return 1920
    default: return 1024
    }
}

/// Returns the height in pixels for a given graphics mode.
///
/// - Parameter mode: Graphics mode index (0-3)
///
/// - Returns: Height in pixels for the specified mode
///
/// - Note: Mode 0=600, 1=768, 2=720, 3=1080. Used for enumerating available
///         display resolutions.
@_cdecl("GfxModeHeight")
@MainActor
public func GfxModeHeight(_ mode: Int32) -> Int32 {
    // Return common resolutions
    switch mode {
    case 0: return 600
    case 1: return 768
    case 2: return 720
    case 3: return 1080
    default: return 768
    }
}

/// Returns the number of available graphics drivers.
///
/// - Returns: Number of graphics drivers (always 1 for WebGL)
///
/// - Note: In web contexts, there is only one "driver": WebGL. This maintains
///         compatibility with Blitz3D's multi-driver enumeration.
@_cdecl("CountGfxDrivers")
@MainActor
public func CountGfxDrivers() -> Int32 {
    return 1  // Web has one driver: WebGL
}

/// Returns the name of a graphics driver.
///
/// - Parameter driver: Driver index (0 for WebGL)
///
/// - Returns: String handle containing the driver name
///
/// - Note: Always returns "WebGL" for driver 0 in web contexts.
@_cdecl("GfxDriverName")
@MainActor
public func GfxDriverName(_ driver: Int32) -> Int32 {
    let name = driver == 0 ? "WebGL" : "Unknown"
    return StringManager.shared.storeString(name)
}

/// Copies a rectangular region from one buffer to another.
///
/// - Parameters:
///   - srcX: Source X coordinate
///   - srcY: Source Y coordinate
///   - width: Width of region to copy
///   - height: Height of region to copy
///   - dstX: Destination X coordinate
///   - dstY: Destination Y coordinate
///   - srcBuffer: Source buffer handle
///   - dstBuffer: Destination buffer handle
///
/// - Note: Used for blitting operations and double-buffering effects.
@_cdecl("CopyRect")
@MainActor
public func CopyRect(_ srcX: Int32, _ srcY: Int32, _ width: Int32, _ height: Int32, 
                      _ dstX: Int32, _ dstY: Int32, _ srcBuffer: Int32, _ dstBuffer: Int32) {
    // Buffer copying will be handled by 2D rendering system
}

/// Returns the number of triangles rendered in the last frame.
///
/// - Returns: Triangle count from previous frame
///
/// - Note: Useful for performance profiling and debugging. The count includes
///         all rendered triangles from all meshes and entities.
@_cdecl("TrisRendered")
@MainActor
public func TrisRendered() -> Int32 {
    // Will return triangle count from renderer statistics
    return 0
}
