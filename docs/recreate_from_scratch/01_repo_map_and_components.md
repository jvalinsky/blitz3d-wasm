# Repo Map and Components (What We’d Rebuild)

This file is a reconstruction-oriented inventory: what exists, what it does,
and what the **minimum viable subset** would be for a clean-room rebuild.

## Core Components

### Compiler (Swift)

**Purpose**
- Parse Blitz3D BASIC → generate WebAssembly.

**Where it lives**
- `Sources/Compiler/`

**Key subsystems**
- Lexer: `Sources/Compiler/Lexer/`
- Parser: `Sources/Compiler/Parser/`
- AST: `Sources/Compiler/AST/`
- IR + lowering: `Sources/Compiler/IR/`, `Sources/Compiler/Lowering/`
- Codegen: `Sources/Compiler/CodeGen/`

**MVP subset**
- Enough language features to run a thin demo (`particles.bb`-class complexity):
  - variables, functions, loops, basic strings, arrays, Types, imports.

### Runtime (TypeScript)

**Purpose**
- Provide browser bindings: WebGL/Three.js, Web Audio, input, file IO.
- Bridge performance-critical calls via batching (command buffer).

**Where it lives**
- `web/src/runtime/`
- Shared support: `web/src/shared/`

**MVP subset**
- “Hello demo” runtime imports + a basic renderer, no asset pipeline.

### Loader + Worker Harness (TypeScript)

**Purpose**
- Boot: fetch WASM + manifest + assets, instantiate, wire imports.
- Enforce no-freeze behavior:
  - Worker, watchdog, manual stepping, safe modes.

**Where it lives**
- `web/src/main.ts`
- `web/src/worker/`

## Supporting Components

### Asset pipeline / formats

**Purpose**
- Convert and package game assets for fast web loading (SMPK).
- Provide loaders for formats (B3D, X, RMESH), plus path-compat quirks.

**Where it lives**
- Tools: `Tools/`
- Docs: `docs/SMPK_SYSTEM.md`, `docs/ASSET_PIPELINE.md`, `docs/FILE_FORMAT_LOADERS.md`

### Testing + validation

**Purpose**
- Keep the compiler output spec-valid and behavior-correct.
- Catch leaks/freeze regressions early.

**Where it lives**
- Swift tests: `Tests/`
- Deno tooling/tests: `Tools/tests/`, `deno.json`
- Docs: `docs/MEMORY_LEAK_DETECTION.md`

## “Rebuild MVP” Suggested Scope

If rebuilding from scratch, the lowest-risk MVP target is:

1. Compile a small BB demo (particles/sprites) to WASM.
2. Implement ~20–50 runtime imports in TS.
3. Run in a Worker with manual-tick and watchdog timeouts.
4. Use a tiny asset story (single texture) before attempting SCPCB assets.

This produces a stable platform before adding:
- full VFS,
- command buffer,
- asset pipeline,
- SCPCB-specific compatibility.

