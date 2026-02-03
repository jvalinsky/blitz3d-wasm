# RMESH (SCPCB room meshes)

## Summary

RMESH is a SCPCB-specific room mesh format used to package a room’s geometry (and often collision + placed metadata) for fast loading in the game. RMESH files are present in SCPCB depots.

Because RMESH is not a standardized public format, community tooling typically relies on reverse engineering and is often tailored to specific SCPCB forks/versions.

## What it commonly contains (conceptual)

Most RMESH variants include:
- Rendered surfaces (“drawn” geometry)
- Collision mesh (often simplified / separate)

Some variants include additional authored data, such as:
- Trigger volumes
- Prefab/entity placement (waypoints, lights, etc.)
- Room metadata strings (e.g. header identifiers)

## Lightmaps and multiple UV layers (common SCPCB convention)

SCPCB room meshes frequently use a **lightmap** in addition to a base texture. Community conversion tools often model this as:
- a base texture UV set, and
- a second UV set for the lightmap

In practice, a common convention is using lightmap filenames with a suffix like `_lm` / `*lm` and treating the second UV channel as the lightmap UVs. (Exact details vary across exporters and SCPCB forks.)

## How Track B treats RMESH

- Production: convert room meshes to SMPK (or to a room bundle) and load them through the virtual filesystem/manifest.
- Interpreter: provides an RMESH loader to render *drawn* geometry for exploration.

## Where it’s handled in this repo

- Interpreter/source loader: `web/src/runtime/rmesh.ts`
- Loader dispatch: `web/src/runtime/graphics/setup/3d.ts` (`LoadMesh`)

## References

- SCPCB-related depot filetypes (example SteamDB depot showing `.rmesh`): https://steamdb.info/depot/1782381/history/
- Blender → RMESH conversion notes (lightmap UVs + `_lm` convention): https://gist.github.com/VirtualBrightPlayz/0ff72ec7bed56c6c51051f8c90c8afc6
- Example RMESH importer tooling (Godot asset; supports SCPCB variants): https://godotengine.org/asset-library/asset/4168
