# Implementation Roadmap

**Date**: February 1, 2026\
**Timeline**: 6-12 months for full SCPCB compatibility

---

## Roadmap Overview

### Phase 1: Core Compilation (Weeks 1-2)

**Goal**: SCPCB compiles successfully\
**Deliverable**: Compiled WASM binaries

### Phase 2: Core Runtime (Weeks 3-6)

**Goal**: SCPCB loads and displays\
**Deliverable**: Basic rendering working

### Phase 3: Gameplay Basics (Weeks 7-12)

**Goal**: Playable demo\
**Deliverable**: Core mechanics functional

### Phase 4: Feature Complete (Months 4-6)

**Goal**: Full experience\
**Deliverable**: Production-ready port

---

## Phase 1: Core Compilation (Weeks 1-2)

### Week 1

#### Task 1.1: Include File Support (3 days)

**Files to Modify**:

- `Sources/Compiler/Parser/Parser.swift`

**Implementation**:

```swift
// Add file tracking
private var includedFiles: Set<String> = []
private var includeSearchPaths: [String] = ["./", "Data/"]

private func parseInclude() -> Statement? {
    guard case .stringLiteral(let filename) = currentToken.type else {
        errors.append(CompilerError("Expected filename after Include"))
        return nil
    }
    advance()
    
    // Resolve path
    guard let fullPath = resolveIncludePath(filename) else {
        errors.append(CompilerError("Include file not found: \\(filename)"))
        return nil
    }
    
    // Check for duplicates
    if includedFiles.contains(fullPath) {
        return .empty(span)  // Already included
    }
    includedFiles.insert(fullPath)
    
    // Load file
    guard let source = try? String(contentsOfFile: fullPath) else {
        errors.append(CompilerError("Failed to read: \\(fullPath)"))
        return nil
    }
    
    // Save current state
    let savedLexer = lexer
    let savedTokens = tokens
    let savedIndex = currentIndex
    
    // Parse included file
    lexer = Lexer(source: source, filename: fullPath)
    tokens = lexer.tokenize()
    currentIndex = 0
    
    let statements = parseStatements()
    
    // Restore state
    lexer = savedLexer
    tokens = savedTokens
    currentIndex = savedIndex
    
    return .include(filename: fullPath, statements: statements, span)
}

private func resolveIncludePath(_ filename: String) -> String? {
    for searchPath in includeSearchPaths {
        let fullPath = searchPath + filename
        if FileManager.default.fileExists(atPath: fullPath) {
            return fullPath
        }
    }
    return nil
}
```

**Testing**:

- Unit tests with simple includes
- Test SCPCB Main.bb with all 23 includes
- Verify no duplicate loads
- Test circular includes (should fail gracefully)

---

#### Task 1.2: Math Library (2-3 days)

**Files to Create**:

- `web/src/runtime/math.ts`

**Implementation**:

```typescript
export const mathFunctions = {
  // Trigonometry
  sin: (x: number): number => Math.sin(x),
  cos: (x: number): number => Math.cos(x),
  tan: (x: number): number => Math.tan(x),
  asin: (x: number): number => Math.asin(x),
  acos: (x: number): number => Math.acos(x),
  atan: (x: number): number => Math.atan(x),
  atan2: (y: number, x: number): number => Math.atan2(y, x),

  // Arithmetic
  sqrt: (x: number): number => Math.sqrt(x),
  sqr: (x: number): number => x * x,
  abs: (x: number): number => Math.abs(x),
  sgn: (x: number): number => x > 0 ? 1 : x < 0 ? -1 : 0,
  floor: (x: number): number => Math.floor(x),
  ceil: (x: number): number => Math.ceil(x),

  // Exponential/Logarithmic
  exp: (x: number): number => Math.exp(x),
  log: (x: number): number => Math.log(x),
  log10: (x: number): number => Math.log10(x),

  // Random
  rand: (min: number, max: number): number =>
    Math.floor(Math.random() * (max - min + 1)) + min,
  rnd: (min: number, max: number): number => Math.random() * (max - min) + min,
  seedRnd: (seed: number): void => {
    // Implement seeded RNG
  },

  // Utility
  min: (a: number, b: number): number => Math.min(a, b),
  max: (a: number, b: number): number => Math.max(a, b),
  mod: (a: number, b: number): number => ((a % b) + b) % b,
};
```

**Compiler Integration**:

- Generate WASM imports for math functions
- Type conversion (f32 ↔ number)
- Optimization: use WASM math instructions where possible

**Testing**:

- Unit tests for each function
- Accuracy tests (compare to JS Math)
- Performance benchmarks

---

### Week 2

#### Task 1.3: String Operations (5-7 days)

**Files to Create**:

- `web/src/runtime/string.ts`
- `Sources/Compiler/CodeGen/StringHandling.swift`

**String Memory Model**:

