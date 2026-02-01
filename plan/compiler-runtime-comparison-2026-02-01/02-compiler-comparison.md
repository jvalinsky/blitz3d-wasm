# Swift Compiler vs Blitz3D-NG Compiler

**Date**: February 1, 2026  
**Comparison**: Swift (~17K lines) vs Blitz3D-NG C++ (~1K lines)

---

## Overview

Both compilers support the core Blitz3D language, but differ significantly in **architecture**, **type system**, **code generation strategy**, and **include file handling**.

---

## 1. Architectural Philosophy

### Swift Compiler: Import-Based Runtime

**Design**:
- Compiler generates WASM that **imports** runtime functions
- Zero built-in functions in compiler
- Runtime provided separately (TypeScript + Swift engine)
- Clean separation: Compiler = language→WASM, Runtime = API implementations

**Files**:
- Location: `Sources/Compiler/` (~17K lines)
- Modular: Lexer, Parser, AST, IR, Lowering, CodeGen (12 files)

### Blitz3D-NG: Monolithic Compiler + Runtime

**Design**:
- Compiler + 750+ built-in functions in single executable
- All runtime functions compiled into binary
- Self-contained: No external dependencies
- Monolithic: Compiler knows about all functions at compile time

**Files**:
- Location: `src/tools/compiler/` (~1K lines core)
- Compact: Lexer (150), Parser (650), Codegen (200)

### Verdict

✅ **Swift's separation is sound architecture for WASM**
- Allows runtime flexibility (browser APIs)
- Easier to maintain (smaller compiler)
- Runtime can evolve independently

---

## 2. Code Generation Target

### Swift: WebAssembly

**Characteristics**:
```
Target: WebAssembly binary format
Memory: Linear heap (bump allocator + free list)
Control Flow: Structured blocks only (no direct jumps)
Instructions: Stack-based (200+ instruction types)
Procedure Calls: No native JSR/RET (uses call_indirect)
Output: Binary .wasm file
```

**Files**:
- `CodeGen/WASM.swift` - 200+ instruction enum
- `CodeGen/WASMBinaryEncoder.swift` - Binary encoding
- `IR/Passes/Relooper.swift` - GOTO → structured blocks

**Key Feature**: **Relooper Algorithm**
- Converts unstructured control flow (GOTO/GOSUB) to structured WASM blocks
- Required because WASM only has `br` (break to block), no direct jumps
- Standard solution for compiling unstructured languages to WASM

### Blitz3D-NG: Native Code (x86 / LLVM)

**Characteristics**:
```
Target: x86 assembly OR LLVM IR
Memory: Native process memory
Control Flow: Direct jumps (JMP, JSR, RET)
Instructions: Register-based x86 or LLVM ops
Procedure Calls: Native call stack (CALL/RET)
Output: Native executable or LLVM bitcode
```

**Files**:
- `codegen.h` - Abstract codegen interface
- `codegen_x86.cpp` - x86 assembly backend
- `codegen_llvm/` - LLVM IR backend

**IR Operations**:
```cpp
enum {
    IR_JUMP, IR_JUMPT, IR_JUMPF,     // Direct jumps
    IR_JSR, IR_RET,                  // Subroutine calls
    IR_CALL, IR_RETURN,              // Function calls
    IR_ADD, IR_SUB, IR_MUL, IR_DIV,  // Arithmetic
    IR_FCALL, IR_FRETURN,            // Float operations
    // ... 27 total opcodes
};
```

### Verdict

✅ **Both approaches valid for their targets**
- Swift's Relooper is **correct and necessary** for WASM
- Blitz3D-NG's direct jumps are optimal for native code
- **Risk**: Edge cases with complex nested gotos should be tested

---

## 3. Type System

### Swift: Suffix-Based Mapping

**Implementation**: `CodeGen/TypeHandling.swift`

```swift
private let typeSuffixMap: [TypeSuffix: WASMType] = [
    .integer: .i32,
    .float: .f32,
    .string: .i32  // Pointer to string data
]
```

**Strategy**:
- Simple 1:1 suffix → WASM type
- Forward-scanning type inference for implicit variables
- Minimal type metadata stored
- No polymorphic type checking

**Type Inference**: `CodeGen/TypeInference.swift`
1. Variable used without declaration
2. Forward scan AST for first type hint (e.g., `x% = value`)
3. Infer type from suffix on assignment
4. Cache to avoid rescans
5. **Default to i32 if no suffix found**

