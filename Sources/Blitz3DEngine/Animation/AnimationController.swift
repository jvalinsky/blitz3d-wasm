

/// Blitz3D animation modes.
public enum AnimMode: Int32 {
    case stop = 0
    case loop = 1
    case pingPong = 2
    case oneShot = 3
}

/// Controls animation playback for a single entity.
/// Handles mode (stop/loop/pingpong/oneshot), speed, timing, and
/// sequence selection.
public class AnimationController {
    public var skeletonId: Int32 = 0
    public var clipId: Int32 = 0
    public var mode: AnimMode = .stop
    public var speed: Float = 1.0
    public var time: Float = 0.0
    public var playing: Bool = false

    // Sequence support (Blitz3D allows sub-ranges of animations)
    public var seqStart: Float = 0
    public var seqEnd: Float = 0

    // Transition blending (for smooth animation changes)
    public var transitionTime: Float = 0
    public var transitionDuration: Float = 0
    public var previousClipId: Int32 = 0
    public var previousTime: Float = 0

    private var direction: Float = 1.0  // 1.0 forward, -1.0 backward (for ping-pong)

    public init() {}

    /// Start animation with given mode.
    public func animate(mode: Int32, speed: Float, sequence: Int32, transition: Float) {
        self.mode = AnimMode(rawValue: mode) ?? .stop
        self.speed = speed
        self.playing = mode != 0

        if mode == 0 {
            return
        }

        // Reset time for new animation
        self.time = seqStart
        self.direction = 1.0

        if transition > 0 {
            self.transitionDuration = transition
            self.transitionTime = 0
        }
    }

    /// Advance animation by one frame tick (deltaTime in seconds).
    /// Returns true if the animation is still playing.
    @discardableResult
    public func update(deltaTime: Float) -> Bool {
        guard playing && mode != .stop else { return false }

        let duration = seqEnd - seqStart
        guard duration > 0 else { return false }

        time += speed * direction * deltaTime

        // Update transition
        if transitionDuration > 0 {
            transitionTime += deltaTime
            if transitionTime >= transitionDuration {
                transitionDuration = 0
                transitionTime = 0
            }
        }

        switch mode {
        case .loop:
            if time >= seqEnd {
                time = seqStart + (time - seqEnd).truncatingRemainder(dividingBy: duration)
            } else if time < seqStart {
                time = seqEnd - (seqStart - time).truncatingRemainder(dividingBy: duration)
            }

        case .pingPong:
            if time >= seqEnd {
                time = seqEnd - (time - seqEnd)
                direction = -1.0
            } else if time <= seqStart {
                time = seqStart + (seqStart - time)
                direction = 1.0
            }

        case .oneShot:
            if time >= seqEnd {
                time = seqEnd
                playing = false
            }

        case .stop:
            break
        }

        return playing
    }

    /// Apply the current animation state to a skeleton.
    @MainActor
    public func apply() {
        guard let skeleton = SkeletonManager.shared.getSkeleton(skeletonId),
              let clip = AnimationClipManager.shared.getClip(clipId) else { return }

        if transitionDuration > 0 && previousClipId != 0 {
            // Blended transition
            if let prevClip = AnimationClipManager.shared.getClip(previousClipId) {
                let blendFactor = transitionTime / transitionDuration

                // Sample previous pose
                prevClip.sample(at: previousTime, skeleton: skeleton)
                let prevBones = skeleton.bones

                // Sample current pose
                clip.sample(at: time, skeleton: skeleton)

                // Blend
                for i in 0..<skeleton.bones.count {
                    let t = blendFactor
                    skeleton.bones[i].localPosition = Vec3(
                        x: prevBones[i].localPosition.x + t * (skeleton.bones[i].localPosition.x - prevBones[i].localPosition.x),
                        y: prevBones[i].localPosition.y + t * (skeleton.bones[i].localPosition.y - prevBones[i].localPosition.y),
                        z: prevBones[i].localPosition.z + t * (skeleton.bones[i].localPosition.z - prevBones[i].localPosition.z)
                    )
                    skeleton.bones[i].localRotation = Quat.slerp(
                        prevBones[i].localRotation,
                        skeleton.bones[i].localRotation,
                        t: t
                    )
                }
            }
        } else {
            clip.sample(at: time, skeleton: skeleton)
        }

        skeleton.computePalette()
    }
}

// MARK: - WASM exports for animation

@_cdecl("EngineSetAnimData")
@MainActor
public func EngineSetAnimData(entityId: Int32, boneCount: Int32, frameCount: Int32, fps: Float) {
    guard let entity = SceneGraph.shared.getEntity(entityId) else { return }
    // Create skeleton and clip for this entity
    let skelId = SkeletonManager.shared.createSkeleton()
    let clipId = AnimationClipManager.shared.createClip(
        duration: Float(frameCount),
        fps: fps
    )
    entity.animDataId = skelId  // Store skeleton reference
    // Clip association would be stored in a controller map
    _ = clipId
}

@_cdecl("EngineAnimate")
@MainActor
public func EngineAnimate(entityId: Int32, mode: Int32, speed: Float, seq: Int32, trans: Float) {
    guard let entity = SceneGraph.shared.getEntity(entityId) else { return }
    entity.animMode = mode
    entity.animSpeed = speed
}

@_cdecl("EngineAnimTime")
@MainActor
public func EngineAnimTime(entityId: Int32) -> Float {
    guard let entity = SceneGraph.shared.getEntity(entityId) else { return 0 }
    return entity.animTime
}

@_cdecl("EngineAnimating")
@MainActor
public func EngineAnimating(entityId: Int32) -> Int32 {
    guard let entity = SceneGraph.shared.getEntity(entityId) else { return 0 }
    return entity.animMode != 0 ? 1 : 0
}
