@_cdecl("CreateBank")
@MainActor
public func CreateBank(size: Int32) -> Int32 {
    return BankManager.shared.createBank(size: size)
}

@_cdecl("FreeBank")
@MainActor
public func FreeBank(id: Int32) {
    BankManager.shared.freeBank(id: id)
}

@_cdecl("BankSize")
@MainActor
public func BankSize(id: Int32) -> Int32 {
    return BankManager.shared.bankSize(id: id)
}

@_cdecl("GetBankPtr")
@MainActor
public func GetBankPtr(id: Int32) -> Int32 {
    guard let bank = BankManager.shared.getBank(id: id) else { return 0 }
    return Int32(UInt(bitPattern: bank.data))
}

@_cdecl("PeekByte")
@MainActor
public func PeekByte(id: Int32, offset: Int32) -> Int32 {
    guard let bank = BankManager.shared.getBank(id: id) else { return 0 }
    return Int32(bank.peekByte(offset: Int(offset)))
}

@_cdecl("PokeByte")
@MainActor
public func PokeByte(id: Int32, offset: Int32, value: Int32) {
    guard let bank = BankManager.shared.getBank(id: id) else { return }
    bank.pokeByte(offset: Int(offset), value: UInt8(value & 0xFF))
}

@_cdecl("PeekInt")
@MainActor
public func PeekInt(id: Int32, offset: Int32) -> Int32 {
    guard let bank = BankManager.shared.getBank(id: id) else { return 0 }
    return bank.peekInt(offset: Int(offset))
}

@_cdecl("PokeInt")
@MainActor
public func PokeInt(id: Int32, offset: Int32, value: Int32) {
    guard let bank = BankManager.shared.getBank(id: id) else { return }
    bank.pokeInt(offset: Int(offset), value: value)
}

@_cdecl("PeekFloat")
@MainActor
public func PeekFloat(id: Int32, offset: Int32) -> Float {
    guard let bank = BankManager.shared.getBank(id: id) else { return 0.0 }
    return bank.peekFloat(offset: Int(offset))
}

@_cdecl("PokeFloat")
@MainActor
public func PokeFloat(id: Int32, offset: Int32, value: Float) {
    guard let bank = BankManager.shared.getBank(id: id) else { return }
    bank.pokeFloat(offset: Int(offset), value: value)
}

@_cdecl("ParseB3D")
@MainActor
public func ParseB3D(bankId: Int32) -> Int32 {
    guard let bank = BankManager.shared.getBank(id: bankId) else { return 0 }

    // Create view of bank memory
    let data = UnsafeRawBufferPointer(start: bank.data, count: bank.size)
    let parser = B3DParser(data: data)

    do {
        return try parser.parse()
    } catch {
        return 0
    }
}

@_cdecl("ParseRMesh")
@MainActor
public func ParseRMesh(bankId: Int32) -> Int32 {
    guard let bank = BankManager.shared.getBank(id: bankId) else { return 0 }

    let data = UnsafeRawBufferPointer(start: bank.data, count: bank.size)
    let parser = RMeshParser(data: data)

    do {
        try parser.parse()
        return 1
    } catch {
        return 0
    }
}

// MARK: - Graphics Bridge

@_cdecl("GetMeshSurfaceCount")
@MainActor
public func GetMeshSurfaceCount(meshId: Int32) -> Int32 {
    return Int32(MeshManager.shared.getMesh(meshId)?.surfaces.count ?? 0)
}

@_cdecl("GetSurfaceVertexCount")
@MainActor
public func GetSurfaceVertexCount(meshId: Int32, surfaceIdx: Int32) -> Int32 {
    guard let mesh = MeshManager.shared.getMesh(meshId), surfaceIdx < mesh.surfaces.count else {
        return 0
    }
    return mesh.surfaces[Int(surfaceIdx)].vertexCount
}

