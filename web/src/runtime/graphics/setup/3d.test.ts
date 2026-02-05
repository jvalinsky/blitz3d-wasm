/// <reference lib="deno.ns" />
/// <reference lib="dom" />

import * as THREE from "three";
import { setup3D } from "./3d.ts";
import type { Blitz3DGraphicsInterface } from "../types.ts";

function assert(condition: unknown, message = "assertion failed"): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals<T>(actual: T, expected: T, message = "assertEquals failed") {
  if (actual !== expected) {
    throw new Error(`${message}: expected=${String(expected)} actual=${String(actual)}`);
  }
}

function createMockGraphics(): Blitz3DGraphicsInterface {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  const entities: Record<number, THREE.Object3D> = {};
  return {
    core: {
      canvas: null,
      ctx2d: undefined,
      memory: undefined,
      readString: () => "",
      allocString: null,
      env: {},
    },
    renderer: null,
    scene,
    camera,
    animationSystem: null,
    audioSystem: null,
    wasmManager: null,
    inputManager: null,
    entities,
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

Deno.test("EntityBlend sets Three.js blending mode", () => {
  const graphics = createMockGraphics();
  const imports: any = { env: {}, blitz3d: {} };
  setup3D(graphics, imports);

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
  );
  const id = graphics.nextEntityId++;
  graphics.entities[id] = mesh;
  if (graphics.scene) graphics.scene.add(mesh);

  imports.env.EntityBlend(id, 3);
  assertEquals((mesh.material as THREE.MeshBasicMaterial).blending, THREE.AdditiveBlending, "Should be additive");

  imports.env.EntityBlend(id, 2);
  assertEquals((mesh.material as THREE.MeshBasicMaterial).blending, THREE.MultiplyBlending, "Should be multiply");

  imports.env.EntityBlend(id, 1);
  assertEquals((mesh.material as THREE.MeshBasicMaterial).blending, THREE.NormalBlending, "Should be normal");
});

Deno.test("HideEntity sets visible=false", () => {
  const graphics = createMockGraphics();
  const imports: any = { env: {}, blitz3d: {} };
  setup3D(graphics, imports);

  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  const id = graphics.nextEntityId++;
  graphics.entities[id] = mesh;

  assert(mesh.visible === true, "Should start visible");
  imports.env.HideEntity(id);
  assertEquals(mesh.visible, false, "Should be hidden");
});

Deno.test("ShowEntity sets visible=true", () => {
  const graphics = createMockGraphics();
  const imports: any = { env: {}, blitz3d: {} };
  setup3D(graphics, imports);

  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  const id = graphics.nextEntityId++;
  graphics.entities[id] = mesh;

  mesh.visible = false;
  imports.env.ShowEntity(id);
  assertEquals(mesh.visible, true, "Should be visible");
});

Deno.test("EntityVisible returns visibility", () => {
  const graphics = createMockGraphics();
  const imports: any = { env: {}, blitz3d: {} };
  setup3D(graphics, imports);

  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  const id = graphics.nextEntityId++;
  graphics.entities[id] = mesh;

  assertEquals(imports.env.EntityVisible(id), 1, "Visible entity returns 1");
  mesh.visible = false;
  assertEquals(imports.env.EntityVisible(id), 0, "Hidden entity returns 0");
});

Deno.test("FogMode 1 creates linear fog", () => {
  const graphics = createMockGraphics();
  const imports: any = { env: {}, blitz3d: {} };
  setup3D(graphics, imports);

  imports.env.FogMode(1);
  assert(graphics.scene!.fog instanceof THREE.Fog, "Should create linear Fog");
});

Deno.test("FogMode 0 disables fog", () => {
  const graphics = createMockGraphics();
  const imports: any = { env: {}, blitz3d: {} };
  setup3D(graphics, imports);

  imports.env.FogMode(1);
  assert(graphics.scene!.fog !== null, "Fog should exist");
  imports.env.FogMode(0);
  assertEquals(graphics.scene!.fog, null, "Fog should be null");
});

Deno.test("FogMode 2 creates exponential fog", () => {
  const graphics = createMockGraphics();
  const imports: any = { env: {}, blitz3d: {} };
  setup3D(graphics, imports);

  imports.env.FogMode(2);
  assert(graphics.scene!.fog instanceof THREE.FogExp2, "Should create FogExp2");
});

Deno.test("FogColor sets fog color", () => {
  const graphics = createMockGraphics();
  const imports: any = { env: {}, blitz3d: {} };
  setup3D(graphics, imports);

  imports.env.FogMode(1);
  imports.env.FogColor(255, 0, 0);
  const fog = graphics.scene!.fog as THREE.Fog;
  assertEquals(fog.color.r, 1, "Red channel should be 1");
  assertEquals(fog.color.g, 0, "Green channel should be 0");
  assertEquals(fog.color.b, 0, "Blue channel should be 0");
});

Deno.test("FogRange sets near/far", () => {
  const graphics = createMockGraphics();
  const imports: any = { env: {}, blitz3d: {} };
  setup3D(graphics, imports);

  imports.env.FogMode(1);
  imports.env.FogRange(1, 100);
  const fog = graphics.scene!.fog as THREE.Fog;
  assertEquals(fog.near, 1, "Near should be 1");
  assertEquals(fog.far, 100, "Far should be 100");
});

Deno.test("FogDensity sets FogExp2 density", () => {
  const graphics = createMockGraphics();
  const imports: any = { env: {}, blitz3d: {} };
  setup3D(graphics, imports);

  imports.env.FogMode(2);
  imports.env.FogDensity(0.05);
  const fog = graphics.scene!.fog as THREE.FogExp2;
  assertEquals(fog.density, 0.05, "Density should be 0.05");
});

Deno.test("CameraRange sets clip planes", () => {
  const graphics = createMockGraphics();
  const imports: any = { env: {}, blitz3d: {} };
  setup3D(graphics, imports);

  const cam = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  const camId = graphics.nextEntityId++;
  graphics.entities[camId] = cam;

  imports.env.CameraRange(camId, 0.5, 500);
  assertEquals(cam.near, 0.5, "Near should be 0.5");
  assertEquals(cam.far, 500, "Far should be 500");
});

Deno.test("CameraZoom updates projection", () => {
  const graphics = createMockGraphics();
  const imports: any = { env: {}, blitz3d: {} };
  setup3D(graphics, imports);

  const cam = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  const camId = graphics.nextEntityId++;
  graphics.entities[camId] = cam;

  imports.env.CameraZoom(camId, 2);
  assertEquals(cam.zoom, 2, "Zoom should be 2");
});

Deno.test("CameraViewport sets dimensions", () => {
  const graphics = createMockGraphics();
  const imports: any = { env: {}, blitz3d: {} };
  setup3D(graphics, imports);

  const cam = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  const camId = graphics.nextEntityId++;
  graphics.entities[camId] = cam;

  imports.env.CameraViewport(camId, 10, 20, 400, 300);
  assertEquals(cam.userData.viewport.x, 10, "Viewport x");
  assertEquals(cam.userData.viewport.y, 20, "Viewport y");
  assertEquals(cam.userData.viewport.w, 400, "Viewport w");
  assertEquals(cam.userData.viewport.h, 300, "Viewport h");
});

Deno.test("CameraClsColor sets clear color", () => {
  const graphics = createMockGraphics();
  const imports: any = { env: {}, blitz3d: {} };
  setup3D(graphics, imports);

  const cam = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  const camId = graphics.nextEntityId++;
  graphics.entities[camId] = cam;

  imports.env.CameraClsColor(camId, 255, 0, 0);
  assertEquals(cam.userData.clsColor.r, 255, "Red should be 255");
  assertEquals(cam.userData.clsColor.g, 0, "Green should be 0");
  assertEquals(cam.userData.clsColor.b, 0, "Blue should be 0");
});
