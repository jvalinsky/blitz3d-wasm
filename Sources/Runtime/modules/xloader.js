/**
 * DirectX X Mesh Loader
 * Parses text-format DirectX .x files and creates Three.js objects
 */

class XLoader {
    constructor(graphics, core, fileIO) {
        this.graphics = graphics;
        this.core = core;
        this.fileIO = fileIO;
        this.debug = true;
    }

    log(...args) {
        if (this.debug) console.log('[XLoader]', ...args);
    }

    /**
     * Load an X file and return a Three.js entity ID
     */
    async loadFile(filePath, parentId = 0) {
        this.log(`Loading: ${filePath}`);

        try {
            // Try to fetch the file
            const data = await this.fetchFile(filePath);
            if (!data) {
                this.log(`Failed to fetch: ${filePath}`);
                return 0;
            }

            // Parse the X file
            const xData = this.parseXFile(data);
            if (!xData || !xData.meshes.length) {
                this.log(`No meshes found in: ${filePath}`);
                return 0;
            }

            // Create Three.js objects
            const entityId = await this.createThreeJSObjects(xData, parentId, filePath);
            this.log(`Created entity: ${entityId}`);
            return entityId;

        } catch (error) {
            console.error(`[XLoader] Error loading ${filePath}:`, error);
            return 0;
        }
    }

    async fetchFile(filePath) {
        // Try fileIO first if available
        if (this.fileIO && this.fileIO.readFile) {
            const data = await this.fileIO.readFile(filePath);
            if (data) return new TextDecoder().decode(data);
        }

        // Fallback to fetch
        try {
            const response = await fetch(filePath);
            if (response.ok) {
                return await response.text();
            }
        } catch (e) {
            this.log(`Fetch failed: ${e.message}`);
        }

        return null;
    }

    /**
     * Parse X file text content
     */
    parseXFile(content) {
        this.log('Parsing X file...');

        // Validate header
        if (!content.startsWith('xof 0303txt') && !content.startsWith('xof 0302txt')) {
            throw new Error('Invalid X file header - only text format supported');
        }

        const result = {
            meshes: [],
            materials: [],
            textures: []
        };

        // Find all Mesh blocks
        const meshBlocks = this.findBlocks(content, 'Mesh');
        this.log(`Found ${meshBlocks.length} Mesh blocks`);

        for (const block of meshBlocks) {
            const mesh = this.parseMeshBlock(block);
            if (mesh) {
                result.meshes.push(mesh);
            }
        }

        return result;
    }

    /**
     * Find all blocks of a given type in content
     */
    findBlocks(content, blockType) {
        const blocks = [];
        const regex = new RegExp(`\\b${blockType}\\s*\\{`, 'g');
        let match;

        while ((match = regex.exec(content)) !== null) {
            const start = match.index + match[0].length;
            const block = this.extractBlock(content, start);
            if (block) {
                blocks.push(block);
            }
        }

        return blocks;
    }

    /**
     * Extract content between matching braces starting at position
     */
    extractBlock(content, start) {
        let depth = 1;
        let i = start;

        while (i < content.length && depth > 0) {
            if (content[i] === '{') depth++;
            else if (content[i] === '}') depth--;
            i++;
        }

        if (depth === 0) {
            return content.substring(start, i - 1);
        }
        return null;
    }

    /**
     * Parse a Mesh block
     */
    parseMeshBlock(block) {
        try {
            // Clean the block - remove comments and normalize whitespace
            let cleaned = block.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

            // Parse vertices
            const vertexMatch = cleaned.match(/^\s*(\d+)\s*;([\s\S]*?)(\d+)\s*;/);
            if (!vertexMatch) {
                this.log('Could not find vertex data');
                return null;
            }

            const vertexCount = parseInt(vertexMatch[1]);
            const vertexData = vertexMatch[2];
            const faceCount = parseInt(vertexMatch[3]);

            this.log(`Parsing ${vertexCount} vertices, ${faceCount} faces`);

            // Extract vertices
            const vertices = this.parseVertices(vertexData, vertexCount);
            if (vertices.length !== vertexCount * 3) {
                this.log(`Vertex count mismatch: expected ${vertexCount * 3}, got ${vertices.length}`);
            }

            // Find and parse faces (after vertex section)
            const afterVertices = cleaned.substring(vertexMatch.index + vertexMatch[0].length);
            const faces = this.parseFaces(afterVertices, faceCount);

            // Parse MeshTextureCoords if present
            let uvs = [];
            const texCoordsBlock = this.findBlocks(cleaned, 'MeshTextureCoords');
            if (texCoordsBlock.length > 0) {
                uvs = this.parseTextureCoords(texCoordsBlock[0]);
            }

            // Parse MeshNormals if present
            let normals = [];
            const normalsBlock = this.findBlocks(cleaned, 'MeshNormals');
            if (normalsBlock.length > 0) {
                normals = this.parseMeshNormals(normalsBlock[0]);
            }

            // Parse MeshMaterialList for texture references
            let textureName = null;
            const materialBlock = this.findBlocks(cleaned, 'MeshMaterialList');
            if (materialBlock.length > 0) {
                textureName = this.extractTextureName(materialBlock[0]);
            }

            this.log(`Parsed: ${vertices.length / 3} verts, ${faces.length / 3} tris, ${uvs.length / 2} UVs`);

            return {
                vertices,
                faces,
                uvs,
                normals,
                textureName
            };

        } catch (error) {
            this.log(`Error parsing mesh block: ${error.message}`);
            return null;
        }
    }

