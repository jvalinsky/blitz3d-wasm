/**
 * DirectX X Mesh Loader (Recursive Descent)
 * Parses text-format DirectX .x files and creates Three.js objects
 * Supports Frame hierarchy and Transforms.
 */

class XLoader {
    constructor(graphics, core, fileIO) {
        this.graphics = graphics;
        this.core = core;
        this.fileIO = fileIO;
        this.debug = true;
        this.basePath = '';
    }

    log(...args) {
        if (this.debug) console.log('[XLoader]', ...args);
    }

    /**
     * Load an X file and return a Three.js entity ID
     */
    async loadFile(filePath, parentId = 0) {
        this.log(`Loading: ${filePath}`);
        this.basePath = filePath.substring(0, filePath.lastIndexOf('/') + 1);

        try {
            const data = await this.fetchFile(filePath);
            if (!data) return 0;

            // Parse objects
            const root = await this.parseXFile(data);
            if (!root) return 0;

            root.name = filePath.split('/').pop();

            // Register with graphics system
            const id = this.graphics.nextEntityId++;
            this.graphics.entities[id] = root;

            // Add to parent or scene
            if (parentId && this.graphics.entities[parentId]) {
                this.graphics.entities[parentId].add(root);
            } else {
                this.graphics.scene.add(root);
            }

            this.log(`Loaded entity: ${id}`);
            return id;

        } catch (error) {
            console.error(`[XLoader] Error loading ${filePath}:`, error);
            return 0;
        }
    }

    async fetchFile(filePath) {
        if (this.fileIO && this.fileIO.readFile) {
            const data = await this.fileIO.readFile(filePath);
            if (data) return new TextDecoder().decode(data);
        }
        try {
            const response = await fetch(filePath);
            if (response.ok) return await response.text();
        } catch (e) {
            this.log(`Fetch failed: ${e.message}`);
        }
        return null;
    }

    /* --- Parsing Logic --- */

    async parseXFile(content) {
        // Simple Tokenizer
        const tokens = this.tokenize(content);
        if (!tokens.length) return null;

        // Check Header
        if (!tokens[0].match(/^xof/i)) {
            throw new Error("Invalid X File Header");
        }

        const parser = new XParser(tokens, this.graphics, this.basePath, this);
        return await parser.parse();
    }

    tokenize(content) {
        // Remove comments
        const clean = content.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

        // Split by whitespace and special chars { } ; ,
        // We keep special chars as separate tokens
        // regex: match alphanumeric+ OR string literals OR single special chars
        const regex = /"([^"]*)"|[a-zA-Z0-9_\-\.]+|[\{\};,]/g;

        const tokens = [];
        let match;
        while ((match = regex.exec(clean)) !== null) {
            if (match[1] !== undefined) {
                // String literal (without quotes)
                tokens.push({ type: 'string', value: match[1] });
            } else {
                // Keyword or symbol
                tokens.push({ type: 'token', value: match[0] });
            }
        }
        return tokens;
    }
}

class XParser {
    constructor(tokens, graphics, basePath, loader) {
        this.tokens = tokens;
        this.cursor = 0;
        this.graphics = graphics;
        this.basePath = basePath;
        this.loader = loader;
        this.THREE = window.THREE;
    }

    peek() {
        return this.tokens[this.cursor];
    }

    consume() {
        return this.tokens[this.cursor++];
    }

    expect(val) {
        const t = this.consume();
        if ((t.value || t) !== val) {
            console.warn(`Expected '${val}', got '${t.value || t}' at token ${this.cursor}`);
        }
    }

    async parse() {
        // Skip header tokens until we hit a template or object
        // 0: xof, 1: 0303txt, 2: 0032
        this.cursor = 3;

        const rootGroup = new this.THREE.Group();

        while (this.cursor < this.tokens.length) {
            const t = this.peek();
            if (!t) break;

            if (t.value === 'template') {
                this.skipBlock();
            } else if (t.value === 'Frame') {
                const frame = await this.parseFrame();
                rootGroup.add(frame);
            } else if (t.value === 'Mesh') {
                const mesh = await this.parseMesh();
                if (mesh) rootGroup.add(mesh);
            } else {
                // Unknown top level block or closing brace
                if (t.value === '}') {
                    this.consume(); // End of something
                } else {
                    this.skipBlock(); // catch-all
                }
            }
        }

        return rootGroup;
    }

