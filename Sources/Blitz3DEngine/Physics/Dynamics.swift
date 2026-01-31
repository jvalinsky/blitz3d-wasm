

public struct CollisionPair: Sendable {
    public let srcType: Int32
    public let destType: Int32
    public let method: Int32  // 1=sphere, 2=poly, 3=box
    public let response: Int32  // 1=stop, 2=slide, 3=slide_no_slope
}

public struct CollisionRecord: Sendable {
    public let otherEntityId: Int32
    public let point: Vec3
    public let normal: Vec3
}

@MainActor
public class DynamicsWorld {
    public static let shared = DynamicsWorld()

    private var collisionPairs: [CollisionPair] = []
    private var collisionEntities: Set<Int32> = []
    private var collisionHistory: [Int32: [CollisionRecord]] = [:]

    // Config
    private let MAX_HITS = 10
    private let COLLISION_EPSILON: Float = 0.001

    public func addCollision(srcType: Int32, destType: Int32, method: Int32, response: Int32) {
        collisionPairs.removeAll { $0.srcType == srcType && $0.destType == destType }
        collisionPairs.append(
            CollisionPair(srcType: srcType, destType: destType, method: method, response: response))
    }

    public func registerEntity(_ entity: Entity) {
        collisionEntities.insert(entity.id)
    }

    public func updateWorld(step: Float) {
        collisionHistory.removeAll()

        let entitiesToCheck = collisionEntities.compactMap { SceneGraph.shared.getEntity($0) }

        for entity in entitiesToCheck {
            if !entity.visible { continue }
            // Check if entity is moving source
            if collisionPairs.contains(where: { $0.srcType == entity.collisionType }) {
                resolveCollisions(for: entity)
            }

            // Update old position for next frame
            entity.oldPosition = entity.localPosition
        }
    }

    private func resolveCollisions(for entity: Entity) {
        let pairs = collisionPairs.filter { $0.srcType == entity.collisionType }
        if pairs.isEmpty { return }

        // Start (sv) and Dest (dv)
        var sv: Vec3
        if entity.parent != nil {
            sv = entity.oldPosition
        } else {
            sv = entity.oldPosition
        }

        var dv = entity.worldPosition

        let delta = dv - sv
        if delta.length < 0.0001 { return }

        // Radii
        let radius = entity.collisionRadius.x

        var hits = 0
        var planes: [Plane] = []  // Sliding planes history

        // Line of movement
        var coll_line = Line(o: sv, d: delta)
        let dir = coll_line.d
        var td = dir.length  // total distance

        // Safety bail
        let panic = sv

        while hits < MAX_HITS {

            var bestColl = Collision()  // Initialize with time=1.0
            var bestInfo: CollisionPair? = nil
            var bestTarget: Entity? = nil

            // Check against all pairs
            for pair in pairs {
                let targets = SceneGraph.shared.collectEntities(ofType: .mesh).filter {
                    $0.collisionType == pair.destType && $0.id != entity.id && $0.visible
                }

                for target in targets {
                    var currColl = Collision()
                    currColl.time = bestColl.time

                    if hitTest(
                        line: coll_line, radius: radius, target: target, method: pair.method,
                        collision: &currColl)
                    {
                        if currColl.time < bestColl.time {
                            bestColl = currColl
                            bestInfo = pair
                            bestTarget = target
                        }
                    }
                }
            }

            guard let target = bestTarget, let info = bestInfo else { break }

            hits += 1
            recordCollision(
                src: entity, dest: target, point: coll_line.at(bestColl.time),
                normal: bestColl.normal)

            var collPlane = Plane(p: coll_line.at(bestColl.time), n: bestColl.normal)
            collPlane.d -= COLLISION_EPSILON

            let t = collPlane.intersect(line: coll_line)

            if t > 0 {
                sv = coll_line.at(t)
                td *= (1.0 - bestColl.time)
            }

            if info.response == 1 {  // STOP
                dv = sv
                break
            }
            // SLIDE
            let nv = collPlane.nearest(dv)

            if planes.isEmpty {
                dv = nv
            } else if planes.count == 1 {
                if planes[0].distance(nv) >= 0 {
                    dv = nv
                    planes.removeAll()
                } else {
                    if abs(Vec3.dot(planes[0].n, collPlane.n)) < 0.999 {
                        let creaseLine = collPlane.intersect(with: planes[0])
                        dv = creaseLine.nearest(dv)
                    } else {
                        hits = MAX_HITS
                        break
                    }
                }
            } else {
                if planes[0].distance(nv) >= 0 && planes[1].distance(nv) >= 0 {
                    dv = nv
                    planes.removeAll()
                } else {
                    dv = sv
                    break
                }
            }

            let dd = dv - sv
            if Vec3.dot(dd, dir) <= 0 {
                dv = sv
                break
            }

            coll_line.o = sv
            coll_line.d = dd
            dv = sv + dd

            if planes.count < 2 {
                planes.append(collPlane)
            }
        }

        let finalPos = (hits >= MAX_HITS) ? panic : dv

        // Apply back to entity
        if entity.parent == nil {
            entity.localPosition = finalPos
        } else {
            // Placeholder: parented entities not fully supported in this physics pass yet
            entity.localPosition = finalPos  // Likely incorrect if parent transform exists
        }
        entity.markDirty()
    }

    private func hitTest(
        line: Line, radius: Float, target: Entity, method: Int32, collision: inout Collision
    ) -> Bool {
        // Method 2: Polygon
        if method == 2 {
            guard let mesh = MeshManager.shared.getMesh(target.meshId) else { return false }
            var hit = false
            for surf in mesh.surfaces {
                let count = Int(surf.indexCount) / 3
                for i in 0..<count {
                    let i0 = Int(surf.indices[i * 3])
                    let i1 = Int(surf.indices[i * 3 + 1])
                    let i2 = Int(surf.indices[i * 3 + 2])

                    let v0 = getVec3(surf, i0)
                    let v1 = getVec3(surf, i1)
                    let v2 = getVec3(surf, i2)

                    if CollisionSolver.triangleCollide(
                        line: line, radius: radius, v0: v0, v1: v1, v2: v2, collision: &collision)
                    {
                        hit = true
                    }
                }
            }
            return hit
        }

        // Method 3: Box
        if method == 3 {
            // ... Box logic placeholders
            // let _ = AABB()
        }

        return false
    }

    private func getVec3(_ surf: Surface, _ index: Int) -> Vec3 {
        let off = index * 11
        return Vec3(x: surf.vertices[off], y: surf.vertices[off + 1], z: surf.vertices[off + 2])
    }

    private func recordCollision(src: Entity, dest: Entity, point: Vec3, normal: Vec3) {
        var list = collisionHistory[src.id] ?? []
        list.append(CollisionRecord(otherEntityId: dest.id, point: point, normal: normal))
        collisionHistory[src.id] = list
    }

    public func entityCollided(_ id: Int32, type: Int32) -> Int32 {
        guard let history = collisionHistory[id] else { return 0 }
        for rec in history {
            if let other = SceneGraph.shared.getEntity(rec.otherEntityId),
                other.collisionType == type
            {
                return other.id
            }
        }
        return 0
    }

    public func countCollisions(_ id: Int32) -> Int32 {
        return Int32(collisionHistory[id]?.count ?? 0)
    }

    public func getCollision(_ id: Int32, index: Int32) -> CollisionRecord? {
        guard let history = collisionHistory[id], index >= 0, index < history.count else {
            return nil
        }
        return history[Int(index)]
    }
}
