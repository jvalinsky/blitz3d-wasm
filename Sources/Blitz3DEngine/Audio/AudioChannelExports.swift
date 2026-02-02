//
//  AudioChannelExports.swift
//  Blitz3DEngine
//
//  Audio channel control and sound property functions
//

import Foundation

// MARK: - Channel Control Functions

/// Stops playback on a sound channel.
///
/// - Parameter channel: Handle to the sound channel to stop
///
/// - Note: The channel becomes invalid after stopping. To play again,
///         you must call PlaySound to get a new channel.
@_cdecl("StopChannel")
@MainActor
public func StopChannel(_ channel: Int32) {
    AudioManager.shared.stopChannel(channel)
}

/// Pauses playback on a sound channel.
///
/// - Parameter channel: Handle to the sound channel to pause
///
/// - Note: The channel remains valid and can be resumed with ResumeChannel.
///         Useful for pause menus and temporary audio suspension.
@_cdecl("PauseChannel")
@MainActor
public func PauseChannel(_ channel: Int32) {
    AudioManager.shared.pauseChannel(channel)
}

/// Resumes playback on a paused sound channel.
///
/// - Parameter channel: Handle to the paused sound channel
///
/// - Note: Has no effect if the channel is not paused or is invalid.
@_cdecl("ResumeChannel")
@MainActor
public func ResumeChannel(_ channel: Int32) {
    AudioManager.shared.resumeChannel(channel)
}

/// Sets the volume level of a playing sound channel.
///
/// - Parameters:
///   - channel: Handle to the sound channel
///   - volume: Volume level from 0.0 (silent) to 1.0 (full volume)
///
/// - Note: Values >1.0 may cause clipping/distortion.
///         Use to fade sounds in/out or adjust dynamic audio levels.
@_cdecl("ChannelVolume")
@MainActor
public func ChannelVolume(_ channel: Int32, _ volume: Float) {
    AudioManager.shared.channelVolume(channel, volume: volume)
}

/// Sets the stereo panning of a playing sound channel.
///
/// - Parameters:
///   - channel: Handle to the sound channel
///   - pan: Pan value from -1.0 (full left) through 0.0 (center) to 1.0 (full right)
///
/// - Note: Pan only affects stereo output - has no effect on mono audio setups.
@_cdecl("ChannelPan")
@MainActor
public func ChannelPan(_ channel: Int32, _ pan: Float) {
    AudioManager.shared.channelPan(channel, pan: pan)
}

/// Sets the playback pitch/frequency of a sound channel.
///
/// - Parameters:
///   - channel: Handle to the sound channel
///   - pitch: Pitch multiplier (1.0 = normal, 2.0 = double speed/octave up, 0.5 = half speed/octave down)
///
/// - Note: Changing pitch also changes playback speed.
@_cdecl("ChannelPitch")
@MainActor
public func ChannelPitch(_ channel: Int32, _ pitch: Float) {
    AudioManager.shared.channelPitch(channel, pitch: pitch)
}

// MARK: - 3D Positional Audio

/// Plays a sound at the position of an entity (3D positional audio).
///
/// - Parameters:
///   - sound: Handle to the sound to play
///   - entity: Handle to the entity to play the sound at
///
/// - Returns: Handle to the playing channel, or 0 if failed
///
/// - Note: The sound volume and pan will be adjusted based on the entity's
///         distance and direction from the listener (camera).
@_cdecl("EmitSound")
@MainActor
public func EmitSound(_ sound: Int32, _ entity: Int32) -> Int32 {
    return AudioManager.shared.emitSound(sound, entityId: entity)
}

/// Updates the 3D position of a playing sound channel.
///
/// - Parameters:
///   - channel: Handle to the sound channel
///   - x: World X coordinate
///   - y: World Y coordinate
///   - z: World Z coordinate
///
/// - Note: Used to move sounds that are not attached to entities.
@_cdecl("ChannelPosition")
@MainActor
public func ChannelPosition(_ channel: Int32, _ x: Float, _ y: Float, _ z: Float) {
    AudioManager.shared.setChannelPosition(channel, x: x, y: y, z: z)
}

// MARK: - Music System

/// Plays a music file (MP3/OGG).
///
/// - Parameter pathPtr: Pointer to null-terminated file path string
///
/// - Returns: Handle to the music channel, or 0 if failed
///
/// - Note: Music plays on a separate channel from sound effects.
///         Only one music track can play at a time.
@_cdecl("PlayMusic")
@MainActor
public func PlayMusic(_ pathPtr: UnsafePointer<CChar>?) -> Int32 {
    guard let ptr = pathPtr else { return 0 }
    let path = String(cString: ptr)
    return AudioManager.shared.playMusic(path)
}

/// Stops the currently playing music.
@_cdecl("StopMusic")
@MainActor
public func StopMusic() {
    AudioManager.shared.stopMusic()
}

/// Sets the volume of the music.
///
/// - Parameter volume: Volume level from 0.0 (silent) to 1.0 (full volume)
@_cdecl("MusicVolume")
@MainActor
public func MusicVolume(_ volume: Float) {
    AudioManager.shared.setMusicVolume(volume)
}

// MARK: - Legacy Functions

/// Plays a sound in looping mode and returns the channel handle.
///
/// - Parameter sound: Handle to the sound to loop
///
/// - Returns: Handle to the playing channel, or 0 if failed
@_cdecl("LoopSound")
@MainActor
public func LoopSound(_ sound: Int32) -> Int32 {
    // For now, use PlaySound with loop flag
    return js_PlaySound(sound, 1.0, 0.0, 1.0, 1)
}

/// Sets the default volume level of a sound.
///
/// - Parameters:
///   - sound: Handle to the sound
///   - volume: Volume level from 0.0 (silent) to 1.0 (full volume)
@_cdecl("SoundVolume")
@MainActor
public func SoundVolume(_ sound: Int32, _ volume: Float) {
    // Store default volume for this sound (for future instances)
    // For now, this is a stub
}

/// Sets the default stereo panning of a sound.
///
/// - Parameters:
///   - sound: Handle to the sound
///   - pan: Pan value from -1.0 (full left) to 1.0 (full right)
@_cdecl("SoundPan")
@MainActor
public func SoundPan(_ sound: Int32, _ pan: Float) {
    // Store default pan for this sound (for future instances)
    // For now, this is a stub
}
