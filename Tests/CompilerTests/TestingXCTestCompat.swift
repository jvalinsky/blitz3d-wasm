import Testing

// Minimal XCTest assertion compatibility for migrated suites.
// This keeps the existing tests readable while running under Swift Testing.

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

func XCTAssertNotEqual<T: Equatable>(_ lhs: @autoclosure () -> T, _ rhs: @autoclosure () -> T, _ message: @autoclosure () -> String = "", file: StaticString = #filePath, line: UInt = #line) {
    _ = message()
    #expect(lhs() != rhs())
}

func XCTAssertGreaterThan<T: Comparable>(_ lhs: @autoclosure () -> T, _ rhs: @autoclosure () -> T, _ message: @autoclosure () -> String = "", file: StaticString = #filePath, line: UInt = #line) {
    _ = message()
    #expect(lhs() > rhs())
}

func XCTAssertGreaterThanOrEqual<T: Comparable>(_ lhs: @autoclosure () -> T, _ rhs: @autoclosure () -> T, _ message: @autoclosure () -> String = "", file: StaticString = #filePath, line: UInt = #line) {
    _ = message()
    #expect(lhs() >= rhs())
}

func XCTAssertLessThan<T: Comparable>(_ lhs: @autoclosure () -> T, _ rhs: @autoclosure () -> T, _ message: @autoclosure () -> String = "", file: StaticString = #filePath, line: UInt = #line) {
    _ = message()
    #expect(lhs() < rhs())
}

func XCTAssertLessThanOrEqual<T: Comparable>(_ lhs: @autoclosure () -> T, _ rhs: @autoclosure () -> T, _ message: @autoclosure () -> String = "", file: StaticString = #filePath, line: UInt = #line) {
    _ = message()
    #expect(lhs() <= rhs())
}

func XCTAssertEqual<T: BinaryFloatingPoint>(_ lhs: @autoclosure () -> T, _ rhs: @autoclosure () -> T, accuracy: T, _ message: @autoclosure () -> String = "", file: StaticString = #filePath, line: UInt = #line) {
    _ = message()
    let a = lhs()
    let b = rhs()
    #expect((a > b ? a - b : b - a) <= accuracy)
}

func XCTAssertNoThrow<T>(_ expression: @autoclosure () throws -> T, _ message: @autoclosure () -> String = "", file: StaticString = #filePath, line: UInt = #line) {
    _ = message()
    do {
        _ = try expression()
        #expect(Bool(true))
    } catch {
        #expect(Bool(false))
    }
}
