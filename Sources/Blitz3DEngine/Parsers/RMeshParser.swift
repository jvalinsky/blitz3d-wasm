
public class RMeshParser {
    private let reader: BinaryReader
    
    public init(data: UnsafeRawBufferPointer) {
        self.reader = BinaryReader(data: data)
    }
    
    public func parse() throws {
        let header = reader.readString()
        guard header == "RoomMesh" || header == "RoomMesh.HasTriggerBox" else {
            return
        }
        
        let hasTriggerBox = (header == "RoomMesh.HasTriggerBox")
        
        // 1. Drawn Meshes
        try parseDrawnMeshes()
        
        // 2. Alpha Meshes
        try parseDrawnMeshes()
        
        // 3. Collision Meshes
        try parseCollisionMeshes()
        
        // 4. Trigger Boxes
        if hasTriggerBox {
            try parseTriggerBoxes()
        }
        
        // 5. Point Entities
        try parsePointEntities()
    }
    
    private func parseDrawnMeshes() throws {
        let count = reader.readInt32LE()
        for _ in 0..<count {
            // Textures
            for _ in 0..<2 {
                let hasTexture = reader.readByte()
                if hasTexture != 0 {
                    _ = reader.readString()
                }
            }
            
            // Vertices
            let vCount = reader.readInt32LE()
            for _ in 0..<vCount {
                reader.skip(12) // xyz
                reader.skip(16) // 2x UV
                reader.skip(3)  // rgb
            }
            
            // Triangles
            let tCount = reader.readInt32LE()
            reader.skip(Int(tCount) * 12) // 3*i32
        }
    }
    
    private func parseCollisionMeshes() throws {
        let count = reader.readInt32LE()
        for _ in 0..<count {
            let vCount = reader.readInt32LE()
            reader.skip(Int(vCount) * 12)
            
            let tCount = reader.readInt32LE()
            reader.skip(Int(tCount) * 12)
        }
    }
    
    private func parseTriggerBoxes() throws {
        let count = reader.readInt32LE()
        for _ in 0..<count {
            // Trigger mesh is same as drawn mesh but without textures sometimes? 
            // Actually RMesh.HasTriggerBox adds a standard mesh section + name
            try parseDrawnMeshes() 
            _ = reader.readString() // Name
        }
    }
    
    private func parsePointEntities() throws {
        let count = reader.readInt32LE()
        for _ in 0..<count {
            let type = reader.readString()
            reader.skip(24) // pos(3), rot(3)
            
            switch type {
            case "screen": _ = reader.readString()
            case "waypoint": _ = reader.readString()
            case "light":
                reader.skip(3) // rgb
                reader.skip(4) // range
            case "spotlight":
                reader.skip(3) // rgb
                reader.skip(4) // range
                reader.skip(4) // angle
            case "soundemitter":
                _ = reader.readString()
                reader.skip(1) // loop
                reader.skip(4) // vol
            case "playerstart": _ = reader.readString()
            case "model":
                _ = reader.readString()
                _ = reader.readString()
            default: break
            }
        }
    }
}
