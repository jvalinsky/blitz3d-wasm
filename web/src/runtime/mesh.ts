/**
 * Blitz3D Runtime Mesh Module
 * Handles procedural mesh generation and manipulation using Three.js BufferGeometry
 * Supports both JS meshes and WASM-backed meshes
 */

import * as THREE from 'three';

export class Blitz3DSurface {
    [key: string]: any;

    constructor(mesh: any) {
        this.mesh = mesh;
        this.vertices = []; // [x, y, z, u, v, nx, ny, nz, r, g, b, a]
        this.indices = [];
        this.dirty = true;
        this.hasNormals = false;

        // Geometry buffers
        this.geometry = new THREE.BufferGeometry();
        this.mesh.add(new THREE.Mesh(this.geometry, new THREE.MeshBasicMaterial({
            vertexColors: true,
            side: THREE.DoubleSide
        })));
    }

    addVertex(x: number, y: number, z: number, u: number, v: number, w: number) {
        // Negate Z for Left-Handed -> Right-Handed conversion
        this.vertices.push(
            x, y, -z,
            u || 0, v || 0,
            0, 0, 0, // nx, ny, nz
            255, 255, 255, 255 // Default color white
        );
        this.dirty = true;
        return (this.vertices.length / 12) - 1;
    }

    setNormal(v: number, nx: number, ny: number, nz: number) {
        const index = v * 12 + 5;
        if (index < this.vertices.length) {
            this.vertices[index] = nx;
            this.vertices[index + 1] = ny;
            this.vertices[index + 2] = -nz; // Note: negate nz if needed for LH->RH
            this.dirty = true;
            this.hasNormals = true;
        }
    }

    addTriangle(v0: number, v1: number, v2: number) {
        // Reverse winding order for Left-Handed -> Right-Handed
        this.indices.push(v0, v2, v1);
        this.dirty = true;
        return (this.indices.length / 3) - 1;
    }

    vertexColor(v: number, r: number, g: number, b: number, a: number) {
        const index = v * 12 + 8;
        if (index < this.vertices.length) {
            this.vertices[index] = r;
            this.vertices[index + 1] = g;
            this.vertices[index + 2] = b;
            this.vertices[index + 3] = a || 255;
            this.dirty = true;
        }
    }

    setVertexUV(v: number, u: number, w: number) {
        // w parameter is ignored in Three.js (only u, v used)
        const index = v * 12 + 3;
        if (index < this.vertices.length) {
            this.vertices[index] = u;
            // v is next
            this.dirty = true;
        }
    }

    update() {
        if (!this.dirty) return;

        const vertexCount = this.vertices.length / 12;

        if (vertexCount === 0) return;

        const positions = new Float32Array(vertexCount * 3);
        const uvs = new Float32Array(vertexCount * 2);
        const normals = new Float32Array(vertexCount * 3);
        const colors = new Float32Array(vertexCount * 4);

        for (let i = 0; i < vertexCount; i++) {
            const src = i * 12;
            const dst = i * 3;
            const dstUV = i * 2;
            const dstCol = i * 4;

            positions[dst] = this.vertices[src];
            positions[dst + 1] = this.vertices[src + 1];
            positions[dst + 2] = this.vertices[src + 2];

            uvs[dstUV] = this.vertices[src + 3];
            uvs[dstUV + 1] = this.vertices[src + 4];

            normals[dst] = this.vertices[src + 5];
            normals[dst + 1] = this.vertices[src + 6];
            normals[dst + 2] = this.vertices[src + 7];

            colors[dstCol] = this.vertices[src + 8] / 255.0;
            colors[dstCol + 1] = this.vertices[src + 9] / 255.0;
            colors[dstCol + 2] = this.vertices[src + 10] / 255.0;
            colors[dstCol + 3] = (this.vertices[src + 11] || 255) / 255.0;
        }

        this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
        this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4));

        if (this.hasNormals) {
            this.geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
        } else {
            this.geometry.computeVertexNormals();
        }

        if (this.indices.length > 0) {
            this.geometry.setIndex(this.indices);
        }

        // Mark for upload
        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.uv.needsUpdate = true;
        this.geometry.attributes.color.needsUpdate = true;
        if (this.geometry.attributes.normal) {
            this.geometry.attributes.normal.needsUpdate = true;
        }

        this.dirty = false;
    }
}

/**
 * WASM-backed surface - reads mesh data directly from WASM memory
 * Zero-copy approach for maximum performance
 */
export class Blitz3DWasmSurface {
    [key: string]: any;

