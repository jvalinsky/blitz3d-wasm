---
name: blitz3d-ci-gates
description: Run, interpret, and fix Blitz3D-WASM CI/dev gates across Swift and Deno. Use when `deno task test:all` (or its sub-tasks like `test:swift`, `test:deno`, `test:web:build`, `test:wasm`, `engine:build`) fails, when a PR check is red, or when you want the fastest “what broke?” path and the smallest fix.
---

# Blitz3D CI Gates

## Quick start (fastest signal)

1. Run the full gate only when needed:
   - `deno task test:all`

2. Otherwise, bisect by sub-task (usually faster):
   - `deno task test:swift`
   - `deno task test:deno`
   - `deno task test:web:build`
   - `deno task test:wasm`
   - `deno task engine:build`

## Triage workflow

1. Identify the first failing command and re-run it alone.
2. If it’s a Deno gate:
   - Find the specific tool/script mentioned in the failure (often `Tools/*.ts`).
   - Re-run the exact command line from `deno.json` (copy/paste) to avoid task wrappers hiding output.
3. If it’s a Swift gate:
   - Run `swift test` (or `swift build`) directly to get full compiler diagnostics.
   - If SwiftPM sandboxing/caches cause issues, re-run with:
     - `swift test --disable-sandbox`
     - `CLANG_MODULE_CACHE_PATH=/tmp/clang-module-cache SWIFTPM_CACHE_PATH=/tmp/swiftpm-cache swift test --disable-sandbox`

## Common failure buckets (map log → owner)

- **Manifest/asset validation**: typically from `Tools/validate_manifest_files.ts`, `Tools/validate_no_source_models.ts`, `Tools/validate_smpk_material_textures.ts`.
- **SCPCB regressions**: look for `Tools/scpcb_audit_gate.ts` and `Tools/scpcb_import_leak_gate.ts`.
- **Runtime/Web loader issues**: often surface via `deno task test:web:build` (build + validators).
- **Compiler/unit tests**: `swift test` failures in `Tests/CompilerTests`, `Tests/Blitz3DCompilerTests`, `Tests/IntegrationTests`.

## Output expectations

When you respond, include:

- The exact command that fails (copy/paste).
- The first error location (file path + line if present).
- The smallest plausible fix and the next command to confirm.

