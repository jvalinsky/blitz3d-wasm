/**
 * Blitz3D Room Loader
 * Loads and manages SCPCB rooms using RMesh parser
 */

const RMeshParser = require("./rmesh");

class Blitz3DRoom {
  constructor(graphics, core) {
    this.graphics = graphics;
    this.core = core;
    this.fileIO = core.fileIO;
    this.assetManager = core.assetManager;

    // Create RMesh parser
    this.rmeshParser = new RMeshParser(
      graphics,
      this.fileIO,
      this.assetManager,
    );

    // Room management
    this.loadedRooms = new Map();
    this.currentRoom = null;
    this.nextRoomId = 1;

    // Room entities
    this.opaqueGroup = null;
    this.alphaGroup = null;
    this.collisionMeshes = [];
    this.triggerBoxes = [];
    this.entityObjects = [];
  }

  /**
   * Load a room from RMesh file
   * @param {string} filePath - Path to RMesh file
   * @returns {number} Room entity ID
   */
  async loadRoom(filePath) {
    const roomId = this.nextRoomId++;
    this.log(`Loading room: ${filePath} (ID: ${roomId})`);

    try {
      // Parse RMesh file
      const roomData = await this.rmeshParser.parseFile(filePath);

      // Create Three.js objects
      const roomObjects = await this.rmeshParser.createThreeJSObjects(roomData);

      // Store room data
      const room = {
        id: roomId,
        path: filePath,
        data: roomData,
        objects: roomObjects,
        loadedAt: Date.now(),
      };

      this.loadedRooms.set(roomId, room);

      // Create room entity in graphics system
      const entityId = this.createRoomEntity(room);

      this.log(`Room loaded successfully (Entity: ${entityId})`);
      return entityId;
    } catch (error) {
      console.error(`Failed to load room: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create room entity in graphics system
   */
  createRoomEntity(room) {
    const entityId = this.graphics.nextEntityId++;

    // Create parent entity
    const parentEntity = {
      id: entityId,
      type: "room",
      parent: 0,
      children: [],
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      visible: true,
      roomData: room,
    };

    this.graphics.entities[entityId] = parentEntity;

    // Add to scene
    if (this.graphics.scene) {
      this.graphics.scene.add(room.objects.opaqueGroup);
      this.graphics.scene.add(room.objects.alphaGroup);
    }

    // Store references
    this.opaqueGroup = room.objects.opaqueGroup;
    this.alphaGroup = room.objects.alphaGroup;
    this.collisionMeshes = room.objects.collisionMeshes;
    this.triggerBoxes = room.objects.triggerBoxes;
    this.entityObjects = room.objects.entityObjects;

    // Add entity objects to scene
    for (const entity of this.entityObjects) {
      if (this.graphics.scene) {
        this.graphics.scene.add(entity);
      }
    }

    // Add collision meshes (hidden)
    for (const mesh of this.collisionMeshes) {
      if (this.graphics.scene) {
        mesh.visible = false;
        this.graphics.scene.add(mesh);
      }
    }

    return entityId;
  }

  /**
   * Unload a room
   */
  unloadRoom(roomId) {
    const room = this.loadedRooms.get(roomId);
    if (!room) {
      console.warn(`Room ${roomId} not found`);
      return false;
    }

    // Remove from scene
    if (this.graphics.scene) {
      this.graphics.scene.remove(room.objects.opaqueGroup);
      this.graphics.scene.remove(room.objects.alphaGroup);

      for (const entity of this.entityObjects) {
        this.graphics.scene.remove(entity);
      }

      for (const mesh of this.collisionMeshes) {
        this.graphics.scene.remove(mesh);
      }
    }

    // Dispose geometries and materials
    this.disposeRoomObjects(room.objects);

    // Remove from map
    this.loadedRooms.delete(roomId);

    this.log(`Room ${roomId} unloaded`);
    return true;
  }

  /**
   * Dispose room objects to free memory
   */
  disposeRoomObjects(objects) {
    // Dispose opaque group
    objects.opaqueGroup.traverse((child) => {
      if (child.isMesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });

    // Dispose alpha group
    objects.alphaGroup.traverse((child) => {
      if (child.isMesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });

    // Dispose collision meshes
    for (const mesh of objects.collisionMeshes) {
      if (mesh.isMesh) {
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
    }
  }

  /**
   * Get room by entity ID
   */
  getRoomByEntityId(entityId) {
    for (const [roomId, room] of this.loadedRooms) {
      if (room.objects.entityId === entityId) {
        return room;
      }
    }
    return null;
  }

  /**
   * Toggle collision mesh visibility (for debugging)
   */
  toggleCollisionMeshes(visible) {
    for (const mesh of this.collisionMeshes) {
      mesh.visible = visible;
    }
  }

  /**
   * Toggle trigger box visibility
   */
  toggleTriggerBoxes(visible) {
    for (const box of this.triggerBoxes) {
      box.visible = visible;
    }
  }

  /**
   * Find entity by type
   */
  findEntitiesByType(type) {
    return this.entityObjects.filter((entity) =>
      entity.userData.entityData?.type === type
    );
  }

  /**
   * Find nearest entity of type
   */
  findNearestEntity(position, type) {
    const entities = this.findEntitiesByType(type);
    if (entities.length === 0) return null;

    let nearest = null;
    let minDist = Infinity;

    for (const entity of entities) {
      const dist = position.distanceTo(entity.position);
      if (dist < minDist) {
        minDist = dist;
        nearest = entity;
      }
    }

    return nearest;
  }

  /**
   * Get all light sources in room
   */
  getLights() {
    return this.findEntitiesByType("light").map((entity) => ({
      object: entity,
      position: entity.position.clone(),
      data: entity.userData.entityData?.data,
    }));
  }

  /**
   * Get all sound emitters in room
   */
  getSoundEmitters() {
    return this.findEntitiesByType("soundemitter").map((entity) => ({
      object: entity,
      position: entity.position.clone(),
      data: entity.userData.entityData?.data,
    }));
  }

  /**
   * Get waypoint graph for navigation
   */
  getWaypointGraph() {
    const waypoints = this.findEntitiesByType("waypoint");
    const graph = new Map();

    for (const waypoint of waypoints) {
      const id = waypoint.userData.entityData?.data?.nextWaypoint ||
        waypoint.uuid;
      graph.set(id, {
        object: waypoint,
        position: waypoint.position.clone(),
        connections: [],
      });
    }

    return graph;
  }

  /**
   * Set up WASM imports for room functions
   */
  setupImports(imports) {
    const self = this;

    imports.env.LoadRoom = (pathPtr) => {
      const path = this.core.readString(pathPtr);
      console.log(`[Room] LoadRoom: ${path}`);

      // Load room asynchronously
      self.loadRoom(path).then((entityId) => {
        console.log(`[Room] Room loaded with entity: ${entityId}`);
      }).catch((error) => {
        console.error(`[Room] Failed to load room: ${error.message}`);
      });

      // Return 0 for async loading (entity ID returned via callback)
      return 0;
    };

    imports.env.UnloadRoom = (entityId) => {
      console.log(`[Room] UnloadRoom: ${entityId}`);
      return self.unloadRoom(entityId) ? 1 : 0;
    };

    imports.env.GetRoomEntityCount = (roomId) => {
      const room = self.loadedRooms.get(roomId);
      return room ? room.objects.entityObjects.length : 0;
    };

    imports.env.GetRoomLightCount = (roomId) => {
      const room = self.loadedRooms.get(roomId);
      return room ? self.getLights().length : 0;
    };

    imports.env.ToggleCollisionMeshes = (visible) => {
      self.toggleCollisionMeshes(visible === 1);
    };

    imports.env.ToggleTriggerBoxes = (visible) => {
      self.toggleTriggerBoxes(visible === 1);
    };
  }

  /**
   * Debug logging
   */
  log(message) {
    console.log(`[Room] ${message}`);
  }
}

module.exports = Blitz3DRoom;
