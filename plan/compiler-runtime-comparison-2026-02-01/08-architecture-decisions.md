# Architecture Decisions & Rationale

**Date**: February 1, 2026  
**Purpose**: Document key architectural choices and their justifications

---

## Decision 1: Import-Based Runtime

### Context

Two approaches to runtime functions:
1. **Monolithic** (Blitz3D-NG): 750+ functions compiled into compiler binary
2. **Import-Based** (Our approach): Functions imported from separate runtime

### Decision

✅ **Use import-based architecture with separated runtime**

### Rationale

**Pros**:
- ✅ **Smaller compiler binary** - Compiler doesn't need all runtime code
- ✅ **Runtime flexibility** - Can swap implementations without recompiling
- ✅ **Browser API integration** - Easy to leverage Web APIs
- ✅ **Easier maintenance** - Clear separation of concerns
- ✅ **Independent evolution** - Compiler and runtime can evolve separately
- ✅ **Multiple backends** - Same compiler can target different runtimes

**Cons**:
- ❌ No compile-time function signature validation
- ❌ Runtime must match compiler expectations

**Verdict**: Import-based is **correct for web target**

---

## Decision 2: Relooper for Control Flow

### Context

WASM only supports structured control flow (blocks/loops). Blitz3D has unstructured control flow (GOTO/GOSUB).

### Decision

✅ **Use Relooper algorithm to convert GOTO → structured blocks**

### Rationale

**This is not a choice - it's required**:
- WASM has no direct jump instruction (only `br` to block indices)
- Relooper is the standard solution (used by Emscripten, others)
- Semantically equivalent to direct jumps
- Well-tested algorithm

**Alternatives Considered**:
- ❌ Direct jumps - Not possible in WASM
- ❌ Trampoline pattern - Too slow, stack overflow risk
- ✅ Relooper - Standard, correct, proven

**Verdict**: Relooper is **correct and necessary**

---

## Decision 3: Type Suffix Handling

### Context

Swift attaches suffixes at lexer level (single token). Blitz3D-NG parses them separately (two tokens).

### Decision

⚠️ **Keep current Swift approach but test edge cases**

### Rationale

**Swift Approach**:
```swift
"x%" → Token(text="x%", type=.identifier)
```

**Pros**:
- Simpler parsing
- Less ambiguity
- Works for most cases

**Cons**:
- May break if suffix is optional
- Different from reference implementation

**Risk Mitigation**:
- Test SCPCB for mixed suffix usage
- Add warning for inconsistent suffix usage
- Consider adding optional suffix support if needed

**Verdict**: **Acceptable with testing**

---

## Decision 4: Type System Simplicity

### Context

Swift uses simple suffix → WASM type mapping. Blitz3D-NG has polymorphic type hierarchy.

### Decision

⚠️ **Keep simple type system but monitor for issues**

### Rationale

**Swift Approach**:
```swift
typeSuffixMap = [.integer: .i32, .float: .f32, .string: .i32]
```

**Pros**:
- Simple and pragmatic
- Works for WASM target
- Easier to maintain

**Cons**:
- May miss type errors
- No polymorphic type checking
- Forward scanning may guess wrong types

**When to Reconsider**:
- If SCPCB hits type errors frequently
- If type inference guesses wrong
- If type mismatches cause bugs

**Verdict**: **Acceptable for now, may need semantic analysis later**

---

## Decision 5: Math Library Implementation

### Context

Three options for math functions (Sin, Cos, Sqrt, etc.):
1. TypeScript runtime (via imports)
2. Swift engine functions
3. Direct WASM instructions

### Decision

✅ **Use TypeScript runtime initially, optimize later**

### Rationale

**Phase 1 (MVP)**:
```typescript
export const sin = (x: number) => Math.sin(x);
```
- Fastest to implement
- Leverages JS Math
- Works immediately

**Phase 2 (Optimization)**:
```wasm
(f32.sqrt)  ; Use WASM instruction directly
```
- Better performance
- No JS boundary crossing
- Requires compiler changes

**Verdict**: Start simple, optimize when profiling shows need

---

## Decision 6: String Memory Model

### Context

Strings need memory management. Options:
1. Reference counting
2. Garbage collection
3. String handles (map in TypeScript)

### Decision

✅ **Use string handles with TypeScript map**

### Rationale

**Implementation**:
```typescript
class StringManager {
    private strings: Map<number, string> = new Map();
    
    allocate(str: string): number {
        return this.nextHandle++;  // Return handle
    }
}
```

**Pros**:
- Simple to implement
- No GC complexity
- Leverages JS string management
- Easy debugging

**Cons**:
- Must manually free strings
- Handle exhaustion possible (but unlikely)

**Verdict**: Simple and effective for web target

---

## Decision 7: Virtual Filesystem

### Context

SCPCB expects synchronous file I/O. Browser APIs are async.

### Decision

✅ **Preload all assets into virtual filesystem before WASM init**

### Rationale

