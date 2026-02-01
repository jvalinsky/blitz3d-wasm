/**
 * Simple camera for 3D rendering
 * Provides view and projection matrices
 */

export class Camera {
    // Position in world space
    position: [number, number, number] = [0, 0, -5];
    
    // Rotation (pitch, yaw) in radians
    rotation: [number, number] = [0, 0];
    
    // Projection parameters
    fov = 60; // Field of view in degrees
    near = 0.1;
    far = 1000;
    aspect = 1.0;
    
    /**
     * Get view matrix (world to camera space)
     * Simplified: just translate by negative camera position
     */
    getViewMatrix(): Float32Array {
        const mat = this.identity();
        
        // For now, just translate
        // View matrix moves world in opposite direction of camera
        mat[12] = -this.position[0];
        mat[13] = -this.position[1];
        mat[14] = -this.position[2];
        
        // TODO: Add rotation support
        // For now, camera always looks down +Z axis
        
        return mat;
    }
    
    /**
     * Get projection matrix (perspective)
     */
    getProjectionMatrix(): Float32Array {
        const mat = new Float32Array(16);
        
        const fovRad = (this.fov * Math.PI) / 180;
        const f = 1.0 / Math.tan(fovRad / 2);
        const rangeInv = 1.0 / (this.near - this.far);
        
        mat[0] = f / this.aspect;
        mat[5] = f;
        mat[10] = (this.near + this.far) * rangeInv;
        mat[11] = -1;
        mat[14] = this.near * this.far * rangeInv * 2;
        
        return mat;
    }
    
    /**
     * Get combined MVP matrix (Model-View-Projection)
     */
    getMVPMatrix(modelMatrix?: Float32Array): Float32Array {
        const view = this.getViewMatrix();
        const proj = this.getProjectionMatrix();
        
        // If no model matrix, use identity
        const model = modelMatrix || this.identity();
        
        // Multiply: proj * view * model
        const vp = this.multiply(proj, view);
        return this.multiply(vp, model);
    }
    
    /**
     * Handle mouse movement for camera rotation
     */
    handleMouseMove(dx: number, dy: number, sensitivity = 0.002): void {
        this.rotation[1] += dx * sensitivity; // yaw
        this.rotation[0] += dy * sensitivity; // pitch
        
        // Clamp pitch to avoid gimbal lock
        this.rotation[0] = Math.max(-Math.PI / 2 + 0.1, 
                                     Math.min(Math.PI / 2 - 0.1, this.rotation[0]));
    }
    
    /**
     * Update aspect ratio (call when canvas resizes)
     */
    updateAspect(width: number, height: number): void {
        this.aspect = width / height;
    }
    
    // Helper: 4x4 identity matrix
    private identity(): Float32Array {
        const mat = new Float32Array(16);
        mat[0] = 1; mat[5] = 1; mat[10] = 1; mat[15] = 1;
        return mat;
    }
    
    // Helper: multiply two 4x4 matrices
    private multiply(a: Float32Array, b: Float32Array): Float32Array {
        const result = new Float32Array(16);
        
        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 4; col++) {
                let sum = 0;
                for (let i = 0; i < 4; i++) {
                    sum += a[row * 4 + i] * b[i * 4 + col];
                }
                result[row * 4 + col] = sum;
            }
        }
        
        return result;
    }
}
