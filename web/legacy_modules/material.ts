/**
 * Blitz3D Material System
 * Creates and manages materials with texture support matching Blitz3D behavior
 */

class Blitz3DMaterial {
    constructor(graphics) {
        this.graphics = graphics;
        this.materials = new Map();
        this.nextMaterialId = 1;
        
        // Material properties
        this.defaultColor = new THREE.Color(0xffffff);
        this.defaultAmbient = new THREE.Color(0x404040);
        this.defaultEmissive = new THREE.Color(0x000000);
        this.defaultSpecular = new THREE.Color(0x111111);
        this.defaultShininess = 30;
    }

    /**
     * Create a brush (material)
     * @returns {number} Material ID
     */
    createBrush() {
        const id = this.nextMaterialId++;
        
        const brush = {
            id: id,
            color: this.defaultColor.clone(),
            ambient: this.defaultAmbient.clone(),
            emissive: this.defaultEmissive.clone(),
            specular: this.defaultSpecular.clone(),
            shininess: this.defaultShininess,
            textures: [null, null],  // Two texture units
            blendMode: 0,  // 0=replace, 1=add, 2=alpha, 3=multiply, 5=blend
            faceCull: true,
            depthWrite: true,
            depthTest: true,
            wireframe: false,
            fog: true
        };
        
        this.materials.set(id, brush);
        console.log(`[Material] Created brush ${id}`);
        return id;
    }

    /**
     * Set brush color
     */
    brushColor(brushId, r, g, b) {
        const brush = this.materials.get(brushId);
        if (brush) {
            brush.color.setRGB(r / 255, g / 255, b / 255);
        }
    }

    /**
     * Set brush ambient color
     */
    brushAmbient(brushId, r, g, b) {
        const brush = this.materials.get(brushId);
        if (brush) {
            brush.ambient.setRGB(r / 255, g / 255, b / 255);
        }
    }

    /**
     * Set brush emissive color
     */
    brushEmissive(brushId, r, g, b) {
        const brush = this.materials.get(brushId);
        if (brush) {
            brush.emissive.setRGB(r / 255, g / 255, b / 255);
        }
    }

    /**
     * Add texture to brush
     * @param {number} brushId - Brush ID
     * @param {number} texId - Texture ID (from graphics.textures)
     * @param {number} frame - Frame number for animation (0-3)
     * @param {number} index - Texture index (0 or 1 for multi-texture)
     */
    brushTexture(brushId, texId, frame = 0, index = 0) {
        const brush = this.materials.get(brushId);
        if (brush && index >= 0 && index < 2) {
            const texture = this.graphics.textures[texId];
            if (texture) {
                brush.textures[index] = texture;
                console.log(`[Material] Brush ${brushId} texture ${index} = ${texId}`);
            }
        }
    }

    /**
     * Set brush blend mode
     * @param {number} brushId - Brush ID
     * @param {number} blend - Blend mode (0-7)
     */
    brushBlend(brushId, blend) {
        const brush = this.materials.get(brushId);
        if (brush) {
            brush.blendMode = blend;
        }
    }

    /**
     * Set brush shininess
     */
    brushShininess(brushId, shininess) {
        const brush = this.materials.get(brushId);
        if (brush) {
            brush.shininess = shininess;
        }
    }

    /**
     * Set brush flags
     * @param {number} brushId - Brush ID
     * @param {number} flags - Blitz3D brush flags
     */
    brushFlags(brushId, flags) {
        const brush = this.materials.get(brushId);
        if (brush) {
            brush.faceCull = !(flags & 1);  // FLIP flag
            brush.depthWrite = !(flags & 2);  // NODEPTHWRITE flag
            brush.depthTest = !(flags & 4);  // NODEPTHTEST flag
            brush.fog = !(flags & 8);  // FOG flag
            brush.wireframe = !!(flags & 16);  // WIREFRAME flag
        }
    }

    /**
     * Paint a surface with a brush
     * @param {number} surfaceId - Surface ID
     * @param {number} brushId - Brush ID
     */
    paintSurface(surfaceId, brushId) {
        const surface = this.graphics.surfaces[surfaceId];
        const brush = this.materials.get(brushId);
        
        if (surface && brush) {
            const material = this.createMaterialFromBrush(brush);
            surface.material = material;
            console.log(`[Material] Painted surface ${surfaceId} with brush ${brushId}`);
            return 1;
        }
        return 0;
    }

