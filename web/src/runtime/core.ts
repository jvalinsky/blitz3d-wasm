/**
 * Blitz3D Runtime Core Module
 * Essential functionality and initialization
 */
import JSZip from 'jszip';

export class Blitz3DCore {
    [key: string]: any;

    constructor() {
        this.memory = null;
        this.canvas = null;
        this.gl = null;
        this.textCanvas = null;
        this.ctx2d = null;
        this.instance = null;
        this.module = null;
        this.exports = null;
        this.dataPointer = 256;
        this.allocString = null;

        // Seeded random number generator (LCG)
        this.randomSeed = 0;
        this.randomState = 0;

        // Performance monitoring
        this.frameCount = 0;
        this.lastFrameTime = 0;
        this.fps = 0;
        this.frameTimes = [];
        this.maxFrameSamples = 60;

        // Memory tracking
        this.heapAllocations = 0;
        this.stringAllocations = 0;

        // Optimization flags
        this.useBatchRendering = true;
        this.useGeometryInstancing = false;
        this.cachedTextureLookups = true;
        this.currentDir = "/";

        // Banks support
        this.banks = new Map();
        this.nextBankId = 1;
    }

    // Performance monitoring
    beginFrame() {
        const now = performance.now();
        if (this.lastFrameTime > 0) {
            const frameTime = now - this.lastFrameTime;
            this.frameTimes.push(frameTime);
            if (this.frameTimes.length > this.maxFrameSamples) {
                this.frameTimes.shift();
            }
            // Calculate rolling average FPS
            if (this.frameTimes.length === this.maxFrameSamples) {
                const avgFrameTime = this.frameTimes.reduce((a, b) => a + b, 0) / this.maxFrameSamples;
                this.fps = 1000 / avgFrameTime;
            }
        }
        this.lastFrameTime = now;
        this.frameCount++;
    }

    getPerformanceStats() {
        return {
            fps: this.fps.toFixed(1),
            frameCount: this.frameCount,
            heapAllocations: this.heapAllocations,
            stringAllocations: this.stringAllocations,
            memoryUsage: this.memory ? (this.memory.buffer.byteLength / 1024).toFixed(1) + ' KB' : 'N/A'
        };
    }

    // Linear Congruential Generator for seeded random
    seedRnd(seed) {
        this.randomSeed = seed;
        this.randomState = seed;
    }

    // Returns float in [0, 1)
    rndFloat(min, max) {
        if (min === undefined) min = 0;
        if (max === undefined) max = 1;

        // If seed is 0 (uninitialized), use Math.random
        if (this.randomSeed === 0) {
            return Math.random() * (max - min) + min;
        }

        // LCG: x_{n+1} = (a * x_n + c) mod m
        // Using parameters from Numerical Recipes
        this.randomState = (1664525 * this.randomState + 1013904223) % 4294967296;
        const normalized = this.randomState / 4294967296;
        return normalized * (max - min) + min;
    }

    // Returns integer in [min, max]
    rndInt(min, max) {
        return Math.floor(this.rndFloat(min, max + 1));
    }

    init(canvasId) {
        this.canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
        if (!this.canvas) {
            console.error("Canvas not found: " + canvasId);
            return;
        }

        // Ensure WebGL canvas is not used for 2D contexts
        if (this.canvas.getContext('2d')) {
            console.warn('Core init: canvas already has 2D context; creating dedicated WebGL canvas');
            const glCanvas = document.createElement('canvas');
            glCanvas.width = this.canvas.width || 800;
            glCanvas.height = this.canvas.height || 600;
            glCanvas.id = this.canvas.id;
            glCanvas.style.width = this.canvas.style.width;
            glCanvas.style.height = this.canvas.style.height;
            glCanvas.style.display = this.canvas.style.display || 'block';
            glCanvas.style.position = this.canvas.style.position || 'relative';
            if (this.canvas.parentElement) {
                this.canvas.parentElement.replaceChild(glCanvas, this.canvas);
            }
            this.canvas = glCanvas;
        }

        // Setup 2D overlay canvas for Text commands
        this.textCanvas = document.createElement('canvas');
        this.textCanvas.width = this.canvas.width;
        this.textCanvas.height = this.canvas.height;
        this.textCanvas.style.position = 'absolute';
        this.textCanvas.style.top = '0';
        this.textCanvas.style.left = '0';
        this.textCanvas.style.pointerEvents = 'none';
        if (this.canvas.parentElement) {
            this.canvas.parentElement.appendChild(this.textCanvas);
        }
        this.ctx2d = this.textCanvas.getContext('2d');

        console.log("Blitz3D Runtime Core Initialized");
    }

    readString(ptr) {
        if (!this.memory || !this.memory.buffer) {
            return "";
        }
        const memory = new Uint8Array(this.memory.buffer);
        const maxLen = memory.length;
        let str = "";
        let i = ptr;
        const maxStringLen = 1024 * 1024;
        let charsRead = 0;
        while (i < maxLen && charsRead < maxStringLen) {
            const byte = memory[i];
            if (byte === 0) break;
            str += String.fromCharCode(byte);
            i++;
            charsRead++;
        }
        return str;
    }

