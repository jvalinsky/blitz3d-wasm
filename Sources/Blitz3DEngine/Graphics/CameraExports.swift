//
//  CameraExports.swift
//  Blitz3DEngine
//
//  Camera control functions for Blitz3D compatibility
//

import Foundation

/// Camera clear mode flags stored per camera (accessed only from MainActor).
nonisolated(unsafe) private var cameraClearColor: [Int32: Bool] = [:]
nonisolated(unsafe) private var cameraClearZBuffer: [Int32: Bool] = [:]

/// Last projection result for ProjectedX/Y getters (accessed only from MainActor).
nonisolated(unsafe) private var lastProjectedX: Float = 0.0
nonisolated(unsafe) private var lastProjectedY: Float = 0.0

/// Sets the camera zoom level, affecting the field of view.
///
/// - Parameters:
///   - camera: Handle to the camera entity
///   - zoom: Zoom level (1.0 = normal, >1 = zoom in/narrower FOV, <1 = zoom out/wider FOV)
///
/// - Note: In Blitz3D, zoom > 1 narrows FOV (telephoto), zoom < 1 widens FOV (wide angle).
///         This is implemented by adjusting the camera's FOV angle.
@_cdecl("CameraZoom")
@MainActor
public func CameraZoom(_ camera: Int32, _ zoom: Float) {
    guard let entity = SceneGraph.shared.getEntity(camera) else { return }
    guard entity.type == .camera else { return }
    
    // Base FOV is 75 degrees, zoom adjusts this
    // zoom > 1 = narrower FOV (zoom in)
    // zoom < 1 = wider FOV (zoom out)
    let baseFOV: Float = 75.0
    entity.cameraFOV = baseFOV / zoom
}

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
    cameraClearColor[camera] = clsColor != 0
    cameraClearZBuffer[camera] = clsZBuffer != 0
}

/// Get clear color flag for a camera.
@MainActor
public func getCameraClearColor(_ camera: Int32) -> Bool {
    return cameraClearColor[camera] ?? true
}

/// Get clear z-buffer flag for a camera.
@MainActor
public func getCameraClearZBuffer(_ camera: Int32) -> Bool {
    return cameraClearZBuffer[camera] ?? true
}

// Note: CameraPick is implemented in Physics/PickingExports.swift

/// Returns the projected screen X coordinate from the last CameraProject call.
///
/// - Returns: X coordinate in screen space (0 to viewport width)
///
/// - Note: Only valid after a successful CameraProject call. Returns -1 if the point
///         was behind the camera. Used for positioning 2D UI elements at 3D positions.
@_cdecl("ProjectedX")
@MainActor
public func ProjectedX() -> Float {
    return lastProjectedX
}

/// Returns the projected screen Y coordinate from the last CameraProject/CameraPick call.
///
/// - Returns: Y coordinate in screen space (0 to viewport height)
///
/// - Note: Only valid after a successful CameraProject call. Returns -1 if the point
///         was behind the camera. Used for positioning 2D UI elements at 3D positions.
@_cdecl("ProjectedY")
@MainActor
public func ProjectedY() -> Float {
    return lastProjectedY
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
    guard let entity = SceneGraph.shared.getEntity(camera) else { return }
    guard entity.type == .camera else { return }
    
    // Get camera transform
    entity.updateWorldMatrix()
    let cameraWorld = entity.worldMatrix
    
    // Extract camera position from world matrix
    let cameraPos = Vec3(
        x: cameraWorld[column: 3, row: 0],
        y: cameraWorld[column: 3, row: 1],
        z: cameraWorld[column: 3, row: 2]
    )
    
    // Extract camera forward, right, up vectors from world matrix
    let cameraForward = Vec3(
        x: cameraWorld[column: 2, row: 0],
        y: cameraWorld[column: 2, row: 1],
        z: cameraWorld[column: 2, row: 2]
    )
    let cameraRight = Vec3(
        x: cameraWorld[column: 0, row: 0],
        y: cameraWorld[column: 0, row: 1],
        z: cameraWorld[column: 0, row: 2]
    )
    let cameraUp = Vec3(
        x: cameraWorld[column: 1, row: 0],
        y: cameraWorld[column: 1, row: 1],
        z: cameraWorld[column: 1, row: 2]
    )
    
    // Vector from camera to point
    let toPoint = Vec3(x: x - cameraPos.x, y: y - cameraPos.y, z: z - cameraPos.z)
    
    // Project onto camera's local axes
    let forwardDist = Vec3.dot(toPoint, cameraForward)
    let rightDist = Vec3.dot(toPoint, cameraRight)
    let upDist = Vec3.dot(toPoint, cameraUp)
    
    // Check if point is behind camera
    if forwardDist <= entity.cameraNear {
        lastProjectedX = -1.0
        lastProjectedY = -1.0
        return
    }
    
    // Calculate projection using FOV
    let fovRad = entity.cameraFOV * Float.pi / 180.0
    let tanHalfFOV = tan(fovRad / 2.0)
    
    // Normalize to screen coordinates (-1 to 1)
    let aspect = entity.cameraAspect
    let screenX = (rightDist / (forwardDist * tanHalfFOV * aspect))
    let screenY = -(upDist / (forwardDist * tanHalfFOV))
    
    // Convert to 0-1 range, then to screen pixels
    // Assuming default viewport of 800x600 for now
    let viewportWidth: Float = 800.0
    let viewportHeight: Float = 600.0
    
    lastProjectedX = (screenX + 1.0) * 0.5 * viewportWidth
    lastProjectedY = (screenY + 1.0) * 0.5 * viewportHeight
}
