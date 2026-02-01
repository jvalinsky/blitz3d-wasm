//
//  AudioChannelExports.swift
//  Blitz3DEngine
//
//  Audio channel control functions
//

import Foundation

@_cdecl("ChannelPitch")
@MainActor
public func ChannelPitch(_ channel: Int32, _ pitch: Float) {
    // Set channel pitch/frequency
}

@_cdecl("LoopSound")
@MainActor
public func LoopSound(_ sound: Int32) -> Int32 {
    // Play sound in loop mode
    return 0
}

@_cdecl("SoundVolume")
@MainActor
public func SoundVolume(_ sound: Int32, _ volume: Float) {
    // Set sound volume (0.0 to 1.0)
}

@_cdecl("SoundPan")
@MainActor
public func SoundPan(_ sound: Int32, _ pan: Float) {
    // Set sound pan (-1.0 = left, 0.0 = center, 1.0 = right)
}
