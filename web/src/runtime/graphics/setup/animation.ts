import type { Blitz3DGraphicsInterface } from "../types.ts";

const ensureAnimState = (entity: any) => {
  if (!entity.userData) entity.userData = {};
  if (typeof entity.userData.__b3d_animFrame !== "number") entity.userData.__b3d_animFrame = 0;
  if (typeof entity.userData.__b3d_animPlaying !== "number") entity.userData.__b3d_animPlaying = 0;
  if (typeof entity.userData.__b3d_animSeq !== "number") entity.userData.__b3d_animSeq = 0;
};

export function setupAnimation(graphics: Blitz3DGraphicsInterface, imports: any) {
  if (!imports.env) imports.env = {};
  if (!imports.blitz3d) imports.blitz3d = {};

  // SCPCB uses LoadAnimMesh heavily for NPC models; Track B loads SMPK.
  if (!imports.env.LoadAnimMesh) {
    imports.env.LoadAnimMesh = (pathPtr: number, parent: number) => {
      if (typeof imports.env.LoadMesh === "function") return imports.env.LoadMesh(pathPtr, parent);
      return 0;
    };
  }
  if (!imports.env.LoadAnimMesh_Strict) {
    imports.env.LoadAnimMesh_Strict = (pathPtr: number, parent: number) => {
      if (typeof imports.env.LoadMesh_Strict === "function") return imports.env.LoadMesh_Strict(pathPtr, parent);
      if (typeof imports.env.LoadAnimMesh === "function") return imports.env.LoadAnimMesh(pathPtr, parent);
      return 0;
    };
  }

  if (!imports.env.Animate) {
    imports.env.Animate = (ent: number, mode: number, speed: number, seq: number, trans: number) => {
      const entity: any = graphics.entities?.[ent | 0];
      if (entity) {
        ensureAnimState(entity);
        entity.userData.__b3d_animPlaying = mode !== 0 ? 1 : 0;
        entity.userData.__b3d_animSeq = seq | 0;
      }

      const anim: any = graphics.animationSystem;
      if (anim && typeof anim.animate === "function") anim.animate(ent | 0, mode, speed, seq, trans);
    };
  }

  if (!imports.env.SetAnimTime) {
    // Blitz3D/SCPCB semantics: `time` is in *frames*, not seconds.
    imports.env.SetAnimTime = (ent: number, time: number, seq: number) => {
      const entity: any = graphics.entities?.[ent | 0];
      if (entity) {
        ensureAnimState(entity);
        entity.userData.__b3d_animFrame = time;
        entity.userData.__b3d_animSeq = seq | 0;
      }

      const anim: any = graphics.animationSystem;
      if (anim && typeof anim.setAnimTime === "function") anim.setAnimTime(ent | 0, time, seq | 0);
    };
  }

  if (!imports.env.AnimTime) {
    imports.env.AnimTime = (ent: number) => {
      const anim: any = graphics.animationSystem;
      if (anim && typeof anim.getAnimTime === "function") return anim.getAnimTime(ent | 0);

      const entity: any = graphics.entities?.[ent | 0];
      if (entity) {
        ensureAnimState(entity);
        return entity.userData.__b3d_animFrame || 0;
      }
      return 0;
    };
  }

  if (!imports.env.AnimLength) {
    imports.env.AnimLength = (ent: number) => {
      const anim: any = graphics.animationSystem;
      if (anim && typeof anim.getAnimLength === "function") return anim.getAnimLength(ent | 0);
      return 0;
    };
  }

  if (!imports.env.Animating) {
    imports.env.Animating = (ent: number) => {
      const entity: any = graphics.entities?.[ent | 0];
      if (!entity) return 0;
      ensureAnimState(entity);
      return entity.userData.__b3d_animPlaying ? 1 : 0;
    };
  }

  if (!imports.env.AnimSeq) {
    imports.env.AnimSeq = (ent: number) => {
      const entity: any = graphics.entities?.[ent | 0];
      if (!entity) return 0;
      ensureAnimState(entity);
      return entity.userData.__b3d_animSeq | 0;
    };
  }

  // Rarely used by SCPCB, but provide stubs so non-SCPCB programs don't instantly fail.
  if (!imports.env.ExtractAnimSeq) imports.env.ExtractAnimSeq = (_ent: number, _first: number, _last: number) => 0;
  if (!imports.env.AddAnimSeq) imports.env.AddAnimSeq = (_ent: number, _len: number) => 0;

  // Mirror into `blitz3d` namespace for builds that import from there.
  const mirror = [
    "LoadAnimMesh",
    "LoadAnimMesh_Strict",
    "Animate",
    "SetAnimTime",
    "AnimTime",
    "AnimLength",
    "Animating",
    "AnimSeq",
    "ExtractAnimSeq",
    "AddAnimSeq",
  ] as const;
  for (const k of mirror) {
    if (!imports.blitz3d[k] && imports.env[k]) imports.blitz3d[k] = imports.env[k];
  }
}

