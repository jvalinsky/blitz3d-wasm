/**
 * Blitz3D Runtime Animation Module
 * Handles skeletal animation, bone hierarchy traversal, and playback control
 */

class Blitz3DAnimation {
  constructor(graphics, core) {
    this.graphics = graphics;
    this.core = core;

    // Create B3D loader for animated meshes
    const B3DLoader = require("./b3d");
    this.b3dLoader = new B3DLoader(graphics, core);
  }

  animate(entityId, mode, speed, seq, trans) {
    const entity = this.graphics.entities[entityId];
    if (!entity) {
      console.warn(`Animate: entity ${entityId} not found`);
      return;
    }

    if (entity.userData.mixer && entity.userData.action) {
      const action = entity.userData.action;
      action.enabled = mode !== 0;
      action.setEffectiveTimeScale(speed || 1.0);

      if (mode === 1) { // Loop
        action.setLoop(THREE.LoopRepeat);
        action.play();
      } else if (mode === 2) { // PingPong
        action.setLoop(THREE.LoopPingPong);
        action.play();
      } else if (mode === 3) { // OneShot
        action.setLoop(THREE.LoopOnce);
        action.clampWhenFinished = true;
        action.play();
      } else if (mode === 0) { // Stop
        action.stop();
      }

      if (seq !== undefined && seq > 0 && entity.userData.sequences) {
        const seqInfo = entity.userData.sequences[seq - 1];
        if (seqInfo) {
          action.time = seqInfo.firstFrame /
            (action.getClip().duration * 30 || 1);
        }
      }
    } else {
      // Fallback for entities without animation mixer
      console.log(`Animate: entity ${entityId} has no animation mixer`);
    }
  }

  setAnimTime(entityId, time, seq) {
    const entity = this.graphics.entities[entityId];
    if (entity && entity.userData.mixer && entity.userData.action) {
      entity.userData.action.time = time;
      entity.userData.mixer.update(0);
    }
  }

  async loadAnimMesh(path, parentId) {
    console.log(`[Animation] Loading animated mesh: ${path}`);

    // Check file extension
    const lowerPath = path.toLowerCase();
    if (lowerPath.endsWith(".b3d")) {
      // Use B3D loader for .b3d files
      const entityId = await this.b3dLoader.loadFile(path, parentId);

      const entity = this.graphics.entities[entityId];
      if (entity) {
        console.log(
          `[Animation] B3D loaded, entity ${entityId} has ${
            entity.userData.bones?.length || 0
          } bones`,
        );
      }

      return entityId;
    } else {
      // Fallback for other formats
      return this.loadGenericAnimMesh(path, parentId);
    }
  }

  loadGenericAnimMesh(path, parentId) {
    console.log(`[Animation] Loading generic anim mesh: ${path}`);

    const root = new THREE.Group();
    const rootId = this.graphics.nextEntityId++;
    this.graphics.entities[rootId] = root;
    root.userData.entityId = rootId;
    root.userData.isAnimMesh = true;
    root.userData.bones = [];

    // Create a placeholder mesh
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({
      color: 0x888888,
      wireframe: true,
    });
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

  getAnimLength(entityId) {
    const entity = this.graphics.entities[entityId];
    if (entity && entity.userData.action) {
      return entity.userData.action.getClip().duration * 30 || 0;
    }
    return 0;
  }

  getAnimTime(entityId) {
    const entity = this.graphics.entities[entityId];
    if (entity && entity.userData.action) {
      return entity.userData.action.time * 30 || 0;
    }
    return 0;
  }

  setAnimSeq(entityId, seq) {
    const entity = this.graphics.entities[entityId];
    if (
      entity && entity.userData.sequences && seq >= 0 &&
      seq < entity.userData.sequences.length
    ) {
      const seqInfo = entity.userData.sequences[seq];
      entity.userData.currentSeq = seq;

      if (entity.userData.action && entity.userData.action.getClip()) {
        const clip = entity.userData.action.getClip();
        const fps = 30;
        const startFrame = seqInfo.firstFrame;
        const numFrames = seqInfo.numFrames;

        // This would need proper implementation for sequence ranges
        console.log(
          `[Animation] Set sequence ${seq}: ${seqInfo.name} (frames ${startFrame}-${
            startFrame + numFrames
          })`,
        );
      }
    }
  }
}

if (typeof window !== "undefined") {
  window.Blitz3DAnimation = Blitz3DAnimation;
  // Also export as an object for consistency with require()
  window.Blitz3DAnimationModule = { Blitz3DAnimation };
}

module.exports = { Blitz3DAnimation };
