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

        imports.env.RuntimeError = (msgPtr) => {
            const msg = this.readString(msgPtr);
            console.error(`[Blitz3D Error] ${msg}`);
            throw new Error(msg);
        };

        imports.env.CatchErrors = () => {
            console.log("[Blitz3D] CatchErrors enabled");
        };

        imports.env.MilliSecs2 = () => {
            return Date.now() & 0x7FFFFFFF; // Keep as signed 32-bit int
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
        
        imports.env.CloseFile = (stream) => {
            this.closeFile(stream);
        };
        
        imports.env.ReadInt = (stream) => {
            return this.readInt(stream);
        };
        
        imports.env.ReadFloat = (stream) => {
            return this.readFloat(stream);
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
                const AudioContext = window.AudioContext || window.webkitAudioContext;
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
        
        imports.env.FreeSound = (soundId) => {
            this.sounds.delete(soundId);
        };
        
        imports.env.StopChannel = (channel) => {
            const ch = this.channels.get(channel);
            if (ch && ch.playing) {
                ch.source.stop();
                ch.playing = false;
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
    }
}

if (typeof window !== 'undefined') {
    window.Blitz3DCore = Blitz3DCore;
}
module.exports = Blitz3DCore;