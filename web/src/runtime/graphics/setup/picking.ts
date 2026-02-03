import { Blitz3DGraphicsInterface } from "../types.ts";
import * as THREE from "three";

type Imports = {
    env: Record<string, unknown>;
    [k: string]: unknown;
};

export function setupPicking(graphics: Blitz3DGraphicsInterface, imports: Imports) {
    imports.env.EntityPickMode = (ent: number, mode: number, obs: number) => {
        if (graphics.wasmManager) {
            graphics.wasmManager.setPickMode(ent, mode);
            return;
        }

        const entity = graphics.entities[ent];
        if (entity) {
            entity.userData.pickMode = mode; // 1: sphere, 2: poly, 3: box
            entity.traverse((child: any) => {
                child.userData.pickMode = mode;
            });
        }
    };

    const updatePickResult = (intersect: THREE.Intersection<THREE.Object3D> | null) => {
        if (!intersect) {
            graphics.lastPick = {
                entity: 0,
                x: 0,
                y: 0,
                z: 0,
                nx: 0,
                ny: 0,
                nz: 0,
                surface: 0,
                triangle: 0,
            };
            return 0;
        }
        // Find blitz entity ID from object or parents
        let pickedEnt = 0;
        let curr = intersect.object;
        while (curr) {
            if (curr.userData && curr.id) {
                for (let id in graphics.entities) {
                    if (
                        graphics.entities[id] === curr || graphics.entities[id] === curr.parent
                    ) {
                        pickedEnt = parseInt(id);
                        break;
                    }
                }
                if (pickedEnt) break;
            }
            curr = curr.parent;
        }

        if (graphics.lastPick) {
            graphics.lastPick.entity = pickedEnt;
            graphics.lastPick.x = intersect.point.x;
            graphics.lastPick.y = intersect.point.y;
            graphics.lastPick.z = intersect.point.z;
            if (intersect.face) {
                graphics.lastPick.nx = intersect.face.normal.x;
                graphics.lastPick.ny = intersect.face.normal.y;
                graphics.lastPick.nz = intersect.face.normal.z;
            }

            // Best-effort mapping:
            // - "triangle" is the faceIndex (triangle number) when available.
            // - "surface" is a runtime-specific id; if loaders attach one, return it.
            const faceIndex = (intersect as unknown as { faceIndex?: number }).faceIndex;
            graphics.lastPick.triangle = Number.isFinite(faceIndex) ? (faceIndex as number) : 0;
            const surfId = (intersect.object.userData?.surfaceId ??
                intersect.object.userData?.surface ??
                intersect.object.userData?.surfaceIndex);
            graphics.lastPick.surface = (typeof surfId === "number" && Number.isFinite(surfId)) ? surfId : 0;
        }
        return pickedEnt;
    };

    imports.env.CameraPick = (camId: number, x: number, y: number) => {
        if (graphics.wasmManager) {
            const hit = graphics.wasmManager.cameraPick(camId, x, y);
            if (hit) {
                graphics.lastPick = {
                    entity: hit.id,
                    x: hit.x,
                    y: hit.y,
                    z: hit.z,
                    nx: hit.nx,
                    ny: hit.ny,
                    nz: hit.nz,
                    surface: 0,
                    triangle: 0
                };
                return hit.id;
            }
            if (graphics.lastPick) graphics.lastPick.entity = 0;
            return 0;
        }

        const cam = graphics.entities[camId];
        if (!cam) return 0;
        if (!(cam instanceof THREE.Camera)) return 0;

        if (!graphics.core.canvas) return 0;

        // Convert screen x,y to normalized device coords (-1 to +1)
        const ndcX = (x / graphics.core.canvas.width) * 2 - 1;
        const ndcY = -(y / graphics.core.canvas.height) * 2 + 1;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), cam);

        const pickables: THREE.Object3D[] = [];
        if (graphics.scene) {
            graphics.scene.traverse((obj: any) => {
                if (obj.userData && obj.userData.pickMode) pickables.push(obj);
            });
        }

        const intersects = raycaster.intersectObjects(pickables, false);
        if (intersects.length > 0) {
            return updatePickResult(intersects[0]);
        }
        updatePickResult(null);
        return 0;
    };

    imports.env.EntityPick = (entId: number, range: number) => {
        // TODO: Implement EntityPick for WASM (picking from an entity's position)
        if (graphics.wasmManager) return 0;

        const ent = graphics.entities[entId];
        if (!ent) return 0;

        const origin = ent.position.clone();
        const direction = new THREE.Vector3(0, 0, 1).applyQuaternion(
            ent.quaternion,
        ).normalize();

        const raycaster = new THREE.Raycaster(
            origin,
            direction,
            0,
            range > 0 ? range : Infinity,
        );

        const pickables: THREE.Object3D[] = [];
        if (graphics.scene) {
            graphics.scene.traverse((obj: any) => {
                if (obj !== ent && obj.userData && obj.userData.pickMode) {
                    pickables.push(obj);
                }
            });
        }

        const intersects = raycaster.intersectObjects(pickables, false);
        if (intersects.length > 0) {
            return updatePickResult(intersects[0]);
        }
        updatePickResult(null);
        return 0;
    };

    imports.env.LinePick = (x: number, y: number, z: number, dx: number, dy: number, dz: number, radius: number) => {
        if (graphics.wasmManager) {
            // radius ignored for now
            const hit = graphics.wasmManager.linePick(x, y, z, dx, dy, dz);
            if (hit) {
                // Calc hit point
                // linePick returns t (distance)
                // Normalize dir
                const dir = new THREE.Vector3(dx, dy, dz).normalize();
                const hitPos = new THREE.Vector3(x, y, z).add(dir.multiplyScalar(hit.t));
                graphics.lastPick = {
                    entity: hit.id,
                    x: hitPos.x,
                    y: hitPos.y,
                    z: hitPos.z,
                    nx: hit.nx,
                    ny: hit.ny,
                    nz: hit.nz,
                    surface: 0,
                    triangle: 0
                };
                return hit.id;
            }
            if (graphics.lastPick) graphics.lastPick.entity = 0;
            return 0;
        }

        const origin = new THREE.Vector3(x, y, z);
        const direction = new THREE.Vector3(dx, dy, dz);
        const length = direction.length();
        direction.normalize();

        const raycaster = new THREE.Raycaster(origin, direction, 0, length);

        const pickables: THREE.Object3D[] = [];
        if (graphics.scene) {
            graphics.scene.traverse((obj) => {
                if (obj.userData && obj.userData.pickMode) pickables.push(obj);
            });
        }

        const intersects = raycaster.intersectObjects(pickables, false);
        if (intersects.length > 0) {
            return updatePickResult(intersects[0]);
        }
        updatePickResult(null);
        return 0;
    };

    imports.env.PickedX = () => graphics.lastPick ? graphics.lastPick.x : 0;
    imports.env.PickedY = () => graphics.lastPick ? graphics.lastPick.y : 0;
    imports.env.PickedZ = () => graphics.lastPick ? graphics.lastPick.z : 0;
    imports.env.PickedNX = () => graphics.lastPick ? graphics.lastPick.nx : 0;
    imports.env.PickedNY = () => graphics.lastPick ? graphics.lastPick.ny : 0;
    imports.env.PickedNZ = () => graphics.lastPick ? graphics.lastPick.nz : 0;
    imports.env.PickedEntity = () => graphics.lastPick ? graphics.lastPick.entity : 0;
    imports.env.PickedSurface = () => graphics.lastPick ? graphics.lastPick.surface : 0;
    imports.env.PickedTriangle = () => graphics.lastPick ? graphics.lastPick.triangle : 0;

    imports.env.PointEntity = (ent: number, target: number) => {
        const entity = graphics.entities[ent];
        const targetEntity = graphics.entities[target];
        if (entity && targetEntity) {
            entity.lookAt(targetEntity.position);
        }
    };
}
