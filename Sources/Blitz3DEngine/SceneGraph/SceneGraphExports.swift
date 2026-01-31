// MARK: - Scene Graph WASM Exports
// These @_cdecl functions are the WASM-callable API for the scene graph.

// MARK: Entity lifecycle

@_cdecl("EngineCreateEntity")
@MainActor
public func EngineCreateEntity(type: Int32, parent: Int32) -> Int32 {
    let entityType = EntityType(rawValue: type) ?? .pivot
    return SceneGraph.shared.createEntity(type: entityType, parentId: parent)
}

@_cdecl("EngineFreeEntity")
@MainActor
public func EngineFreeEntity(id: Int32) {
    SceneGraph.shared.freeEntity(id: id)
}

@_cdecl("EngineSetParent")
@MainActor
public func EngineSetParent(id: Int32, parent: Int32) {
    SceneGraph.shared.setParent(id, parentId: parent)
}

// MARK: Transform setters

@_cdecl("EngineSetPosition")
@MainActor
public func EngineSetPosition(id: Int32, x: Float, y: Float, z: Float) {
    SceneGraph.shared.setPosition(id, x: x, y: y, z: z)
}

@_cdecl("EngineSetRotation")
@MainActor
public func EngineSetRotation(id: Int32, pitch: Float, yaw: Float, roll: Float) {
    SceneGraph.shared.setRotation(id, pitch: pitch, yaw: yaw, roll: roll)
}

@_cdecl("EngineSetScale")
@MainActor
public func EngineSetScale(id: Int32, sx: Float, sy: Float, sz: Float) {
    SceneGraph.shared.setScale(id, sx: sx, sy: sy, sz: sz)
}

@_cdecl("EngineMoveEntity")
@MainActor
public func EngineMoveEntity(id: Int32, x: Float, y: Float, z: Float) {
    SceneGraph.shared.moveEntity(id, x: x, y: y, z: z)
}

@_cdecl("EngineTurnEntity")
@MainActor
public func EngineTurnEntity(id: Int32, pitch: Float, yaw: Float, roll: Float) {
    SceneGraph.shared.turnEntity(id, pitch: pitch, yaw: yaw, roll: roll)
}

// MARK: Transform getters

@_cdecl("EngineEntityX")
@MainActor
public func EngineEntityX(id: Int32, global: Int32) -> Float {
    return SceneGraph.shared.entityPosition(id, global: global != 0).x
}

@_cdecl("EngineEntityY")
@MainActor
public func EngineEntityY(id: Int32, global: Int32) -> Float {
    return SceneGraph.shared.entityPosition(id, global: global != 0).y
}

@_cdecl("EngineEntityZ")
@MainActor
public func EngineEntityZ(id: Int32, global: Int32) -> Float {
    return SceneGraph.shared.entityPosition(id, global: global != 0).z
}

@_cdecl("EngineEntityPitch")
@MainActor
public func EngineEntityPitch(id: Int32, global: Int32) -> Float {
    return SceneGraph.shared.entityRotation(id, global: global != 0).x
}

@_cdecl("EngineEntityYaw")
@MainActor
public func EngineEntityYaw(id: Int32, global: Int32) -> Float {
    return SceneGraph.shared.entityRotation(id, global: global != 0).y
}

@_cdecl("EngineEntityRoll")
@MainActor
public func EngineEntityRoll(id: Int32, global: Int32) -> Float {
    return SceneGraph.shared.entityRotation(id, global: global != 0).z
}

// MARK: Appearance

@_cdecl("EngineEntityColor")
@MainActor
public func EngineEntityColor(id: Int32, r: Float, g: Float, b: Float) {
    SceneGraph.shared.setEntityColor(id, r: r, g: g, b: b)
}

@_cdecl("EngineEntityAlpha")
@MainActor
public func EngineEntityAlpha(id: Int32, a: Float) {
    SceneGraph.shared.setEntityAlpha(id, a: a)
}

@_cdecl("EngineEntityFX")
@MainActor
public func EngineEntityFX(id: Int32, fx: Int32) {
    SceneGraph.shared.setEntityFX(id, fx: fx)
}

