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

// MARK: - Entity enumeration for rendering

/// Collect visible renderable entity IDs into a buffer. Returns the count written.
@_cdecl("EngineCollectRenderables")
@MainActor
public func EngineCollectRenderables(outPtr: Int32, maxCount: Int32) -> Int32 {
    let renderables = SceneGraph.shared.collectRenderables()
    let count = min(Int(maxCount), renderables.count)
    guard let ptr = UnsafeMutablePointer<Int32>(bitPattern: UInt(outPtr)) else { return 0 }
    for i in 0..<count {
        ptr[i] = renderables[i].id
    }
    return Int32(count)
}

/// Collect visible light entity IDs into a buffer. Returns the count written.
@_cdecl("EngineCollectLights")
@MainActor
public func EngineCollectLights(outPtr: Int32, maxCount: Int32) -> Int32 {
    let lights = SceneGraph.shared.collectLights()
    let count = min(Int(maxCount), lights.count)
    guard let ptr = UnsafeMutablePointer<Int32>(bitPattern: UInt(outPtr)) else { return 0 }
    for i in 0..<count {
        ptr[i] = lights[i].id
    }
    return Int32(count)
}

/// Get the first visible camera entity ID, or 0 if none.
@_cdecl("EngineGetActiveCameraId")
@MainActor
public func EngineGetActiveCameraId() -> Int32 {
    return SceneGraph.shared.findActiveCamera()?.id ?? 0
}

// MARK: - Per-entity property getters for rendering

@_cdecl("EngineGetEntityType")
@MainActor
public func EngineGetEntityType(id: Int32) -> Int32 {
    guard let entity = SceneGraph.shared.getEntity(id) else { return 0 }
    return entity.type.rawValue
}

@_cdecl("EngineGetEntityMeshId")
@MainActor
public func EngineGetEntityMeshId(id: Int32) -> Int32 {
    guard let entity = SceneGraph.shared.getEntity(id) else { return 0 }
    return entity.meshId
}

@_cdecl("EngineSetEntityMesh")
@MainActor
public func EngineSetEntityMesh(id: Int32, meshId: Int32) {
    guard let entity = SceneGraph.shared.getEntity(id) else { return }
    entity.meshId = meshId
}

/// Write brush color (3 floats: r, g, b) to the output buffer.
@_cdecl("EngineGetEntityBrushColor")
@MainActor
public func EngineGetEntityBrushColor(id: Int32, outPtr: Int32) {
    guard let entity = SceneGraph.shared.getEntity(id) else { return }
    guard let ptr = UnsafeMutablePointer<Float>(bitPattern: UInt(outPtr)) else { return }
    ptr[0] = entity.brushColor.x
    ptr[1] = entity.brushColor.y
    ptr[2] = entity.brushColor.z
}

@_cdecl("EngineGetEntityAlpha")
@MainActor
public func EngineGetEntityAlpha(id: Int32) -> Float {
    guard let entity = SceneGraph.shared.getEntity(id) else { return 1.0 }
    return entity.alpha
}

@_cdecl("EngineGetEntityFX")
@MainActor
public func EngineGetEntityFX(id: Int32) -> Int32 {
    guard let entity = SceneGraph.shared.getEntity(id) else { return 0 }
    return entity.fx.rawValue
}

@_cdecl("EngineGetEntityBlend")
@MainActor
public func EngineGetEntityBlend(id: Int32) -> Int32 {
    guard let entity = SceneGraph.shared.getEntity(id) else { return 1 }
    return entity.blend.rawValue
}

@_cdecl("EngineGetEntityShininess")
@MainActor
public func EngineGetEntityShininess(id: Int32) -> Float {
    guard let entity = SceneGraph.shared.getEntity(id) else { return 0 }
    return entity.shininess
}

@_cdecl("EngineGetEntityTextureId")
@MainActor
public func EngineGetEntityTextureId(id: Int32, slot: Int32) -> Int32 {
    guard let entity = SceneGraph.shared.getEntity(id) else { return 0 }
    return slot == 0 ? entity.textureId0 : entity.textureId1
}

@_cdecl("EngineGetEntityTextureBlend")
@MainActor
public func EngineGetEntityTextureBlend(id: Int32, slot: Int32) -> Int32 {
    guard let entity = SceneGraph.shared.getEntity(id) else { return 0 }
    return slot == 0 ? entity.textureBlend0 : entity.textureBlend1
}

