# Runtime: Code Anchors (Prefer This Over Docs)

This page is **code-first** pointers for rebuilding the browser runtime. When
docs disagree, the code wins.

## Runtime Entry + Wiring

- Loader creates and wires runtime pieces in `web/src/main.ts`
  - Instantiates `Blitz3DCore`, `Blitz3DGraphics`, `Blitz3DFileIO`
  - Sets up command buffer + entity table views
  - Enforces “single in-flight worker call” semantics + per-call timeouts

## Core State + String Semantics

- Runtime core and shared WASM state: `web/src/runtime/core.ts`
  - `Blitz3DCore.init(canvasId)` sets up the render canvas + 2D overlay canvas.
  - `Blitz3DCore.readString(ptr)` defines the **string ABI** the runtime
    expects:
    - Preferred: `[refCount:i32][len:i32][bytes...][0]` (headered Blitz string)
    - Fallback: raw C-string (null-terminated)

## Graphics (Imports, Rendering, Resource Lifecycle)

- Primary graphics runtime: `web/src/runtime/graphics/index.ts`
  - `setupImports(imports)` installs `env.*` and `blitz3d.*` imports via setup
    modules.
  - Import groups are wired in `web/src/runtime/graphics/setup/index.ts`
    (core/2d/image/3d/input/collision/picking/audio).
  - `dispose()` is the authoritative lifecycle cleanup:
    - cancels RAF
    - disposes renderer + forces context loss
    - walks scene and disposes geometries/materials/mixers
  - Headless mode support matters for CI/leak tooling:
    - `init3D()` can use a mock renderer when WebGL isn’t available.

## Command Buffer (Batching Hot Calls)

- Binary protocol and encode/decode: `web/src/shared/command_buffer.ts`
  - Constants: `CMDB_MAGIC`, `CMDB_VERSION`, header layout, `CmdOpcode`
  - Helpers: `beginFrame`, `writeCmd`, `drainCmds`

- Command buffer ABI handshake: `web/src/shared/cmdbuf_abi.ts`
  - Validates that wasm exports match runtime ABI version expectations.

- Runtime drain entrypoint:
  - Graphics installs `imports.env.DrainCommandBuffer` in
    `web/src/runtime/graphics/index.ts`
  - Decode/dispatch path is split:
    - decode + iteration: `web/src/shared/command_buffer.ts` (`drainCmds`)
    - opcode dispatch table: `web/src/runtime/command_executor.ts`
      (`dispatchCmd`)

## Entity Table (WASM-Authoritative Transform Reads)

- View over shared transform table: `web/src/shared/entity_table.ts`
  - Defines layout (`ENTITY_ENTRY_FLOATS`, offsets) and provides
    getters/setters.

## File I/O and VFS (Manifest + Missing-File Telemetry)

- VFS + handle-based IO for WASM imports: `web/src/runtime/fileio.ts`
  - Manifest indexing: `_rebuildManifestIndex()`, `_getManifestEntry()`
  - Preload mechanism (sync-IO compatibility via async preload):
    - `preloadAssetGroup(group, ...)`
    - `preloadFiles(files, ...)` (concurrency + progress + yields)
    - `fetchWithRetry(...)` (backoff)
    - `fetchAndRegister(...)` (registers into VFS maps)
  - Missing-file telemetry throttling: `_logMissing(...)`
  - The “truth” for case-insensitive lookups is implemented via internal maps.

## Path Compatibility / Aliasing

- Path normalization + candidates: `web/src/shared/path_alias.ts`

## Stubbing Imports (Only For Demos/Tooling)

- Safe stubbing utilities: `web/src/shared/wasm_imports.ts`
  - Used by interpreter/demo/harness paths to instantiate incomplete runtimes.
  - Treat as a dev tool: stubbing can hide real runtime gaps in production.

## Headless/Tooling Notes

- Leak tooling runs runtime code under Deno headless shims:
  - `Tools/memleak/leakcheck.ts`
  - `Tools/memleak/scpcb_churn.ts`
- Some tooling tasks use `--sloppy-imports`; don’t treat that as a production
  requirement.
