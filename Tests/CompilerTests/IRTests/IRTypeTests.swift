
import XCTest
@testable import Blitz3DCompiler

final class IRTypeTests: XCTestCase {
    func testTypeEquality() {
        XCTAssertEqual(IRType.i32, IRType.i32)
        XCTAssertEqual(IRType.f32, IRType.f32)
        XCTAssertNotEqual(IRType.i32, IRType.f32)
        XCTAssertEqual(IRType.void, IRType.void)
    }
    
    func testTypeDescription() {
        XCTAssertEqual(IRType.i32.description, "i32")
        XCTAssertEqual(IRType.f32.description, "f32")
        XCTAssertEqual(IRType.void.description, "void")
    }
}
