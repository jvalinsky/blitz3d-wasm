# Compiler Rebuild Notes (Swift → WASM)

This is a “what to implement first, and what to not forget” guide for rebuilding
the compiler, using this repo as the reference implementation.

## Primary Principle

- The compiler generates WASM for language semantics.
- Everything that is “engine/runtime” is an **import** (graphics/audio/input/fileio).

See also: `docs/COMPILER_DESIGN.md`, `docs/compiler_architecture.md`.

## Code-First References (Start Here)

- `docs/recreate_from_scratch/02_compiler_code_anchors.md` (this folder’s “truth table” for compiler behavior)
- `docs/recreate_from_scratch/02c_ir_design_tradeoffs.md` (IR strategy options and why WASM shapes the design)

## Recommended Implementation Order

1. **Lexer**
   - Identifiers, keywords, numeric literals, string literals
   - Type suffix tokens (`%`, `#`, `$`) and case-insensitivity rules
2. **Parser**
   - Expressions + precedence
   - Statements (`If`, `While`, `For`, `Select`, function decl/calls)
   - Include system (must match SCPCB-style includes)
3. **Semantic layer**
   - Symbol tables (globals/locals/const)
   - Type resolution (numeric coercions, string ops)
4. **IR**
   - Choose an IR that makes stack correctness explicit
   - See: `docs/recreate_from_scratch/02c_ir_design_tradeoffs.md`
5. **Codegen**
   - Emit WASM in a way that is easy to validate and debug
6. **Validation tooling**
   - Always run `wasm-validate` (and any stack-balancing tools) on outputs.

## “Known Traps” (Lessons Learned)

### 1) Arrays vs calls (`arr(i)` ambiguity)

Blitz syntax uses parentheses for both:
- function calls: `Foo(x)`
- array access: `arr(i)`

In this codebase, the parser generally produces a `.functionCall` for `arr(i)`,
and **Lowering** decides whether that call is actually an array access based on
the symbol table.

Code references:
- Parser postfix call parsing: `Sources/Compiler/Parser/Parser.swift`
- Call → array load/store rewrite: `Sources/Compiler/Lowering/ASTLowering.swift` (`lowerCall(_:)` + assignment lowering)

### 2) String layout and printing

Your runner/runtime must agree with the compiler on string representation.
If the runtime expects `(ptr,len)` but the compiler uses a headered object
(`[refcount][len][utf8...]`), you’ll get nonsense output or crashes.

Code references:
- Typed IR string constants: `Sources/Compiler/Lowering/ASTLowering.swift` (`allocateString(_:)`)
- Codegen string constants: `Sources/Compiler/CodeGen/ExpressionGeneration.swift` (`addStringData(_:)`)
- DATA/READ strings + padding: `Sources/Compiler/CodeGen/DataGeneration.swift`

### 3) WASM stack discipline

WASM validation is strict: all control-flow paths must match stack height/type.
This gets tricky around:
- early returns,
- `If` expressions used for values,
- `Select/Case`,
- short-circuit boolean logic.

This repo has extensive material on stack balancing; reuse that approach rather
than “winging it”.

Code references:
- Validator: `Sources/Compiler/CodeGen/StackValidator.swift`
- Scheduler: `Sources/Compiler/CodeGen/StackScheduler.swift`
- IR emitter + label stack: `Sources/Compiler/CodeGen/IREmitter.swift`

### 4) Function name conflicts (“shadowing”)

User functions can collide with imported runtime function names.
You must define a policy:
- forbid collisions (error), or
- namespace imports, or
- mangle internal names.

Code references:
- Import/export collision guardrails: `Sources/Compiler/CodeGen/CodeGenerator.swift`

### 5) `For Each` + `Delete` hazards

Deleting the current node in a linked-list iteration is a classic bug source.
Even if you support it, document the safe patterns and test it heavily.

Code references:
- Type header + offsets: `Sources/Compiler/Lowering/ASTLowering.swift` (`lowerTypeDeclaration(...)`)
- Delete unlink + freelist: `Sources/Compiler/CodeGen/StatementGeneration.swift`

## Suggested Minimal Feature Set (for an MVP demo)

- Locals/globals/const
- Numeric ops (`i32`, `f32`) + coercions
- Strings (allocation, concat, compare) — minimal subset
- Arrays (Dim + load/store)
- Types: `Type`, `Field`, `New`, `Delete`, `For Each`
- Imports: declare and call imported functions

## Where To Look In This Repo

- CLI entrypoint and project/asset flags: `Tools/wasm-cli/main.swift`
- Include handling + line maps: `Sources/Compiler/Preprocessor/Preprocessor.swift`
- Parser: `Sources/Compiler/Parser/Parser.swift`
- IR + lowering: `Sources/Compiler/Lowering/`, `Sources/Compiler/IR/`
- Codegen: `Sources/Compiler/CodeGen/`
- Stack correctness research: `docs/STACK_BALANCE_HEURISTICS.md`