    constructor(core: any, mesh: any, surfaceIdx: number) {
        this.core = core;
        this.mesh = mesh;
        this.surfaceIdx = surfaceIdx;

        // Get pointers from WASM
        this.vertexPtr = this.core.engineExports?.GetSurfaceVerticesPtr(mesh, surfaceIdx) || 0;
        this.indexPtr = this.core.engineExports?.GetSurfaceIndicesPtr(mesh, surfaceIdx) || 0;
        this.vertexCount = this.core.engineExports?.GetSurfaceVertexCount(mesh, surfaceIdx) || 0;
        this.indexCount = this.core.engineExports?.GetSurfaceIndexCount(mesh, surfaceIdx) || 0;

        // Create geometry
        this.geometry = new THREE.BufferGeometry();
        this.mesh.add(new THREE.Mesh(this.geometry, new THREE.MeshBasicMaterial({
            vertexColors: true,
            side: THREE.DoubleSide
        })));

        this.update();
    }

    update() {
        if (!this.core.memory) return;

        const vertexCount = this.vertexCount;
        const indexCount = this.indexCount;

        if (vertexCount === 0) return;

        const positions = new Float32Array(vertexCount * 3);
        const uvs = new Float32Array(vertexCount * 2);
        const colors = new Float32Array(vertexCount * 4);
        const indices = [];

        const memory = new Float32Array(this.core.memory.buffer);
        const byteMemory = new Uint8Array(this.core.memory.buffer);
        const indexMemory = new Int32Array(this.core.memory.buffer);

        // Read vertices
        for (let i = 0; i < vertexCount; i++) {
            // Stride based on Blitz3D structure in Exports.swift
            // Vertices are at vertexPtr
            const offset = (this.vertexPtr / 4) + i * 11; // 11 floats per vertex: x,y,z, nx,ny,nz, u,v, r,g,b

            positions[i * 3] = memory[offset];
            positions[i * 3 + 1] = memory[offset + 1];
            positions[i * 3 + 2] = -memory[offset + 2]; // LH->RH

            uvs[i * 2] = memory[offset + 6];
            uvs[i * 2 + 1] = memory[offset + 7];

            // Colors are 0-255, convert to 0-1
            const colorOffset = this.vertexPtr + (i * 11 * 4) + (8 * 4);
            colors[i * 4] = byteMemory[colorOffset] / 255.0;
            colors[i * 4 + 1] = byteMemory[colorOffset + 1] / 255.0;
            colors[i * 4 + 2] = byteMemory[colorOffset + 2] / 255.0;
            colors[i * 4 + 3] = 1.0;
        }

        // Read indices
        for (let i = 0; i < indexCount; i++) {
            const offset = (this.indexPtr / 4) + i;
            indices.push(indexMemory[offset]);
        }

        this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
        this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4));
        this.geometry.setIndex(indices);
        this.geometry.computeVertexNormals();
    }
}

export function Blitz3DMesh(graphics: any) {
    const surfaces = {};

    return {
        Blitz3DSurface,
        Blitz3DWasmSurface,
        setupImports: function (imports: any) {
            // Mesh surface functions
            imports.env.CountSurfaces = (meshId: number) => {
                const entity = graphics.entities[meshId];
                return entity?.surfaces?.length || 0;
            };

            imports.env.GetSurface = (meshId: number, index: number) => {
                const entity = graphics.entities[meshId];
                return entity?.surfaces?.[index] || 0;
            };

            imports.env.FindSurface = (meshId: number, brushId: number) => {
                const entity = graphics.entities[meshId];
                if (entity?.surfaces) {
                    for (let i = 0; i < entity.surfaces.length; i++) {
                        if (entity.surfaces[i].brush === brushId) return i;
                    }
                }
                return 0;
            };

            imports.env.ClearSurface = (surfaceId: number, clearVerts: number, clearTris: number) => {
                console.log("ClearSurface: surfaceId=" + surfaceId);
            };

            imports.env.AddVertexExtended = (surfaceId: number, x: number, y: number, z: number, u: number, v: number, w: number, nx: number, ny: number, nz: number) => {
                const surface = graphics.surfaces[surfaceId];
                if (surface) {
                    const idx = surface.addVertex(x, y, z, u, v);
                    surface.setNormal(idx, nx, ny, nz);
                    return idx;
                }
                return 0;
            };

            imports.env.SetSurfaceTexture = (surfaceId: number, textureId: number, frame: number, index: number) => {
                console.log(`SetSurfaceTexture: surface=${surfaceId} texture=${textureId}`);
            };

            imports.env.SetSurfaceLightmap = (surfaceId: number, textureId: number) => {
                console.log(`SetSurfaceLightmap: surface=${surfaceId} lightmap=${textureId}`);
            };

            imports.env.AddCollisionVertex = (surfaceId: number, x: number, y: number, z: number) => {
                return 0; // Return vertex index
            };

            imports.env.AddCollisionTriangle = (surfaceId: number, v0: number, v1: number, v2: number) => {
                return 0; // Return triangle index
            };
        }
    };
}
