# Browser Testing Guide

## Quick Start

### 1. Copy Test WASM Files

```bash
# Copy compiled test files to runtime directory
cp /tmp/test_audio.wasm blitz3d-wasm/
cp /tmp/test_2d_graphics.wasm blitz3d-wasm/
cp /tmp/test_fileio.wasm blitz3d-wasm/
```

### 2. Start HTTP Server

```bash
cd blitz3d-wasm

# Python 3
python3 -m http.server 8000

# Or Python 2
python -m SimpleHTTPServer 8000

# Or Deno
deno task serve

# Or Deno stdlib file server
deno run --allow-net --allow-read https://deno.land/std@0.224.0/http/file_server.ts --port 8000
```

### 3. Open Browser

Navigate to: `http://localhost:8000/test_runtime.html`

---

## What to Test

### Audio System

1. Click **"Initialize Audio"** - Should see Web Audio context created
2. Click **"Test Beep"** - Should hear 440Hz tone
3. Check console for audio status

### File System

1. Click **"Test Virtual FS"** - Creates test file in memory
2. Should see file read/write operations
3. ZIP loading requires actual .zip file

### WASM Module Loading

1. Click **"Load Audio Test"** - Loads test_audio.wasm
2. Click **"Load 2D Test"** - Loads test_2d_graphics.wasm
3. Check console for execution logs

---

## Expected Output

### Successful Initialization

```
[12:00:00] === Blitz3D WASM Runtime Test ===
[12:00:00] Checking dependencies...
[12:00:00] ✓ Three.js loaded
[12:00:00] ✓ JSZip loaded
[12:00:00] Initializing Blitz3D Runtime...
[12:00:00] ✓ Core initialized
[12:00:00] ✓ Graphics initialized
[12:00:00] ✓ Physics initialized
[12:00:00] ✓ Input initialized
[12:00:00] ✓ Audio module loaded
[12:00:00] ✓ Virtual FS loaded
```

### Audio Test

```
[12:00:05] Testing FSOUND_Init...
[12:00:05] ✓ Audio context initialized
[12:00:05]   Sample rate: 48000Hz
[12:00:05]   State: running
[12:00:10] Playing test beep (440Hz sine wave)...
[12:00:10] ✓ Beep played
```

### WASM Module Test

```
[12:00:15] Loading test_audio.wasm...
[12:00:15] ✓ Loaded 10922 bytes
[12:00:15] Instantiating WebAssembly module...
[12:00:15] ✓ WASM module instantiated
[12:00:15]   Exports: 318
[12:00:15] Calling _start()...
[12:00:15] [Blitz3D] String: Audio initialized successfully
[12:00:15] [Blitz3D] String: Audio test complete
[12:00:15] ✓ Program executed
```

---

## Troubleshooting

### "Failed to fetch" Error

**Problem**: WASM files not found

**Solution**:

- Make sure WASM files are in the same directory as test_runtime.html
- Or update file paths in the HTML
- Check HTTP server is running

### Audio Context Not Starting

**Problem**: Browser requires user interaction

**Solution**:

- Click "Initialize Audio" button first
- Modern browsers require user gesture to start audio

### Module Errors

**Problem**: `module.exports is not defined`

**Solution**:

- Make sure browser_compat.js loads first
- Check browser console for errors

### Three.js or JSZip Not Loading

**Problem**: CDN might be blocked or slow

**Solution**:

- Download libraries locally
- Update script src to local paths

---

## Interpreter Demo (Playwright + Deno)

Run a quick browser automation check against `web/interpreter.html` using the Vite dev server.

### Setup (one-time)

```bash
# Install Playwright browsers (default cache)
npx playwright install
```

If downloads are blocked, use a system Chrome instead:

```bash
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
export PLAYWRIGHT_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
```

The test also auto-detects a Playwright headless shell under
`~/Library/Caches/ms-playwright` if present.

### Run

```bash
deno task test:web:interpreter
```

### Browser Overrides

```bash
# Prefer a specific browser (chromium|firefox|webkit)
export PLAYWRIGHT_BROWSER=firefox

# Force headed mode
export PLAYWRIGHT_HEADLESS=0

# Use a specific Chromium channel (requires system install)
export PLAYWRIGHT_CHANNEL=chrome

# Allow headless → headed fallback on launch errors (default on, set to 0 to disable)
export PLAYWRIGHT_FALLBACK_HEADED=1
```

### Notes

- The test starts `deno task web:dev` on port `5173` by default.
- Override the port with `INTERPRETER_TEST_PORT=XXXX`.
- It uploads a small set of VFS fixtures (`badge1.jpg`, `demo.png`, `demo.txt`, plus sample `.b3d/.x/.rmesh`) and then cycles every example in the dropdown, clicking **Run** and asserting expected output.
- It writes a JSON report to `/tmp/interpreter_demo_report.json` (override with `INTERPRETER_TEST_REPORT_PATH`).
- For faster iteration, run a subset: `INTERPRETER_TEST_ONLY=hello,debugStubs deno task test:web:interpreter`.
- Override per-run interpreter timeout (ms): `INTERPRETER_TEST_TIMEOUT_MS=15000`.
- Override the per-example output wait (ms): `INTERPRETER_TEST_OUTPUT_TIMEOUT_MS=15000` (useful if a looping demo fails to print its expected banner).
- If a demo runs forever but never emits its expected output, the test will now time out while waiting for output and report the example as failed; add/adjust its initial `Print` or narrow the test with `INTERPRETER_TEST_ONLY` to keep CI quick.

---

## Loading SCPCB Assets

### With ZIP Files

```javascript
// In browser console or add to HTML
async function loadGameAssets() {
  await Blitz3D.vfs.loadZip("GFX/gfx.zip");
  await Blitz3D.vfs.loadZip("SFX/sounds.zip");
  console.log("Assets loaded!");
}
```

### Testing Asset Access

```javascript
// After mounting ZIPs
const fileExists = Blitz3D.vfs.resolveFile("textures/wall.png");
console.log("File found:", fileExists.found);
console.log("File size:", fileExists.data?.length);
```

---

## Next Steps

1. **Compile more .bb files** - Try Items.bb, Particles.bb
2. **Create ZIP with assets** - Package test textures/sounds
3. **Test full game loop** - Render, update, input
4. **Profile performance** - Check FPS and load times

---

## Known Limitations

- **No file writing** - Virtual FS is read-only for now
- **Async loading** - Audio/textures load asynchronously
- **Memory limits** - Large ZIPs may cause issues
- **CORS** - Files must be on same origin as HTML

---

## Files in This Directory

- `test_runtime.html` - Main test page
- `browser_compat.js` - Browser compatibility shim
- `Sources/Runtime/` - Runtime modules
- `*.wasm` - Compiled test programs (copy from /tmp/)

---

Happy testing! 🎮
