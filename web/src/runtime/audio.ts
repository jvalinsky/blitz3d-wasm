/**
 * Blitz3D Runtime Audio Module
 * WebAudio integration for 2D/3D sound playback
 *
 * No Three.js dependency — uses entity IDs and world matrices from EngineBridge.
 */

import type { EngineBridge } from "../engine/bridge.ts";

interface SoundMetadata {
    loop?: boolean;
    volume?: number;
    pan?: number;
    rate?: number;
    pausedAt?: number;
}

interface ChannelEntry {
    source: AudioBufferSourceNode;
    gain: GainNode;
    panner: StereoPannerNode | PannerNode;
    soundId: number;
    startedAt: number;
    pausedAt: number;
    volume: number;
    pan: number;
    rate: number;
    loop: boolean;
    is3D: boolean;
    entityId?: number;
}

export class Blitz3DAudio {
    context: AudioContext | null = null;
    sounds: Record<number, AudioBuffer> = {};
    soundMetadata: Record<number, SoundMetadata> = {};
    channels: Record<number, ChannelEntry> = {};
    nextSoundId = 1;
    nextChannelId = 1;
    masterGain: GainNode | null = null;
    bridge: EngineBridge | null = null;

    constructor(private core: any) {
        if (typeof window !== "undefined" && (window.AudioContext || (window as any).webkitAudioContext)) {
            this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
            this.masterGain = this.context!.createGain();
            this.masterGain.connect(this.context!.destination);
        } else {
            console.warn("WebAudio not supported");
        }
    }

    resume() {
        if (this.context && this.context.state === "suspended") {
            this.context.resume().catch(e => console.warn("Audio resume failed:", e));
        }
    }

    async loadSound(path: string, flags: number): Promise<number> {
        if (!this.context) return 0;
        const handle = this.core.fileIO.openFile(path);
        if (!handle) return 0;

        try {
            const data = this.core.fileIO.readRemaining(handle);
            this.core.fileIO.closeFile(handle);
            if (!data) return 0;

            const buf = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
            const audioBuf = await this.context.decodeAudioData(buf);

            const id = this.nextSoundId++;
            this.sounds[id] = audioBuf;
            return id;
        } catch (e) {
            console.warn(`LoadSound error ${path}:`, e);
            return 0;
        }
    }

    freeSound(soundId: number) {
        delete this.sounds[soundId];
        delete this.soundMetadata[soundId];
    }

    loopSound(soundId: number, loop: boolean) {
        if (!this.soundMetadata[soundId]) this.soundMetadata[soundId] = {};
        this.soundMetadata[soundId].loop = loop;
    }

    playSound(soundId: number, volume: number = 1.0, pan: number = 0.0, rate: number = 1.0, loopOverride?: boolean): number {
        return this._playSoundInternal(soundId, volume, pan, rate, loopOverride, false);
    }

    playSound3D(soundId: number, x: number, y: number, z: number, volume: number = 1.0, rate: number = 1.0, loopOverride?: boolean, entityId?: number): number {
        const chanId = this._playSoundInternal(soundId, volume, 0, rate, loopOverride, true, entityId);
        const entry = this.channels[chanId];
        if (entry) {
            entry.entityId = entityId;
            if (entry.panner instanceof PannerNode) {
                entry.panner.positionX.setTargetAtTime(x, this.context!.currentTime, 0.02);
                entry.panner.positionY.setTargetAtTime(y, this.context!.currentTime, 0.02);
                entry.panner.positionZ.setTargetAtTime(z, this.context!.currentTime, 0.02);
            }
        }
        return chanId;
    }

    private _playSoundInternal(soundId: number, volume: number, pan: number, rate: number, loopOverride: boolean | undefined, is3D: boolean, entityId?: number): number {
        if (!this.context || !this.sounds[soundId]) return 0;

        const meta = this.soundMetadata[soundId];
        const loop = loopOverride ?? meta?.loop ?? false;
        const buffer = this.sounds[soundId]!;

        const source = this.context.createBufferSource();
        source.buffer = buffer;
        source.loop = loop;
        source.playbackRate.value = rate;

        let panner: StereoPannerNode | PannerNode;
        if (is3D) {
            panner = this.context.createPanner();
            panner.panningModel = 'HRTF';
            panner.distanceModel = 'inverse';
            panner.refDistance = 1;
            panner.maxDistance = 10000;
            panner.rolloffFactor = 1;
        } else {
            panner = this.context.createStereoPanner();
            (panner as StereoPannerNode).pan.value = pan;
        }

        const gain = this.context.createGain();
        gain.gain.value = volume;

        source.connect(panner);
        panner.connect(gain);
        gain.connect(this.masterGain!);

        const chanId = this.nextChannelId++;
        this.channels[chanId] = {
            source, gain, panner,
            soundId,
            startedAt: this.context.currentTime,
            pausedAt: 0,
            volume, pan, rate, loop, is3D
        };

        source.start(0);

        source.onended = () => {
            if (this.channels[chanId]?.source === source) {
                delete this.channels[chanId];
            }
        };

        return chanId;
    }

