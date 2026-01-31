import { Blitz3DGraphicsInterface } from "../types.ts";
import * as THREE from "three";

export function setupCollision(graphics: Blitz3DGraphicsInterface, imports: any) {
    // --- Collision System ---

    // Setup
    imports.env.Collisions = (srcType: number, destType: number, method: number, response: number) => {
        if (graphics.wasmManager) {
            graphics.wasmManager.bridge.collisions(srcType, destType, method, response);
            return;
        }
        (graphics as any).collisions.push({ srcType, destType, method, response });
    };

    imports.env.EntityType = (entId: number, typeId: number, recurs: number) => {
        if (graphics.wasmManager) {
            graphics.wasmManager.bridge.entityType(entId, typeId);
            // TODO: Recursion not yet handled in bridge simple call, 
            // but usually EntityType in Blitz3D is recursive by default or has a flag?
            // The WASM export EngineEntityType sets it for ID.
            return;
        }
        const ent = graphics.entities[entId];
        if (ent) {
            ent.userData.typeId = typeId;
            // simple recursive
            ent.traverse((child: any) => {
                child.userData.typeId = typeId;
            });
        }
    };

    imports.env.EntityRadius = (entId: number, radiusX: number, radiusY: number) => {
        if (graphics.wasmManager) {
            graphics.wasmManager.bridge.entityRadius(entId, radiusX, radiusY);
            return;
        }
        const ent = graphics.entities[entId];
        if (ent) ent.userData.radius = [radiusX, radiusY || radiusX];
    };

    imports.env.EntityBox = (entId: number, x: number, y: number, z: number, w: number, h: number, d: number) => {
        if (graphics.wasmManager) {
            graphics.wasmManager.bridge.entityBox(entId, x, y, z, w, h, d);
            return;
        }
        const ent = graphics.entities[entId];
        if (ent) ent.userData.box = [x, y, z, w, h, d];
    };

    imports.env.ResetEntity = (entId: number) => {
        if (graphics.wasmManager) {
            graphics.wasmManager.bridge.resetEntity(entId);
            return;
        }
    };

    imports.env.ClearCollisions = () => {

    };

    imports.env.UpdateWorld = (step: number) => {
        if (graphics.wasmManager) {
            graphics.wasmManager.updateWorld(step);
            // Also need to update animations if they were separate
        }

        // Update animations (legacy/shared)
        const now = performance.now();
        const delta = (now - graphics.lastTime) * 0.001;
        graphics.lastTime = now;

        if (graphics.animationSystem) {
            graphics.animationSystem.update(delta * step);
        }
    };

    // Query
    imports.env.EntityCollided = (entId: number, typeId: number) => {
        if (graphics.wasmManager) {
            return graphics.wasmManager.bridge.entityCollided(entId, typeId);
        }
        return 0;
    };

    imports.env.CountCollisions = (entId: number) => {
        if (graphics.wasmManager) {
            return graphics.wasmManager.bridge.countCollisions(entId);
        }
        return 0;
    };

    imports.env.CollisionX = (entId: number, index: number) => graphics.wasmManager ? graphics.wasmManager.bridge.collisionX(entId, index) : 0;
    imports.env.CollisionY = (entId: number, index: number) => graphics.wasmManager ? graphics.wasmManager.bridge.collisionY(entId, index) : 0;
    imports.env.CollisionZ = (entId: number, index: number) => graphics.wasmManager ? graphics.wasmManager.bridge.collisionZ(entId, index) : 0;
    imports.env.CollisionNX = (entId: number, index: number) => graphics.wasmManager ? graphics.wasmManager.bridge.collisionNX(entId, index) : 0;
    imports.env.CollisionNY = (entId: number, index: number) => graphics.wasmManager ? graphics.wasmManager.bridge.collisionNY(entId, index) : 0;
    imports.env.CollisionNZ = (entId: number, index: number) => graphics.wasmManager ? graphics.wasmManager.bridge.collisionNZ(entId, index) : 0;
    imports.env.CollisionEntity = (entId: number, index: number) => graphics.wasmManager ? graphics.wasmManager.bridge.collisionEntity(entId, index) : 0;

    // Stub methods
    imports.env.CollisionSurface = (entId: number, index: number) => 0;
    imports.env.CollisionTriangle = (entId: number, index: number) => 0;
    imports.env.CollisionTime = (entId: number, index: number) => 0;

    imports.env.GetEntityType = (entId: number) => {
        if (graphics.wasmManager) {
            // Not exposed in bridge yet, but usually not critical?
            return 0;
        }
        const ent = graphics.entities[entId];
        return ent ? (ent.userData.typeId || 0) : 0;
    };
}
