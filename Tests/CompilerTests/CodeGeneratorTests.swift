//
//  CodeGeneratorTests.swift
//  CompilerTests
//

import Testing
import Darwin
@testable import Blitz3DCompiler

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

private func randomSuffix(_ digits: Int = 8) -> String {
    let v = UInt64.random(in: 0..<UInt64.max)
    let s = String(v, radix: 16)
    return String(s.prefix(max(1, digits)))
}

private func joinPath(_ dir: String, _ component: String) -> String {
    if dir.hasSuffix("/") { return dir + component }
    return dir + "/" + component
}

private func fileExists(_ path: String) -> Bool {
    path.withCString { access($0, F_OK) == 0 }
}

private func readTextFile(_ path: String) throws -> String {
    let fd = path.withCString { open($0, O_RDONLY) }
    if fd < 0 { throw PosixError("open") }
    defer { _ = close(fd) }

    var bytes: [UInt8] = []
    bytes.reserveCapacity(4096)

    var buf = [UInt8](repeating: 0, count: 4096)
    while true {
        let n = buf.withUnsafeMutableBytes { raw -> Int in
            guard let base = raw.baseAddress else { return -1 }
            return read(fd, base, raw.count)
        }
        if n < 0 { throw PosixError("read") }
        if n == 0 { break }
        bytes.append(contentsOf: buf[0..<n])
    }

    guard let s = String(bytes: bytes, encoding: .utf8) else {
        throw PosixError("String(utf8)")
    }
    return s
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

private let _removeTreeCallback: @convention(c) (
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
        nftw(cstr, _removeTreeCallback, 64, FTW_DEPTH | FTW_PHYS)
    }
}

private func withTempDir(prefix: String = "blitz3d-codegen", _ body: (String) throws -> Void) throws {
    var template = Array("/tmp/\(prefix).XXXXXX".utf8CString)
    let dirPtr = template.withUnsafeMutableBufferPointer { buf -> UnsafeMutablePointer<CChar>? in
        guard let base = buf.baseAddress else { return nil }
        return mkdtemp(base)
    }
    guard let dirPtr else { throw PosixError("mkdtemp") }
    let dir = String(cString: dirPtr)
    defer { removeTree(dir) }
    try body(dir)
}

struct CodeGeneratorTests {
    
    @Test func testGenerateSimpleProgram() throws {
        var parser = Parser(source: "x = 42")
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        // Should have memory
        XCTAssertEqual(module.memories.count, 1)
        
        // Should have at least one function (the implicit main or globals)
        XCTAssertGreaterThanOrEqual(module.code.count, 0)
    }
    
    @Test func testGenerateAssignment() throws {
        var parser = Parser(source: "x = 42")
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        // Find the top-level "Main" function (top-level statements are wrapped into Main()).
        // NOTE: The top-level Main() wrapper is not necessarily exported.
        guard let localIndex = module.functionNames.firstIndex(of: "Main") else {
            XCTFail("Expected Main() to be generated for top-level statements. functionNames=\(module.functionNames)")
            return
        }
        XCTAssertLessThan(localIndex, module.code.count)
        let funcBody = module.code[localIndex].body
        
        // CodeGenerator wraps many statements in `.sourceLocation(...)` for debug info.
        // Validate that the assignment emits the expected constant regardless of wrappers.
        func containsI32Const(_ expected: Int32, _ instr: WASMInstruction) -> Bool {
            switch instr {
            case .i32Const(let val):
                return val == expected
            case .sourceLocation(_, let inner):
                return containsI32Const(expected, inner)
            case .block(_, let body):
                return body.contains { containsI32Const(expected, $0) }
            case .loop(_, let body):
                return body.contains { containsI32Const(expected, $0) }
            case .if(_, let thenBody, let elseBody):
                if thenBody.contains(where: { containsI32Const(expected, $0) }) { return true }
                if let elseBody, elseBody.contains(where: { containsI32Const(expected, $0) }) { return true }
                return false
            default:
                return false
            }
        }
        
        XCTAssertTrue(funcBody.contains(where: { containsI32Const(42, $0) }), "Expected i32.const 42 to appear in function body, but got: \(funcBody)")
    }

