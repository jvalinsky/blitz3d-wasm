

/// A bone in a skeletal hierarchy.
public struct Bone {
    public var name: String
    public var parentIndex: Int32  // -1 for root bones
    public var inverseBindMatrix: Mat4
    public var localPosition: Vec3
    public var localRotation: Quat
    public var localScale: Vec3

    public init(
        name: String = "",
        parentIndex: Int32 = -1,
        inverseBindMatrix: Mat4 = .identity,
        localPosition: Vec3 = Vec3(),
        localRotation: Quat = .identity,
        localScale: Vec3 = Vec3(x: 1, y: 1, z: 1)
    ) {
        self.name = name
        self.parentIndex = parentIndex
        self.inverseBindMatrix = inverseBindMatrix
        self.localPosition = localPosition
        self.localRotation = localRotation
        self.localScale = localScale
    }
}

/// Skeleton: a hierarchy of bones with inverse bind matrices.
/// Stores the bind-pose and provides bone palette computation.
public class Skeleton {
    public let id: Int32
    public var bones: [Bone] = []

    /// Computed bone palette (world-space bone matrices * inverse bind).
    /// Size = bones.count, each entry is a 4x4 matrix.
    public var palette: [Mat4] = []

    public init(id: Int32) {
        self.id = id
    }

    /// Add a bone to the skeleton.
    public func addBone(_ bone: Bone) -> Int32 {
        let index = Int32(bones.count)
        bones.append(bone)
        palette.append(.identity)
        return index
    }

    /// Compute the bone palette from current pose.
    /// Call after animation has updated bone local transforms.
    public func computePalette() {
        let count = bones.count
        guard count > 0 else { return }

        // First pass: compute world matrices
        var worldMatrices = [Mat4](repeating: .identity, count: count)

        for i in 0..<count {
            let bone = bones[i]
            let local = Mat4.translation(bone.localPosition.x, bone.localPosition.y, bone.localPosition.z)
                * bone.localRotation.toMat4()
                * Mat4.scale(bone.localScale.x, bone.localScale.y, bone.localScale.z)

            if bone.parentIndex >= 0 && Int(bone.parentIndex) < count {
                worldMatrices[i] = worldMatrices[Int(bone.parentIndex)] * local
            } else {
                worldMatrices[i] = local
            }
        }

        // Second pass: multiply by inverse bind to get final palette
        for i in 0..<count {
            palette[i] = worldMatrices[i] * bones[i].inverseBindMatrix
        }
    }

    /// Write the bone palette as contiguous floats (for uniform upload).
    /// Writes count * 16 floats.
    public func writePalette(to ptr: UnsafeMutablePointer<Float>) {
        for i in 0..<bones.count {
            palette[i].write(to: ptr.advanced(by: i * 16))
        }
    }
}

/// Manages skeleton allocation.
@MainActor
public class SkeletonManager {
    public static let shared = SkeletonManager()
    private var skeletons: [Int32: Skeleton] = [:]
    private var nextId: Int32 = 1

    public func createSkeleton() -> Int32 {
        let id = nextId
        nextId += 1
        skeletons[id] = Skeleton(id: id)
        return id
    }

    public func getSkeleton(_ id: Int32) -> Skeleton? {
        return skeletons[id]
    }

    public func freeSkeleton(id: Int32) {
        skeletons.removeValue(forKey: id)
    }
}
