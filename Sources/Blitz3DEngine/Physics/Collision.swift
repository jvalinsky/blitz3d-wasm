import Foundation

public struct Vec3: Sendable {
    public var x: Float
    public var y: Float
    public var z: Float

    @inline(__always)
    public init(x: Float = 0, y: Float = 0, z: Float = 0) {
        self.x = x
        self.y = y
        self.z = z
    }

    @inline(__always)
    public static func + (lhs: Vec3, rhs: Vec3) -> Vec3 {
        Vec3(x: lhs.x + rhs.x, y: lhs.y + rhs.y, z: lhs.z + rhs.z)
    }

    @inline(__always)
    public static func - (lhs: Vec3, rhs: Vec3) -> Vec3 {
        Vec3(x: lhs.x - rhs.x, y: lhs.y - rhs.y, z: lhs.z - rhs.z)
    }

    @inline(__always)
    public static func * (lhs: Vec3, rhs: Float) -> Vec3 {
        Vec3(x: lhs.x * rhs, y: lhs.y * rhs, z: lhs.z * rhs)
    }

    @inline(__always)
    public var length: Float {
        sqrt(x * x + y * y + z * z)
    }

    @inline(__always)
    public var normalized: Vec3 {
        let len = length
        guard len > 0 else { return Vec3() }
        return Vec3(x: x / len, y: y / len, z: z / len)
    }

    @inline(__always)
    public static func dot(_ lhs: Vec3, _ rhs: Vec3) -> Float {
        lhs.x * rhs.x + lhs.y * rhs.y + lhs.z * rhs.z
    }

    @inline(__always)
    public static func cross(_ lhs: Vec3, _ rhs: Vec3) -> Vec3 {
        Vec3(
            x: lhs.y * rhs.z - lhs.z * rhs.y,
            y: lhs.z * rhs.x - lhs.x * rhs.z,
            z: lhs.x * rhs.y - lhs.y * rhs.x
        )
    }
}

public struct AABB: Sendable {
    public var min: Vec3
    public var max: Vec3

    @inline(__always)
    public init(
        min: Vec3 = Vec3(x: Float.greatestFiniteMagnitude),
        max: Vec3 = Vec3(x: -Float.greatestFiniteMagnitude)
    ) {
        self.min = min
        self.max = max
    }

    @inline(__always)
    public func contains(_ point: Vec3) -> Bool {
        point.x >= min.x && point.x <= max.x && point.y >= min.y && point.y <= max.y
            && point.z >= min.z && point.z <= max.z
    }

    @inline(__always)
    public func intersects(_ other: AABB) -> Bool {
        min.x <= other.max.x && max.x >= other.min.x && min.y <= other.max.y && max.y >= other.min.y
            && min.z <= other.max.z && max.z >= other.min.z
    }
}

public struct Sphere {
    public var center: Vec3
    public var radius: Float

    @inline(__always)
    public init(center: Vec3, radius: Float) {
        self.center = center
        self.radius = radius
    }

    @inline(__always)
    public func intersects(_ other: Sphere) -> Bool {
        let d = center - other.center
        let distSq = d.x * d.x + d.y * d.y + d.z * d.z
        let radSum = radius + other.radius
        return distSq <= radSum * radSum
    }
}

public struct Capsule {
    public var pointA: Vec3
    public var pointB: Vec3
    public var radius: Float

    @inline(__always)
    public init(pointA: Vec3, pointB: Vec3, radius: Float) {
        self.pointA = pointA
        self.pointB = pointB
        self.radius = radius
    }
}

public struct CollisionResult {
    public var collided: Bool
    public var contactPoint: Vec3
    public var normal: Vec3
    public var depth: Float

    @inline(__always)
    public init() {
        self.collided = false
        self.contactPoint = Vec3()
        self.normal = Vec3()
        self.depth = 0
    }
}

public struct Triangle {
    public var vertices: (Vec3, Vec3, Vec3)

    @inline(__always)
    public init(v0: Vec3, v1: Vec3, v2: Vec3) {
        self.vertices = (v0, v1, v2)
    }

    @inline(__always)
    public var normal: Vec3 {
        let edge1 = vertices.1 - vertices.0
        let edge2 = vertices.2 - vertices.0
        return Vec3.cross(edge1, edge2).normalized
    }

