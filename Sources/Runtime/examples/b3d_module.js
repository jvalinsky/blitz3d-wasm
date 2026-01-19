/**
 * Blitz3D B3D Mesh Loader
 * Parses B3D format files and creates Three.js objects with animation support
 */

class B3DLoader {
    constructor(graphics, core) {
        this.graphics = graphics;
        this.core = core;
        this.fileIO = core.fileIO;
        this.debugMode = true;
        this.logCount = 0;
    }

    async loadFile(filePath, parentId) {
        this.log(`[B3DLoader] Loading: ${filePath}`);

        const handle = this.fileIO.openFile(filePath);
        if (handle === 0) {
            this.log(`[B3DLoader] Failed to open file: ${filePath}`);
            return this.createPlaceholder(parentId);
        }

        try {
            const data = await this.readFile(handle, filePath);
            const b3dData = this.parseBinaryData(data);
            const entityId = await this.createThreeJSObjects(b3dData, parentId);
            this.log(`[B3DLoader] Created entity: ${entityId}`);
            return entityId;
        } catch (error) {
            console.error(`[B3DLoader] Error loading ${filePath}: ${error.message}`);
            return this.createPlaceholder(parentId);
        } finally {
            this.fileIO.closeFile(handle);
        }
    }

    async readFile(handle, filePath) {
        const size = this.fileIO.fileSize(handle);
        const buffer = new Uint8Array(size);
        
        for (let i = 0; i < size; i++) {
            buffer[i] = this.fileIO.readByte(handle);
        }
        
        return buffer;
    }

    parseBinaryData(data) {
        this.data = data;
        this.offset = 0;
        this.textures = [];
        this.brushes = [];
        this.meshes = [];
        this.animations = [];
        this.bones = [];

        const headerBytes = [];
        for (let i = 0; i < 4; i++) {
            headerBytes.push(this.data[this.offset++]);
        }
        const headerStr = String.fromCharCode(...headerBytes);

        if (headerStr !== 'BB3D') {
            throw new Error(`Invalid B3D header: expected "BB3D", got "${headerStr}"`);
        }

        // Read file size (4 bytes LE) - some files have this, some don't
        // If the next 4 bytes look like a reasonable file size, skip them
        const fileSizeCheck = this.peekInt32LE();
        const remainingSize = this.data.length - this.offset;
        
        if (fileSizeCheck === remainingSize || fileSizeCheck === remainingSize - 4) {
            // This looks like a file size field
            this.offset += 4;
        }

        const version = this.readInt32LE();
        this.log(`[B3DLoader] Version: 0x${version.toString(16)}`);

        let chunksRead = 0;
        const maxChunks = 2000;

        while (this.offset < this.data.length && chunksRead < maxChunks) {
            chunksRead++;

            if (this.offset + 8 > this.data.length) {
                break;
            }

            const chunkId = this.readInt32BE();
            const chunkSize = this.readInt32LE();
            const chunkStart = this.offset; // Offset at start of chunk DATA (after header)
            
            const chunkName = String.fromCharCode(
                (chunkId >> 24) & 0xff,
                (chunkId >> 16) & 0xff,
                (chunkId >> 8) & 0xff,
                chunkId & 0xff
            );
            
            if (this.logCount < 20) {
                this.log(`[B3DLoader] Chunk: "${chunkName}" (0x${chunkId.toString(16)}), size: ${chunkSize}, data at ${chunkStart}, ends at ${chunkStart + chunkSize}`);
            }

            this.readChunk(chunkName, chunkId, chunkSize);

            // Chunk data was read from `chunkStart` to `chunkStart + chunkSize`
            // Next chunk header is at `chunkStart + chunkSize`
            const newOffset = chunkStart + chunkSize;
            if (this.logCount < 5) {
                this.log(`[B3DLoader] Moving offset from ${this.offset} to ${newOffset}`);
            }
            this.offset = newOffset;
        }

        this.log(`[B3DLoader] Parsed: ${this.textures.length} textures, ${this.brushes.length} brushes, ${this.meshes.length} meshes, ${this.animations.length} animations`);

        return {
            textures: this.textures,
            brushes: this.brushes,
            meshes: this.meshes,
            animations: this.animations,
            bones: this.bones
        };
    }