    /**
     * Create Three.js material from brush
     */
    createMaterialFromBrush(brush) {
        let material;
        
        // Choose material type based on blend mode
        switch (brush.blendMode) {
            case 0:  // Replace
            default:
                material = new THREE.MeshPhongMaterial({
                    color: brush.color,
                    ambient: brush.ambient,
                    emissive: brush.emissive,
                    specular: brush.specular,
                    shininess: brush.shininess,
                    map: brush.textures[0],
                    lightMap: brush.textures[1],  // Lightmap on second texture unit
                    side: brush.faceCull ? THREE.FrontSide : THREE.DoubleSide,
                    depthWrite: brush.depthWrite,
                    depthTest: brush.depthTest,
                    wireframe: brush.wireframe,
                    fog: brush.fog
                });
                break;
                
            case 1:  // Add
                material = new THREE.MeshBasicMaterial({
                    color: brush.color,
                    map: brush.textures[0],
                    transparent: true,
                    blending: THREE.AdditiveBlending,
                    side: brush.faceCull ? THREE.FrontSide : THREE.DoubleSide
                });
                break;
                
            case 2:  // Alpha
                material = new THREE.MeshPhongMaterial({
                    color: brush.color,
                    ambient: brush.ambient,
                    map: brush.textures[0],
                    transparent: true,
                    opacity: 0.5,
                    side: brush.faceCull ? THREE.FrontSide : THREE.DoubleSide,
                    depthWrite: false
                });
                break;
                
            case 3:  // Multiply (lightmap)
                material = new THREE.MeshPhongMaterial({
                    color: brush.color,
                    ambient: new THREE.Color(0xffffff),
                    map: brush.textures[0],
                    lightMap: brush.textures[1],
                    side: brush.faceCull ? THREE.FrontSide : THREE.DoubleSide
                });
                break;
                
            case 5:  // Blend
                material = new THREE.MeshPhongMaterial({
                    color: brush.color,
                    ambient: brush.ambient,
                    map: brush.textures[0],
                    transparent: true,
                    opacity: 0.7,
                    side: brush.faceCull ? THREE.FrontSide : THREE.DoubleSide
                });
                break;
        }
        
        // Apply textures
        if (brush.textures[0]) {
            material.map = brush.textures[0];
        }
        if (brush.textures[1]) {
            material.lightMap = brush.textures[1];
        }
        
        return material;
    }

    /**
     * Free a brush
     */
    freeBrush(brushId) {
        const brush = this.materials.get(brushId);
        if (brush) {
            // Dispose textures if no longer needed
            // (In a full implementation, track texture reference counts)
            this.materials.delete(brushId);
            console.log(`[Material] Freed brush ${brushId}`);
            return 1;
        }
        return 0;
    }

    /**
     * Get brush count
     */
    getBrushCount() {
        return this.materials.size;
    }

    /**
     * Set up WASM imports
     */
    setupImports(imports) {
        imports.env.CreateBrush = () => this.createBrush();
        
        imports.env.BrushColor = (brush, r, g, b) => {
            this.brushColor(brush, r, g, b);
        };
        
        imports.env.BrushAmbient = (brush, r, g, b) => {
            this.brushAmbient(brush, r, g, b);
        };
        
        imports.env.BrushEmissive = (brush, r, g, b) => {
            this.brushEmissive(brush, r, g, b);
        };
        
        imports.env.BrushTexture = (brush, tex, frame, index) => {
            this.brushTexture(brush, tex, frame, index);
        };
        
        imports.env.BrushBlend = (brush, blend) => {
            this.brushBlend(brush, blend);
        };
        
        imports.env.BrushShininess = (brush, shininess) => {
            this.brushShininess(brush, shininess);
        };
        
        imports.env.BrushFlags = (brush, flags) => {
            this.brushFlags(brush, flags);
        };
        
        imports.env.PaintSurface = (surface, brush) => {
            return this.paintSurface(surface, brush);
        };
        
        imports.env.FreeBrush = (brush) => {
            return this.freeBrush(brush);
        };
        
        imports.env.GetBrushColor = (brush) => {
            const b = this.materials.get(brush);
            if (b) {
                return (b.color.r * 255) | ((b.color.g * 255) << 8) | ((b.color.b * 255) << 16);
            }
            return 0;
        };
    }
}

module.exports = Blitz3DMaterial;
