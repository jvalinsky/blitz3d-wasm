/**
 * Ultra-simple camera - proven working matrices
 * Uses standard OpenGL lookAt and perspective formulas
 */

export class SimpleCamera {
  position: [number, number, number] = [0, 0, 5];
  target: [number, number, number] = [0, 0, 0];
  up: [number, number, number] = [0, 1, 0];

  fov = 45; // degrees
  aspect = 1.0;
  near = 0.1;
  far = 20000.0; // Increased for large rooms (was 100)

  /**
   * Get MVP matrix (combines model, view, projection)
   * Model is assumed to be identity
   */
  getMVP(): Float32Array {
    const proj = this.perspective();
    const view = this.lookAt();
    return this.multiplyMat4(proj, view);
  }

  /**
   * Standard perspective projection matrix
   * https://www.khronos.org/opengl/wiki/GluPerspective_code
   */
  private perspective(): Float32Array {
    const mat = new Float32Array(16);
    const f = 1.0 / Math.tan((this.fov * Math.PI / 180) / 2.0);

    mat[0] = f / this.aspect;
    mat[1] = 0;
    mat[2] = 0;
    mat[3] = 0;

    mat[4] = 0;
    mat[5] = f;
    mat[6] = 0;
    mat[7] = 0;

    mat[8] = 0;
    mat[9] = 0;
    mat[10] = (this.far + this.near) / (this.near - this.far);
    mat[11] = -1;

    mat[12] = 0;
    mat[13] = 0;
    mat[14] = (2 * this.far * this.near) / (this.near - this.far);
    mat[15] = 0;

    return mat;
  }

  /**
   * Standard lookAt view matrix
   * https://www.khronos.org/opengl/wiki/GluLookAt_code
   */
  private lookAt(): Float32Array {
    const eye = this.position;
    const center = this.target;
    const up = this.up;

    // Forward = normalize(center - eye)
    const fx = center[0] - eye[0];
    const fy = center[1] - eye[1];
    const fz = center[2] - eye[2];
    const flen = Math.sqrt(fx * fx + fy * fy + fz * fz);
    const f = [fx / flen, fy / flen, fz / flen];

    // Side = normalize(f × up)
    const sx = f[1] * up[2] - f[2] * up[1];
    const sy = f[2] * up[0] - f[0] * up[2];
    const sz = f[0] * up[1] - f[1] * up[0];
    const slen = Math.sqrt(sx * sx + sy * sy + sz * sz);
    const s = [sx / slen, sy / slen, sz / slen];

    // Up = s × f
    const ux = s[1] * f[2] - s[2] * f[1];
    const uy = s[2] * f[0] - s[0] * f[2];
    const uz = s[0] * f[1] - s[1] * f[0];

    const mat = new Float32Array(16);

    mat[0] = s[0];
    mat[1] = ux;
    mat[2] = -f[0];
    mat[3] = 0;

    mat[4] = s[1];
    mat[5] = uy;
    mat[6] = -f[1];
    mat[7] = 0;

    mat[8] = s[2];
    mat[9] = uz;
    mat[10] = -f[2];
    mat[11] = 0;

    mat[12] = -(s[0] * eye[0] + s[1] * eye[1] + s[2] * eye[2]);
    mat[13] = -(ux * eye[0] + uy * eye[1] + uz * eye[2]);
    mat[14] = f[0] * eye[0] + f[1] * eye[1] + f[2] * eye[2];
    mat[15] = 1;

    return mat;
  }

  /**
   * Multiply two 4x4 matrices (column-major order)
   */
  private multiplyMat4(a: Float32Array, b: Float32Array): Float32Array {
    const result = new Float32Array(16);

    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        result[i * 4 + j] = a[0 * 4 + j] * b[i * 4 + 0] +
          a[1 * 4 + j] * b[i * 4 + 1] +
          a[2 * 4 + j] * b[i * 4 + 2] +
          a[3 * 4 + j] * b[i * 4 + 3];
      }
    }

    return result;
  }

  /**
   * Rotate camera around target by mouse drag
   */
  rotateAroundTarget(dx: number, dy: number, sensitivity = 0.005): void {
    // Calculate current position relative to target
    const rx = this.position[0] - this.target[0];
    const ry = this.position[1] - this.target[1];
    const rz = this.position[2] - this.target[2];
    const radius = Math.sqrt(rx * rx + ry * ry + rz * rz);

    // Spherical coordinates
    let theta = Math.atan2(rx, rz); // azimuth
    let phi = Math.acos(ry / radius); // elevation

    // Apply rotation
    theta -= dx * sensitivity;
    phi -= dy * sensitivity;

    // Clamp phi to avoid gimbal lock
    phi = Math.max(0.1, Math.min(Math.PI - 0.1, phi));

    // Convert back to Cartesian
    this.position[0] = this.target[0] +
      radius * Math.sin(phi) * Math.sin(theta);
    this.position[1] = this.target[1] + radius * Math.cos(phi);
    this.position[2] = this.target[2] +
      radius * Math.sin(phi) * Math.cos(theta);
  }
}