@_cdecl("GetSurfaceIndexCount")
@MainActor
public func GetSurfaceIndexCount(meshId: Int32, surfaceIdx: Int32) -> Int32 {
    guard let mesh = MeshManager.shared.getMesh(meshId), surfaceIdx < mesh.surfaces.count else {
        return 0
    }
    return mesh.surfaces[Int(surfaceIdx)].indexCount
}

@_cdecl("GetSurfaceVerticesPtr")
@MainActor
public func GetSurfaceVerticesPtr(meshId: Int32, surfaceIdx: Int32) -> Int32 {
    guard let mesh = MeshManager.shared.getMesh(meshId), surfaceIdx < mesh.surfaces.count else {
        return 0
    }
    return Int32(UInt(bitPattern: mesh.surfaces[Int(surfaceIdx)].vertices))
}

@_cdecl("GetSurfaceIndicesPtr")
@MainActor
public func GetSurfaceIndicesPtr(meshId: Int32, surfaceIdx: Int32) -> Int32 {
    guard let mesh = MeshManager.shared.getMesh(meshId), surfaceIdx < mesh.surfaces.count else {
        return 0
    }
    return Int32(UInt(bitPattern: mesh.surfaces[Int(surfaceIdx)].indices))
}

// MARK: - Collision Bridge

@_cdecl("CreateCollider")
@MainActor
public func CreateCollider(radius: Float, height: Float) -> Int32 {
    return CollisionWorld.shared.createCollider(radius: radius, height: height)
}

@_cdecl("FreeCollider")
@MainActor
public func FreeCollider(id: Int32) {
    CollisionWorld.shared.freeCollider(id: id)
}

@_cdecl("SetColliderPosition")
@MainActor
public func SetColliderPosition(id: Int32, x: Float, y: Float, z: Float) {
    CollisionWorld.shared.setColliderPosition(id: id, x: x, y: y, z: z)
}

@_cdecl("GetColliderPositionX")
@MainActor
public func GetColliderPositionX(id: Int32) -> Float {
    return CollisionWorld.shared.getColliderPosition(id: id).x
}

@_cdecl("GetColliderPositionY")
@MainActor
public func GetColliderPositionY(id: Int32) -> Float {
    return CollisionWorld.shared.getColliderPosition(id: id).y
}

@_cdecl("GetColliderPositionZ")
@MainActor
public func GetColliderPositionZ(id: Int32) -> Float {
    return CollisionWorld.shared.getColliderPosition(id: id).z
}

@_cdecl("CollideWithMesh")
@MainActor
public func CollideWithMesh(colliderId: Int32, meshId: Int32, surfaceIdx: Int32) -> Int32 {
    let result = CollisionWorld.shared.collideWithMeshes(
        id: colliderId, meshId: meshId, surfaceIdx: surfaceIdx)
    return result.collided ? 1 : 0
}

@_cdecl("CollisionDepth")
@MainActor
public func CollisionDepth(colliderId: Int32, meshId: Int32, surfaceIdx: Int32) -> Float {
    let result = CollisionWorld.shared.collideWithMeshes(
        id: colliderId, meshId: meshId, surfaceIdx: surfaceIdx)
    return result.depth
}

@_cdecl("CollisionNormalX")
@MainActor
public func CollisionNormalX(colliderId: Int32, meshId: Int32, surfaceIdx: Int32) -> Float {
    let result = CollisionWorld.shared.collideWithMeshes(
        id: colliderId, meshId: meshId, surfaceIdx: surfaceIdx)
    return result.normal.x
}

@_cdecl("CollisionNormalY")
@MainActor
public func CollisionNormalY(colliderId: Int32, meshId: Int32, surfaceIdx: Int32) -> Float {
    let result = CollisionWorld.shared.collideWithMeshes(
        id: colliderId, meshId: meshId, surfaceIdx: surfaceIdx)
    return result.normal.y
}

