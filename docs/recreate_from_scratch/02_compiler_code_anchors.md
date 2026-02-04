# Compiler: Code Anchors (Prefer This Over Docs)

This page is intentionally **code-first**. Use it when recreating the compiler
from scratch: it points to the *actual* implementations that define behavior.

## CLI Entry + Flags

- CLI entrypoint: `Tools/wasm-cli/main.swift`
  - Notable flags: `--use-ir`, `--cmdbuf`, `--no-dedupe-includes`, `--debug`, `--source-map`

## Preprocessor (Includes + Encoding + Line Mapping)

- Include expansion + case-insensitive path resolution: `Sources/Compiler/Preprocessor/Preprocessor.swift`
  - `resolveCaseInsensitivePath(...)` implements the “SCPCB-friendly” include lookup.
  - `processWithMap(...)` builds a `(mergedLine -> (file,line))` map for diagnostics/debug.
  - Reads `.utf8` and falls back to `.windowsCP1252` for legacy sources.

## Parser (Syntax-Only; No Semantic Binding)

- Main parser: `Sources/Compiler/Parser/Parser.swift`
  - `parseDimDeclaration()` parses `Dim arr(x,y)` declarations.
  - `parseGlobalDeclaration()` supports `Global arr[10]` fixed array declarations (extension).
  - `parsePostfixExpression(...)` behavior matters for array-vs-call ambiguity:
    - Parentheses produce `.functionCall` (when adjacency rules apply).
    - Brackets produce `.arrayAccess` (if used).

## The “Array Access” Reality (Resolved During Lowering)

Blitz uses `arr(i)` syntax, but this compiler resolves it *semantically*:

- Lowering converts a `.functionCall(name, args)` into an array load/store **if**
  the symbol table says `name` is an array:
  - Expression loads: `Sources/Compiler/Lowering/ASTLowering.swift` (`lowerCall(_:)`)
  - Assignment stores: `Sources/Compiler/Lowering/ASTLowering.swift` (assignment lowering cases)

This is the key place where “docs can lie”: the behavior is defined by the lowering pass.

## Strings: The Canonical Layout

Strings are represented in linear memory as a Blitz3D object:

`[refCount:i32][len:i32][utf8 bytes...][0]` (then padded to 4 bytes in some contexts).

Code references:
- Typed IR pipeline string constants: `Sources/Compiler/Lowering/ASTLowering.swift` (`allocateString(_:)`)
- Legacy codegen string constants: `Sources/Compiler/CodeGen/ExpressionGeneration.swift` (`addStringData(_:)`)
- DATA/READ string encoding + padding rules: `Sources/Compiler/CodeGen/DataGeneration.swift`

## Types (New/Delete/For Each) Memory Header

Type instances have a fixed header at the front:

- `prev:i32` @ offset 0
- `next:i32` @ offset 4
- `typeID:i32` @ offset 8
- fields start @ offset 12

Code references:
- Type layout computation: `Sources/Compiler/Lowering/ASTLowering.swift` (`lowerTypeDeclaration(...)`)
- Delete list unlink + freelist recycle: `Sources/Compiler/CodeGen/StatementGeneration.swift` (delete case)
- Type metadata and offsets: `Sources/Compiler/CodeGen/TypeHandling.swift`

## WASM Correctness (Stack Discipline)

This repo implements explicit WASM stack validation/scheduling in codegen:

- Validator (3-stack model): `Sources/Compiler/CodeGen/StackValidator.swift`
- Stack scheduling optimizer (Koopman-style): `Sources/Compiler/CodeGen/StackScheduler.swift`
- IR → WASM emission + label stack for `br` depths: `Sources/Compiler/CodeGen/IREmitter.swift`

## Imports / ABI Surface

- Hardcoded/core imports and guardrails: `Sources/Compiler/CodeGen/CodeGenerator.swift` (`addImports()`)
  - Note the warning about pre-registering auto-imports with incorrect signatures.
  - Note the explicit comment about **not exporting imports** to avoid name collisions.

