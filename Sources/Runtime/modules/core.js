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
        imports.env.Sin = Math.sin;
        imports.env.Cos = Math.cos;
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
        imports.env.Rnd = (min, max) => Math.random() * (max - min) + min;
        imports.env.Rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
        imports.env.SeedRnd = (seed) => { }; // TODO: Implement seeded random

        // Strings
        imports.env.StringConcat = (aPtr, bPtr) => {
            const a = this.readString(aPtr);
            const b = this.readString(bPtr);
            // Alloc new string currently not implemented fully in this stub
            // Ideally we call back to WASM to alloc, or use a JS string manager
            console.warn("StringConcat not fully implemented");
            return 0;
        };
        imports.env.IntToString = (i) => 0; // Stub
        imports.env.FloatToString = (f) => 0; // Stub

        imports.env.Left = (str, n) => 0;
        imports.env.Right = (str, n) => 0;
        imports.env.Mid = (str, start, len) => 0;
        imports.env.Upper = (str) => 0;
        imports.env.Lower = (str) => 0;
        imports.env.Replace = (str, find, sub) => 0;
        imports.env.Instr = (str, find, start) => 0;
        imports.env.Len = (str) => 0;
        imports.env.Trim = (str) => 0;
        imports.env.LTrim = (str) => 0;
        imports.env.RTrim = (str) => 0;

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