@_cdecl("CollisionNormalZ")
@MainActor
public func CollisionNormalZ(colliderId: Int32, meshId: Int32, surfaceIdx: Int32) -> Float {
    let result = CollisionWorld.shared.collideWithMeshes(
        id: colliderId, meshId: meshId, surfaceIdx: surfaceIdx)
    return result.normal.z
}

// MARK: - Mesh Creation Bridge

@_cdecl("CreateMesh")
@MainActor
public func CreateMesh() -> Int32 {
    return MeshManager.shared.createMesh(name: "mesh")
}

@_cdecl("CreateMeshWithName")
@MainActor
public func CreateMeshWithName(namePtr: Int32) -> Int32 {
    return MeshManager.shared.createMesh(name: "mesh")
}

@_cdecl("AddSurface")
@MainActor
public func AddSurface(meshId: Int32, vertexCount: Int32, indexCount: Int32) -> Int32 {
    guard let mesh = MeshManager.shared.getMesh(meshId) else { return -1 }
    _ = mesh.addSurface(vertexCount: vertexCount, indexCount: indexCount)
    return Int32(mesh.surfaces.count - 1)
}

@_cdecl("SetVertex")
@MainActor
public func SetVertex(
    meshId: Int32, surfaceIdx: Int32, vertexIdx: Int32, x: Float, y: Float, z: Float, u: Float,
    v: Float
) {
    guard let mesh = MeshManager.shared.getMesh(meshId), surfaceIdx < mesh.surfaces.count else {
        return
    }
    let surf = mesh.surfaces[Int(surfaceIdx)]
    guard vertexIdx < surf.vertexCount else { return }

    let offset = Int(vertexIdx) * 11
    surf.vertices[offset] = x
    surf.vertices[offset + 1] = y
    surf.vertices[offset + 2] = z
    // nx, ny, nz = 0
    surf.vertices[offset + 3] = 0
    surf.vertices[offset + 4] = 0
    surf.vertices[offset + 5] = 0
    // u, v
    surf.vertices[offset + 6] = u
    surf.vertices[offset + 7] = v
    // r,g,b,a default to 1 or 0? Usually 1.
    surf.vertices[offset + 8] = 1
    surf.vertices[offset + 9] = 1
    surf.vertices[offset + 10] = 1
}

@_cdecl("SetTriangle")
@MainActor
public func SetTriangle(
    meshId: Int32, surfaceIdx: Int32, triangleIdx: Int32, v0: Int32, v1: Int32, v2: Int32
) {
    guard let mesh = MeshManager.shared.getMesh(meshId), surfaceIdx < mesh.surfaces.count else {
        return
    }
    let surf = mesh.surfaces[Int(surfaceIdx)]
    let baseIndex = Int(triangleIdx) * 3
    guard baseIndex + 2 < surf.indexCount else { return }

    surf.indices[baseIndex] = v0
    surf.indices[baseIndex + 1] = v1
    surf.indices[baseIndex + 2] = v2
}

@_cdecl("AddTriangle")
@MainActor
public func AddTriangle(meshId: Int32, surfaceIdx: Int32, v0: Int32, v1: Int32, v2: Int32) -> Int32
{
    guard let mesh = MeshManager.shared.getMesh(meshId), surfaceIdx < mesh.surfaces.count else {
        return -1
    }
    let surf = mesh.surfaces[Int(surfaceIdx)]
    surf.addTriangle(v0: v0, v1: v1, v2: v2)
    return (surf.indexCount / 3) - 1
}

@_cdecl("GetMeshName")
@MainActor
public func GetMeshName(meshId: Int32) -> Int32 {
    guard let mesh = MeshManager.shared.getMesh(meshId) else { return 0 }
    let name = mesh.name
    let bytes = Array(name.utf8)
    let bankId = BankManager.shared.createBank(size: Int32(bytes.count + 1))
    guard let bank = BankManager.shared.getBank(id: bankId) else { return 0 }
    for (i, byte) in bytes.enumerated() {
        bank.pokeByte(offset: i, value: byte)
    }
    bank.pokeByte(offset: bytes.count, value: 0)
    return bankId
}

