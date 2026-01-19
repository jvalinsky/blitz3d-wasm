/**
 * Blitz3D Runtime Core Module
 * Essential functionality and initialization
 */

class Blitz3DCore {
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
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            console.error("Canvas not found: " + canvasId);
            return;
        }

        // Setup 2D overlay canvas for Text commands
        this.textCanvas = document.createElement('canvas');
        this.textCanvas.width = this.canvas.width;
        this.textCanvas.height = this.canvas.height;
        this.textCanvas.style.position = 'absolute';
        this.textCanvas.style.top = '0';
        this.textCanvas.style.left = '0';
        this.textCanvas.style.pointerEvents = 'none';
        this.canvas.parentElement.appendChild(this.textCanvas);
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
        imports.env.PrintInt = (val) => console.log(`[Blitz3D] Int: ${val}`);
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

        imports.env.Flip = (vwait) => {
            // No-op for now in requestAnimationFrame loop
        };

        // Time
        imports.env.MilliCSecs = () => performance.now() | 0;
        imports.env.Delay = (ms) => { };

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
        imports.env.Rnd = (min, max) => this.rndFloat(min, max);
        imports.env.Rand = (min, max) => this.rndInt(min, max);
        imports.env.SeedRnd = (seed) => {
            this.seedRnd(seed);
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

        // File I/O Stubs
        imports.env.ReadFile = (path) => 0;
        imports.env.WriteFile = (path) => 0;
        imports.env.CloseFile = (stream) => { };
        imports.env.ReadInt = (stream) => 0;
        imports.env.ReadFloat = (stream) => 0.0;
        imports.env.ReadString = (stream) => 0;
        imports.env.ReadByte = (stream) => 0;
        imports.env.ReadShort = (stream) => 0;
        imports.env.Eof = (stream) => 1;
        imports.env.FileSize = (path) => 0;
        imports.env.FileType = (path) => 0;
        imports.env.ReadData = (stream, buf, count) => 0;
        imports.env.RestoreData = (label) => { };

        // Banks
        imports.env.CreateBank = (size) => 0;
        imports.env.FreeBank = (bank) => { };
        imports.env.BankSize = (bank) => 0;
        imports.env.ResizeBank = (bank, size) => { };
        imports.env.CopyBank = (src, srcPos, dest, destPos, count) => { };
        imports.env.PeekByte = (bank, offset) => 0;
        imports.env.PokeByte = (bank, offset, val) => { };
        imports.env.PeekInt = (bank, offset) => 0;
        imports.env.PokeInt = (bank, offset, val) => { };
        imports.env.PeekFloat = (bank, offset) => 0.0;
        imports.env.PokeFloat = (bank, offset, val) => { };
        imports.env.PeekShort = (bank, offset) => 0;
        imports.env.PokeShort = (bank, offset, val) => { };

        // Audio Stubs
        imports.env.PlaySound = (sound) => 0;
        imports.env.FreeSound = (sound) => { };
        imports.env.StopChannel = (chn) => { };
        imports.env.ChannelVolume = (chn, vol) => { };
        imports.env.ChannelPaused = (chn, paused) => { };
        imports.env.ChannelPlaying = (chn) => 0;
        imports.env.FSOUND_Init = (freq, channels, flags) => 1;
        imports.env.FSOUND_Stream_Open = (path, mode, offset, len) => 0;
        imports.env.FSOUND_Stream_Play = (chn, stream) => 0;
        imports.env.FSOUND_SetVolume = (chn, vol) => { };
        imports.env.FSOUND_SetPaused = (chn, paused) => { };
        imports.env.FSOUND_Stream_Stop = (stream) => { };
        imports.env.FSOUND_Close = () => { };

        // Zip Stubs
        imports.env.ZlibWapi_Open = (path) => 0;
        imports.env.ZlibWapi_Close = (zip) => { };
        imports.env.ZlibWapi_GetFileCount = (zip) => 0;
        imports.env.ZlibWapi_GetFileName = (zip, index) => 0;
        imports.env.ZlibWapi_ExtractFile = (zip, index, dest) => 0;
    }
}

window.Blitz3DCore = Blitz3DCore;
module.exports = Blitz3DCore;