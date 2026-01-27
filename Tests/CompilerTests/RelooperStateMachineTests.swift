//
//  RelooperStateMachineTests.swift
//  CompilerTests
//

import XCTest
@testable import Blitz3DCompiler

final class RelooperStateMachineTests: XCTestCase {
    private func walk(_ instrs: [WASMInstruction], visit: (WASMInstruction) -> Void) {
        for instr in instrs {
            visit(instr)
            switch instr {
            case .sourceLocation(_, let inner):
                walk([inner], visit: visit)
            case .block(_, let body), .loop(_, let body):
                walk(body, visit: visit)
            case .if(_, let thenBody, let elseBody):
                walk(thenBody, visit: visit)
                if let elseBody { walk(elseBody, visit: visit) }
            default:
                break
            }
        }
    }

    func testRelooperLowersGotoToStateMachine() throws {
        // _entry -> L0 -> (if cond goto L1 else fallthrough) -> L2 -> return
        let effects: [IREffect] = [
            .label("L0"),
            .branchIf(condition: .constI32(1), label: "L1"),
            .branch(label: "L2"),
            .label("L1"),
            .branch(label: "L2"),
            .label("L2"),
            .returnStmt(value: nil)
        ]

        let cfg = CFGBuilder().build(from: effects)
        let relooper = Relooper(cfg: cfg) { 0 }
        let structured = relooper.reloop()

        let module = IRModule(
            functions: [
                IRFunction(
                    name: "Main",
                    returnType: .void,
                    locals: [("state", .i32, nil)],
                    body: [structured]
                )
            ]
        )
        let wasm = IREmitter().emit(module: module)

        var sawLoop = false
        var sawIf = false
        var sawBr0 = false

        for fn in wasm.code {
            walk(fn.body) { instr in
                switch instr {
                case .loop:
                    sawLoop = true
                case .if:
                    sawIf = true
                case .br(let depth):
                    if depth == 0 { sawBr0 = true }
                default:
                    break
                }
            }
        }

        XCTAssertTrue(sawLoop, "Expected relooper output to include a dispatch loop")
        XCTAssertTrue(sawIf, "Expected relooper output to include conditional dispatch")
        XCTAssertTrue(sawBr0, "Expected relooper output to branch back/exit via br 0")
    }
}
