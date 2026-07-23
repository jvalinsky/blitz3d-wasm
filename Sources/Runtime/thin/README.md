# Thin Runtime

Minimal JavaScript runtime (~500 lines) for Blitz3D-WASM.

## Philosophy

**JS only wraps browser APIs. All game logic stays in WASM.**

Instead of reimplementing Blitz3D features in JavaScript, we:

1. Compile BB code to WASM (game logic, physics, AI)
2. Provide thin JS wrappers for browser APIs (Three.js, Web Audio, DOM)

## Files

| File             | Description                        |
| ---------------- | ---------------------------------- |
| `runtime.js`     | ~500 lines of browser API bindings |
| `test.html`      | Working particle demo              |
| `particles.bb`   | Demo BB source code                |
| `particles.wasm` | Compiled demo (gitignored)         |

## What JS Implements

### 3D Graphics (Three.js)

- `CreateSprite(parent)` → THREE.Sprite
- `CreateMesh(parent)` → THREE.Mesh
- `CreateCamera(parent)` → THREE.PerspectiveCamera
- `CreateLight(type, parent)` → THREE.Light
- `PositionEntity(e, x, y, z)` → obj.position.set()
- `RotateEntity(e, pitch, yaw, roll)` → obj.rotation.set()
- `ScaleEntity(e, x, y, z)` → obj.scale.set()
- `EntityAlpha(e, alpha)` → material.opacity
- `FreeEntity(e)` → scene.remove()

### Utility

- `Print(s)` / `PrintInt(i)` / `PrintFloat(f)` → console.log
- `MilliSecs()` → performance.now()
- `Rnd(lo, hi)` → Math.random()
- `Sqr(x)` → Math.sqrt()

## What WASM Does (compiled BB)

- Type system (New, Delete, linked lists)
- Field access (obj\field)
- Physics calculations
- Game logic and state
- Control flow
- Memory management

## Usage

```html
<script
  src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"
></script>
<script src="runtime.js"></script>
<script>
  const runtime = new Blitz3DRuntime("canvas");
  const imports = runtime.getImports();

  const { instance } = await WebAssembly.instantiate(wasmBytes, imports);
  runtime.memory = instance.exports.memory;

  // Set FPSfactor for physics
  if (instance.exports.FPSfactor) {
    instance.exports.FPSfactor.value = 1.0;
  }

  // Run main
  instance.exports.Main();

  // Game loop
  function loop() {
    instance.exports.UpdateParticles();
    runtime.render();
    requestAnimationFrame(loop);
  }
  loop();
</script>
```

## Comparison to Full Runtime

|                 | Thin Runtime  | Full Runtime          |
| --------------- | ------------- | --------------------- |
| Lines           | ~500          | ~11,000               |
| Approach        | JS wraps APIs | JS reimplements logic |
| Game logic      | In WASM       | In JS                 |
| Maintainability | Easy          | Complex               |
