# WASM Debugging Tooling Research (Blitz3D BASIC / engine)

Date: 2026-02-02

This document captures research + a proposed implementation plan for debugging
Blitz3D BASIC (BB) code compiled to WebAssembly (WASM), including source-level
stepping aligned with original BB source and visualization/inspection of linear
memory and heap semantics (Types/New/Delete, strings, arrays, lists).

## Target capabilities (what “good” looks like)

### Source-level debugging

- Breakpoints on BB file:line (and ideally column spans).
- Step over / into / out, with a stable call stack.
- Locals + watch expressions (at least for scalars and pointers).
- Dual view that can show:
  - BB source (primary), and
  - WASM disassembly / instruction offsets (secondary), and
  - optional: compiler IR nodes (power user mode).

### Memory debugging

- Linear memory inspector (address view, typed view, range watches).
- “Semantic heap” inspector that understands Blitz constructs:
  - `Type` instances and field layouts
  - linked lists, `First/Last/After/Before`
  - strings (encoding + length), arrays (Dims)
- RAM watch list patterns borrowed from speedrun/TAS tooling:
  - watch values at addresses, format as int/float/string/pointer
  - follow pointers / show pointer chains
  - optional “freeze” / forced writes (debug builds only)

### Game debugging ergonomics

- Tick/frame stepping (manual `UpdateGame()` stepping).
- Input record/replay (deterministic bug repro).
- Trace timeline (asset loads, command buffer flushes, audio decode, render
  steps).
- Render/GPU capture compatibility (e.g. “capture this frame” workflow).

## What exists in the ecosystem (tools/patterns to copy)

### WebAssembly source-level debugging

Two practical strategies exist:

1. **Emit DWARF debug info in the WASM module** and use existing debugger UIs
   (browser devtools and/or VS Code).
2. **Build a custom “debug build” mode** that instruments statement boundaries
   and uses an out-of-band mapping file to drive a debugger UI you control.

In practice, (2) is the fastest path to a usable debugger and de-risks gaps or
inconsistencies in DWARF support in browser tooling; DWARF can be an optional
future milestone once the core mapping and stepping logic is stable.

Commonly used WASM tooling in this space:

- WABT: `wasm2wat`, `wasm-objdump`, etc.
- `wasm-tools`: parsing/printing/validating and custom-section inspection.
- Binaryen: IR/optimizer tooling that often appears in debug/release pipelines.

### Reverse engineering + speedrun community patterns

When debugging games, tooling tends to converge on these core workflows:

- **Memory watch** (live values by address, pointer following).
- **Frame/tick stepping** (especially in emulators/TAS tools).
- **Input recording + deterministic replay**.
- **Event/trace logging** (“what happened on this frame?”) with timeline UI.

Representative tools/patterns (inspiration, not necessarily direct integration):

- Memory scanners and watch lists (classic “cheat engine” style UX).
- Emulator memory tools and scripting (TAS tools like BizHawk/Dolphin).
- Timing/autosplitting driven by state/memory reads (LiveSplit-style
  integration).
- GPU frame inspection/capture tooling (RenderDoc-style workflows).

## Proposed architecture for Blitz3D-WASM debugging

### Debug artifacts

Compiler outputs (debug builds):

- `program.wasm`: compiled output.
- `program.bbdbg.json`: sidecar mapping + debug metadata (emitted by
  `-d/--debug` today):
  - function IDs/names
  - BB source file/line/col spans
  - mapping: function IDs + statement boundaries → BB spans
  - (future) type layouts / field offsets for Blitz `Type` definitions
  - string/array runtime layout version info

Runtime provides (debug builds):

- `bbdbg.__bbdbg_enter/leave/stmt` imports: lightweight instrumentation hooks
  for call stack + statement tracing (used by the worker debugger overlay
  today).
- (future) `__dbg_trap(id)` import: statement boundary hook that can pause
  mid-call (used for true step over/into/out).
- Optional: `__dbg_event(kind, a, b, c)` import or a shared ring buffer for
  trace events.
- Optional: debug exports to simplify memory inspection:
  - `__dbg_heap_regions()` (returns region table)
  - `__dbg_describe_ptr(ptr)` (returns type tag / field descriptors)

Frontend (web UI) provides:

- Debug panel with BB source viewer (highlight current span).
- Breakpoint management and stepping controls.
- Call stack view using function IDs + mapping metadata.
- Memory inspector + semantic heap viewer + watch list.
- Trace timeline view for “last N events”.

Power-tool mode (optional, recommended):

- A host-run CLI debugger (run WASM outside the browser) for deterministic
  stepping, easier repros, and deep inspection without browser constraints.

### Why a trap-based debugger first