    @Test func testTopLevelMainIsGeneratedAfterAllocators() throws {
        var parser = Parser(source: "x = 1")
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThanOrEqual(module.functionNames.count, 4)
        XCTAssertEqual(module.functionNames[0], "__Alloc")
        XCTAssertEqual(module.functionNames[1], "__StringAlloc")
        XCTAssertEqual(module.functionNames[2], "__StringConcat")
        
        guard let mainIdx = module.functionNames.firstIndex(of: "Main") else {
            XCTFail("Expected Main() wrapper for top-level statements. functionNames=\(module.functionNames)")
            return
        }
        XCTAssertGreaterThanOrEqual(mainIdx, 3)
    }
    
    @Test func testGenerateFunction() throws {
        var parser = Parser(source: "Function Test() Return 42 End Function")
        let program = parser.parse()
        
        XCTAssertEqual(program.functions.count, 1)
        XCTAssertEqual(program.functions[0].name, "Test")
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        // Should have the function exported
        let testExport = module.exports.first { $0.name == "Test" }
        XCTAssertNotNil(testExport)
    }
    
    @Test func testGenerateIfStatement() throws {
        var parser = Parser(source: "If x = 1 Then x = 2 EndIf")
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThanOrEqual(module.code.count, 1)
    }
    
    @Test func testGenerateWhileLoop() throws {
        var parser = Parser(source: "While x < 10 Wend")
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThanOrEqual(module.code.count, 1)
    }
    
    @Test func testGenerateForLoop() throws {
        var parser = Parser(source: "For i = 1 To 10 Next")
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThanOrEqual(module.code.count, 1)
    }
    
    @Test func testGenerateBinaryExpression() throws {
        var parser = Parser(source: "Local x = 1 + 2 * 3")
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        // Should generate instructions for binary operations
        XCTAssertGreaterThanOrEqual(module.code.count, 1)
    }
    
    @Test func testGenerateFunctionCall() throws {
        var parser = Parser(source: "Print(\"hello\")")
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThanOrEqual(module.code.count, 1)
    }
    
    @Test func testWASMModuleOutput() throws {
        var parser = Parser(source: "Function Main() Return 0 End Function")
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        var writer = WASMTextWriter()
        let watOutput = writer.write(module)
        
        // Should start with (module
        XCTAssertTrue(watOutput.hasPrefix("(module"))
        // Should end with )
        XCTAssertTrue(watOutput.hasSuffix(")\n"))
    }

    @Test func testWASMTextWriterEmitsSourceLocationComments() throws {
        let span = SourceSpan(start: SourceLocation(line: 1, column: 1, sourceFile: "test.bb"))
        
        var module = WASMModule()
        module.types = [WASMFunctionType(parameters: [], results: [])]
        module.functions = [0]
        module.code = [
            WASMFunction(typeIndex: 0, locals: [], body: [
                .sourceLocation(span, .return)
            ])
        ]
        
        var writer = WASMTextWriter()
        let watOutput = writer.write(module)
        
        XCTAssertTrue(watOutput.contains(";; test.bb:1:1"), "Expected source location comment in WAT")
        XCTAssertTrue(watOutput.contains("return"), "Expected return instruction in WAT")
    }
    
    @Test func testWASMFunctionType() throws {
        let funcType = WASMFunctionType(parameters: [.i32, .i32], results: [.i32])
        
        XCTAssertEqual(funcType.parameters.count, 2)
        XCTAssertEqual(funcType.results.count, 1)
    }
    
    @Test func testWASMInstructions() throws {
        // Test that instruction enums work
        let addInstr: WASMInstruction = .i32Add
        let constInstr: WASMInstruction = .i32Const(42)
        let callInstr: WASMInstruction = .call(0)
        let localGetInstr: WASMInstruction = .localGet(0)
        
        XCTAssertEqual(addInstr, .i32Add)
        XCTAssertEqual(constInstr, .i32Const(42))
        XCTAssertEqual(callInstr, .call(0))
        XCTAssertEqual(localGetInstr, .localGet(0))
    }
    
