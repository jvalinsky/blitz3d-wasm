# Typed IR Implementation Follow-up

## Remaining Tasks

1. **Environment Fix**: Resolve the Nix SDK mismatch to enable `swift build` and `swift test`.
2. **For Loop Implementation**: Complete `forStmt` emission in `IREmitter.swift`. It currently lacks local variable index lookup.
3. **Repeat Loop Verification**: Verify `repeatStmt` emission logic with real WASM validation.
4. **Integration Tests**: 
   - Write Blitz3D programs that exercise all IR nodes.
   - Compare output of `--use-ir` vs original codegen.
   - Run through `wasm-validate`.
5. **Array Logic**: Refine `assignArray` and `loadArray` to handle multi-dimensional arrays and proper bounds checking if needed.
6. **String Allocation**: Implement `allocateString` in `ASTLowering` to properly register string literals in the data section.
7. **Type Collection**: Wire up type collection logic for user-defined types in IR.

## Blockers
- **SDK Mismatch**: `Apple Swift version 6.2.3` compiler vs `Apple Swift version 5.10` SDK in nix shell.
