

// These exports allow scripts/runtime to call WASM to trigger audio logic if needed,
// but primarily we expect the Game Logic (Swift) to call AudioManager directly.
// However, legacy Blitz3D commands like `LoadSound` in basic scripts might eventually
// map to these if we move the script runner to WASM.
// For now, allow "Script" calls.

@_cdecl("EngineLoadSound")
@MainActor
public func EngineLoadSound(_ pathPtr: Int32) -> Int32 {
    // Read string from memory at pathPtr
    guard let str = String(validatingCString: UnsafePointer<CChar>(bitPattern: Int(pathPtr))!)
    else {
        return 0
    }
    return AudioManager.shared.loadSound(str)
}

@_cdecl("EnginePlaySound")
@MainActor
public func EnginePlaySound(_ soundId: Int32) -> Int32 {
    return AudioManager.shared.playSound(soundId)
}

@_cdecl("EngineFreeSound")
@MainActor
public func EngineFreeSound(_ soundId: Int32) {
    AudioManager.shared.freeSound(soundId)
}
