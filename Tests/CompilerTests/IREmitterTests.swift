//
//  IREmitterTests.swift
//  CompilerTests
//

import XCTest
@testable import Blitz3DCompiler

final class IREmitterTests: XCTestCase {
    private func contains(_ needle: WASMInstruction, in instrs: [WASMInstruction]) -> Bool {
        for instr in instrs {
            if instr == needle { return true }
            switch instr {
            case .sourceLocation(_, let inner):
                if contains(needle, in: [inner]) { return true }
            case .block(_, let body), .loop(_, let body):
                if contains(needle, in: body) { return true }
            case .if(_, let thenBody, let elseBody):
                if contains(needle, in: thenBody) { return true }
                if let elseBody, contains(needle, in: elseBody) { return true }
            default:
                break
            }
        }
        return false
    }

    func testBranchResolvesLabelDepth() throws {
        let function = IRFunction(
            name: "Main",
            returnType: .void,
            body: [
                .block(label: "outer", body: [
                    .block(label: "inner", body: [
                        .branch(label: "outer")
                    ])
                ])
            ]
        )

        let module = IRModule(functions: [function])
        let wasm = IREmitter().emit(module: module)

        // Inside `inner`, branching to `outer` should be depth 1.
        XCTAssertTrue(
            wasm.code.contains { contains(WASMInstruction.br(1), in: $0.body) },
            "Expected branch to outer block to emit br(1)"
        )
    }

    func testDeclaresLocalsIndependentlyFromParameters() throws {
        let function = IRFunction(
            name: "Main",
            parameters: [("p", .i32, nil)],
            returnType: .void,
            locals: [("l", .i32, nil)],
            body: [
                .assignLocal(index: 1, value: .constI32(1))
            ]
        )

        let module = IRModule(functions: [function])
        let wasm = IREmitter().emit(module: module)

        XCTAssertEqual(
            wasm.code.first?.locals.count,
            1,
            "Expected exactly one WASM local (excluding the parameter)"
        )
    }

    func testAssignFieldEncodesMemArgAlignAndOffset() throws {
        let function = IRFunction(
            name: "Main",
            returnType: .void,
            body: [
                .assignField(
                    base: .constI32(0),
                    fieldOffset: 44,
                    fieldType: .i32,
                    value: .constI32(123)
                )
            ]
        )

        let module = IRModule(functions: [function])
        let wasm = IREmitter().emit(module: module)

        XCTAssertTrue(
            wasm.code.contains { $0.body.contains(.i32Store(2, 44)) },
            "Expected i32.store with align=2 and offset=44"
        )
    }

    func testAssignFieldUsesF32StoreForF32Fields() throws {
        let function = IRFunction(
            name: "Main",
            returnType: .void,
            body: [
                .assignField(
                    base: .constI32(0),
                    fieldOffset: 44,
                    fieldType: .f32,
                    value: .constF32(1.25)
                )
            ]
        )

        let module = IRModule(functions: [function])
        let wasm = IREmitter().emit(module: module)

        XCTAssertTrue(
            wasm.code.contains { $0.body.contains(.f32Store(2, 44)) },
            "Expected f32.store with align=2 and offset=44"
        )
    }

    func testBeforeAfterLoadUseCorrectMemArg() throws {
        let function = IRFunction(
            name: "Main",
            returnType: .void,
            body: [
                .discard(.before(value: .constI32(0))),
                .discard(.after(value: .constI32(0)))
            ]
        )

        let module = IRModule(functions: [function])
        let wasm = IREmitter().emit(module: module)

        XCTAssertTrue(
            wasm.code.contains { $0.body.contains(WASMInstruction.i32Load(2, 0)) },
            "Expected i32.load with align=2 and offset=0 for .before"
        )
        XCTAssertTrue(
            wasm.code.contains { $0.body.contains(WASMInstruction.i32Load(2, 4)) },
            "Expected i32.load with align=2 and offset=4 for .after"
        )
    }
}