    readChunk(chunkName, chunkId, chunkSize) {
        const endOffset = this.offset + chunkSize;

        switch (chunkName) {
            case 'TEXS':
                this.readTextures(chunkSize);
                break;
            case 'BRUS':
                this.readBrushes(chunkSize);
                break;
            case 'MESH':
                this.readMesh(chunkSize);
                break;
            case 'ANIM':
                this.readAnimation(chunkSize);
                break;
            case 'NODE':
                this.readNode(chunkSize);
                break;
            case 'BONE':
                this.readBone(chunkSize);
                break;
            case 'VRTS':
                this.readVertices(chunkSize);
                break;
            case 'TRIS':
                this.readTriangles(chunkSize);
                break;
            case 'ANKS':
                this.readBoneKeys(chunkSize);
                break;
            case 'SEQS':
                this.readSequences(chunkSize);
                break;
            default:
                // Skip unknown chunks
                if (this.logCount < 10) {
                    this.log(`[B3DLoader] Skipping unknown chunk: ${chunkName} (0x${chunkId.toString(16)})`);
                }
                this.offset = endOffset;
        }
    }

    readInt32LE() {
        const val = this.data[this.offset] |
               (this.data[this.offset + 1] << 8) |
               (this.data[this.offset + 2] << 16) |
               (this.data[this.offset + 3] << 24);
        this.offset += 4;
        return val;
    }

    readInt32BE() {
        const val = (this.data[this.offset] << 24) |
               (this.data[this.offset + 1] << 16) |
               (this.data[this.offset + 2] << 8) |
               this.data[this.offset + 3];
        this.offset += 4;
        return val;
    }

    peekInt32LE() {
        return this.data[this.offset] |
               (this.data[this.offset + 1] << 8) |
               (this.data[this.offset + 2] << 16) |
               (this.data[this.offset + 3] << 24);
    }

    readFloat32() {
        const view = new DataView(this.data.buffer, this.data.byteOffset + this.offset, 4);
        const val = view.getFloat32(0, true);
        this.offset += 4;
        return val;
    }

    readNullTerminatedString() {
        let str = '';
        while (this.offset < this.data.length && this.data[this.offset] !== 0) {
            str += String.fromCharCode(this.data[this.offset++]);
        }
        this.offset++;
        return str;
    }

    readTextures(chunkSize) {
        const endOffset = this.offset + chunkSize;
        
        while (this.offset < endOffset) {
            const name = this.readNullTerminatedString();
            const flags = this.readInt32LE();
            const blend = this.readInt32LE();
            const posU = this.readFloat32();
            const posV = this.readFloat32();
            const scaleU = this.readFloat32();
            const scaleV = this.readFloat32();
            const rotation = this.readFloat32();

            this.textures.push({
                name,
                flags,
                blend,
                position: { u: posU, v: posV },
                scale: { u: scaleU, v: scaleV },
                rotation
            });
        }
    }

    readBrushes(chunkSize) {
        const endOffset = this.offset + chunkSize;
        const numTexs = this.readInt32LE();

        while (this.offset < endOffset) {
            const name = this.readNullTerminatedString();
            const red = this.readFloat32();
            const green = this.readFloat32();
            const blue = this.readFloat32();
            const alpha = this.readFloat32();
            const shininess = this.readFloat32();
            const blend = this.readInt32LE();
            const fx = this.readInt32LE();

            const texIds = [];
            for (let i = 0; i < numTexs && this.offset < endOffset; i++) {
                texIds.push(this.readInt32LE());
            }

            this.brushes.push({
                name,
                color: { r: red, g: green, b: blue },
                alpha,
                shininess,
                blend,
                fx,
                textureIds: texIds
            });
        }
    }