### Blitz3D-NG: Polymorphic Type Hierarchy

**Implementation**: `tree/type.h`

```cpp
struct Type {
    virtual ~Type(){}
    virtual bool canCastTo(Type *t);
    static Type *void_type, *int_type, *float_type, *string_type, *null_type;
};

struct FuncType : public Type {
    Type *returnType;
    DeclSeq *params;
    bool userlib, cfunc;
};

struct ArrayType : public Type {
    Type *elementType;
    int dims;
};

struct StructType : public Type {
    std::string ident;
    DeclSeq *fields;
    virtual bool canCastTo(Type *t);  // Override for struct inheritance
};

struct ConstType : public Type { };
struct VectorType : public Type { };
```

**Strategy**:
- Full type hierarchy with inheritance
- Semantic analysis phase before codegen
- Complete compile-time type validation
- Clear error messages for type mismatches

### Verdict

⚠️ **Swift's approach is pragmatic but risky**
- **Pro**: Simpler, works for WASM target
- **Con**: May miss type errors that Blitz3D-NG catches
- **Con**: Forward scanning may guess wrong types
- **Risk**: SCPCB may have implicit variables that get wrong types
- **Recommendation**: Monitor for type-related bugs, may need semantic analysis

---

## 4. Type Suffix Handling (Critical Difference)

### Swift: Lexer-Level Attachment

**Location**: `Lexer/Lexer.swift:307-311`

```swift
// Type suffix is part of the identifier token
if let next = peek(), next == "%" || next == "#" || next == "$" {
    text.append(next)
    advance()
}
// Result: "x%" becomes single Token(text="x%", type=.identifier)
```

**Behavior**:
- Suffix attached to identifier at tokenization
- Single token returned to parser
- Suffix cannot be optional (always present if specified)

### Blitz3D-NG: Parser-Level Separation

**Location**: `tree/parser.cpp:455-463`

```cpp
// Type suffix is parsed after identifier
std::string Parser::parseTypeTag(){
    switch(toker->curr()){
        case '%':toker->next();return "%";
        case '#':toker->next();return "#";
        case '$':toker->next();return "$";
        case '.':toker->next();return parseIdent();  // Custom type
    }
    return "";  // Suffix is OPTIONAL
}
// Result: "x%" becomes IDENT("x") followed by TYPETAG("%")
```

**Behavior**:
- Identifier and suffix are separate tokens
- Suffix is optional (can be omitted)
- Parser explicitly handles suffix presence/absence

### Verdict

⚠️ **Potential compatibility issue**
- **Risk**: Swift expects suffixes attached; Blitz3D-NG treats as optional
- **Edge Case**: Can you use `x` and `x%` interchangeably in Blitz3D?
- **Impact**: If SCPCB mixes suffixed/unsuffixed usage, may break
- **Recommendation**: Test SCPCB code for mixed suffix usage

---

## 5. Case-Insensitivity

### Swift: Lowercase Conversion

**Location**: `Lexer/Lexer.swift:365`

```swift
let lowercased = text.lowercased()
if let keyword = keywords[lowercased] {
    return Token(type: keyword, ...)
}
```

- Single keyword map (lowercase only)
- Original case **lost** after lexing
- All keywords normalized to lowercase

### Blitz3D-NG: Dual Maps

**Location**: `tree/toker.cpp:9-90`

```cpp
map<string,int> alphaTokes;  // Original case
map<string,int> lowerTokes;  // Lowercase
```

- Two keyword maps maintained
- Can theoretically distinguish keyword cases
- Not used in practice (Blitz3D is case-insensitive)

### Verdict

✅ **Minor difference, no impact**
- Both are effectively case-insensitive
- Swift's approach is simpler

---

## 6. Include File Handling (CRITICAL DIFFERENCE)

### Swift: Stubbed Out

**Location**: `Parser/Parser.swift:495-501`

```swift
case .keywordInclude:
    advance()
    if currentToken.type == .stringLiteral {
        advance()
        return .empty(endSpan(from: startSpan()))  // STUB!
    }
    return nil
```

**Status**: 
- ❌ Parsed but **ignored**
- ❌ No file loading
- ❌ No recursive parsing
- ❌ No duplicate detection

