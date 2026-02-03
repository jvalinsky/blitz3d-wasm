# DirectX `.x` format (text `.xof ... txt`)

## Summary

DirectX `.x` is a legacy Microsoft 3D asset format that can represent meshes, materials, and animation. Files begin with a header such as `xof 0303txt` (text) or a binary variant.

SCPCB ships a number of `.x` assets alongside B3D/RMESH content.

## What it can contain

Depending on the templates used, `.x` can include:
- Mesh vertex/index data
- Normals, UVs, vertex colors
- Materials and texture filenames
- Animation sets (keyframes, bone hierarchies)

The format is extensible via templates, and real-world files vary significantly.

## Why `.x` shows up in a Blitz3D game

Blitz3D can load `.x` meshes directly, so it was a common “interop” format for content authoring pipelines of the era (DirectX exporters were widely available).

## How Track B treats `.x`

- Production: convert `.x` to SMPK offline.
- Interpreter: supports **text** `.x` parsing for exploration (best-effort; not a full template engine).

## Where it’s handled in this repo

- Interpreter/source loader: `web/src/runtime/xloader.ts`
- Loader dispatch: `web/src/runtime/graphics/setup/3d.ts` (`LoadMesh`)

## References

- Microsoft `.x` file format (legacy): https://learn.microsoft.com/en-us/windows/win32/direct3d9/x-file-format
- SCPCB-related depot filetypes (example SteamDB depot showing `.x`): https://steamdb.info/depot/1782381/history/
