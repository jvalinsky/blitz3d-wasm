# References for Plan Set 2026-01-21_223702

This plan set draws from:

## Repo docs (Blitz3D-WASM)

- `../../../docs/STACK_BALANCE_HEURISTICS.md`
- `../../../docs/stack-balancing-research.md`
- `../../ROADMAP_TO_BROWSER.md`

## Repo artifacts (SCPCB compilation reports)

- Latest failing pattern example (“type mismatch in drop … got []”):
  - `../../compile_test_report_20260120_210405.txt`
- Example run summary (failed file list, category counts):
  - `../../compile_errors_20260120_210153.json`

## Repo docs (root / SCP port)

- `../../../../docs/COMPILER_STACK_BALANCING.md`
- `../../../../docs/BLITZ3D_RUNTIME_GAPS.md`
- `../../../../docs/decls-compatibility.md`
- `../../../../docs/spec_custom_dlls.md`
- `../../../../docs/spec_system_calls.md`
- `../../../../docs/BLITZ3D_COMPILER_REFERENCE.md`
- `../../../../docs/scpcb-module-analysis.md`

## Key code locations (Swift compiler)

- Compiler entry and orchestration:
  - `../../../Sources/Compiler/CodeGen/CodeGenerator.swift`
- Expression lowering:
  - `../../../Sources/Compiler/CodeGen/ExpressionGeneration.swift`
- Statement lowering:
  - `../../../Sources/Compiler/CodeGen/StatementGeneration.swift`
- Function generation + goto/gosub lowering:
  - `../../../Sources/Compiler/CodeGen/FunctionGeneration.swift`
- Data/Read/Restore handling:
  - `../../../Sources/Compiler/CodeGen/DataGeneration.swift`
- Stack/type validator:
  - `../../../Sources/Compiler/CodeGen/StackValidator.swift`
- Include preprocessor:
  - `../../../Sources/Compiler/Preprocessor/Preprocessor.swift`

## Reference compiler (C++ / blitz3d-ng)

- Token definitions (keyword coverage reference):
  - `../../../../reference/blitz3d-ng/src/tools/compiler/tree/toker.h`
- Parser architecture:
  - `../../../../reference/blitz3d-ng/src/tools/compiler/tree/parser.h`
- Type system model:
  - `../../../../reference/blitz3d-ng/src/tools/compiler/tree/type.h`

## External specs (for background; not vendored)

- WebAssembly Core Specification (validation and typing rules)
  - https://webassembly.github.io/spec/core/
