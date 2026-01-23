
import XCTest
@testable import Blitz3DCompiler

final class IRTypeTests: XCTestCase {
    func testIRTypeEquality() {
        XCTAssertEqual(IRType.i32, IRType.i32)
        XCTAssertEqual(IRType.f32, IRType.f32)
        XCTAssertEqual(IRType.void, IRType.void)
        XCTAssertNotEqual(IRType.i32, IRType.f32)
        XCTAssertNotEqual(IRType.i32, IRType.void)
    }
    
    func testIRTypeIsValue() {
        XCTAssertTrue(IRType.i32.isValue)
        XCTAssertTrue(IRType.f32.isValue)
        XCTAssertFalse(IRType.void.isValue)
    }
    
    func testIRTypeDescription() {
        XCTAssertEqual(IRType.i32.description, "i32")
        XCTAssertEqual(IRType.f32.description, "f32")
        XCTAssertEqual(IRType.void.description, "void")
    }
}
