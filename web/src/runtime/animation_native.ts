/**
 * Native Animation Module — thin bridge to Swift engine animation.
 *
 * Replaces the Three.js-based Blitz3DAnimation. All animation state is managed
 * by the Swift engine; this module just forwards calls via EngineBridge.
 */

import type { EngineBridge } from "../engine/bridge.ts";

export class NativeAnimation {
  private bridge: EngineBridge;

  constructor(bridge: EngineBridge) {
    this.bridge = bridge;
  }

  /**
   * Start/stop animation on an entity.
   * Mode: 0=stop, 1=loop, 2=pingpong, 3=oneshot
   */
  animate(
    entityId: number,
    mode: number,
    speed: number,
    _seq: number,
    _trans: number,
  ): void {
    // The Swift engine handles animation state via entity properties.
    // We set the animation mode and speed on the entity.
    // Sequence handling is done via animDataId in the engine.
    const exports = this.bridge.exports as any;
    if (typeof exports.EngineAnimate === "function") {
      exports.EngineAnimate(entityId, mode, speed, _seq, _trans);
    }
  }

  setAnimTime(entityId: number, time: number, _seq: number): void {
    const exports = this.bridge.exports as any;
    if (typeof exports.EngineSetAnimTime === "function") {
      exports.EngineSetAnimTime(entityId, time);
    }
  }

  getAnimLength(entityId: number): number {
    const exports = this.bridge.exports as any;
    if (typeof exports.EngineGetAnimLength === "function") {
      return exports.EngineGetAnimLength(entityId);
    }
    return 0;
  }

  getAnimTime(entityId: number): number {
    const exports = this.bridge.exports as any;
    if (typeof exports.EngineGetAnimTime === "function") {
      return exports.EngineGetAnimTime(entityId);
    }
    return 0;
  }
}
