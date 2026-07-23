# Directory: blitz3d-wasm/Sources/Compiler/CodeGen

**Parent**: [../](..)

**Description**: The `CodeGen` module converts the simplified `IR` into mostly
raw WebAssembly (WASM). It handles the complexities of the stack-based WASM
machine.

### Key Files

- **`IREmitter.swift`**: The core logic that visits `IRFunction`s and
  `IREffect`s and produces `WASMInstruction`s.

### Critical Subsystems

- **Label Stack Management**:
  - Blitz3D (and IR) uses high-level `Break` and `Continue`.
  - WASM uses `br <depth>`.
  - `IREmitter` maintains a `labelStack` of `LabelFrame`s (Block vs Loop) to
    dynamically calculate the correct branch depth for `break` (target enclosing
    block) and `continue` (target enclosing loop).
- **Memory Alignment**:
  - Calculates the correct `memarg` alignment (log2 of bytes) for `load`/`store`
    instructions to ensure valid WASM.
  - Example: `i32.load` usually requires `align=2` ($2^2=4$).
- **Type Mapping**: Maps `IRType` (.i32, .f32) to `WASMType`. Note that Blitz3D
  Strings/Arrays/Objects are passed as `.i32` pointers.

### Output

- The emitter populates a `WASMModule` structure (defined in `WASM` helper
  modules) which can then be serialized to binary `.wasm` or text `.wat`.