// MARK: - Surface Data Bridge

@_cdecl("GetSurfaceVertexStride")
@MainActor
public func GetSurfaceVertexStride() -> Int32 {
    return 11
}

@_cdecl("GetSurfaceVertexX")
@MainActor
public func GetSurfaceVertexX(meshId: Int32, surfaceIdx: Int32, vertexIdx: Int32) -> Float {
    guard let mesh = MeshManager.shared.getMesh(meshId),
        surfaceIdx < mesh.surfaces.count,
        vertexIdx < mesh.surfaces[Int(surfaceIdx)].vertexCount
    else { return 0 }
    let offset = Int(vertexIdx) * 11
    return mesh.surfaces[Int(surfaceIdx)].vertices[offset]
}

@_cdecl("GetSurfaceVertexY")
@MainActor
public func GetSurfaceVertexY(meshId: Int32, surfaceIdx: Int32, vertexIdx: Int32) -> Float {
    guard let mesh = MeshManager.shared.getMesh(meshId),
        surfaceIdx < mesh.surfaces.count,
        vertexIdx < mesh.surfaces[Int(surfaceIdx)].vertexCount
    else { return 0 }
    let offset = Int(vertexIdx) * 11 + 1
    return mesh.surfaces[Int(surfaceIdx)].vertices[offset]
}

@_cdecl("GetSurfaceVertexZ")
@MainActor
public func GetSurfaceVertexZ(meshId: Int32, surfaceIdx: Int32, vertexIdx: Int32) -> Float {
    guard let mesh = MeshManager.shared.getMesh(meshId),
        surfaceIdx < mesh.surfaces.count,
        vertexIdx < mesh.surfaces[Int(surfaceIdx)].vertexCount
    else { return 0 }
    let offset = Int(vertexIdx) * 11 + 2
    return mesh.surfaces[Int(surfaceIdx)].vertices[offset]
}

@_cdecl("GetSurfaceNormalX")
@MainActor
public func GetSurfaceNormalX(meshId: Int32, surfaceIdx: Int32, vertexIdx: Int32) -> Float {
    guard let mesh = MeshManager.shared.getMesh(meshId),
        surfaceIdx < mesh.surfaces.count,
        vertexIdx < mesh.surfaces[Int(surfaceIdx)].vertexCount
    else { return 0 }
    let offset = Int(vertexIdx) * 11 + 3
    return mesh.surfaces[Int(surfaceIdx)].vertices[offset]
}

@_cdecl("GetSurfaceNormalY")
@MainActor
public func GetSurfaceNormalY(meshId: Int32, surfaceIdx: Int32, vertexIdx: Int32) -> Float {
    guard let mesh = MeshManager.shared.getMesh(meshId),
        surfaceIdx < mesh.surfaces.count,
        vertexIdx < mesh.surfaces[Int(surfaceIdx)].vertexCount
    else { return 0 }
    let offset = Int(vertexIdx) * 11 + 4
    return mesh.surfaces[Int(surfaceIdx)].vertices[offset]
}

@_cdecl("GetSurfaceNormalZ")
@MainActor
public func GetSurfaceNormalZ(meshId: Int32, surfaceIdx: Int32, vertexIdx: Int32) -> Float {
    guard let mesh = MeshManager.shared.getMesh(meshId),
        surfaceIdx < mesh.surfaces.count,
        vertexIdx < mesh.surfaces[Int(surfaceIdx)].vertexCount
    else { return 0 }
    let offset = Int(vertexIdx) * 11 + 5
    return mesh.surfaces[Int(surfaceIdx)].vertices[offset]
}

