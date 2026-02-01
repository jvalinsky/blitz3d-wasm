// WasmEntry.swift
// Entry point for WASM engine
// Forces exports to be retained by referencing them

import Blitz3DEngine

// Mark all @_cdecl functions as used so they're exported
@_silgen_name("_start")
public func _start() {
    // This ensures the compiler doesn't strip the exports
    // We don't actually call these - just reference them
}

// Explicitly mark for export using Swift's C-decl mechanism
// This ensures WASM exports are generated
// All marked @MainActor since engine functions use MainActor

@_cdecl("wasm_CreateBank")
@MainActor
public func wasm_CreateBank(_ size: Int32) -> Int32 {
    return CreateBank(size: size)
}

@_cdecl("wasm_FreeBank")
@MainActor
public func wasm_FreeBank(_ id: Int32) {
    FreeBank(id: id)
}

@_cdecl("wasm_BankSize")
@MainActor
public func wasm_BankSize(_ id: Int32) -> Int32 {
    return BankSize(id: id)
}

@_cdecl("wasm_PeekByte")
@MainActor
public func wasm_PeekByte(_ id: Int32, _ offset: Int32) -> Int32 {
    return PeekByte(id: id, offset: offset)
}

@_cdecl("wasm_PokeByte")
@MainActor
public func wasm_PokeByte(_ id: Int32, _ offset: Int32, _ value: Int32) {
    PokeByte(id: id, offset: offset, value: value)
}

@_cdecl("wasm_Sin")
@MainActor
public func wasm_Sin(_ angle: Float) -> Float {
    return Sin(angle)
}

@_cdecl("wasm_Cos")
@MainActor
public func wasm_Cos(_ angle: Float) -> Float {
    return Cos(angle)
}

@_cdecl("wasm_Sqrt")
@MainActor
public func wasm_Sqrt(_ value: Float) -> Float {
    return Sqrt(value)
}

// Memory allocation exports
@_cdecl("wasm_malloc")
public func wasm_malloc(_ size: Int32) -> Int32 {
    // Use Swift's allocator
    let ptr = UnsafeMutableRawPointer.allocate(byteCount: Int(size), alignment: 8)
    return Int32(UInt(bitPattern: ptr))
}

@_cdecl("wasm_free")
public func wasm_free(_ ptr: Int32) {
    let pointer = UnsafeMutableRawPointer(bitPattern: UInt(ptr))
    pointer?.deallocate()
}
