# Assets, VFS, and Legacy IO Constraints

To run real games (SCPCB-class), you need:

- a virtual filesystem (VFS),
- a manifest-driven preload system,
- aggressive compatibility for path quirks.

## The Browser Constraint: Sync IO Is Effectively Gone

Old code often assumes synchronous file reads. Browsers increasingly restrict or
deprecate synchronous XHR, and modern fetch APIs are async.

Practical implication:

- Identify “init-critical” reads and **preload** them (grouped in manifest).
- When running legacy init paths, missing preloads will look like “hangs”.

See also:

- `docs/ASSET_PIPELINE.md`
- `docs/SMPK_SYSTEM.md`
- `web/src/runtime/fileio.ts`
- `web/public/scpcb_manifest.json`

## Manifest Design

Use explicit groups:

- `boot`: the minimum needed to show UI + load WASM
- `init`: files required for deterministic initialization steps
- `facility_assets` (or similar): heavy assets required before calling legacy
  init

This repo’s loader uses a boot manifest and staged progress reporting.

## Path Aliasing

SCPCB and mods often rely on:

- case-insensitive paths,
- mixed slashes,
- relative “..” patterns,
- legacy folder conventions.

Treat path normalization and aliasing as a first-class subsystem.

## Offline Conversion (Why SMPK Exists)

For web delivery, you rarely want to ship original source formats verbatim.
Offline conversion enables:

- smaller network transfers,
- fewer runtime parse spikes,
- consistent GPU-ready layouts.

See: `docs/SMPK_SYSTEM.md`, `docs/SMPK_FORMAT.md`.
