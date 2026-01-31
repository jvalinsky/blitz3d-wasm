@MainActor
public class PixelBuffer {
    public let width: Int32
    public let height: Int32
    public var bankId: Int32 = 0  // 0 means not allocated/locked
    public var dirty: Bool = false

    public init(width: Int32, height: Int32) {
        self.width = width
        self.height = height
    }

    public func lock() {
        if bankId == 0 {
            // Allocate bank: ARGB (4 bytes)
            let size = width * height * 4
            bankId = BankManager.shared.createBank(size: size)

            // Optional: Initialize to specific color or clear?
            // Blitz3D textures might contain garbage or be cleared. Let's assume clear.
            if BankManager.shared.getBank(id: bankId) != nil {
                // Already zero-initialized by Bank init
            }
        }
    }

    public func unlock() {
        dirty = true
    }

    public func writePixel(x: Int32, y: Int32, argb: Int32) {
        guard x >= 0, y >= 0, x < width, y < height, bankId != 0 else { return }
        let offset = Int(y * width + x) * 4
        if let bank = BankManager.shared.getBank(id: bankId) {
            bank.pokeInt(offset: offset, value: argb)
        }
    }

    public func readPixel(x: Int32, y: Int32) -> Int32 {
        guard x >= 0, y >= 0, x < width, y < height, bankId != 0 else { return 0 }
        let offset = Int(y * width + x) * 4
        if let bank = BankManager.shared.getBank(id: bankId) {
            return bank.peekInt(offset: offset)
        }
        return 0
    }
}

@MainActor
public class Texture {
    public let id: Int32
    public let width: Int32
    public let height: Int32
    public let flags: Int32
    public var frames: [PixelBuffer] = []

    public init(id: Int32, width: Int32, height: Int32, flags: Int32, frameCount: Int = 1) {
        self.id = id
        self.width = width
        self.height = height
        self.flags = flags
        for _ in 0..<frameCount {
            frames.append(PixelBuffer(width: width, height: height))
        }
    }
}

@MainActor
public class Image {
    public let id: Int32
    public let width: Int32
    public let height: Int32
    public var frames: [PixelBuffer] = []

    public init(id: Int32, width: Int32, height: Int32, frameCount: Int = 1) {
        self.id = id
        self.width = width
        self.height = height
        for _ in 0..<frameCount {
            frames.append(PixelBuffer(width: width, height: height))
        }
    }
}

@MainActor
public class TextureManager {
    public static let shared = TextureManager()

    private var textures: [Int32: Texture] = [:]
    private var images: [Int32: Image] = [:]

    // Map BufferID -> PixelBuffer
    private var buffers: [Int32: PixelBuffer] = [:]

    private var nextTexId: Int32 = 1
    private var nextImgId: Int32 = 1
    private var nextBufId: Int32 = 1

    // MARK: - Textures

    public func createTexture(width: Int32, height: Int32, flags: Int32, frames: Int32 = 1) -> Int32
    {
        let id = nextTexId
        nextTexId += 1

        let tex = Texture(
            id: id, width: width, height: height, flags: flags, frameCount: Int(frames))
        textures[id] = tex

        // Register buffers
        for buf in tex.frames {
            let bufId = nextBufId
            nextBufId += 1
            buffers[bufId] = buf
        }

        return id
    }

    public func freeTexture(id: Int32) {
        guard let tex = textures[id] else { return }
        for buf in tex.frames {
            if let bufId = findBufferId(for: buf) {
                buffers.removeValue(forKey: bufId)
            }
        }
        textures.removeValue(forKey: id)
    }

    public func getTextureBuffer(texId: Int32, frame: Int32 = 0) -> Int32 {
        guard let tex = textures[texId], frame >= 0, frame < tex.frames.count else { return 0 }
        return findBufferId(for: tex.frames[Int(frame)]) ?? 0
    }

    // MARK: - Images

    public func createImage(width: Int32, height: Int32, frames: Int32 = 1) -> Int32 {
        let id = nextImgId
        nextImgId += 1

        let img = Image(id: id, width: width, height: height, frameCount: Int(frames))
        images[id] = img

        for buf in img.frames {
            let bufId = nextBufId
            nextBufId += 1
            buffers[bufId] = buf
        }

        return id
    }

    public func freeImage(id: Int32) {
        guard let img = images[id] else { return }
        for buf in img.frames {
            if let bufId = findBufferId(for: buf) {
                buffers.removeValue(forKey: bufId)
            }
        }
        images.removeValue(forKey: id)
    }

    public func getImageBuffer(imgId: Int32, frame: Int32 = 0) -> Int32 {
        guard let img = images[imgId], frame >= 0, frame < img.frames.count else { return 0 }
        return findBufferId(for: img.frames[Int(frame)]) ?? 0
    }

    // MARK: - Buffers

    private func findBufferId(for buffer: PixelBuffer) -> Int32? {
        for (id, buf) in buffers {
            if buf === buffer { return id }
        }
        return nil
    }

    public func lockBuffer(id: Int32) {
        guard let buf = buffers[id] else { return }
        buf.lock()
    }

    public func unlockBuffer(id: Int32) {
        guard let buf = buffers[id] else { return }
        buf.unlock()
    }

    public func writePixelFast(x: Int32, y: Int32, argb: Int32, bufferId: Int32) {
        buffers[bufferId]?.writePixel(x: x, y: y, argb: argb)
    }

    public func readPixelFast(x: Int32, y: Int32, bufferId: Int32) -> Int32 {
        return buffers[bufferId]?.readPixel(x: x, y: y) ?? 0
    }

    public func getBufferBank(id: Int32) -> Int32 {
        return buffers[id]?.bankId ?? 0
    }
}
