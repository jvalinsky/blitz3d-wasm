# Plan 06 — Research Notes (Metal rendering, physics engines, libs)

Created: 2026-02-03

This doc collects external references and practical options for implementing the
native macOS host described in this plan set.

## Metal rendering (macOS, Swift)

### Baseline approach (lowest moving parts)

- Use **MetalKit** `MTKView` with a `MTKViewDelegate` renderer.
- Create a single `MTLDevice` and `MTLCommandQueue`.
- In `draw(in:)`:
  - Acquire `view.currentDrawable` and `view.currentRenderPassDescriptor` late.
  - Encode commands, `present(drawable)`, `commit()`.

References:

- Apple docs: `MTKView` —
  `https://developer.apple.com/documentation/metalkit/mtkview`
- Apple docs: `MTKViewDelegate` —
  `https://developer.apple.com/documentation/metalkit/mtkviewdelegate`

### Frame pacing / watchdog considerations

- `MTKView` can drive the loop automatically; you can also control pacing via
  `preferredFramesPerSecond`.
- For freeze resistance, treat the WASM “tick” as a **budgeted** call:
  - record start time,
  - if elapsed > threshold, trigger a stop condition (in debug builds at
    minimum).

### Alternative approach (more control)

- Use `CAMetalLayer` directly.
- Pros: more explicit control over drawable acquisition and timing.
- Cons: more boilerplate than `MTKView`.

Reference:

- Apple docs: `CAMetalLayer` —
  `https://developer.apple.com/documentation/quartzcore/cametallayer`

## Shader compilation without Xcode

### Option A: Precompile `.metal` → `.metallib` via CLI

- Compile with Xcode toolchain command-line tools:
  - `xcrun metal …`
  - `xcrun metallib …`
- Ship the `.metallib` as a resource (SwiftPM resources or app bundle).

Reference:

- Apple docs: `metal` tool —
  `https://developer.apple.com/documentation/metal/metal_shading_language/compiling_shaders_and_metal_libraries`

### Option B: SwiftPM build tool plugin

Apple provides a SwiftPM plugin for Metal compilation:

- `MetalCompilerPlugin`

References:

- `apple/swift-metal-tools` — `https://github.com/apple/swift-metal-tools`
- `apple/swift-metal-tools` plugin docs (MetalCompilerPlugin) —
  `https://github.com/apple/swift-metal-tools/tree/main/Plugins/MetalCompilerPlugin`

### Option C: Runtime compilation (dev only)

- Use `device.makeLibrary(source:options:)`.
- Pros: simplest iteration for quick tests.
- Cons: slower startup; not recommended for release.

## Candidate Metal / rendering helper libraries

These are not required, but can accelerate iteration.

### `swift-metal-tools`

- Useful for: shader compilation workflow in SwiftPM.
- Best fit: if we ship `.metal` source alongside host.

Reference:

- `apple/swift-metal-tools` — `https://github.com/apple/swift-metal-tools`

### MetalCanvas / shader-driven demos

- Useful for: rapid visual debugging and shader experiments.
- Likely best for: framebuffer-upload bring-up / test harnesses.

Reference:

- `adam-fowler/metal-canvas` — `https://github.com/adam-fowler/metal-canvas`

### MetalPetal (image pipeline / post-processing)

- Useful for: image processing style pipelines and texture utilities.
- Might help with: framebuffer upload path (scaling, color conversion,
  blitting).

Reference:

- `MetalPetal/MetalPetal` — `https://github.com/MetalPetal/MetalPetal`

## Physics engines (Swift / SwiftPM friendliness)

There isn’t a single “default” 3D physics engine for Swift + Metal. Options
depend on goals:

1. **Fast bring-up / minimal integration**
2. **Production-quality 3D rigid body**
3. **2D physics**

### Option 1: Use Apple frameworks (fastest to start)

#### SceneKit physics (3D)

- SceneKit includes a physics engine (historically Bullet-backed) with
  `SCNPhysicsWorld`, bodies, shapes.
- Pros: native framework, stable, quick to integrate.
- Cons: designed for SceneKit rendering; using it as “physics-only” requires
  manual transform syncing.

Reference:

- Apple docs: `SCNPhysicsWorld` —
  `https://developer.apple.com/documentation/scenekit/scnphysicsworld`

#### SpriteKit physics (2D)

- Pros: extremely quick 2D physics bring-up.
- Cons: not a 3D solution; not Metal-first (though can coexist).

Reference:

- Apple docs: SpriteKit Physics —
  `https://developer.apple.com/documentation/spritekit/physics_simulation`

### Option 2: Bullet (3D, common open-source choice)

#### PhysicsKit (Bullet wrapper)

- Provides: 3D rigid body physics with a Swift API.
- Integration note: ships as an XCFramework; evaluate whether it fits the “no
  Xcode project” workflow (SwiftPM can still consume binary targets).

References:

- `brailor/PhysicsKit` — `https://github.com/brailor/PhysicsKit`

### Option 3: Box2D (2D)

#### AdaEngine / box2d-swift

- AdaEngine includes a Box2D-based 2D physics module and other systems.
- Note: `box2d-swift` currently lacks an explicit license in the repo (treat as
  “investigate before use”).

References:

- `AdaEngine/AdaEngine` — `https://github.com/AdaEngine/AdaEngine`
- `AdaEngine/box2d-swift` — `https://github.com/AdaEngine/box2d-swift`

### Option 4: Jolt Physics (3D, modern C++ engine)

- Jolt is attractive for performance and modern design, but Swift bindings are
  not commonly “off the shelf”.
- If we pursue it, likely via:
  - C wrapper + Swift module map, or
  - Swift/C++ interop (Swift 5.9+/6), with careful ABI boundaries.

Reference:

- Jolt Physics — `https://github.com/jrouwe/JoltPhysics`

## Recommendation (phased)

### Phase 1 (native host bring-up)

- Rendering: `MTKView` + minimal pipeline.
- WASM execution: WasmKit with a strict import failure mode.
- Physics: **none** or minimal custom primitives (AABB/sphere tests) until the
  render bridge is stable.

### Phase 2 (choose physics path)

- If 3D rigid body matters soon: evaluate **Bullet via PhysicsKit**.
- If we just need fast “game-ish” movement/collisions: implement custom
  collision queries first, then swap later.
- Keep the physics API behind a small adapter so we can switch engines without
  rewriting WASM contracts.

## “Physics + WASM” ABI notes

- Avoid passing complex physics objects through the WASM boundary.
- Prefer integer handles and a host-side registry.
- If the physics engine is host-side:
  - WASM requests operations (create body, set transform, raycast),
  - host returns results (hit ID, distance, normal) via shared memory structs.

## Action items to fold into the plans

- [ ] Decide shader compilation workflow for the native host (CLI vs
      `MetalCompilerPlugin`).
- [ ] Decide render bridge (framebuffer upload vs command buffer) for v1.
- [ ] Decide physics strategy for v1 and v2 (custom vs SceneKit vs Bullet/Jolt).
