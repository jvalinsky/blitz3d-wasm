import Testing

@testable import Blitz3DCompiler

private func makeSpan(_ file: String, _ line: Int) -> SourceSpan {
    SourceSpan(start: SourceLocation(line: line, column: 1, sourceFile: file))
}

private func containsSourceLocation(_ effect: IREffect) -> Bool {
    switch effect {
    case .sourceLocation:
        return true
    case .ifStmt(_, let thenBody, let elseBody):
        if thenBody.contains(where: containsSourceLocation) { return true }
        if let elseBody, elseBody.contains(where: containsSourceLocation) { return true }
        return false
    case .whileStmt(_, let body),
         .forStmt(_, _, _, _, let body),
         .repeatStmt(let body, _),
         .block(_, let body),
         .loop(_, let body):
        return body.contains(where: containsSourceLocation)
    case .selectStmt(_, let cases, let `default`):
        for (_, body) in cases {
            if body.contains(where: containsSourceLocation) { return true }
        }
        if let `default`, `default`.contains(where: containsSourceLocation) { return true }
        return false
    default:
        return false
    }
}

@Test func constantFoldingPreservesSourceLocationWrapper() {
    let span = makeSpan("fold.bb", 12)
    var module = IRModule()

    let foldedValue: IRValue = .binary(
        op: "+",
        lhs: .constI32(1),
        rhs: .constI32(2),
        resultType: .i32
    )
    let eff: IREffect = .sourceLocation(
        span: span,
        body: [
            .assignLocal(index: 0, value: foldedValue),
        ]
    )

    module.functions = [
        IRFunction(
            name: "Main",
            parameters: [],
            returnType: .void,
            locals: [("x", .i32, nil)],
            body: [eff, .returnStmt(value: nil)]
        ),
    ]

    let pass = ConstantFoldingPass()
    pass.run(on: &module)

    guard case .sourceLocation(_, let body) = module.functions[0].body.first else {
        Issue.record("Expected sourceLocation wrapper to remain at function entry")
        return
    }
    guard case .assignLocal(_, let v) = body.first else {
        Issue.record("Expected assignLocal inside sourceLocation wrapper")
        return
    }
    guard case .constI32(let i) = v else {
        Issue.record("Expected folded value to be constI32(3)")
        return
    }
    #expect(i == 3)
}

@Test func cfgBuilderKeepsSourceLocations() {
    let span = makeSpan("cfg.bb", 3)
    let effects: [IREffect] = [
        .sourceLocation(span: span, body: [.assignLocal(index: 0, value: .constI32(1))]),
        .returnStmt(value: nil),
    ]

    let cfg = CFGBuilder().build(from: effects)
    #expect(cfg.entry?.instructions.contains(where: containsSourceLocation) == true)
}

@Test func relooperPreservesSourceLocationsFromCFG() {
    let span = makeSpan("reloop.bb", 7)
    let effects: [IREffect] = [
        .sourceLocation(span: span, body: [.assignLocal(index: 0, value: .constI32(1))]),
        .returnStmt(value: nil),
    ]

    let cfg = CFGBuilder().build(from: effects)
    let structured = Relooper(cfg: cfg) { 0 }.reloop()
    #expect(containsSourceLocation(structured))
}