    readMesh(chunkSize) {
        const endOffset = this.offset + chunkSize;
        
        // Some B3D files have a 4-byte mesh ID or flags after MESH header
        let meshId = -1;
        if (this.offset + 4 <= endOffset && 
            this.data[this.offset] === 0xff && this.data[this.offset + 1] === 0xff && 
            this.data[this.offset + 2] === 0xff && this.data[this.offset + 3] === 0xff) {
            // Skip 4 bytes of 0xff
            meshId = this.readInt32LE();
        }

        const mesh = {
            vertices: [],
            triangles: [],
            positions: [],
            normals: [],
            colors: [],
            uvs: [[], []],
            indices: [],
            brushIndex: -1,
            vertexFlags: 0,
            texCoordSets: 0,
            texCoordSize: 0,
            vertexCount: 0,
            triangleCount: 0
        };

        while (this.offset < endOffset - 8) {
            if (this.offset + 8 > endOffset) break;
            
            const subChunkId = this.readInt32BE();
            const subChunkSize = this.readInt32LE();
            const subEndOffset = this.offset + subChunkSize;

            const subChunkName = String.fromCharCode(
                (subChunkId >> 24) & 0xff,
                (subChunkId >> 16) & 0xff,
                (subChunkId >> 8) & 0xff,
                subChunkId & 0xff
            );

            switch (subChunkName) {
                case 'VRTS':
                    mesh.vertexFlags = this.readInt32LE();
                    mesh.texCoordSets = this.readInt32LE();
                    mesh.texCoordSize = this.readInt32LE();
                    this.readVerticesInternal(mesh, subEndOffset);
                    break;
                case 'TRIS':
                    mesh.brushIndex = this.readInt32LE();
                    this.readTrianglesInternal(mesh, subEndOffset);
                    break;
                default:
                    this.offset = subEndOffset;
            }
        }

        this.meshes.push(mesh);
        this.log(`[B3DLoader] Mesh: ${mesh.vertexCount} verts, ${mesh.triangleCount} tris`);
    }

    readVerticesInternal(mesh, chunkEnd) {
        const positions = [];
        const normals = [];
        const colors = [];
        const uvs0 = [];
        const uvs1 = [];
        
        while (this.offset < chunkEnd - 12) {
            // Check if we've read enough bytes for at least one vertex (x,y,z = 12 bytes minimum)
            if (this.offset + 12 > chunkEnd) break;
            
            const x = this.readFloat32();
            const y = this.readFloat32();
            const z = this.readFloat32();
            positions.push(x, y, z);

            if (mesh.vertexFlags & 1) {
                // Normals present
                if (this.offset + 12 > chunkEnd) break;
                normals.push(this.readFloat32(), this.readFloat32(), this.readFloat32());
            }

            if (mesh.vertexFlags & 2) {
                // Color present (RGBA = 4 bytes)
                if (this.offset + 4 > chunkEnd) break;
                colors.push(
                    this.data[this.offset++] / 255,
                    this.data[this.offset++] / 255,
                    this.data[this.offset++] / 255,
                    this.data[this.offset++] / 255
                );
            }

            // Texture coordinates
            for (let tc = 0; tc < mesh.texCoordSets && tc < 2; tc++) {
                if (this.offset + 8 > chunkEnd) break;
                const u = this.readFloat32();
                const v = this.readFloat32();
                if (tc === 0) uvs0.push(u, 1 - v);
                else uvs1.push(u, 1 - v);
            }
        }

        mesh.positions = positions;
        mesh.normals = normals;
        mesh.colors = colors;
        mesh.uvs = [uvs0, uvs1];
        mesh.vertexCount = positions.length / 3;
    }

    readTrianglesInternal(mesh, chunkEnd) {
        const indices = [];
        
        while (this.offset < chunkEnd - 12) {
            // Check if we have at least 3 vertex indices (12 bytes)
            if (this.offset + 12 > chunkEnd) break;
            
            const v0 = this.readInt32LE();
            const v1 = this.readInt32LE();
            const v2 = this.readInt32LE();
            
            indices.push(v0, v1, v2);
            
            // Skip control points if present (vertexFlags & 4)
            if (mesh.vertexFlags & 4) {
                if (this.offset + 12 > chunkEnd) break;
                this.readInt32LE(); // Skip control point 0
                this.readInt32LE(); // Skip control point 1
                this.readInt32LE(); // Skip control point 2
            }
        }

        mesh.indices = indices;
        mesh.triangleCount = indices.length / 3;
    }

