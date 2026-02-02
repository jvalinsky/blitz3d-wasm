/// Entity types matching Blitz3D's entity system.
public enum EntityType: Int32, Sendable {
    case pivot = 0
    case mesh = 1
    case camera = 2
    case light = 3
    case sprite = 4
    case terrain = 5
}

/// Blitz3D light types.
public enum LightType: Int32, Sendable {
    case ambient = 0  // Not a real entity light; global setting
    case directional = 1
    case point = 2
    case spot = 3
}

/// Blitz3D entity FX flags.
public struct EntityFXFlags: OptionSet, Sendable {
    public let rawValue: Int32
    public init(rawValue: Int32) { self.rawValue = rawValue }

    public static let fullBright = EntityFXFlags(rawValue: 1)
    public static let vertexColor = EntityFXFlags(rawValue: 2)
    public static let flatShaded = EntityFXFlags(rawValue: 4)
    public static let disableFog = EntityFXFlags(rawValue: 8)
    public static let disableCull = EntityFXFlags(rawValue: 16)
    public static let disableZBuffer = EntityFXFlags(rawValue: 32)
}

/// Blitz3D blend modes.
public enum BlendMode: Int32, Sendable {
    case none = 0
    case alpha = 1
    case multiply = 2
    case additive = 3
}

/// A single entity in the scene graph.
///
/// Entities form a parent-child tree. Each entity has local position,
/// rotation (Euler degrees), and scale. The world matrix is lazily
/// recomputed when the dirty flag is set.
public class Entity: Equatable {
    public static func == (lhs: Entity, rhs: Entity) -> Bool {
        return lhs.id == rhs.id
    }
    public let id: Int32
    public let type: EntityType
    
    // Entity name for searching
    public var name: String = ""

    // Parent-child
    public weak var parent: Entity?
    public var children: [Entity] = []

    // Local transform (Blitz3D convention: degrees, +Z forward)
    public var localPosition = Vec3()
    public var localRotation = Vec3()  // pitch, yaw, roll in degrees
    public var localScale = Vec3(x: 1, y: 1, z: 1)

    // Cached world matrix
    public var worldMatrix = Mat4.identity
    public var dirty: Bool = true

    // Visibility
    public var visible: Bool = true
    public var order: Int32 = 0  // Render order for sorting

    // Material / appearance
    public var brushColor = Vec3(x: 1, y: 1, z: 1)
    public var alpha: Float = 1.0
    public var shininess: Float = 0.0
    public var fx: EntityFXFlags = []
    public var blend: BlendMode = .alpha
    public var textureId0: Int32 = 0
    public var textureId1: Int32 = 0
    public var textureBlend0: Int32 = 0
    public var textureBlend1: Int32 = 0

    // Mesh reference (engine MeshManager id)
    public var meshId: Int32 = 0

    // Light properties
    public var lightType: LightType = .directional
    public var lightColor = Vec3(x: 1, y: 1, z: 1)
    public var lightRange: Float = 1000.0
    public var lightInnerCone: Float = 0.0
    public var lightOuterCone: Float = 45.0

    // Camera properties
    public var cameraNear: Float = 0.1
    public var cameraFar: Float = 1000.0
    public var cameraFOV: Float = 75.0
    public var cameraAspect: Float = 1.333

    // Animation
    public var animDataId: Int32 = 0  // Reference to animation data
    public var animMode: Int32 = 0  // 0=stop, 1=loop, 2=pingpong, 3=oneshot
    public var animSpeed: Float = 1.0
    public var animTime: Float = 0.0

    // Collision
    public var collisionType: Int32 = 0
    public var collisionRadius = Vec3(x: 1, y: 1, z: 1)
    public var collisionBox = AABB()
    public var collisionMode: Int32 = 0  // 0=none, 1=sphere, 2=poly, 3=box
    public var oldPosition = Vec3()

    public init(id: Int32, type: EntityType) {
        self.id = id
        self.type = type
    }

    /// Compute the local transform matrix.
    public func localMatrix() -> Mat4 {
        let t = Mat4.translation(localPosition.x, localPosition.y, localPosition.z)
        let r = Mat4.rotationEuler(
            pitch: localRotation.x, yaw: localRotation.y, roll: localRotation.z)
        let s = Mat4.scale(localScale.x, localScale.y, localScale.z)
        return t * r * s
    }

    /// Recompute world matrix from parent chain.
    public func updateWorldMatrix() {
        let local = localMatrix()
        if let parent = parent {
            worldMatrix = parent.worldMatrix * local
        } else {
            worldMatrix = local
        }
        dirty = false
    }

    /// Mark this entity and all descendants as dirty.
    public func markDirty() {
        dirty = true
        for child in children {
            child.markDirty()
        }
    }

    /// Add a child entity.
    public func addChild(_ child: Entity) {
        child.parent?.removeChild(child)
        child.parent = self
        children.append(child)
        child.markDirty()
    }

    /// Remove a child entity.
    public func removeChild(_ child: Entity) {
        children.removeAll { $0 === child }
        child.parent = nil
    }

    /// Get world position (from world matrix column 3).
    public var worldPosition: Vec3 {
        if dirty { updateWorldMatrix() }
        return Vec3(
            x: worldMatrix[column: 3, row: 0],
            y: worldMatrix[column: 3, row: 1],
            z: worldMatrix[column: 3, row: 2]
        )
    }

    /// Get world forward direction (from world matrix column 2, negated for Blitz3D convention).
    public var worldForward: Vec3 {
        if dirty { updateWorldMatrix() }
        return Vec3(
            x: worldMatrix[column: 2, row: 0],
            y: worldMatrix[column: 2, row: 1],
            z: worldMatrix[column: 2, row: 2]
        )
    }
}
