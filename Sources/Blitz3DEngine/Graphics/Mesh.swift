
public class Surface {
    public var vertices: UnsafeMutablePointer<Float>
    public var indices: UnsafeMutablePointer<Int32>
    public var vertexCount: Int32
    public var indexCount: Int32
    
    public init(vertexCount: Int32, indexCount: Int32) {
        self.vertexCount = vertexCount
        self.indexCount = indexCount
        
        // Vertex format: x, y, z, nx, ny, nz, u, v, r, g, b, a (11 floats)
        self.vertices = UnsafeMutablePointer<Float>.allocate(capacity: Int(vertexCount) * 11)
        self.indices = UnsafeMutablePointer<Int32>.allocate(capacity: Int(indexCount))
    }
    
    deinit {
        vertices.deallocate()
        indices.deallocate()
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
