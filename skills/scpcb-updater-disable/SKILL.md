---
name: scpcb-updater-disable
description: Disable or safely stub SCPCB’s self-updater and networked “remote file engine” in `~/Software/scpcb/Update.bb`. Use when porting to the browser (no raw TCP streams), when update checks cause hangs, or when you want to keep the rest of SCPCB running without updater side effects.
---

# SCPCB Updater Disable

## Why this is needed

`Update.bb` uses `OpenTCPStream` and implements HTTP/FTP parsing + local writes. This does not translate cleanly to the browser/web worker environment.

## Find entrypoints

- `rg -n \"UpdateCheckEnabled|OpenRemoteFile\\(|OpenTCPStream\\(\" ~/Software/scpcb/Update.bb -S`
- Also check how it’s included/used from `Main.bb`:
  - `rg -n \"Include \\\"Update\\.bb\\\"\" ~/Software/scpcb/Main.bb -S`

## Safe strategies

Choose one:

1. **Hard disable**: make update checks always false and skip updater UI loops.
2. **Feature-gate**: wrap updater code behind a single global (e.g. `WEB_PORT_DISABLE_UPDATER`) so it’s easy to re-enable on native builds.
3. **Host-provided updates**: remove in-game updater and rely on the web app deploy pipeline.

## Output expectations

When you respond, include:

- The smallest change to prevent updater code from running.
- The risk (e.g., if Update.bb provides other unrelated helpers that must stay).
- The exact SCPCB compile/run command to confirm no regressions.

