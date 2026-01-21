/*
 * SCP: Containment Breach - Menu Demo
 * Loads Menu.wasm and renders UpdateMainMenu() using Canvas 2D.
 */

const canvasWrap = document.getElementById('canvas-wrap');
const canvas = document.getElementById('screen');
const statusEl = document.getElementById('status');
const debugPanel = document.getElementById('debug-panel');
const debugStatsEl = document.getElementById('debug-stats');
const debugLogEl = document.getElementById('debug-log');
const debugToggleBtn = document.getElementById('debug-toggle');

const ctx = canvas.getContext('2d');

let logicalWidth = 1024;
let logicalHeight = 768;
let scaleX = 1;
let scaleY = 1;

let clearColor = 'rgb(0,0,0)';
let currentColor = 'rgb(255,255,255)';
let currentFont = '20px CourierNew';

let mouseX = 0;
let mouseY = 0;
let mouseHit = { 1: 0, 2: 0, 3: 0 };
let mouseDown = { 1: false, 2: false, 3: false };

const images = new Map();
const imagePathToId = new Map();
let nextImageId = 1;

const fonts = new Map();
let nextFontId = 1;

let gameExports = null;
let debugVisible = false;
const logBuffer = [];
const maxLogLines = 80;
const textDecoder = new TextDecoder();

// A small, reusable arena for JS->WASM strings returned by runtime stubs.
// Without this, a bump allocator makes the demo "leak" WASM memory as the game
// repeatedly calls functions like GetINIString/ReadLine/etc.
const stringArenas = new Map(); // WebAssembly.Memory -> { base, slotSize, slots, index }
const internedStrings = new Map(); // JS string -> WASM string pointer

// Debug counters to help track memory pressure without devtools.
let jsToWasmStringAllocs = 0;
let jsToWasmStringBytes = 0;
let wasmMemoryGrows = 0;

// Avoid spamming the UI thread with repeated error logs (which can look like a "freeze").
const loggedOnce = new Set();
function logOnce(key, level, ...args) {
    if (loggedOnce.has(key)) return;
    loggedOnce.add(key);
    console[level]?.(...args);
}

function pushLog(line) {
    logBuffer.push(line);
    while (logBuffer.length > maxLogLines) logBuffer.shift();
    if (!debugVisible) return;
    if (!debugLogEl) return;
    // Only update the DOM when the debug panel is visible. Updating on every
    // console log can stall the main thread if the program is chatty.
    debugLogEl.textContent = logBuffer.join('\n');
}

function debugLog(level, ...args) {
    if (!debugVisible) return;
    try {
        const rendered = args.map((a) => {
            if (a instanceof Error) return a.stack || a.message || String(a);
            if (typeof a === 'string') return a;
            if (typeof a === 'number' || typeof a === 'boolean' || a == null) return String(a);
            return Object.prototype.toString.call(a);
        }).join(' ');
        pushLog(`[${level}] ${rendered}`);
    } catch {
        // ignore formatting issues
    }
}

function toggleDebugPanel() {
    debugVisible = !debugVisible;
    if (debugPanel) {
        debugPanel.classList.toggle('hidden', !debugVisible);
    }
    // When enabling, render the current log buffer immediately.
    if (debugVisible && debugLogEl) {
        debugLogEl.textContent = logBuffer.join('\n');
        debugLogEl.scrollTop = debugLogEl.scrollHeight;
    }
}

if (debugToggleBtn) {
    debugToggleBtn.addEventListener('click', () => toggleDebugPanel());
}

window.addEventListener('keydown', (e) => {
    // Some keyboard layouts don't report ` as e.key; use e.code too.
    if (e.code === 'Backquote' || e.key === '`' || e.key === 'Dead' || e.key === '~' || e.key === 'F2') {
        toggleDebugPanel();
    }
});

function resizeCanvas() {
    const rect = canvasWrap.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    scaleX = canvas.width / logicalWidth;
    scaleY = canvas.height / logicalHeight;
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
});

