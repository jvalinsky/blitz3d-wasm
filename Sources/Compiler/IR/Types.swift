
import Foundation

public enum IRType: Hashable, CustomStringConvertible {
    case i32
    case f32
    case void
    
    public var description: String {
        switch self {
        case .i32: return "i32"
        case .f32: return "f32"
        case .void: return "void"
        }
    }
    
    public var isValue: Bool {
        return self != .void
    }
}