    async parseFrame() {
        this.consume(); // 'Frame'
        let name = "";
        if (this.peek().type !== 'token' || this.peek().value !== '{') {
            name = this.consume().value; // Name
        }
        this.expect('{');

        const group = new this.THREE.Group();
        group.name = name;

        while (this.cursor < this.tokens.length) {
            const t = this.peek();
            if (t.value === '}') {
                this.consume();
                break;
            }

            if (t.value === 'FrameTransformMatrix') {
                this.parseTransformMatrix(group);
            } else if (t.value === 'Frame') {
                const child = await this.parseFrame();
                group.add(child);
            } else if (t.value === 'Mesh') {
                const mesh = await this.parseMesh();
                if (mesh) group.add(mesh);
            } else {
                this.skipBlock();
            }
        }
        return group;
    }

    parseTransformMatrix(object) {
        this.consume(); // FrameTransformMatrix
        this.expect('{');

        const m = new this.THREE.Matrix4();
        const elements = [];

        for (let i = 0; i < 16; i++) {
            elements.push(parseFloat(this.consume().value));
            // skip separators
            const sep = this.peek().value;
            if (sep === ',' || sep === ';') this.consume();
        }

        // Last one might be followed by ;;
        while (this.peek().value === ';') this.consume();
        this.expect('}');

        m.set(...elements); // default is row-major via set? No, Three.js is row-major in set(), X is likely row-major too

        // Decompose to Position/Rotation/Scale to allow future manipulation
        // or just apply matrix. Three.js prefers decomposition.
        m.decompose(object.position, object.quaternion, object.scale);
    }

    async parseMesh() {
        this.consume(); // Mesh
        const name = (this.peek().value !== '{') ? this.consume().value : '';
        this.expect('{');

        // Vertex Count
        const numVerts = parseInt(this.consume().value);
        this.expect(';');

        const vertices = [];
        for (let i = 0; i < numVerts; i++) {
            const x = parseFloat(this.consume().value); this.consume(); // ; or ,
            const y = parseFloat(this.consume().value); this.consume(); // ; or ,
            const z = parseFloat(this.consume().value); this.consume(); // ; or , or ;;
            vertices.push(x, y, z);
            // handle separator
            if (this.peek().value === ',' || this.peek().value === ';') this.consume();
        }

        // Face Count
        const numFaces = parseInt(this.consume().value);
        this.expect(';');

        const indices = []; // flattened triangles

        for (let i = 0; i < numFaces; i++) {
            const nConfigIds = parseInt(this.consume().value);
            this.expect(';');

            const faceIndices = [];
            for (let j = 0; j < nConfigIds; j++) {
                faceIndices.push(parseInt(this.consume().value));
                if (j < nConfigIds - 1) this.consume(); // ,
            }
            this.consume(); // ; or , or ;;
            if (this.peek().value === ',' || this.peek().value === ';') this.consume();

            // Triangulate fan
            for (let k = 1; k < faceIndices.length - 1; k++) {
                indices.push(faceIndices[0], faceIndices[k], faceIndices[k + 1]);
            }
        }

        // Inner data
        let uvs = [];
        let normals = [];
        let textureName = null;

        while (this.peek().value !== '}') {
            const t = this.peek();
            if (t.value === 'MeshTextureCoords') {
                uvs = this.parseTextureCoords();
            } else if (t.value === 'MeshNormals') {
                normals = this.parseNormals();
            } else if (t.value === 'MeshMaterialList') {
                textureName = this.parseMaterialList();
            } else {
                this.skipBlock();
            }
        }
        this.consume(); // }

        return await this.createThreeBox(vertices, indices, uvs, normals, textureName);
    }

