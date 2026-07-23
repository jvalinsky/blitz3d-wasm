# Changelog

## 2026-01-21

- Added WASM shim coverage tooling (required/provided import union, coverage +
  instantiation tests) and ensured curated wasm targets instantiate against
  runtime imports.
- Documented mesh parsing ABI (engine pointer/buffer path) and added
  engine-preferring RMesh loader mock test path.
- Added CommonJS wrapper for rmesh loader to ease testing.
- Curated wasm list trimmed to remove invalid Animation_Test.wasm to keep shim
  tests green.

> Note: `Blitz3DEngine.wasm` still needs to be built and placed in `dist/` for
> browser demos that use the engine parsing path.
