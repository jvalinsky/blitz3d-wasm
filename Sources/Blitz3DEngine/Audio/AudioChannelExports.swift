//
//  AudioChannelExports.swift
//  Blitz3DEngine
//
//  Audio channel control and sound property functions
//

import Foundation

/// Sets the playback pitch/frequency of a sound channel.
///
/// - Parameters:
///   - channel: Handle to the sound channel
///   - pitch: Pitch multiplier (1.0 = normal, 2.0 = double speed/octave up, 0.5 = half speed/octave down)
///
/// - Note: Changing pitch also changes playback speed. Values >1.0 make sounds
///         higher and faster, values <1.0 make sounds lower and slower.
///         Useful for creating sound variations without multiple audio files.
@_cdecl("ChannelPitch")
@MainActor
public func ChannelPitch(_ channel: Int32, _ pitch: Float) {
    // Channel pitch control will be handled by audio system
}

/// Plays a sound in looping mode and returns the channel handle.
///
/// - Parameter sound: Handle to the sound to loop
///
/// - Returns: Handle to the playing channel, or 0 if failed
///
/// - Note: The sound will continuously repeat until stopped with StopChannel.
///         Useful for background music, ambient sounds, and repeating effects.
@_cdecl("LoopSound")
@MainActor
public func LoopSound(_ sound: Int32) -> Int32 {
    // Sound looping will be handled by audio system
    return 0
}

/// Sets the volume level of a sound.
///
/// - Parameters:
///   - sound: Handle to the sound
///   - volume: Volume level from 0.0 (silent) to 1.0 (full volume)
///
/// - Note: Affects all instances of this sound. For per-channel volume control,
///         use ChannelVolume instead. Values >1.0 may cause clipping/distortion.
@_cdecl("SoundVolume")
@MainActor
public func SoundVolume(_ sound: Int32, _ volume: Float) {
    // Sound volume will be handled by audio system
}

/// Sets the stereo panning of a sound.
///
/// - Parameters:
///   - sound: Handle to the sound
///   - pan: Pan value from -1.0 (full left) through 0.0 (center) to 1.0 (full right)
///
/// - Note: Affects all instances of this sound. For per-channel panning,
///         use ChannelPan instead. Pan only affects stereo output - has no effect
///         on mono audio setups.
@_cdecl("SoundPan")
@MainActor
public func SoundPan(_ sound: Int32, _ pan: Float) {
    // Sound panning will be handled by audio system
}