@_cdecl("EngineGetEntityOrder")
@MainActor
public func EngineGetEntityOrder(id: Int32) -> Int32 {
    guard let entity = SceneGraph.shared.getEntity(id) else { return 0 }
    return entity.order
}

// MARK: - Light property getters

@_cdecl("EngineGetLightType")
@MainActor
public func EngineGetLightType(id: Int32) -> Int32 {
    guard let entity = SceneGraph.shared.getEntity(id) else { return 0 }
    return entity.lightType.rawValue
}

/// Write light color (3 floats: r, g, b) to the output buffer.
@_cdecl("EngineGetLightColor")
@MainActor
public func EngineGetLightColor(id: Int32, outPtr: Int32) {
    guard let entity = SceneGraph.shared.getEntity(id) else { return }
    guard let ptr = UnsafeMutablePointer<Float>(bitPattern: UInt(outPtr)) else { return }
    ptr[0] = entity.lightColor.x
    ptr[1] = entity.lightColor.y
    ptr[2] = entity.lightColor.z
}

@_cdecl("EngineGetLightRange")
@MainActor
public func EngineGetLightRange(id: Int32) -> Float {
    guard let entity = SceneGraph.shared.getEntity(id) else { return 0 }
    return entity.lightRange
}

/// Write light cone angles (2 floats: inner, outer) to the output buffer.
@_cdecl("EngineGetLightCones")
@MainActor
public func EngineGetLightCones(id: Int32, outPtr: Int32) {
    guard let entity = SceneGraph.shared.getEntity(id) else { return }
    guard let ptr = UnsafeMutablePointer<Float>(bitPattern: UInt(outPtr)) else { return }
    ptr[0] = entity.lightInnerCone
    ptr[1] = entity.lightOuterCone
}

// MARK: - Camera property getter

/// Write camera params (4 floats: fov, near, far, aspect) to the output buffer.
@_cdecl("EngineGetCameraParams")
@MainActor
public func EngineGetCameraParams(id: Int32, outPtr: Int32) {
    guard let entity = SceneGraph.shared.getEntity(id) else { return }
    guard let ptr = UnsafeMutablePointer<Float>(bitPattern: UInt(outPtr)) else { return }
    ptr[0] = entity.cameraFOV
    ptr[1] = entity.cameraNear
    ptr[2] = entity.cameraFar
    ptr[3] = entity.cameraAspect
}

// MARK: - Global state getters

/// Write fog state (8 floats: mode, r, g, b, start, end, density, padding) to the output buffer.
@_cdecl("EngineGetFogState")
@MainActor
public func EngineGetFogState(outPtr: Int32) {
    guard let ptr = UnsafeMutablePointer<Float>(bitPattern: UInt(outPtr)) else { return }
    let sg = SceneGraph.shared
    ptr[0] = Float(sg.fogMode)
    ptr[1] = sg.fogColor.x
    ptr[2] = sg.fogColor.y
    ptr[3] = sg.fogColor.z
    ptr[4] = sg.fogStart
    ptr[5] = sg.fogEnd
    ptr[6] = sg.fogDensity
    ptr[7] = 0 // padding
}

/// Write ambient color (3 floats: r, g, b) to the output buffer.
@_cdecl("EngineGetAmbientColor")
@MainActor
public func EngineGetAmbientColor(outPtr: Int32) {
    guard let ptr = UnsafeMutablePointer<Float>(bitPattern: UInt(outPtr)) else { return }
    let sg = SceneGraph.shared
    ptr[0] = sg.ambientColor.x
    ptr[1] = sg.ambientColor.y
    ptr[2] = sg.ambientColor.z
}

// MARK: - Light type setter (was missing from exports)

@_cdecl("EngineSetLightType")
@MainActor
public func EngineSetLightType(id: Int32, type: Int32) {
    SceneGraph.shared.setLightType(id, type: type)
}

/// Set light cone angles for spot lights.
@_cdecl("EngineSetLightCones")
@MainActor
public func EngineSetLightCones(id: Int32, inner: Float, outer: Float) {
    guard let entity = SceneGraph.shared.getEntity(id) else { return }
    entity.lightInnerCone = inner
    entity.lightOuterCone = outer
}

/// Set camera aspect ratio.
@_cdecl("EngineCameraAspect")
@MainActor
public func EngineCameraAspect(camId: Int32, aspect: Float) {
    guard let entity = SceneGraph.shared.getEntity(camId) else { return }
    entity.cameraAspect = aspect
}
