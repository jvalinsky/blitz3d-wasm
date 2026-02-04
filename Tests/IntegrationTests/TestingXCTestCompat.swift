import Testing

func XCTFail(_ message: @autoclosure () -> String = "", file: StaticString = #filePath, line: UInt = #line) {
    _ = message()
    #expect(Bool(false))
}

func XCTAssertTrue(_ condition: @autoclosure () -> Bool, _ message: @autoclosure () -> String = "", file: StaticString = #filePath, line: UInt = #line) {
    _ = message()
    #expect(condition())
}

func XCTAssertFalse(_ condition: @autoclosure () -> Bool, _ message: @autoclosure () -> String = "", file: StaticString = #filePath, line: UInt = #line) {
    _ = message()
    #expect(!condition())
}

func XCTAssertNil<T>(_ value: @autoclosure () -> T?, _ message: @autoclosure () -> String = "", file: StaticString = #filePath, line: UInt = #line) {
    _ = message()
    #expect(value() == nil)
}

func XCTAssertNotNil<T>(_ value: @autoclosure () -> T?, _ message: @autoclosure () -> String = "", file: StaticString = #filePath, line: UInt = #line) {
    _ = message()
    #expect(value() != nil)
}

func XCTAssertEqual<T: Equatable>(_ lhs: @autoclosure () -> T, _ rhs: @autoclosure () -> T, _ message: @autoclosure () -> String = "", file: StaticString = #filePath, line: UInt = #line) {
    _ = message()
    #expect(lhs() == rhs())
}

func XCTAssertGreaterThan<T: Comparable>(_ lhs: @autoclosure () -> T, _ rhs: @autoclosure () -> T, _ message: @autoclosure () -> String = "", file: StaticString = #filePath, line: UInt = #line) {
    _ = message()
    #expect(lhs() > rhs())
}

func XCTAssertGreaterThanOrEqual<T: Comparable>(_ lhs: @autoclosure () -> T, _ rhs: @autoclosure () -> T, _ message: @autoclosure () -> String = "", file: StaticString = #filePath, line: UInt = #line) {
    _ = message()
    #expect(lhs() >= rhs())
}
