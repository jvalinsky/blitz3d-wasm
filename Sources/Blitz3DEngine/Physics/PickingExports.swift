import Foundation

// MARK: - Picking System

/// Last picking result storage (accessed only from MainActor).
nonisolated(unsafe) private var lastPickedEntity: Int32 = 0
nonisolated(unsafe) private var lastPickedX: Float = 0.0
nonisolated(unsafe) private var lastPickedY: Float = 0.0
nonisolated(unsafe) private var lastPickedZ: Float = 0.0
nonisolated(unsafe) private var lastPickedNX: Float = 0.0
nonisolated(unsafe) private var lastPickedNY: Float = 0.0
nonisolated(unsafe) private var lastPickedNZ: Float = 0.0

/// Performs a ray-pick from the camera through screen coordinates.
@_cdecl("CameraPick")
@MainActor
public func CameraPick(_ camera: Int32, _ x: Float, _ y: Float) -> Int32 {
    guard let camEntity = SceneGraph.shared.getEntity(camera),
          camEntity.type == .camera else { return 0 }
    
    // For now, return 0 - full implementation needs triangle raycast
    // This stub allows SCPCB to compile and run
    lastPickedEntity = 0
    lastPickedX = 0
    lastPickedY = 0
    lastPickedZ = 0
    lastPickedNX = 0
    lastPickedNY = 1
    lastPickedNZ = 0
    
    return 0
}

/// Performs a ray-pick from an entity's position in its forward direction.
@_cdecl("EntityPick")
@MainActor
public func EntityPick(_ entity: Int32, _ range: Float) -> Int32 {
    guard SceneGraph.shared.getEntity(entity) != nil else { return 0 }
    
    // For now, return 0 - full implementation needs triangle raycast
    lastPickedEntity = 0
    lastPickedX = 0
    lastPickedY = 0
    lastPickedZ = 0
    lastPickedNX = 0
    lastPickedNY = 1
    lastPickedNZ = 0
    
    return 0
}

/// Returns the entity handle from the last pick operation.
@_cdecl("PickedEntity")
@MainActor
public func PickedEntity() -> Int32 {
    return lastPickedEntity
}

/// Returns the X coordinate of the last pick position.
@_cdecl("PickedX")
@MainActor
public func PickedX() -> Float {
    return lastPickedX
}

/// Returns the Y coordinate of the last pick position.
@_cdecl("PickedY")
@MainActor
public func PickedY() -> Float {
    return lastPickedY
}

/// Returns the Z coordinate of the last pick position.
@_cdecl("PickedZ")
@MainActor
public func PickedZ() -> Float {
    return lastPickedZ
}

/// Returns the X normal from the last pick operation.
@_cdecl("PickedNX")
@MainActor
public func PickedNX() -> Float {
    return lastPickedNX
}

/// Returns the Y normal from the last pick operation.
@_cdecl("PickedNY")
@MainActor
public func PickedNY() -> Float {
    return lastPickedNY
}

/// Returns the Z normal from the last pick operation.
@_cdecl("PickedNZ")
@MainActor
public func PickedNZ() -> Float {
    return lastPickedNZ
}

/// Returns the time/distance of the last pick operation.
@_cdecl("PickedTime")
@MainActor
public func PickedTime() -> Float {
    // Return distance to hit point
    return 0.0
}
