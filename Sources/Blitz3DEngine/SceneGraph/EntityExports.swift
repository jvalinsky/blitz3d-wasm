//
//  EntityExports.swift
//  Blitz3DEngine
//
//  Entity management and relationship functions
//

import Foundation

/// Returns the name assigned to an entity.
///
/// - Parameter entity: Handle to the entity
///
/// - Returns: String handle containing the entity's name
///
/// - Note: Entity names are set with NameEntity and are useful for debugging,
///         identifying entities in the scene, and implementing search functionality.
@_cdecl("EntityName")
@MainActor
public func EntityName(_ entity: Int32) -> Int32 {
    let name = "Entity\(entity)"
    return StringManager.shared.storeString(name)
}

/// Returns the collision type assigned to an entity.
///
/// - Parameter entity: Handle to the entity
///
/// - Returns: Collision type integer (set by EntityType command)
///
/// - Note: Collision types control which entities can collide with each other.
///         Types are game-specific (e.g., 1=player, 2=enemy, 3=projectile, etc.).
@_cdecl("GetEntityType")
@MainActor
public func GetEntityType(_ entity: Int32) -> Int32 {
    // Will return the entity's collision type
    return 0
}

/// Calculates the pitch difference needed to look from source to destination entity.
///
/// - Parameters:
///   - srcEntity: Handle to the source entity
///   - destEntity: Handle to the destination entity
///
/// - Returns: Pitch angle in degrees (-90 to +90)
///
/// - Note: Returns the vertical angle difference. Useful for aiming, turrets,
///         and character head tracking. Positive values mean looking up,
///         negative values mean looking down.
@_cdecl("DeltaPitch")
@MainActor
public func DeltaPitch(_ srcEntity: Int32, _ destEntity: Int32) -> Float {
    // Will calculate pitch angle between entities
    return 0.0
}

/// Calculates the yaw difference needed to look from source to destination entity.
///
/// - Parameters:
///   - srcEntity: Handle to the source entity
///   - destEntity: Handle to the destination entity
///
/// - Returns: Yaw angle in degrees (-180 to +180)
///
/// - Note: Returns the horizontal angle difference. Useful for AI facing targets,
///         turret rotation, and character turning. Positive values mean turning right,
///         negative values mean turning left.
@_cdecl("DeltaYaw")
@MainActor
public func DeltaYaw(_ srcEntity: Int32, _ destEntity: Int32) -> Float {
    // Will calculate yaw angle between entities
    return 0.0
}

/// Calculates the roll difference between two entities.
///
/// - Parameters:
///   - srcEntity: Handle to the source entity
///   - destEntity: Handle to the destination entity
///
/// - Returns: Roll angle difference in degrees
///
/// - Note: Roll represents rotation around the forward axis. Less commonly used
///         than pitch/yaw but useful for aircraft, spacecraft, and certain effects.
@_cdecl("DeltaRoll")
@MainActor
public func DeltaRoll(_ srcEntity: Int32, _ destEntity: Int32) -> Float {
    // Will calculate roll angle between entities
    return 0.0
}

/// Calculates the yaw angle from a direction vector.
///
/// - Parameters:
///   - x: X component of direction vector
///   - y: Y component of direction vector
///   - z: Z component of direction vector
///
/// - Returns: Yaw angle in degrees (0-360)
///
/// - Note: Converts a 3D direction vector into a horizontal rotation angle.
///         Useful for orienting entities toward movement directions or calculating
///         angles from velocity vectors. Y component is typically ignored.
@_cdecl("VectorYaw")
@MainActor
public func VectorYaw(_ x: Float, _ y: Float, _ z: Float) -> Float {
    return atan2(x, z) * 180.0 / Float.pi
}
