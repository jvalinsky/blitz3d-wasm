//
//  CFGBuilderTests.swift
//  CompilerTests
//

import Testing
@testable import Blitz3DCompiler

struct CFGBuilderTests {
    @Test func testForwardGotoResolvesLabel() throws {
        let effects: [IREffect] = [
            .branch(label: "L1"),
            .discard(.constI32(123)),
            .label("L1"),
            .returnStmt(value: nil)
        ]

        let cfg = CFGBuilder().build(from: effects)
        guard let entry = cfg.entry else {
            XCTFail("Missing CFG entry")
            return
        }

        guard case .branch(let target) = entry.terminator else {
            XCTFail("Expected entry to end with branch")
            return
        }

        XCTAssertEqual(target.label?.lowercased(), "l1")
    }

    @Test func testBranchIfCreatesCondBranchWithFallthrough() throws {
        let effects: [IREffect] = [
            .branchIf(condition: .constI32(1), label: "T"),
            .discard(.constI32(10)),
            .label("T"),
            .returnStmt(value: nil)
        ]

        let cfg = CFGBuilder().build(from: effects)
        guard let entry = cfg.entry else {
            XCTFail("Missing CFG entry")
            return
        }

        guard case .condBranch(_, let trueTarget, let falseTarget) = entry.terminator else {
            XCTFail("Expected entry to end with condBranch")
            return
        }

        XCTAssertEqual(trueTarget.label?.lowercased(), "t")
        XCTAssertNil(falseTarget.label)
    }

    @Test func testBreakTargetsExitBlockInWhile() throws {
        let effects: [IREffect] = [
            .whileStmt(condition: .constI32(1), body: [
                .breakStmt,
                .discard(.constI32(999))
            ])
        ]

        let cfg = CFGBuilder().build(from: effects)
        guard let entry = cfg.entry else {
            XCTFail("Missing CFG entry")
            return
        }

        guard case .branch(let header) = entry.terminator else {
            XCTFail("Expected entry to branch to while header")
            return
        }

        guard case .condBranch(_, let bodyBlock, let exitBlock) = header.terminator else {
            XCTFail("Expected while header to be a condBranch")
            return
        }

        guard case .branch(let target) = bodyBlock.terminator else {
            XCTFail("Expected body block to be terminated by a branch")
            return
        }

        XCTAssertTrue(target === exitBlock, "Expected break to branch to loop exit")
    }

    @Test func testContinueTargetsHeaderInWhile() throws {
        let effects: [IREffect] = [
            .whileStmt(condition: .constI32(1), body: [
                .continueStmt,
                .discard(.constI32(999))
            ])
        ]

        let cfg = CFGBuilder().build(from: effects)
        guard let entry = cfg.entry else {
            XCTFail("Missing CFG entry")
            return
        }

        guard case .branch(let header) = entry.terminator else {
            XCTFail("Expected entry to branch to while header")
            return
        }

        guard case .condBranch(_, let bodyBlock, _) = header.terminator else {
            XCTFail("Expected while header to be a condBranch")
            return
        }

        guard case .branch(let target) = bodyBlock.terminator else {
            XCTFail("Expected body block to be terminated by a branch")
            return
        }

        XCTAssertTrue(target === header, "Expected continue to branch to loop header")
    }
}
