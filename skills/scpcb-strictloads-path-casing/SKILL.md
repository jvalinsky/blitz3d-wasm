---
name: scpcb-strictloads-path-casing
description: Port and debug SCPCB StrictLoads and path behavior for Blitz3D-WASM web runtime. Use when SCPCB `FileType(...)` checks or `RuntimeError` strict wrappers break the web build, when asset paths differ by case (`DATA/` vs `Data/`) or use backslashes, or when missing-file behavior causes init hangs instead of clean failures.
---

# SCPCB StrictLoads + Path/Casing

## What SCPCB does

- `StrictLoads.bb` wraps `LoadImage/LoadMesh/LoadTexture/LoadSound/...` and
  often:
  - checks `FileType(file$)`,
  - reports errors loudly (console msg or `RuntimeError`),
  - assumes local disk layout and Windows-style paths (`GFX\...`).

## What the web port needs

1. Normalize paths consistently:
   - Convert `\\` → `/`
   - Avoid relying on case-sensitive lookups
2. Keep missing-file behavior explicit:
   - Prefer returning `0` in the same places native Blitz3D returns `0`
   - Avoid “hard crash during boot” unless you’re intentionally enforcing a
     preload contract

## Repo reference points

- Path alias / candidates:
  - `web/src/shared/path_alias.ts`
- VFS + manifest indexing:
  - `web/src/runtime/fileio.ts`
- SCPCB strict wrappers (source of expectations):
  - `~/Software/scpcb/StrictLoads.bb`

## Practical workflow

1. If SCPCB fails due to missing assets:
   - First fix the manifest/preload group, not the SCPCB code:
     - Use `scpcb-manifest-auditor` and run `deno task test:web:build`.
2. If SCPCB fails due to casing or `Data/` vs root quirks:
   - Prefer fixing/rewriting asset paths at conversion time and in
     `scpcb_manifest.json`.
   - Use aliasing only as a fallback (to avoid masking real path bugs).
3. If `StrictLoads.bb` is too aggressive for early web iterations:
   - Gate the strict `RuntimeError` paths behind a single global (one switch),
     so you can later re-enable strictness to harden builds.
