import Foundation



let COLLISION_EPSILON: Float = 0.001

public struct Line {
    public var o: Vec3
    public var d: Vec3

    public init(o: Vec3, d: Vec3) {
        self.o = o
        self.d = d
    }

    public func at(_ t: Float) -> Vec3 {
        return o + d * t
    }

    public func nearest(_ p: Vec3) -> Vec3 {
        let lenSq = Vec3.dot(d, d)
        if lenSq < 1e-6 { return o }
        let t = Vec3.dot(p - o, d) / lenSq
        return o + d * t
    }
}

public struct Plane {
    public var n: Vec3
    public var d: Float

    public init(n: Vec3, d: Float) {
        self.n = n
        self.d = d
    }

    public init(p: Vec3, n: Vec3) {
        self.n = n
        self.d = Vec3.dot(p, n)
    }

    public init(v0: Vec3, v1: Vec3, v2: Vec3) {
        // Normal from points (Method from blitz3d-ng Plane(v0,v1,v2))
        let v01 = v1 - v0
        let v02 = v2 - v0
        self.n = Vec3.cross(v01, v02).normalized
        self.d = Vec3.dot(v0, self.n)
    }

    public func distance(_ p: Vec3) -> Float {
        return Vec3.dot(n, p) - d
    }

    public func intersect(line: Line) -> Float {
        let num = d - Vec3.dot(n, line.o)
        let den = Vec3.dot(n, line.d)
        // Check for parallel?
        if abs(den) < 1e-6 { return Float.greatestFiniteMagnitude }
        return num / den
    }

    public func nearest(_ p: Vec3) -> Vec3 {
        return p - n * distance(p)
    }

    public func intersect(with plane: Plane) -> Line {
        // Intersection of two planes is a line
        let fn = Vec3.cross(n, plane.n)
        let dir = fn.normalized

        // Point on line?
        // n1.x*x + n1.y*y + n1.z*z = d1
        // n2.x*x + n2.y*y + n2.z*z = d2
        // complicated, maybe skip full impl unless needed for sliding?
        // For sliding (collision.cpp):
        // dv = coll_plane.intersect( planes[0] ).nearest( dv );

        // Let's implement robustly if needed.
        // Or simpler: project vector onto line direction?
        // Blitz implementation:
        // Plane::intersect( const Plane &p )const{
        //    Vector fn=n.cross(p.n);
        //    Vector u=fn.cross(n).normalized();
        //    float d2=p.distance( n*d );
        //    return Line( n*d + u * (d2/p.n.dot(u)),fn );
        // }

        let u = Vec3.cross(fn, n).normalized
        let d2 = plane.distance(n * d)
        let dotVal = Vec3.dot(plane.n, u)

        // This math seems specific to blitz3d-ng
        let start = n * d + u * (d2 / dotVal)
        return Line(o: start, d: fn)
    }
}

public struct Collision {
    public var time: Float
    public var normal: Vec3
    // public var surface: Surface? // Could add context

    public init() {
        self.time = 1.0  // Initialize to max time
        self.normal = Vec3(x: 0, y: 1, z: 0)
    }

    public mutating func update(line: Line, t: Float, n: Vec3) -> Bool {
        if t > time { return false }

        let p = Plane(p: line.at(t), n: n)
        if Vec3.dot(p.n, line.d) >= 0 { return false }  // Moving away from normal?
        if p.distance(line.o) < -COLLISION_EPSILON { return false }  // Started behind?

        time = t
        normal = n
        return true
    }
}

public class CollisionSolver {

    // Matrix for coordinate transformation
    struct Matrix {
        let i: Vec3, j: Vec3, k: Vec3

        // Transpose / Inverse for orthogonal
        var transposed: Matrix {
            Matrix(
                i: Vec3(x: i.x, y: j.x, z: k.x),
                j: Vec3(x: i.y, y: j.y, z: k.y),
                k: Vec3(x: i.z, y: j.z, z: k.z)
            )
        }

