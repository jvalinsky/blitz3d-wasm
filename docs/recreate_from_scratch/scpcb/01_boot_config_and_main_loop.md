# Boot, Config, and the Main Loop

This describes how SCPCB starts, reads config, and ticks every frame.

## Startup Preconditions

At the top of `~/Software/scpcb/Main.bb`, the game checks for required DLLs:

- `fmod.dll`
- `zlibwapi.dll`

If missing, it calls `RuntimeError` and exits early.

## Config: `options.ini` is read extremely early

`Main.bb` defines:

- `Global OptionFile$ = "options.ini"`

and reads many settings via `GetINIInt/GetINIFloat/GetINIString`, including:

- graphics resolution/fullscreen/driver and vsync/framelimit
- mouse smoothing/sensitivity/invert
- brightness/fog parameters
- audio volumes, “user tracks” options
- input key binds (inventory/save/console/etc)

Porting implication:

- `options.ini` must be available before any init path that reads it.

## Launcher vs Game

`Main.bb` can run a launcher first (`LauncherEnabled`), then configures graphics
via `Graphics3DExt(...)` or equivalent.

Web port implication:

- The launcher is a blocking UI loop in desktop builds; for web, it’s typically
  disabled.

## Frame Timing and `FPSfactor`

In the main loop (`Repeat ... Forever` in `Main.bb`), SCPCB computes:

- `ElapsedTime` from `MilliSecs`
- `FPSfactor = clamp(ElapsedTime * 70, 0.2..5.0)`

and then **forces `FPSfactor = 0`** when certain UI/interaction modes are
active:

- menu open
- inventory open
- console open
- certain “modal” interactions (doors/screens/294, etc.)

This is a critical behavioral detail: large parts of the simulation assume that
“gameplay is paused” while menus are open, but rendering/UI still runs.

## Main Menu vs Gameplay Branch

Within the loop, SCPCB branches primarily on `MainMenuOpen`:

- If `MainMenuOpen`:
  - `UpdateMainMenu()` (from `menu.bb`)
- Else:
  - `UpdateStreamSounds()`
  - gameplay update pipeline (doors, events, NPCs, items, particles, etc.)
  - `UpdateWorld()` and rendering (`RenderWorld2()` plus post effects)

## Update Ordering (Gameplay Path)

`Main.bb` contains a well-defined update order. Commonly-hit calls include:

- camera + fog + lighting setup
- `UpdateDeafPlayer()`, `UpdateEmitters()`, `MouseLook()`, `MovePlayer()`
- per-room branches (dimension1499 / gatea / exit1 / normal):
  - `UpdateDoors()`
  - `UpdateEvents()` (when not in a “quickload” phase)
  - `UpdateScreens()`, `UpdateRoomLights(Camera)`, `TimeCheckpointMonitors()`,
    `Update294()`
- `UpdateDecals()`, `UpdateMTF()`, `UpdateNPCs()`, `UpdateItems()`,
  `UpdateParticles()`
- `UpdateWorld()` then `RenderWorld2()`
- overlays/UI: inventory, console, GUI, menus, save prompts
- final present: `Flip` with vsync toggle

Porting implication:

- For web/WASM, you’ll almost always want an explicit “single tick” function
  that runs this pipeline once, rather than calling a `Repeat ... Forever` loop.
