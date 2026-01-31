import { Blitz3DGraphics } from "../index";
import * as THREE from "three";

export function setupPicking(this: Blitz3DGraphics, imports: any) {
    imports.env.EntityPickMode = (ent: number, mode: number, obs: number) => {
        const entity = this.entities[ent];
        if (entity) {
            entity.userData.pickMode = mode; // 1: sphere, 2: poly, 3: box
            entity.traverse((child) => {
                child.userData.pickMode = mode;
            });
        }
    };

    const updatePickResult = (intersect: any) => {
        if (!intersect) {
            this.lastPick = {
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
                for (let id in this.entities) {
                    if (
                        this.entities[id] === curr || this.entities[id] === curr.parent
                    ) {
                        pickedEnt = parseInt(id);
                        break;
                    }
                }
                if (pickedEnt) break;
            }
            curr = curr.parent;
        }

        this.lastPick.entity = pickedEnt;
        this.lastPick.x = intersect.point.x;
        this.lastPick.y = intersect.point.y;
        this.lastPick.z = intersect.point.z;
        if (intersect.face) {
            this.lastPick.nx = intersect.face.normal.x;
            this.lastPick.ny = intersect.face.normal.y;
            this.lastPick.nz = intersect.face.normal.z;
        }
        return pickedEnt;
    };

    imports.env.CameraPick = (camId: number, x: number, y: number) => {
        const cam = this.entities[camId];
        if (!cam) return 0;
        if (!(cam instanceof THREE.Camera)) return 0;

        if (!this.core.canvas) return 0;

        // Convert screen x,y to normalized device coords (-1 to +1)
        const ndcX = (x / this.core.canvas.width) * 2 - 1;
        const ndcY = -(y / this.core.canvas.height) * 2 + 1;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), cam);

        const pickables: THREE.Object3D[] = [];
        if (this.scene) {
            this.scene.traverse((obj) => {
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
        const ent = this.entities[entId];
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
        if (this.scene) {
            this.scene.traverse((obj) => {
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
        const origin = new THREE.Vector3(x, y, z);
        const direction = new THREE.Vector3(dx, dy, dz);
        const length = direction.length();
        direction.normalize();

        const raycaster = new THREE.Raycaster(origin, direction, 0, length);

        const pickables: THREE.Object3D[] = [];
        if (this.scene) {
            this.scene.traverse((obj) => {
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

    imports.env.PickedX = () => this.lastPick.x;
    imports.env.PickedY = () => this.lastPick.y;
    imports.env.PickedZ = () => this.lastPick.z;
    imports.env.PickedNX = () => this.lastPick.nx;
    imports.env.PickedNY = () => this.lastPick.ny;
    imports.env.PickedNZ = () => this.lastPick.nz;
    imports.env.PickedEntity = () => this.lastPick.entity;
    imports.env.PickedSurface = () => 0; // Stub
    imports.env.PickedTriangle = () => 0; // Stub

    imports.env.PointEntity = (ent: number, target: number) => {
        const entity = this.entities[ent];
        const targetEntity = this.entities[target];
        if (entity && targetEntity) {
            entity.lookAt(targetEntity.position);
        }
    };
}
