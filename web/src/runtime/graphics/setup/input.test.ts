/// <reference lib="deno.ns" />
/// <reference lib="dom" />

import { setupInput } from "./input.ts";
import type { Blitz3DGraphicsInterface } from "../types.ts";

function assertEquals<T>(actual: T, expected: T, message = "assertEquals failed") {
  if (actual !== expected) {
    throw new Error(`${message}: expected=${String(expected)} actual=${String(actual)}`);
  }
}

function createMockGraphics(): Blitz3DGraphicsInterface {
  const canvas = {
    style: { cursor: "default" },
    width: 800,
    height: 600,
  } as unknown as HTMLCanvasElement;

  return {
    core: {
      canvas,
      ctx2d: undefined,
      memory: undefined,
      readString: () => "",
      allocString: null,
      env: {},
    },
    renderer: null,
    scene: null,
    camera: null,
    animationSystem: null,
    audioSystem: null,
    wasmManager: null,
    inputManager: {
      installInputListeners: () => {},
      keysDown: {},
      keysHit: {},
      keyQueue: [],
      mouseDown: {},
      mouseHit: {},
      mouseX: 0,
      mouseY: 0,
      mouseZ: 0,
      mouseXSpeed: 0,
      mouseYSpeed: 0,
      mouseZSpeed: 0,
    },
    entities: {},
    textures: {},
    images: {},
    brushes: {},
    surfaces: {},
    nextImageId: 1,
    nextTextureId: 1,
    nextEntityId: 100,
    lastTime: 0,
    lastPick: null,
    clearColor: [0, 0, 0, 1],
    currentColor: [255, 255, 255, 255],
    currentBuffer: 0,
    currentFont: "Arial",
    currentFontSize: 12,
    _engine: null,
    _engineIds: new Map(),
    smpkLoader: null,
    init3D: () => {},
    disposeObject3D: () => {},
    ensureUniqueMaterial: () => {},
    engineCreate: () => 0,
    eid: (id: number) => id,
    engineCall: () => {},
  } as unknown as Blitz3DGraphicsInterface;
}

Deno.test("HidePointer sets cursor none", () => {
  const graphics = createMockGraphics();
  const imports: any = { env: {}, blitz3d: {} };
  setupInput(graphics, imports);

  imports.env.HidePointer();
  assertEquals(
    (graphics.core.canvas as HTMLCanvasElement).style.cursor,
    "none",
    "Cursor should be none",
  );
});

Deno.test("ShowPointer sets cursor default", () => {
  const graphics = createMockGraphics();
  const imports: any = { env: {}, blitz3d: {} };
  setupInput(graphics, imports);

  // First hide, then show
  imports.env.HidePointer();
  imports.env.ShowPointer();
  assertEquals(
    (graphics.core.canvas as HTMLCanvasElement).style.cursor,
    "default",
    "Cursor should be default",
  );
});
