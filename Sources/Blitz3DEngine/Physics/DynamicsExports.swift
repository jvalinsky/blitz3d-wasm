//
//  DynamicsExports.swift
//  Blitz3DEngine
//



// MARK: - Collision / Dynamics Exports

@_cdecl("EngineCollisions")
@MainActor
public func EngineCollisions(srcType: Int32, destType: Int32, method: Int32, response: Int32) {
    DynamicsWorld.shared.addCollision(
        srcType: srcType, destType: destType, method: method, response: response)
}

/// Clear all collision pairs and history.
@_cdecl("ClearCollisions")
@MainActor
public func ClearCollisions() {
    DynamicsWorld.shared.clearCollisions()
}

@_cdecl("EngineUpdateWorld")
@MainActor
public func EngineUpdateWorld(step: Float) {
    DynamicsWorld.shared.updateWorld(step: step)
}

@_cdecl("EngineResetEntity")
@MainActor
public func EngineResetEntity(id: Int32) {
    guard let entity = SceneGraph.shared.getEntity(id) else { return }
    entity.oldPosition = entity.localPosition
    // Also reset collision history for this entity (TODO)
}

// MARK: - Entity Collision Config

@_cdecl("EngineEntityType")
@MainActor
public func EngineEntityType(id: Int32, type: Int32) {
    guard let entity = SceneGraph.shared.getEntity(id) else { return }
    entity.collisionType = type
    DynamicsWorld.shared.registerEntity(entity)
}

@_cdecl("EngineEntityRadius")
@MainActor
public func EngineEntityRadius(id: Int32, rx: Float, ry: Float) {
    guard let entity = SceneGraph.shared.getEntity(id) else { return }
    entity.collisionRadius = Vec3(x: rx, y: ry, z: rx)
    entity.collisionMode = 1  // Sphere (default implied by EntityRadius?)
    // Actually Blitz3D differentiates by command. EntityRadius implies sphere mode usually,
    // but the mode is mainly used for how it IS collided with.
    // If we assume sphere for source:
    if entity.collisionMode == 0 { entity.collisionMode = 1 }
}

@_cdecl("EngineEntityBox")
@MainActor
public func EngineEntityBox(id: Int32, x: Float, y: Float, z: Float, w: Float, h: Float, d: Float) {
    guard let entity = SceneGraph.shared.getEntity(id) else { return }
    entity.collisionBox = AABB(min: Vec3(x: x, y: y, z: z), max: Vec3(x: x + w, y: y + h, z: z + d))
    entity.collisionMode = 3  // Box
}

@_cdecl("EngineEntityCollided")
@MainActor
public func EngineEntityCollided(id: Int32, typeIdx: Int32) -> Int32 {
    return DynamicsWorld.shared.entityCollided(id, type: typeIdx)
}

@_cdecl("EngineCountCollisions")
@MainActor
public func EngineCountCollisions(id: Int32) -> Int32 {
    return DynamicsWorld.shared.countCollisions(id)
}

@_cdecl("EngineCollisionX")
@MainActor
public func EngineCollisionX(id: Int32, index: Int32) -> Float {
    return DynamicsWorld.shared.getCollision(id, index: index)?.point.x ?? 0
}

@_cdecl("EngineCollisionY")
@MainActor
public func EngineCollisionY(id: Int32, index: Int32) -> Float {
    return DynamicsWorld.shared.getCollision(id, index: index)?.point.y ?? 0
}

@_cdecl("EngineCollisionZ")
@MainActor
public func EngineCollisionZ(id: Int32, index: Int32) -> Float {
    return DynamicsWorld.shared.getCollision(id, index: index)?.point.z ?? 0
}

@_cdecl("EngineCollisionNX")
@MainActor
public func EngineCollisionNX(id: Int32, index: Int32) -> Float {
    return DynamicsWorld.shared.getCollision(id, index: index)?.normal.x ?? 0
}

@_cdecl("EngineCollisionNY")
@MainActor
public func EngineCollisionNY(id: Int32, index: Int32) -> Float {
    return DynamicsWorld.shared.getCollision(id, index: index)?.normal.y ?? 0
}

@_cdecl("EngineCollisionNZ")
@MainActor
public func EngineCollisionNZ(id: Int32, index: Int32) -> Float {
    return DynamicsWorld.shared.getCollision(id, index: index)?.normal.z ?? 0
}

@_cdecl("EngineCollisionEntity")
@MainActor
public func EngineCollisionEntity(id: Int32, index: Int32) -> Int32 {
    return DynamicsWorld.shared.getCollision(id, index: index)?.otherEntityId ?? 0
}