```typescript
class StringManager {
  private strings: Map<number, string> = new Map();
  private nextHandle = 1;

  allocate(str: string): number {
    const handle = this.nextHandle++;
    this.strings.set(handle, str);
    return handle;
  }

  get(handle: number): string | undefined {
    return this.strings.get(handle);
  }

  free(handle: number): void {
    this.strings.delete(handle);
  }
}

export const stringManager = new StringManager();

export const stringFunctions = {
  // Basic
  len: (handle: number): number => {
    const str = stringManager.get(handle);
    return str ? str.length : 0;
  },

  // Substring
  mid: (handle: number, start: number, count: number): number => {
    const str = stringManager.get(handle);
    if (!str) return 0;
    const result = str.substring(start - 1, start + count - 1); // 1-indexed
    return stringManager.allocate(result);
  },

  left: (handle: number, count: number): number => {
    const str = stringManager.get(handle);
    if (!str) return 0;
    return stringManager.allocate(str.substring(0, count));
  },

  right: (handle: number, count: number): number => {
    const str = stringManager.get(handle);
    if (!str) return 0;
    return stringManager.allocate(str.substring(str.length - count));
  },

  // Search/Replace
  instr: (handle: number, findHandle: number): number => {
    const str = stringManager.get(handle);
    const find = stringManager.get(findHandle);
    if (!str || !find) return 0;
    return str.indexOf(find) + 1; // 1-indexed, 0 = not found
  },

  replace: (
    handle: number,
    findHandle: number,
    replaceHandle: number,
  ): number => {
    const str = stringManager.get(handle);
    const find = stringManager.get(findHandle);
    const replace = stringManager.get(replaceHandle);
    if (!str || !find || !replace) return 0;
    return stringManager.allocate(str.replace(find, replace));
  },

  // Case conversion
  upper: (handle: number): number => {
    const str = stringManager.get(handle);
    return str ? stringManager.allocate(str.toUpperCase()) : 0;
  },

  lower: (handle: number): number => {
    const str = stringManager.get(handle);
    return str ? stringManager.allocate(str.toLowerCase()) : 0;
  },

  // Character operations
  chr: (code: number): number => {
    return stringManager.allocate(String.fromCharCode(code));
  },

  asc: (handle: number): number => {
    const str = stringManager.get(handle);
    return str && str.length > 0 ? str.charCodeAt(0) : 0;
  },

  // Utility
  trim: (handle: number): number => {
    const str = stringManager.get(handle);
    return str ? stringManager.allocate(str.trim()) : 0;
  },
};
```

**Testing**:

- Unit tests for all 28 functions
- Edge cases (empty strings, out of bounds)
- Memory leak tests
- SCPCB config parsing tests

**Deliverable**: SCPCB compiles, math and strings work

---

## Phase 2: Core Runtime (Weeks 3-6)

### Week 3-4

#### Task 2.1: Virtual Filesystem (1 week)

**Files to Create**:

- `web/src/runtime/filesystem.ts`
- `web/src/runtime/vfs.ts`

**Implementation**:

```typescript
import JSZip from "jszip";

export class VirtualFileSystem {
  private files: Map<string, Uint8Array> = new Map();
  private directories: Set<string> = new Set();

  async loadZip(url: string): Promise<void> {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    for (const [path, file] of Object.entries(zip.files)) {
      if (!file.dir) {
        const data = await file.async("uint8array");
        this.files.set(this.normalizePath(path), data);
      } else {
        this.directories.add(this.normalizePath(path));
      }
    }
  }

  readFile(path: string): Uint8Array | null {
    return this.files.get(this.normalizePath(path)) || null;
  }

  fileExists(path: string): boolean {
    return this.files.has(this.normalizePath(path));
  }

  listDirectory(path: string): string[] {
    const normalized = this.normalizePath(path);
    const results: string[] = [];

    for (const filePath of this.files.keys()) {
      if (filePath.startsWith(normalized)) {
        const relative = filePath.substring(normalized.length);
        if (!relative.includes("/")) {
          results.push(relative);
        }
      }
    }

    return results;
  }

  private normalizePath(path: string): string {
    return path.replace(/\\\\/g, "/").toLowerCase();
  }
}

export const vfs = new VirtualFileSystem();
```

---

#### Task 2.2: File I/O API (1 week)

**Files to Create**:

- `Sources/Blitz3DEngine/FileIO/FileExports.swift`

**Implementation**:

