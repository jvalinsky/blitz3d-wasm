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
   * Simple lookAt-style matrix
   */
  getViewMatrix(): Float32Array {
    // For now, simplified: camera at position, looking at origin
    const eye = this.position;
    const center = [0, 0, 0]; // Look at origin
    const up = [0, 1, 0]; // Y is up

    // Calculate forward, right, up vectors
    const f = [
      center[0] - eye[0],
      center[1] - eye[1],
      center[2] - eye[2],
    ];
    const fLen = Math.sqrt(f[0] * f[0] + f[1] * f[1] + f[2] * f[2]);
    f[0] /= fLen;
    f[1] /= fLen;
    f[2] /= fLen;

    // Right = f × up
    const r = [
      f[1] * up[2] - f[2] * up[1],
      f[2] * up[0] - f[0] * up[2],
      f[0] * up[1] - f[1] * up[0],
    ];
    const rLen = Math.sqrt(r[0] * r[0] + r[1] * r[1] + r[2] * r[2]);
    r[0] /= rLen;
    r[1] /= rLen;
    r[2] /= rLen;

    // Up = r × f
    const u = [
      r[1] * f[2] - r[2] * f[1],
      r[2] * f[0] - r[0] * f[2],
      r[0] * f[1] - r[1] * f[0],
    ];

    // Build view matrix (row-major)
    const mat = new Float32Array(16);
    mat[0] = r[0];
    mat[1] = u[0];
    mat[2] = -f[0];
    mat[3] = 0;
    mat[4] = r[1];
    mat[5] = u[1];
    mat[6] = -f[1];
    mat[7] = 0;
    mat[8] = r[2];
    mat[9] = u[2];
    mat[10] = -f[2];
    mat[11] = 0;
    mat[12] = -(r[0] * eye[0] + r[1] * eye[1] + r[2] * eye[2]);
    mat[13] = -(u[0] * eye[0] + u[1] * eye[1] + u[2] * eye[2]);
    mat[14] = f[0] * eye[0] + f[1] * eye[1] + f[2] * eye[2];
    mat[15] = 1;

    return mat;
  }

  /**
   * Get projection matrix (perspective)
   */
  getProjectionMatrix(): Float32Array {
    const mat = new Float32Array(16);

    const fovRad = (this.fov * Math.PI) / 180;
    const f = 1.0 / Math.tan(fovRad / 2);
    const nf = 1.0 / (this.near - this.far);

    mat[0] = f / this.aspect;
    mat[5] = f;
    mat[10] = (this.far + this.near) * nf;
    mat[11] = -1;
    mat[14] = 2 * this.far * this.near * nf;

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
    this.rotation[0] = Math.max(
      -Math.PI / 2 + 0.1,
      Math.min(Math.PI / 2 - 0.1, this.rotation[0]),
    );
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
    mat[0] = 1;
    mat[5] = 1;
    mat[10] = 1;
    mat[15] = 1;
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
