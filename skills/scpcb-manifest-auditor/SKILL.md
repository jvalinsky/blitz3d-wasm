---
name: scpcb-manifest-auditor
description: Validate and fix `web/public/scpcb_manifest.json` and dist asset layout for the SCPCB web port. Use when init hangs due to missing preload files, when manifests reference missing files, when banned source assets (.b3d/.x/.rmesh) sneak back in, or when asset conversion/rewrites are needed.
---

# SCPCB Manifest Auditor

## Context

- The web loader expects `web/public/scpcb_manifest.json` (boot path is
  `/scpcb_manifest.json`).
- Init can hang if SCPCB reads files synchronously that are not preloaded
  (especially in `?init=main` workflows).

## Validate a built dist (recommended)

1. Build:
   - `deno task web:build`

2. Run the build gate (includes multiple validators):
   - `deno task test:web:build`

If you need to run individual validators:

- Ensure all manifest entries exist on disk:
  - `deno run -A Tools/validate_manifest_files.ts dist dist/scpcb_manifest.json`
- Ensure the manifest does not reference source models:
  - `deno run -A Tools/validate_no_source_models.ts --ban b3d,x,rmesh dist dist/scpcb_manifest.json`
- Ensure SMPK materials only reference existing textures:
  - `deno run -A Tools/validate_smpk_material_textures.ts dist`

## Fix workflows

- Rebuild/rewrite assets + manifest paths:
  - `deno task assets:scpcb:convert`
  - This can rewrite `scpcb_manifest.json` paths and validate that
    `.b3d/.x/.rmesh` are gone.

## Preload-group hygiene (avoid init hangs)

1. Identify which group is used for early preload (commonly `init` /
   `facility_assets`).
2. Ensure early-read config files are included (e.g. `options.ini` and other
   init-time reads).
3. If paths differ by case or have `Data/` vs root quirks:
   - Prefer fixing the manifest paths, but be aware of aliasing behavior in
     `web/src/shared/path_alias.ts`.

## Output expectations

When you respond, include:

- The failing validator output (first error block).
- Which file path(s) are missing/mismatched.
- The minimal manifest edit or conversion step to fix, plus the exact re-check
  command.