DWARF-first is attractive, but a trap-based debugger delivers:

- A stable stepping experience even when browser DWARF support is incomplete.
- Domain-specific stepping points (statement boundaries, “tick boundaries”).
- Tight integration with Blitz-specific memory semantics (which generic
  debuggers won’t understand).

DWARF can then be layered on top once the internal mapping and semantics are
proven.

## Detailed implementation plan (milestones)

### Milestone 0 — Decide where debugging runs

Define two supported modes:

- **Browser-attached debugging (primary UX):** real web runtime + debugger
  overlay.
- **Host-run debugging (power tool):** deterministic stepping + deep memory
  inspection.

Deliverables:

- 1-page “debug modes + tradeoffs” doc.
- A proof-of-life that can pause/step a trivial BB program.

### Milestone 1 — Stable debug identities in the compiler

Add/verify invariants in the Swift compiler pipeline:

- Every AST node / statement / expression has a source span.
- Lowering preserves a dominant source span per IR instruction (even if coarse).
- Codegen produces mapping:
  - WASM function + instruction offset (or trap id) ↔ IR node ↔ BB span.

Deliverables:

- `--debug` compile flag that emits:
  - stable function naming (WASM `name` section and/or export naming
    conventions)
  - `*.bbdbg.json` mapping sidecar.
- CLI helper `b3d-dbg dump`:
  - input: wasm PC (or trap id)
  - output: BB file:line + function name + (optional) IR node info.

### Milestone 2 — “Good enough” stepping via instrumentation (fast path)

In debug codegen:

- Today: statement boundaries are already reported via `bbdbg.__bbdbg_stmt` and
  surfaced in the worker overlay as a bounded trace + “breakpoint hits during
  the last call”.
- Next: insert a pausable `call __dbg_trap(id)` at statement boundaries and/or
  basic-block heads so the debugger can pause mid-WASM-call (needed for true
  step over/into/out).

Stepping semantics:

- step-into: run until next trap (or call depth change then next trap).
- step-over: run until next trap at same call depth.
- step-out: run until call depth decreases then next trap.

Deliverables:

- Debugger panel:
  - BB source view + current highlight
  - breakpoints
  - call stack (symbolic via your mapping)

### Milestone 3 — Blitz-specific memory inspector (semantic heap)

Add debug-only metadata and hooks so memory is inspectable:

- Linear memory regions:
  - stack region (if applicable), heap arena(s), static data, type tables, etc.
- Alloc/free hooks:
  - on alloc/free, emit events `{ptr,size,typeTag,siteId,tick}` into a ring
    buffer.
- Type-aware decoding:
  - expose type layout tables and field offsets from compiler → runtime → UI.
- RAM watch list UX:
  - watch values as i32/f32/string/pointer/type
  - follow pointer chains
  - optional freeze/write (debug builds only)

Deliverables:

- Memory inspector panel:
  - address view + typed view
  - semantic object view (field table + pointer following)
  - watch list
- “Snapshot” export: compact debug report containing:
  - mapping version + runtime layout version
  - heap regions
  - live allocation table summary
  - selected watch values / pointers

### Milestone 4 — Optional: DWARF emission (integrate with existing debuggers)

Once Milestones 1–3 are stable:

- Emit DWARF line tables (start with `.debug_line` and names).
- Validate debug sections with existing WASM tooling.
- Try integration with:
  - Chrome DevTools DWARF workflows
  - VS Code JS WebAssembly debugging

Deliverables:

- `--debug=dwarf` build that supports breakpoints by file:line in external
  tools.

### Milestone 5 — Game debugging features (daily-driver ergonomics)

Borrowed from game RE / speedrun workflows:

- Tick/frame stepping: one `UpdateGame()` per click.
- Input record/replay: log inputs with tick index; replay deterministically.
- Trace timeline: VFS loads, audio decode/play, GPU uploads, command-buffer
  flushes.
- Render capture hooks: make it easy to capture a frame for graphics triage.

Deliverables:

- Toggleable in-game debug HUD:
  - tick, dt, heap usage summary, entity counts, last N events.

## Risks / gotchas

- Browser DWARF support varies; the custom trap debugger avoids blocking on it.
- Optimizations harm stepping fidelity; maintain a dedicated debug codegen
  profile.
- Memory semantics must be versioned; snapshots should record layout versions.

## Open questions (needs product decisions)

1. First “win”: prioritize source stepping (Milestone 2) or memory inspector
   (Milestone 3)?
2. Acceptable debug-only instrumentation: can debug builds import a pausable
   `__dbg_trap` (in addition to the existing `bbdbg.__bbdbg_*` hooks)?
3. Should host-run debugging be a first-class mode, or a later power tool?
