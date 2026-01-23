# wasm-debugger-blitz3d (demo)

A small, static demo that visualizes Blitz3D → WASM execution side-by-side using a debug mapping (`*.bbdbg.json`). It replays a sample trace but is wired to host real instrumented modules (via `bbdbg` imports) once the compiler emits debug hooks.

## What it shows (today)
- Left pane: BB source with statement highlighting.
- Right pane: WAT view with a highlight at the matching debug site.
- Controls: Step / Continue / Reset through a sample trace (`data/sample.trace.json`).
- Call stack + current stmt/function display (mocked for the sample, but uses the same plumbing real WASM will feed).

## How to run
```
cd blitz3d-wasm/Examples/wasm-debugger-blitz3d
python3 -m http.server 3000
# open http://localhost:3000
```

## How to plug in a real build (when available)
1) Produce debug artifacts with the compiler (plan: emit `program.wasm` + `program.bbdbg.json`).
2) Drop them into `data/` (or adjust `config` in `app.js`).
3) Ensure the WASM is instrumented with imports:
   - `bbdbg.enter(frameId, funcId)`
   - `bbdbg.stmt(stmtId, siteIndex)`
   - `bbdbg.leave(frameId)`
4) Update `CONFIG` in `app.js` to point at your files and the exported entrypoint (e.g., `tick`).
5) The host `bbdbg` imports will capture events and drive the same UI used by the sample trace.

## Files
- `index.html` – basic UI shell
- `app.js` – session controller, mapping loader, stepping logic
- `data/sample.*` – sample source, mapping, trace, and WAT

## Notes
- This is intentionally dependency-free (vanilla JS + `<pre>` rendering) to keep it easy to reason about.
- The stepping model is statement-based per `docs/plans/2026-01-21-bb-wasm-debugger-visualizer.md`.
