/**
 * Blitz3D Runtime Audio Module
 * Web Audio API wrapper for FMOD emulation
 */

class Blitz3DAudio {
    constructor(core) {
        this.core = core;
        this.audioContext = null;
        this.sounds = new Map();        // soundId -> AudioBuffer
        this.streams = new Map();       // streamId -> { buffer, duration }
        this.channels = new Map();      // channelId -> { source, gain, panner, playing }
        this.nextSoundId = 1;
        this.nextStreamId = 1;
        this.nextChannelId = 1;
        this.masterGain = null;
        this.listenerPosition = { x: 0, y: 0, z: 0 };
        this.listenerOrientation = { fx: 0, fy: 0, fz: -1, ux: 0, uy: 1, uz: 0 };
    }

    init() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.audioContext.createGain();
            this.masterGain.connect(this.audioContext.destination);
            console.log("Web Audio API initialized");
        }
        return this.audioContext !== null;
    }

    setupImports(imports) {
        // FMOD Initialization
        imports.env.FSOUND_Init = (mixrate, maxchannels, flags) => {
            console.log(`FSOUND_Init: mixrate=${mixrate}, maxchannels=${maxchannels}, flags=${flags}`);
            return this.init() ? 1 : 0;
        };

        imports.env.FSOUND_Close = () => {
            if (this.audioContext) {
                this.audioContext.close();
                this.audioContext = null;
            }
        };

        // Stream Functions (for music/long audio)
        imports.env.FSOUND_Stream_Open = (pathPtr, mode, offset, length) => {
            const path = this.core.readString(pathPtr);
            console.log(`FSOUND_Stream_Open: ${path}, mode=${mode}, offset=${offset}, length=${length}`);
            
            if (!this.audioContext) {
                console.warn("Audio context not initialized");
                return 0;
            }

            const streamId = this.nextStreamId++;
            
            // Load audio file asynchronously
            fetch(path)
                .then(response => response.arrayBuffer())
                .then(arrayBuffer => this.audioContext.decodeAudioData(arrayBuffer))
                .then(audioBuffer => {
                    this.streams.set(streamId, {
                        buffer: audioBuffer,
                        duration: audioBuffer.duration,
                        path: path
                    });
                    console.log(`Stream ${streamId} loaded: ${path} (${audioBuffer.duration}s)`);
                })
                .catch(error => {
                    console.error(`Failed to load stream ${path}:`, error);
                    this.streams.delete(streamId);
                });
            
            // Return immediately (async loading)
            this.streams.set(streamId, { buffer: null, duration: 0, path: path });
            return streamId;
        };

        imports.env.FSOUND_Stream_Play = (channel, streamId) => {
            const stream = this.streams.get(streamId);
            if (!stream || !stream.buffer) {
                console.warn(`Stream ${streamId} not ready or not found`);
                return 0;
            }

            // Stop existing channel if playing
            if (channel !== -1 && this.channels.has(channel)) {
                this.stopChannel(channel);
            }

            // Auto-allocate channel if needed
            const channelId = (channel === -1) ? this.nextChannelId++ : channel;

            // Create audio nodes
            const source = this.audioContext.createBufferSource();
            const gain = this.audioContext.createGain();
            
            source.buffer = stream.buffer;
            source.connect(gain);
            gain.connect(this.masterGain);

            // Track channel
            this.channels.set(channelId, {
                source: source,
                gain: gain,
                panner: null,
                playing: true,
                stream: streamId,
                startTime: this.audioContext.currentTime
            });

            // Handle playback end
            source.onended = () => {
                if (this.channels.has(channelId)) {
                    this.channels.get(channelId).playing = false;
                }
            };

            source.start(0);
            console.log(`Stream ${streamId} playing on channel ${channelId}`);
            return channelId;
        };

        imports.env.FSOUND_Stream_Stop = (streamId) => {
            // Stop all channels playing this stream
            for (const [channelId, channel] of this.channels.entries()) {
                if (channel.stream === streamId && channel.playing) {
                    this.stopChannel(channelId);
                }
            }
        };

        imports.env.FSOUND_SetVolume = (channel, volume) => {
            const ch = this.channels.get(channel);
            if (ch && ch.gain) {
                // FMOD volume is 0-255, Web Audio is 0-1
                ch.gain.gain.value = volume / 255.0;
            }
        };

        imports.env.FSOUND_SetPaused = (channel, paused) => {
            const ch = this.channels.get(channel);
            if (ch && ch.source) {
                if (paused) {
                    ch.source.stop();
                    ch.playing = false;
                } else {
                    // Resume is complex in Web Audio, might need to recreate source
                    console.warn("FSOUND_SetPaused resume not fully implemented");
                }
            }
        };

        // Simple Sound Functions (for short sound effects)
        imports.env.LoadSound = (pathPtr) => {
            const path = this.core.readString(pathPtr);
            console.log(`LoadSound: ${path}`);
            
            if (!this.audioContext) this.init();

            const soundId = this.nextSoundId++;
            
            fetch(path)
                .then(response => response.arrayBuffer())
                .then(arrayBuffer => this.audioContext.decodeAudioData(arrayBuffer))
                .then(audioBuffer => {
                    this.sounds.set(soundId, audioBuffer);
                    console.log(`Sound ${soundId} loaded: ${path}`);
                })
                .catch(error => {
                    console.error(`Failed to load sound ${path}:`, error);
                    this.sounds.delete(soundId);
                });
            
            return soundId;
        };

        imports.env.PlaySound = (soundId) => {
            const buffer = this.sounds.get(soundId);
            if (!buffer) {
                console.warn(`Sound ${soundId} not found or not loaded`);
                return 0;
            }

            const channelId = this.nextChannelId++;
            const source = this.audioContext.createBufferSource();
            const gain = this.audioContext.createGain();
            
            source.buffer = buffer;
            source.connect(gain);
            gain.connect(this.masterGain);

            this.channels.set(channelId, {
                source: source,
                gain: gain,
                panner: null,
                playing: true,
                sound: soundId,
                startTime: this.audioContext.currentTime
            });

            source.onended = () => {
                if (this.channels.has(channelId)) {
                    this.channels.delete(channelId);
                }
            };

            source.start(0);
            return channelId;
        };

        imports.env.FreeSound = (soundId) => {
            this.sounds.delete(soundId);
        };

        imports.env.StopChannel = (channel) => {
            this.stopChannel(channel);
        };

        imports.env.ChannelVolume = (channel, volume) => {
            const ch = this.channels.get(channel);
            if (ch && ch.gain) {
                ch.gain.gain.value = volume;
            }
        };

        imports.env.ChannelPaused = (channel, paused) => {
            // Similar to FSOUND_SetPaused
            imports.env.FSOUND_SetPaused(channel, paused);
        };

        imports.env.ChannelPlaying = (channel) => {
            const ch = this.channels.get(channel);
            return (ch && ch.playing) ? 1 : 0;
        };

        // SCPCB-specific positional helpers (lightweight stubs)
        imports.env.PlaySound2 = (soundId, _cam, _entity, _range = 10.0, volume = 1.0) => {
            const ch = imports.env.PlaySound(soundId);
            imports.env.ChannelVolume(ch, volume);
            return ch;
        };

        imports.env.LoopSound2 = (soundId, chn, _cam, _entity, _range = 10.0, volume = 1.0) => {
            let channel = chn;
            if (!channel || !imports.env.ChannelPlaying(channel)) {
                channel = imports.env.PlaySound(soundId);
            }
            imports.env.ChannelVolume(channel, volume);
            return channel;
        };

        imports.env.UpdateSoundOrigin = (chn, _cam, _entity, _range = 10.0, volume = 1.0) => {
            if (chn) {
                imports.env.ChannelVolume(chn, volume);
            }
        };

        imports.env.UpdateSoundOrigin2 = (chn, _cam, _entity, _range = 10.0, volume = 1.0) => {
            if (chn) {
                imports.env.ChannelVolume(chn, volume);
            }
        };

        imports.env.LoadEventSound = (eventPtr, filePtr, num = 0) => {
            const path = this.core.readString(filePtr);
            console.log(`LoadEventSound: event=${eventPtr} file=${path} num=${num}`);
            return imports.env.LoadSound(filePtr);
        };

        imports.env.StreamSound_Strict = (filePtr, volume = 1.0, _mode = 0) => {
            const path = this.core.readString(filePtr);
            console.log(`StreamSound_Strict: ${path} vol=${volume}`);
            const ch = imports.env.PlaySound(filePtr); // reuse load/play
            imports.env.ChannelVolume(ch, volume);
            return ch;
        };

        imports.env.StopStream_Strict = (chn) => {
            console.log(`StopStream_Strict: chn=${chn}`);
            imports.env.StopChannel(chn);
        };

        imports.env.SetStreamVolume_Strict = (chn, volume = 1.0) => {
            imports.env.ChannelVolume(chn, volume);
        };

        imports.env.PlayAnnouncement = (filePtr) => {
            const path = this.core.readString(filePtr);
            console.log(`PlayAnnouncement: ${path}`);
            const ch = imports.env.StreamSound_Strict(filePtr, 1.0, 0);
            // Store channel if desired; for now, return channel id
            return ch;
        };

        // 3D Audio
        imports.env.Sound3D = (channelId, x, y, z) => {
            console.log(`Sound3D: channel=${channelId} pos=(${x},${y},${z})`);
            // Update channel position if it exists
        };

        imports.env.PlaySound_Strict = (soundId) => {
            console.log(`PlaySound_Strict: sound=${soundId}`);
            return imports.env.PlaySound(soundId);
        };

        imports.env.SetListenerLocation = (x, y, z, fx, fy, fz, ux, uy, uz) => {
            if (!this.audioContext || !this.audioContext.listener) return;

            this.listenerPosition = { x, y, z };
            this.listenerOrientation = { fx, fy, fz, ux, uy, uz };

            // Web Audio API listener
            if (this.audioContext.listener.positionX) {
                // Modern API
                this.audioContext.listener.positionX.value = x;
                this.audioContext.listener.positionY.value = y;
                this.audioContext.listener.positionZ.value = -z; // Blitz3D to Web Audio coords
                this.audioContext.listener.forwardX.value = fx;
                this.audioContext.listener.forwardY.value = fy;
                this.audioContext.listener.forwardZ.value = -fz;
                this.audioContext.listener.upX.value = ux;
                this.audioContext.listener.upY.value = uy;
                this.audioContext.listener.upZ.value = uz;
            } else {
                // Legacy API
                this.audioContext.listener.setPosition(x, y, -z);
                this.audioContext.listener.setOrientation(fx, fy, -fz, ux, uy, uz);
            }
        };
    }

    stopChannel(channelId) {
        const channel = this.channels.get(channelId);
        if (channel) {
            try {
                if (channel.source && channel.playing) {
                    channel.source.stop();
                }
                channel.playing = false;
            } catch (e) {
                // Already stopped
            }
            this.channels.delete(channelId);
        }
    }
}

if (typeof window !== 'undefined') {
    window.Blitz3DAudio = Blitz3DAudio;
}
module.exports = Blitz3DAudio;
