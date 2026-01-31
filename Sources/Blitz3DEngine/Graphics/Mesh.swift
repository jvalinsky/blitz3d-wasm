public class Surface {
    public var vertices: UnsafeMutablePointer<Float>
    public var indices: UnsafeMutablePointer<Int32>
    public var vertexCount: Int32
    public var indexCount: Int32

    public var vertexCapacity: Int32
    public var indexCapacity: Int32

    public init(vertexCount: Int32, indexCount: Int32) {
        self.vertexCount = vertexCount
        self.indexCount = indexCount
        self.vertexCapacity = vertexCount > 0 ? vertexCount : 8
        self.indexCapacity = indexCount > 0 ? indexCount : 12

        // Vertex format: x, y, z, nx, ny, nz, u, v, r, g, b, a (11 floats)
        self.vertices = UnsafeMutablePointer<Float>.allocate(capacity: Int(vertexCapacity) * 11)
        self.indices = UnsafeMutablePointer<Int32>.allocate(capacity: Int(indexCapacity))
    }

    deinit {
        vertices.deallocate()
        indices.deallocate()
    }

    public func addTriangle(v0: Int32, v1: Int32, v2: Int32) {
        if indexCount + 3 > indexCapacity {
            expandIndices(newCapacity: max(indexCapacity * 2, indexCount + 3))
        }
        indices[Int(indexCount)] = v0
        indices[Int(indexCount + 1)] = v1
        indices[Int(indexCount + 2)] = v2
        indexCount += 3
    }

    // TODO: addVertex implementation if needed

    private func expandIndices(newCapacity: Int32) {
        let newPtr = UnsafeMutablePointer<Int32>.allocate(capacity: Int(newCapacity))
        newPtr.initialize(from: indices, count: Int(indexCount))
        indices.deallocate()
        indices = newPtr
        indexCapacity = newCapacity
    }
}

public class Mesh {
    public var surfaces: [Surface] = []
    public let name: String

    public init(name: String) {
        self.name = name
    }

    public func addSurface(vertexCount: Int32, indexCount: Int32) -> Surface {
        let surface = Surface(vertexCount: vertexCount, indexCount: indexCount)
        surfaces.append(surface)
        return surface
    }
}

@MainActor
public class MeshManager {
    public static let shared = MeshManager()
    private var meshes: [Int32: Mesh] = [:]
    private var nextId: Int32 = 1

    public func createMesh(name: String) -> Int32 {
        let id = nextId
        nextId += 1
        meshes[id] = Mesh(name: name)
        return id
    }

    public func getMesh(_ id: Int32) -> Mesh? {
        return meshes[id]
    }
}
