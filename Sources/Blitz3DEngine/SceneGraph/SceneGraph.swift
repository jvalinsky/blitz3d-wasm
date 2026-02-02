/// Scene graph: manages the entity tree, allocation, and traversal.
public class SceneGraph {
    public static nonisolated(unsafe) let shared = SceneGraph()

    private var entities: [Int32: Entity] = [:]
    private var nextId: Int32 = 1

    // Scene root (entities without explicit parents are children of root)
    public let root: Entity

    // Global lighting state
    public var ambientColor = Vec3(x: 0.5, y: 0.5, z: 0.5)

    // Fog state
    public var fogMode: Int32 = 0  // 0=none, 1=linear, 2=exp, 3=exp2
    public var fogColor = Vec3()
    public var fogStart: Float = 1.0
    public var fogEnd: Float = 1000.0
    public var fogDensity: Float = 0.01

    public init() {
        root = Entity(id: 0, type: .pivot)
        root.dirty = false
    }

    // MARK: - Entity lifecycle

    public func createEntity(type: EntityType, parentId: Int32) -> Int32 {
        let id = nextId
        nextId += 1
        let entity = Entity(id: id, type: type)
        entities[id] = entity

        if parentId != 0, let parentEntity = entities[parentId] {
            parentEntity.addChild(entity)
        } else {
            root.addChild(entity)
        }

        return id
    }

    /// Swift-friendly creation helper
    public func createEntity(type: EntityType, parent: Entity? = nil) -> Entity {
        let id = nextId
        nextId += 1
        let entity = Entity(id: id, type: type)
        entities[id] = entity

        if let parent = parent {
            parent.addChild(entity)
        } else {
            root.addChild(entity)
        }

        return entity
    }

    public func freeEntity(id: Int32) {
        guard let entity = entities[id] else { return }

        // Reparent children to the freed entity's parent (or root)
        let newParent = entity.parent ?? root
        for child in entity.children {
            newParent.addChild(child)
        }

        entity.parent?.removeChild(entity)
        entities.removeValue(forKey: id)
    }

    public func getEntity(_ id: Int32) -> Entity? {
        return entities[id]
    }

    // MARK: - Transform operations

    public func setPosition(_ id: Int32, x: Float, y: Float, z: Float) {
        guard let entity = entities[id] else { return }
        entity.localPosition = Vec3(x: x, y: y, z: z)
        entity.markDirty()
    }

    public func setRotation(_ id: Int32, pitch: Float, yaw: Float, roll: Float) {
        guard let entity = entities[id] else { return }
        entity.localRotation = Vec3(x: pitch, y: yaw, z: roll)
        entity.markDirty()
    }

    public func setScale(_ id: Int32, sx: Float, sy: Float, sz: Float) {
        guard let entity = entities[id] else { return }
        entity.localScale = Vec3(x: sx, y: sy, z: sz)
        entity.markDirty()
    }

    public func moveEntity(_ id: Int32, x: Float, y: Float, z: Float) {
        guard let entity = entities[id] else { return }
        // Move in local space: transform the movement vector by the entity's rotation
        let rot = Mat4.rotationEuler(
            pitch: entity.localRotation.x,
            yaw: entity.localRotation.y,
            roll: entity.localRotation.z
        )
        // Apply rotation to movement vector
        let mx =
            rot[column: 0, row: 0] * x + rot[column: 1, row: 0] * y + rot[column: 2, row: 0] * z
        let my =
            rot[column: 0, row: 1] * x + rot[column: 1, row: 1] * y + rot[column: 2, row: 1] * z
        let mz =
            rot[column: 0, row: 2] * x + rot[column: 1, row: 2] * y + rot[column: 2, row: 2] * z
        entity.localPosition.x += mx
        entity.localPosition.y += my
        entity.localPosition.z += mz
        entity.markDirty()
    }

    public func turnEntity(_ id: Int32, pitch: Float, yaw: Float, roll: Float) {
        guard let entity = entities[id] else { return }
        entity.localRotation.x += pitch
        entity.localRotation.y += yaw
        entity.localRotation.z += roll
        entity.markDirty()
    }

    public func setParent(_ id: Int32, parentId: Int32, global: Bool = true) {
        guard let entity = entities[id] else { return }
        
        // Store world position if maintaining global position
        let worldPos = entity.worldPosition
        
        if parentId == 0 {
            if global {
                // Maintain world position when reparenting to root
                entity.localPosition = worldPos
            }
            root.addChild(entity)
        } else if let newParent = entities[parentId] {
            if global {
                // Convert world position to local space of new parent
                newParent.updateWorldMatrix()
                let parentWorld = newParent.worldMatrix
                // Extract parent world position from matrix
                let parentWorldPos = Vec3(
                    x: parentWorld[column: 3, row: 0],
                    y: parentWorld[column: 3, row: 1],
                    z: parentWorld[column: 3, row: 2]
                )
                // Simple local position calculation (ignoring parent rotation for now)
                entity.localPosition = worldPos - parentWorldPos
            }
            newParent.addChild(entity)
        }
    }
    
    public func countChildren(_ id: Int32) -> Int32 {
        guard let entity = entities[id] else { return 0 }
        return Int32(entity.children.count)
    }
    
    public func getChild(_ id: Int32, index: Int32) -> Int32 {
        guard let entity = entities[id] else { return 0 }
        let idx = Int(index)
        guard idx >= 0 && idx < entity.children.count else { return 0 }
        return entity.children[idx].id
    }
    
    public func findChild(_ id: Int32, name: String) -> Int32 {
        guard let entity = entities[id] else { return 0 }
        return findChildRecursive(entity, name: name)?.id ?? 0
    }
    
