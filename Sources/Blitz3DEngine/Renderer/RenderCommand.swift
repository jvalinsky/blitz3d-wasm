import Foundation

/// GL command opcodes matching web/src/renderer/gl_replay.ts GLCmd enum.
public enum GLCmdOpcode: UInt32 {
    case clearColor      = 0x01
    case clear           = 0x02
    case bindShader      = 0x03
    case setUniform4f    = 0x04
    case setUniformMat4  = 0x05
    case setUniform1i    = 0x06
    case setUniform1f    = 0x07
    case setUniform3f    = 0x08
    case bindVAO         = 0x09
    case bindTexture     = 0x0A
    case drawElements    = 0x0B
    case drawArrays      = 0x0C
    case enable          = 0x0D
    case disable         = 0x0E
    case blendFunc       = 0x0F
    case depthMask       = 0x10
    case cullFace        = 0x11
    case uploadVB        = 0x12
    case uploadIB        = 0x13
    case setViewport     = 0x14
    case setUniformMat3  = 0x15
}

/// WebGL constant values (subset used by the command buffer).
public enum GLConst {
    public static let DEPTH_BUFFER_BIT: UInt32    = 0x00000100
    public static let COLOR_BUFFER_BIT: UInt32    = 0x00004000
    public static let TRIANGLES: UInt32           = 0x0004
    public static let UNSIGNED_SHORT: UInt32      = 0x1403
    public static let UNSIGNED_INT: UInt32        = 0x1405
    public static let DEPTH_TEST: UInt32          = 0x0B71
    public static let BLEND: UInt32               = 0x0BE2
    public static let CULL_FACE: UInt32           = 0x0B44
    public static let BACK: UInt32                = 0x0405
    public static let FRONT: UInt32               = 0x0404
    public static let SRC_ALPHA: UInt32           = 0x0302
    public static let ONE_MINUS_SRC_ALPHA: UInt32 = 0x0303
    public static let ONE: UInt32                 = 0x0001
    public static let DST_COLOR: UInt32           = 0x0306
    public static let ZERO: UInt32                = 0x0000
}

/// Builds a flat GL command buffer in WASM memory.
///
/// Buffer format:
///   [u32 commandCount]
///   [command0][command1]...
///
/// Each command is:
///   [u32 opcode][typed payload...]
///
/// All values are little-endian.
@MainActor
public class GLCommandBuffer {
    public static let shared = GLCommandBuffer()

    /// Fixed-size buffer (1MB should be ample for a frame's commands)
    private let capacity: Int = 1024 * 1024
    private var buffer: UnsafeMutableRawPointer
    private var offset: Int = 4  // Skip the command count header
    private var commandCount: UInt32 = 0

    private init() {
        buffer = UnsafeMutableRawPointer.allocate(byteCount: capacity, alignment: 4)
        buffer.initializeMemory(as: UInt8.self, repeating: 0, count: capacity)
    }

    // Note: GLCommandBuffer is a singleton (@MainActor), so deinit is never
    // called in practice. The buffer lives for the process lifetime.

    /// Reset for a new frame.
    public func beginFrame() {
        offset = 4
        commandCount = 0
    }

    /// Finalize the buffer and return its pointer and size.
    public func endFrame() -> (ptr: UnsafeMutableRawPointer, size: Int) {
        // Write command count at offset 0
        buffer.storeBytes(of: commandCount.littleEndian, toByteOffset: 0, as: UInt32.self)
        return (buffer, offset)
    }

    /// Get the raw buffer pointer (for WASM export).
    public var bufferPtr: UnsafeMutableRawPointer { buffer }

    /// Get the current byte size of the command buffer.
    public var byteSize: Int { offset }

    // MARK: - Command writers

    private func writeU32(_ value: UInt32) {
        guard offset + 4 <= capacity else { return }
        buffer.storeBytes(of: value.littleEndian, toByteOffset: offset, as: UInt32.self)
        offset += 4
    }

    private func writeI32(_ value: Int32) {
        guard offset + 4 <= capacity else { return }
        buffer.storeBytes(of: value.littleEndian, toByteOffset: offset, as: Int32.self)
        offset += 4
    }

    private func writeF32(_ value: Float) {
        guard offset + 4 <= capacity else { return }
        buffer.storeBytes(of: value.bitPattern.littleEndian, toByteOffset: offset, as: UInt32.self)
        offset += 4
    }

    public func clearColor(_ r: Float, _ g: Float, _ b: Float, _ a: Float) {
        writeU32(GLCmdOpcode.clearColor.rawValue)
        writeF32(r); writeF32(g); writeF32(b); writeF32(a)
        commandCount += 1
    }

    public func clear(_ mask: UInt32) {
        writeU32(GLCmdOpcode.clear.rawValue)
        writeU32(mask)
        commandCount += 1
    }

    public func bindShader(_ programId: UInt32) {
        writeU32(GLCmdOpcode.bindShader.rawValue)
        writeU32(programId)
        commandCount += 1
    }

    public func setUniform1i(_ loc: UInt32, _ val: Int32) {
        writeU32(GLCmdOpcode.setUniform1i.rawValue)
        writeU32(loc)
        writeI32(val)
        commandCount += 1
    }

    public func setUniform1f(_ loc: UInt32, _ val: Float) {
        writeU32(GLCmdOpcode.setUniform1f.rawValue)
        writeU32(loc)
        writeF32(val)
        commandCount += 1
    }