@_cdecl("GetSurfaceUVU")
@MainActor
public func GetSurfaceUVU(meshId: Int32, surfaceIdx: Int32, vertexIdx: Int32) -> Float {
    guard let mesh = MeshManager.shared.getMesh(meshId),
        surfaceIdx < mesh.surfaces.count,
        vertexIdx < mesh.surfaces[Int(surfaceIdx)].vertexCount
    else { return 0 }
    let offset = Int(vertexIdx) * 11 + 6
    return mesh.surfaces[Int(surfaceIdx)].vertices[offset]
}

@_cdecl("GetSurfaceUVV")
@MainActor
public func GetSurfaceUVV(meshId: Int32, surfaceIdx: Int32, vertexIdx: Int32) -> Float {
    guard let mesh = MeshManager.shared.getMesh(meshId),
        surfaceIdx < mesh.surfaces.count,
        vertexIdx < mesh.surfaces[Int(surfaceIdx)].vertexCount
    else { return 0 }
    let offset = Int(vertexIdx) * 11 + 7
    return mesh.surfaces[Int(surfaceIdx)].vertices[offset]
}

@_cdecl("GetSurfaceIndex")
@MainActor
public func GetSurfaceIndex(meshId: Int32, surfaceIdx: Int32, indexIdx: Int32) -> Int32 {
    guard let mesh = MeshManager.shared.getMesh(meshId),
        surfaceIdx < mesh.surfaces.count,
        indexIdx < mesh.surfaces[Int(surfaceIdx)].indexCount
    else { return 0 }
    return mesh.surfaces[Int(surfaceIdx)].indices[Int(indexIdx)]
}

// MARK: - LinePick / Raycast Bridge

@_cdecl("LinePick")
@MainActor
public func LinePick(meshId: Int32, x: Float, y: Float, z: Float, dx: Float, dy: Float, dz: Float)
    -> Int32
{
    guard let mesh = MeshManager.shared.getMesh(meshId) else { return 0 }

    let origin = Vec3(x: x, y: y, z: z)
    let direction = Vec3(x: dx, y: dy, z: dz).normalized

    var closestT: Float = Float.greatestFiniteMagnitude
    var closestTriangleIdx: Int32 = -1

    for (_, surface) in mesh.surfaces.enumerated() {
        let indexCount = Int(surface.indexCount)

        for i in stride(from: 0, to: indexCount, by: 3) {
            let i0 = Int(surface.indices[i])
            let i1 = Int(surface.indices[i + 1])
            let i2 = Int(surface.indices[i + 2])

            let v0 = getVertex(surface, index: i0)
            let v1 = getVertex(surface, index: i1)
            let v2 = getVertex(surface, index: i2)

            let t = rayTriangleIntersect(
                origin: origin, direction: direction, v0: v0, v1: v1, v2: v2)

            if t >= 0 && t < closestT {
                closestT = t
                closestTriangleIdx = Int32(i / 3)
            }
        }
    }

    return closestTriangleIdx
}

@_cdecl("LinePickDistance")
@MainActor
public func LinePickDistance(
    meshId: Int32, x: Float, y: Float, z: Float, dx: Float, dy: Float, dz: Float
) -> Float {
    guard let mesh = MeshManager.shared.getMesh(meshId) else { return -1 }

    let origin = Vec3(x: x, y: y, z: z)
    let direction = Vec3(x: dx, y: dy, z: dz).normalized

    var closestT: Float = Float.greatestFiniteMagnitude

    for surface in mesh.surfaces {
        let indexCount = Int(surface.indexCount)

        for i in stride(from: 0, to: indexCount, by: 3) {
            let i0 = Int(surface.indices[i])
            let i1 = Int(surface.indices[i + 1])
            let i2 = Int(surface.indices[i + 2])

            let v0 = getVertex(surface, index: i0)
            let v1 = getVertex(surface, index: i1)
            let v2 = getVertex(surface, index: i2)

            let t = rayTriangleIntersect(
                origin: origin, direction: direction, v0: v0, v1: v1, v2: v2)

            if t >= 0 && t < closestT {
                closestT = t
            }
        }
    }

    return closestT < Float.greatestFiniteMagnitude ? closestT : -1
}

