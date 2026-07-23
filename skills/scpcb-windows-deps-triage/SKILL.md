---
name: scpcb-windows-deps-triage
description: Triage and remove/feature-gate SCPCB Windows-only dependencies in `~/Software/scpcb` (DLL/decls, user32/kernel32/gdi32, FreeImage, FMOD DLL assumptions, fullscreen window hacks, Map Creator window embedding). Use when SCPCB code relies on `.decls`/`.dll` or Win32 window manipulation and you need a web-safe plan.
---

# SCPCB Windows Dependencies Triage

## What to look for (fast scans)

- DLL/decls references:
  - `rg -n \"\\.decls\\b|\\.dll\\b|\\.lib\\b\" ~/Software/scpcb -S`
- Common Win32 libs:
  - `rg -n \"user32|kernel32|gdi32\" ~/Software/scpcb -S`
- Map Creator window embedding / SetParent:
  - `rg -n \"FindWindow\\(|SetParent\\(|SetWindowPos\\(|GetActiveWindow\\(\" ~/Software/scpcb -S --glob '*.bb'`

## Typical decisions

- **Map Creator** (`Map Creator/*`): do not port initially; exclude from web
  build path.
- **fullscreen/window style hacks** (`fullscreen_window_fix.bb`):
  disable/replace with web-canvas sizing logic.
- **Native image libs** (`FreeImage.decls` / `FreeImage.dll`): avoid relying on
  them; prefer browser image decode + runtime texture upload.
- **FMOD DLL assumptions**: replace with web runtime audio; avoid failing the
  whole boot due to missing dll files.

## Output expectations

When you respond, include:

- The exact dependency you found (file + symbol or `.decls` reference).
- Whether you recommend: remove, feature-gate, or replace.
- The smallest SCPCB-side change that unblocks compilation (and the follow-up
  gate to run).