    @inline(__always)
    public func closestPointTo(_ point: Vec3) -> Vec3 {
        let ab = vertices.1 - vertices.0
        let ac = vertices.2 - vertices.0
        let ap = point - vertices.0

        let d1 = Vec3.dot(ab, ap)
        let d2 = Vec3.dot(ac, ap)

        if d1 <= 0 && d2 <= 0 {
            return vertices.0
        }

        let bp = point - vertices.1
        let d3 = Vec3.dot(ab, bp)
        let d4 = Vec3.dot(ac, bp)

        if d3 >= 0 && d4 <= d3 {
            return vertices.1
        }

        let vc = d1 * d4 - d3 * d2
        if vc <= 0 && d1 >= 0 && d3 <= 0 {
            let v = d1 / (d1 - d3)
            return vertices.0 + ab * v
        }

        let cp = point - vertices.2
        let d5 = Vec3.dot(ab, cp)
        let d6 = Vec3.dot(ac, cp)

        if d6 >= 0 && d5 <= d6 {
            return vertices.2
        }

        let vb = d5 * d2 - d1 * d6
        if vb <= 0 && d2 >= 0 && d6 <= 0 {
            let v = d2 / (d2 - d6)
            return vertices.0 + ac * v
        }

        let va = d3 * d6 - d5 * d4
        if va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0 {
            let w = (d4 - d3) / ((d4 - d3) + (d5 - d6))
            return vertices.1 + (vertices.2 - vertices.1) * w
        }

        let denom = 1.0 / (va + vb + vc)
        let v = vb * denom
        let w = vc * denom
        return vertices.0 + ab * v + ac * w
    }
}

@MainActor
public class CollisionWorld {
    public static let shared = CollisionWorld()
    private var colliders: [Int32: Collider] = [:]
    private var nextId: Int32 = 1

    public func createCollider(radius: Float, height: Float) -> Int32 {
        let id = nextId
        nextId += 1
        colliders[id] = Collider(radius: radius, height: height)
        return id
    }

    public func freeCollider(id: Int32) {
        colliders.removeValue(forKey: id)
    }

    public func getCollider(_ id: Int32) -> Collider? {
        return colliders[id]
    }

    public func setColliderPosition(id: Int32, x: Float, y: Float, z: Float) {
        guard let collider = colliders[id] else { return }
        collider.position = Vec3(x: x, y: y, z: z)
    }

    public func getColliderPosition(id: Int32) -> Vec3 {
        return colliders[id]?.position ?? Vec3()
    }

    public func collideWithMeshes(id: Int32, meshId: Int32, surfaceIdx: Int32) -> CollisionResult {
        guard let collider = colliders[id],
            let mesh = MeshManager.shared.getMesh(meshId),
            surfaceIdx < mesh.surfaces.count
        else {
            return CollisionResult()
        }

        let surface = mesh.surfaces[Int(surfaceIdx)]
        return collideWithSurface(collider: collider, surface: surface)
    }

    private func collideWithSurface(collider: Collider, surface: Surface) -> CollisionResult {
        let capsule = Capsule(
            pointA: collider.position + Vec3(x: 0, y: collider.height / 2, z: 0),
            pointB: collider.position - Vec3(x: 0, y: collider.height / 2, z: 0),
            radius: collider.radius
        )

        var result = CollisionResult()
        var closestDepth: Float = Float.greatestFiniteMagnitude

        let _ = Int(surface.vertexCount)
        let indexCount = Int(surface.indexCount)

        for i in stride(from: 0, to: indexCount, by: 3) {
            let i0 = Int(surface.indices[i])
            let i1 = Int(surface.indices[i + 1])
            let i2 = Int(surface.indices[i + 2])

            let v0 = getVertex(surface, index: i0)
            let v1 = getVertex(surface, index: i1)
            let v2 = getVertex(surface, index: i2)

            let triangle = Triangle(v0: v0, v1: v1, v2: v2)
            let triResult = capsuleTriangleCollision(capsule: capsule, triangle: triangle)

            if triResult.collided {
                let depth = triResult.depth
                if depth < closestDepth {
                    closestDepth = depth
                    result = triResult
                }
            }
        }

        return result
    }

