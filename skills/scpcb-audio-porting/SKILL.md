---
name: scpcb-audio-porting
description: Port SCPCB audio behavior (FMOD-style LoadSound/PlaySound/Channel* and StreamSound_Strict) to Blitz3D-WASM’s web runtime audio. Use when SCPCB expects FMOD DLL semantics, when audio is stubbed or asynchronous decode causes timing issues, or when mapping SCPCB `StrictLoads.bb` stream/channel logic to WebAudio.
---

# SCPCB Audio Porting

## What SCPCB expects

- `FMod.bb` initializes FMOD and defines constants like `Mode=2` (looping).
- `StrictLoads.bb` provides:
  - `LoadSound_Strict`, `PlaySound_Strict`, `FreeSound_Strict`
  - streaming helpers (`StreamSound_Strict`, `StopStream_Strict`, `SetStream*`,
    `IsStreamPlaying_Strict`)
  - channel semantics: `ChannelPlaying`, `ChannelVolume`, `ChannelPan`,
    `ChannelPitch`, `StopChannel`, `PauseChannel`

## What the web runtime provides (repo)

- WebAudio implementation:
  - `web/src/runtime/audio.ts`
- Import plumbing / call sites:
  - `web/src/runtime/core.ts`
  - `web/src/runtime/graphics/setup/wasm_audio.ts`

## Porting pitfalls (common)

- **Sync vs async**:
  - SCPCB assumes `LoadSound` is synchronous; WebAudio decoding is async.
  - Decide whether to (a) preload key sounds, (b) allow “0 until loaded”, or (c)
    block on preload groups.
- **Looping semantics**:
  - SCPCB uses `Mode=2` for loops; ensure loop flags map to
    `AudioBufferSourceNode.loop`.
- **Channel identity**:
  - SCPCB stores channel ids and polls `ChannelPlaying`; ensure ids stay stable
    and are cleaned up on end.
- **Streaming**:
  - SCPCB “streams” music; in web port you may model this as regular decoded
    buffers initially, then upgrade to streaming if needed.

## Recommended workflow

1. Confirm which path you’re using:
   - Track B cmdbuf `PlaySound` commands vs direct WASM imports.
2. Ensure all audio entrypoints used by SCPCB are wired (not stubs).
3. If timing matters (e.g., immediate `ChannelPlaying` after `PlaySound`):
   - Add a deterministic “loaded” state for sounds and/or preload those assets.
4. Verify with a narrow repro:
   - Call `LoadSound_Strict` + `PlaySound_Strict` on a known `.ogg` and ensure
     `ChannelPlaying` toggles as expected.