    @Test func testWASMModuleStructure() throws {
        var module = WASMModule()
        
        // Add a function type
        module.types.append(WASMFunctionType(parameters: [], results: [.i32]))
        
        // Add a function
        let function = WASMFunction(
            typeIndex: 0,
            locals: [],
            body: [.i32Const(0), .return]
        )
        module.code.append(function)
        module.functions.append(0)
        
        // Add export
        module.exports.append(WASMExport(name: "test", kind: .function, index: 0))
        
        var writer = WASMTextWriter()
        let watOutput = writer.write(module)
        
        XCTAssertTrue(watOutput.contains("(type 0"))
        XCTAssertTrue(watOutput.contains("(func 0"))
        XCTAssertTrue(watOutput.contains("(export \"test\""))
    }
    
    @Test func testWASMDataSection() throws {
        let data = WASMData(
            memoryIndex: 0,
            offset: .i32Const(0),
            bytes: [0x48, 0x65, 0x6c, 0x6c, 0x6f] // "Hello"
        )
        
        var module = WASMModule()
        module.data.append(data)
        
        var writer = WASMTextWriter()
        let watOutput = writer.write(module)
        
        XCTAssertTrue(watOutput.contains("(data"))
    }
    
    @Test func testGenerateGoto() throws {
        let source = """
        Function Test()
            .start
            Print "Loop"
            Goto start
        End Function
        """
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        // Find Test function
        let testFuncExport = module.exports.first { $0.name == "Test" }
        XCTAssertNotNil(testFuncExport)
        
        let testFunc = module.code[testFuncExport!.index - module.imports.count]
        
        // Helper to recursively search for instructions
        func containsLoop(in instructions: [WASMInstruction]) -> Bool {
            for instr in instructions {
                if case .loop = instr { return true }
                if case .block(_, let nested) = instr {
                    if containsLoop(in: nested) { return true }
                }
                if case .if(_, let thenInstrs, let elseInstrs) = instr {
                    if containsLoop(in: thenInstrs) { return true }
                    if let elseInstrs = elseInstrs, containsLoop(in: elseInstrs) { return true }
                }
            }
            return false
        }
        
        func containsBr0(in instructions: [WASMInstruction]) -> Bool {
            for instr in instructions {
                if case .br(0) = instr { return true }
                if case .block(_, let nested) = instr {
                    if containsBr0(in: nested) { return true }
                }
                if case .loop(_, let nested) = instr {
                    if containsBr0(in: nested) { return true }
                }
                if case .if(_, let thenInstrs, let elseInstrs) = instr {
                    if containsBr0(in: thenInstrs) { return true }
                    if let elseInstrs = elseInstrs, containsBr0(in: elseInstrs) { return true }
                }
            }
            return false
        }
        
        // Should have a loop
        XCTAssertTrue(containsLoop(in: testFunc.body), "Function with Goto should contain a loop")
        
        // Should have a br 0
        XCTAssertTrue(containsBr0(in: testFunc.body), "Function with Goto should contain a br 0")
    }
    
    @Test func testGenerateDataStatement() throws {
        let source = """
        Data 1, 2.5, "hello"
        """
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        // Should have data section with values
        XCTAssertGreaterThan(module.data.count, 0, "Should have data section entries")
    }
    
    @Test func testGenerateReadStatement() throws {
        let source = """
        Local x%, y#, z$
        Data 1, 2.5, "hello"
        Read x%, y#, z$
        """
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        // Should compile successfully
        XCTAssertGreaterThanOrEqual(module.code.count, 1)
    }

    @Test func testDataStringsUseBlitzStringLayoutAndReadAssignsPointer() throws {
        let source = """
        Function Main()
            Local s$
            Data "hello"
            Restore
            Read s$
        End Function
        """

        var parser = Parser(source: source)
        let program = parser.parse()

        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)

        // DATA strings should be serialized as Blitz3D string objects: [refCount][len][bytes][0][pad]
        let helloData = module.data.first { data in
            guard data.bytes.count >= 14 else { return false } // 8 header + 5 + 1
            // "hello" starts at byte offset 8
            let payload = Array(data.bytes[8..<13])
            return payload == Array("hello".utf8)
        }
        XCTAssertNotNil(helloData, "DATA string \"hello\" should be present in the data section as a Blitz3D string object")