canvas.addEventListener('mousedown', (e) => {
    const btn = e.button + 1;
    mouseDown[btn] = true;
    mouseHit[btn] = 1;
});

canvas.addEventListener('mouseup', (e) => {
    const btn = e.button + 1;
    mouseDown[btn] = false;
});

function applyTransform() {
    ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
}

function normalizePath(path) {
    if (!path) return '';
    const cleaned = path.replace(/\\/g, '/');
    return cleaned.split('/').pop();
}

function getSafeBuffer(data) {
    if (!data) return new ArrayBuffer(0);
    if (data instanceof ArrayBuffer) return data;
    if (data.buffer instanceof ArrayBuffer) return data.buffer;
    return new ArrayBuffer(0);
}

function readString(memory, ptr) {
    if (!ptr || !memory) return '';
    try {
        const buffer = getSafeBuffer(memory.buffer);
        const view = new DataView(buffer);
        const length = view.getInt32(ptr + 4, true);
        if (length <= 0 || length > 100000) return '';
        const bytes = new Uint8Array(buffer, ptr + 8, length);
        return textDecoder.decode(bytes);
    } catch {
        return '';
    }
}

function writeString(memory, ptr, str, maxBytes = Infinity) {
    const buffer = getSafeBuffer(memory.buffer);
    const byteLength = buffer.byteLength >>> 0;
    const offset = ptr >>> 0;
    if (offset + 8 >= byteLength) {
        logOnce('writeString_oob', 'error', '[writeString] OOB write', { ptr, byteLength });
        return false;
    }

    const view = new DataView(buffer);
    view.setInt32(offset, 0, true);
    const safe = (str ?? '').slice(0, Math.max(0, Math.min((str ?? '').length, maxBytes)));
    view.setInt32(offset + 4, safe.length, true);
    const bytes = new Uint8Array(buffer);
    const maxCopy = Math.max(0, Math.min(safe.length, byteLength - (offset + 9)));
    for (let i = 0; i < maxCopy; i++) {
        bytes[offset + 8 + i] = safe.charCodeAt(i);
    }
    bytes[offset + 8 + maxCopy] = 0;
    return true;
}

const heapPointers = new Map();
function allocString(memory, str) {
    if (!memory) return 0;
    const s = String(str ?? '');

    // Prefer the module's string heap allocator when available so we don't
    // scribble over unrelated heap regions.
    if (gameExports && typeof gameExports.__StringAlloc === 'function') {
        // WebAssembly i32 results are sign-extended; normalize to a uint32 offset.
        const ptr = (gameExports.__StringAlloc(s.length) >>> 0);
        const end = (ptr + 9 + s.length) >>> 0; // header + NUL
        const pageSize = 64 * 1024;
        if (end > (memory.buffer.byteLength >>> 0)) {
            const neededPages = Math.ceil((end - (memory.buffer.byteLength >>> 0)) / pageSize);
            if (neededPages > 0) {
                try { memory.grow(neededPages); wasmMemoryGrows += neededPages; } catch { /* ignore */ }
            }
        }
        // If we still can't fit, bail out safely instead of crashing the page.
        const byteLength = memory.buffer.byteLength >>> 0;
        if (ptr + 9 > byteLength) {
            logOnce('allocString_oob', 'error', '[allocString] OOB ptr from __StringAlloc', { ptr, byteLength, len: s.length });
            return 0;
        }

        const maxChars = Math.max(0, byteLength - (ptr + 9));
        if (s.length > maxChars) {
            logOnce('allocString_trunc', 'warn', '[allocString] Truncating string to fit memory', { requested: s.length, maxChars });
        }

        writeString(memory, ptr, s, maxChars);
        jsToWasmStringAllocs += 1;
        jsToWasmStringBytes += s.length;
        return ptr;
    }

    if (!heapPointers.has(memory)) heapPointers.set(memory, 1024 * 1024);
    let ptr = heapPointers.get(memory);
    const size = 8 + s.length + 4;
    if (ptr + size > memory.buffer.byteLength) {
        try { memory.grow(1); wasmMemoryGrows += 1; } catch { return 0; }
    }
    writeString(memory, ptr, s);
    heapPointers.set(memory, (ptr + size + 3) & ~3);
    jsToWasmStringAllocs += 1;
    jsToWasmStringBytes += s.length;
    return ptr;
}

