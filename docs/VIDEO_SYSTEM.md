# Video Playback System

HTML5-based video playback implementation for Blitz3D WASM runtime.

## Overview

The video system bridges Blitz3D's `BlitzMovie_*` API to HTML5 `<video>`
elements, allowing SCPCB startup videos to play in the browser.

## Architecture

```
Blitz3D Code (.bb)
    ↓
WASM calls BlitzMovie_Open("video.avi")
    ↓
PlatformStubs.swift (stubbed in WASM)
    ↓
TypeScript VideoRuntime (web/src/runtime/video.ts)
    ↓
HTML5 <video> element
    ↓
Browser video decoder
```

## WASM API

### BlitzMovie_Open(path) → handle

Opens a video file and returns a handle.

**Swift Stub:**

```swift
@_cdecl("BlitzMovie_Open")
public func BlitzMovie_Open(_ path: Int32) -> Int32 {
    return 0  // Stub returns 0 (failure)
}
```

**TypeScript Implementation:**

```typescript
BlitzMovie_Open: ((pathPtr: number): number => {
  const path = readWasmString(pathPtr);
  return videoRuntime.openMovie(path);
});
```

### BlitzMovie_Close(handle) → success

Closes an open movie and frees resources.

### BlitzMovie_GetWidth(handle) → pixels

Returns video width after metadata loads.

### BlitzMovie_GetHeight(handle) → pixels

Returns video height after metadata loads.

### BlitzMovie_Play(handle) → success

Starts video playback (async).

### BlitzMovie_Stop(handle) → success

Stops playback and resets position to 0.

### BlitzMovie_OpenDecodeToImage(handle, imagePtr) → success

**Not Yet Implemented** - Would decode frames to image buffer.

## Video Files

SCPCB includes two startup videos (converted to MP4 for web):

- `startup_TSS.mp4` (1.3 MB) - Converted from AVI
- `startup_Undertow.mp4` (3 MB) - Converted from AVI

**Original Format:** AVI (MPEG-4/XviD codec) - NOT supported by modern browsers
**Web Format:** MP4 (H.264 + AAC) - Universal browser support

**Conversion Command:**

```bash
ffmpeg -i startup_TSS.avi -c:v libx264 -preset fast -crf 23 -c:a aac startup_TSS.mp4
```

## Usage

### HTML Demo

```html
<video id="player"></video>
<script type="module">
  import { VideoRuntime } from "./runtime/video.js";

  const runtime = new VideoRuntime(document.body);
  const handle = runtime.openMovie("./assets/startup_TSS.avi");

  runtime.play(handle);
</script>
```

### WASM Integration

```typescript
import { createVideoWasmExports, getVideoRuntime } from "./runtime/video.js";

const videoRuntime = getVideoRuntime();
const wasmImports = {
  env: {
    ...createVideoWasmExports(videoRuntime),
    // ... other WASM imports
  },
};

WebAssembly.instantiate(wasmBytes, wasmImports);
```

## TypeScript VideoRuntime API

```typescript
class VideoRuntime {
  openMovie(path: string): number;
  closeMovie(handle: number): boolean;

  getWidth(handle: number): number;
  getHeight(handle: number): number;

  play(handle: number): Promise<boolean>;
  stop(handle: number): boolean;
  pause(handle: number): boolean;
  resume(handle: number): boolean;

  isPlaying(handle: number): boolean;
  getCurrentTime(handle: number): number;
  getDuration(handle: number): number;

  seek(handle: number, timeSeconds: number): boolean;
  setVolume(handle: number, volume: number): boolean;
  setLooping(handle: number, loop: boolean): boolean;

  cleanup(): void;
}
```

## Demo

**URL:** `http://localhost:8000/web/video-demo.html`

Features:

- Load and play both SCPCB startup videos
- Real-time WASM API call logging
- Interactive controls
- Simulates WASM movie handle behavior

## Browser Compatibility

| Feature      | Chrome | Firefox | Safari | Edge |
| ------------ | ------ | ------- | ------ | ---- |
| MP4 (H.264)  | ✅     | ✅      | ✅     | ✅   |
| HTML5 video  | ✅     | ✅      | ✅     | ✅   |
| Async play() | ✅     | ✅      | ✅     | ✅   |

**Note:** AVI format is NOT supported by modern browsers. All videos must be
converted to MP4/WebM.

## Known Limitations

1. **No frame decoding** - `BlitzMovie_OpenDecodeToImage()` not implemented
2. **Async playback** - `Play()` returns immediately (browser autoplay
   restrictions)
3. **No AVI on Safari** - Safari doesn't support AVI codec (workaround:
   transcode to MP4)
4. **Path resolution** - Currently needs full relative path from HTML page

## Future Enhancements

### Frame Capture

Decode video frames to ImageData for texture rendering:

```typescript
const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");
ctx.drawImage(video, 0, 0);
const imageData = ctx.getImageData(0, 0, width, height);
```

### Format Conversion

Auto-transcode AVI to WebM/MP4 using ffmpeg.wasm:

```bash
ffmpeg -i startup_TSS.avi -c:v libvpx startup_TSS.webm
```

### WASM String Reading

Read strings from WASM linear memory:

```typescript
function readWasmString(ptr: number, memory: WebAssembly.Memory): string {
  const view = new Uint8Array(memory.buffer);
  let end = ptr;
  while (view[end] !== 0) end++;
  return new TextDecoder().decode(view.subarray(ptr, end));
}
```

## Related Files

- `web/video-demo.html` - Standalone demo
- `web/src/runtime/video.ts` - TypeScript runtime
- `Sources/Blitz3DEngine/Platform/PlatformStubs.swift` - WASM stubs
- `docs/VIDEO_SYSTEM.md` - This file

## Testing

```bash
# Serve demo locally
deno task serve

# Open in browser
open http://localhost:8000/web/video-demo.html
```

## Notes

- Video elements hidden by default (`display: none`)
- Only shown during active playback
- Automatically removed on close
- Supports multiple concurrent videos
- Handle tracking matches WASM behavior (auto-increment IDs)