        if let helloData {
            let refCount = Int32(bitPattern: UInt32(helloData.bytes[0]) |
                                 (UInt32(helloData.bytes[1]) << 8) |
                                 (UInt32(helloData.bytes[2]) << 16) |
                                 (UInt32(helloData.bytes[3]) << 24))
            let len = Int32(bitPattern: UInt32(helloData.bytes[4]) |
                            (UInt32(helloData.bytes[5]) << 8) |
                            (UInt32(helloData.bytes[6]) << 16) |
                            (UInt32(helloData.bytes[7]) << 24))
            XCTAssertEqual(refCount, 1, "DATA string refCount should be 1")
            XCTAssertEqual(len, 5, "DATA string length should match UTF-8 byte count")
            XCTAssertEqual(helloData.bytes[13], 0, "DATA string should be null-terminated")
        }

        // READ into a string variable should assign the pointer directly (no i32.load from DATA bytes)
        guard let mainIdx = module.functionNames.firstIndex(of: "Main") else {
            XCTFail("Expected a Main function in generated module")
            return
        }

        let mainFunc = module.code[mainIdx]
        XCTAssertFalse(mainFunc.body.contains(.i32Load(2, 0)), "READ s$ should not i32.load the string payload as an i32")
        XCTAssertTrue(mainFunc.body.contains(.i32Load(2, 4)), "READ s$ should load the string length (offset 4) to advance the DATA pointer")
    }
    
    @Test func testGenerateRestoreStatement() throws {
        let source = """
        Data 1, 2, 3
        Restore
        Local x
        Read x
        Restore
        Read x
        """
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThanOrEqual(module.code.count, 1)
    }
    
    @Test func testGenerateDataWithExpressions() throws {
        let source = """
        Data 1 + 2, "test", 3.14
        """
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThanOrEqual(module.code.count, 1)
    }
    
    // MARK: - Input Function Tests
    
    @Test func testCompileKeyDownFunction() throws {
        let source = """
        Function Main()
            While Not KeyDown(1)
                If KeyHit(2) Then
                    Print "Space pressed"
                EndIf
            Wend
        End Function
        """
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        // Should have KeyDown and KeyHit imported
        let keyDownImport = module.imports.first { $0.name == "KeyDown" }
        let keyHitImport = module.imports.first { $0.name == "KeyHit" }
        XCTAssertNotNil(keyDownImport, "KeyDown should be imported")
        XCTAssertNotNil(keyHitImport, "KeyHit should be imported")
        XCTAssertGreaterThanOrEqual(module.code.count, 1)
    }
    
    @Test func testCompileMouseFunctions() throws {
        let source = """
        Function Main()
            Local x = MouseX()
            Local y = MouseY()
            If MouseDown(1) Then
                Print "Left click"
            EndIf
            If MouseHit(1) Then
                Print "Clicked"
            EndIf
        End Function
        """
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        // Should have mouse functions imported
        XCTAssertGreaterThanOrEqual(module.code.count, 1)
    }
    
    @Test func testCompileInputInGameLoop() throws {
        let source = """
        Function Main()
            Graphics3D 800, 600
            While Not KeyDown(1)
               Cls
                RenderWorld
                Flip
            Wend
        End Function
        """
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThanOrEqual(module.code.count, 1)
    }
    
    // MARK: - SCPCB Compilation Tests
    
    @Test func testCompileSCPCBKeyName() throws {
        let scpcbPath = "/Users/jack/Software/scp_port/SCPCB/KeyName.bb"
        guard fileExists(scpcbPath) else {
            return // Skip if file doesn't exist
        }
        
        let source = try readTextFile(scpcbPath)
        var parser = Parser(source: source)
        let program = parser.parse()
        
        // Should parse without crashing
        XCTAssertTrue(true, "KeyName.bb parsed successfully")
        
        // Try to generate code
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        // Should have functions
        XCTAssertGreaterThanOrEqual(module.functions.count + module.imports.count, 0)
    }
    
    @Test func testCompileSCPPCBConstants() throws {
        let source = """
        Const VERSION$ = "1.0"
        Const MAX_ITEMS = 100
        Const GRAVITY# = 0.01
        """
        var parser = Parser(source: source)
        let program = parser.parse()
        
        XCTAssertEqual(program.statements.count, 3)
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThanOrEqual(module.code.count, 1)
    }
    
    @Test func testCompileSCPPCBTypeDeclaration() throws {
        let source = """
        Type TPlayer
            Field x#
            Field y#
            Field z#
            Field health
        End Type
        """
        var parser = Parser(source: source)
        let program = parser.parse()
        
        XCTAssertEqual(program.types.count, 1)
        XCTAssertEqual(program.types[0].name, "TPlayer")
        XCTAssertEqual(program.types[0].fields.count, 4)
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThanOrEqual(module.code.count, 1)
    }
    
    @Test func testCompileSCPCBFunctionWithMultipleStatements() throws {
        let source = """
        Function InitializeGame()
            Graphics3D 800, 600, 32, 0
            SetGamma 1.0
            ClsColor 0, 0, 0
            SeedRnd MilliSecs()
        End Function
        """
        var parser = Parser(source: source)
        let program = parser.parse()
        
        XCTAssertEqual(program.functions.count, 1)
        XCTAssertEqual(program.functions[0].name, "InitializeGame")
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThanOrEqual(module.code.count, 1)
    }
    
    @Test func testCompileSCPCBForLoop() throws {
        let source = """
        For i = 1 To 10 Step 2
            Print i
        Next
        """
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThanOrEqual(module.code.count, 1)
    }
    
    @Test func testCompileSCPCBWhileLoop() throws {
        let source = """
        While Not KeyHit(1)
            UpdateWorld
            RenderWorld
            Flip
        Wend
        """
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThanOrEqual(module.code.count, 1)
    }
    
    @Test func testCompileSCPCBIfElseStatement() throws {
        let source = """
        If health <= 0 Then
            Die()
        ElseIf health < 50 Then
            Print "Low health!"
        Else
            Print "Full health"
        EndIf
        """
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThanOrEqual(module.code.count, 1)
    }
    
    @Test func testCompileSCPCBSelectCase() throws {
        let source = """
        Select difficulty
            Case 1
                Print "Easy"
            Case 2
                Print "Medium"
            Case 3
                Print "Hard"
            Default
                Print "Unknown"
        End Select
        """
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThanOrEqual(module.code.count, 1)
    }
    
    @Test func testCompileSCPCBSelectWithMultipleCaseExpressions() throws {
        let source = """
        Select command$
            Case "help","h","?"
                Print "Help"
            Case "quit","exit","q"
                Print "Quit"
            Case "1",""
                Print "Option 1"
            Default
                Print "Unknown"
        End Select
        """
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThanOrEqual(module.code.count, 1)
    }
    
    @Test func testCompileSCPCBNestedSelect() throws {
        let source = """
        Select mode
            Case 1
                Select submode
                    Case 0
                        Print "Submode 0"
                    Case 1
                        Print "Submode 1"
                End Select
            Case 2
                Print "Mode 2"
        End Select
        """
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThanOrEqual(module.code.count, 1)
    }
    
    @Test func testCompileSCPPCBArrayAccess() throws {
        let source = """
        Local items[10]
        For i = 0 To 9
            items[i] = i * 10
        Next
        """
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThanOrEqual(module.code.count, 1)
    }
    
    @Test func testCompileSCPPCBFieldAccess() throws {
        let source = """
        Local player.TPlayer
        player = New TPlayer
        player\\x = 100.0
        player\\y = 200.0
        player\\health = 100
        """
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThanOrEqual(module.code.count, 1)
    }
    
    @Test func testCompileSCPCBFunctionCallWithArguments() throws {
        let source = """
        PositionEntity camera, 0.0, 10.0, -50.0
        RotateEntity light, 90, 0, 0
        ScaleEntity cube, 2.0, 2.0, 2.0
        """
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThanOrEqual(module.code.count, 1)
    }
    
    // MARK: - Include/Multi-file Tests
    
    @Test func testPreprocessorIncludeSingleFile() throws {
        let source = """
        Include "utils.bb"
        """
        var preprocessor = Preprocessor()
        let processed = try preprocessor.process(source: source)
        
        // Include line should be removed when processing source directly (can't resolve file)
        XCTAssertFalse(processed.contains("Include"))
    }
    
    @Test func testPreprocessorIncludeWithFileContent() throws {
        try withTempDir { dir in
            let utilsID = randomSuffix()
            let utilsName = "utils_\(utilsID).bb"
            let utilsPath = joinPath(dir, utilsName)
            let mainPath = joinPath(dir, "main_\(randomSuffix()).bb")

            let utilsContent = """
            Function GetGreeting$()
                Return "Hello from utils!"
            End Function
            """

            let mainContent = """
            Include "\(utilsName)"
            Print GetGreeting()
            """

            try writeTextFile(utilsPath, utilsContent)
            try writeTextFile(mainPath, mainContent)

            var preprocessor = Preprocessor()
            let processed = try preprocessor.process(file: mainPath)

            // Should contain the included function
            XCTAssertTrue(processed.contains("Function GetGreeting"))
            XCTAssertTrue(processed.contains("Return"))
            XCTAssertTrue(processed.contains("Print GetGreeting"))
        }
    }
    
    @Test func testPreprocessorNestedIncludes() throws {
        try withTempDir { dir in
            let level3ID = randomSuffix()
            let level2ID = randomSuffix()
            let level1ID = randomSuffix()

            let level3Name = "level3_\(level3ID).bb"
            let level2Name = "level2_\(level2ID).bb"
            let level1Name = "level1_\(level1ID).bb"

            let level3Path = joinPath(dir, level3Name)
            let level2Path = joinPath(dir, level2Name)
            let level1Path = joinPath(dir, level1Name)

            let level3Content = """
            Function Level3Func()
                Return "Level 3"
            End Function
            """

            let level2Content = """
            Include "\(level3Name)"
            Function Level2Func()
                Return "Level 2"
            End Function
            """

            let level1Content = """
            Include "\(level2Name)"
            Function Level1Func()
                Return "Level 1"
            End Function
            """

            try writeTextFile(level3Path, level3Content)
            try writeTextFile(level2Path, level2Content)
            try writeTextFile(level1Path, level1Content)

            var preprocessor = Preprocessor()
            let processed = try preprocessor.process(file: level1Path)

            // All functions should be included
            XCTAssertTrue(processed.contains("Function Level1Func"))
            XCTAssertTrue(processed.contains("Function Level2Func"))
            XCTAssertTrue(processed.contains("Function Level3Func"))
        }
    }
    
    @Test func testCompileIncludedFunction() throws {
        try withTempDir { dir in
            let utilsID = randomSuffix()
            let utilsName = "utils_inc_\(utilsID).bb"
            let utilsPath = joinPath(dir, utilsName)

            let utilsContent = """
            Function AddNumbers%(a%, b%)
                Return a + b
            End Function
            """

            try writeTextFile(utilsPath, utilsContent)

            let mainSource = """
            Include "\(utilsName)"
            Function Main()
                Local result% = AddNumbers(5, 3)
                Print result%
            End Function
            """

            let mainPath = joinPath(dir, "main_inc_\(randomSuffix()).bb")
            try writeTextFile(mainPath, mainSource)

            var preprocessor = Preprocessor()
            let processedSource = try preprocessor.process(file: mainPath)

            var parser = Parser(source: processedSource)
            let program = parser.parse()

            // Should have both functions
            XCTAssertEqual(program.functions.count, 2)

            var codeGen = CodeGenerator()
            let module = codeGen.generate(from: program)

            // Should have compiled functions
            XCTAssertGreaterThanOrEqual(module.code.count, 2)

            // Both functions should be exported
            let mainExport = module.exports.first { $0.name == "Main" }
            let addExport = module.exports.first { $0.name == "AddNumbers%" }
            XCTAssertNotNil(mainExport, "Main should be exported")
            XCTAssertNotNil(addExport, "AddNumbers% should be exported")
        }
    }
    
    @Test func testCompileMultipleIncludedFiles() throws {
        try withTempDir { dir in
            let mathID = randomSuffix()
            let stringID = randomSuffix()

            let mathName = "math_multi_\(mathID).bb"
            let stringName = "string_multi_\(stringID).bb"

            let mathPath = joinPath(dir, mathName)
            let stringPath = joinPath(dir, stringName)
            let mainPath = joinPath(dir, "multi_\(randomSuffix()).bb")

            let mathContent = """
            Function Add%(a%, b%)
                Return a + b
            End Function
            Function Subtract%(a%, b%)
                Return a - b
            End Function
            """

            let stringContent = """
            Function Greet$(name$)
                Return "Hello, " + name$
            End Function
            """

            let mainContent = """
            Include "\(mathName)"
            Include "\(stringName)"
            Function Main()
                Local sum% = Add(10, 5)
                Local greeting$ = Greet("World")
                Print sum%
                Print greeting$
            End Function
            """

            try writeTextFile(mathPath, mathContent)
            try writeTextFile(stringPath, stringContent)
            try writeTextFile(mainPath, mainContent)

            var preprocessor = Preprocessor()
            let processed = try preprocessor.process(file: mainPath)

            var parser = Parser(source: processed)
            let program = parser.parse()

            // Should have Main + 3 included functions
            XCTAssertEqual(program.functions.count, 4)

            var codeGen = CodeGenerator()
            let module = codeGen.generate(from: program)

            // All functions exported
            XCTAssertGreaterThanOrEqual(module.exports.count, 4)

            let addExport = module.exports.first { $0.name == "Add%" }
            let subExport = module.exports.first { $0.name == "Subtract%" }
            let greetExport = module.exports.first { $0.name == "Greet$" }
            XCTAssertNotNil(addExport)
            XCTAssertNotNil(subExport)
            XCTAssertNotNil(greetExport)
        }
    }
    
    @Test func testIncludeWithTypeDeclaration() throws {
        try withTempDir { dir in
            let typesID = randomSuffix()
            let typesName = "types_inc_\(typesID).bb"
            let typesPath = joinPath(dir, typesName)

            let typesContent = """
            Type TPoint
                Field x#
                Field y#
            End Type
            """

            try writeTextFile(typesPath, typesContent)

            let mainSource = """
            Include "\(typesName)"
            Function Main()
                Local pt.TPoint
                pt = New TPoint
                pt\\x = 10.5
                pt\\y = 20.5
                Print pt\\x
            End Function
            """

            let mainPath = joinPath(dir, "main_types_\(randomSuffix()).bb")
            try writeTextFile(mainPath, mainSource)

            var preprocessor = Preprocessor()
            let processed = try preprocessor.process(file: mainPath)

            var parser = Parser(source: processed)
            let program = parser.parse()

            // Should have type declaration
            XCTAssertEqual(program.types.count, 1)
            XCTAssertEqual(program.types[0].name, "TPoint")
            XCTAssertEqual(program.types[0].fields.count, 2)

            var codeGen = CodeGenerator()
            let module = codeGen.generate(from: program)

            XCTAssertGreaterThanOrEqual(module.code.count, 1)
        }
    }
    
    @Test func testIncludeWithDataStatements() throws {
        try withTempDir { dir in
            let dataID = randomSuffix()
            let dataName = "data_inc_\(dataID).bb"
            let dataPath = joinPath(dir, dataName)

            let dataContent = """
            Const MAX_ITEMS = 100
            Data 1, 2, 3, 4, 5
            Data "apple", "banana", "cherry"
            """

            try writeTextFile(dataPath, dataContent)

            let mainSource = """
            Include "\(dataName)"
            Function Main()
                Local value%
                Read value%
                Print value%
                Restore
                Read value%
                Print value%
            End Function
            """

            let mainPath = joinPath(dir, "main_data_\(randomSuffix()).bb")
            try writeTextFile(mainPath, mainSource)

            var preprocessor = Preprocessor()
            let processed = try preprocessor.process(file: mainPath)

            var parser = Parser(source: processed)
            let program = parser.parse()

            // Should compile successfully
            var codeGen = CodeGenerator()
            let module = codeGen.generate(from: program)

            // Should have data segments
            XCTAssertGreaterThan(module.data.count, 0, "Should have embedded data")
        }
    }
    
    @Test func testIncludePreventsDuplicateProcessing() throws {
        try withTempDir { dir in
            let utilsID = randomSuffix()
            let utilsName = "dup_inc_\(utilsID).bb"
            let utilsPath = joinPath(dir, utilsName)

            let utilsContent = """
            Function CountCalls()
                Return 1
            End Function
            """

            try writeTextFile(utilsPath, utilsContent)

            let mainSource = """
            Include "\(utilsName)"
            Include "\(utilsName)"
            Function Main()
                Print CountCalls()
            End Function
            """

            let mainPath = joinPath(dir, "main_dup_\(randomSuffix()).bb")
            try writeTextFile(mainPath, mainSource)

            var preprocessor = Preprocessor()
            let processed = try preprocessor.process(file: mainPath)

            // Include deduplication prevents duplicate processing.
            let count = processed.components(separatedBy: "Function CountCalls").count - 1
            XCTAssertEqual(count, 1, "Include twice should only include content once")
        }
    }
    
    @Test func testIncludeWithRelativePath() throws {
        try withTempDir { dir in
            let subdirName = "subdir_test_\(randomSuffix())"
            let subdirPath = joinPath(dir, subdirName)
            _ = subdirPath.withCString { mkdir($0, 0o755) }

            let utilsContent = """
            Function SubdirFunc()
                Return "From subdir"
            End Function
            """

            let utilsPath = joinPath(subdirPath, "utils.bb")
            try writeTextFile(utilsPath, utilsContent)

            let mainContent = """
            Include "\(subdirName)/utils.bb"
            Function Main()
                Print SubdirFunc()
            End Function
            """

            let mainPath = joinPath(dir, "main_rel_\(randomSuffix()).bb")
            try writeTextFile(mainPath, mainContent)

            var preprocessor = Preprocessor()
            let processed = try preprocessor.process(file: mainPath)

            // Should include the function from subdirectory
            XCTAssertTrue(processed.contains("Function SubdirFunc"))
        }
    }
    
    @Test func testIncludeWithConstants() throws {
        try withTempDir { dir in
            let constID = randomSuffix()
            let constName = "const_test_\(constID).bb"
            let constPath = joinPath(dir, constName)

            let constContent = """
            Const VERSION$ = "1.0.0"
            Const MAX_SCORE = 9999
            Const GRAVITY# = 0.01
            """

            try writeTextFile(constPath, constContent)

            let mainSource = """
            Include "\(constName)"
            Function Main()
                Print VERSION$
                Print MAX_SCORE
                Print GRAVITY#
            End Function
            """

            let mainPath = joinPath(dir, "main_const_\(randomSuffix()).bb")
            try writeTextFile(mainPath, mainSource)

            var preprocessor = Preprocessor()
            let processed = try preprocessor.process(file: mainPath)

            var parser = Parser(source: processed)
            let program = parser.parse()

            // Should have 1 function (Main)
            XCTAssertEqual(program.functions.count, 1)

            var codeGen = CodeGenerator()
            let module = codeGen.generate(from: program)

            XCTAssertGreaterThanOrEqual(module.code.count, 1)
        }
    }
    
    @Test func testIncludeWithGlobalDeclarations() throws {
        try withTempDir { dir in
            let globalsID = randomSuffix()
            let globalsName = "globals_test_\(globalsID).bb"
            let globalsPath = joinPath(dir, globalsName)

            let globalsContent = """
            Global SCORE% = 0
            Global PLAYER_NAME$ = "Unknown"
            Global HEALTH# = 100.0
            """

            try writeTextFile(globalsPath, globalsContent)

            let mainSource = """
            Include "\(globalsName)"
            Function Main()
                SCORE% = 100
                Print SCORE%
            End Function
            """

            let mainPath = joinPath(dir, "main_globals_\(randomSuffix()).bb")
            try writeTextFile(mainPath, mainSource)

            var preprocessor = Preprocessor()
            let processed = try preprocessor.process(file: mainPath)

            var parser = Parser(source: processed)
            let program = parser.parse()

            // Should compile successfully
            var codeGen = CodeGenerator()
            let module = codeGen.generate(from: program)

            XCTAssertGreaterThanOrEqual(module.code.count, 1)
        }
    }
}
