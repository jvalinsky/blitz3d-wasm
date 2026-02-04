# SCPCB Implications for a Web/WASM Port

This file connects SCPCB’s implementation shape to the architecture required by
Blitz3D-WASM.

## 1) The main loop is a blocking `Repeat ... Forever`

In `~/Software/scpcb/Main.bb`, the game runs a tight infinite loop on the main
thread in desktop builds.

Web port rule:
- Never call this directly as a WASM export on the UI thread.

What you need instead:
- a **single-tick** export that runs one iteration of the gameplay/menu pipeline,
  called by JS (preferably from a Worker).

## 2) Some event logic uses tight loops

`~/Software/scpcb/UpdateEvents.bb` is content-heavy and some cases contain loops
that would be dangerous if executed without yields/timeouts.

Web port rule:
- All long-running work must be step-able, or guarded by timeouts/watchdogs.

## 3) `options.ini` and INI reads happen early and often

SCPCB reads options and INI files very early (startup) and continuously.

Web port rule:
- Preload `options.ini` and any “init critical” INI before starting init steps.

## 4) Desktop platform dependencies exist (DLLs, TCP streams)

SCPCB assumes:
- DLL presence for audio/zip/etc (desktop)
- raw TCP streams for updater/networking

Web port rule:
- disable or stub these paths, or reimplement them using browser-safe APIs.

## 5) Path quirks matter

SCPCB uses Windows-style backslashes heavily and assumes case-insensitive paths.

Web port rule:
- path aliasing + normalization is a first-class subsystem.

## 6) Update ordering is part of game behavior

The main loop update ordering (doors → events → NPCs → items → particles → world/render)
is not incidental; changing it can change gameplay.

Web port rule:
- preserve the ordering inside the “tick” function, even if other refactors happen later.