**Impact**:
- Cannot compile multi-file projects
- SCPCB Main.bb uses **23 #Include statements**:
  ```
  Include "FMod.bb"
  Include "StrictLoads.bb"
  Include "KeyName.bb"
  Include "Blitz_Basic_Bank.bb"
  Include "AAText.bb"
  Include "Achievements.bb"
  Include "Items.bb"
  Include "Particles.bb"
  Include "MapSystem.bb"
  Include "NPCs.bb"
  Include "menu.bb"
  ... (23 total)
  ```

### Blitz3D-NG: Full Implementation

**Location**: `tree/parser.cpp:144-160`

```cpp
// Include file handling (pseudo-code)
std::set<std::string> included;  // Track loaded files

void Parser::parseInclude() {
    std::string filename = parseStringLiteral();
    std::string fullpath = fullfilename(filename);
    
    if (included.find(fullpath) != included.end()) {
        return;  // Already included
    }
    
    included.insert(fullpath);
    
    std::string content = readFile(fullpath);
    Toker *prevToker = toker;
    toker = new Toker(content, fullpath);
    
    parseProgram();  // Recursive parse
    
    delete toker;
    toker = prevToker;
}
```

**Features**:
- ✅ File loading and reading
- ✅ Recursive parsing
- ✅ Duplicate detection (via `included` set)
- ✅ Path resolution (`fullfilename()`)
- ✅ Error handling for missing files

### Verdict

🔴 **CRITICAL BLOCKER**
- Swift compiler **cannot compile SCPCB** due to missing includes
- Individual files compile (explains 94.7% success rate)
- Assembled game cannot work (Main.bb needs all includes)
- **Must implement immediately** (Priority P0)

---

## 7. Control Flow: Structured vs Unstructured

### Swift: Relooper (Structured)

**Algorithm**: Converts unstructured control flow to WASM structured blocks

**Location**: `IR/Passes/Relooper.swift`

```
Blitz3D:              WASM:
─────────────────     ─────────────────
Label Loop            (block $Loop
Goto Loop               (loop $LoopInner
                          br $LoopInner
Gosub Sub1            ))
Return                
                      (block $Sub1
Label Sub1              ...
...                     br $Return
Return                )
```

**Reason**: WASM only supports structured control flow
- No `JMP` instruction (only `br` to block labels)
- No arbitrary jumps
- Must transform to blocks/loops

### Blitz3D-NG: Direct Jumps (Unstructured)

**Implementation**: Native jumps in x86 or LLVM

```
Blitz3D:              x86 Assembly:
─────────────────     ─────────────────
Label Loop            Loop:
Goto Loop               jmp Loop
                      
Gosub Sub1              call Sub1
Return                  ret
                      
Label Sub1            Sub1:
...                     ...
Return                  ret
```

**Reason**: Native code supports arbitrary jumps
- Direct `JMP`, `CALL`, `RET` instructions
- Native call stack
- No transformation needed

### Verdict

✅ **Both approaches correct for their targets**
- Relooper is **required** for WASM (not a bug)
- Semantically equivalent in most cases
- **Risk**: Edge cases with complex nested gotos/gosubs
- **Recommendation**: Test SCPCB's control flow patterns

---

## 8. Memory Model

### Swift: WASM Linear Memory

**Model**:
```
Linear Address Space (0 to N)
├─ Heap (bump allocator)
│  ├─ String data
│  ├─ Bank allocations
│  └─ Custom type instances
├─ Free list (for reuse)
└─ Stack (WASM locals)
```

**Characteristics**:
- Single contiguous memory region
- Bump allocator + free list for heap
- No native stack frames (uses WASM locals)
- Pointer = i32 offset into linear memory

### Blitz3D-NG: Native Process Memory

**Model**:
```
Process Virtual Memory
├─ Code segment
├─ Data segment (globals, strings)
├─ Heap (malloc/free)
└─ Stack (procedure call frames)
```

**Characteristics**:
- OS-managed virtual memory
- System memory allocator
- Native stack frames with CALL/RET
- Direct pointer access

### Verdict

⚠️ **Fundamentally incompatible but workable**
- Cannot directly port memory-dependent code
- **Risk**: DATA/READ/RESTORE blocks may not work identically
- **Recommendation**: Test memory-intensive SCPCB features

---