    readAnimation(chunkSize) {
        const flags = this.readInt32LE();
        const frames = this.readInt32LE();
        const speed = this.readFloat32();

        this.animations.push({
            flags,
            frames,
            speed,
            tracks: []
        });
    }

    readNode(chunkSize) {
        const endOffset = this.offset + chunkSize;
        const name = this.readNullTerminatedString();

        const node = {
            name,
            position: { x: 0, y: 0, z: 0 },
            rotation: { w: 1, x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 },
            children: [],
            meshIndex: -1
        };

        // Check if next bytes are floats (position/rotation/scale) or chunk ID
        // Format: name + [pos(3 floats)] + [scale(3 floats)] + [rot(4 floats)] + [child chunks]
        // Or: name + child chunks directly
        
        if (this.offset + 8 <= endOffset) {
            const nextBytes = this.data[this.offset] | (this.data[this.offset + 1] << 8);
            
            // If next 2 bytes look like a chunk ID prefix, it's child chunks
            if (nextBytes >= 0x4D45 && nextBytes <= 0x5A5A) {
                // Likely a chunk ID, skip to chunk parsing
            } else {
                // Try to read as floats
                try {
                    // Check if we have position (3 floats)
                    if (this.offset + 12 <= endOffset) {
                        node.position.x = this.readFloat32();
                        node.position.y = this.readFloat32();
                        node.position.z = this.readFloat32();
                    }
                    
                    // Check if we have scale (3 floats)
                    if (this.offset + 12 <= endOffset) {
                        node.scale.x = this.readFloat32();
                        node.scale.y = this.readFloat32();
                        node.scale.z = this.readFloat32();
                    }
                    
                    // Check if we have rotation (4 floats - quaternion)
                    if (this.offset + 16 <= endOffset) {
                        node.rotation.w = this.readFloat32();
                        node.rotation.x = this.readFloat32();
                        node.rotation.y = this.readFloat32();
                        node.rotation.z = this.readFloat32();
                    }
                } catch (e) {
                    // Failed to read as floats, reset offset
                    this.offset = endOffset - chunkSize + name.length + 1;
                }
            }
        }

        this.log(`[B3DLoader] NODE "${name}" at offset ${endOffset - chunkSize}, end at ${endOffset}`);

        // Parse child chunks
        while (this.offset < endOffset - 8) {
            if (this.offset + 8 > endOffset) break;
            
            const subChunkId = this.readInt32BE();
            const subChunkSize = this.readInt32LE();
            const subEndOffset = this.offset + subChunkSize;

            const subChunkName = String.fromCharCode(
                (subChunkId >> 24) & 0xff,
                (subChunkId >> 16) & 0xff,
                (subChunkId >> 8) & 0xff,
                subChunkId & 0xff
            );

            if (this.logCount < 25) {
                this.log(`[B3DLoader]   Subchunk: "${subChunkName}" (0x${subChunkId.toString(16)}), size: ${subChunkSize}`);
            }

            switch (subChunkName) {
                case 'MESH':
                    const meshIndex = this.meshes.length;
                    this.log(`[B3DLoader]   Found MESH at index ${meshIndex}`);
                    this.readMesh(subChunkSize);
                    if (this.meshes.length > meshIndex) {
                        node.meshIndex = meshIndex;
                    }
                    break;
                case 'NODE':
                    this.readNode(subChunkSize);
                    break;
                default:
                    this.offset = subEndOffset;
            }

            this.offset = subEndOffset;
        }

        this.bones.push(node);
    }

