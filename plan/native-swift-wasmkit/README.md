# Native macOS Host (Swift + WasmKit) — Plan Set

Created: 2026-02-03

Goal: run compiled BB→WASM **natively on macOS** (no browser) using **WasmKit** as the runtime, with a minimal **AppKit + MetalKit** host created via **SwiftPM** (no Xcode project required).

This is a *host/runner* plan: it does not replace Track B (`plan/scpcb-web-track-b/`) or the web runtime. It adds a native execution/debug target that:
- loads `.wasm`,
- provides the required imports (filesystem/input/audio/render submission),
- drives the update loop at ~60Hz, and
- presents output via Metal.

## Plans

- `00_overview.md` — Scope, architecture, risks, milestones.
- `01_spm_macos_metal_host.md` — SwiftPM executable app (AppKit window + MTKView) without Xcode.
- `02_wasmkit_runtime_integration.md` — WasmKit module instantiation, memory access, import plumbing.
- `03_rendering_contracts.md` — Choose and implement a render bridge (command buffer vs framebuffer upload).
- `04_input_audio_fs_bridges.md` — Input/events, audio, and filesystem/VFS strategy for native.
- `05_testing_and_packaging.md` — Tests, diagnostics, packaging, and distribution workflow.
- `06_research_notes.md` — Curated notes: Metal rendering patterns, shader tooling, physics engine options, and candidate Swift packages.

## Conventions

- Use `- [ ]` for todo and `- [x]` for done.
- When completing a significant checkbox, add a short note with a date (YYYY-MM-DD).
- Prefer measurable acceptance criteria (FPS, frame time, memory growth, import coverage counts).
