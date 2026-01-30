/**
 * Blitz3D Runtime Animation Module
 * Handles skeletal animation, bone hierarchy traversal, and playback control
 */

import * as THREE from 'three';
import { SMPKLoader } from "./smpk";

export class Blitz3DAnimation {
    [key: string]: any;

    constructor(graphics: any, core: any) {
        this.graphics = graphics;
        this.core = core;

        this.smpkLoader = new SMPKLoader(graphics, core);
    }

    animate(entityId: number, mode: number, speed: number, seq: number, trans: number) {
        const entity = this.graphics.entities[entityId];
        if (!entity) {
            console.warn(`Animate: entity ${entityId} not found`);
            return;
        }

        if (entity.userData.mixer && entity.userData.action) {
            const action = entity.userData.action;
            action.enabled = (mode !== 0);
            action.setEffectiveTimeScale(speed || 1.0);

            if (mode === 1) { // Loop
                action.setLoop(THREE.LoopRepeat, Infinity);
                action.play();
            } else if (mode === 2) { // PingPong
                action.setLoop(THREE.LoopPingPong, Infinity);
                action.play();
            } else if (mode === 3) { // OneShot
                action.setLoop(THREE.LoopOnce, 1);
                action.clampWhenFinished = true;
                action.play();
            } else if (mode === 0) { // Stop
                action.stop();
            }

            if (seq !== undefined && seq > 0 && entity.userData.sequences) {
                const seqInfo = entity.userData.sequences[seq - 1];
                if (seqInfo) {
                    // Start time relative to clip duration
                    // Note: action.time is in seconds
                    // seqInfo.firstFrame is in frames (usually 30fps)
                    // If clip duration is not available, default to 1
                    const duration = action.getClip().duration;
                    const startTime = seqInfo.firstFrame / 30.0;
                    if (duration > 0) {
                        action.time = startTime;
                    }
                }
            }
        } else {
            // Fallback for entities without animation mixer
            // console.log(`Animate: entity ${entityId} has no animation mixer`);
        }
    }

    setAnimTime(entityId: number, time: number, seq: number) {
        const entity = this.graphics.entities[entityId];
        if (entity && entity.userData.mixer && entity.userData.action) {
            entity.userData.action.time = time;
            entity.userData.mixer.update(0);
        }
    }

    async loadAnimMesh(path: string, parentId: number, targetId?: number) {
        console.log(`[Animation] Loading animated mesh: ${path}`);

        // Check file extension
        const lowerPath = path.toLowerCase();
        if (lowerPath.endsWith('.smpk')) {
            const entityId = await this.smpkLoader.loadFile(path, parentId, targetId);
            return entityId;
        } else if (lowerPath.endsWith('.b3d') || lowerPath.endsWith('.x')) {
            throw new Error(`[Animation] Refusing to load source mesh at runtime: ${path} (convert offline to .smpk)`);
        } else {
            // Fallback for other formats
            return this.loadGenericAnimMesh(path, parentId);
        }
    }

    loadGenericAnimMesh(path: string, parentId: number) {
        console.log(`[Animation] Loading generic anim mesh: ${path}`);

        const root = new THREE.Group();
        const rootId = this.graphics.nextEntityId++;
        this.graphics.entities[rootId] = root;
        root.userData.entityId = rootId;
        root.userData.isAnimMesh = true;
        root.userData.bones = [];

        // Create a placeholder mesh
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshBasicMaterial({ color: 0x888888, wireframe: true });
        const mesh = new THREE.Mesh(geometry, material);
        root.add(mesh);

        if (parentId) {
            const parent = this.graphics.entities[parentId];
            if (parent) parent.add(root);
        } else if (this.graphics.scene) {
            this.graphics.scene.add(root);
        }

        return rootId;
    }

    getAnimLength(entityId: number) {
        const entity = this.graphics.entities[entityId];
        if (entity && entity.userData.action) {
            return entity.userData.action.getClip().duration * 30 || 0;
        }
        return 0;
    }

    getAnimTime(entityId: number) {
        const entity = this.graphics.entities[entityId];
        if (entity && entity.userData.action) {
            return entity.userData.action.time * 30 || 0;
        }
        return 0;
    }

    setAnimSeq(entityId: number, seq: number) {
        const entity = this.graphics.entities[entityId];
        if (entity && entity.userData.sequences && seq >= 0 && seq < entity.userData.sequences.length) {
            const seqInfo = entity.userData.sequences[seq];
            entity.userData.currentSeq = seq;

            if (entity.userData.action && entity.userData.action.getClip()) {
                const clip = entity.userData.action.getClip();
                // This would need proper implementation for sequence ranges
                // console.log(`[Animation] Set sequence ${seq}: ${seqInfo.name} (frames ${seqInfo.firstFrame}-${seqInfo.firstFrame + seqInfo.numFrames})`);
            }
        }
    }
}
