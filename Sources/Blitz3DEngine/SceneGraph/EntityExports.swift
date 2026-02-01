//
//  EntityExports.swift
//  Blitz3DEngine
//
//  Entity management functions
//

import Foundation

@_cdecl("EntityName")
@MainActor
public func EntityName(_ entity: Int32) -> Int32 {
    // Get entity name
    let name = "Entity\(entity)"
    return StringManager.shared.storeString(name)
}

@_cdecl("GetEntityType")
@MainActor
public func GetEntityType(_ entity: Int32) -> Int32 {
    // Get entity collision type
    return 0
}

@_cdecl("DeltaPitch")
@MainActor
public func DeltaPitch(_ srcEntity: Int32, _ destEntity: Int32) -> Float {
    // Get pitch difference between entities
    return 0.0
}

@_cdecl("DeltaYaw")
@MainActor
public func DeltaYaw(_ srcEntity: Int32, _ destEntity: Int32) -> Float {
    // Get yaw difference between entities
    return 0.0
}

@_cdecl("DeltaRoll")
@MainActor
public func DeltaRoll(_ srcEntity: Int32, _ destEntity: Int32) -> Float {
    // Get roll difference between entities
    return 0.0
}

@_cdecl("VectorYaw")
@MainActor
public func VectorYaw(_ x: Float, _ y: Float, _ z: Float) -> Float {
    // Get yaw angle of vector
    return atan2(x, z) * 180.0 / Float.pi
}