function allocTempString(memory, str) {
    if (!memory) return 0;

    let arena = stringArenas.get(memory);
    if (!arena) {
        const slots = 64;
        const slotSize = 4096; // bytes per slot (incl. header)
        const totalBytes = slots * slotSize;

        if (!heapPointers.has(memory)) heapPointers.set(memory, 1024 * 1024);
        const arenaBase = heapPointers.get(memory);
        const end = arenaBase + totalBytes;
        if (end > memory.buffer.byteLength) {
            const neededPages = Math.ceil((end - memory.buffer.byteLength) / (64 * 1024));
            try { memory.grow(neededPages); } catch { /* ignore */ }
        }
        heapPointers.set(memory, (arenaBase + totalBytes + 3) & ~3);

        arena = { base: arenaBase, slotSize, slots, index: 0 };
        stringArenas.set(memory, arena);
        console.log(`[strings] Initialized temp string arena: ${slots} slots @ ${slotSize} bytes`);
    }

    const slotPtr = arena.base + arena.index * arena.slotSize;
    arena.index = (arena.index + 1) % arena.slots;
    const maxChars = arena.slotSize - 9; // 8-byte header + trailing NUL
    writeString(memory, slotPtr, str ?? '', maxChars);
    return slotPtr;
}

function internString(memory, str) {
    const s = String(str ?? '');
    const cached = internedStrings.get(s);
    if (cached) return cached;
    const ptr = allocString(memory, s);
    if (ptr) internedStrings.set(s, ptr);
    return ptr;
}

async function loadFonts() {
    const fontDefs = [
        { family: 'CourierNew', url: 'assets/fonts/courier.ttf' },
        { family: 'CourierNewBold', url: 'assets/fonts/courier-bold.ttf' },
        { family: 'DSDigital', url: 'assets/fonts/ds-digital.ttf' },
        { family: 'Journal', url: 'assets/fonts/journal.ttf' },
    ];
    const faces = fontDefs.map(def => new FontFace(def.family, `url(${def.url})`));

    const loadPromise = Promise.all(faces.map(face => face.load()))
        .then(() => {
            faces.forEach(face => document.fonts.add(face));
            console.log('[fonts] Loaded menu fonts');
        })
        .catch((err) => {
            console.warn('[fonts] Failed to load one or more fonts, continuing with fallbacks', err);
        });

    // Avoid hanging forever on slow/blocked font loads.
    const timeoutPromise = new Promise((resolve) => setTimeout(() => {
        console.warn('[fonts] Timeout waiting for fonts; continuing with system fallbacks');
        resolve();
    }, 2000));

    await Promise.race([loadPromise, timeoutPromise]);
}

function makeFontHandle(family, sizePx) {
    const id = nextFontId++;
    fonts.set(id, { family, sizePx });
    return id;
}

function setFontById(id) {
    const font = fonts.get(id);
    if (!font) return;
    currentFont = `${font.sizePx}px ${font.family}`;
}

