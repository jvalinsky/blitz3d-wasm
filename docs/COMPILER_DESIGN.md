# Blitz3D-WASM Compiler Design

## Core Principle

**The compiler generates WASM that calls imported runtime functions.**

The compiler does NOT implement Blitz3D's runtime - it generates code that calls
it.

```
BB Source Code
     │
     ▼
┌─────────────┐
│  Compiler   │  ← Handles language constructs
│  (Swift)    │  ← Generates WASM bytecode
└─────────────┘
     │
     ▼
┌─────────────┐
│    WASM     │  ← Contains: control flow, math, memory ops
│   Module    │  ← Imports: runtime functions (CreateSprite, etc.)
└─────────────┘
     │
     ▼
┌─────────────┐
│ JS Runtime  │  ← Implements: CreateSprite → Three.js
│ (browser)   │  ← Implements: LoadSound → Web Audio
└─────────────┘
```

## What the Compiler Implements

### 1. Language Constructs (in WASM)

These become WASM instructions:

| BB Construct      | WASM Output                                        |
| ----------------- | -------------------------------------------------- |
| `Local x% = 5`    | `i32.const 5`, `local.set`                         |
| `x = x + 1`       | `local.get`, `i32.const 1`, `i32.add`, `local.set` |
| `If x > 0 Then`   | `local.get`, `i32.const 0`, `i32.gt_s`, `if`       |
| `For i = 0 To 10` | Loop with `br_if`                                  |
| `While x < 100`   | `block`, `loop`, `br_if`                           |
| `x# * y#`         | `f32.mul`                                          |
| `a And b`         | `i32.and`                                          |

### 2. Type System (in WASM memory)

Custom types are managed in WASM memory with compiler-generated code:

```blitz
Type Player
    Field x#, y#, z#
    Field health%
End Type

Local p.Player = New Player
p\x = 10.0
```

Compiler generates:

- **Memory layout**: prev(4) + next(4) + typeID(4) + fields...
- **New**: Allocate from heap or free list, link into type's linked list
- **Delete**: Unlink from list, add to free list
- **Field access**: Base pointer + field offset
- **For Each**: Iterate via linked list

### 3. Function Calls (WASM call instruction)

```blitz
Function Distance#(x1#, y1#, x2#, y2#)
    Return Sqr((x2-x1)^2 + (y2-y1)^2)
End Function
```

Compiler generates:

- WASM function with typed parameters
- `call` instruction for `Sqr` (imported from runtime)
- Return value on stack

### 4. Arrays (in WASM memory)

```blitz
Dim scores%(100)
scores(5) = 42
```

Compiler generates:

- Reserve memory region at compile time
- Index calculation: `base + index * element_size`
- Bounds checking (optional)

### 5. Strings (in WASM memory)

Strings are length-prefixed in memory:

```
[length: i32][char0][char1]...[charN]
```

String operations use compiler-generated helpers:

- `__StringAlloc(len)` - allocate string
- `__StringConcat(a, b)` - concatenate
- Runtime imports for complex ops (Instr, Replace, etc.)

## What the Compiler Does NOT Implement

These are **runtime imports** - the compiler just generates `call` instructions:

### Graphics (imported from JS runtime)

```
CreateSprite, CreateMesh, CreateCamera, CreateLight
PositionEntity, RotateEntity, ScaleEntity
EntityAlpha, EntityColor, EntityTexture
LoadMesh, LoadTexture, LoadAnimMesh
RenderWorld, UpdateWorld
```

### Audio (imported from JS runtime)

```
LoadSound, PlaySound, FreeSound
Load3DSound, EmitSound
```

### Input (imported from JS runtime)

```
KeyDown, KeyHit, MouseX, MouseY, MouseDown
```

### File I/O (imported from JS runtime)

```
ReadFile, WriteFile, OpenFile, CloseFile
ReadInt, WriteInt, ReadFloat, WriteFloat
```

## Import Strategy

### Option A: Import Everything (Current)

```wasm
(import "env" "CreateSprite" (func ...))
(import "env" "PositionEntity" (func ...))
(import "env" "Sin" (func ...))
(import "env" "Cos" (func ...))
... 400+ imports
```

Pros: Simple compiler, matches original Blitz3D Cons: Large import section,
unused imports

### Option B: Selective Imports (Future optimization)

Only import functions actually used in the source code.

### Option C: Hybrid

- Math functions (Sin, Cos, Sqr) → WASM native
- Graphics/Audio → Imported

## Compiler Pipeline

```
┌──────────────────────────────────────────────────────────────┐
│                        COMPILER                               │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  1. LEXER (Lexer/)                                          │
│     Source → Tokens                                          │
│     "Local x% = 5" → [LOCAL, IDENT, PERCENT, EQUALS, INT]   │
│                                                              │
│  2. PARSER (Parser/)                                         │
│     Tokens → AST                                             │
│     Creates: LocalDecl(name="x", type=Int, init=IntLit(5))  │
│                                                              │
│  3. LOWERING (Lowering/)                                     │
│     AST → IR                                                 │
│     Resolves types, calculates offsets                       │
│                                                              │
│  4. CODEGEN (CodeGen/)                                       │
│     IR → WASM                                                │
│     Emits: i32.const 5, local.set 0                         │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## Memory Layout

```
WASM Linear Memory (grows upward)
┌────────────────────────────────────────┐ 0x00000000
│ Static Data                            │
│ - String constants                     │
│ - Data statements                      │
├────────────────────────────────────────┤ 0x00000100 (256)
│ Global Arrays                          │
│ - Dim arrays                          │
│ - Fixed size, known at compile time   │
├────────────────────────────────────────┤ 0x00010000 (65536)
│ Heap                                   │
│ - Type instances (New)                 │
│ - Dynamic strings                      │
│ - Grows upward                         │
│                                        │
└────────────────────────────────────────┘
```

## Type Instance Layout

```
Offset  Size  Field
──────  ────  ─────
0       4     prev pointer (linked list)
4       4     next pointer (linked list)
8       4     typeID (for type checking)
12      ...   user fields start here
```

Example for `Type Player { Field x#, y#, health% }`:

```
Offset  Size  Field
──────  ────  ─────
0       4     prev
4       4     next
8       4     typeID (e.g., 1 for Player)
12      4     x (f32)
16      4     y (f32)
20      4     health (i32)
──────────────
Total: 24 bytes
```

## Global State

The compiler maintains globals for each Type:

```
Global 0: String table pointer
Global 1: Type1 first pointer
Global 2: Type1 last pointer
Global 3: Type1 free list head
Global 4: Type2 first pointer
...
Global N: Heap pointer (for allocation)
```

## What Needs Fixing/Improving

### Current Issues

1. **Function shadowing**: User function `Distance` conflicts with runtime
   import
2. **Goto/Gosub**: Not fully implemented (needs Relooper)
3. **Select/Case**: May have edge cases
4. **Data/Read**: Partially implemented

### Optimizations (Future)

1. **Dead code elimination**: Don't import unused runtime functions
2. **Inline small functions**: Avoid call overhead
3. **Constant folding**: Evaluate `1 + 2` at compile time
4. **Register allocation**: Better local variable usage

## Testing Strategy

1. **Unit tests**: Each language construct
2. **Validation**: `wasm-validate` on all output
3. **Integration**: Run in browser, check behavior
4. **SCPCB**: Ultimate test - compile and run the game