        static func * (lhs: Matrix, rhs: Vec3) -> Vec3 {
            Vec3(
                x: lhs.i.x * rhs.x + lhs.j.x * rhs.y + lhs.k.x * rhs.z,
                y: lhs.i.y * rhs.x + lhs.j.y * rhs.y + lhs.k.y * rhs.z,
                z: lhs.i.z * rhs.x + lhs.j.z * rhs.y + lhs.k.z * rhs.z
            )
        }
    }

    public static func sphereCollide(
        line: Line, radius: Float, dest: Vec3, destRadius: Float, collision: inout Collision
    ) -> Bool {
        let r = radius + destRadius
        let l = Line(o: line.o - dest, d: line.d)

        let a = Vec3.dot(l.d, l.d)
        if a == 0 { return false }
        let b = Vec3.dot(l.o, l.d) * 2
        let c = Vec3.dot(l.o, l.o) - r * r
        let d = b * b - 4 * a * c
        if d < 0 { return false }

        let sqrtD = sqrt(d)
        let t1 = (-b + sqrtD) / (2 * a)
        let t2 = (-b - sqrtD) / (2 * a)

        let t = t1 < t2 ? t1 : t2
        if t > collision.time { return false }

        let hitPoint = l.at(t)
        return collision.update(line: line, t: t, n: hitPoint.normalized)
    }

    // Helper edge test from collision.cpp
    private static func edgeTest(
        v0: Vec3, v1: Vec3, pn: Vec3, en: Vec3, line: Line, radius: Float,
        collision: inout Collision
    ) -> Bool {
        // Matrix tm=~Matrix( en,(v1-v0).normalized(),pn );
        let m = Matrix(i: en, j: (v1 - v0).normalized, k: pn)
        let tm = m.transposed  // Inverse/Transpose

        let sv = tm * (line.o - v0)
        let dv = tm * (line.at(1.0) - v0)
        let l = Line(o: sv, d: dv - sv)

        // Cylinder test
        let a = l.d.x * l.d.x + l.d.z * l.d.z
        if a == 0 { return false }
        let b = (l.o.x * l.d.x + l.o.z * l.d.z) * 2
        let c = (l.o.x * l.o.x + l.o.z * l.o.z) - radius * radius
        let d = b * b - 4 * a * c
        if d < 0 { return false }

        let sqrtD = sqrt(d)
        let t1 = (-b + sqrtD) / (2 * a)
        let t2 = (-b - sqrtD) / (2 * a)

        let t = t1 < t2 ? t1 : t2

        if t > collision.time { return false }

        let i = l.at(t)
        var p = Vec3()
        let distV0V1 = (v1 - v0).length

        if i.y > distV0V1 { return false }  // Above cylinder

        if i.y >= 0 {
            if t < 0 { return false }
            p.y = i.y  // On cylinder body
        } else {
            // Below bottom... sphere test
            let aSphere = Vec3.dot(l.d, l.d)
            if aSphere == 0 { return false }
            let bSphere = Vec3.dot(l.o, l.d) * 2
            let cSphere = Vec3.dot(l.o, l.o) - radius * radius
            let dSphere = bSphere * bSphere - 4 * aSphere * cSphere
            if dSphere < 0 { return false }

            let sqrtDSphere = sqrt(dSphere)
            let t1s = (-bSphere + sqrtDSphere) / (2 * aSphere)
            let t2s = (-bSphere - sqrtDSphere) / (2 * aSphere)
            let ts = t1s < t2s ? t1s : t2s

            if ts < 0 || ts > collision.time { return false }
            // collision.time updated? no, we use local t for now, check later
            // logic in cpp slightly confusing structure, let's track 't'
            // Re-assign t for shared exit
            // Wait, the cpp code:
            // t = ...
            // i = l*t
            // then updates curr_coll->time
            // We need to support the 'else' block properly

            // Reworking for clarity:
            return sphereCollide(
                line: l, radius: radius, dest: Vec3(), destRadius: 0, collision: &collision)
            // The logic below 'else' is essentially sphere test at (0,0,0) of transformed space
        }

        // Transform back normal
        // curr_coll->normal=~tm*(i-p);
        let normal = (tm.transposed * (i - p)).normalized  // ~tm is transpose of tm. Transpose of Transpose is original Matrix?
        // Wait: collision.cpp uses `Matrix tm=~Matrix(...)`. ~ is transpose.
        // Then `curr_coll->normal=~tm*(i-p)`.
        // So it uses `tm` transposed again (which is original M).
        // My `tm` variable is already the transposed matrix.
        // So `tm.transposed` (== original M) is correct.

        return collision.update(line: line, t: t, n: normal)
    }

