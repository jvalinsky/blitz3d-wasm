import Testing

@testable import Blitz3DCompiler

private func collectCallIndices(from instrs: [WASMInstruction]) -> [Int] {
    var out: [Int] = []
    func walk(_ i: WASMInstruction) {
        switch i {
        case .call(let idx):
            out.append(idx)
        case .sourceLocation(_, let inner):
            walk(inner)
        case .block(_, let body), .loop(_, let body):
            for c in body { walk(c) }
        case .if(_, let thenBody, let elseBody):
            for c in thenBody { walk(c) }
            if let elseBody { for c in elseBody { walk(c) } }
        default:
            break
        }
    }
    for i in instrs { walk(i) }
    return out
}

@Test func debugImportsUseRuntimeNames() throws {
    let source = """
    Function Main()
      Print "hi"
      If 1 Then Print "ok"
    End Function
    """

    var parser = Parser(source: source, sourceFile: "test.bb")
    let program = parser.parse()
    #expect(parser.hasErrors == false, "Parser errors: \(parser.errors)")

    let dbg = DebugGenerator()
    var gen = CodeGenerator()
    gen.enableDebugging(dbg)
    let wasm = gen.generateFromIR(program)

    // Ensure the WASM module imports the exact runtime-facing names.
    #expect(wasm.imports.contains(where: { $0.module == "bbdbg" && $0.name == "__bbdbg_enter" }))
    #expect(wasm.imports.contains(where: { $0.module == "bbdbg" && $0.name == "__bbdbg_leave" }))
    #expect(wasm.imports.contains(where: { $0.module == "bbdbg" && $0.name == "__bbdbg_stmt" }))

    // Ensure debug JSON is sane and references our source file and function.
    let json = dbg.generateJSON()
    #expect(json.contains("\"test.bb\""))
    #expect(json.lowercased().contains("\"name\" : \"main\""))
    #expect(json.contains("\"bbdbgSchemaVersion\""))
}

@Test func debugInfoEmitsStmtCallsInIRPipeline() throws {
    let source = """
    Function Main()
      Local x% = 1
      If x Then
        x = x + 1
      Else
        x = x + 2
      EndIf
      Print x
    End Function
    """

    var parser = Parser(source: source, sourceFile: "stmt.bb")
    let program = parser.parse()
    #expect(parser.hasErrors == false, "Parser errors: \(parser.errors)")

    let dbg = DebugGenerator()
    var gen = CodeGenerator()
    gen.enableDebugging(dbg)
    let wasm = gen.generateFromIR(program)

    let stmtImportIdx = try #require(
        wasm.imports.firstIndex(where: { $0.module == "bbdbg" && $0.name == "__bbdbg_stmt" })
    )

    let callIndices = wasm.code.flatMap { collectCallIndices(from: $0.body) }
    #expect(callIndices.contains(stmtImportIdx), "Expected at least one __bbdbg_stmt call in emitted WASM.")
}

@Test func noDebugInfoDoesNotImportBbdbg() {
    let source = """
    Function Main()
      Print "hi"
    End Function
    """

    var parser = Parser(source: source, sourceFile: "nodebug.bb")
    let program = parser.parse()
    #expect(parser.hasErrors == false, "Parser errors: \(parser.errors)")

    var gen = CodeGenerator()
    let wasm = gen.generateFromIR(program)
    #expect(wasm.imports.contains(where: { $0.module == "bbdbg" }) == false)
}

@Test func debugMetadataIncludesTypes() {
    let source = """
    Type Test
      Field x# = 1.0
      Field y% = 5
    End Type

    Function Main()
      Local t.Test = New Test
      Print t\\x
      Print t\\y
    End Function
    """

    var parser = Parser(source: source, sourceFile: "types.bb")
    let program = parser.parse()
    #expect(parser.hasErrors == false, "Parser errors: \(parser.errors)")

    let dbg = DebugGenerator()
    var gen = CodeGenerator()
    gen.enableDebugging(dbg)
    _ = gen.generateFromIR(program)

    let json = dbg.generateJSON()
    #expect(json.contains("\"types\""))
    #expect(json.contains("\"name\" : \"Test\""))
    #expect(json.contains("\"fields\""))
    #expect(json.contains("\"name\" : \"x\""))
    #expect(json.contains("\"name\" : \"y\""))
}