**Architecture**:
```typescript
// Preload phase
await vfs.loadZip('assets/facility_assets.zip');
await vfs.loadFile('Data/options.ini');

// Then WASM can synchronously read
const data = vfs.readFile('GFX/mesh/room1.rmesh');
```

**Pros**:
- Synchronous reads from VFS
- Matches Blitz3D semantics
- Simple implementation
- Fast (in-memory)

**Cons**:
- Must preload everything
- Memory usage (but acceptable for SCPCB)
- No dynamic loading

**Future**: Add streaming for larger games

**Verdict**: Correct approach for web environment

---

## Decision 8: Asset Loading via TypeScript

### Context

Asset loading (LoadMesh, LoadTexture) needs file format parsing and GPU upload.

### Decision

✅ **Hybrid: Swift parses formats, TypeScript handles GPU**

### Rationale

**Swift Side**:
```swift
// Parse B3D file
let meshData = B3DParser.parse(fileData)
// Send to TypeScript via command buffer
commandBuffer.send(.createMesh, meshData)
```

**TypeScript Side**:
```typescript
// Receive mesh data, create Three.js mesh
const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.Float32Array(positions));
scene.add(mesh);
```

**Pros**:
- Leverage existing B3D/RMESH parsers
- TypeScript handles Three.js integration
- Clear separation of concerns

**Cons**:
- Data must cross WASM boundary
- Command buffer complexity

**Verdict**: Best of both worlds

---

## Decision 9: Audio via Web Audio API

### Context

Audio needs browser integration. Options:
1. Full implementation in WASM
2. Delegate to TypeScript/Web Audio API

### Decision

✅ **Delegate to TypeScript with Web Audio API**

### Rationale

**Implementation**:
```typescript
export class AudioManager {
    private audioContext: AudioContext;
    
    async loadSound(path: string): Promise<number> {
        const buffer = await this.decodeAudio(path);
        return this.registerSound(buffer);
    }
    
    playSound(handle: number, volume: number): number {
        const source = this.audioContext.createBufferSource();
        source.buffer = this.sounds.get(handle);
        source.connect(this.audioContext.destination);
        source.start();
        return channelHandle;
    }
}
```

**Pros**:
- Leverages browser audio capabilities
- 3D audio built-in (PannerNode)
- Hardware acceleration
- Format support (OGG, MP3, etc.)

**Cons**:
- Must manage from TypeScript
- Latency possible

**Verdict**: Natural fit for web platform

---

## Decision 10: Physics Implementation

### Context

Blitz3D-NG integrates ODE physics engine. SCPCB uses basic collision.

### Decision

⚠️ **Start with basic collision, defer full physics**

### Rationale

**Phase 1: Basic Collision** (Current Swift engine):
- EntityType, EntityBox, EntityRadius
- EntityCollided, CollisionNX/NY/NZ
- LinePick (ray casting)

**Phase 2: Advanced (If Needed)**:
- Evaluate ODE WASM port
- Or: Use JavaScript physics engine (Cannon.js, Rapier)
- Or: Implement custom collision in Swift

**Decision Point**:
- Test SCPCB with basic collision
- Only add full physics if needed

**Verdict**: Defer until proven necessary

---

## Decision 11: Include File Paths

### Context

Blitz3D uses relative paths. Need resolution strategy.

### Decision

✅ **Search paths with fallback**

### Rationale

**Implementation**:
```swift
private var includeSearchPaths = [
    "./",              // Current directory
    "Data/",           // Data directory
    "../",             // Parent directory
]

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

**Pros**:
- Flexible
- Matches typical Blitz3D usage
- Easy to extend

**Verdict**: Standard approach

---

## Decision 12: Error Handling

### Context

Blitz3D uses RuntimeError(). Need web equivalent.

### Decision

✅ **Multiple error reporting, continue compilation**

### Rationale

**Compiler**:
```swift
var errors: [CompilerError] = []

func error(_ message: String) {
    errors.append(CompilerError(message, location))
    // Continue parsing to find more errors
}
```

**Runtime**:
```typescript
function runtimeError(message: string): never {
    console.error('Runtime Error:', message);
    throw new Error(message);
}
```

**Pros**:
- Better developer experience
- See all errors at once
- Easier debugging

**Verdict**: Standard best practice

---

## Architectural Principles

### 1. **Separation of Concerns**
- Compiler: Language → WASM
- Swift Engine: Core runtime logic
- TypeScript Runtime: Browser API integration

### 2. **Progressive Enhancement**
- Start with basics (P0 functions)
- Add features incrementally (P1, P2, P3)
- Optimize when profiling shows need

### 3. **Leverage Platform**
- Use Web Audio API for audio
- Use Three.js for graphics
- Use browser image decoders
- Use JavaScript string handling

### 4. **Pragmatic Over Pure**
- Simple type system over polymorphic hierarchy
- String handles over garbage collection
- Preloading over streaming (for MVP)

### 5. **Test-Driven**
- Validate against Blitz3D-NG behavior
- Use SCPCB as comprehensive test case
- Profile before optimizing

---

## Next Document

See **09-testing-strategy.md** for validation approach.
