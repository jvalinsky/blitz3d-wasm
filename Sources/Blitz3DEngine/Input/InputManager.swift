

@MainActor
public class InputManager {
    public static let shared = InputManager()

    // Keyboard State
    // using 256 keys for standard ASCII + basic control codes
    private var keysDown: [Bool] = Array(repeating: false, count: 256)

    // Hit counts track how many times a key was pressed since last check
    // In Blitz3D, KeyHit() clears the count.
    // For simplicity, we can accumulate hits, and clear when read?
    // Or clear at end of frame? Blitz3D documentation: "returns the number of times... since the last call"
    // So we need distinct counters that decrement/reset on read.
    private var keysHit: [Int] = Array(repeating: 0, count: 256)

    // Mouse State
    private var mouseDown: [Bool] = Array(repeating: false, count: 4)  // 1=Left, 2=Right, 3=Middle
    private var mouseHit: [Int] = Array(repeating: 0, count: 4)

    public var mouseX: Int32 = 0
    public var mouseY: Int32 = 0
    public var mouseZ: Int32 = 0

    public var mouseXSpeed: Int32 = 0
    public var mouseYSpeed: Int32 = 0
    public var mouseZSpeed: Int32 = 0

    private var lastMouseX: Int32 = 0
    private var lastMouseY: Int32 = 0
    private var lastMouseZ: Int32 = 0

    public func update(keys: [UInt8], mouseX: Int32, mouseY: Int32, mouseZ: Int32, buttons: Int32) {
        // Update Mouse
        self.mouseXSpeed = mouseX - self.lastMouseX
        self.mouseYSpeed = mouseY - self.lastMouseY
        self.mouseZSpeed = mouseZ - self.lastMouseZ

        self.lastMouseX = mouseX
        self.lastMouseY = mouseY
        self.lastMouseZ = mouseZ

        self.mouseX = mouseX
        self.mouseY = mouseY
        self.mouseZ = mouseZ

        // Update Mouse Buttons (1=Left, 2=Right, 4=Middle bitmask)
        updateMouseButton(index: 1, pressed: (buttons & 1) != 0)
        updateMouseButton(index: 2, pressed: (buttons & 2) != 0)
        updateMouseButton(index: 3, pressed: (buttons & 4) != 0)

        // Update Keys
        // keys is a pointer/array of 256 bytes (0 or 1)
        for (i, state) in keys.enumerated() {
            if i >= 256 { break }
            let isDown = state != 0

            if isDown && !keysDown[i] {
                keysHit[i] += 1
            }
            keysDown[i] = isDown
        }
    }

    private func updateMouseButton(index: Int, pressed: Bool) {
        if index >= 4 { return }
        if pressed && !mouseDown[index] {
            mouseHit[index] += 1
        }
        mouseDown[index] = pressed
    }

    // MARK: - Queries

    public func keyDown(_ key: Int) -> Int32 {
        guard key >= 0 && key < 256 else { return 0 }
        return keysDown[key] ? 1 : 0
    }

    public func keyHit(_ key: Int) -> Int32 {
        guard key >= 0 && key < 256 else { return 0 }
        let hits = keysHit[key]
        keysHit[key] = 0  // Reset on read
        return Int32(hits)
    }

    public func mouseDown(_ btn: Int) -> Int32 {
        guard btn >= 0 && btn < 4 else { return 0 }
        return mouseDown[btn] ? 1 : 0
    }

    public func mouseHit(_ btn: Int) -> Int32 {
        guard btn >= 0 && btn < 4 else { return 0 }
        let hits = mouseHit[btn]
        mouseHit[btn] = 0
        return Int32(hits)
    }

    public func flushKeys() {
        keysDown = Array(repeating: false, count: 256)
        keysHit = Array(repeating: 0, count: 256)
    }

    public func flushMouse() {
        mouseDown = Array(repeating: false, count: 4)
        mouseHit = Array(repeating: 0, count: 4)
    }
}