    readBone(chunkSize) {
        const endOffset = this.offset + chunkSize;
        const name = this.readNullTerminatedString();
        const parentIndex = this.readInt32LE();

        const bone = {
            name,
            parentIndex,
            position: { x: 0, y: 0, z: 0 },
            rotation: { w: 1, x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 }
        };

        while (this.offset < endOffset) {
            const subChunkId = this.readInt32LE();
            const subChunkSize = this.readInt32LE();
            const subEndOffset = this.offset + subChunkSize;

            switch (subChunkId) {
                case 0x54505320: // 'POS '
                    bone.position.x = this.readFloat32();
                    bone.position.y = this.readFloat32();
                    bone.position.z = this.readFloat32();
                    break;
                case 0x524F5420: // 'ROT'
                    bone.rotation.w = this.readFloat32();
                    bone.rotation.x = this.readFloat32();
                    bone.rotation.y = this.readFloat32();
                    bone.rotation.z = this.readFloat32();
                    break;
                default:
                    this.offset = subEndOffset;
            }

            this.offset = subEndOffset;
        }

        this.bones.push(bone);
    }

    readBoneKeys(chunkSize) {
        const flags = this.readInt32LE();
        const keys = [];

        while (this.offset < this.data.length && this.offset < this.offset + chunkSize) {
            const frame = this.readInt32LE();
            const position = {
                x: this.readFloat32(),
                y: this.readFloat32(),
                z: this.readFloat32()
            };
            keys.push({ frame, position });
        }

        if (this.animations.length > 0) {
            this.animations[this.animations.length - 1].boneKeys = keys;
        }
    }

    readSequences(chunkSize) {
        const endOffset = this.offset + chunkSize;
        const numSeqs = this.readInt32LE();

        for (let i = 0; i < numSeqs && this.offset < endOffset; i++) {
            const name = this.readNullTerminatedString();
            const firstFrame = this.readInt32LE();
            const numFrames = this.readInt32LE();

            if (this.animations.length > 0) {
                const anim = this.animations[this.animations.length - 1];
                if (!anim.sequences) anim.sequences = [];
                anim.sequences.push({
                    name,
                    firstFrame,
                    numFrames,
                    lastFrame: firstFrame + numFrames - 1
                });
            }
        }
    }

    async createThreeJSObjects(b3dData, parentId) {
        const root = new THREE.Group();
        const rootId = this.graphics.nextEntityId++;
        this.graphics.entities[rootId] = root;
        root.userData.entityId = rootId;
        root.userData.isB3D = true;
        root.userData.bones = [];

        if (parentId) {
            const parent = this.graphics.entities[parentId];
            if (parent) {
                parent.add(root);
                root.userData.parentId = parentId;
            }
        } else if (this.graphics.scene) {
            this.graphics.scene.add(root);
        }

        for (let i = 0; i < b3dData.meshes.length; i++) {
            const meshData = b3dData.meshes[i];
            const mesh = await this.createMesh(meshData, b3dData, i);
            if (mesh) {
                root.add(mesh);
            }
        }

        if (b3dData.animations.length > 0) {
            this.setupAnimation(root, b3dData.animations[0]);
        }

        this.log(`[B3DLoader] Created ${b3dData.meshes.length} meshes, ${b3dData.bones.length} bones`);
        return rootId;
    }

    async createMesh(meshData, b3dData, meshIndex) {
        if (!meshData.positions || meshData.positions.length === 0) {
            this.log(`[B3DLoader] Skipping empty mesh ${meshIndex}`);
            return null;
        }

        const geometry = new THREE.BufferGeometry();

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(meshData.positions, 3));

        if (meshData.normals && meshData.normals.length > 0) {
            geometry.setAttribute('normal', new THREE.Float32BufferAttribute(meshData.normals, 3));
        }

        if (meshData.colors && meshData.colors.length > 0) {
            geometry.setAttribute('color', new THREE.Float32BufferAttribute(meshData.colors, 4));
        }

        if (meshData.uvs && meshData.uvs[0] && meshData.uvs[0].length > 0) {
            geometry.setAttribute('uv', new THREE.Float32BufferAttribute(meshData.uvs[0], 2));
        }