@_cdecl("EngineEntityBlend")
@MainActor
public func EngineEntityBlend(id: Int32, blend: Int32) {
    SceneGraph.shared.setEntityBlend(id, blend: blend)
}

@_cdecl("EngineEntityShininess")
@MainActor
public func EngineEntityShininess(id: Int32, s: Float) {
    SceneGraph.shared.setEntityShininess(id, s: s)
}

@_cdecl("EngineEntityTexture")
@MainActor
public func EngineEntityTexture(id: Int32, texId: Int32, frame: Int32, index: Int32) {
    SceneGraph.shared.setEntityTexture(id, texId: texId, frame: frame, index: index)
}

@_cdecl("EngineShowEntity")
@MainActor
public func EngineShowEntity(id: Int32) {
    SceneGraph.shared.setEntityVisibility(id, visible: true)
}

@_cdecl("EngineHideEntity")
@MainActor
public func EngineHideEntity(id: Int32) {
    SceneGraph.shared.setEntityVisibility(id, visible: false)
}

// MARK: Camera

@_cdecl("EngineCameraRange")
@MainActor
public func EngineCameraRange(camId: Int32, near: Float, far: Float) {
    SceneGraph.shared.setCameraRange(camId, near: near, far: far)
}

@_cdecl("EngineCameraFOV")
@MainActor
public func EngineCameraFOV(camId: Int32, fov: Float) {
    SceneGraph.shared.setCameraFOV(camId, fov: fov)
}

// MARK: Lighting

@_cdecl("EngineAmbientLight")
@MainActor
public func EngineAmbientLight(r: Float, g: Float, b: Float) {
    SceneGraph.shared.ambientColor = Vec3(x: r / 255.0, y: g / 255.0, z: b / 255.0)
}

@_cdecl("EngineLightColor")
@MainActor
public func EngineLightColor(id: Int32, r: Float, g: Float, b: Float) {
    SceneGraph.shared.setLightColor(id, r: r, g: g, b: b)
}

@_cdecl("EngineLightRange")
@MainActor
public func EngineLightRange(id: Int32, range: Float) {
    SceneGraph.shared.setLightRange(id, range: range)
}

// MARK: Fog

@_cdecl("EngineFogMode")
@MainActor
public func EngineFogMode(mode: Int32) {
    SceneGraph.shared.fogMode = mode
}

@_cdecl("EngineFogColor")
@MainActor
public func EngineFogColor(r: Float, g: Float, b: Float) {
    SceneGraph.shared.fogColor = Vec3(x: r / 255.0, y: g / 255.0, z: b / 255.0)
}

@_cdecl("EngineFogRange")
@MainActor
public func EngineFogRange(start: Float, end: Float) {
    SceneGraph.shared.fogStart = start
    SceneGraph.shared.fogEnd = end
}

@_cdecl("EngineFogDensity")
@MainActor
public func EngineFogDensity(density: Float) {
    SceneGraph.shared.fogDensity = density
}

// MARK: Scene management

@_cdecl("EngineUpdateTransforms")
@MainActor
public func EngineUpdateTransforms() {
    SceneGraph.shared.updateTransforms()
}

@_cdecl("EngineResetScene")
@MainActor
public func EngineResetScene() {
    SceneGraph.shared.reset()
}

// MARK: World matrix readback

/// Write the 4x4 world matrix for an entity into a buffer at the given pointer.
/// Returns 1 on success, 0 if entity not found.
@_cdecl("EngineGetWorldMatrix")
@MainActor
public func EngineGetWorldMatrix(id: Int32, outPtr: Int32) -> Int32 {
    guard let entity = SceneGraph.shared.getEntity(id) else { return 0 }
    if entity.dirty { entity.updateWorldMatrix() }
    let ptr = UnsafeMutablePointer<Float>(bitPattern: UInt(outPtr))
    guard let p = ptr else { return 0 }
    entity.worldMatrix.write(to: p)
    return 1
}
