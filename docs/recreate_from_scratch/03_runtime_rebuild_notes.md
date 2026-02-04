# Runtime Rebuild Notes (TS/JS Browser Bindings)

The runtime is the “engine surface” that the compiled WASM calls into.
Rebuilding it from scratch is mostly about:

- defining a stable import API,
- ensuring performance at the boundary,
- enforcing resource lifecycle rules,
- providing compatibility shims (file paths, sync-IO expectations).

## Runtime Taxonomy (Imports)

In practice, runtime imports fall into:

- **Graphics** (Three.js/WebGL): entity creation, transforms, rendering, textures
- **Audio** (Web Audio): load/decode/play, channel controls
- **Input**: keyboard/mouse state
- **File IO**: VFS reads, seeking, INI reads, etc.
- **Debugging**: logs, error reporting, tracing hooks

This repo’s implementation lives in:
- `web/src/runtime/`
- and shared support in `web/src/shared/`

## Boundary Performance: When to Batch

Some calls are low frequency (fine as direct imports):
- `LoadTexture`, `CreateCamera`, `LoadSound` (relatively rare)

Some calls are high frequency (should be batched):
- `PositionEntity`, `RotateEntity`, `EntityAlpha`, per-entity updates

### Command Buffer

For hot paths, use a binary “write in WASM, drain in JS” protocol.

See: `docs/COMMAND_BUFFER_SYSTEM.md`, and code in `web/src/shared/command_buffer.ts`.

### Entity Table

To keep WASM authoritative (and avoid JS↔WASM getters), store entity transforms
in WASM linear memory in a fixed layout that JS can mirror.

See: `docs/COMMAND_BUFFER_SYSTEM.md` (entity table layout), and code in
`web/src/shared/entity_table.ts`.

## Resource Lifecycle Rules (Hard Requirement)

If you rebuild, treat this as non-negotiable:

- Every created resource must have a disposal path:
  - Three.js geometries/materials/textures
  - audio buffers/nodes
  - RAF/interval timers
  - Worker instances
- Every “global map of handles → objects” must delete entries deterministically.

See: `docs/MEMORY_LEAK_DETECTION.md`.

## “MVP Runtime” Suggestion

Start with a minimal import surface for one demo and expand only from call-path evidence:

1. Minimal graphics imports
2. Debug logging
3. Timing / input
4. File IO (only when you need assets)
5. Batch protocol once you hit perf limits

## Where To Look In This Repo

- Runtime core: `web/src/runtime/core.ts`
- Graphics: `web/src/runtime/graphics/index.ts`
- File IO + VFS: `web/src/runtime/fileio.ts`
- Command buffer: `web/src/shared/command_buffer.ts`