    parseTextureCoords() {
        this.consume(); // MeshTextureCoords
        this.expect('{');
        const count = parseInt(this.consume().value);
        this.expect(';');

        const uvs = [];
        for (let i = 0; i < count; i++) {
            uvs.push(parseFloat(this.consume().value)); this.consume();
            uvs.push(parseFloat(this.consume().value)); this.consume();
            if (this.peek().value === ',' || this.peek().value === ';') this.consume();
        }
        this.expect('}');
        return uvs;
    }

    parseNormals() {
        this.consume(); // MeshNormals
        this.expect('{');
        const count = parseInt(this.consume().value);
        this.expect(';');

        const normals = [];
        for (let i = 0; i < count; i++) {
            normals.push(parseFloat(this.consume().value)); this.consume();
            normals.push(parseFloat(this.consume().value)); this.consume();
            normals.push(parseFloat(this.consume().value)); this.consume();
            if (this.peek().value === ',' || this.peek().value === ';') this.consume();
        }

        // Skip face normal indices block if present
        // Normal count usually matches vertex count, followed by face indices
        // Actually .x format has a second count for face definitions mapping to normals
        if (this.peek().value !== '}') {
            const faceCount = parseInt(this.consume().value);
            this.expect(';');
            for (let i = 0; i < faceCount; i++) {
                // Skip entire face definition line: n; a,b,c;;
                while (this.peek().value !== ';' && this.peek().value !== '}') this.consume();
                if (this.peek().value === ';') this.consume();
                if (this.peek().value === ',') this.consume();
            }
        }

        this.expect('}');
        return normals;
    }

    parseMaterialList() {
        this.consume(); // MeshMaterialList
        this.expect('{');
        let texName = null;

        this.consume(); // nMaterials
        this.expect(';');
        this.consume(); // nFaceIndices
        this.expect(';');

        // Skip indices
        while (this.peek().value !== ';' && this.peek().value !== 'Material' && this.peek().value !== '}') {
            this.consume();
        }
        if (this.peek().value === ';') this.consume();

        // Find Material block
        while (this.peek().value !== '}') {
            if (this.peek().value === 'Material') {
                // Enter material
                this.consume();
                this.expect('{');
                // Skip colors until TextureFilename or }
                while (this.peek().value !== '}' && this.peek().value !== 'TextureFilename') this.consume();

                if (this.peek().value === 'TextureFilename') {
                    this.consume();
                    this.expect('{');
                    if (this.peek().type === 'string') {
                        texName = this.consume().value;
                    }
                    this.expect(';');
                    this.expect('}');
                }
                // Finish material
                while (this.peek().value !== '}') this.consume();
                this.consume(); // }
            } else {
                this.consume();
            }
        }

        this.expect('}');
        return texName;
    }

    skipBlock() {
        // consumes Name { ... }
        // or just { ... } if name already consumed
        let depth = 0;
        let started = false;

        while (this.cursor < this.tokens.length) {
            const t = this.consume();
            if (t.value === '{') {
                depth++;
                started = true;
            }
            else if (t.value === '}') {
                depth--;
                if (started && depth === 0) return;
            }
            // If we haven't seen an opening brace yet, we are just skipping the header/name
        }
    }

    async createThreeBox(vertices, indices, uvs, normals, textureName) {
        const geometry = new this.THREE.BufferGeometry();
        geometry.setAttribute('position', new this.THREE.Float32BufferAttribute(vertices, 3));
        geometry.setIndex(indices);
        if (uvs.length) geometry.setAttribute('uv', new this.THREE.Float32BufferAttribute(uvs, 2));
        if (normals.length) geometry.setAttribute('normal', new this.THREE.Float32BufferAttribute(normals, 3));
        else geometry.computeVertexNormals();

        let material;
        if (textureName) {
            const texturePath = this.basePath + textureName;
            try {
                const loader = new this.THREE.TextureLoader();
                const tex = await loader.loadAsync(texturePath);
                tex.flipY = false; // DirectX coords usually match
                material = new this.THREE.MeshStandardMaterial({ map: tex });
            } catch (e) {
                console.warn("Tex fail", e);
                material = new this.THREE.MeshStandardMaterial({ color: 0x888888 });
            }
        } else {
            material = new this.THREE.MeshStandardMaterial({ color: 0xcccccc });
        }

        const mesh = new this.THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
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