@_cdecl("LinePickX")
@MainActor
public func LinePickX(meshId: Int32, x: Float, y: Float, z: Float, dx: Float, dy: Float, dz: Float)
    -> Float
{
    guard let mesh = MeshManager.shared.getMesh(meshId) else { return 0 }

    let origin = Vec3(x: x, y: y, z: z)
    let direction = Vec3(x: dx, y: dy, z: dz).normalized

    var closestT: Float = Float.greatestFiniteMagnitude
    var closestPoint = Vec3()

    for surface in mesh.surfaces {
        let indexCount = Int(surface.indexCount)

        for i in stride(from: 0, to: indexCount, by: 3) {
            let i0 = Int(surface.indices[i])
            let i1 = Int(surface.indices[i + 1])
            let i2 = Int(surface.indices[i + 2])

            let v0 = getVertex(surface, index: i0)
            let v1 = getVertex(surface, index: i1)
            let v2 = getVertex(surface, index: i2)

            let t = rayTriangleIntersect(
                origin: origin, direction: direction, v0: v0, v1: v1, v2: v2)

            if t >= 0 && t < closestT {
                closestT = t
                closestPoint = origin + direction * t
            }
        }
    }

    return closestPoint.x
}

@_cdecl("LinePickY")
@MainActor
public func LinePickY(meshId: Int32, x: Float, y: Float, z: Float, dx: Float, dy: Float, dz: Float)
    -> Float
{
    guard let mesh = MeshManager.shared.getMesh(meshId) else { return 0 }

    let origin = Vec3(x: x, y: y, z: z)
    let direction = Vec3(x: dx, y: dy, z: dz).normalized

    var closestT: Float = Float.greatestFiniteMagnitude
    var closestPoint = Vec3()

    for surface in mesh.surfaces {
        let indexCount = Int(surface.indexCount)

        for i in stride(from: 0, to: indexCount, by: 3) {
            let i0 = Int(surface.indices[i])
            let i1 = Int(surface.indices[i + 1])
            let i2 = Int(surface.indices[i + 2])

            let v0 = getVertex(surface, index: i0)
            let v1 = getVertex(surface, index: i1)
            let v2 = getVertex(surface, index: i2)

            let t = rayTriangleIntersect(
                origin: origin, direction: direction, v0: v0, v1: v1, v2: v2)

            if t >= 0 && t < closestT {
                closestT = t
                closestPoint = origin + direction * t
            }
        }
    }

    return closestPoint.y
}

@_cdecl("LinePickZ")
@MainActor
public func LinePickZ(meshId: Int32, x: Float, y: Float, z: Float, dx: Float, dy: Float, dz: Float)
    -> Float
{
    guard let mesh = MeshManager.shared.getMesh(meshId) else { return 0 }

    let origin = Vec3(x: x, y: y, z: z)
    let direction = Vec3(x: dx, y: dy, z: dz).normalized

    var closestT: Float = Float.greatestFiniteMagnitude
    var closestPoint = Vec3()

    for surface in mesh.surfaces {
        let indexCount = Int(surface.indexCount)

        for i in stride(from: 0, to: indexCount, by: 3) {
            let i0 = Int(surface.indices[i])
            let i1 = Int(surface.indices[i + 1])
            let i2 = Int(surface.indices[i + 2])

            let v0 = getVertex(surface, index: i0)
            let v1 = getVertex(surface, index: i1)
            let v2 = getVertex(surface, index: i2)

            let t = rayTriangleIntersect(
                origin: origin, direction: direction, v0: v0, v1: v1, v2: v2)

            if t >= 0 && t < closestT {
                closestT = t
                closestPoint = origin + direction * t
            }
        }
    }

    return closestPoint.z
}

