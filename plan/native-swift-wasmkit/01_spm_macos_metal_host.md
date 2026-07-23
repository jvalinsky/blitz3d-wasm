# Plan 01 — SwiftPM macOS Metal Host (No Xcode)

Created: 2026-02-03

## Objective

Create a standalone SwiftPM executable that:

- creates an AppKit window,
- embeds a `MTKView`,
- drives a draw loop (`MTKViewDelegate`),
- does not require Xcode project files, storyboards, or nibs.

This plan is based on the “MetalHost” structure:

```
MetalHost/
├── Package.swift
└── Sources/
    └── main.swift
```

## Tasks

- [ ] Create `Examples/` or `Tools/`-adjacent native host package folder
      (location decision).
- [ ] Add `Package.swift` with an executable target and linker settings:
  - `AppKit`
  - `Metal`
  - `MetalKit`
  - `QuartzCore`
- [ ] Implement `Sources/main.swift`:
  - AppDelegate creates `NSWindow`
  - creates `MTKView`, sets `device`
  - sets `MTKViewDelegate` renderer
  - activates app (`NSApp.activate(ignoringOtherApps: true)`)
- [ ] Add minimal renderer that clears to a known color each frame.
- [ ] Define a predictable frame timing source (`CADisplayLink` is iOS; on macOS
      use MTKView callback timing + `CACurrentMediaTime()` or
      `mach_continuous_time` if needed).

## Acceptance criteria

- `swift build` succeeds on macOS.
- `swift run` opens a resizable window and continuously clears to a chosen
  color.
- Window closes and app terminates cleanly.

## Notes

- Keep all app setup programmatic (no storyboard).
- Treat this as an embeddable “host shell” that will later call into WasmKit
  from the render loop.
