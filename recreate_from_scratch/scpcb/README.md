# SCPCB (Game) Design + Implementation Notes (Code-First)

These docs are based on the **actual SCPCB source** in `~/Software/scpcb` and
are written to support rebuilding/porting efforts (especially BB→WASM).

## License Note

`~/Software/scpcb/Main.bb` states the game source is licensed under **CC BY‑SA
3.0** and credits contributors in `~/Software/scpcb/Credits.txt`.

## Scope

- This is not an exhaustive rewrite of all SCPCB code.
- It is a **system-level map** of how the game is structured and where key logic
  lives, with pointers to the real `.bb` files.

## Index

- `00_file_map.md` — Core files, include chain, and data/layout expectations.
- `01_boot_config_and_main_loop.md` — Options.ini, launcher, frame timing, main
  loop structure.
- `02_world_rooms_and_map_system.md` — MapSystem: rooms, world loading,
  waypoints, cameras, hiding.
- `03_entities_doors_items_npcs.md` — Core game entities and how they’re
  represented.
- `04_events_system.md` — Event binding and `UpdateEvents()` dispatch model.
- `05_io_audio_and_network.md` — File IO patterns, StrictLoads, audio/mixer,
  updater networking.
- `06_web_port_implications.md` — What SCPCB implies for a web/WASM execution
  model.
