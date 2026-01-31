

@MainActor
public class FPSController {
    public static let shared = FPSController()

    private var entityId: Int32 = 0
    private var speed: Float = 0.5
    private var camPitch: Float = 0.0
    private var camYaw: Float = 0.0

    // Sensitivity
    private let mouseSens: Float = 0.2

    public func setEntity(id: Int32) {
        self.entityId = id
    }

    public func update() {
        guard entityId != 0, let entity = SceneGraph.shared.getEntity(entityId) else { return }

        // 1. Mouse Look
        let dx = Float(InputManager.shared.mouseXSpeed)
        let dy = Float(InputManager.shared.mouseYSpeed)

        camYaw -= dx * mouseSens
        camPitch += dy * mouseSens

        // Clamp Pitch
        if camPitch > 89 { camPitch = 89 }
        if camPitch < -89 { camPitch = -89 }

        entity.localRotation = Vec3(x: camPitch, y: camYaw, z: 0)

        // 2. Movement (W/A/S/D)

        var moveZ: Float = 0
        var moveX: Float = 0

        // W or Up
        if InputManager.shared.keyDown(17) != 0 || InputManager.shared.keyDown(200) != 0 {
            moveZ += 1
        }
        // S or Down
        if InputManager.shared.keyDown(31) != 0 || InputManager.shared.keyDown(208) != 0 {
            moveZ -= 1
        }
        // A or Left
        if InputManager.shared.keyDown(30) != 0 || InputManager.shared.keyDown(203) != 0 {
            moveX -= 1
        }
        // D or Right
        if InputManager.shared.keyDown(32) != 0 || InputManager.shared.keyDown(205) != 0 {
            moveX += 1
        }

        if moveX != 0 || moveZ != 0 {
            // Local Move Vector
            // Forward is internal +Z axis

            // Forward
            let fwdX = sin(degreesToRadians(camYaw))
            let fwdZ = cos(degreesToRadians(camYaw))

            // Right (yaw + 90)
            let rightX = sin(degreesToRadians(camYaw - 90))
            let rightZ = cos(degreesToRadians(camYaw - 90))

            let mx = (fwdX * moveZ + rightX * moveX) * speed
            let mz = (fwdZ * moveZ + rightZ * moveX) * speed

            // Update Position directly (Local)
            entity.localPosition.x += mx
            entity.localPosition.z += mz

            // Mark entity as dirty so world matrix updates?
            // SceneGraph usually does this if using setter, but here we modify property directly?
            // Vec3 is value type, so entity.localPosition is updated (if struct).
            // But we need to call entity.markDirty() if we bypass setter?
            // Entity class (ref SceneGraph.swift usage) has markDirty().
            entity.markDirty()
        }
    }

    private func degreesToRadians(_ deg: Float) -> Float {
        return deg * .pi / 180.0
    }
}
