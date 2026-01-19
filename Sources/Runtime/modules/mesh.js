/**
 * Blitz3D Runtime Mesh Module
 * Handles procedural mesh generation and manipulation using Three.js BufferGeometry
 */

class Blitz3DSurface {
    constructor(mesh) {
        this.mesh = mesh;
        this.vertices = []; // [x, y, z, u, v, w, r, g, b, a]
        this.indices = [];
        this.dirty = true;

        // Geometry buffers
        this.geometry = new THREE.BufferGeometry();
        this.mesh.add(new THREE.Mesh(this.geometry, new THREE.MeshBasicMaterial({
            vertexColors: true,
            side: THREE.DoubleSide
        })));
    }

    addVertex(x, y, z, u, v, w) {
        // Negate Z for Left-Handed -> Right-Handed conversion
        this.vertices.push(
            x, y, -z,
            u || 0, v || 0,
            255, 255, 255, 255 // Default color white
        );
        this.dirty = true;
        return (this.vertices.length / 9) - 1;
    }

    addTriangle(v0, v1, v2) {
        // Reverse winding order for Left-Handed -> Right-Handed
        this.indices.push(v0, v2, v1);
        this.dirty = true;
        return (this.indices.length / 3) - 1;
    }

    vertexColor(v, r, g, b, a) {
        const index = v * 9 + 5;
        if (index < this.vertices.length) {
            this.vertices[index] = r;
            this.vertices[index + 1] = g;
            this.vertices[index + 2] = b;
            this.vertices[index + 3] = a || 255;
            this.dirty = true;
        }
    }

    update() {
        if (!this.dirty) return;

        const vertexCount = this.vertices.length / 9;
        
        // Check if we have enough vertices
        if (vertexCount === 0) {
            console.log("Blitz3DSurface.update: No vertices to update");
            return;
        }

        const positions = new Float32Array(vertexCount * 3);
        const uvs = new Float32Array(vertexCount * 2);
        const colors = new Float32Array(vertexCount * 4); // r,g,b,a 0-1 range

        for (let i = 0; i < vertexCount; i++) {
            const src = i * 9;
            const dst = i * 3;
            const dstUV = i * 2;
            const dstCol = i * 4;

            positions[dst] = this.vertices[src];
            positions[dst + 1] = this.vertices[src + 1];
            positions[dst + 2] = this.vertices[src + 2];

            uvs[dstUV] = this.vertices[src + 3];
            uvs[dstUV + 1] = this.vertices[src + 4];

            colors[dstCol] = this.vertices[src + 5] / 255.0;
            colors[dstCol + 1] = this.vertices[src + 6] / 255.0;
            colors[dstCol + 2] = this.vertices[src + 7] / 255.0;
            colors[dstCol + 3] = (this.vertices[src + 8] || 255) / 255.0;
        }

        this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
        this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4));

        if (this.indices.length > 0) {
            this.geometry.setIndex(this.indices);
        }

        this.geometry.computeVertexNormals();

        // Mark for upload
        if (this.geometry.attributes.position) {
            this.geometry.attributes.position.needsUpdate = true;
        }
        if (this.geometry.attributes.uv) {
            this.geometry.attributes.uv.needsUpdate = true;
        }
        if (this.geometry.attributes.color) {
            this.geometry.attributes.color.needsUpdate = true;
        }

        this.dirty = false;
        console.log("Blitz3DSurface.update: Updated " + vertexCount + " vertices, " + (this.indices.length / 3) + " triangles");
    }
}

module.exports = { Blitz3DSurface };
