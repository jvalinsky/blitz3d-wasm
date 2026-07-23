# SCPCB-Complete: Interpreter Path (2026-02-02)

This doc tracks the **SCPCB-complete** roadmap for the in-browser
**interpreter** (`dist/interpreter.html`) and its thin runtime
(`web/interpreter.js`).

It is intentionally **import-driven**: if SCPCB code calls a Blitz3D function,
the interpreter/runtime must at least provide a safe implementation (or a
well-defined stub) without generating invalid WASM or freezing the tab.

## Definition of “SCPCB-complete” (interpreter)

The interpreter is SCPCB-complete when:

1. SCPCB (or representative repro BB scripts) can compile without invalid-WASM
   errors caused by signature drift (void-vs-value) or missing auto-imports.
2. All _init-critical_ file IO calls are backed by an async-safe preload model
   (no sync XHR).
3. Long-running logic runs **without tab freezes**:
   - no blocking loops in the browser main thread
   - stepped execution via exported `__Step%()` (or equivalent) + watchdog.
4. Core gameplay loops can render, load assets, and accept input using the same
   runtime primitives as the SCPCB web loader.

## Coverage tooling

### SCPCB → Interpreter symbol coverage

Generates a “what SCPCB calls vs what the interpreter provides” report:

```bash
deno task interpreter:scpcb-coverage -- --top 80
```

This reads `import_requirements_full.json` and compares:

- functions used by SCPCB sources
- `web/interpreter.js` runtime keys
- `web/compiler_worker.js` auto-import allowlist

### Per-WASM import audit (spot-check)

When you have a compiled `.wasm` module:

```bash
deno task interpreter:audit -- path/to/program.wasm
```

## Known hazard: “void used as value”

Many Blitz3D built-ins are statement-like, but SCPCB often uses them in
expression contexts when the _real_ engine returns a status code.

In the interpreter we avoid invalid WASM by:

- keeping side-effect calls as statements, and
- adding explicit status helpers where needed:
  - `ImageLoaded(image)`
  - `TextureLoaded(tex)`

When you add a new helper, update both:

- `web/interpreter.js` runtime imports, and
- `web/compiler_worker.js` auto-import allowlist.

## Immediate priorities (small → large impact)

1. **Stability gates**
   - ensure missing imports fail with a clear message (not invalid WASM)
   - keep “step mode” default for anything with loops
2. **VFS + file IO parity**
   - map `ReadFile/OpenFile/ReadLine/Eof/...` onto VFS/ZIP-backed FS
3. **2D draw parity**
   - HUD/GUI primitives used by SCPCB menus and loading screens
4. **3D + materials**
   - textures/material flags used in SCPCB (`EntityFX/Blend/Alpha`, texture
     transforms)
5. **Audio**
   - minimum viable playback model under browser gesture constraints
