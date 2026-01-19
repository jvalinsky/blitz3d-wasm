
/// A raw memory buffer for Blitz3D compatibility
public class Bank {
    public let size: Int
    public var data: UnsafeMutableRawPointer
    
    public init(size: Int) {
        self.size = size
        self.data = UnsafeMutableRawPointer.allocate(byteCount: size, alignment: 8)
        self.data.initializeMemory(as: UInt8.self, repeating: 0, count: size)
    }
    
    deinit {
        self.data.deallocate()
    }
    
    @inline(__always)
    private func checkBounds(offset: Int, count: Int) -> Bool {
        return offset >= 0 && (offset + count) <= size
    }
    
    public func peekByte(offset: Int) -> UInt8 {
        guard checkBounds(offset: offset, count: 1) else { return 0 }
        return data.load(fromByteOffset: offset, as: UInt8.self)
    }
    
    public func pokeByte(offset: Int, value: UInt8) {
        guard checkBounds(offset: offset, count: 1) else { return }
        data.storeBytes(of: value, toByteOffset: offset, as: UInt8.self)
    }
    
    public func peekInt(offset: Int) -> Int32 {
        guard checkBounds(offset: offset, count: 4) else { return 0 }
        return data.load(fromByteOffset: offset, as: Int32.self)
    }
    
    public func pokeInt(offset: Int, value: Int32) {
        guard checkBounds(offset: offset, count: 4) else { return }
        data.storeBytes(of: value, toByteOffset: offset, as: Int32.self)
    }
    
    public func peekFloat(offset: Int) -> Float {
        guard checkBounds(offset: offset, count: 4) else { return 0.0 }
        return data.load(fromByteOffset: offset, as: Float.self)
    }
    
    public func pokeFloat(offset: Int, value: Float) {
        guard checkBounds(offset: offset, count: 4) else { return }
        data.storeBytes(of: value, toByteOffset: offset, as: Float.self)
    }
    
    public func peekShort(offset: Int) -> Int16 {
        guard checkBounds(offset: offset, count: 2) else { return 0 }
        return data.load(fromByteOffset: offset, as: Int16.self)
    }
    
    public func pokeShort(offset: Int, value: Int16) {
        guard checkBounds(offset: offset, count: 2) else { return }
        data.storeBytes(of: value, toByteOffset: offset, as: Int16.self)
    }
}

/// Global manager for banks in the engine
@MainActor
public class BankManager {
    public static let shared = BankManager()
    private var banks: [Int32: Bank] = [:]
    private var nextId: Int32 = 1
    
    public func createBank(size: Int32) -> Int32 {
        let id = nextId
        nextId += 1
        banks[id] = Bank(size: Int(size))
        return id
    }
    
    public func freeBank(id: Int32) {
        banks.removeValue(forKey: id)
    }
    
    public func getBank(id: Int32) -> Bank? {
        return banks[id]
    }
    
    public func bankSize(id: Int32) -> Int32 {
        return Int32(banks[id]?.size ?? 0)
    }
}
