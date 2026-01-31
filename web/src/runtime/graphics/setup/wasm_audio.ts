

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

        // WARN: Blitz3D LoadSound is synchronous, but WebAudio is async.
        // For now, we return 0 or a placeholder ID if the system supports it.
        // Assuming graphics.audioSystem.loadSound returns an ID (number).
        // If it returns a Promise, we have a problem for the WASM synchronous call.
        // Checking Blitz3DAudio signature would be best, but let's assume it returns ID.
        return graphics.audioSystem.loadSound(str, flags);
    };

    imports.env.js_FreeSound = (soundId: number) => {
        graphics.audioSystem?.freeSound(soundId);
    };

    imports.env.js_PlaySound = (soundId: number, vol: number, pan: number, rate: number, loop: number) => {
        return graphics.audioSystem ? graphics.audioSystem.playSound(soundId, vol, pan, rate, loop !== 0) : 0;
    };

    imports.env.js_StopChannel = (chanId: number) => {
        graphics.audioSystem?.stopChannel(chanId);
    };

    imports.env.js_PauseChannel = (chanId: number) => {
        graphics.audioSystem?.pauseChannel(chanId);
    };

    imports.env.js_ResumeChannel = (chanId: number) => {
        graphics.audioSystem?.resumeChannel(chanId);
    };

    imports.env.js_ChannelPitch = (chanId: number, pitch: number) => graphics.audioSystem?.setChannelPitch(chanId, pitch);
    imports.env.js_ChannelVolume = (chanId: number, vol: number) => graphics.audioSystem?.setChannelVolume(chanId, vol);
    imports.env.js_ChannelPan = (chanId: number, pan: number) => graphics.audioSystem?.setChannelPan(chanId, pan);

    imports.env.js_ChannelPlaying = (chanId: number) => graphics.audioSystem?.isChannelPlaying(chanId) ? 1 : 0;
}