    public static func triangleCollide(
        line: Line, radius: Float, v0: Vec3, v1: Vec3, v2: Vec3, collision: inout Collision
    ) -> Bool {
        var p = Plane(v0: v0, v1: v1, v2: v2)
        if Vec3.dot(p.n, line.d) >= 0 { return false }

        // Move plane out
        p.d -= radius
        let t = p.intersect(line: line)
        if t > collision.time { return false }

        // Edge planes
        let p0 = Plane(p: v0 + p.n, n: Vec3.cross(v1 - v0, p.n).normalized)  // Blitz: Plane(v0+p.n, v1, v0)
        let p1 = Plane(p: v1 + p.n, n: Vec3.cross(v2 - v1, p.n).normalized)
        let p2 = Plane(p: v2 + p.n, n: Vec3.cross(v0 - v2, p.n).normalized)

        // Note: Plane(a,b,c) constructor in Blitz uses normal generated from (b-a) x (c-a).
        // My Plane(v0, v1, v2) does (v1-v0) x (v2-v0).
        // Let's match Blitz Plane constructor logic for edges:
        // p0( v0+p.n, v1, v0 ) -> n = (v1 - (v0+p.n)) x (v0 - (v0+p.n))
        // This is getting tricky. Let's trust my analytic cross product construction for edge normals:
        // Edge normal should be perp to edge and perp to tri normal.
        // (v1-v0) x p.n

        // Intersects triangle face?
        if t >= 0 {
            let i = line.at(t)
            // Original code: if( p0.distance(i)>=0 && p1.distance(i)>=0 && p2.distance(i)>=0 )
            // My plane distance logic: dot(n,p) - d.
            // If edge planes allow point:

            // To be safe, let's strictly follow C++ Plane(v0,v1,v2) logic.
            // p0 passing through v1 and v0.
            // Wait, standard point-in-triangle check is easier?
            // "Swept sphere against triangle" - checking if center of sphere hits expanded triangle.

            // Let's implement the `edgeTest` calls if the face check fails? No, C++ does face check OR edge tests.

            // Let's verify the Plane constructor:
            // C++: Plane(const Vector &v0,const Vector &v1,const Vector &v2){
            //	 Vector v01=v1-v0,v02=v2-v0;
            //	 n=v01.cross(v02).normalized();
            //	 d=n.dot(v0);
            // }
            // My `init(v0,v1,v2)` matches this.

            // C++ edge planes:
            // Plane p0( v0+p.n,v1,v0 ) ...
            let pp0 = Plane(v0: v0 + p.n, v1: v1, v2: v0)
            let pp1 = Plane(v0: v1 + p.n, v1: v2, v2: v1)
            let pp2 = Plane(v0: v2 + p.n, v1: v0, v2: v2)

            if pp0.distance(i) >= 0 && pp1.distance(i) >= 0 && pp2.distance(i) >= 0 {
                return collision.update(line: line, t: t, n: p.n)
            }
        }

        if radius <= 0 { return false }

        // Edge collision tests
        // Need edge normals (en) for edgeTest
        // In collision.cpp: edgeTest( v0,v1,p.n,p0.n,line,radius,this )
        // Using the compiled planes above:

        let pp0 = Plane(v0: v0 + p.n, v1: v1, v2: v0)
        let pp1 = Plane(v0: v1 + p.n, v1: v2, v2: v1)
        let pp2 = Plane(v0: v2 + p.n, v1: v0, v2: v2)

        var hit = false
        hit =
            edgeTest(
                v0: v0, v1: v1, pn: p.n, en: pp0.n, line: line, radius: radius,
                collision: &collision) || hit
        hit =
            edgeTest(
                v0: v1, v1: v2, pn: p.n, en: pp1.n, line: line, radius: radius,
                collision: &collision) || hit
        hit =
            edgeTest(
                v0: v2, v1: v0, pn: p.n, en: pp2.n, line: line, radius: radius,
                collision: &collision) || hit

        return hit
    }

