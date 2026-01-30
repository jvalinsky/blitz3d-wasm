/**
 * Blitz3D Runtime Audio Module
 * WebAudio integration for 2D/3D sound playback
 */

import * as THREE from "three";

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
    entity?: THREE.Object3D;
}

export class Blitz3DAudio {
    context: AudioContext | null = null;
    sounds: Record<number, AudioBuffer> = {};
    soundMetadata: Record<number, SoundMetadata> = {};
    channels: Record<number, ChannelEntry> = {};
    nextSoundId = 1;
    nextChannelId = 1;
    masterGain: GainNode | null = null;

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

    playSound3D(soundId: number, x: number, y: number, z: number, volume: number = 1.0, rate: number = 1.0, loopOverride?: boolean, entity?: THREE.Object3D): number {
        const chanId = this._playSoundInternal(soundId, volume, 0, rate, loopOverride, true, entity);
        const entry = this.channels[chanId];
        if (entry) {
            entry.entity = entity;
            if (entry.panner instanceof PannerNode) {
                entry.panner.positionX.setTargetAtTime(x, this.context!.currentTime, 0.02);
                entry.panner.positionY.setTargetAtTime(y, this.context!.currentTime, 0.02);
                entry.panner.positionZ.setTargetAtTime(z, this.context!.currentTime, 0.02);
            }
        }
        return chanId;
    }

    private _playSoundInternal(soundId: number, volume: number, pan: number, rate: number, loopOverride: boolean | undefined, is3D: boolean, entity?: THREE.Object3D): number {
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

    updateListener(camera: THREE.Camera) {
        if (!this.context) return;
        const l = this.context.listener;
        const p = camera.position;
        const q = camera.quaternion;
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);

        if (l.positionX) {
            l.positionX.setTargetAtTime(p.x, this.context.currentTime, 0.02);
            l.positionY.setTargetAtTime(p.y, this.context.currentTime, 0.02);
            l.positionZ.setTargetAtTime(p.z, this.context.currentTime, 0.02);
            l.forwardX.setTargetAtTime(forward.x, this.context.currentTime, 0.02);
            l.forwardY.setTargetAtTime(forward.y, this.context.currentTime, 0.02);
            l.forwardZ.setTargetAtTime(forward.z, this.context.currentTime, 0.02);
            l.upX.setTargetAtTime(up.x, this.context.currentTime, 0.02);
            l.upY.setTargetAtTime(up.y, this.context.currentTime, 0.02);
            l.upZ.setTargetAtTime(up.z, this.context.currentTime, 0.02);
        } else {
            l.setPosition(p.x, p.y, p.z);
            l.setOrientation(forward.x, forward.y, forward.z, up.x, up.y, up.z);
        }

        // Update 3D emitters
        const worldPos = new THREE.Vector3();
        for (const chanId in this.channels) {
            const entry = this.channels[chanId];
            if (entry.is3D && entry.entity && entry.panner instanceof PannerNode) {
                entry.entity.getWorldPosition(worldPos);
                entry.panner.positionX.setTargetAtTime(worldPos.x, this.context.currentTime, 0.02);
                entry.panner.positionY.setTargetAtTime(worldPos.y, this.context.currentTime, 0.02);
                entry.panner.positionZ.setTargetAtTime(worldPos.z, this.context.currentTime, 0.02);
            }
        }
    }
}