## 9. Implicit Variable Declaration

### Swift: Forward Scanning

**Strategy**: `CodeGen/TypeInference.swift:29-127`

```swift
// Variable first referenced without declaration
// Example: x = 10 (no Dim/Local/Global)

// Swift scans forward in AST:
for stmt in statements {
    if stmt contains "x%" {
        inferType(x, .integer)
        break
    }
}
// If no suffix found, defaults to i32
```

**Limitation**:
- Only scans forward (not full semantic analysis)
- Defaults to i32 if no type hint found
- May guess wrong if first usage has no suffix

### Blitz3D-NG: Semantic Analysis

**Strategy**: Full AST analysis before codegen

```cpp
// Builds complete type environment
std::map<std::string, Type*> typeEnv;

// Analyzes all variable usages
void analyzeVariable(std::string name) {
    if (typeEnv.find(name) == typeEnv.end()) {
        error("Undefined variable: " + name);
    }
}
```

**Features**:
- Full type information before codegen
- Clear errors for undefined variables
- Complete type propagation
- No guessing

### Verdict

⚠️ **Swift's approach is pragmatic but risky**
- Works for simple cases
- May fail for complex SCPCB patterns
- **Risk**: Wrong type inference → runtime bugs
- **Recommendation**: Monitor for bugs, may need semantic analysis phase

---

## 10. Runtime Function Registration

### Swift: Zero Built-ins (by Design)

**Approach**:
```swift
// Compiler generates WASM imports
(import "env" "LoadMesh" (func $LoadMesh (param i32) (result i32)))

// Runtime provides implementations:
// - Swift engine (Sources/Blitz3DEngine/)
// - TypeScript runtime (web/src/runtime/)
```

**Characteristics**:
- Compiler has zero knowledge of function implementations
- All functions treated as imports
- Runtime can evolve independently
- No function signature validation at compile time

### Blitz3D-NG: 750+ Built-ins (Monolithic)

**Approach**:
```cpp
// Functions registered at compiler link time
// Example: blitz3d/commands.h
Entity * BBCALL bbLoadMesh(BBStr *file, Entity *parent);
Entity * BBCALL bbCreateCube(Entity *parent);
void BBCALL bbRenderWorld(bb_float_t tween);
// ... 750+ functions
```

**Characteristics**:
- Compiler knows all function signatures
- Type checking at compile time
- Functions compiled into executable
- Self-contained

### Verdict

✅ **Swift's separation is sound for WASM**
- Allows runtime flexibility
- Browser APIs can be easily integrated
- Smaller compiler binary
- **Trade-off**: No compile-time function signature validation

---

## Summary of Differences

| Aspect | Swift Compiler | Blitz3D-NG | Impact |
|--------|---------------|-----------|--------|
| **Runtime** | Separate (imports) | Monolithic (built-in) | ✅ Good separation |
| **Target** | WebAssembly | x86/LLVM | ✅ Correct for web |
| **Type System** | Simple suffix map | Polymorphic hierarchy | ⚠️ May miss errors |
| **Type Suffixes** | Lexer-level (attached) | Parser-level (separate) | ⚠️ Edge case risk |
| **Control Flow** | Relooper (structured) | Direct jumps | ✅ Required for WASM |
| **Include Files** | Stub (broken) | Full implementation | 🔴 Critical blocker |
| **Memory Model** | Linear heap | Native memory | ⚠️ Incompatible but OK |
| **Type Inference** | Forward scanning | Semantic analysis | ⚠️ Risk of wrong types |
| **Case Handling** | Lowercase only | Dual maps | ✅ No impact |

---

## Recommendations

### Immediate (P0)
1. ✅ **Keep Relooper** - Correct for WASM
2. ✅ **Keep import-based architecture** - Sound design
3. 🔴 **Implement include files** - Critical blocker

### Short Term (P1)
4. ⚠️ **Test type suffix edge cases** - Verify compatibility
5. ⚠️ **Test control flow edge cases** - Verify Relooper semantics
6. ⚠️ **Monitor type inference** - Watch for wrong types

### Medium Term (P2)
7. Consider adding semantic analysis phase for better type checking
8. Add compile-time function signature validation (optional)

---

## Next Document

See **03-runtime-comparison.md** for detailed analysis of Swift engine vs Blitz3D-NG runtime (750+ functions).
