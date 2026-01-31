import Foundation

/// A single keyframe for one bone.
public struct BoneKeyframe {
    public var time: Float
    public var position: Vec3
    public var rotation: Quat
    public var scale: Vec3

    public init(
        time: Float = 0,
        position: Vec3 = Vec3(),
        rotation: Quat = .identity,
        scale: Vec3 = Vec3(x: 1, y: 1, z: 1)
    ) {
        self.time = time
        self.position = position
        self.rotation = rotation
        self.scale = scale
    }
}

/// Animation track for a single bone -- a sequence of keyframes.
public struct BoneTrack {
    public var boneIndex: Int32
    public var keyframes: [BoneKeyframe]

    public init(boneIndex: Int32 = 0, keyframes: [BoneKeyframe] = []) {
        self.boneIndex = boneIndex
        self.keyframes = keyframes
    }

    /// Find the two bracketing keyframes for a given time using binary search.
    /// Returns (beforeIndex, afterIndex, t) where t is the interpolation factor.
    public func findKeyframes(at time: Float) -> (Int, Int, Float) {
        let count = keyframes.count
        guard count > 0 else { return (0, 0, 0) }
        guard count > 1 else { return (0, 0, 0) }

        // Clamp to range
        if time <= keyframes[0].time { return (0, 0, 0) }
        if time >= keyframes[count - 1].time { return (count - 1, count - 1, 0) }

        // Binary search for the interval
        var lo = 0
        var hi = count - 1
        while lo < hi - 1 {
            let mid = (lo + hi) / 2
            if keyframes[mid].time <= time {
                lo = mid
            } else {
                hi = mid
            }
        }

        let dt = keyframes[hi].time - keyframes[lo].time
        let t: Float = dt > 0 ? (time - keyframes[lo].time) / dt : 0
        return (lo, hi, t)
    }

    /// Sample the track at a given time, interpolating between keyframes.
    /// Position/scale use linear interpolation, rotation uses slerp.
    public func sample(at time: Float) -> BoneKeyframe {
        let count = keyframes.count
        guard count > 0 else { return BoneKeyframe() }
        guard count > 1 else { return keyframes[0] }

        let (lo, hi, t) = findKeyframes(at: time)
        let a = keyframes[lo]
        let b = keyframes[hi]

        return BoneKeyframe(
            time: time,
            position: Vec3(
                x: a.position.x + t * (b.position.x - a.position.x),
                y: a.position.y + t * (b.position.y - a.position.y),
                z: a.position.z + t * (b.position.z - a.position.z)
            ),
            rotation: Quat.slerp(a.rotation, b.rotation, t: t),
            scale: Vec3(
                x: a.scale.x + t * (b.scale.x - a.scale.x),
                y: a.scale.y + t * (b.scale.y - a.scale.y),
                z: a.scale.z + t * (b.scale.z - a.scale.z)
            )
        )
    }
}

/// A complete animation clip (collection of bone tracks + metadata).
public class AnimationClip {
    public let id: Int32
    public var name: String
    public var duration: Float  // In frames (Blitz3D convention)
    public var fps: Float
    public var tracks: [BoneTrack]

    public init(id: Int32, name: String = "", duration: Float = 0, fps: Float = 30) {
        self.id = id
        self.name = name
        self.duration = duration
        self.fps = fps
        self.tracks = []
    }

    /// Sample all tracks at a given time and write results to a skeleton.
    public func sample(at time: Float, skeleton: Skeleton) {
        for track in tracks {
            let idx = Int(track.boneIndex)
            guard idx >= 0 && idx < skeleton.bones.count else { continue }

            let kf = track.sample(at: time)
            skeleton.bones[idx].localPosition = kf.position
            skeleton.bones[idx].localRotation = kf.rotation
            skeleton.bones[idx].localScale = kf.scale
        }
    }
}

/// Manages animation clip allocation.
@MainActor
public class AnimationClipManager {
    public static let shared = AnimationClipManager()
    private var clips: [Int32: AnimationClip] = [:]
    private var nextId: Int32 = 1

    public func createClip(name: String = "", duration: Float = 0, fps: Float = 30) -> Int32 {
        let id = nextId
        nextId += 1
        clips[id] = AnimationClip(id: id, name: name, duration: duration, fps: fps)
        return id
    }

    public func getClip(_ id: Int32) -> AnimationClip? {
        return clips[id]
    }

    public func freeClip(id: Int32) {
        clips.removeValue(forKey: id)
    }
}
