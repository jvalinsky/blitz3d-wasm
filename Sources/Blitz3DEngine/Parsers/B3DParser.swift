
public struct B3DTexture {
    public let name: String
    public let flags: Int32
    public let blend: Int32
    public let posU: Float
    public let posV: Float
    public let scaleU: Float
    public let scaleV: Float
    public let rotation: Float
}

public struct B3DBrush {
    public let name: String
    public let red: Float
    public let green: Float
    public let blue: Float
    public let alpha: Float
    public let shininess: Float
    public let blend: Int32
    public let fx: Int32
    public let textureIds: [Int32]
}

public struct B3DVertex {
    public let x: Float
    public let y: Float
    public let z: Float
    public let nx: Float?
    public let ny: Float?
    public let nz: Float?
    public let r: Float?
    public let g: Float?
    public let b: Float?
    public let a: Float?
    public let uvs: [[Float]]
}

public struct B3DChunk {
    public let id: String
    public let size: Int32
    public let offset: Int
}

public class B3DParser {
    private let reader: BinaryReader
    private var currentMeshId: Int32 = 0
    
    public init(data: UnsafeRawBufferPointer) {
        self.reader = BinaryReader(data: data)
    }
    
    @MainActor
    public func parse() throws -> Int32 {
        let bytes = [reader.readByte(), reader.readByte(), reader.readByte(), reader.readByte()]
        let header = String(decoding: bytes, as: UTF8.self)
        guard header == "BB3D" else {
            return 0
        }
        
        _ = reader.readInt32LE() // length
        _ = reader.readInt32LE() // version
        
        self.currentMeshId = MeshManager.shared.createMesh(name: "B3DModel")
        
        while !reader.isEOF {
            try parseChunk()
        }
        
        return currentMeshId
    }
    
    @MainActor
    private func parseChunk() throws {
        let id = readChunkID()
        let size = reader.readInt32LE()
        let startOffset = reader.tell()
        
        switch id {
        case "VRTS":
            try parseVertices(size: size)
        case "TRIS":
            try parseTriangles(size: size)
        case "NODE":
            try parseNode(size: size)
        default:
            reader.skip(Int(size))
        }
        
        reader.seek(startOffset + Int(size))
    }
    
    private var lastVertices: [(x: Float, y: Float, z: Float, nx: Float, ny: Float, nz: Float, u: Float, v: Float)] = []

    @MainActor
    private func parseVertices(size: Int32) throws {
        let flags = reader.readInt32LE()
        let tcSets = reader.readInt32LE()
        let tcSize = reader.readInt32LE()
        
        let vCount = (size - 12) / (12 + (flags & 1 != 0 ? 12 : 0) + (flags & 2 != 0 ? 4 : 0) + (tcSets * tcSize * 4))
        
        lastVertices = []
        for _ in 0..<vCount {
            let x = reader.readFloat32()
            let y = reader.readFloat32()
            let z = reader.readFloat32()
            
            var nx: Float = 0, ny: Float = 0, nz: Float = 0
            if flags & 1 != 0 {
                nx = reader.readFloat32()
                ny = reader.readFloat32()
                nz = reader.readFloat32()
            }
            
            if flags & 2 != 0 { reader.skip(4) } // skip colors
            
            var u: Float = 0, v: Float = 0
            if tcSets > 0 {
                u = reader.readFloat32()
                v = reader.readFloat32()
                if tcSize > 2 { reader.skip(Int((tcSize - 2) * 4)) }
                if tcSets > 1 { reader.skip(Int((tcSets - 1) * tcSize * 4)) }
            }
            
            lastVertices.append((x, y, z, nx, ny, nz, u, v))
        }
    }

    @MainActor
    private func parseTriangles(size: Int32) throws {
        _ = reader.readInt32LE() // brushId
        let tCount = (size - 4) / 12
        
        let surface = MeshManager.shared.getMesh(currentMeshId)?.addSurface(vertexCount: Int32(lastVertices.count), indexCount: tCount * 3)
        
        if let surf = surface {
            for i in 0..<lastVertices.count {
                let v = lastVertices[i]
                let base = i * 11
                surf.vertices[base + 0] = v.x
                surf.vertices[base + 1] = v.y
                surf.vertices[base + 2] = v.z
                surf.vertices[base + 3] = v.nx
                surf.vertices[base + 4] = v.ny
                surf.vertices[base + 5] = v.nz
                surf.vertices[base + 6] = v.u
                surf.vertices[base + 7] = v.v
                // colors 8, 9, 10
                surf.vertices[base + 8] = 1.0
                surf.vertices[base + 9] = 1.0
                surf.vertices[base + 10] = 1.0
            }
            
            for i in 0..<Int(tCount) {
                surf.indices[i * 3 + 0] = reader.readInt32LE()
                surf.indices[i * 3 + 1] = reader.readInt32LE()
                surf.indices[i * 3 + 2] = reader.readInt32LE()
            }
        }
    }
    
    @MainActor
    private func parseNode(size: Int32) throws {
        _ = reader.readString() // name
        reader.skip(40) // pos, scale, rot
        
        let end = reader.tell() + Int(size) - 48 // roughly
        while reader.tell() < end {
            try parseChunk()
        }
    }
    
    private func readChunkID() -> String {
        let bytes = [reader.readByte(), reader.readByte(), reader.readByte(), reader.readByte()]
        return String(decoding: bytes, as: UTF8.self)
    }
    
    private func parseTextures(size: Int32) throws {
        reader.skip(Int(size))
    }
    
    private func parseBrushes(size: Int32) throws {
        reader.skip(Int(size))
    }
}