    public func setUniform3f(_ loc: UInt32, _ x: Float, _ y: Float, _ z: Float) {
        writeU32(GLCmdOpcode.setUniform3f.rawValue)
        writeU32(loc)
        writeF32(x); writeF32(y); writeF32(z)
        commandCount += 1
    }

    public func setUniform4f(_ loc: UInt32, _ x: Float, _ y: Float, _ z: Float, _ w: Float) {
        writeU32(GLCmdOpcode.setUniform4f.rawValue)
        writeU32(loc)
        writeF32(x); writeF32(y); writeF32(z); writeF32(w)
        commandCount += 1
    }

    public func setUniformMat4(_ loc: UInt32, _ mat: Mat4) {
        writeU32(GLCmdOpcode.setUniformMat4.rawValue)
        writeU32(loc)
        // Write 16 floats from column-major Mat4
        withUnsafePointer(to: mat.m) { ptr in
            ptr.withMemoryRebound(to: Float.self, capacity: 16) { p in
                for i in 0..<16 {
                    writeF32(p[i])
                }
            }
        }
        commandCount += 1
    }

    public func setUniformMat3(_ loc: UInt32, _ mat: Mat4) {
        writeU32(GLCmdOpcode.setUniformMat3.rawValue)
        writeU32(loc)
        // Extract upper-left 3x3
        writeF32(mat[column: 0, row: 0])
        writeF32(mat[column: 0, row: 1])
        writeF32(mat[column: 0, row: 2])
        writeF32(mat[column: 1, row: 0])
        writeF32(mat[column: 1, row: 1])
        writeF32(mat[column: 1, row: 2])
        writeF32(mat[column: 2, row: 0])
        writeF32(mat[column: 2, row: 1])
        writeF32(mat[column: 2, row: 2])
        commandCount += 1
    }

    public func bindVAO(_ vaoId: UInt32) {
        writeU32(GLCmdOpcode.bindVAO.rawValue)
        writeU32(vaoId)
        commandCount += 1
    }

    public func bindTexture(_ unit: UInt32, _ texId: UInt32) {
        writeU32(GLCmdOpcode.bindTexture.rawValue)
        writeU32(unit)
        writeU32(texId)
        commandCount += 1
    }

    public func drawElements(_ mode: UInt32, _ count: UInt32, _ type: UInt32, _ byteOffset: UInt32) {
        writeU32(GLCmdOpcode.drawElements.rawValue)
        writeU32(mode)
        writeU32(count)
        writeU32(type)
        writeU32(byteOffset)
        commandCount += 1
    }

    public func drawArrays(_ mode: UInt32, _ first: UInt32, _ count: UInt32) {
        writeU32(GLCmdOpcode.drawArrays.rawValue)
        writeU32(mode)
        writeU32(first)
        writeU32(count)
        commandCount += 1
    }

    public func enable(_ cap: UInt32) {
        writeU32(GLCmdOpcode.enable.rawValue)
        writeU32(cap)
        commandCount += 1
    }

    public func disable(_ cap: UInt32) {
        writeU32(GLCmdOpcode.disable.rawValue)
        writeU32(cap)
        commandCount += 1
    }

    public func blendFunc(_ src: UInt32, _ dst: UInt32) {
        writeU32(GLCmdOpcode.blendFunc.rawValue)
        writeU32(src)
        writeU32(dst)
        commandCount += 1
    }

    public func depthMask(_ flag: Bool) {
        writeU32(GLCmdOpcode.depthMask.rawValue)
        writeU32(flag ? 1 : 0)
        commandCount += 1
    }

    public func cullFace(_ face: UInt32) {
        writeU32(GLCmdOpcode.cullFace.rawValue)
        writeU32(face)
        commandCount += 1
    }

    public func setViewport(_ x: Int32, _ y: Int32, _ w: Int32, _ h: Int32) {
        writeU32(GLCmdOpcode.setViewport.rawValue)
        writeI32(x); writeI32(y); writeI32(w); writeI32(h)
        commandCount += 1
    }

    public func uploadVertexBuffer(_ bufferId: UInt32, _ dataPtr: UInt32, _ size: UInt32) {
        writeU32(GLCmdOpcode.uploadVB.rawValue)
        writeU32(bufferId)
        writeU32(dataPtr)
        writeU32(size)
        commandCount += 1
    }

    public func uploadIndexBuffer(_ bufferId: UInt32, _ dataPtr: UInt32, _ size: UInt32) {
        writeU32(GLCmdOpcode.uploadIB.rawValue)
        writeU32(bufferId)
        writeU32(dataPtr)
        writeU32(size)
        commandCount += 1
    }
}

// MARK: - WASM exports for command buffer

/// Returns pointer to the GL command buffer.
@_cdecl("EngineGetCmdBufferPtr")
@MainActor
public func EngineGetCmdBufferPtr() -> Int32 {
    return Int32(Int(bitPattern: GLCommandBuffer.shared.bufferPtr))
}

/// Returns the byte size of the current GL command buffer.
@_cdecl("EngineGetCmdBufferSize")
@MainActor
public func EngineGetCmdBufferSize() -> Int32 {
    return Int32(GLCommandBuffer.shared.byteSize)
}

/// Begin a new frame (reset command buffer).
@_cdecl("EngineBeginFrame")
@MainActor
public func EngineBeginFrame() {
    GLCommandBuffer.shared.beginFrame()
}

/// Finalize the frame and return the command count.
@_cdecl("EngineEndFrame")
@MainActor
public func EngineEndFrame() -> Int32 {
    let (_, size) = GLCommandBuffer.shared.endFrame()
    return Int32(size)
}
