---
name: scpcb-web-porting
description: Practical workflow for porting the SCPCB Blitz3D codebase under `~/Software/scpcb` to run on Blitz3D-WASM (Track B web runtime). Use when editing SCPCB `.bb` files for browser compatibility, disabling Windows-only subsystems (DLL/decls, window hacks, map creator), handling init hangs/launcher loops, and keeping asset paths/INI reads compatible with the web loader and manifest.
---

# SCPCB Web Porting (repo-local)

## Quick map of SCPCB subsystems

- `Main.bb`: boot + options.ini + graphics init + global includes
- `StrictLoads.bb`: wrappers around Load* + audio stream helpers (hard-fail behavior)
- `Save.bb`: save/load + directory walking (`ReadDir`, `CreateDir`, `WriteFile`)
- `Update.bb`: updater + remote file HTTP/FTP (`OpenTCPStream`) (not browser-friendly)
- `Map Creator/*`: Windows GUI + user32/kernel32 hacks (not browser-friendly)
- `.decls` + `.dll`: Windows native dependencies (not browser-friendly)

## Porting principles (keep correctness visible)

1. Prefer **removing/feature-gating** Windows-only systems in SCPCB over stubbing everything.
2. Avoid hiding correctness bugs behind host stubs:
   - Run the import-leak gate after any SCPCB compile:
     - `deno run -A Tools/scpcb_import_leak_gate.ts --wasm web/public/scpcb.wasm --require-root`
3. Make init deterministic:
   - Ensure init-time file reads are in preload groups in `web/public/scpcb_manifest.json`.

## High-risk SCPCB areas (common port blockers)

- **DLL/decls + window manipulation**:
  - `fullscreen_window_fix.bb`, `user32.decls`, `kernel32.decls`, `gdi32.decls`
- **Updater/network**:
  - `Update.bb` uses `OpenTCPStream`, HTTP parsing, local file writes
- **Save system**:
  - expects directory writes/listing in the game folder
- **StrictLoads**:
  - uses `FileType(...)` and raises `RuntimeError` when assets are missing
- **Path casing/format**:
  - SCPCB uses backslashes and sometimes `DATA\...` vs `Data\...`

## Suggested checks while iterating

- Compile SCPCB to Track B wasm:
  - `deno run -A Tools/compile_scpcb_main.ts`
- Validate SCPCB assets + manifest in dist:
  - `deno task test:web:build`
- If you touched runtime imports/stubs:
  - `deno task interpreter:audit`
  - `deno task interpreter:scpcb-coverage:check`

