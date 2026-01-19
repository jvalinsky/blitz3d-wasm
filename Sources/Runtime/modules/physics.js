/**
 * Blitz3D Runtime Physics Module
 * Collision detection and physics management
 */

class Blitz3DPhysics {
    constructor(core, graphics) {
        this.core = core;
        this.graphics = graphics;
        this.collisionRules = [];
        this.collisionResults = {};
        this.picks = [];
        this.collided = false;
        this.lastPick = null;
    }

    setupImports(imports) {
        imports.env.Collisions = (srcType, destType, method, response) => {
            this.collisionRules.push({
                typeA: srcType,
                typeB: destType,
                method: method,
                response: response
            });
            console.log(`Collision: ${srcType} <-> ${destType} method=${method}`);
        };

        imports.env.ClearCollisions = () => {
            this.collisionRules = [];
            this.collisionResults = {};
        };

        imports.env.EntityType = (ent, type, recurse) => {
            const entity = this.graphics.entities[ent];
            if (entity) {
                entity.userData.collisionType = type;
                // recursive not fully implemented yet
            }
        };

        imports.env.EntityRadius = (ent, r1, r2) => {
            const entity = this.graphics.entities[ent];
            if (entity) {
                entity.userData.radius = r1;
                // r2 corresponds to height/y-radius usually for capsules
            }
        };

        imports.env.EntityPick = (entity, range) => {
            const obj = this.graphics.entities[entity];
            if (obj && this.graphics.camera) {
                const raycaster = new THREE.Raycaster();
                const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(obj.quaternion);
                raycaster.set(obj.position, dir);
                raycaster.far = range;

                const intersects = raycaster.intersectObjects(this.graphics.scene.children, true);
                if (intersects.length > 0) {
                    this.lastPick = intersects[0];
                    return 1;
                }
            }
            return 0;
        };

        imports.env.LinePick = (x, y, z, dx, dy, dz, radius) => {
            if (this.graphics.scene) {
                const origin = new THREE.Vector3(x, y, -z);
                const dir = new THREE.Vector3(dx, dy, -dz).normalize();
                const raycaster = new THREE.Raycaster(origin, dir);
                raycaster.far = new THREE.Vector3(dx, dy, -dz).length();

                const intersects = raycaster.intersectObjects(this.graphics.scene.children, true);
                if (intersects.length > 0) {
                    this.lastPick = intersects[0];
                    return intersects[0].object.id || 1;
                }
            }
            return 0;
        };

        imports.env.GetMatPickX = () => this.lastPick?.point?.x || 0;
        imports.env.GetMatPickY = () => -(this.lastPick?.point?.y || 0);
        imports.env.GetMatPickZ = () => this.lastPick?.point?.z || 0;

        imports.env.CountCollisions = (ent) => {
            const entity = this.graphics.entities[ent];
            if (!entity || !this.collisionResults) return 0;
            return (this.collisionResults[ent]?.length) || 0;
        };

        imports.env.CollisionX = (ent, idx) => {
            const collisions = this.collisionResults[ent];
            if (collisions && idx >= 0 && idx < collisions.length) {
                return collisions[idx].point?.x || 0;
            }
            return 0;
        };

        imports.env.CollisionY = (ent, idx) => {
            const collisions = this.collisionResults[ent];
            if (collisions && idx >= 0 && idx < collisions.length) {
                return -(collisions[idx].point?.y || 0);
            }
            return 0;
        };

        imports.env.CollisionZ = (ent, idx) => {
            const collisions = this.collisionResults[ent];
            if (collisions && idx >= 0 && idx < collisions.length) {
                return collisions[idx].point?.z || 0;
            }
            return 0;
        };

        imports.env.CollisionEntity = (ent, idx) => {
            const collisions = this.collisionResults[ent];
            if (collisions && idx >= 0 && idx < collisions.length) {
                const collision = collisions[idx];
                if (collision?.object) {
                    for (let id in this.graphics.entities) {
                        if (this.graphics.entities[id] === collision.object) {
                            return parseInt(id);
                        }
                    }
                }
            }
            return 0;
        };

        imports.env.CollisionNX = (ent, idx) => {
            const collisions = this.collisionResults[ent];
            if (collisions && idx >= 0 && idx < collisions.length) {
                return collisions[idx]?.face?.normal?.x || 0;
            }
            return 0;
        };

        imports.env.CollisionNY = (ent, idx) => {
            const collisions = this.collisionResults[ent];
            if (collisions && idx >= 0 && idx < collisions.length) {
                return -(collisions[idx]?.face?.normal?.y || 0);
            }
            return 0;
        };

        imports.env.CollisionNZ = (ent, idx) => {
            const collisions = this.collisionResults[ent];
            if (collisions && idx >= 0 && idx < collisions.length) {
                return collisions[idx]?.face?.normal?.z || 0;
            }
            return 0;
        };

        imports.env.CollisionSurface = (ent, idx) => {
            const collisions = this.collisionResults[ent];
            if (collisions && idx >= 0 && idx < collisions.length) {
                return 1;
            }
            return 0;
        };

        imports.env.CollisionTriangle = (ent, idx) => {
            const collisions = this.collisionResults[ent];
            if (collisions && idx >= 0 && idx < collisions.length) {
                return collisions[idx]?.faceIndex || 0;
            }
            return 0;
        };
    }

    updateCollisions() {
        // Perform collision detection based on rules
        this.collisionResults = {};

        for (const rule of this.collisionRules) {
            // Simplified collision detection
            // In a full implementation, this would check entity positions and types
        }
    }
}

window.Blitz3DPhysics = Blitz3DPhysics;
module.exports = Blitz3DPhysics;