/*
 * SCP:CB Loading Screen Demo
 */

const canvas = document.getElementById('screen');
const statusEl = document.getElementById('status');
const ctx = canvas.getContext('2d');

let logicalWidth = 1024;
let logicalHeight = 768;
let scaleX = 1;
let scaleY = 1;

let clearColor = 'rgb(0,0,0)';
let currentColor = 'rgb(255,255,255)';
let currentFont = '20px CourierNew';

const images = new Map();
let nextImageId = 1;

const fonts = new Map();
let nextFontId = 1;

let gameExports = null;

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    scaleX = canvas.width / logicalWidth;
    scaleY = canvas.height / logicalHeight;
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

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
        return new TextDecoder().decode(bytes);
    } catch {
        return '';
    }
}

function writeString(memory, ptr, str) {
    const buffer = getSafeBuffer(memory.buffer);
    const view = new DataView(buffer);
    view.setInt32(ptr, 0, true);
    view.setInt32(ptr + 4, str.length, true);
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < str.length; i++) {
        bytes[ptr + 8 + i] = str.charCodeAt(i);
    }
    bytes[ptr + 8 + str.length] = 0;
}

const heapPointers = new Map();
function allocString(memory, str) {
    if (!memory) return 0;
    if (!heapPointers.has(memory)) heapPointers.set(memory, 1024 * 1024);
    let ptr = heapPointers.get(memory);
    const size = 8 + str.length + 4;
    if (ptr + size > memory.buffer.byteLength) {
        try { memory.grow(1); } catch { return 0; }
    }
    writeString(memory, ptr, str);
    heapPointers.set(memory, (ptr + size + 3) & ~3);
    return ptr;
}

async function loadFonts() {
    const fontDefs = [
        { family: 'CourierNew', url: 'assets/fonts/courier.ttf' },
        { family: 'CourierNewBold', url: 'assets/fonts/courier-bold.ttf' },
        { family: 'DSDigital', url: 'assets/fonts/ds-digital.ttf' },
    ];
    const faces = fontDefs.map(def => new FontFace(def.family, `url(${def.url})`));
    await Promise.all(faces.map(face => face.load()));
    faces.forEach(face => document.fonts.add(face));
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
    Graphics3D: (w, h) => {
        logicalWidth = w || logicalWidth;
        logicalHeight = h || logicalHeight;
        resizeCanvas();
        return 0;
    },
    ClsColor: (r, g, b) => { clearColor = `rgb(${r|0},${g|0},${b|0})`; return 0; },
    Cls: () => {
        applyTransform();
        ctx.fillStyle = clearColor;
        ctx.fillRect(0, 0, logicalWidth, logicalHeight);
        return 0;
    },
    Color: (r, g, b) => { currentColor = `rgb(${r|0},${g|0},${b|0})`; return 0; },
    Rect: (x, y, w, h, filled) => {
        applyTransform();
        if (filled) {
            ctx.fillStyle = currentColor;
            ctx.fillRect(x, y, w, h);
        } else {
            ctx.strokeStyle = currentColor;
            ctx.strokeRect(x, y, w, h);
        }
        return 0;
    },
    DrawImage: (id, x, y) => {
        const entry = images.get(id);
        if (!entry || !entry.img) return 0;
        applyTransform();
        ctx.drawImage(entry.img, x, y, entry.width, entry.height);
        return 0;
    },
    ImageWidth: (id) => images.get(id)?.width || 0,
    ImageHeight: (id) => images.get(id)?.height || 0,
    LoadImage: (pathPtr) => {
        const path = readString(memRefGetter(), pathPtr);
        const filename = normalizePath(path);
        const id = nextImageId++;
        const img = new Image();
        const entry = { img, width: 0, height: 0 };
        images.set(id, entry);
        img.onload = () => { entry.width = img.naturalWidth; entry.height = img.naturalHeight; };
        img.onerror = () => {
            if (filename !== filename.toLowerCase()) {
                img.src = `assets/${filename.toLowerCase()}`;
            }
        };
        img.src = `assets/${filename}`;
        return id;
    },
    LoadImage_Strict: (pathPtr) => getEnvFunctions(memRefGetter).LoadImage(pathPtr),

    AALoadFont: (pathPtr, size) => {
        const path = readString(memRefGetter(), pathPtr).toLowerCase();
        let family = 'CourierNew';
        if (path.includes('courbd')) family = 'CourierNewBold';
        return makeFontHandle(family, Math.max(8, size || 20));
    },
    AASetFont: (id) => { setFontById(id); return 0; },
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
    Mid: (ptr, start, len) => {
        const s = readString(memRefGetter(), ptr);
        return allocString(memRefGetter(), s.substr(Math.max(0, start - 1), len));
    },
    Lower: (ptr) => allocString(memRefGetter(), readString(memRefGetter(), ptr).toLowerCase()),
    Upper: (ptr) => allocString(memRefGetter(), readString(memRefGetter(), ptr).toUpperCase()),
    Trim: (ptr) => allocString(memRefGetter(), readString(memRefGetter(), ptr).trim()),
    Replace: (ptr, findPtr, replPtr) => {
        const s = readString(memRefGetter(), ptr);
        const f = readString(memRefGetter(), findPtr);
        const r = readString(memRefGetter(), replPtr);
        return allocString(memRefGetter(), s.split(f).join(r));
    },
    Chr: (v) => allocString(memRefGetter(), String.fromCharCode(v)),

    FileType: () => 1,
    RuntimeError: () => 0,
    DebugLog: () => 0,
    OpenFile: () => 0,
    ReadLine: () => allocString(memRefGetter(), ''),
    Eof: () => 1,
    CloseFile: () => 0,
    GetINIString: () => allocString(memRefGetter(), ''),
    GetINIInt: () => 0,

    LoadSound: () => 0,
    LoadSound_Strict: () => 0,
    LoadTempSound: () => 0,
    PlaySound_Strict: () => 0,
    PlaySound: () => 0,
    ChannelPlaying: () => 0,
    StopChannel: () => 0,
    Flip: () => 0,
});

function buildImports(module, memRefGetter) {
    const funcs = getEnvFunctions(memRefGetter);
    const result = { env: {}, blitz3d: {}, al: {} };
    WebAssembly.Module.imports(module).forEach((imp) => {
        const target = result[imp.module] || result.env;
        target[imp.name] = funcs[imp.name] || (() => 0);
    });
    return result;
}

async function start() {
    statusEl.textContent = 'Loading fonts...';
    await loadFonts();

    statusEl.textContent = 'Loading WASM...';
    const wasmRes = await fetch('Loading.wasm');
    const wasmModule = await WebAssembly.compile(await wasmRes.arrayBuffer());
    const instance = await WebAssembly.instantiate(wasmModule, buildImports(wasmModule, () => gameExports?.memory));
    gameExports = instance.exports;

    const mainFunc = gameExports.Main || gameExports.main;
    if (mainFunc) mainFunc();

    const drawLoading = gameExports.DrawLoading || gameExports.drawloading;
    statusEl.textContent = 'Running...';

    let percent = 0;
    let direction = 1;

    function frame() {
        if (drawLoading) {
            drawLoading(percent, 0);
        }
        percent += direction;
        if (percent >= 100) { percent = 100; direction = -1; }
        if (percent <= 0) { percent = 0; direction = 1; }
        requestAnimationFrame(frame);
    }
    frame();
}

start().catch((err) => {
    console.error(err);
    statusEl.textContent = 'Failed to start.';
});