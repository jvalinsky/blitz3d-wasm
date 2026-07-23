# Open Questions (For Rebuild Decisions)

Keep this list short and updated; convert answered items into the relevant docs.

## Architecture

- Should we target “WASM-owns-UI” as the default for mod-compatibility?
- Where is the right boundary for 2D/UI rendering (Blitz2D emulation):
  - pure Canvas2D,
  - WebGL overlay pass,
  - or a retained-mode UI layer?

## Imports and ABI

- How strict should import name compatibility be (case, suffixes, legacy
  aliases)?
- Do we want a formal “runtime ABI version” handshake for all import surfaces?

## Memory and Debugging

- What debug metadata format(s) do we standardize on for BB source mapping?
- Can we make stack-balancing diagnostics more explainable to contributors?

## Assets

- Which formats must be runtime-supported vs offline-only?
- How do we version converted asset packs (SMPK) across game/mod variants?
