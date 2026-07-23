# Lessons Learned (High-Leverage Rules)

These are the rules that most reduced debugging time and prevented “dead ends”.

For rebuild acceptance gates tied to these lessons, see:

- `docs/recreate_from_scratch/06_testing_tooling_and_ci.md`

## Architecture

- Keep the boundary simple: **WASM = game logic; TS/JS = browser bindings**.
- Reimplementing large BB subsystems in JS is usually a trap; prioritize
  compiling and running the existing BB logic whenever possible.

## Browser Safety (No Freezes)

- Default to **paused**. Make “run forever” an explicit opt-in.
- Put WASM in a **Worker** and wrap every call in a **watchdog timeout**.
- Prefer explicit “single tick” entrypoints over calling `Main()`/tight loops.

See: `web/src/main.ts`, `web/src/worker/scpcb_worker.ts`.

**Acceptance checks**

- Worker call timeouts terminate the worker (not “hang forever”).
- `deno task memleak:wasm:timeout` catches “infinite loop” exports.

## IO and Asset Loading

- Legacy BB frequently assumes synchronous reads; solve it via **manifest
  preloads**, not by trying to resurrect sync XHR behavior.
- Treat path compatibility (case, slashes, aliases) as a first-class subsystem.

See: `web/src/runtime/fileio.ts`, `web/src/shared/path_alias.ts`,
`docs/SMPK_SYSTEM.md`.

**Acceptance checks**

- Missing init-critical files show up as explicit missing-path telemetry (not
  silent hangs).

## Performance at the JS↔WASM Boundary

- Don’t fight the call overhead: batch hot calls with a **command buffer**.
- Keep WASM authoritative for frequently-read state (e.g. transforms) via shared
  memory tables mirrored by JS.

See: `docs/COMMAND_BUFFER_SYSTEM.md`, `web/src/shared/command_buffer.ts`.

**Acceptance checks**

- Command buffer ABI mismatch fails fast (clear error).

## Audio

- Expect user-gesture gating (autoplay policies); initialize/resume audio on
  first click/key/touch and make “no audio yet” a normal state.

## WebAssembly Memory

- Plan for `WebAssembly.Memory.grow()` invalidating typed array views;
  centralize the “refresh views” logic so you don’t have stale references spread
  everywhere.

## Testing and Stability

- Gate every compiler change behind `wasm-validate` + fixture compilation.
- Add leak/freeze churn tests early; they catch regressions that “seem fine” in
  short manual runs.

See: `docs/MEMORY_LEAK_DETECTION.md`, `deno.json`, `Tools/tests/`.

**Acceptance checks**

- `deno task memleak:run` stays within heap growth thresholds for create/dispose
  cycles.
- `deno task memleak:scpcb:churn` stays within heap/WASM growth thresholds.
