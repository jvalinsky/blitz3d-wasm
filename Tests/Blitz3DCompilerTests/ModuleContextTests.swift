import Testing

@testable import Blitz3DCompiler

@Test func registerImportTracksBothNamesAndReusesTypes() {
    let ctx = ModuleContext(module: WASMModule())

    let idx0 = ctx.registerImport(
        name: "Foo",
        internalName: "Foo_Internal",
        params: [.i32],
        results: [],
        module: "env"
    )
    #expect(idx0 == 0)
    #expect(ctx.module.imports.count == 1)
    #expect(ctx.module.types.count == 1)

    // Both the "public" name and internal name should map to the same function index + definition.
    #expect(ctx.functionIndexMap["foo"] == 0)
    #expect(ctx.functionIndexMap["foo_internal"] == 0)
    #expect(ctx.functionDefinitions["foo"] != nil)
    #expect(ctx.functionDefinitions["foo_internal"] != nil)
    #expect(ctx.functionDefinitionsByIndex[0] != nil)
    #expect(ctx.functionOriginalNames["foo"] == "Foo")
    #expect(ctx.functionOriginalNames["foo_internal"] == "Foo_Internal")

    // A second import with the same signature should reuse the existing type index.
    let idx1 = ctx.registerImport(
        name: "Bar",
        internalName: "bar",
        params: [.i32],
        results: [],
        module: "env"
    )
    #expect(idx1 == 1)
    #expect(ctx.module.imports.count == 2)
    #expect(ctx.module.types.count == 1)
    #expect(ctx.module.imports[0].index == ctx.module.imports[1].index)
}

@Test func registerAutoImportIsIdempotent() {
    let ctx = ModuleContext(module: WASMModule())

    let idx0 = ctx.registerAutoImport(name: "Baz", params: [.i32, .i32], results: [.i32])
    let idx1 = ctx.registerAutoImport(name: "baz", params: [.i32, .i32], results: [.i32])

    #expect(idx0 == idx1)
    #expect(ctx.module.imports.count == 1)
    #expect(ctx.functionIndexMap["baz"] == idx0)
    #expect(ctx.functionDefinitionsByIndex[idx0] != nil)
}

