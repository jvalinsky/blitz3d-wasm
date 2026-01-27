//
//  Relooper.swift
//  Blitz3DCompiler
//
//  Reconstructs structured control flow for WebAssembly.
//
//  NOTE: The current implementation uses a deterministic state machine transformation.
//  This is robust for irreducible control flow (GOTO/LABEL-style graphs) and guarantees
//  that emitted IR is expressible in structured WASM via a dispatch loop.
//

import Foundation

public final class Relooper {
    private let cfg: ControlFlowGraph
    private let localAllocator: (() -> Int)?

    public init(cfg: ControlFlowGraph, localAllocator: (() -> Int)? = nil) {
        self.cfg = cfg
        self.localAllocator = localAllocator
    }

    public func reloop() -> IREffect {
        guard let entry = cfg.entry else { return .nop }
        let reachable = findReachable(from: entry, within: Set(cfg.blocks))
        return buildStateMachine(blocks: reachable, entry: entry)
    }

    // MARK: - State machine lowering

    private var stateLocalIndex: Int = -1

    private func getStateVariable() -> Int {
        if stateLocalIndex < 0 {
            if let allocator = localAllocator {
                stateLocalIndex = allocator()
            } else {
                stateLocalIndex = 9999
            }
        }
        return stateLocalIndex
    }

    private func buildStateMachine(blocks: Set<BasicBlock>, entry: BasicBlock) -> IREffect {
        if blocks.isEmpty { return .nop }

        let sortedBlocks = blocks.sorted { $0.id < $1.id }
        var stateIds: [Int: Int32] = [:]
        for (i, block) in sortedBlocks.enumerated() {
            stateIds[block.id] = Int32(i)
        }

        let stateVar = getStateVariable()
        let entryState = stateIds[entry.id] ?? 0

        var cases: [(Int32, [IREffect])] = []
        for block in sortedBlocks {
            guard let stateId = stateIds[block.id] else { continue }

            var body: [IREffect] = []
            body.append(contentsOf: block.instructions)

            switch block.terminator {
            case .branch(let target):
                if let next = stateIds[target.id] {
                    body.append(.assignLocal(index: stateVar, value: .constI32(next)))
                    body.append(.continueStmt)
                } else {
                    body.append(.breakStmt)
                }

            case .condBranch(let condition, let trueTarget, let falseTarget):
                var thenBody: [IREffect] = []
                var elseBody: [IREffect] = []

                if let next = stateIds[trueTarget.id] {
                    thenBody.append(.assignLocal(index: stateVar, value: .constI32(next)))
                    thenBody.append(.continueStmt)
                } else {
                    thenBody.append(.breakStmt)
                }

                if let next = stateIds[falseTarget.id] {
                    elseBody.append(.assignLocal(index: stateVar, value: .constI32(next)))
                    elseBody.append(.continueStmt)
                } else {
                    elseBody.append(.breakStmt)
                }

                body.append(.ifStmt(condition: condition, then: thenBody, else: elseBody))

            case .return(let value):
                body.append(.returnStmt(value: value))

            case .trap:
                body.append(.returnStmt(value: nil))

            case .none:
                body.append(.breakStmt)
            }

            cases.append((stateId, body))
        }

        let initState: IREffect = .assignLocal(index: stateVar, value: .constI32(entryState))
        let stateValue: IRValue = .localGet(index: stateVar, type: .i32)

        // Default: exit the dispatch loop.
        let dispatch: IREffect = .selectStmt(value: stateValue, cases: cases, default: [.breakStmt])

        return .block(label: "relooper_exit", body: [
            initState,
            .loop(label: "relooper_dispatch", body: [dispatch])
        ])
    }

    // MARK: - Reachability

    private func findReachable(from start: BasicBlock, within scope: Set<BasicBlock>) -> Set<BasicBlock> {
        var reachable: Set<BasicBlock> = [start]
        var queue = Array(start.successors.intersection(scope))

        while !queue.isEmpty {
            let block = queue.removeFirst()
            if !reachable.contains(block) {
                reachable.insert(block)
                queue.append(contentsOf: block.successors.intersection(scope))
            }
        }

        return reachable
    }
}
