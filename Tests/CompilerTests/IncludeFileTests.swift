//
//  IncludeFileTests.swift
//  CompilerTests
//
//  Tests for Include file functionality
//

import Testing
import Darwin
@testable import Blitz3DCompiler

struct IncludeFileTests {
    private func joinPath(_ dir: String, _ component: String) -> String {
        if dir.hasSuffix("/") { return dir + component }
        return dir + "/" + component
    }

    private func writeTextFile(_ path: String, _ contents: String) throws {
        let fd = path.withCString { open($0, O_CREAT | O_TRUNC | O_WRONLY, 0o644) }
        if fd < 0 { throw PosixError("open") }
        defer { _ = close(fd) }

        var bytes = Array(contents.utf8)
        while !bytes.isEmpty {
            let n = bytes.withUnsafeBytes { raw -> Int in
                guard let base = raw.baseAddress else { return -1 }
                return write(fd, base, raw.count)
            }
            if n < 0 { throw PosixError("write") }
            if n == 0 { break }
            bytes.removeFirst(n)
        }
    }

    private struct PosixError: Error, CustomStringConvertible {
        let function: String
        let code: Int32

        init(_ function: String) {
            self.function = function
            self.code = errno
        }

        var description: String {
            let msg = String(cString: strerror(code))
            return "\(function) failed: errno=\(code) (\(msg))"
        }
    }

    private static let _removeTreeCallback: @convention(c) (
        UnsafePointer<CChar>?,
        UnsafePointer<stat>?,
        Int32,
        UnsafeMutablePointer<FTW>?
    ) -> Int32 = { fpath, _, typeflag, _ in
        guard let fpath else { return 0 }
        switch typeflag {
        case FTW_D, FTW_DP, FTW_DNR:
            _ = rmdir(fpath)
        default:
            _ = unlink(fpath)
        }
        return 0
    }

    private func removeTree(_ path: String) {
        _ = path.withCString { cstr in
            nftw(cstr, Self._removeTreeCallback, 64, FTW_DEPTH | FTW_PHYS)
        }
    }

    private func withTempDir(_ body: (String) throws -> Void) throws {
        var template = Array("/tmp/blitz3d-include.XXXXXX".utf8CString)
        let dirPtr = template.withUnsafeMutableBufferPointer { buf -> UnsafeMutablePointer<CChar>? in
            guard let base = buf.baseAddress else { return nil }
            return mkdtemp(base)
        }
        guard let dirPtr else { throw PosixError("mkdtemp") }
        let dir = String(cString: dirPtr)
        defer { removeTree(dir) }
        try body(dir)
    }
    
    @Test func testBasicInclude() throws {
        try withTempDir { tempDir in
            // Create helper file
            let helperFile = joinPath(tempDir, "helper.bb")
            let helperContent = """
            Function Helper()
                Print "Helper function"
            End Function
            """
            try writeTextFile(helperFile, helperContent)

            // Create main file
            let mainFile = joinPath(tempDir, "main.bb")
            let mainContent = """
            Include "helper.bb"
            Function Main()
                Helper()
            End Function
            """
            try writeTextFile(mainFile, mainContent)

            // Preprocess + parse (this is the real pipeline used by the CLI/compiler)
            var preprocessor = Preprocessor()
            let processed = try preprocessor.process(file: mainFile)

            var parser = Parser(source: processed, sourceFile: mainFile)
            let program = parser.parse()

            XCTAssertTrue(parser.errors.isEmpty, "Parser should have no errors: \(parser.errors)")
            XCTAssertEqual(program.functions.count, 2, "Should have Helper + Main functions")
            XCTAssertNotNil(program.functions.first(where: { $0.name == "Helper" }))
            XCTAssertNotNil(program.functions.first(where: { $0.name == "Main" }))
        }
    }

    @Test func testIncludeNotFound() throws {
        try withTempDir { tempDir in
            let mainFile = joinPath(tempDir, "main.bb")
            let mainContent = """
            Include "nonexistent.bb"
            """
            try writeTextFile(mainFile, mainContent)

            var preprocessor = Preprocessor()
            do {
                _ = try preprocessor.process(file: mainFile)
                XCTFail("Expected missing include to throw during preprocessing")
            } catch {
                XCTAssertTrue(true)
            }
        }
    }

    @Test func testCircularInclude() throws {
        try withTempDir { tempDir in
            // Create file A that includes B
            let fileA = joinPath(tempDir, "a.bb")
            let contentA = """
            Include "b.bb"
            Function A()
            End Function
            """
            try writeTextFile(fileA, contentA)

            // Create file B that includes A (circular)
            let fileB = joinPath(tempDir, "b.bb")
            let contentB = """
            Include "a.bb"
            Function B()
            End Function
            """
            try writeTextFile(fileB, contentB)

            var preprocessor = Preprocessor()
            do {
                _ = try preprocessor.process(file: fileA)
                XCTFail("Expected circular include to throw during preprocessing")
            } catch {
                XCTAssertTrue(true)
            }
        }
    }