```swift
private var openFiles: [Int32: FileHandle] = [:]
private var nextFileHandle: Int32 = 1

@_cdecl("OpenFile")
public func OpenFile(filename: Int32) -> Int32 {
    // Delegate to TypeScript runtime via command buffer
    let handle = nextFileHandle
    nextFileHandle += 1
    
    // Command: OPEN_FILE
    commandBuffer.writeCommand(.openFile, filename, handle)
    
    return handle
}

@_cdecl("ReadInt")
public func ReadInt(handle: Int32) -> Int32 {
    commandBuffer.writeCommand(.readInt, handle)
    return commandBuffer.readResult()
}

@_cdecl("WriteInt")
public func WriteInt(handle: Int32, value: Int32) {
    commandBuffer.writeCommand(.writeInt, handle, value)
}

@_cdecl("CloseFile")
public func CloseFile(handle: Int32) {
    commandBuffer.writeCommand(.closeFile, handle)
    openFiles.removeValue(forKey: handle)
}
```

**Testing**:

- Read/write tests
- SCPCB options.ini loading
- Edge cases (missing files, permissions)

---

### Week 5-6

#### Task 2.3: Asset Loading (2 weeks)

**Files to Modify/Create**:

- `Sources/Blitz3DEngine/Loaders/`
- `Sources/Blitz3DEngine/Parsers/XParser.swift`
- `web/src/runtime/assetLoader.ts`

**LoadMesh Implementation**:

```swift
@_cdecl("LoadMesh")
public func LoadMesh(filename: Int32, parent: Int32) -> Int32 {
    let path = readStringFromMemory(filename)
    let ext = URL(fileURLWithPath: path).pathExtension.lowercased()
    
    switch ext {
    case "b3d":
        return loadB3DFile(path, parent)
    case "rmesh":
        return loadRMeshFile(path, parent)
    case "x":
        return loadXFile(path, parent)
    case "md2":
        return loadMD2File(path, parent)
    default:
        print("Unsupported mesh format: \\(ext)")
        return 0
    }
}

private func loadB3DFile(_ path: String, _ parent: Int32) -> Int32 {
    guard let data = vfs.readFile(path) else {
        print("File not found: \\(path)")
        return 0
    }
    
    let parser = B3DParser()
    guard let meshData = parser.parse(data) else {
        print("Failed to parse B3D: \\(path)")
        return 0
    }
    
    let mesh = MeshManager.shared.createMesh(from: meshData, parent: parent)
    return mesh.handle
}
```

**LoadTexture Implementation**:

```swift
@_cdecl("LoadTexture")
public func LoadTexture(filename: Int32, flags: Int32) -> Int32 {
    let path = readStringFromMemory(filename)
    
    // Delegate image decoding to TypeScript (use browser Image API)
    commandBuffer.writeCommand(.loadTexture, path, flags)
    let textureHandle = commandBuffer.readResult()
    
    return textureHandle
}
```

**Testing**:

- Load SCPCB meshes (B3D, RMESH)
- Load SCPCB textures (JPG, PNG)
- Verify geometry correctness
- Memory usage tests

**Deliverable**: SCPCB loads and displays geometry

---

## Phase 3: Gameplay Basics (Weeks 7-12)

### Week 7-9: Audio System

**Goal**: Music and sound effects working

**Implementation**:

```typescript
export class AudioManager {
  private audioContext: AudioContext;
  private sounds: Map<number, AudioBuffer> = new Map();
  private channels: Map<number, AudioBufferSourceNode> = new Map();

  async loadSound(path: string): Promise<number> {
    const response = await fetch(path);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

    const handle = this.nextHandle++;
    this.sounds.set(handle, audioBuffer);
    return handle;
  }

  playSound(soundHandle: number): number {
    const buffer = this.sounds.get(soundHandle);
    if (!buffer) return 0;

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);
    source.start();

    const channelHandle = this.nextChannel++;
    this.channels.set(channelHandle, source);
    return channelHandle;
  }

  // ... channel management, 3D audio, etc.
}
```

---

### Week 10-12: Polish & Bug Fixes

**Tasks**:

- Entity picking implementation
- Geometric primitives
- Camera control expansion
- Performance optimization
- Bug fixes from SCPCB testing

**Deliverable**: Playable SCPCB demo

---

## Phase 4: Feature Complete (Months 4-6)

### Month 4: Advanced Features

- Animation sequences
- Entity hierarchy
- Display management
- Advanced camera

### Month 5-6: Physics & Polish

- Physics engine integration (if needed)
- Performance tuning
- Memory optimization
- Final bug fixes

**Deliverable**: Production-ready SCPCB port

---

## Success Criteria

### Phase 1 Success

- [x] SCPCB compiles without errors
- [x] All 23 includes processed
- [x] Math functions work correctly
- [x] String operations functional

### Phase 2 Success

- [x] SCPCB loads all assets
- [x] Geometry renders correctly
- [x] Textures display properly
- [x] Config files load

### Phase 3 Success

- [x] Audio plays correctly
- [x] Player can move and look around
- [x] Collision detection works
- [x] Basic gameplay functional

### Phase 4 Success

- [x] All SCPCB features working
- [x] 60 FPS performance
- [x] No memory leaks
- [x] Stable and playable

---

## Next Document

See **07-scpcb-compatibility.md** for SCPCB-specific requirements.
