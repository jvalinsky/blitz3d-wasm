
public class BinaryReader {
    private let data: UnsafeRawBufferPointer
    private var offset: Int
    
    public init(data: UnsafeRawBufferPointer) {
        self.data = data
        self.offset = 0
    }
    
    public var isEOF: Bool {
        return offset >= data.count
    }
    
    public var remaining: Int {
        return data.count - offset
    }
    
    public func skip(_ count: Int) {
        offset += count
    }
    
    public func seek(_ position: Int) {
        offset = position
    }
    
    public func tell() -> Int {
        return offset
    }
    
    public func readByte() -> UInt8 {
        guard offset < data.count else { return 0 }
        let value = data[offset]
        offset += 1
        return value
    }
    
    public func readInt32LE() -> Int32 {
        guard offset + 4 <= data.count else { return 0 }
        let value = data.load(fromByteOffset: offset, as: Int32.self)
        offset += 4
        return value
    }
    
    public func readInt32BE() -> Int32 {
        guard offset + 4 <= data.count else { return 0 }
        let b1 = UInt32(data[offset])
        let b2 = UInt32(data[offset + 1])
        let b3 = UInt32(data[offset + 2])
        let b4 = UInt32(data[offset + 3])
        offset += 4
        return Int32(bitPattern: (b1 << 24) | (b2 << 16) | (b3 << 8) | b4)
    }
    
    public func readFloat32() -> Float {
        guard offset + 4 <= data.count else { return 0 }
        let value = data.load(fromByteOffset: offset, as: Float.self)
        offset += 4
        return value
    }
    
    public func readString() -> String {
        var str = ""
        while offset < data.count {
            let byte = data[offset]
            offset += 1
            if byte == 0 { break }
            str.append(Character(UnicodeScalar(byte)))
        }
        return str
    }
}
