# SCPCB Asset Context (Why B3D / .X / RMESH exist)

SCPCB was built on **Blitz3D** and ships a mix of asset formats typical of that
ecosystem: Blitz3D’s native B3D models, legacy DirectX `.x` models, and
SCPCB-specific room meshes.

## What each format is used for (typical SCPCB patterns)

### B3D (`*.b3d`)

Used for many character/prop models because it’s Blitz3D’s native model format
and can represent:

- Multiple meshes/surfaces per file
- Materials/brushes and texture references
- Hierarchy (nodes)
- Skeletal animation data (bones + keys) in some exporters/variants

### DirectX `.x` (`*.x`)

Used for some props and map assets. In the wild you most often see **text** `.x`
files with a header like `xof 0303txt`. The format is flexible and can embed
mesh/material/animation data, but SCPCB generally uses it for static geometry.

### RMESH (`*.rmesh`)

Room meshes are SCPCB-specific “compiled room” artifacts (the exact contents
vary by SCPCB/CBARE-EX forks). They typically contain:

- Room “drawn” geometry (rendered surfaces)
- Collision geometry
- Trigger volumes / placed entities (e.g. for events/waypoints) depending on
  version

You can see RMESH present in SCPCB depots, and community tools exist to
import/export RMESH for editors/engines.

SteamDB’s depot browsers are a convenient way to confirm which file extensions
are present in specific SCPCB depots/builds.¹

## How Track B uses these formats

### Production path: SMPK

For the browser build, Track B prefers converting source formats into **SMPK**
so that runtime loading is:

- Faster (single container, preprocessed buffers)
- More deterministic (no on-the-fly parsing quirks)
- Better suited to async browser asset delivery

See:

- `docs/SMPK_FORMAT.md`
- `docs/ASSET_PIPELINE.md`

### Exploration path: interpreter loaders

The interpreter (`dist/interpreter.html`) enables “source model” loading for
exploration and debugging.

In this repo, loading B3D/.X/RMESH directly is gated behind:

- `globalThis.__BLITZ3D_ALLOW_SOURCE_MODELS === true` (interpreter sets this)

Relevant code:

- `web/src/runtime/graphics/setup/3d.ts` (`LoadMesh`)
- `web/src/runtime/globals.ts`

## References

- SCPCB background / engine: https://scpcbgame.com/info.html
- SCPCB overview: https://en.wikipedia.org/wiki/SCP_%E2%80%93_Containment_Breach
- DirectX `.x` file overview (legacy):
  https://learn.microsoft.com/en-us/windows/win32/direct3d9/x-file-format
- B3D chunk format overview/spec:
  https://docs.luanti.org/for-creators/models/b3d-spec/
- RMESH importer tooling (example community tool):
  https://godotengine.org/asset-library/asset/4168
- RMESH reverse-engineered notes (community converter):
  https://gist.github.com/qeaml/69855dc49d1a012f99f054a51c0a1b40
- RMESH lightmap convention notes (community):
  https://gist.github.com/Omega47810/1d0459cc2ce52b5119b341c876468551
