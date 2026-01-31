@MainActor
public class AudioManager {
    public static let shared = AudioManager()

    private init() {}

    public func loadSound(_ path: String, flags: Int32 = 0) -> Int32 {
        return path.withCString { ptr in
            return js_LoadSound(Int32(Int(bitPattern: ptr)), flags)
        }
    }

    public func freeSound(_ sound: Int32) {
        js_FreeSound(sound)
    }

    public func playSound(_ sound: Int32) -> Int32 {
        return js_PlaySound(sound, 1.0, 0.0, 1.0, 0)
    }

    public func playSound(
        _ sound: Int32, volume: Float, pan: Float, rate: Float, loop: Bool = false
    ) -> Int32 {
        return js_PlaySound(sound, volume, pan, rate, loop ? 1 : 0)
    }

    public func stopChannel(_ channel: Int32) {
        js_StopChannel(channel)
    }

    public func channelPitch(_ channel: Int32, pitch: Float) {
        js_ChannelPitch(channel, pitch)
    }

    public func channelVolume(_ channel: Int32, volume: Float) {
        js_ChannelVolume(channel, volume)
    }

    public func channelPan(_ channel: Int32, pan: Float) {
        js_ChannelPan(channel, pan)
    }
}
