/**
 * Blitz3D Runtime Physics Module
 * Collision detection and physics management
 * Supports both JS fallback and Swift WASM collision engine
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
        
        // WASM collision support
        this.wasmColliderMap = new Map();
        this.useWasmCollision = false;
        this.wasmEngineReady = false;
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
                if (this.useWasmCollision && this.wasmEngineReady) {
                    const radius = entity.userData.radius || 0.5;
                    const height = entity.userData.height || 2.0;
                    let colliderId = entity.userData.colliderId;
                    if (!colliderId) {
                        colliderId = this.createWasmCollider(radius, height);
                        entity.userData.colliderId = colliderId;
                    }
                    this.wasmColliderMap.set(ent, colliderId);
                }
            }
        };

        imports.env.EntityRadius = (ent, r1, r2) => {
            const entity = this.graphics.entities[ent];
            if (entity) {
                entity.userData.radius = r1;
                entity.userData.height = r2 || r1 * 2;
                if (this.useWasmCollision && this.wasmEngineReady && entity.userData.colliderId) {
                    this.freeWasmCollider(entity.userData.colliderId);
                    entity.userData.colliderId = this.createWasmCollider(r1, entity.userData.height);
                    this.wasmColliderMap.set(ent, entity.userData.colliderId);
                }
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
        
        // WASM Collision Functions
        imports.env.CreateCollider = (radius, height) => {
            return this.createWasmCollider(radius, height);
        };
        
        imports.env.FreeCollider = (id) => {
            this.freeWasmCollider(id);
        };
        
        imports.env.SetColliderPosition = (id, x, y, z) => {
            if (this.core.engineExports && this.core.engineExports.SetColliderPosition) {
                this.core.engineExports.SetColliderPosition(id, x, y, z);
            }
        };
        
        imports.env.GetColliderPositionX = (id) => {
            if (this.core.engineExports && this.core.engineExports.GetColliderPositionX) {
                return this.core.engineExports.GetColliderPositionX(id);
            }
            return 0;
        };
        
        imports.env.GetColliderPositionY = (id) => {
            if (this.core.engineExports && this.core.engineExports.GetColliderPositionY) {
                return this.core.engineExports.GetColliderPositionY(id);
            }
            return 0;
        };
        
        imports.env.GetColliderPositionZ = (id) => {
            if (this.core.engineExports && this.core.engineExports.GetColliderPositionZ) {
                return this.core.engineExports.GetColliderPositionZ(id);
            }
            return 0;
        };
        
        imports.env.CollideWithMesh = (colliderId, meshId, surfaceIdx) => {
            if (this.core.engineExports && this.core.engineExports.CollideWithMesh) {
                return this.core.engineExports.CollideWithMesh(colliderId, meshId, surfaceIdx);
            }
            return 0;
        };
        
        imports.env.CollisionDepth = (colliderId, meshId, surfaceIdx) => {
            if (this.core.engineExports && this.core.engineExports.CollisionDepth) {
                return this.core.engineExports.CollisionDepth(colliderId, meshId, surfaceIdx);
            }
            return 0;
        };
        
        imports.env.CollisionNormalX = (colliderId, meshId, surfaceIdx) => {
            if (this.core.engineExports && this.core.engineExports.CollisionNormalX) {
                return this.core.engineExports.CollisionNormalX(colliderId, meshId, surfaceIdx);
            }
            return 0;
        };
        
        imports.env.CollisionNormalY = (colliderId, meshId, surfaceIdx) => {
            if (this.core.engineExports && this.core.engineExports.CollisionNormalY) {
                return this.core.engineExports.CollisionNormalY(colliderId, meshId, surfaceIdx);
            }
            return 0;
        };
        
        imports.env.CollisionNormalZ = (colliderId, meshId, surfaceIdx) => {
            if (this.core.engineExports && this.core.engineExports.CollisionNormalZ) {
                return this.core.engineExports.CollisionNormalZ(colliderId, meshId, surfaceIdx);
            }
            return 0;
        };
        
        // WASM Mesh Functions
        imports.env.CreateMesh = () => {
            if (this.core.engineExports && this.core.engineExports.CreateMesh) {
                return this.core.engineExports.CreateMesh();
            }
            return 0;
        };
        
        imports.env.AddSurface = (meshId, vertexCount, indexCount) => {
            if (this.core.engineExports && this.core.engineExports.AddSurface) {
                return this.core.engineExports.AddSurface(meshId, vertexCount, indexCount);
            }
            return -1;
        };
        
        imports.env.GetMeshSurfaceCount = (meshId) => {
            if (this.core.engineExports && this.core.engineExports.GetMeshSurfaceCount) {
                return this.core.engineExports.GetMeshSurfaceCount(meshId);
            }
            return 0;
        };
        
        imports.env.GetSurfaceVertexCount = (meshId, surfaceIdx) => {
            if (this.core.engineExports && this.core.engineExports.GetSurfaceVertexCount) {
                return this.core.engineExports.GetSurfaceVertexCount(meshId, surfaceIdx);
            }
            return 0;
        };
        
        imports.env.GetSurfaceIndexCount = (meshId, surfaceIdx) => {
            if (this.core.engineExports && this.core.engineExports.GetSurfaceIndexCount) {
                return this.core.engineExports.GetSurfaceIndexCount(meshId, surfaceIdx);
            }
            return 0;
        };
        
        imports.env.GetSurfaceVerticesPtr = (meshId, surfaceIdx) => {
            if (this.core.engineExports && this.core.engineExports.GetSurfaceVerticesPtr) {
                return this.core.engineExports.GetSurfaceVerticesPtr(meshId, surfaceIdx);
            }
            return 0;
        };
        
        imports.env.GetSurfaceIndicesPtr = (meshId, surfaceIdx) => {
            if (this.core.engineExports && this.core.engineExports.GetSurfaceIndicesPtr) {
                return this.core.engineExports.GetSurfaceIndicesPtr(meshId, surfaceIdx);
            }
            return 0;
        };
        
        // WASM LinePick Functions
        imports.env.LinePick = (meshId, x, y, z, dx, dy, dz) => {
            if (this.core.engineExports && this.core.engineExports.LinePick) {
                return this.core.engineExports.LinePick(meshId, x, y, z, dx, dy, dz);
            }
            return -1;
        };
        
        imports.env.LinePickX = (meshId, x, y, z, dx, dy, dz) => {
            if (this.core.engineExports && this.core.engineExports.LinePickX) {
                return this.core.engineExports.LinePickX(meshId, x, y, z, dx, dy, dz);
            }
            return 0;
        };
        
        imports.env.LinePickY = (meshId, x, y, z, dx, dy, dz) => {
            if (this.core.engineExports && this.core.engineExports.LinePickY) {
                return this.core.engineExports.LinePickY(meshId, x, y, z, dx, dy, dz);
            }
            return 0;
        };
        
        imports.env.LinePickZ = (meshId, x, y, z, dx, dy, dz) => {
            if (this.core.engineExports && this.core.engineExports.LinePickZ) {
                return this.core.engineExports.LinePickZ(meshId, x, y, z, dx, dy, dz);
            }
            return 0;
        };
        
        imports.env.LinePickNX = (meshId, x, y, z, dx, dy, dz) => {
            if (this.core.engineExports && this.core.engineExports.LinePickNX) {
                return this.core.engineExports.LinePickNX(meshId, x, y, z, dx, dy, dz);
            }
            return 0;
        };
        
        imports.env.LinePickNY = (meshId, x, y, z, dx, dy, dz) => {
            if (this.core.engineExports && this.core.engineExports.LinePickNY) {
                return this.core.engineExports.LinePickNY(meshId, x, y, z, dx, dy, dz);
            }
            return 0;
        };
        
        imports.env.LinePickNZ = (meshId, x, y, z, dx, dy, dz) => {
            if (this.core.engineExports && this.core.engineExports.LinePickNZ) {
                return this.core.engineExports.LinePickNZ(meshId, x, y, z, dx, dy, dz);
            }
            return 0;
        };
        
        imports.env.LinePickDistance = (meshId, x, y, z, dx, dy, dz) => {
            if (this.core.engineExports && this.core.engineExports.LinePickDistance) {
                return this.core.engineExports.LinePickDistance(meshId, x, y, z, dx, dy, dz);
            }
            return -1;
        };
    }

    // WASM Collision Helpers
    createWasmCollider(radius, height) {
        if (this.core.engineExports && this.core.engineExports.CreateCollider) {
            return this.core.engineExports.CreateCollider(radius, height);
        }
        return 0;
    }
    
    freeWasmCollider(id) {
        if (this.core.engineExports && this.core.engineExports.FreeCollider) {
            this.core.engineExports.FreeCollider(id);
        }
    }
    
    updateWasmColliderPosition(entId) {
        const entity = this.graphics.entities[entId];
        const colliderId = this.wasmColliderMap.get(entId);
        if (entity && colliderId && this.core.engineExports?.SetColliderPosition) {
            this.core.engineExports.SetColliderPosition(
                colliderId,
                entity.position.x,
                -entity.position.y,
                entity.position.z
            );
        }
    }

    updateCollisions() {
        if (this.useWasmCollision && this.wasmEngineReady) {
            this.updateWasmCollisions();
        } else {
            this.updateJSCollisions();
        }
    }
    
    updateWasmCollisions() {
        this.collisionResults = {};
        
        for (const [entId, colliderId] of this.wasmColliderMap) {
            const entity = this.graphics.entities[entId];
            if (!entity) continue;
            
            this.updateWasmColliderPosition(entId);
            
            const entityCollisions = [];
            
            // Check collision with all meshes in the scene
            for (const [meshEntId, meshEntity] of Object.entries(this.graphics.entities)) {
                if (meshEntId === entId) continue;
                if (!meshEntity.userData || !meshEntity.userData.meshes) continue;
                
                for (let i = 0; i < meshEntity.userData.meshes.length; i++) {
                    const meshWrapper = meshEntity.userData.meshes[i];
                    if (!meshWrapper || !meshWrapper.userData) continue;
                    
                    const meshId = meshWrapper.userData.meshId;
                    if (meshId === undefined) continue;
                    
                    const surfaceCount = this.core.engineExports?.GetMeshSurfaceCount(meshId) || 0;
                    
                    for (let s = 0; s < surfaceCount; s++) {
                        const collided = this.core.engineExports?.CollideWithMesh(colliderId, meshId, s);
                        if (collided) {
                            const depth = this.core.engineExports?.CollisionDepth(colliderId, meshId, s) || 0;
                            const nx = this.core.engineExports?.CollisionNormalX(colliderId, meshId, s) || 0;
                            const ny = this.core.engineExports?.CollisionNormalY(colliderId, meshId, s) || 0;
                            const nz = this.core.engineExports?.CollisionNormalZ(colliderId, meshId, s) || 0;
                            
                            entityCollisions.push({
                                object: meshEntity,
                                point: entity.position.clone(),
                                normal: new THREE.Vector3(nx, ny, nz),
                                depth: depth
                            });
                        }
                    }
                }
            }
            
            if (entityCollisions.length > 0) {
                this.collisionResults[entId] = entityCollisions;
            }
        }
    }
    
    updateJSCollisions() {
        this.collisionResults = {};
        
        for (const rule of this.collisionRules) {
            // Simplified collision detection
        }
    }
    
    enableWasmCollision(enabled) {
        this.useWasmCollision = enabled;
        console.log(`WASM Collision: ${enabled ? 'enabled' : 'disabled'}`);
    }
    
    setWasmEngineReady(ready) {
        this.wasmEngineReady = ready;
        if (ready) {
            console.log('WASM Collision Engine Ready');
        }
    }
}

window.Blitz3DPhysics = Blitz3DPhysics;
module.exports = Blitz3DPhysics;