---
name: scpcb-savegame-porting
description: Port SCPCB save/load behavior in `~/Software/scpcb/Save.bb` (WriteFile/ReadFile/CreateDir/ReadDir/FileType) to a browser-compatible model using Blitz3D-WASM’s web runtime/VFS. Use when SaveGame/LoadGame hangs or fails, when directory listing is unavailable, or when deciding between disabling saves vs implementing persistence (e.g., IndexedDB-backed).
---

# SCPCB Savegame Porting

## What SCPCB expects

- Writes into a save folder (CreateDir + WriteFile).
- Enumerates save slots (ReadDir + FileType checks).
- Reads `save.txt` and other files back (ReadFile).

## Decide scope early

Pick one approach:

1. **Disable saving** (fastest):
   - Keep UI stable, but make save/load paths no-op or show a message.
2. **Implement persistence** (recommended long-term):
   - Back save files with a browser storage layer (IndexedDB/local persistence) via the web runtime.
   - Ensure directory listing queries map to a virtual directory index, not a real filesystem.

## Search hotspots

- `rg -n \"SavePath|SaveGame\\(|LoadGame\\(|ReadDir\\(|CreateDir\\(|WriteFile\\(|ReadFile\\(\" ~/Software/scpcb/Save.bb -S`

## Keep failures obvious

- Avoid “silent success” writes that don’t persist.
- Prefer returning explicit failure values to SCPCB logic so UI can respond.

## Output expectations

When you respond, include:

- Which approach you recommend (disable vs implement).
- The minimal patch surface in `Save.bb` (functions to gate or redirect).
- The corresponding web-runtime hook points that must exist for persistence.