    setupCommonImports(imports) {
        // Math utilities
        imports.env.WrapAngle = (angle) => {
            // Normalize angle to -180 to 180
            while (angle > 180) angle -= 360;
            while (angle < -180) angle += 360;
            return angle;
        };

        imports.env.DeltaYaw = (src, dest) => {
            let delta = dest - src;
            while (delta > 180) delta -= 360;
            while (delta < -180) delta += 360;
            return delta;
        };

        imports.env.DeltaPitch = (src, dest) => {
            let delta = dest - src;
            while (delta > 180) delta -= 360;
            while (delta < -180) delta += 360;
            return delta;
        };

        imports.env.CurveValue = (current, target, speed) => {
            // Smooth interpolation towards target
            return current + (target - current) * speed;
        };

        imports.env.CurveAngle = (current, target, speed) => {
            // Smooth angle interpolation
            let delta = target - current;
            while (delta > 180) delta -= 360;
            while (delta < -180) delta += 360;
            return current + delta * speed;
        };

        imports.env.Distance = (x1, y1, x2, y2) => {
            const dx = x2 - x1;
            const dy = y2 - y1;
            return Math.sqrt(dx * dx + dy * dy);
        };

        imports.env.Point_Direction = (x1, y1, x2, y2) => {
            const dx = x2 - x1;
            const dy = y2 - y1;
            return Math.atan2(dy, dx) * 180 / Math.PI;
        };

        imports.env.DebugLog = (msgPtr) => {
            const msg = this.readString(msgPtr);
            console.log(`[Blitz3D Debug] ${msg}`);
        };

        imports.env.AppTitle = (titlePtr, closeMsgPtr) => {
            const title = this.readString(titlePtr);
            document.title = title;
            console.log(`[Blitz3D] AppTitle: ${title}`);
        };

        imports.env.MilliSecs2 = () => performance.now() | 0;

        imports.env.SystemProperty = (propPtr) => {
            const prop = this.readString(propPtr).toLowerCase();
            let result = "";
            if (prop === "os") result = "windows";
            else if (prop === "language") result = "en";
            else if (prop === "appdir") result = "/";
            else return 0; // Better safe than empty string pointer if not matched

            if (this.allocString) return this.allocString(result);
            return 0;
        };

        imports.env.RemoveEvent = (eventPtr) => {
            console.log(`RemoveEvent: event=${eventPtr}`);
        };

        imports.env.RuntimeError = (msgPtr) => {
            const msg = this.readString(msgPtr);
            console.error(`[Blitz3D Error] ${msg}`);
            throw new Error(msg);
        };

        imports.env.End = () => {
            console.log("[Blitz3D] Program Ended");
            throw new Error("Program Ended");
        };

        imports.env.ExecFile = (filePtr) => {
            const file = this.readString(filePtr);
            console.warn(`[Blitz3D] ExecFile requested: ${file} (Ignored in browser)`);
        };

        imports.env.CatchErrors = () => {
            console.log("[Blitz3D] CatchErrors enabled");
        };

        imports.env.MilliSecs = () => {
            return Date.now() & 0x7FFFFFFF;
        };

        imports.env.MilliSecs2 = () => {
            return Date.now() & 0x7FFFFFFF; // Keep as signed 32-bit int
        };

        imports.env.DebugLog = (msgPtr) => {
            const msg = this.readString(msgPtr);
            console.log(`[BB Debug] ${msg}`);
        };

        imports.env.Delay = (ms) => {
            // Busy wait or ignore? Usually BB Delay is used for frame limiting.
            // In browser, we should definitely NOT busy wait.
            console.log(`[BB] Delay(${ms}) requested - ignoring to keep browser responsive`);
        };

        imports.env.CurrentDate = () => {
            const now = new Date();
            const dateStr = now.toLocaleDateString();
            return this.allocString(dateStr);
        };

        // Math utilities
        imports.env.Min = (a, b) => Math.min(a, b);
        imports.env.Max = (a, b) => Math.max(a, b);
        imports.env.ATan2 = (y, x) => Math.atan2(y, x);
        imports.env.Log10 = (x) => Math.log10(x);

        // String utilities
        imports.env.StringEqual = (str1Ptr, str2Ptr) => {
            const str1 = this.readString(str1Ptr);
            const str2 = this.readString(str2Ptr);
            return str1 === str2 ? 1 : 0;
        };

        // Data statements (not fully implemented)
        imports.env.ReadData = (typeHint) => {
            console.warn("ReadData not implemented");
            return 0;
        };

        imports.env.RestoreData = () => {
            console.warn("RestoreData not implemented");
        };

        imports.env.Print = (strPtr) => {
            const str = this.readString(strPtr);
            console.log(`[Blitz3D] ${str}`);
        };

        imports.env.PrintInt = (val) => console.log(`[Blitz3D] Int: ${val}`);
        imports.env.PrintFloat = (val) => console.log(`[Blitz3D] Float: ${val}`);
        imports.env.PrintString = (ptr) => {
            const str = this.readString(ptr);
            console.log(`[Blitz3D] String: ${str}`);
            return str.length;
        };

        imports.env.Cls = () => {
            if (this.gl) {
                this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
            }
            if (this.ctx2d) {
                this.ctx2d.clearRect(0, 0, this.textCanvas.width, this.textCanvas.height);
            }
        };

        this.lastFlip = 0;
        imports.env.Flip = (vwait) => {
            // In a synchronous WASM loop, we can't truly yield.
            // But we can check if we're running too fast and maybe log a warning
            const now = performance.now();
            const delta = now - this.lastFlip;
            if (this.lastFlip > 0 && delta < 1) {
                // Running > 1000fps, might be a bug or tight loop
            }
            this.lastFlip = now;

            // Blitz3D expects Flip to swap buffers and potentially wait for VSync.
            // In the browser, the requestAnimationFrame loop in main.ts handles the actual rendering.
            // We just need to make sure this doesn't block forever if called in a loop.
        };

        // Time
        imports.env.MilliCSecs = () => performance.now() | 0;
        imports.env.Delay = (ms) => {
            console.warn(`[Blitz3D] Synchronous Delay(${ms}ms) is not possible in browser. Ignoring.`);
        };

        // Math
        imports.env.Sin = (val) => Math.sin(val * Math.PI / 180);
        imports.env.Cos = (val) => Math.cos(val * Math.PI / 180);
        imports.env.Tan = Math.tan;
        imports.env.ASin = Math.asin;
        imports.env.ACos = Math.acos;
        imports.env.ATan = Math.atan;
        imports.env.ATan2 = Math.atan2;
        imports.env.Sqr = Math.sqrt;
        imports.env.Sqrt = Math.sqrt;
        imports.env.Floor = Math.floor;
        imports.env.Ceil = Math.ceil;
        imports.env.Exp = Math.exp;
        imports.env.Log = Math.log;
        imports.env.Log10 = Math.log10;
        imports.env.Abs = Math.abs;
        imports.env.Sgn = Math.sign;
        imports.env.Mod = (a, b) => a % b;
        imports.env.Pow = (a, b) => Math.pow(a, b);
        imports.env.Rnd = (min, max) => this.rndFloat(min, max);
        imports.env.Rand = (min, max) => this.rndInt(min, max);
        imports.env.SeedRnd = (seed) => {
            this.seedRnd(seed);
        };
        imports.env.RndSeed = () => {
            return this.randomSeed | 0;
        };

        // Strings
        imports.env.StringConcat = (aPtr, bPtr) => {
            const a = this.readString(aPtr);
            const b = this.readString(bPtr);
            if (this.allocString) {
                return this.allocString(a + b);
            }
            console.warn("StringConcat: allocString not available");
            return 0;
        };
        imports.env.IntToString = (i) => {
            if (this.allocString) {
                return this.allocString(i.toString());
            }
            return 0;
        };
        imports.env.FloatToString = (f) => {
            if (this.allocString) {
                return this.allocString(f.toString());
            }
            return 0;
        };

        // String manipulation functions
        imports.env.Left = (strPtr, n) => {
            const str = this.readString(strPtr);
            const result = str.substring(0, n);
            if (this.allocString) {
                return this.allocString(result);
            }
            return 0;
        };
        imports.env.Right = (strPtr, n) => {
            const str = this.readString(strPtr);
            const result = str.substring(str.length - n);
            if (this.allocString) {
                return this.allocString(result);
            }
            return 0;
        };
        imports.env.Mid = (strPtr, start, len) => {
            const str = this.readString(strPtr);
            // Blitz3D uses 1-based indexing
            const result = str.substring(start - 1, start - 1 + len);
            if (this.allocString) {
                return this.allocString(result);
            }
            return 0;
        };
        imports.env.Upper = (strPtr) => {
            const str = this.readString(strPtr);
            const result = str.toUpperCase();
            if (this.allocString) {
                return this.allocString(result);
            }
            return 0;
        };
        imports.env.Lower = (strPtr) => {
            const str = this.readString(strPtr);
            const result = str.toLowerCase();
            if (this.allocString) {
                return this.allocString(result);
            }
            return 0;
        };
        imports.env.Replace = (strPtr, findPtr, subPtr) => {
            const str = this.readString(strPtr);
            const find = this.readString(findPtr);
            const sub = this.readString(subPtr);
            const result = str.split(find).join(sub);
            if (this.allocString) {
                return this.allocString(result);
            }
            return 0;
        };
        imports.env.Instr = (strPtr, findPtr, start) => {
            const str = this.readString(strPtr);
            const find = this.readString(findPtr);
            // Blitz3D uses 1-based indexing
            const idx = str.indexOf(find, start - 1);
            return idx >= 0 ? idx + 1 : 0;
        };
        imports.env.Len = (strPtr) => {
            const str = this.readString(strPtr);
            return str.length;
        };
        imports.env.Trim = (strPtr) => {
            const str = this.readString(strPtr);
            const result = str.trim();
            if (this.allocString) {
                return this.allocString(result);
            }
            return 0;
        };
        imports.env.LTrim = (strPtr) => {
            const str = this.readString(strPtr);
            const result = str.trimStart();
            if (this.allocString) {
                return this.allocString(result);
            }
            return 0;
        };
        imports.env.RTrim = (strPtr) => {
            const str = this.readString(strPtr);
            const result = str.trimEnd();
            if (this.allocString) {
                return this.allocString(result);
            }
            return 0;
        };

        // Character conversion functions
        imports.env.Asc = (strPtr) => {
            const str = this.readString(strPtr);
            return str.length > 0 ? str.charCodeAt(0) : 0;
        };
        imports.env.Chr = (n) => {
            if (this.allocString) {
                return this.allocString(String.fromCharCode(n));
            }
            return 0;
        };
        imports.env.Hex = (n) => {
            if (this.allocString) {
                return this.allocString(n.toString(16).toUpperCase());
            }
            return 0;
        };
        imports.env.Bin = (n) => {
            if (this.allocString) {
                return this.allocString(n.toString(2));
            }
            return 0;
        };

        // File I/O - Full implementation using virtual file system
        this.fileSystem = new Map();
        this.openFiles = new Map();
        this.nextFileHandle = 1;

        // Register a file in the virtual file system
        this.registerFile = (filePath, data) => {
            this.fileSystem.set(filePath, {
                data: data,
                size: data.length,
                position: 0
            });
        };

        // Open a file and return a handle
        this.openFile = (filePath) => {
            if (this.fileSystem.has(filePath)) {
                const file = this.fileSystem.get(filePath);
                file.position = 0;
                const handle = this.nextFileHandle++;
                this.openFiles.set(handle, {
                    ...file,
                    path: filePath,
                    eof: false
                });
                return handle;
            }
            return 0; // File not found
        };

        // Close a file
        this.closeFile = (handle) => {
            this.openFiles.delete(handle);
        };

        // Read a byte
        this.readByte = (handle) => {
            const file = this.openFiles.get(handle);
            if (!file || file.position >= file.size) {
                if (file) file.eof = true;
                return -1;
            }
            return file.data[file.position++];
        };

        // Read signed byte
        this.readSignedByte = (handle) => {
            const byte = this.readByte(handle);
            return byte > 127 ? byte - 256 : byte;
        };

        // Read short (16-bit, little endian)
        this.readShort = (handle) => {
            const b1 = this.readByte(handle);
            const b2 = this.readByte(handle);
            if (b1 < 0 || b2 < 0) return 0;
            return b1 | (b2 << 8);
        };

        // Read int (32-bit, little endian)
        this.readInt = (handle) => {
            const b1 = this.readByte(handle);
            const b2 = this.readByte(handle);
            const b3 = this.readByte(handle);
            const b4 = this.readByte(handle);
            if (b1 < 0 || b2 < 0 || b3 < 0 || b4 < 0) return 0;
            return b1 | (b2 << 8) | (b3 << 16) | (b4 << 24);
        };

        // Read float
        this.readFloat = (handle) => {
            const buffer = new ArrayBuffer(4);
            const view = new DataView(buffer);
            view.setUint8(0, this.readByte(handle));
            view.setUint8(1, this.readByte(handle));
            view.setUint8(2, this.readByte(handle));
            view.setUint8(3, this.readByte(handle));
            return view.getFloat32(0, true);
        };


        this.writeByte = (handle, byte) => {
            const file = this.openFiles.get(handle);
            if (!file || !file.isWrite) return;

            // Expand if needed
            if (file.position >= file.data.length) {
                const newSize = Math.max(file.data.length * 2, file.position + 128);
                const newData = new Uint8Array(newSize);
                newData.set(file.data);
                file.data = newData;
            }

            file.data[file.position++] = byte;
            if (file.position > file.size) file.size = file.position;
        };

        // Check EOF
        this.fileEof = (handle) => {
            const file = this.openFiles.get(handle);
            if (!file) return 1;
            return file.position >= file.size ? 1 : 0;
        };

        // Read string until newline or max length
        this.readLineFromFile = (handle) => {
            const file = this.openFiles.get(handle);
            if (!file) return 0;

            let str = '';
            let byte = this.readByte(handle);
            let count = 0;
            const maxLen = 1024;

            while (byte >= 0 && byte !== 10 && count < maxLen) {
                if (byte !== 13) { // Skip CR
                    str += String.fromCharCode(byte);
                }
                byte = this.readByte(handle);
                count++;
            }

            if (this.allocString) {
                return this.allocString(str);
            }
            return 0;
        };

        imports.env.ReadFile = (pathPtr) => {
            const path = this.readString(pathPtr);
            return this.openFile(path);
        };

        imports.env.WriteFile = (pathPtr) => {
            const path = this.readString(pathPtr);
            // Write support is limited in browser - create a handle for saving
            const handle = this.nextFileHandle++;
            this.openFiles.set(handle, {
                data: new Uint8Array([]),
                size: 0,
                position: 0,
                path: path,
                eof: false,
                isWrite: true
            });
            console.log(`WriteFile: ${path} (handle: ${handle})`);
            return handle;
        };

        imports.env.OpenFile = (pathPtr) => {
            const path = this.readString(pathPtr);
            let handle = this.openFile(path);
            if (handle) {
                const file = this.openFiles.get(handle);
                if (file) file.isWrite = true;
                return handle;
            }
            handle = this.nextFileHandle++;
            this.openFiles.set(handle, {
                data: new Uint8Array(32), // Start small
                size: 0,
                position: 0,
                path: path,
                eof: false,
                isWrite: true
            });
            console.log(`OpenFile: ${path} (handle: ${handle})`);
            return handle;
        };

        imports.env.CloseFile = (stream) => {
            this.closeFile(stream);
        };

        imports.env.CreateDir = (pathPtr) => {
            const path = this.readString(pathPtr);
            console.log(`CreateDir: ${path}`);
            return 1; // Success
        };

        imports.env.DeleteDir = (pathPtr) => {
            const path = this.readString(pathPtr);
            console.log(`DeleteDir: ${path}`);
            return 1; // Success
        };

        imports.env.ChangeDir = (pathPtr) => {
            const path = this.readString(pathPtr);
            this.currentDir = path;
            console.log(`ChangeDir: ${path}`);
        };

        imports.env.CurrentDir = () => {
            return this.allocString(this.currentDir);
        };

        imports.env.DeleteFile = (pathPtr) => {
            const path = this.readString(pathPtr);
            console.log(`DeleteFile: ${path}`);
            return 1; // Success
        };

        imports.env.CopyFile = (srcPtr, destPtr) => {
            const src = this.readString(srcPtr);
            const dest = this.readString(destPtr);
            console.log(`CopyFile: ${src} -> ${dest}`);
            return 1;
        };

        imports.env.RenameFile = (oldPtr, newPtr) => {
            const oldPath = this.readString(oldPtr);
            const newPath = this.readString(newPtr);
            console.log(`RenameFile: ${oldPath} -> ${newPath}`);
            return 1;
        };

        imports.env.FileTime = (pathPtr) => {
            return 0; // Stub
        };

        imports.env.ReadInt = (stream) => {
            return this.readInt(stream);
        };

        imports.env.ReadFloat = (stream) => {
            return this.readFloat(stream);
        };

        imports.env.WriteByte = (stream, byte) => this.writeByte(stream, byte);

        imports.env.WriteShort = (stream, val) => {
            this.writeByte(stream, val & 0xFF);
            this.writeByte(stream, (val >> 8) & 0xFF);
        };

        imports.env.WriteInt = (stream, val) => {
            this.writeByte(stream, val & 0xFF);
            this.writeByte(stream, (val >> 8) & 0xFF);
            this.writeByte(stream, (val >> 16) & 0xFF);
            this.writeByte(stream, (val >> 24) & 0xFF);
        };

        imports.env.WriteFloat = (stream, val) => {
            const buffer = new ArrayBuffer(4);
            new DataView(buffer).setFloat32(0, val, true);
            new Uint8Array(buffer).forEach(b => this.writeByte(stream, b));
        };

        imports.env.WriteString = (stream, strPtr) => {
            const str = this.readString(strPtr);
            for (let i = 0; i < str.length; i++) this.writeByte(stream, str.charCodeAt(i));
            this.writeByte(stream, 0); // null term? Blitz write string typically writes length then chars or just chars?
            // "WriteString: Writes a string to a file stream. The 4 bytes following are the length of the string, followed by the string itself."
            // Ah, Blitz3D WriteString includes length (int).
            // Let's implement correctly: Length (Int) + Chars.
            // But wait, user might just expect C-string or raw. 
            // Dictionary says: "Writes a string to the file stream. The string is written as an integer indicating the length of the string, followed by the characters."
            // Ref: https://blitzresearch.itch.io/blitz3d/docs/WriteString
        };

        // Redoing WriteString to be spec compliant
        imports.env.WriteString = (stream, strPtr) => {
            const str = this.readString(strPtr);
            const len = str.length;
            this.imports.env.WriteInt(stream, len);
            for (let i = 0; i < len; i++) this.writeByte(stream, str.charCodeAt(i));
        };

        imports.env.WriteLine = (stream, strPtr) => {
            const str = this.readString(strPtr);
            for (let i = 0; i < str.length; i++) this.writeByte(stream, str.charCodeAt(i));
            this.writeByte(stream, 13); // CR
            this.writeByte(stream, 10); // LF
        };

        imports.env.ReadString = (stream) => {
            return this.readLineFromFile(stream);
        };

        imports.env.ReadByte = (stream) => {
            return this.readByte(stream);
        };

        imports.env.ReadShort = (stream) => {
            return this.readShort(stream);
        };

        imports.env.Eof = (stream) => {
            return this.fileEof(stream);
        };

        imports.env.FilePos = (stream) => {
            const file = this.openFiles.get(stream);
            return file ? file.position : 0;
        };

        imports.env.SeekFile = (stream, pos) => {
            const file = this.openFiles.get(stream);
            if (file) {
                if (pos < 0) pos = 0;
                // Allow seeking past end? usually yes for write, maybe strict for read? 
                // Blitz3D behavior: "If pos is greater than the file size, the file size is increased." (for write)
                // For read, it might just return EOF.
                file.position = pos;
                if (file.isWrite && pos > file.size) {
                    // Expand if writing
                    // Not handling expansion here yet, writeByte handles it on write.
                    // But maybe we should update size if we just seeked past it?
                    // "File size is extended". We'll update size if we write.
                    // Changing size upon seek? Not necessarily unless we truncate/extend explicitly?
                    // Actually "seek past end and write" extends. "Seek past end and read" is EOF.
                }
            }
        };

        imports.env.FileSize = (pathPtr) => {
            const path = this.readString(pathPtr);
            const file = this.fileSystem.get(path);
            return file ? file.size : 0;
        };

        imports.env.FileType = (pathPtr) => {
            const path = this.readString(pathPtr);
            const file = this.fileSystem.get(path);
            return file ? 1 : 0; // 1 = file, 0 = not found
        };

        // Banks
        imports.env.CreateBank = (size) => {
            const id = this.nextBankId++;
            this.banks.set(id, new Uint8Array(size));
            return id;
        };

        imports.env.FreeBank = (id) => {
            this.banks.delete(id);
        };

        imports.env.BankSize = (id) => {
            const bank = this.banks.get(id);
            return bank ? bank.length : 0;
        };

        imports.env.GetBankPtr = (id) => {
            // Note: In a real WASM runtime, banks might be in the main memory.
            // But here they are JS Uint8Arrays. 
            // If the WASM expects a pointer, we have a problem.
            // However, Blitz3D often uses Bank handles, and GetBankPtr is for externals.
            // For now, return a virtual handle or log a warning.
            console.warn(`GetBankPtr called for bank ${id} - returning virtual offset`);
            return id << 20; // 1MB aligned virtual pointers
        };

        imports.env.PeekByte = (id, offset) => {
            const bank = this.banks.get(id);
            return bank ? bank[offset] : 0;
        };

        imports.env.PokeByte = (id, offset, val) => {
            const bank = this.banks.get(id);
            if (bank) bank[offset] = val & 0xFF;
        };

        imports.env.PeekInt = (id, offset) => {
            const bank = this.banks.get(id);
            if (!bank) return 0;
            const view = new DataView(bank.buffer);
            return view.getInt32(offset, true);
        };

        imports.env.PokeInt = (id, offset, val) => {
            const bank = this.banks.get(id);
            if (!bank) return;
            const view = new DataView(bank.buffer);
            view.setInt32(offset, val, true);
        };

        imports.env.PeekFloat = (id, offset) => {
            const bank = this.banks.get(id);
            if (!bank) return 0;
            const view = new DataView(bank.buffer);
            return view.getFloat32(offset, true);
        };

        imports.env.PokeFloat = (id, offset, val) => {
            const bank = this.banks.get(id);
            if (!bank) return;
            const view = new DataView(bank.buffer);
            view.setFloat32(offset, val, true);
        };
        imports.env.ResizeBank = (id, size) => {
            const bank = this.banks.get(id);
            if (!bank) return;
            const newBank = new Uint8Array(size);
            newBank.set(bank.slice(0, Math.min(bank.length, size)));
            this.banks.set(id, newBank);
        };

        imports.env.CopyBank = (srcId, srcPos, destId, destPos, count) => {
            const src = this.banks.get(srcId);
            const dest = this.banks.get(destId);
            if (src && dest) {
                dest.set(src.subarray(srcPos, srcPos + count), destPos);
            }
        };

        imports.env.PeekShort = (id, offset) => {
            const bank = this.banks.get(id);
            if (!bank) return 0;
            const view = new DataView(bank.buffer);
            return view.getUint16(offset, true);
        };

        imports.env.PokeShort = (id, offset, val) => {
            const bank = this.banks.get(id);
            if (!bank) return;
            const view = new DataView(bank.buffer);
            view.setUint16(offset, val, true);
        };

        // Audio System - Web Audio API implementation of FMOD-like interface
        this.audioContext = null;
        this.audioMaster = null;
        this.sounds = new Map();
        this.streams = new Map();
        this.channels = new Map();
        this.nextSoundId = 1;
        this.nextStreamId = 1;
        this.nextChannelId = 1;
        this.audioInitialized = false;

        // Initialize audio context on user interaction
        this.initAudio = () => {
            if (this.audioInitialized) return true;

            try {
                const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
                if (!AudioContext) {
                    console.warn("Web Audio API not supported");
                    return false;
                }

                this.audioContext = new AudioContext();
                this.audioMaster = this.audioContext.createGain();
                this.audioMaster.gain.value = 1.0;
                this.audioMaster.connect(this.audioContext.destination);

                this.audioInitialized = true;
                console.log("Audio initialized: sample rate=" + this.audioContext.sampleRate);
                return true;
            } catch (e) {
                console.error("Failed to initialize audio:", e);
                return false;
            }
        };

        imports.env.FSOUND_Init = (freq, channels, flags) => {
            const result = this.initAudio() ? 1 : 0;
            if (result && freq > 0) {
                this.audioContext.sampleRate = freq;
            }
            return result;
        };

        imports.env.FSOUND_Close = () => {
            if (this.audioContext) {
                this.audioContext.close();
                this.audioContext = null;
                this.audioInitialized = false;
            }
        };

        // Load a sound sample into memory
        imports.env.LoadSound = (pathPtr) => {
            if (!this.initAudio()) return 0;

            const path = this.readString(pathPtr);
            const id = this.nextSoundId++;

            // Store for async loading
            this.sounds.set(id, {
                path: path,
                buffer: null,
                loading: true,
                volume: 1.0,
                pan: 0
            });

            // Try to load from virtual file system or fetch
            this.loadSoundBuffer(id, path);

            return id;
        };

        imports.env.LoadTempSound = (pathPtr) => {
            return imports.env.LoadSound(pathPtr);
        };

        this.loadSoundBuffer = async (id, path) => {
            try {
                let audioData;

                // Try virtual file system first
                if (this.fileSystem && this.fileSystem.has(path)) {
                    const file = this.fileSystem.get(path);
                    audioData = file.data;
                } else {
                    // Try to fetch
                    const response = await fetch(path);
                    if (!response.ok) throw new Error("Failed to fetch: " + response.status);
                    const arrayBuffer = await response.arrayBuffer();
                    audioData = new Uint8Array(arrayBuffer);
                }

                // Decode audio
                const buffer = await this.audioContext.decodeAudioData(audioData.buffer);

                const sound = this.sounds.get(id);
                if (sound) {
                    sound.buffer = buffer;
                    sound.loading = false;
                    console.log("Sound loaded: " + path + " (" + buffer.duration.toFixed(2) + "s)");
                }
            } catch (e) {
                console.error("Failed to load sound " + path + ":", e);
                const sound = this.sounds.get(id);
                if (sound) sound.loading = false;
            }
        };

        // Play a one-shot sound
        imports.env.PlaySound = (soundId) => {
            if (!this.initAudio()) return 0;

            const sound = this.sounds.get(soundId);
            if (!sound || !sound.buffer) {
                console.warn("PlaySound: sound " + soundId + " not found or loading");
                return 0;
            }

            const source = this.audioContext.createBufferSource();
            source.buffer = sound.buffer;

            const gainNode = this.audioContext.createGain();
            gainNode.gain.value = sound.volume;

            const panNode = this.audioContext.createStereoPanner();
            panNode.pan.value = sound.pan;

            source.connect(panNode);
            panNode.connect(gainNode);
            gainNode.connect(this.audioMaster);

            if (sound.loop) {
                source.loop = true;
            }

            source.start(0);

            const channelId = this.nextChannelId++;
            this.channels.set(channelId, {
                source: source,
                gain: gainNode,
                pan: panNode,
                playing: true
            });

            source.onended = () => {
                this.channels.delete(channelId);
            };

            return channelId;
        };

        imports.env.PlaySound_Strict = (soundId) => {
            return imports.env.PlaySound(soundId);
        };

        imports.env.LoadSound_Strict = (pathPtr) => {
            return imports.env.LoadSound(pathPtr);
        };

        imports.env.StreamSound_Strict = (pathPtr) => {
            // Fallback to eager load for now
            return imports.env.LoadSound(pathPtr);
        };

        imports.env.SetStreamVolume_Strict = (streamId, vol) => {
            // If streamId is soundId (from LoadSound fallback)
            const sound = this.sounds.get(streamId);
            if (sound) sound.volume = vol;
        };

        imports.env.StopStream_Strict = (streamId) => {
            // If we don't track playing instance of this stream, we can't stop easily unless we track all channels playing this sound.
            // Stub for now.
        };

        imports.env.FreeSound = (soundId) => {
            this.sounds.delete(soundId);
        };

        imports.env.LoopSound2 = (soundId) => {
            const sound = this.sounds.get(soundId);
            if (sound) {
                sound.loop = true;
            }
        };

        imports.env.PlaySound2 = (soundId) => {
            return imports.env.PlaySound(soundId);
        };

        imports.env.FreeSound_Strict = (soundId) => {
            imports.env.FreeSound(soundId);
        };

        imports.env.StopChannel = (channel) => {
            const ch = this.channels.get(channel);
            if (ch && ch.playing) {
                ch.source.stop();
                ch.playing = false;
            }
        };


        imports.env.ChannelPan = (channel, pan) => {
            const ch = this.channels.get(channel);
            if (ch && ch.pan) {
                ch.pan.pan.value = pan;
            }
        };

        imports.env.ChannelVolume = (channel, volume) => {
            const ch = this.channels.get(channel);
            if (ch && ch.gain) {
                ch.gain.gain.value = volume;
            }
            // Also update stored volume for sound
            if (channel > 1000) { // It's a sound ID, not channel
                const sound = this.sounds.get(channel);
                if (sound) sound.volume = volume;
            }
        };

        imports.env.ChannelPaused = (channel, paused) => {
            const ch = this.channels.get(channel);
            if (ch && ch.source) {
                if (paused) {
                    ch.source.suspend ? ch.source.suspend() : ch.source.disconnect();
                } else {
                    ch.source.resume ? ch.source.resume() : ch.source.connect(ch.pan);
                }
                ch.paused = paused;
            }
        };

        imports.env.ChannelPlaying = (channel) => {
            const ch = this.channels.get(channel);
            return (ch && ch.playing) ? 1 : 0;
        };

        imports.env.PauseChannel = (channel) => {
            const ch = this.channels.get(channel);
            if (ch && ch.source && ch.playing) {
                // WebAudio AudioBufferSourceNode cannot be paused/resumed easily once started
                // Usually you have to stop and restart at offset, or use AudioContext.suspend (global)
                // or use a GainNode to mute (but time continues).
                // For now, let's just mute it as a weak pause or stop it if critical.
                // Better implementation: disconnect from graph -> allows time to flow? No.

                // If using MediaElementSource (streams), we can pause.
                if (ch.element) {
                    ch.element.pause();
                } else {
                    // For buffer sources, we might need to recreate context or accept limitations.
                    // Simple shim: set volume to 0
                    if (ch.gain) ch.gain.gain.value = 0;
                }
                ch.paused = true;
            }
        };

        imports.env.ResumeChannel = (channel) => {
            const ch = this.channels.get(channel);
            if (ch && ch.paused) {
                if (ch.element) {
                    ch.element.play();
                } else {
                    // restore volume
                    if (ch.gain) ch.gain.gain.value = ch.volume || 1.0;
                }
                ch.paused = false;
            }
        };

        // Stream functions - for longer audio (music, ambient)
        imports.env.FSOUND_Stream_Open = (pathPtr, mode, offset, len) => {
            if (!this.initAudio()) return 0;

            const path = this.readString(pathPtr);
            const streamId = this.nextStreamId++;

            this.streams.set(streamId, {
                path: path,
                element: null,
                source: null,
                gain: null,
                playing: false,
                paused: false,
                volume: 1.0
            });

            console.log("Stream opened: " + path + " (id=" + streamId + ")");
            return streamId;
        };

        imports.env.FSOUND_Stream_Play = (channel, streamId) => {
            if (!this.initAudio()) return 0;

            const stream = this.streams.get(streamId);
            if (!stream) return 0;

            if (stream.playing) {
                return channel; // Already playing
            }

            // Create audio element for streaming
            stream.element = new Audio();
            stream.element.src = stream.path;
            stream.element.loop = (channel & 1) !== 0; // Mode 1 = loop

            stream.source = this.audioContext.createMediaElementSource(stream.element);
            stream.gain = this.audioContext.createGain();
            stream.gain.gain.value = stream.volume;

            stream.source.connect(stream.gain);
            stream.gain.connect(this.audioMaster);

            stream.element.play().then(() => {
                stream.playing = true;
                console.log("Stream playing: " + stream.path);
            }).catch(e => {
                console.error("Failed to play stream: " + e);
            });

            stream.element.onended = () => {
                stream.playing = false;
            };

            return streamId;
        };

        imports.env.FSOUND_Stream_Stop = (streamId) => {
            const stream = this.streams.get(streamId);
            if (stream && stream.element) {
                stream.element.pause();
                stream.element.currentTime = 0;
                stream.playing = false;
            }
        };

        imports.env.FSOUND_SetPan = (channel, pan) => {
            // FSOUND pan: 0 (left) - 255 (right)
            const normPan = (pan - 128) / 128.0;
            const ch = this.channels.get(channel);
            if (ch && ch.pan) ch.pan.pan.value = normPan;
        };

        imports.env.FSOUND_Init = (freq, channels, flags) => {
            return this.initAudio() ? 1 : 0;
        };

        imports.env.FSOUND_Close = () => {
            if (this.audioContext) {
                this.audioContext.close();
                this.audioContext = null;
            }
        };

        imports.env.FSOUND_StopSound = (channel) => {
            const ch = this.channels.get(channel);
            if (ch && ch.playing) {
                if (ch.source) ch.source.stop();
                ch.playing = false;
            }
        };

        imports.env.FSOUND_IsPlaying = (channel) => {
            const ch = this.channels.get(channel);
            return (ch && ch.playing) ? 1 : 0;
        };

        imports.env.FSOUND_SetPaused = (channel, paused) => {
            imports.env.ChannelPaused(channel, paused ? 1 : 0);
        };

        imports.env.FSOUND_Stream_Close = (streamId) => {
            const stream = this.streams.get(streamId);
            if (stream) {
                if (stream.element) {
                    stream.element.pause();
                    stream.element.src = "";
                }
                this.streams.delete(streamId);
            }
        };

        imports.env.PlayMusic = (pathPtr) => {
            // Wrapper for Open + Play
            // Mode 1 = loop (default for music often?) Let's assume loop=1 for now or 0
            // Blitz3D PlayMusic usually loops? actually standard PlayMusic(file) loops.
            // PlayMusic(file) -> Channel
            const streamId = imports.env.FSOUND_Stream_Open(pathPtr, 1, 0, 0); // Mode 1 = loop
            if (streamId) {
                return imports.env.FSOUND_Stream_Play(-1, streamId); // -1 = any free channel
            }
            return 0;
        };

        imports.env.ChannelPitch = (channel, pitch) => {
            const ch = this.channels.get(channel);
            if (ch && ch.source && ch.source.buffer) {
                const baseRate = ch.source.buffer.sampleRate;
                if (baseRate > 0) {
                    ch.source.playbackRate.value = pitch / baseRate;
                }
            }
        };

        imports.env.FSOUND_SetVolume = (channel, volume) => {
            // For streams
            if (channel < 100 && this.streams.has(channel)) {
                const stream = this.streams.get(channel);
                if (stream.gain) {
                    stream.gain.gain.value = volume;
                }
                stream.volume = volume;
            }
            // For channels
            const ch = this.channels.get(channel);
            if (ch && ch.gain) {
                ch.gain.gain.value = volume;
            }
        };

        imports.env.FSOUND_SetPaused = (channel, paused) => {
            if (this.streams.has(channel)) {
                const stream = this.streams.get(channel);
                if (stream.element) {
                    if (paused) {
                        stream.element.pause();
                        stream.paused = true;
                    } else {
                        stream.element.play();
                        stream.paused = false;
                    }
                }
            }
        };

        // 3D Sound functions
        imports.env.Sound3D = (soundId, x, y, z) => {
            const sound = this.sounds.get(soundId);
            if (!sound || !this.audioContext) return;

            // Store position for when sound is played
            sound.position = { x, y, z };
        };

        imports.env.SetListenerLocation = (x, y, z, forwardX, forwardY, forwardZ, upX, upY, upZ) => {
            if (!this.audioContext) return;

            // Web Audio API doesn't have direct listener API, 
            // but we can store this for 3D sound calculations
            this.listenerPosition = { x, y, z };
            this.listenerForward = { x: forwardX, y: forwardY, z: forwardZ };
        };

        // Zip/Archive support for assets.zip
        this.zipArchives = new Map();
        this.nextZipHandle = 1;

        this.loadZipArchive = async (path) => {
            try {
                // Try virtual file system first
                if (this.fileSystem && this.fileSystem.has(path)) {
                    const file = this.fileSystem.get(path);
                    const zip = await JSZip.loadAsync(file.data);
                    const fileMap = new Map();

                    zip.forEach((relativePath, zipEntry) => {
                        if (!zipEntry.dir) {
                            fileMap.set(relativePath, zipEntry);
                        }
                    });

                    this.zipArchives.set(path, fileMap);
                    return fileMap.size;
                }

                // Try to fetch
                const response = await fetch(path);
                if (!response.ok) throw new Error("HTTP " + response.status);
                const arrayBuffer = await response.arrayBuffer();
                const zip = await JSZip.loadAsync(arrayBuffer);
                const fileMap = new Map();

                zip.forEach((relativePath, zipEntry) => {
                    if (!zipEntry.dir) {
                        fileMap.set(relativePath, zipEntry);
                    }
                });

                this.zipArchives.set(path, fileMap);
                console.log("Loaded ZIP: " + path + " (" + fileMap.size + " files)");
                return fileMap.size;
            } catch (e) {
                console.error("Failed to load ZIP " + path + ":", e);
                return 0;
            }
        };

        imports.env.ZlibWapi_Open = async (pathPtr) => {
            const path = this.readString(pathPtr);
            const handle = this.nextZipHandle++;

            const fileCount = await this.loadZipArchive(path);
            if (fileCount > 0) {
                this.zipArchives.set(handle, {
                    path: path,
                    files: this.zipArchives.get(path),
                    isHandle: true
                });
                // Transfer ownership from path-based to handle-based
                this.zipArchives.delete(path);
                return handle;
            }
            return 0;
        };

        imports.env.ZlibWapi_Close = (zip) => {
            if (this.zipArchives.has(zip)) {
                this.zipArchives.delete(zip);
            }
        };

        imports.env.ZlibWapi_GetFileCount = (zip) => {
            const archive = this.zipArchives.get(zip);
            if (archive && archive.files) {
                return archive.files.size;
            }
            return 0;
        };

        imports.env.ZlibWapi_GetFileName = (zip, index) => {
            const archive = this.zipArchives.get(zip);
            if (archive && archive.files) {
                const entries = Array.from(archive.files.keys());
                if (index >= 0 && index < entries.length) {
                    const filename = entries[index];
                    if (this.allocString) {
                        return this.allocString(filename);
                    }
                }
            }
            return 0;
        };

        imports.env.ZlibWapi_ExtractFile = async (zip, index, destPtr) => {
            const archive = this.zipArchives.get(zip);
            if (archive && archive.files) {
                const entries = Array.from(archive.files.keys());
                if (index >= 0 && index < entries.length) {
                    const filename = entries[index];
                    const zipEntry = archive.files.get(filename);

                    if (zipEntry) {
                        try {
                            const data = await zipEntry.async("uint8array");
                            const destPath = this.readString(destPtr);

                            // Register in virtual file system
                            this.registerFile(destPath, data);

                            console.log("Extracted: " + filename + " -> " + destPath);
                            return 1;
                        } catch (e) {
                            console.error("Failed to extract " + filename + ":", e);
                        }
                    }
                }
            }
            return 0;
        };

        // Networking (TCP) for SCP:CB multiplayer
        this.tcpStreams = new Map();
        this.nextStreamId = 1;

        imports.env.OpenTCPStream = async (hostPtr, port) => {
            const host = this.readString(hostPtr);
            const streamId = this.nextStreamId++;

            try {
                // WebSocket as TCP substitute for browser
                const ws = new WebSocket("ws://" + host + ":" + port);

                ws.binaryType = 'arraybuffer';

                const stream = {
                    ws: ws,
                    sendBuffer: [],
                    receiveBuffer: new Uint8Array(0),
                    connected: false,
                    host: host,
                    port: port
                };

                ws.onopen = () => {
                    stream.connected = true;
                    console.log("TCPStream connected: " + host + ":" + port);
                    // Send any buffered data
                    while (stream.sendBuffer.length > 0 && ws.readyState === WebSocket.OPEN) {
                        ws.send(stream.sendBuffer.shift());
                    }
                };

                ws.onmessage = (event) => {
                    const data = new Uint8Array(event.data);
                    const newBuffer = new Uint8Array(stream.receiveBuffer.length + data.length);
                    newBuffer.set(stream.receiveBuffer);
                    newBuffer.set(data, stream.receiveBuffer.length);
                    stream.receiveBuffer = newBuffer;
                };

                ws.onclose = () => {
                    stream.connected = false;
                    console.log("TCPStream closed: " + host + ":" + port);
                };

                ws.onerror = (e) => {
                    console.error("TCPStream error: " + host + ":" + port, e);
                };

                this.tcpStreams.set(streamId, stream);
                return streamId;
            } catch (e) {
                console.error("Failed to open TCPStream: " + e);
                return 0;
            }
        };

        imports.env.CloseTCPStream = (streamId) => {
            const stream = this.tcpStreams.get(streamId);
            if (stream && stream.ws) {
                stream.ws.close();
                this.tcpStreams.delete(streamId);
            }
        };

        imports.env.WriteLine = (streamId, strPtr) => {
            const stream = this.tcpStreams.get(streamId);
            if (!stream || !stream.ws) return 0;

            const str = this.readString(strPtr);
            const data = str + "\n";

            if (stream.connected && stream.ws.readyState === WebSocket.OPEN) {
                stream.ws.send(data);
                return 1;
            } else {
                // Buffer for later
                stream.sendBuffer.push(data);
                return 1;
            }
        };

        imports.env.ReadLine = (streamId) => {
            const stream = this.tcpStreams.get(streamId);
            if (!stream) return 0;

            // Look for newline in receive buffer
            let newlineIdx = -1;
            for (let i = 0; i < stream.receiveBuffer.length; i++) {
                if (stream.receiveBuffer[i] === 10) { // \n
                    newlineIdx = i;
                    break;
                }
                if (stream.receiveBuffer[i] === 13) { // \r
                    newlineIdx = i;
                    break;
                }
            }

            if (newlineIdx >= 0) {
                const line = stream.receiveBuffer.slice(0, newlineIdx);
                stream.receiveBuffer = stream.receiveBuffer.slice(newlineIdx + 1);

                // Convert to string
                let str = '';
                for (let i = 0; i < line.length; i++) {
                    str += String.fromCharCode(line[i]);
                }

                if (this.allocString) {
                    return this.allocString(str);
                }
            }
            return 0;
        };

        imports.env.ReadAvail = (streamId) => {
            const stream = this.tcpStreams.get(streamId);
            if (!stream) return 0;

            // Count bytes until newline
            let count = 0;
            for (let i = 0; i < stream.receiveBuffer.length; i++) {
                if (stream.receiveBuffer[i] === 10 || stream.receiveBuffer[i] === 13) {
                    break;
                }
                count++;
            }
            return count;
        };

        // Performance monitoring functions
        imports.env.MilliSecs = () => {
            return Math.floor(performance.now());
        };

        imports.env.CountFPS = () => {
            return Math.floor(this.fps);
        };

        imports.env.PerformanceStats = () => {
            const stats = this.getPerformanceStats();
            if (this.allocString) {
                const statStr = `FPS:${stats.fps} Frames:${stats.frameCount} Heap:${stats.heapAllocations} Str:${stats.stringAllocations}`;
                return this.allocString(statStr);
            }
            return 0;
        };

        imports.env.SendNetMsg = (streamId, destId, msgId, data$, reliable) => {
            const stream = this.tcpStreams.get(streamId);
            if (!stream || !stream.ws) return 0;

            const data = this.readString(data$);
            const msg = JSON.stringify({ dest: destId, id: msgId, data: data, reliable: reliable });

            if (stream.connected && stream.ws.readyState === WebSocket.OPEN) {
                stream.ws.send(msg);
                return 1;
            }
            return 0;
        };

        // --- ZlibWapi Stubs ---
        imports.env.ZlibWapi_Open = (pathPtr, mode) => { console.warn("ZlibWapi_Open stub"); return 1; };
        imports.env.ZlibWapi_Close = (handle) => { };
        imports.env.ZlibWapi_ExtractFile = (handle, entryPtr, destPtr) => { return 1; };
        imports.env.ZlibWapi_GetFileCount = (handle) => 0;
        imports.env.ZlibWapi_GetFileName = (handle, index) => 0;

        // --- OpenAL Stubs ---
        // --- OpenAL Module ---
        if (!imports.al) imports.al = {};
        const alStub = () => 0;
        const alVoidStub = () => { };

        const alFunctions = [
            'alCreateBuffer', 'alCreateEffect', 'alCreateSource', 'alCreateSource_', 'alDestroy',
            'alDeviceInit', 'alEffectSetEAXReverb', 'alFreeBuffer', 'alFreeEffect', 'alFreeSource',
            'alGetAvailableDeviceCount', 'alGetAvailableDeviceName', 'alGetNumSources', 'alInit',
            'alListenerSetDirection', 'alListenerSetMasterVolume', 'alListenerSetPosition',
            'alListenerSetUp', 'alListenerSetVelocity', 'alSourceGetAudioTime', 'alSourceGetLenght',
            'alSourceIsPaused', 'alSourceIsPlaying', 'alSourceIsStopped', 'alSourcePause', 'alSourcePlay',
            'alSourcePlay2D', 'alSourcePlay2D_', 'alSourcePlay3D', 'alSourcePlay3D_', 'alSourcePlay_',
            'alSourceResume', 'alSourceSeek', 'alSourceSet3DPosition', 'alSourceSetLoop', 'alSourceSetPitch',
            'alSourceSetRolloffFactor', 'alSourceSetVolume', 'alSourceStop', 'alUpdate'
        ];

        alFunctions.forEach(fn => {
            // @ts-ignore
            imports.al[fn] = fn.includes('Set') || fn.includes('Stop') || fn.includes('Pause') || fn.includes('Resume') || fn.includes('Seek') || fn.includes('Update') || fn.includes('Destroy') || fn.includes('Free') ? alVoidStub : alStub;
            // Also keep in env for safety if some parts of the code still expect it there
            imports.env[fn] = imports.al[fn];
        });

        // --- Bank Stubs ---
        if (!imports.blitz3d) imports.blitz3d = {};

        imports.blitz3d.CreateBank = imports.env.CreateBank;
        imports.blitz3d.FreeBank = imports.env.FreeBank;
        imports.blitz3d.BankSize = imports.env.BankSize;
        imports.blitz3d.PeekByte = imports.env.PeekByte;
        imports.blitz3d.PeekShort = imports.env.PeekShort;
        imports.blitz3d.PeekInt = imports.env.PeekInt;
        imports.blitz3d.PeekFloat = imports.env.PeekFloat;
        imports.blitz3d.PokeByte = imports.env.PokeByte;
        imports.blitz3d.PokeShort = imports.env.PokeShort;
        imports.blitz3d.PokeInt = imports.env.PokeInt;
        imports.blitz3d.PokeFloat = imports.env.PokeFloat;
    }
}

if (typeof window !== 'undefined') {
    (window as any).Blitz3DCore = Blitz3DCore;
}