@_cdecl("LinePickNX")
@MainActor
public func LinePickNX(meshId: Int32, x: Float, y: Float, z: Float, dx: Float, dy: Float, dz: Float)
    -> Float
{
    guard let mesh = MeshManager.shared.getMesh(meshId) else { return 0 }

    let origin = Vec3(x: x, y: y, z: z)
    let direction = Vec3(x: dx, y: dy, z: dz).normalized

    var closestT: Float = Float.greatestFiniteMagnitude
    var closestNormal = Vec3()

    for surface in mesh.surfaces {
        let indexCount = Int(surface.indexCount)

        for i in stride(from: 0, to: indexCount, by: 3) {
            let i0 = Int(surface.indices[i])
            let i1 = Int(surface.indices[i + 1])
            let i2 = Int(surface.indices[i + 2])

            let v0 = getVertex(surface, index: i0)
            let v1 = getVertex(surface, index: i1)
            let v2 = getVertex(surface, index: i2)

            let edge1 = v1 - v0
            let edge2 = v2 - v0
            let normal = Vec3.cross(edge1, edge2).normalized

            let t = rayTriangleIntersect(
                origin: origin, direction: direction, v0: v0, v1: v1, v2: v2)

            if t >= 0 && t < closestT {
                closestT = t
                closestNormal = normal
            }
        }
    }

    return closestNormal.x
}

@_cdecl("LinePickNY")
@MainActor
public func LinePickNY(meshId: Int32, x: Float, y: Float, z: Float, dx: Float, dy: Float, dz: Float)
    -> Float
{
    guard let mesh = MeshManager.shared.getMesh(meshId) else { return 0 }

    let origin = Vec3(x: x, y: y, z: z)
    let direction = Vec3(x: dx, y: dy, z: dz).normalized

    var closestT: Float = Float.greatestFiniteMagnitude
    var closestNormal = Vec3()

    for surface in mesh.surfaces {
        let indexCount = Int(surface.indexCount)

        for i in stride(from: 0, to: indexCount, by: 3) {
            let i0 = Int(surface.indices[i])
            let i1 = Int(surface.indices[i + 1])
            let i2 = Int(surface.indices[i + 2])

            let v0 = getVertex(surface, index: i0)
            let v1 = getVertex(surface, index: i1)
            let v2 = getVertex(surface, index: i2)

            let edge1 = v1 - v0
            let edge2 = v2 - v0
            let normal = Vec3.cross(edge1, edge2).normalized

            let t = rayTriangleIntersect(
                origin: origin, direction: direction, v0: v0, v1: v1, v2: v2)

            if t >= 0 && t < closestT {
                closestT = t
                closestNormal = normal
            }
        }
    }

    return closestNormal.y
}

@_cdecl("LinePickNZ")
@MainActor
public func LinePickNZ(meshId: Int32, x: Float, y: Float, z: Float, dx: Float, dy: Float, dz: Float)
    -> Float
{
    guard let mesh = MeshManager.shared.getMesh(meshId) else { return 0 }

    let origin = Vec3(x: x, y: y, z: z)
    let direction = Vec3(x: dx, y: dy, z: dz).normalized

    var closestT: Float = Float.greatestFiniteMagnitude
    var closestNormal = Vec3()

    for surface in mesh.surfaces {
        let indexCount = Int(surface.indexCount)

        for i in stride(from: 0, to: indexCount, by: 3) {
            let i0 = Int(surface.indices[i])
            let i1 = Int(surface.indices[i + 1])
            let i2 = Int(surface.indices[i + 2])

            let v0 = getVertex(surface, index: i0)
            let v1 = getVertex(surface, index: i1)
            let v2 = getVertex(surface, index: i2)

            let edge1 = v1 - v0
            let edge2 = v2 - v0
            let normal = Vec3.cross(edge1, edge2).normalized

            let t = rayTriangleIntersect(
                origin: origin, direction: direction, v0: v0, v1: v1, v2: v2)

            if t >= 0 && t < closestT {
                closestT = t
                closestNormal = normal
            }
        }
    }

    return closestNormal.z
}

// MARK: - Helper Functions