    parseVertices(data, count) {
        const vertices = [];
        // Match patterns like: x;y;z;, or x;y;z;;
        const regex = /(-?[\d.]+)\s*;\s*(-?[\d.]+)\s*;\s*(-?[\d.]+)\s*;/g;
        let match;

        while ((match = regex.exec(data)) !== null && vertices.length < count * 3) {
            vertices.push(parseFloat(match[1]));
            vertices.push(parseFloat(match[2]));
            vertices.push(parseFloat(match[3]));
        }

        return vertices;
    }

    parseFaces(data, count) {
        const faces = [];
        // Match patterns like: 3;v0,v1,v2;,
        const regex = /(\d+)\s*;\s*([\d,\s]+)\s*;/g;
        let match;

        while ((match = regex.exec(data)) !== null && faces.length / 3 < count) {
            const numVerts = parseInt(match[1]);
            const indices = match[2].split(',').map(s => parseInt(s.trim()));

            if (numVerts === 3) {
                // Triangle
                faces.push(indices[0], indices[1], indices[2]);
            } else if (numVerts === 4) {
                // Quad - split into two triangles
                faces.push(indices[0], indices[1], indices[2]);
                faces.push(indices[0], indices[2], indices[3]);
            }
        }

        return faces;
    }

    parseTextureCoords(block) {
        const uvs = [];
        // First number is count
        const countMatch = block.match(/^\s*(\d+)\s*;/);
        if (!countMatch) return uvs;

        const count = parseInt(countMatch[1]);
        const data = block.substring(countMatch.index + countMatch[0].length);

        // Match u;v; patterns
        const regex = /(-?[\d.]+)\s*;\s*(-?[\d.]+)\s*;/g;
        let match;

        while ((match = regex.exec(data)) !== null && uvs.length < count * 2) {
            uvs.push(parseFloat(match[1]));
            uvs.push(parseFloat(match[2]));
        }

        return uvs;
    }

    parseMeshNormals(block) {
        const normals = [];
        // First number is count
        const countMatch = block.match(/^\s*(\d+)\s*;/);
        if (!countMatch) return normals;

        const count = parseInt(countMatch[1]);
        const data = block.substring(countMatch.index + countMatch[0].length);

        // Match x;y;z; patterns
        const regex = /(-?[\d.]+)\s*;\s*(-?[\d.]+)\s*;\s*(-?[\d.]+)\s*;/g;
        let match;

        while ((match = regex.exec(data)) !== null && normals.length < count * 3) {
            normals.push(parseFloat(match[1]));
            normals.push(parseFloat(match[2]));
            normals.push(parseFloat(match[3]));
        }

        return normals;
    }

    extractTextureName(block) {
        // Look for TextureFilename block
        const match = block.match(/TextureFilename\s*\{\s*"([^"]+)"\s*;?\s*\}/);
        if (match) {
            return match[1];
        }
        return null;
    }

    /**
     * Create Three.js objects from parsed X data
     */
    async createThreeJSObjects(xData, parentId, filePath) {
        const THREE = window.THREE;
        if (!THREE) {
            throw new Error('Three.js not available');
        }

        // Create root group
        const root = new THREE.Group();
        root.name = filePath.split('/').pop();
        root.userData.isXMesh = true;

        // Process each mesh
        for (const meshData of xData.meshes) {
            const mesh = await this.createMesh(meshData, filePath);
            if (mesh) {
                root.add(mesh);
            }
        }

        // Register with graphics system
        const id = this.graphics.nextEntityId++;
        this.graphics.entities[id] = root;

        // Add to parent or scene
        if (parentId && this.graphics.entities[parentId]) {
            this.graphics.entities[parentId].add(root);
        } else {
            this.graphics.scene.add(root);
        }

        return id;
    }

    async createMesh(meshData, filePath) {
        const THREE = window.THREE;

        if (!meshData.vertices.length || !meshData.faces.length) {
            this.log('Empty mesh data');
            return null;
        }

        // Create indexed geometry
        const geometry = new THREE.BufferGeometry();

        // Set positions
        geometry.setAttribute('position',
            new THREE.Float32BufferAttribute(meshData.vertices, 3));

        // Set indices
        geometry.setIndex(meshData.faces);

        // Set UVs if available
        if (meshData.uvs.length > 0) {
            geometry.setAttribute('uv',
                new THREE.Float32BufferAttribute(meshData.uvs, 2));
        }

        // Set normals if available, otherwise compute
        if (meshData.normals.length > 0) {
            geometry.setAttribute('normal',
                new THREE.Float32BufferAttribute(meshData.normals, 3));
        } else {
            geometry.computeVertexNormals();
        }

        // Create material
        let material;
        if (meshData.textureName) {
            // Load texture relative to X file path
            const basePath = filePath.substring(0, filePath.lastIndexOf('/') + 1);
            const texturePath = basePath + meshData.textureName;

            try {
                const textureLoader = new THREE.TextureLoader();
                const texture = await new Promise((resolve, reject) => {
                    textureLoader.load(texturePath, resolve, undefined, reject);
                });
                texture.flipY = false;
                material = new THREE.MeshStandardMaterial({
                    map: texture,
                    side: THREE.DoubleSide
                });
                this.log(`Loaded texture: ${texturePath}`);
            } catch (e) {
                this.log(`Failed to load texture: ${texturePath}`);
                material = new THREE.MeshStandardMaterial({
                    color: 0x888888,
                    side: THREE.DoubleSide
                });
            }
        } else {
            material = new THREE.MeshStandardMaterial({
                color: 0xcccccc,
                side: THREE.DoubleSide
            });
        }

        const mesh = new THREE.Mesh(geometry, material);
        mesh.userData.isXMesh = true;
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        this.log(`Created mesh: ${meshData.vertices.length / 3} verts, ${meshData.faces.length / 3} tris`);
        return mesh;
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = XLoader;
}

// Also attach to window for browser use
if (typeof window !== 'undefined') {
    window.XLoader = XLoader;
}
