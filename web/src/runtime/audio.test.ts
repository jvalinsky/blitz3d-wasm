/**
 * Blitz3D Web Runtime Audio Tests
 */

/// <reference lib="deno.ns" />
/// <reference lib="dom" />

import { Blitz3DAudio } from "./audio.ts";

function assert(condition: unknown, message = "assertion failed"): asserts condition {
    if (!condition) throw new Error(message);
}

function assertEquals<T>(actual: T, expected: T, message = "assertEquals failed") {
    if (actual !== expected) {
        throw new Error(`${message}: expected=${String(expected)} actual=${String(actual)}`);
    }
}

class FakeAudioParam {
    value = 0;
    setTargetAtTime(value: number, _time: number, _constant: number) {
        this.value = value;
    }
}

class FakeGainNode {
    gain = new FakeAudioParam();
    connect() { }
    disconnect() { }
}

class FakeStereoPannerNode {
    pan = new FakeAudioParam();
    connect() { }
    disconnect() { }
}

class FakePannerNode {
    panningModel = "HRTF";
    distanceModel = "inverse";
    refDistance = 1;
    maxDistance = 10000;
    rolloffFactor = 1;
    positionX = new FakeAudioParam();
    positionY = new FakeAudioParam();
    positionZ = new FakeAudioParam();
    connect() { }
    disconnect() { }
}

class FakeBufferSourceNode {
    buffer: AudioBuffer | null = null;
    loop = false;
    playbackRate = new FakeAudioParam();
    onended: (() => void) | null = null;
    connect() { }
    disconnect() { }
    start() { }
    stop() {
        this.onended?.();
    }
}

class FakeAudioContext {
    currentTime = 0;
    state: AudioContextState = "running";
    destination = {};
    listener = {
        positionX: new FakeAudioParam(),
        positionY: new FakeAudioParam(),
        positionZ: new FakeAudioParam(),
        forwardX: new FakeAudioParam(),
        forwardY: new FakeAudioParam(),
        forwardZ: new FakeAudioParam(),
        upX: new FakeAudioParam(),
        upY: new FakeAudioParam(),
        upZ: new FakeAudioParam(),
        setPosition: (_x: number, _y: number, _z: number) => { },
        setOrientation: (_fx: number, _fy: number, _fz: number, _ux: number, _uy: number, _uz: number) => { },
    };

    decodeImpl: () => Promise<AudioBuffer> = () => Promise.resolve({} as AudioBuffer);

    createGain() { return new FakeGainNode(); }
    createStereoPanner() { return new FakeStereoPannerNode(); }
    createPanner() { return new FakePannerNode(); }
    createBufferSource() { return new FakeBufferSourceNode(); }
    decodeAudioData(_buf: ArrayBuffer) { return this.decodeImpl(); }
    resume() { return Promise.resolve(); }
    close() { return Promise.resolve(); }
}

const makeCore = (bytes: Uint8Array) => ({
    fileIO: {
        openFile: (_path: string) => 1,
        readRemaining: (_handle: number) => bytes,
        closeFile: (_handle: number) => { },
    },
});

Deno.test("Audio handles stay stable across async decode + pause/resume", async () => {
    const core = makeCore(new Uint8Array([1, 2, 3, 4]));
    const ctx = new FakeAudioContext();
    let resolveDecode: (buf: AudioBuffer) => void = () => { };
    const decodePromise = new Promise<AudioBuffer>((resolve) => {
        resolveDecode = resolve;
    });
    ctx.decodeImpl = () => decodePromise;

    const audio = new Blitz3DAudio(core, { context: ctx as unknown as AudioContext });
    const soundId = audio.loadSound("sfx.wav", 0);
    assert(soundId > 0, "loadSound should return a valid handle");

    const channelId = audio.playSound(soundId);
    assert(channelId > 0, "playSound should return a valid channel");
    assertEquals(audio.isChannelPlaying(channelId), true, "pending channel should count as playing");

    resolveDecode({} as AudioBuffer);
    await Promise.resolve();

    assertEquals(audio.isChannelPlaying(channelId), true, "channel should still be playing after decode");

    ctx.currentTime = 2;
    audio.pauseChannel(channelId);
    assertEquals(audio.isChannelPlaying(channelId), false, "paused channel should not be playing");

    audio.resumeChannel(channelId);
    assertEquals(audio.isChannelPlaying(channelId), true, "resume keeps channel id stable");
});

Deno.test("Stream open/play/stop/close keeps ids separate", async () => {
    const core = makeCore(new Uint8Array([5, 6, 7]));
    const ctx = new FakeAudioContext();
    ctx.decodeImpl = () => Promise.resolve({} as AudioBuffer);

    const audio = new Blitz3DAudio(core, { context: ctx as unknown as AudioContext });
    const streamId = audio.openStream("music.ogg", 0);
    assert(streamId > 0, "openStream should return a stream handle");

    const channelId = audio.playStream(streamId);
    assert(channelId > 0, "playStream should return a channel handle");
    assertEquals(audio.isChannelPlaying(channelId), true);

    audio.stopStream(streamId);
    assertEquals(audio.isChannelPlaying(channelId), false);

    audio.closeStream(streamId);
});