private func getVertex(_ surface: Surface, index: Int) -> Vec3 {
    let offset = index * 11
    return Vec3(
        x: surface.vertices[offset],
        y: surface.vertices[offset + 1],
        z: surface.vertices[offset + 2]
    )
}

private func rayTriangleIntersect(origin: Vec3, direction: Vec3, v0: Vec3, v1: Vec3, v2: Vec3)
    -> Float
{
    let epsilon: Float = 0.000001

    let edge1 = v1 - v0
    let edge2 = v2 - v0

    let h = Vec3.cross(direction, edge2)
    let a = Vec3.dot(edge1, h)

    if a > -epsilon && a < epsilon {
        return -1
    }

    let f = 1.0 / a
    let s = origin - v0
    let u = f * Vec3.dot(s, h)

    if u < 0.0 || u > 1.0 {
        return -1
    }

    let q = Vec3.cross(s, edge1)
    let v = f * Vec3.dot(direction, q)

    if v < 0.0 || u + v > 1.0 {
        return -1
    }

    let t = f * Vec3.dot(edge2, q)

    if t > epsilon {
        return t
    }

    return -1
}

// MARK: - Texture & Image Bridge

@_cdecl("CreateTexture")
@MainActor
public func CreateTexture(width: Int32, height: Int32, flags: Int32, frames: Int32) -> Int32 {
    return TextureManager.shared.createTexture(
        width: width, height: height, flags: flags, frames: frames)
}

@_cdecl("FreeTexture")
@MainActor
public func FreeTexture(texture: Int32) {
    TextureManager.shared.freeTexture(id: texture)
}

@_cdecl("TextureBuffer")
@MainActor
public func TextureBuffer(texture: Int32, frame: Int32) -> Int32 {
    return TextureManager.shared.getTextureBuffer(texId: texture, frame: frame)
}

@_cdecl("CreateImage")
@MainActor
public func CreateImage(width: Int32, height: Int32, frames: Int32) -> Int32 {
    return TextureManager.shared.createImage(width: width, height: height, frames: frames)
}

@_cdecl("FreeImage")
@MainActor
public func FreeImage(image: Int32) {
    TextureManager.shared.freeImage(id: image)
}

@_cdecl("ImageBuffer")
@MainActor
public func ImageBuffer(image: Int32, frame: Int32) -> Int32 {
    return TextureManager.shared.getImageBuffer(imgId: image, frame: frame)
}

@_cdecl("LockBuffer")
@MainActor
public func LockBuffer(buffer: Int32) {
    TextureManager.shared.lockBuffer(id: buffer)
}

@_cdecl("UnlockBuffer")
@MainActor
public func UnlockBuffer(buffer: Int32) {
    TextureManager.shared.unlockBuffer(id: buffer)
}

@_cdecl("WritePixelFast")
@MainActor
public func WritePixelFast(x: Int32, y: Int32, argb: Int32, buffer: Int32) {
    TextureManager.shared.writePixelFast(x: x, y: y, argb: argb, bufferId: buffer)
}

@_cdecl("ReadPixelFast")
@MainActor
public func ReadPixelFast(x: Int32, y: Int32, buffer: Int32) -> Int32 {
    return TextureManager.shared.readPixelFast(x: x, y: y, bufferId: buffer)
}

@_cdecl("WritePixel")
@MainActor
public func WritePixel(x: Int32, y: Int32, argb: Int32, buffer: Int32) {
    TextureManager.shared.writePixelFast(x: x, y: y, argb: argb, bufferId: buffer)
}

@_cdecl("ReadPixel")
@MainActor
public func ReadPixel(x: Int32, y: Int32, buffer: Int32) -> Int32 {
    return TextureManager.shared.readPixelFast(x: x, y: y, bufferId: buffer)
}

@_cdecl("GetBufferBank")
@MainActor
public func GetBufferBank(buffer: Int32) -> Int32 {
    return TextureManager.shared.getBufferBank(id: buffer)
}