    private func findChildRecursive(_ entity: Entity, name: String) -> Entity? {
        for child in entity.children {
            if child.name == name {
                return child
            }
            if let found = findChildRecursive(child, name: name) {
                return found
            }
        }
        return nil
    }
    
    public func setEntityName(_ id: Int32, name: String) {
        guard let entity = entities[id] else { return }
        entity.name = name
    }

    // MARK: - Queries

    public func entityPosition(_ id: Int32, global: Bool) -> Vec3 {
        guard let entity = entities[id] else { return Vec3() }
        if global {
            return entity.worldPosition
        }
        return entity.localPosition
    }

    public func entityRotation(_ id: Int32, global: Bool) -> Vec3 {
        guard let entity = entities[id] else { return Vec3() }
        // For now, only local rotation is returned
        // Global rotation extraction from matrix is more complex
        return entity.localRotation
    }

    // MARK: - Appearance

    public func setEntityColor(_ id: Int32, r: Float, g: Float, b: Float) {
        guard let entity = entities[id] else { return }
        entity.brushColor = Vec3(x: r / 255.0, y: g / 255.0, z: b / 255.0)
    }

    public func setEntityAlpha(_ id: Int32, a: Float) {
        guard let entity = entities[id] else { return }
        entity.alpha = a
    }

    public func setEntityFX(_ id: Int32, fx: Int32) {
        guard let entity = entities[id] else { return }
        entity.fx = EntityFXFlags(rawValue: fx)
    }

    public func setEntityBlend(_ id: Int32, blend: Int32) {
        guard let entity = entities[id] else { return }
        entity.blend = BlendMode(rawValue: blend) ?? .alpha
    }

    public func setEntityShininess(_ id: Int32, s: Float) {
        guard let entity = entities[id] else { return }
        entity.shininess = s
    }

    public func setEntityTexture(_ id: Int32, texId: Int32, frame: Int32, index: Int32) {
        guard let entity = entities[id] else { return }
        if index == 0 {
            entity.textureId0 = texId
        } else {
            entity.textureId1 = texId
        }
    }

    public func setEntityVisibility(_ id: Int32, visible: Bool) {
        guard let entity = entities[id] else { return }
        entity.visible = visible
    }

    // MARK: - Camera

    public func setCameraRange(_ id: Int32, near: Float, far: Float) {
        guard let entity = entities[id] else { return }
        entity.cameraNear = near
        entity.cameraFar = far
    }

    public func setCameraFOV(_ id: Int32, fov: Float) {
        guard let entity = entities[id] else { return }
        entity.cameraFOV = fov
    }

    // MARK: - Light

    public func setLightType(_ id: Int32, type: Int32) {
        guard let entity = entities[id] else { return }
        entity.lightType = LightType(rawValue: type) ?? .directional
    }

    public func setLightColor(_ id: Int32, r: Float, g: Float, b: Float) {
        guard let entity = entities[id] else { return }
        entity.lightColor = Vec3(x: r / 255.0, y: g / 255.0, z: b / 255.0)
    }

    public func setLightRange(_ id: Int32, range: Float) {
        guard let entity = entities[id] else { return }
        entity.lightRange = range
    }

    // MARK: - Traversal

    /// Update all dirty world matrices in the tree.
    public func updateTransforms() {
        updateTransformsRecursive(root)
    }

    private func updateTransformsRecursive(_ entity: Entity) {
        if entity.dirty {
            entity.updateWorldMatrix()
        }
        for child in entity.children {
            updateTransformsRecursive(child)
        }
    }

    /// Collect all visible entities of a given type.
    public func collectEntities(ofType type: EntityType) -> [Entity] {
        var result: [Entity] = []
        collectRecursive(root, type: type, into: &result)
        return result
    }

    private func collectRecursive(_ entity: Entity, type: EntityType, into result: inout [Entity]) {
        if entity.type == type && entity.visible && entity.id != 0 {
            result.append(entity)
        }
        for child in entity.children {
            collectRecursive(child, type: type, into: &result)
        }
    }

    /// Collect all visible mesh entities for rendering.
    public func collectRenderables() -> [Entity] {
        var result: [Entity] = []
        collectRenderablesRecursive(root, into: &result)
        return result
    }

    private func collectRenderablesRecursive(_ entity: Entity, into result: inout [Entity]) {
        if entity.visible && entity.id != 0 {
            switch entity.type {
            case .mesh, .sprite:
                result.append(entity)
            default:
                break
            }
        }
        for child in entity.children {
            collectRenderablesRecursive(child, type: nil, into: &result)
        }
    }

    private func collectRenderablesRecursive(
        _ entity: Entity, type _: EntityType?, into result: inout [Entity]
    ) {
        if entity.visible && entity.id != 0 {
            switch entity.type {
            case .mesh, .sprite:
                result.append(entity)
            default:
                break
            }
        }
        for child in entity.children {
            collectRenderablesRecursive(child, type: nil, into: &result)
        }
    }

    /// Find the active camera (first visible camera entity).
    public func findActiveCamera() -> Entity? {
        return findFirstEntity(ofType: .camera)
    }

    private func findFirstEntity(ofType type: EntityType) -> Entity? {
        return findFirstEntityRecursive(root, type: type)
    }

    private func findFirstEntityRecursive(_ entity: Entity, type: EntityType) -> Entity? {
        if entity.type == type && entity.visible && entity.id != 0 {
            return entity
        }
        for child in entity.children {
            if let found = findFirstEntityRecursive(child, type: type) {
                return found
            }
        }
        return nil
    }

    /// Collect all visible light entities.
    public func collectLights() -> [Entity] {
        return collectEntities(ofType: .light)
    }

    /// Reset the scene graph (free all entities).
    public func reset() {
        entities.removeAll()
        root.children.removeAll()
        nextId = 1
    }
}
