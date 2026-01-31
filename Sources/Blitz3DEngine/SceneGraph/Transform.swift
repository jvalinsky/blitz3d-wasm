

/// 4x4 column-major matrix for transforms.
/// Stored as 16 contiguous Floats in column-major order (OpenGL convention).
public struct Mat4: Sendable {
    public var m: (
        Float, Float, Float, Float,  // column 0
        Float, Float, Float, Float,  // column 1
        Float, Float, Float, Float,  // column 2
        Float, Float, Float, Float   // column 3
    )

    public static let identity = Mat4(
        m: (1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1)
    )

    public init() { self = .identity }

    public init(m: (Float,Float,Float,Float,
                     Float,Float,Float,Float,
                     Float,Float,Float,Float,
                     Float,Float,Float,Float)) {
        self.m = m
    }

    /// Element access: column c, row r (0-based).
    @inline(__always)
    public subscript(column c: Int, row r: Int) -> Float {
        get {
            withUnsafePointer(to: m) { ptr in
                ptr.withMemoryRebound(to: Float.self, capacity: 16) { p in
                    p[c * 4 + r]
                }
            }
        }
        set {
            withUnsafeMutablePointer(to: &m) { ptr in
                ptr.withMemoryRebound(to: Float.self, capacity: 16) { p in
                    p[c * 4 + r] = newValue
                }
            }
        }
    }

    /// Write the 16 floats into a contiguous buffer (for WASM export).
    public func write(to ptr: UnsafeMutablePointer<Float>) {
        withUnsafePointer(to: m) { src in
            src.withMemoryRebound(to: Float.self, capacity: 16) { s in
                for i in 0..<16 { ptr[i] = s[i] }
            }
        }
    }

    // MARK: - Factory methods

    public static func translation(_ x: Float, _ y: Float, _ z: Float) -> Mat4 {
        var r = Mat4.identity
        r[column: 3, row: 0] = x
        r[column: 3, row: 1] = y
        r[column: 3, row: 2] = z
        return r
    }

    public static func scale(_ sx: Float, _ sy: Float, _ sz: Float) -> Mat4 {
        var r = Mat4.identity
        r[column: 0, row: 0] = sx
        r[column: 1, row: 1] = sy
        r[column: 2, row: 2] = sz
        return r
    }

    /// Rotation from Euler angles (degrees) in Blitz3D order: pitch, yaw, roll.
    /// Blitz3D applies: R = Ry(yaw) * Rx(pitch) * Rz(roll)
    public static func rotationEuler(pitch: Float, yaw: Float, roll: Float) -> Mat4 {
        let px: Float = pitch * Float.pi / 180.0
        let py: Float = yaw * Float.pi / 180.0
        let pz: Float = roll * Float.pi / 180.0

        let cx: Float = cos(px); let sx: Float = sin(px)
        let cy: Float = cos(py); let sy: Float = sin(py)
        let cz: Float = cos(pz); let sz: Float = sin(pz)

        // Ry * Rx * Rz
        let m00: Float = cy * cz + sy * sx * sz
        let m10: Float = cx * sz
        let m20: Float = -sy * cz + cy * sx * sz

        let m01: Float = -cy * sz + sy * sx * cz
        let m11: Float = cx * cz
        let m21: Float = sy * sz + cy * sx * cz

        let m02: Float = sy * cx
        let m12: Float = -sx
        let m22: Float = cy * cx

        return Mat4(m: (
            m00, m10, m20, 0,
            m01, m11, m21, 0,
            m02, m12, m22, 0,
            0, 0, 0, 1
        ))
    }

    /// Perspective projection matrix.
    public static func perspective(fovY: Float, aspect: Float, near: Float, far: Float) -> Mat4 {
        let f: Float = 1.0 / tan(fovY * Float.pi / 360.0) // fovY in degrees
        let nf: Float = 1.0 / (near - far)
        return Mat4(m: (
            f / aspect, 0, 0, 0,
            0, f, 0, 0,
            0, 0, (far + near) * nf, -1,
            0, 0, 2.0 * far * near * nf, 0
        ))
    }

    /// Look-at view matrix.
    public static func lookAt(eye: Vec3, center: Vec3, up: Vec3) -> Mat4 {
        let f = (center - eye).normalized
        let s = Vec3.cross(f, up).normalized
        let u = Vec3.cross(s, f)

        return Mat4(m: (
            s.x, u.x, -f.x, 0,
            s.y, u.y, -f.y, 0,
            s.z, u.z, -f.z, 0,
            -Vec3.dot(s, eye), -Vec3.dot(u, eye), Vec3.dot(f, eye), 1
        ))
    }

