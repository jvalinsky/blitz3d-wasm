# SCPCB Web Port — Track B Plans

Created: 2026-01-29

This folder contains per-workstream plans for the SCPCB web port (Track B:
WASM-first, thin JS runtime, offline asset conversion). Each plan is a checklist
with timestamps so it can be used as a working execution log.

## Plans

- `00_best_practices_web_wasm.md`
- `01_asset_pipeline.md`
- `02_runtime_abi_and_command_buffer.md`
- `03_boot_loop_and_main_refactor.md`
- `04_rendering_input_audio_parity.md`
- `05_build_deploy_ci_gates.md`
- `06_testing_and_stability.md`

## Conventions

- Use `- [ ]` for todo and `- [x]` for done.
- When completing a significant checkbox, add a short note with a date
  (YYYY-MM-DD) on the same line or directly below it.
- Prefer measurable acceptance criteria (counts, timings, “no .b3d/.x/.rmesh in
  dist”, etc.).
