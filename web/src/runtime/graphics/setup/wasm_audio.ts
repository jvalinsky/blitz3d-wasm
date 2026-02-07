

import { Blitz3DGraphicsInterface } from "../types.ts";

export function setupWasmAudio(graphics: Blitz3DGraphicsInterface, imports: any) {
    // Ensure env exists
    if (!imports.env) imports.env = {};

    imports.env.js_LoadSound = (pathPtr: number, flags: number) => {
        if (!graphics.audioSystem) return 0;
        if (!graphics._engine || !graphics._engine.memory) return 0;

        const buffer = graphics._engine.memory.buffer;
        const array = new Uint8Array(buffer);

        let str = "";
        let ptr = pathPtr;
        while (true) {
            const char = array[ptr++];
            if (char === 0) break;
            str += String.fromCharCode(char);
        }

        // Blitz3D LoadSound is synchronous; audioSystem returns a stable ID immediately
        // and loads/decode buffers asynchronously behind the handle.
        return graphics.audioSystem.loadSound(str, flags);
    };

    imports.env.js_FreeSound = (soundId: number) => {
        graphics.audioSystem?.freeSound?.(soundId);
    };

    imports.env.js_PlaySound = (soundId: number, vol: number, pan: number, rate: number, loop: number) => {
        return graphics.audioSystem?.playSound
            ? graphics.audioSystem.playSound(soundId, vol, pan, rate, loop !== 0)
            : 0;
    };

    imports.env.js_StopChannel = (chanId: number) => {
        graphics.audioSystem?.stopChannel?.(chanId);
    };

    imports.env.js_PauseChannel = (chanId: number) => {
        graphics.audioSystem?.pauseChannel?.(chanId);
    };

    imports.env.js_ResumeChannel = (chanId: number) => {
        graphics.audioSystem?.resumeChannel?.(chanId);
    };

    imports.env.js_ChannelPitch = (chanId: number, pitch: number) => graphics.audioSystem?.setChannelPitch?.(chanId, pitch);
    imports.env.js_ChannelVolume = (chanId: number, vol: number) => graphics.audioSystem?.setChannelVolume?.(chanId, vol);
    imports.env.js_ChannelPan = (chanId: number, pan: number) => graphics.audioSystem?.setChannelPan?.(chanId, pan);

    imports.env.js_ChannelPlaying = (chanId: number) => graphics.audioSystem?.isChannelPlaying?.(chanId) ? 1 : 0;

    // Legacy Aliases
    imports.env.LoadSound = (pathPtr: number, flags: number) => imports.env.js_LoadSound(pathPtr, flags);
    imports.env.FreeSound = (soundId: number) => imports.env.js_FreeSound(soundId);
    imports.env.PlaySound = (soundId: number) => imports.env.js_PlaySound(soundId, 1, 0, 1, 0); // Default args for basic PlaySound
    imports.env.LoopSound = (soundId: number) => {
        // LoopSound(sound) sets the loop flag for subsequent plays? Or modifies the sound?
        // Blitz3D LoopSound just sets a flag on the sound resource.
        graphics.audioSystem?.loopSound?.(soundId, true);
    };
    imports.env.SoundPitch = (soundId: number, pitch: number) => graphics.audioSystem?.setSoundPitch?.(soundId, pitch);
    imports.env.SoundVolume = (soundId: number, vol: number) => graphics.audioSystem?.setSoundVolume?.(soundId, vol);
    imports.env.SoundPan = (soundId: number, pan: number) => graphics.audioSystem?.setSoundPan?.(soundId, pan);

    imports.env.StopChannel = (chanId: number) => imports.env.js_StopChannel(chanId);
    imports.env.PauseChannel = (chanId: number) => imports.env.js_PauseChannel(chanId);
    imports.env.ResumeChannel = (chanId: number) => imports.env.js_ResumeChannel(chanId);
    imports.env.ChannelPitch = (chanId: number, pitch: number) => imports.env.js_ChannelPitch(chanId, pitch);
    imports.env.ChannelVolume = (chanId: number, vol: number) => imports.env.js_ChannelVolume(chanId, vol);
    imports.env.ChannelPan = (chanId: number, pan: number) => imports.env.js_ChannelPan(chanId, pan);
    imports.env.ChannelPlaying = (chanId: number) => imports.env.js_ChannelPlaying(chanId);
    imports.env.PlayMusic = (pathPtr: number) => {
        // Stream API
        if (!graphics.audioSystem) return 0;
        const path = graphics.core.readString(pathPtr);
        const streamId = graphics.audioSystem.openStream(path, 1); // 1=loop?
        return graphics.audioSystem.playStream(streamId, 1, 0, 1, true);
    };
}