    // MARK: - Multiply

    public static func * (a: Mat4, b: Mat4) -> Mat4 {
        var r = Mat4()
        for c in 0..<4 {
            for rr in 0..<4 {
                var sum: Float = 0
                for k in 0..<4 {
                    sum += a[column: k, row: rr] * b[column: c, row: k]
                }
                r[column: c, row: rr] = sum
            }
        }
        return r
    }

    /// Extract the upper-left 3x3 as 9 floats (for normal matrix uniform).
    public func upperLeft3x3(to ptr: UnsafeMutablePointer<Float>) {
        ptr[0] = self[column: 0, row: 0]
        ptr[1] = self[column: 0, row: 1]
        ptr[2] = self[column: 0, row: 2]
        ptr[3] = self[column: 1, row: 0]
        ptr[4] = self[column: 1, row: 1]
        ptr[5] = self[column: 1, row: 2]
        ptr[6] = self[column: 2, row: 0]
        ptr[7] = self[column: 2, row: 1]
        ptr[8] = self[column: 2, row: 2]
    }
}

/// Quaternion for rotation representation (used internally for slerp).
public struct Quat: Sendable {
    public var x: Float
    public var y: Float
    public var z: Float
    public var w: Float

    public static let identity = Quat(x: 0, y: 0, z: 0, w: 1)

    public init(x: Float = 0, y: Float = 0, z: Float = 0, w: Float = 1) {
        self.x = x; self.y = y; self.z = z; self.w = w
    }

    /// Create from Euler angles (degrees) using Blitz3D order Ry*Rx*Rz.
    public init(pitch: Float, yaw: Float, roll: Float) {
        let px: Float = pitch * Float.pi / 360.0  // half angles
        let py: Float = yaw * Float.pi / 360.0
        let pz: Float = roll * Float.pi / 360.0

        let cx: Float = cos(px); let sx: Float = sin(px)
        let cy: Float = cos(py); let sy: Float = sin(py)
        let cz: Float = cos(pz); let sz: Float = sin(pz)

        self.w = cy * cx * cz + sy * sx * sz
        self.x = cy * sx * cz + sy * cx * sz
        self.y = sy * cx * cz - cy * sx * sz
        self.z = cy * cx * sz - sy * sx * cz
    }

    public var length: Float { sqrt(x*x + y*y + z*z + w*w) }

    public var normalized: Quat {
        let len = length
        guard len > 0 else { return .identity }
        return Quat(x: x/len, y: y/len, z: z/len, w: w/len)
    }

    public func toMat4() -> Mat4 {
        let xx = x*x, yy = y*y, zz = z*z
        let xy = x*y, xz = x*z, yz = y*z
        let wx = w*x, wy = w*y, wz = w*z

        return Mat4(m: (
            1 - 2*(yy+zz), 2*(xy+wz), 2*(xz-wy), 0,
            2*(xy-wz), 1 - 2*(xx+zz), 2*(yz+wx), 0,
            2*(xz+wy), 2*(yz-wx), 1 - 2*(xx+yy), 0,
            0, 0, 0, 1
        ))
    }

    /// Spherical linear interpolation.
    public static func slerp(_ a: Quat, _ b: Quat, t: Float) -> Quat {
        var bq = b
        var dot: Float = a.x*b.x + a.y*b.y + a.z*b.z + a.w*b.w
        if dot < 0 {
            bq = Quat(x: -b.x, y: -b.y, z: -b.z, w: -b.w)
            dot = -dot
        }
        if dot > 0.9995 {
            // Linear interpolation for very close quaternions
            return Quat(
                x: a.x + t * (bq.x - a.x),
                y: a.y + t * (bq.y - a.y),
                z: a.z + t * (bq.z - a.z),
                w: a.w + t * (bq.w - a.w)
            ).normalized
        }
        let theta: Float = acos(dot)
        let sinTheta: Float = sin(theta)
        let wa: Float = sin((1 - t) * theta) / sinTheta
        let wb: Float = sin(t * theta) / sinTheta
        return Quat(
            x: wa * a.x + wb * bq.x,
            y: wa * a.y + wb * bq.y,
            z: wa * a.z + wb * bq.z,
            w: wa * a.w + wb * bq.w
        )
    }
}
