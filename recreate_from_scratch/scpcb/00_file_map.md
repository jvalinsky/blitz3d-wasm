# SCPCB File Map (What’s Where)

This is a code-first map of `~/Software/scpcb` with the minimum context needed
to understand the game’s architecture.

## Top-Level Entrypoint

- `~/Software/scpcb/Main.bb`
  - Owns startup checks, config loads, include chain, global state, and the main
    loop.
  - Defines core Types like `Doors` and `Events` (and includes others).

## Include Chain (Main.bb)

`Main.bb` pulls most systems in through `Include` statements. Key inclusions:

- Audio + strict loading + platform glue:
  - `FMod.bb`
  - `StrictLoads.bb`
  - `fullscreen_window_fix.bb`
  - `KeyName.bb`
- Utilities:
  - `Blitz_Basic_Bank.bb`
  - `Blitz_File_FileName.bb`
  - `Blitz_File_ZipApi.bb`
- Updater / network:
  - `Update.bb` (implements HTTP/FTP helpers via TCP streams)
- Gameplay systems:
  - `DevilParticleSystem.bb`
  - `AAText.bb`
  - `Achievements.bb`
  - `Difficulty.bb`
  - `dreamfilter.bb`
  - `Items.bb`
  - `Particles.bb`
  - `MapSystem.bb` (includes `DrawPortals.bb`, later `Skybox.bb`)
  - `NPCs.bb`
  - `UpdateEvents.bb`
  - `menu.bb`
  - `LoadAllSounds.bb`
  - `save.bb`

## Data + Assets Layout Expectations

SCPCB assumes a specific directory structure:

- Config:
  - `~/Software/scpcb/options.ini`
- Data/INI:
  - `~/Software/scpcb/Data/materials.ini`
  - `~/Software/scpcb/Data/NPCs.ini`
  - `~/Software/scpcb/Data/events.ini` (used by some init flows)
- Graphics:
  - `~/Software/scpcb/GFX/...` (textures, meshes, room meshes, decals, UI
    assets)
- Audio:
  - `~/Software/scpcb/SFX/...` (ambient, voices, door sounds, radio tracks,
    etc.)
  - `~/Software/scpcb/SFX/Radio/UserTracks/` (user-provided music files)

## “Non-Game” Tools Included in the Tree

These exist but are not on the core gameplay path:

- `~/Software/scpcb/Map Creator/` (map editor code)
- `~/Software/scpcb/Converter.bb`, `LightMapPNG.bb`, `RMesh_Model_Viewer.bb`
  (tools)