const getEnvFunctions = (memRefGetter) => ({
    // Avoid spamming the console by default; these can be extremely chatty.
    PrintInt: (v) => { debugLog('log', v); return 0; },
    PrintFloat: (v) => { debugLog('log', v); return 0; },
    PrintString: (ptr) => { debugLog('log', readString(memRefGetter(), ptr)); return 0; },
    Print: (ptr) => { debugLog('log', readString(memRefGetter(), ptr)); return 0; },

    Graphics3D: (w, h) => {
        logicalWidth = w || logicalWidth;
        logicalHeight = h || logicalHeight;
        resizeCanvas();
        return 0;
    },

    Color: (r, g, b) => {
        currentColor = `rgb(${r|0},${g|0},${b|0})`;
        return 0;
    },

    Rect: (x, y, w, h, filled) => {
        applyTransform();
        ctx.beginPath();
        if (filled) {
            ctx.fillStyle = currentColor;
            ctx.fillRect(x, y, w, h);
        } else {
            ctx.strokeStyle = currentColor;
            ctx.strokeRect(x, y, w, h);
        }
        return 0;
    },

    ClsColor: (r, g, b) => {
        clearColor = `rgb(${r|0},${g|0},${b|0})`;
        return 0;
    },

    Cls: () => {
        applyTransform();
        ctx.fillStyle = clearColor;
        ctx.fillRect(0, 0, logicalWidth, logicalHeight);
        return 0;
    },

    DrawImage: (id, x, y) => {
        const entry = images.get(id);
        if (!entry || !entry.img) return 0;
        applyTransform();
        ctx.save();
        const angle = (entry.rotation || 0) * Math.PI / 180;
        if (angle !== 0) {
            ctx.translate(x, y);
            ctx.rotate(angle);
            ctx.drawImage(entry.img, -entry.handleX, -entry.handleY, entry.width, entry.height);
        } else {
            ctx.drawImage(entry.img, x - entry.handleX, y - entry.handleY, entry.width, entry.height);
        }
        ctx.restore();
        return 0;
    },

    DrawBlock: (id, x, y) => getEnvFunctions(memRefGetter).DrawImage(id, x, y),
    TileImage: (id, x, y) => getEnvFunctions(memRefGetter).DrawImage(id, x, y),

    DrawImageRect: (id, x, y, srcX, srcY, srcW, srcH) => {
        const entry = images.get(id);
        if (!entry || !entry.img) return 0;
        applyTransform();
        ctx.drawImage(entry.img, srcX, srcY, srcW, srcH, x, y, srcW, srcH);
        return 0;
    },

    DrawImageRectScaled: (id, x, y, w, h, srcX, srcY, srcW, srcH) => {
        const entry = images.get(id);
        if (!entry || !entry.img) return 0;
        applyTransform();
        ctx.drawImage(entry.img, srcX, srcY, srcW, srcH, x, y, w, h);
        return 0;
    },

    Text: (x, y, ptr, centerX, centerY) => {
        const text = readString(memRefGetter(), ptr);
        applyTransform();
        ctx.fillStyle = currentColor;
        ctx.font = currentFont;
        let drawX = x;
        let drawY = y;
        if (centerX) {
            const width = ctx.measureText(text).width;
            drawX -= width / 2;
        }
        if (centerY) {
            const match = /^(\d+)px/.exec(currentFont);
            const size = match ? parseInt(match[1], 10) : 20;
            drawY += size / 2;
        }
        ctx.fillText(text, drawX, drawY);
        return 0;
    },

    AAText: (x, y, ptr, centerX, centerY) => {
        const text = readString(memRefGetter(), ptr);
        applyTransform();
        ctx.fillStyle = currentColor;
        ctx.font = currentFont;
        let drawX = x;
        let drawY = y;
        if (centerX) {
            const width = ctx.measureText(text).width;
            drawX -= width / 2;
        }
        if (centerY) {
            const match = /^(\d+)px/.exec(currentFont);
            const size = match ? parseInt(match[1], 10) : 20;
            drawY += size / 2;
        }
        ctx.fillText(text, drawX, drawY);
        return 0;
    },

    AASetFont: (fontId) => { setFontById(fontId); return 0; },
    SetFont: (fontId) => { setFontById(fontId); return 0; },

    AALoadFont: (pathPtr, size) => {
        const path = readString(memRefGetter(), pathPtr).toLowerCase();
        let family = 'CourierNew';
        if (path.includes('courbd')) family = 'CourierNewBold';
        else if (path.includes('ds-digi')) family = 'DSDigital';
        else if (path.includes('journal')) family = 'Journal';
        else if (path.includes('blitz')) family = 'CourierNew';
        return makeFontHandle(family, Math.max(8, size || 20));
    },

    LoadFont_Strict: (pathPtr, size) => {
        const path = readString(memRefGetter(), pathPtr).toLowerCase();
        let family = 'CourierNew';
        if (path.includes('courbd')) family = 'CourierNewBold';
        return makeFontHandle(family, Math.max(8, size || 18));
    },

    LoadFont: (pathPtr, size) => {
        const path = readString(memRefGetter(), pathPtr).toLowerCase();
        let family = 'CourierNew';
        if (path.includes('courbd')) family = 'CourierNewBold';
        else if (path.includes('ds-digi')) family = 'DSDigital';
        else if (path.includes('journal')) family = 'Journal';
        else if (path.includes('blitz')) family = 'CourierNew';
        return makeFontHandle(family, Math.max(8, size || 18));
    },

    StringWidth: (ptr) => {
        const text = readString(memRefGetter(), ptr);
        ctx.font = currentFont;
        return ctx.measureText(text).width | 0;
    },

    AAStringWidth: (ptr) => {
        const text = readString(memRefGetter(), ptr);
        ctx.font = currentFont;
        return ctx.measureText(text).width | 0;
    },

    StringHeight: () => {
        const match = /^(\d+)px/.exec(currentFont);
        return match ? parseInt(match[1], 10) : 20;
    },

    AAStringHeight: () => {
        const match = /^(\d+)px/.exec(currentFont);
        return match ? parseInt(match[1], 10) : 20;
    },

    LoadImage: (pathPtr) => {
        const path = readString(memRefGetter(), pathPtr);
        const filename = normalizePath(path);
        const cacheKey = filename.toLowerCase();
        const cached = imagePathToId.get(cacheKey);
        if (cached) return cached;
        const id = nextImageId++;
        const img = new Image();
        const entry = { img, width: 0, height: 0, handleX: 0, handleY: 0, rotation: 0 };
        images.set(id, entry);
        imagePathToId.set(cacheKey, id);
        img.onload = () => {
            entry.width = img.naturalWidth;
            entry.height = img.naturalHeight;
        };
        img.onerror = () => {
            if (filename !== filename.toLowerCase()) {
                img.src = `assets/${filename.toLowerCase()}`;
            }
        };
        img.src = `assets/${filename}`;
        return id;
    },

    LoadImage_Strict: (pathPtr) => {
        return getEnvFunctions(memRefGetter).LoadImage(pathPtr);
    },

    ImageWidth: (id) => images.get(id)?.width || 0,
    ImageHeight: (id) => images.get(id)?.height || 0,

    ResizeImage: (id, w, h) => {
        const entry = images.get(id);
        if (!entry || !entry.img) return 0;
        const targetW = Math.max(1, w | 0);
        const targetH = Math.max(1, h | 0);
        if (entry.width === targetW && entry.height === targetH) return 0;
        const off = document.createElement('canvas');
        off.width = targetW;
        off.height = targetH;
        const octx = off.getContext('2d');
        octx.drawImage(entry.img, 0, 0, off.width, off.height);
        entry.img = off;
        entry.width = off.width;
        entry.height = off.height;
        return 0;
    },

    RotateImage: (id, angle) => {
        const entry = images.get(id);
        if (entry) entry.rotation = angle;
        return 0;
    },

    HandleImage: (id, hx, hy) => {
        const entry = images.get(id);
        if (entry) { entry.handleX = hx; entry.handleY = hy; }
        return 0;
    },

    MidHandle: (id) => {
        const entry = images.get(id);
        if (entry) {
            entry.handleX = (entry.width / 2) | 0;
            entry.handleY = (entry.height / 2) | 0;
        }
        return 0;
    },

    AutoMidHandle: (id) => getEnvFunctions(memRefGetter).MidHandle(id),

    ScaleImage: (id, sx, sy) => {
        const entry = images.get(id);
        if (!entry) return 0;
        const w = Math.max(1, Math.round(entry.width * sx));
        const h = Math.max(1, Math.round(entry.height * sy));
        return getEnvFunctions(memRefGetter).ResizeImage(id, w, h);
    },

    MaskImage: () => 0,
    FreeImage: () => 0,
    ShowPointer: () => 0,

    MouseX: () => Math.round(mouseX / scaleX),
    MouseY: () => Math.round(mouseY / scaleY),
    ScaledMouseX: () => Math.round(mouseX / scaleX),
    ScaledMouseY: () => Math.round(mouseY / scaleY),

    MouseHit: (btn) => {
        const v = mouseHit[btn] ? 1 : 0;
        mouseHit[btn] = 0;
        return v;
    },

    MouseDown: (btn) => (mouseDown[btn] ? 1 : 0),

    MouseOn: (x, y, w, h) => {
        const mx = mouseX / scaleX;
        const my = mouseY / scaleY;
        return (mx >= x && mx <= x + w && my >= y && my <= y + h) ? 1 : 0;
    },

    Rand: (min, max) => {
        if (max === undefined) { max = min; min = 0; }
        const lo = Math.min(min, max);
        const hi = Math.max(min, max);
        return (Math.floor(Math.random() * (hi - lo + 1)) + lo) | 0;
    },

    MilliSecs: () => performance.now() | 0,
    MilliSecs2: () => performance.now() | 0,

    Len: (ptr) => readString(memRefGetter(), ptr).length,
    Left: (ptr, n) => allocString(memRefGetter(), readString(memRefGetter(), ptr).slice(0, n)),
    Right: (ptr, n) => {
        const s = readString(memRefGetter(), ptr);
        return allocString(memRefGetter(), s.slice(Math.max(0, s.length - n)));
    },
    Mid: (ptr, start, len) => {
        const s = readString(memRefGetter(), ptr);
        return allocString(memRefGetter(), s.substr(Math.max(0, start - 1), len));
    },
    Lower: (ptr) => internString(memRefGetter(), readString(memRefGetter(), ptr).toLowerCase()),
    Upper: (ptr) => internString(memRefGetter(), readString(memRefGetter(), ptr).toUpperCase()),
    Trim: (ptr) => internString(memRefGetter(), readString(memRefGetter(), ptr).trim()),
    Replace: (ptr, findPtr, replPtr) => {
        const s = readString(memRefGetter(), ptr);
        const f = readString(memRefGetter(), findPtr);
        const r = readString(memRefGetter(), replPtr);
        return internString(memRefGetter(), s.split(f).join(r));
    },
    Chr: (v) => internString(memRefGetter(), String.fromCharCode(v)),
    StringEqual: (p1, p2) => readString(memRefGetter(), p1) === readString(memRefGetter(), p2) ? 1 : 0,
    StringConcat: (p1, p2) => {
        const s1 = readString(memRefGetter(), p1);
        const s2 = readString(memRefGetter(), p2);
        return internString(memRefGetter(), s1 + s2);
    },
    IntToString: (v) => internString(memRefGetter(), (v | 0).toString()),
    FloatToString: (v) => internString(memRefGetter(), String(v)),

    FileType: () => 1,
    RuntimeError: (ptr) => { debugLog('error', readString(memRefGetter(), ptr)); return 0; },
    DebugLog: (ptr) => { debugLog('log', readString(memRefGetter(), ptr)); return 0; },
    OpenFile: () => 0,
    ReadLine: () => internString(memRefGetter(), ''),
    Eof: () => 1,
    CloseFile: () => 0,
    GetINIString: () => internString(memRefGetter(), ''),
    GetINIInt: () => 0,
    PutINIValue: () => 0,

    LoadSound: () => 0,
    LoadSound_Strict: () => 0,
    LoadTempSound: () => 0,
    PlaySound_Strict: () => 0,
    PlaySound: () => 0,
    StopChannel: () => 0,
    ChannelPlaying: () => 0,

    Flip: () => 0,
});

