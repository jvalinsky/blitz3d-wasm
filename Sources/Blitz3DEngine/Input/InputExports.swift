import Foundation

@_cdecl("EngineUpdateInput")
@MainActor
public func EngineUpdateInput(
    mouseX: Int32,
    mouseY: Int32,
    mouseZ: Int32,
    buttons: Int32,
    keysPtr: Int32
) {
    // Access memory at keysPtr
    // Assuming keysPtr points to a 256-byte array in WASM memory
    // In Swift WASM, we can access memory via UnsafeBufferPointer?
    // Actually, we usually need the memory exports.
    // However, if we are INSIDE WASM, pointers are just integers.
    // We can reconstruct a pointer.

    guard let ptr = UnsafePointer<UInt8>(bitPattern: Int(keysPtr)) else { return }
    let buffer = UnsafeBufferPointer(start: ptr, count: 256)
    let keyArray = Array(buffer)

    InputManager.shared.update(
        keys: keyArray,
        mouseX: mouseX,
        mouseY: mouseY,
        mouseZ: mouseZ,
        buttons: buttons
    )
}

@_cdecl("EngineKeyDown")
@MainActor
public func EngineKeyDown(key: Int32) -> Int32 {
    return InputManager.shared.keyDown(Int(key))
}

@_cdecl("EngineKeyHit")
@MainActor
public func EngineKeyHit(key: Int32) -> Int32 {
    return InputManager.shared.keyHit(Int(key))
}

@_cdecl("EngineMouseDown")
@MainActor
public func EngineMouseDown(btn: Int32) -> Int32 {
    return InputManager.shared.mouseDown(Int(btn))
}

@_cdecl("EngineMouseHit")
@MainActor
public func EngineMouseHit(btn: Int32) -> Int32 {
    return InputManager.shared.mouseHit(Int(btn))
}

@_cdecl("EngineMouseX")
@MainActor
public func EngineMouseX() -> Int32 {
    return InputManager.shared.mouseX
}

@_cdecl("EngineMouseY")
@MainActor
public func EngineMouseY() -> Int32 {
    return InputManager.shared.mouseY
}

@_cdecl("EngineMouseZ")
@MainActor
public func EngineMouseZ() -> Int32 {
    return InputManager.shared.mouseZ
}

@_cdecl("EngineMouseXSpeed")
@MainActor
public func EngineMouseXSpeed() -> Int32 {
    return InputManager.shared.mouseXSpeed
}

@_cdecl("EngineMouseYSpeed")
@MainActor
public func EngineMouseYSpeed() -> Int32 {
    return InputManager.shared.mouseYSpeed
}

@_cdecl("EngineMouseZSpeed")
@MainActor
public func EngineMouseZSpeed() -> Int32 {
    return InputManager.shared.mouseZSpeed
}

@_cdecl("EngineFlushKeys")
@MainActor
public func EngineFlushKeys() {
    InputManager.shared.flushKeys()
}

@_cdecl("EngineFlushMouse")
@MainActor
public func EngineFlushMouse() {
    InputManager.shared.flushMouse()
}
