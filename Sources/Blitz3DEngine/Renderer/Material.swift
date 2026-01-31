/// Blitz3D brush / material state.
///
/// Maps to the Blitz3D brush system: a brush holds color, alpha,
/// shininess, FX flags, blend mode, and up to 2 texture references.
public class Brush {
    public let id: Int32
    public var color = Vec3(x: 1, y: 1, z: 1)
    public var alpha: Float = 1.0
    public var shininess: Float = 0.0
    public var fx: Int32 = 0
    public var blend: Int32 = 1  // 1=alpha
    public var textureId: [Int32] = [0, 0]
    public var textureBlend: [Int32] = [0, 0]

    public init(id: Int32) {
        self.id = id
    }
}

/// Manages brush allocation.
@MainActor
public class BrushManager {
    public static let shared = BrushManager()
    private var brushes: [Int32: Brush] = [:]
    private var nextId: Int32 = 1

    public func createBrush() -> Int32 {
        let id = nextId
        nextId += 1
        brushes[id] = Brush(id: id)
        return id
    }

    public func freeBrush(id: Int32) {
        brushes.removeValue(forKey: id)
    }

    public func getBrush(_ id: Int32) -> Brush? {
        return brushes[id]
    }
}

// MARK: - WASM Exports for brushes

@_cdecl("EngineCreateBrush")
@MainActor
public func EngineCreateBrush() -> Int32 {
    return BrushManager.shared.createBrush()
}

@_cdecl("EngineFreeBrush")
@MainActor
public func EngineFreeBrush(id: Int32) {
    BrushManager.shared.freeBrush(id: id)
}

@_cdecl("EngineBrushColor")
@MainActor
public func EngineBrushColor(id: Int32, r: Float, g: Float, b: Float) {
    guard let brush = BrushManager.shared.getBrush(id) else { return }
    brush.color = Vec3(x: r / 255.0, y: g / 255.0, z: b / 255.0)
}

@_cdecl("EngineBrushAlpha")
@MainActor
public func EngineBrushAlpha(id: Int32, a: Float) {
    guard let brush = BrushManager.shared.getBrush(id) else { return }
    brush.alpha = a
}

@_cdecl("EngineBrushShininess")
@MainActor
public func EngineBrushShininess(id: Int32, s: Float) {
    guard let brush = BrushManager.shared.getBrush(id) else { return }
    brush.shininess = s
}

@_cdecl("EngineBrushFX")
@MainActor
public func EngineBrushFX(id: Int32, fx: Int32) {
    guard let brush = BrushManager.shared.getBrush(id) else { return }
    brush.fx = fx
}

@_cdecl("EngineBrushBlend")
@MainActor
public func EngineBrushBlend(id: Int32, blend: Int32) {
    guard let brush = BrushManager.shared.getBrush(id) else { return }
    brush.blend = blend
}

@_cdecl("EngineBrushTexture")
@MainActor
public func EngineBrushTexture(brushId: Int32, textureId: Int32, frame: Int32, index: Int32) {
    guard let brush = BrushManager.shared.getBrush(brushId) else { return }
    let idx = Int(index)
    if idx >= 0 && idx < 2 {
        brush.textureId[idx] = textureId
    }
}
