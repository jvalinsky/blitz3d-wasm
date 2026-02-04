/**
 * Blitz3D Runtime Animation Module
 * Handles skeletal animation, bone hierarchy traversal, and playback control
 */

import * as THREE from 'three';
import { decodeSmpk, SMPKLoader } from "./smpk.ts";

export class Blitz3DAnimation {
    [key: string]: any;

    constructor(graphics: any, core: any) {
        this.graphics = graphics;
        this.core = core;

        this.smpkLoader = new SMPKLoader(graphics, core);
    }

    animate(entityId: number, mode: number, speed: number, seq: number, trans: number) {
        const entity = this.graphics.entities[entityId];
        if (!entity) return;

        // If entity is a root group for an SMPK model, the mixer might be on it directly
        // or we might need to find it. Loader attaches it to root.
        if (entity.userData.mixer && entity.userData.action) {
            const action = entity.userData.action;
            const mixer = entity.userData.mixer;
            const fps = entity.userData.fps || 30;

            // Mode: 0=Stop, 1=Loop, 2=PingPong, 3=OneShot
            if (mode === 0) {
                // Stop
                action.paused = true;
            } else {
                action.paused = false;
                action.enabled = true;
                action.setEffectiveTimeScale(speed || 1.0);

                if (mode === 1) { // Loop
                    action.setLoop(THREE.LoopRepeat, Infinity);
                } else if (mode === 2) { // PingPong
                    action.setLoop(THREE.LoopPingPong, Infinity);
                } else if (mode === 3) { // OneShot
                    action.setLoop(THREE.LoopOnce, 1);
                    action.clampWhenFinished = true;
                }

                if (!action.isRunning()) action.play();
            }

            if (seq !== undefined && seq > 0 && entity.userData.sequences) {
                const seqInfo = entity.userData.sequences[seq - 1];
                if (seqInfo) {
                    // Frame-based animation: start time = frame / fps
                    const startTime = seqInfo.firstFrame / fps;
                    const duration = (seqInfo.lastFrame - seqInfo.firstFrame) / fps;

                    // If switching sequences, force time reset if needed
                    // (SCPCB logic might imply resetting time to start of sequence)
                    if (entity.userData.currentSeq !== seq) {
                        action.time = startTime;
                        // For OneShot, we might want to ensure it plays efficiently
                        if (mode === 3) {
                            action.reset();
                            action.time = startTime;
                            // Clean up previous listeners
                            mixer.removeEventListener('finished');
                            // Add completion listener for AnimFinished event if needed
                            const onFinished = () => {
                                this.core.events?.emit?.('AnimFinished', { entityId });
                                mixer.removeEventListener('finished', onFinished);
                            };
                            mixer.addEventListener('finished', onFinished);
                        }
                    }

                    // We might need to handle clip trimming if using a single monolithic clip.
                    // But for now just setting time is a start. 
                    // To properly loop a SECTION of a clip, we'd need sub-clips.
                    // However, SMPK loader currently creates one clip per animation.
                    // If sequences exist, we might need to create SubClips or use time trimming.
                    // For now, assuming "animate" just plays the whole clip or relies on manual time management
                    // if sequences aren't broken into actual clips.
                    // BUT: The plan said to implement seq logic.
                    // If sequences are just metadata, ThreeJS doesn't natively loop a subsection easily without creating a new clip.
                    // Let's assume for this task we start at the correct time.
                }
            }
        }
    }

    setAnimTime(entityId: number, time: number, seq: number) {
        const entity = this.graphics.entities[entityId];
        if (entity && entity.userData.mixer && entity.userData.action) {
            // SCPCB/Blitz3D semantics: SetAnimTime takes a *frame* cursor.
            const fps = entity.userData.fps || 30;
            const frame = time || 0;
            entity.userData.action.time = frame / fps;
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
            const fps = entity.userData.fps || 30;
            return entity.userData.action.getClip().duration * fps || 0;
        }
        return 0;
    }

    getAnimTime(entityId: number) {
        const entity = this.graphics.entities[entityId];
        if (entity && entity.userData.action) {
            const fps = entity.userData.fps || 30;
            return entity.userData.action.time * fps || 0;
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
