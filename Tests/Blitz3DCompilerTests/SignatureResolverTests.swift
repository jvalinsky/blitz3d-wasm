import Testing

@testable import Blitz3DCompiler

@Test func resolveCallPrefersExactNameOverSuffixedVariants() {
    let defExact = FunctionDefinition(params: [.i32], results: [.i32])
    let defInt = FunctionDefinition(params: [.i32], results: [.i32])

    let context = ModuleContext(
        module: WASMModule(),
        functionDefinitions: [
            "foo": defExact,
            "foo%": defInt,
        ]
    )

    let resolver = SignatureResolver(context: context)
    let r = resolver.resolveCall(forName: "Foo")

    #expect(r != nil)
    #expect(r?.resolvedName == "foo")
}

@Test func resolveCallFallsBackToSuffixedDefinitionWhenUnsuffixedMissing() {
    let defInt = FunctionDefinition(params: [], results: [.i32])
    let context = ModuleContext(
        module: WASMModule(),
        functionDefinitions: [
            "foo%": defInt,
        ]
    )

    let resolver = SignatureResolver(context: context)
    let r = resolver.resolveCall(forName: "Foo")

    #expect(r != nil)
    #expect(r?.resolvedName == "foo%")
}

@Test func resolveCallDoesNotTryOtherSuffixesWhenCallSiteHasSuffix() {
    let defInt = FunctionDefinition(params: [], results: [.i32])
    let context = ModuleContext(
        module: WASMModule(),
        functionDefinitions: [
            "foo%": defInt,
        ]
    )

    let resolver = SignatureResolver(context: context)
    let r = resolver.resolveCall(forName: "Foo#")

    #expect(r == nil)
}