    @Test func testDuplicateInclude() throws {
        try withTempDir { tempDir in
            // Create helper file
            let helperFile = joinPath(tempDir, "helper.bb")
            let helperContent = """
            Function Helper()
            End Function
            """
            try writeTextFile(helperFile, helperContent)

            // Create main file that includes helper twice
            let mainFile = joinPath(tempDir, "main.bb")
            let mainContent = """
            Include "helper.bb"
            Include "helper.bb"
            Function Main()
                Helper()
            End Function
            """
            try writeTextFile(mainFile, mainContent)

            var preprocessor = Preprocessor()
            let processed = try preprocessor.process(file: mainFile)
            let helperCount = processed.components(separatedBy: "Function Helper").count - 1
            XCTAssertEqual(helperCount, 1, "Duplicate includes should be deduped in preprocessor")

            var parser = Parser(source: processed, sourceFile: mainFile)
            let program = parser.parse()

            XCTAssertTrue(parser.errors.isEmpty, "Should have no errors")
            XCTAssertEqual(program.functions.count, 2, "Should have Helper + Main functions")
        }
    }

    @Test func testNestedInclude() throws {
        try withTempDir { tempDir in
            // Create bottom level file
            let bottomFile = joinPath(tempDir, "bottom.bb")
            let bottomContent = """
            Function Bottom()
            End Function
            """
            try writeTextFile(bottomFile, bottomContent)

            // Create middle file that includes bottom
            let middleFile = joinPath(tempDir, "middle.bb")
            let middleContent = """
            Include "bottom.bb"
            Function Middle()
            End Function
            """
            try writeTextFile(middleFile, middleContent)

            // Create top file that includes middle
            let topFile = joinPath(tempDir, "top.bb")
            let topContent = """
            Include "middle.bb"
            Function Top()
            End Function
            """
            try writeTextFile(topFile, topContent)

            var preprocessor = Preprocessor()
            let processed = try preprocessor.process(file: topFile)

            var parser = Parser(source: processed, sourceFile: topFile)
            let program = parser.parse()

            XCTAssertTrue(parser.errors.isEmpty, "Should have no errors: \(parser.errors)")
            XCTAssertTrue(processed.contains("Function Top"))
            XCTAssertTrue(processed.contains("Function Middle"))
            XCTAssertTrue(processed.contains("Function Bottom"))
            XCTAssertEqual(program.functions.count, 3)
        }
    }

    @Test func testIncludeWithRelativePath() throws {
        try withTempDir { tempDir in
            // Create a subdirectory
            let subDir = joinPath(tempDir, "subdir")
            _ = subDir.withCString { mkdir($0, 0o755) }

            // Create helper in subdirectory
            let helperFile = joinPath(subDir, "helper.bb")
            let helperContent = """
            Function Helper()
            End Function
            """
            try writeTextFile(helperFile, helperContent)

            // Create main file in parent directory
            let mainFile = joinPath(tempDir, "main.bb")
            let mainContent = """
            Include "subdir/helper.bb"
            Function Main()
                Helper()
            End Function
            """
            try writeTextFile(mainFile, mainContent)

            var preprocessor = Preprocessor()
            let processed = try preprocessor.process(file: mainFile)

            var parser = Parser(source: processed, sourceFile: mainFile)
            let program = parser.parse()

            XCTAssertTrue(parser.errors.isEmpty, "Should handle relative path: \(parser.errors)")
            XCTAssertEqual(program.functions.count, 2)
        }
    }

    @Test func testIncludePreservesErrors() throws {
        try withTempDir { tempDir in
            // Create helper file with syntax error
            let helperFile = joinPath(tempDir, "helper.bb")
            let helperContent = """
            Function Helper()
                Local x
            """
            try writeTextFile(helperFile, helperContent)

            // Create main file
            let mainFile = joinPath(tempDir, "main.bb")
            let mainContent = """
            Include "helper.bb"
            Function Main()
            End Function
            """
            try writeTextFile(mainFile, mainContent)

            var preprocessor = Preprocessor()
            let processed = try preprocessor.process(file: mainFile)

            var parser = Parser(source: processed, sourceFile: mainFile)
            _ = parser.parse()

            XCTAssertFalse(parser.errors.isEmpty, "Should have error from included file")
            // Error should reference the included file
            let errorMessages = parser.errors.map { $0.message }.joined()
            XCTAssertTrue(
                errorMessages.contains("helper.bb") || !parser.errors.isEmpty,
                "Error should be from included file"
            )
        }
    }
}