        if (meshData.indices && meshData.indices.length > 0) {
            geometry.setIndex(meshData.indices);
        }

        geometry.computeVertexNormals();

        let material;
        if (meshData.brushIndex >= 0 && meshData.brushIndex < b3dData.brushes.length) {
            const brush = b3dData.brushes[meshData.brushIndex];
            material = await this.createMaterial(brush, b3dData);
        } else {
            material = new THREE.MeshStandardMaterial({
                color: 0x888888,
                side: THREE.DoubleSide
            });
        }

        const mesh = new THREE.Mesh(geometry, material);
        mesh.userData.meshIndex = meshIndex;
        mesh.userData.isB3DMesh = true;

        return mesh;
    }

    async createMaterial(brush, b3dData) {
        let texture = null;

        if (brush.textureIds && brush.textureIds.length > 0 && brush.textureIds[0] >= 0) {
            const texIdx = brush.textureIds[0];
            if (texIdx < b3dData.textures.length) {
                const texData = b3dData.textures[texIdx];
                if (this.graphics.textureLoader) {
                    texture = await this.graphics.textureLoader.loadTexture(texData.name, { flags: texData.flags });
                }
            }
        }

        const materialOptions = {
            color: new THREE.Color(brush.color.r, brush.color.g, brush.color.b),
            opacity: brush.alpha,
            transparent: brush.alpha < 1,
            side: THREE.DoubleSide,
            shininess: brush.shininess
        };

        if (brush.blend === 1) {
            materialOptions.blending = THREE.AdditiveBlending;
        } else if (brush.blend === 2) {
            materialOptions.blending = THREE.MultiplyBlending;
        }

        if (texture) {
            materialOptions.map = texture;
        }

        return new THREE.MeshStandardMaterial(materialOptions);
    }

    setupAnimation(root, animation) {
        if (!animation.frames || animation.frames === 0) return;

        const mixer = new THREE.AnimationMixer(root);
        root.userData.mixer = mixer;
        this.graphics.animMixers.add(mixer);

        if (animation.sequences && animation.sequences.length > 0) {
            const tracks = this.createAnimationTracks(animation);
            
            if (tracks.length > 0) {
                const clip = new THREE.AnimationClip('B3DAnimation', animation.frames / animation.speed || 1, tracks);
                const action = mixer.clipAction(clip);
                action.setLoop(THREE.LoopRepeat);
                root.userData.action = action;
                root.userData.animationClip = clip;
            }
        }
    }

    createAnimationTracks(animation) {
        const tracks = [];

        if (animation.boneKeys && animation.boneKeys.length > 0) {
            for (const boneKey of animation.boneKeys) {
                const positionTrack = new THREE.VectorKeyframeTrack(
                    boneKey.position.path || '.position',
                    boneKey.position.times || [boneKey.frame / (animation.speed || 30)],
                    boneKey.position.values || [boneKey.position.x, boneKey.position.y, boneKey.position.z]
                );
                tracks.push(positionTrack);
            }
        }

        return tracks;
    }

    createPlaceholder(parentId) {
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshBasicMaterial({ color: 0xff00ff, wireframe: true });
        const mesh = new THREE.Mesh(geometry, material);

        const root = new THREE.Group();
        const rootId = this.graphics.nextEntityId++;
        this.graphics.entities[rootId] = root;
        root.userData.isB3D = true;
        root.add(mesh);

        if (parentId) {
            const parent = this.graphics.entities[parentId];
            if (parent) parent.add(root);
        } else if (this.graphics.scene) {
            this.graphics.scene.add(root);
        }

        this.log(`[B3DLoader] Created placeholder for failed load`);
        return rootId;
    }

    log(message) {
        if (!this.debugMode) return;
        this.logCount++;
        if (this.logCount <= 50) {
            console.log(message);
        } else if (this.logCount === 51) {
            console.log('... (B3D logging truncated)');
        }
    }
}

// Expose to window for browser use (when loaded via script tag)
if (typeof window !== 'undefined') {
    window.B3DLoader = B3DLoader;
}

module.exports = B3DLoader;
