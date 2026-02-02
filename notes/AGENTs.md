# Notes Directory

Analysis notes for SCP: Containment Breach, the target game for this compiler.

## Files

| File | Description |
|------|-------------|
| 00_MASTER_INDEX.md | Index of all analysis notes |
| 01_codebase_structure.md | SCPCB code organization |
| 02_npc_system.md | NPC AI and behavior |
| 02_scpcb_integration.md | Integration strategy |
| 03_save_load_system.md | Save/load implementation |
| 04_compilation_gaps.md | Features needed for SCPCB |
| 04_inventory_system.md | Item and inventory code |
| 05_scp_entities.md | SCP-specific entities |
| DOCUMENTATION_REVIEW.md | Documentation assessment |

## Archived

Older debugging and analysis notes in `archive/`.

## 2026-02-02 note (reliability)

When assessing “can this run in the browser”, assume infinite loops exist in legacy BB code and require:
- Worker isolation + watchdog timeouts for executing WASM entrypoints
- End-to-end smoke tests that run real WASM outputs (see `Tests/deno_smoke/`)
