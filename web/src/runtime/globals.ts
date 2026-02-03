/**
 * Global runtime knobs used by the web runtime and interpreter demos.
 *
 * These are intentionally `globalThis` flags to make it easy to toggle behavior
 * from standalone HTML demos (without having to plumb configuration through
 * every call site).
 *
 * Note: Keep these stable once shipped; demos and tooling may depend on them.
 */

declare global {
  /**
   * Optional global installed by some demos that embed the Swift/WASM engine
   * exports into the page.
   *
   * This is primarily used by the interpreter and exploration harnesses.
   */
  interface Window {
    Blitz3D?: {
      engineExports?: Record<string, unknown>;
    };
  }

  /**
   * When `true`, `LoadMesh()` is allowed to load source formats directly
   * (`.b3d`, `.x`, `.rmesh`) instead of rewriting to `.smpk`.
   *
   * This is intended for the interpreter/exploration harness; the SCPCB loader
   * should prefer `.smpk` for performance and determinism.
   */
  // deno-lint-ignore no-var
  var __BLITZ3D_ALLOW_SOURCE_MODELS: boolean | undefined;

  /**
   * Optional path resolver used by loaders to map a logical Blitz path
   * (e.g. `GFX/npcs/guard_diffuse.jpg`) to a browser URL.
   *
   * The SCPCB loader typically installs this to point at the VFS / manifest.
   */
  // deno-lint-ignore no-var
  var __BLITZ3D_URL_RESOLVER:
    | ((path: string) => string | null | undefined)
    | undefined;

  /**
   * Optional flags bag used by demos/tooling to toggle runtime behaviors.
   */
  // deno-lint-ignore no-var
  var __BLITZ3D_FLAGS: Record<string, unknown> | undefined;

  /**
   * Interpreter convenience: if enabled, the runtime may automatically position
   * the active camera to frame newly loaded source models (B3D/X/RMESH).
   */
  // deno-lint-ignore no-var
  var __BLITZ3D_INTERPRETER_AUTOFRAME: boolean | undefined;

  /**
   * Debug helper: last file path requested via the FileIO layer.
   */
  // deno-lint-ignore no-var
  var __SCPCB_LAST_FILE_REQ: string | undefined;
}

export {};
