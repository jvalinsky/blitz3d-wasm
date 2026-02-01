//
//  CameraExports.swift
//  Blitz3DEngine
//
//  Camera control functions
//

import Foundation

@_cdecl("CameraClsMode")
@MainActor
public func CameraClsMode(_ camera: Int32, _ clsColor: Int32, _ clsZBuffer: Int32) {
    // Set camera clear mode
    // clsColor: 1 = clear color buffer, 0 = don't clear
    // clsZBuffer: 1 = clear depth buffer, 0 = don't clear
}

@_cdecl("CameraPick")
@MainActor
public func CameraPick(_ camera: Int32, _ x: Float, _ y: Float) -> Int32 {
    // Pick entity at screen coordinates
    // Returns entity handle or 0 if nothing picked
    return 0
}

@_cdecl("ProjectedX")
@MainActor
public func ProjectedX() -> Float {
    // Get projected X coordinate of last picked entity
    return 0.0
}

@_cdecl("ProjectedY")
@MainActor
public func ProjectedY() -> Float {
    // Get projected Y coordinate of last picked entity
    return 0.0
}

@_cdecl("CameraProject")
@MainActor
public func CameraProject(_ camera: Int32, _ x: Float, _ y: Float, _ z: Float) {
    // Project 3D point to screen coordinates
}