    private func getVertex(_ surface: Surface, index: Int) -> Vec3 {
        let offset = index * 11
        return Vec3(
            x: surface.vertices[offset],
            y: surface.vertices[offset + 1],
            z: surface.vertices[offset + 2]
        )
    }

    private func capsuleTriangleCollision(capsule: Capsule, triangle: Triangle) -> CollisionResult {
        let capsuleLine = capsule.pointB - capsule.pointA
        let _ = capsuleLine.normalized

        let triNormal = triangle.normal
        let triPoint = triangle.vertices.0

        let capsuleToTri = triPoint - capsule.pointA
        let distToPlane = Vec3.dot(capsuleToTri, triNormal)

        var result = CollisionResult()

        if abs(distToPlane) > capsule.radius + 0.001 {
            return result
        }

        let clampedPoint = triangle.closestPointTo(capsule.pointA)
        let sphere = Sphere(center: capsule.pointA, radius: capsule.radius)
        let sphereResult = sphereTriangleCollision(sphere: sphere, triangle: triangle)

        if sphereResult.collided {
            result.collided = true
            result.contactPoint = clampedPoint
            result.normal = triNormal
            result.depth = sphereResult.depth
            return result
        }

        let sphereB = Sphere(center: capsule.pointB, radius: capsule.radius)
        let sphereBResult = sphereTriangleCollision(sphere: sphereB, triangle: triangle)

        if sphereBResult.collided {
            result.collided = true
            result.contactPoint = clampedPoint
            result.normal = triNormal
            result.depth = sphereBResult.depth
            return result
        }

        let _ = capsuleLine.normalized
        var closestPoint = triPoint
        var minSegmentDist: Float = Float.greatestFiniteMagnitude

        let edges = [
            (triangle.vertices.0, triangle.vertices.1),
            (triangle.vertices.1, triangle.vertices.2),
            (triangle.vertices.2, triangle.vertices.0),
        ]

        for (v0, v1) in edges {
            let closest = closestPointOnSegmentToPoint(
                segmentStart: capsule.pointA,
                segmentEnd: capsule.pointB,
                point: closestSegmentPoint(v0: v0, v1: v1)
            )
            let dist = (closest - capsule.pointA).length
            if dist < minSegmentDist {
                minSegmentDist = dist
                closestPoint = closest
            }
        }

        let sphereC = Sphere(center: closestPoint, radius: capsule.radius)
        let sphereCResult = sphereTriangleCollision(sphere: sphereC, triangle: triangle)

        if sphereCResult.collided {
            result.collided = true
            result.contactPoint = closestPoint
            result.normal = triNormal
            result.depth = sphereCResult.depth
        }

        return result
    }

    private func closestSegmentPoint(v0: Vec3, v1: Vec3) -> Vec3 {
        let line = v1 - v0
        let len = line.length
        guard len > 0 else { return v0 }
        let t = Vec3.dot(v0, line) / (len * len)
        let clampedT = max(0, min(1, t))
        return v0 + line * clampedT
    }

    private func closestPointOnSegmentToPoint(segmentStart: Vec3, segmentEnd: Vec3, point: Vec3)
        -> Vec3
    {
        let line = segmentEnd - segmentStart
        let len = line.length
        guard len > 0 else { return segmentStart }
        let t = Vec3.dot(point - segmentStart, line) / (len * len)
        let clampedT = max(0, min(1, t))
        return segmentStart + line * clampedT
    }

    private func sphereTriangleCollision(sphere: Sphere, triangle: Triangle) -> CollisionResult {
        let closest = triangle.closestPointTo(sphere.center)
        let diff = closest - sphere.center
        let dist = diff.length
        let overlap = sphere.radius - dist

        var result = CollisionResult()

        if overlap > 0 {
            result.collided = true
            result.contactPoint = closest
            result.normal = diff.normalized
            result.depth = overlap
        }

        return result
    }
}

public class Collider {
    public var position: Vec3
    public let radius: Float
    public let height: Float

    public init(radius: Float, height: Float) {
        self.position = Vec3()
        self.radius = radius
        self.height = height
    }
}