    public static func boxCollide(line: Line, radius: Float, box: AABB, collision: inout Collision)
        -> Bool
    {
        // Decompose box into 6 quads (12 triangles) or just 6 planes?
        // Blitz3D uses 6 planes/quads logic in collision.cpp
        /*
        	static int quads[]={
                2,3,1,0,
                3,7,5,1,
                7,6,4,5,
                6,2,0,4,
                6,7,3,2,
                0,1,5,4
            };
        */
        // Map AABB corners to indices 0-7
        // 0: min.x, min.y, min.z
        // 1: max.x, min.y, min.z
        // ...
        // Indexing: bit 0 = x, bit 1 = y, bit 2 = z?
        // Usually:
        // 0: 000, 1: 100, 2: 010, 3: 110, 4: 001, 5: 101, 6: 011, 7: 111

        func corner(_ i: Int) -> Vec3 {
            Vec3(
                x: (i & 1) != 0 ? box.max.x : box.min.x,
                y: (i & 2) != 0 ? box.max.y : box.min.y,
                z: (i & 4) != 0 ? box.max.z : box.min.z
            )
        }

        let quads = [
            2, 3, 1, 0,
            3, 7, 5, 1,
            7, 6, 4, 5,
            6, 2, 0, 4,
            6, 7, 3, 2,
            0, 1, 5, 4,
        ]

        var hit = false

        for n in stride(from: 0, to: 24, by: 4) {
            let v0 = corner(quads[n])
            let v1 = corner(quads[n + 1])
            let v2 = corner(quads[n + 2])
            let v3 = corner(quads[n + 3])

            // Quad Plane
            var p = Plane(v0: v0, v1: v1, v2: v2)
            if Vec3.dot(p.n, line.d) >= 0 { continue }

            p.d -= radius
            let t = p.intersect(line: line)
            if t > collision.time { continue }

            // Edge planes
            let p0 = Plane(v0: v0 + p.n, v1: v1, v2: v0)
            let p1 = Plane(v0: v1 + p.n, v1: v2, v2: v1)
            let p2 = Plane(v0: v2 + p.n, v1: v3, v2: v2)
            let p3 = Plane(v0: v3 + p.n, v1: v0, v2: v3)

            if t >= 0 {
                let i = line.at(t)
                if p0.distance(i) >= 0 && p1.distance(i) >= 0 && p2.distance(i) >= 0
                    && p3.distance(i) >= 0
                {
                    if collision.update(line: line, t: t, n: p.n) {
                        hit = true
                    }
                    continue
                }
            }

            if radius <= 0 { continue }

            hit =
                edgeTest(
                    v0: v0, v1: v1, pn: p.n, en: p0.n, line: line, radius: radius,
                    collision: &collision) || hit
            hit =
                edgeTest(
                    v0: v1, v1: v2, pn: p.n, en: p1.n, line: line, radius: radius,
                    collision: &collision) || hit
            hit =
                edgeTest(
                    v0: v2, v1: v3, pn: p.n, en: p2.n, line: line, radius: radius,
                    collision: &collision) || hit
            hit =
                edgeTest(
                    v0: v3, v1: v0, pn: p.n, en: p3.n, line: line, radius: radius,
                    collision: &collision) || hit
        }

        return hit
    }
}
