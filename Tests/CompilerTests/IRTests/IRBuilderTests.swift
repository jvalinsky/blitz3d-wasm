
import Testing
@testable import Blitz3DCompiler

struct IRBuilderTests {
    @Test func testBuildConstI32() {
        let builder = IRBuilder()
        let value = builder.buildConstI32(42)
        if case .constI32(let val) = value {
            XCTAssertEqual(val, 42)
        } else {
            XCTFail("Expected constI32")
        }
    }
    
    @Test func testBuildBinary() {
        let builder = IRBuilder()
        let lhs = builder.buildConstI32(10)
        let rhs = builder.buildConstI32(20)
        let bin = builder.buildBinary("+", lhs: lhs, rhs: rhs, resultType: .i32)
        
        if case .binary(let op, let l, let r, let type) = bin {
            XCTAssertEqual(op, "+")
            XCTAssertEqual(type, .i32)
            if case .constI32(let lv) = l { XCTAssertEqual(lv, 10) } else { XCTFail() }
            if case .constI32(let rv) = r { XCTAssertEqual(rv, 20) } else { XCTFail() }
        } else {
            XCTFail("Expected binary")
        }
    }
    
    @Test func testFunctionScoping() {
        let builder = IRBuilder()
        builder.enterFunction(name: "test", parameters: [("a", .i32, nil)], returnType: .i32)
        builder.addLocal(name: "b", type: .f32)
        
        let a = builder.buildLocalGet("a", type: .i32)
        let b = builder.buildLocalGet("b", type: .f32)
        let unknown = builder.buildLocalGet("unknown", type: .i32)
        
        XCTAssertNotNil(a)
        XCTAssertNotNil(b)
        XCTAssertNil(unknown)
        
        if case .localGet(let idx, _) = a! {
            XCTAssertEqual(idx, 0)
        }
        if case .localGet(let idx, _) = b! {
            XCTAssertEqual(idx, 1)
        }
        
        let fn = builder.exitFunction()
        XCTAssertEqual(fn?.name, "test")
        XCTAssertEqual(fn?.parameters.count, 1)
        XCTAssertEqual(fn?.locals.count, 1)
    }
}