    stopChannel(chanId: number) {
        const entry = this.channels[chanId];
        if (entry) {
            try { entry.source.stop(); } catch { }
            delete this.channels[chanId];
        }
    }

    pauseChannel(chanId: number) {
        const entry = this.channels[chanId];
        if (entry && this.context) {
            try { entry.source.stop(); } catch { }
            entry.pausedAt = this.context.currentTime - entry.startedAt;
            // For resume, we need to track it. Let's move to metadata.
            this.soundMetadata[entry.soundId] = {
                ...this.soundMetadata[entry.soundId],
                pausedAt: entry.pausedAt,
                loop: entry.loop,
                volume: entry.volume,
                pan: entry.pan,
                rate: entry.rate
            };
            delete this.channels[chanId];
        }
    }

    resumeChannel(soundId: number): number {
        const meta = this.soundMetadata[soundId];
        if (!meta || meta.pausedAt === undefined) return 0;
        // Re-play from offset
        const chanId = this.playSound(soundId, meta.volume, meta.pan, meta.rate, meta.loop);
        // We don't easily support starting from offset in this simple wrapper without more source.start params
        // but this is a start.
        return chanId;
    }

    setChannelVolume(chanId: number, vol: number) {
        const entry = this.channels[chanId];
        if (entry && this.context) {
            entry.gain.gain.setTargetAtTime(vol, this.context.currentTime, 0.02);
            entry.volume = vol;
        }
    }

    setChannelPan(chanId: number, pan: number) {
        const entry = this.channels[chanId];
        if (entry && this.context && entry.panner instanceof StereoPannerNode) {
            entry.panner.pan.setTargetAtTime(pan, this.context.currentTime, 0.02);
            entry.pan = pan;
        }
    }

    setChannelPitch(chanId: number, pitch: number) {
        const entry = this.channels[chanId];
        if (entry && this.context) {
            // Blitz3D pitch is usually frequency; WebAudio is multiplier.
            // For now assume caller provides multiplier or handle baseRate mapping.
            entry.source.playbackRate.setTargetAtTime(pitch, this.context.currentTime, 0.02);
            entry.rate = pitch;
        }
    }

    isChannelPlaying(chanId: number): boolean {
        return !!this.channels[chanId];
    }

    /**
     * Update audio listener from camera entity ID via bridge world matrix readback.
     * Also updates positions of 3D sound emitters.
     */
    updateListenerFromBridge(camId: number) {
        if (!this.context || !this.bridge) return;
        const l = this.context.listener;

        // Read camera world matrix
        const m = this.bridge.getWorldMatrix(camId);
        if (!m) return;

        // Position = column 3
        const px = m[12], py = m[13], pz = m[14];
        // Forward = column 2 (Blitz3D convention, Z axis)
        const fx = m[8], fy = m[9], fz = m[10];
        // Up = column 1
        const ux = m[4], uy = m[5], uz = m[6];

        const t = this.context.currentTime;
        if (l.positionX) {
            l.positionX.setTargetAtTime(px, t, 0.02);
            l.positionY.setTargetAtTime(py, t, 0.02);
            l.positionZ.setTargetAtTime(pz, t, 0.02);
            l.forwardX.setTargetAtTime(fx, t, 0.02);
            l.forwardY.setTargetAtTime(fy, t, 0.02);
            l.forwardZ.setTargetAtTime(fz, t, 0.02);
            l.upX.setTargetAtTime(ux, t, 0.02);
            l.upY.setTargetAtTime(uy, t, 0.02);
            l.upZ.setTargetAtTime(uz, t, 0.02);
        } else {
            l.setPosition(px, py, pz);
            l.setOrientation(fx, fy, fz, ux, uy, uz);
        }

        // Update 3D emitter positions
        for (const chanId in this.channels) {
            const entry = this.channels[chanId];
            if (entry.is3D && entry.entityId && entry.panner instanceof PannerNode) {
                const em = this.bridge.getWorldMatrix(entry.entityId);
                if (em) {
                    entry.panner.positionX.setTargetAtTime(em[12], t, 0.02);
                    entry.panner.positionY.setTargetAtTime(em[13], t, 0.02);
                    entry.panner.positionZ.setTargetAtTime(em[14], t, 0.02);
                }
            }
        }
    }
}
