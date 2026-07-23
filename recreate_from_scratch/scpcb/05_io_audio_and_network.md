# IO, Audio, and Network Touchpoints

This doc highlights SCPCB subsystems that have special implications for a web
port.

## File IO Patterns (Everywhere)

SCPCB uses classic Blitz file APIs:

- `FileSize`, `FileType`, `OpenFile`, `ReadLine`, `Eof`, `CloseFile`
- directory scans:
  - `ReadDir`, `NextFile`, `CloseDir`
- INI helpers:
  - `GetINIInt`, `GetINIFloat`, `GetINIString`

Porting implication:

- The runtime’s VFS must emulate these calls (including EOF/seek semantics) and
  the loader must preload init-critical files (especially `options.ini`).

## StrictLoads / “Fail Fast” Asset Loading

SCPCB prefers strict wrappers like:

- `LoadTexture_Strict`
- `LoadMesh_Strict`
- `LoadAnimMesh_Strict`
- `LoadSound_Strict`

These are designed to surface missing assets early and keep behavior
deterministic.

## Audio (FMOD + streams + 3D)

Primary sources:

- `~/Software/scpcb/FMod.bb`
- `~/Software/scpcb/MusicPlayer.bb`
- `~/Software/scpcb/LoadAllSounds.bb`

Notable behaviors:

- 3D positional audio helpers (play a sound “at” an entity/camera)
- stream vs non-stream audio channels
- user tracks scanned from `SFX/Radio/UserTracks/`

Web port implication:

- web audio must handle user gesture restrictions; “audio not ready yet” must be
  a normal state.

## Network / Updater

Primary source:

- `~/Software/scpcb/Update.bb`

SCPCB contains an update-check subsystem that:

- opens TCP streams (`OpenTCPStream`)
- sends HTTP-like requests manually
- reads headers and remote file content

Web port implication:

- This should be disabled or replaced; browsers do not allow raw TCP sockets.