function buildImports(module, memRefGetter) {
    const funcs = getEnvFunctions(memRefGetter);
    const result = { env: {}, blitz3d: {}, al: {} };
    WebAssembly.Module.imports(module).forEach((imp) => {
        const target = result[imp.module] || result.env;
        // Default stub returns 0; keep it silent to avoid log-induced stalls.
        target[imp.name] = funcs[imp.name] || (() => 0);
    });
    return result;
}

async function start() {
    statusEl.textContent = 'Loading fonts + WASM...';
    const fontsPromise = loadFonts();
    const wasmBytesPromise = fetch('Menu.wasm').then((r) => r.arrayBuffer());
    const [, wasmBytes] = await Promise.all([fontsPromise, wasmBytesPromise]);

    statusEl.textContent = 'Compiling WASM...';
    const wasmModule = await WebAssembly.compile(wasmBytes);
    const instance = await WebAssembly.instantiate(wasmModule, buildImports(wasmModule, () => gameExports?.memory));
    gameExports = instance.exports;

    statusEl.textContent = 'Running...';

    const updateMenu = gameExports.UpdateMainMenu || gameExports.updatemainmenu;
    const initMenu = gameExports.InitLoadingScreens || gameExports.initloadingscreens;
    const mainFunc = gameExports.Main || gameExports.main;

    const setGlobal = (name, value) => {
        const g = gameExports[name] || gameExports[name.toLowerCase()];
        if (g instanceof WebAssembly.Global) {
            g.value = value;
            return true;
        }
        return false;
    };

    setGlobal('MenuScale', 1);
    setGlobal('GraphicWidth', logicalWidth);
    setGlobal('GraphicHeight', logicalHeight);
    setGlobal('RealGraphicWidth', logicalWidth);
    setGlobal('RealGraphicHeight', logicalHeight);

    if (mainFunc) {
        mainFunc();
    }

    const ensureFont = (name, family, sizePx) => {
        const g = gameExports[name] || gameExports[name.toLowerCase()];
        if (g instanceof WebAssembly.Global && g.value === 0) {
            g.value = makeFontHandle(family, sizePx);
        }
    };
    ensureFont('Font1', 'CourierNew', 18);
    ensureFont('Font2', 'CourierNewBold', 48);
    ensureFont('ConsoleFont', 'CourierNew', 20);

    if (initMenu) {
        const mem = gameExports.memory;
        const iniPath = allocString(mem, 'Loadingscreens/LoadingScreens.ini');
        initMenu(iniPath);
    }

let lastStatsTime = performance.now();
let lastWasmBytes = 0;
let lastJsHeap = 0;

function frame() {
        if (updateMenu) {
            updateMenu();
        }

        // Lightweight memory/asset stats to spot leaks without devtools
        if (debugVisible && debugStatsEl) {
            const mem = gameExports?.memory;
            const wasmBytes = mem ? mem.buffer.byteLength : 0;
            const jsHeap = performance?.memory?.usedJSHeapSize || 0;
            const imgCount = images.size;

            const now = performance.now();
            const dt = now - lastStatsTime;
            // Smooth rates by sampling a few times per second.
            let wasmRate = 0;
            let jsRate = 0;
            if (dt >= 250) {
                wasmRate = ((wasmBytes - lastWasmBytes) / dt) * 1000; // bytes/sec
                jsRate = ((jsHeap - lastJsHeap) / dt) * 1000; // bytes/sec
                lastStatsTime = now;
                lastWasmBytes = wasmBytes;
                lastJsHeap = jsHeap;
            }

            debugStatsEl.textContent =
                `WASM ${(wasmBytes / 1024 / 1024).toFixed(2)} MB (${(wasmRate / 1024 / 1024).toFixed(2)} MB/s)` +
                ` | JS ${(jsHeap / 1024 / 1024).toFixed(2)} MB (${(jsRate / 1024 / 1024).toFixed(2)} MB/s)` +
                ` | Images ${imgCount}` +
                ` | StringAllocs ${jsToWasmStringAllocs} (${(jsToWasmStringBytes / 1024).toFixed(1)} KB)` +
                ` | MemGrow ${wasmMemoryGrows}`;
        }

        requestAnimationFrame(frame);
    }
    frame();
}

start().catch((err) => {
    console.error(err);
    statusEl.textContent = 'Failed to start.';
});
