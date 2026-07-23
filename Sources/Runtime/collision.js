/**
 * Collision Detection System
 *
 * Simple sphere/box collision for game entities.
 */

const CollisionSystem = {
  entities: new Map(),

  register(entityId, type, position, radius = 0.5) {
    this.entities.set(entityId, {
      type: type,
      position: position,
      radius: radius,
      box: {
        min: [position[0] - radius, position[1] - radius, position[2] - radius],
        max: [position[0] + radius, position[1] + radius, position[2] + radius],
      },
    });
  },

  unregister(entityId) {
    this.entities.delete(entityId);
  },

  update(entityId, position) {
    const e = this.entities.get(entityId);
    if (e) {
      e.position = position;
      const r = e.radius;
      e.box.min = [position[0] - r, position[1] - r, position[2] - r];
      e.box.max = [position[0] + r, position[1] + r, position[2] + r];
    }
  },

  EntityCollided(entityId, typeMask) {
    const entity = this.entities.get(entityId);
    if (!entity) return 0;

    for (const [otherId, other] of this.entities) {
      if (otherId === entityId) continue;

      if ((typeMask & (1 << other.type)) === 0) continue;

      if (this._sphereSphere(entity, other)) {
        return otherId;
      }
    }
    return 0;
  },

  CountCollisions(entityId) {
    const entity = this.entities.get(entityId);
    if (!entity) return 0;

    let count = 0;
    for (const [otherId, other] of this.entities) {
      if (otherId === entityId) continue;
      if (this._sphereSphere(entity, other)) {
        count++;
      }
    }
    return count;
  },

  CollisionX(entityId, index) {
    const collision = this._getNthCollision(entityId, index);
    return collision ? collision.position[0] : 0;
  },

  CollisionY(entityId, index) {
    const collision = this._getNthCollision(entityId, index);
    return collision ? collision.position[1] : 0;
  },

  CollisionZ(entityId, index) {
    const collision = this._getNthCollision(entityId, index);
    return collision ? collision.position[2] : 0;
  },

  _sphereSphere(a, b) {
    const dx = a.position[0] - b.position[0];
    const dy = a.position[1] - b.position[1];
    const dz = a.position[2] - b.position[2];
    const distSq = dx * dx + dy * dy + dz * dz;
    const radSum = a.radius + b.radius;
    return distSq < radSum * radSum;
  },

  _getNthCollision(entityId, n) {
    const entity = this.entities.get(entityId);
    if (!entity) return null;

    let count = 0;
    for (const [otherId, other] of this.entities) {
      if (otherId === entityId) continue;
      if (this._sphereSphere(entity, other)) {
        if (count === n) return other;
        count++;
      }
    }
    return null;
  },
};

window.CollisionSystem = CollisionSystem;
