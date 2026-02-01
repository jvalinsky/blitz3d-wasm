//
//  CameraExports.swift
//  Blitz3DEngine
//
//  Camera control functions for Blitz3D compatibility
//

import Foundation

/// Sets the camera clear mode, controlling which buffers are cleared each frame.
///
/// - Parameters:
///   - camera: Handle to the camera entity
///   - clsColor: 1 to clear the color buffer, 0 to preserve previous frame's colors
///   - clsZBuffer: 1 to clear the depth buffer, 0 to preserve depth information
///
/// - Note: In Blitz3D, this controls whether the camera clears the screen before rendering.
///         Setting clsColor=0 allows for trails/motion blur effects.
///         Setting clsZBuffer=0 can create interesting depth-layering effects.
@_cdecl("CameraClsMode")
@MainActor
public func CameraClsMode(_ camera: Int32, _ clsColor: Int32, _ clsZBuffer: Int32) {
    // Camera clear mode will be handled by rendering system
}

/// Performs a ray-pick from the camera through screen coordinates to find intersecting entities.
///
/// - Parameters:
///   - camera: Handle to the camera entity
///   - x: Screen X coordinate (0.0 to screen width)
///   - y: Screen Y coordinate (0.0 to screen height)
///
/// - Returns: Handle to the picked entity, or 0 if nothing was picked
///
/// - Note: After calling CameraPick, use ProjectedX() and ProjectedY() to get the
///         exact hit coordinates in screen space.
@_cdecl("CameraPick")
@MainActor
public func CameraPick(_ camera: Int32, _ x: Float, _ y: Float) -> Int32 {
    // Ray-casting will be implemented by physics/collision system
    return 0
}

/// Returns the projected screen X coordinate from the last CameraPick call.
///
/// - Returns: X coordinate in screen space where the ray intersected the picked entity
///
/// - Note: Only valid after a successful CameraPick call. Used for positioning
///         2D UI elements at 3D world positions.
@_cdecl("ProjectedX")
@MainActor
public func ProjectedX() -> Float {
    // Will return the X coordinate of the last successful pick
    return 0.0
}

/// Returns the projected screen Y coordinate from the last CameraPick call.
///
/// - Returns: Y coordinate in screen space where the ray intersected the picked entity
///
/// - Note: Only valid after a successful CameraPick call. Used for positioning
///         2D UI elements at 3D world positions.
@_cdecl("ProjectedY")
@MainActor
public func ProjectedY() -> Float {
    // Will return the Y coordinate of the last successful pick
    return 0.0
}

/// Projects a 3D world position to 2D screen coordinates using the camera's view.
///
/// - Parameters:
///   - camera: Handle to the camera entity
///   - x: World X coordinate
///   - y: World Y coordinate
///   - z: World Z coordinate
///
/// - Note: After calling CameraProject, use ProjectedX() and ProjectedY() to retrieve
///         the resulting screen coordinates. This is useful for rendering 2D overlays
///         at 3D positions (health bars, name tags, etc.).
@_cdecl("CameraProject")
@MainActor
public func CameraProject(_ camera: Int32, _ x: Float, _ y: Float, _ z: Float) {
    // 3D to 2D projection will be handled by rendering system
}
