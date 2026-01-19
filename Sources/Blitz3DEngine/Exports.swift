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
    guard let mesh = MeshManager.shared.getMesh(meshId), surfaceIdx < mesh.surfaces.count else { return 0 }
    return mesh.surfaces[Int(surfaceIdx)].vertexCount
}

@_cdecl("GetSurfaceIndexCount")
@MainActor
public func GetSurfaceIndexCount(meshId: Int32, surfaceIdx: Int32) -> Int32 {
    guard let mesh = MeshManager.shared.getMesh(meshId), surfaceIdx < mesh.surfaces.count else { return 0 }
    return mesh.surfaces[Int(surfaceIdx)].indexCount
}

@_cdecl("GetSurfaceVerticesPtr")
@MainActor
public func GetSurfaceVerticesPtr(meshId: Int32, surfaceIdx: Int32) -> Int32 {
    guard let mesh = MeshManager.shared.getMesh(meshId), surfaceIdx < mesh.surfaces.count else { return 0 }
    return Int32(UInt(bitPattern: mesh.surfaces[Int(surfaceIdx)].vertices))
}

@_cdecl("GetSurfaceIndicesPtr")
@MainActor
public func GetSurfaceIndicesPtr(meshId: Int32, surfaceIdx: Int32) -> Int32 {
    guard let mesh = MeshManager.shared.getMesh(meshId), surfaceIdx < mesh.surfaces.count else { return 0 }
    return Int32(UInt(bitPattern: mesh.surfaces[Int(surfaceIdx)].indices))
}
