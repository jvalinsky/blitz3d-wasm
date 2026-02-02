//
//  ControlFlowGraph.swift
//  Blitz3DCompiler
//
//  Data structures and builder for Relooper CFG analysis
//

public class BasicBlock: Hashable, Identifiable {
    public let id: Int
    public var label: String?
    public var instructions: [IREffect] = []
    public var terminator: Terminator = .none

    public var predecessors: Set<BasicBlock> = []
    public var successors: Set<BasicBlock> = []

    public init(id: Int, label: String? = nil) {
        self.id = id
        self.label = label
    }

    public func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }

    public static func == (lhs: BasicBlock, rhs: BasicBlock) -> Bool {
        lhs.id == rhs.id
    }
}

public enum Terminator {
    case none
    case branch(target: BasicBlock)
    case condBranch(condition: IRValue, trueTarget: BasicBlock, falseTarget: BasicBlock)
    case `return`(value: IRValue?)
    case trap
}

public final class ControlFlowGraph {
    public var blocks: [BasicBlock] = []
    public var entry: BasicBlock?

    public init() {}
}

public final class CFGBuilder {
    private struct LoopContext {
        let breakTarget: BasicBlock
        let continueTarget: BasicBlock
    }

    private var nextBlockId: Int = 0
    private var blocks: [BasicBlock] = []
    private var labelBlocks: [String: BasicBlock] = [:]

    private var currentBlock: BasicBlock

    public init() {
        let entry = BasicBlock(id: 0, label: "_entry")
        self.currentBlock = entry
        self.blocks = [entry]
        self.nextBlockId = 1
        self.labelBlocks["_entry"] = entry
    }

    public func build(from effects: [IREffect]) -> ControlFlowGraph {
        // Pass 1: pre-create blocks for all labels (including forward references).
        preScanLabels(in: effects)

        // Pass 2: build terminators and fallthrough blocks.
        var loopStack: [LoopContext] = []
        process(effects, loopStack: &loopStack)
        finishCurrentBlockIfNeeded()

        updateConnectivity()

        let cfg = ControlFlowGraph()
        cfg.blocks = blocks
        cfg.entry = blocks.first
        return cfg
    }

    private func preScanLabels(in effects: [IREffect]) {
        for effect in effects {
            switch effect {
            case .label(let name):
                _ = getOrCreateLabelBlock(name)
            case .ifStmt(_, let thenBody, let elseBody):
                preScanLabels(in: thenBody)
                if let elseBody { preScanLabels(in: elseBody) }
            case .whileStmt(_, let body):
                preScanLabels(in: body)
            case .forStmt(_, _, _, _, let body):
                preScanLabels(in: body)
            case .repeatStmt(let body, _):
                preScanLabels(in: body)
            case .block(_, let body):
                preScanLabels(in: body)
            case .loop(_, let body):
                preScanLabels(in: body)
            case .selectStmt(_, let cases, let `default`):
                for (_, body) in cases { preScanLabels(in: body) }
                if let `default` { preScanLabels(in: `default`) }
            default:
                break
            }
        }
    }

    private func getOrCreateLabelBlock(_ name: String) -> BasicBlock {
        let key = name.lowercased()
        if let existing = labelBlocks[key] {
            return existing
        }

        let block = BasicBlock(id: nextBlockId, label: name)
        nextBlockId += 1
        blocks.append(block)
        labelBlocks[key] = block
        return block
    }

    private func createBlock() -> BasicBlock {
        let block = BasicBlock(id: nextBlockId)
        nextBlockId += 1
        blocks.append(block)
        return block
    }

    private func switchToLabel(_ name: String) {
        let target = getOrCreateLabelBlock(name)

        if currentBlock !== target {
            if case .none = currentBlock.terminator {
                currentBlock.terminator = .branch(target: target)
            }
            currentBlock = target
        }
    }

    private func terminateWithBranch(to target: BasicBlock) {
        currentBlock.terminator = .branch(target: target)
        currentBlock = createBlock()
    }

    private func terminateWithReturn(_ value: IRValue?) {
        currentBlock.terminator = .return(value: value)
        currentBlock = createBlock()
    }

    private func terminateWithTrap() {
        currentBlock.terminator = .trap
        currentBlock = createBlock()
    }

    private func terminateWithCondBranch(
        condition: IRValue, trueTarget: BasicBlock, falseTarget: BasicBlock
    ) {
        currentBlock.terminator = .condBranch(
            condition: condition, trueTarget: trueTarget, falseTarget: falseTarget)
        currentBlock = falseTarget
    }

    private func finishCurrentBlockIfNeeded() {
        if case .none = currentBlock.terminator {
            currentBlock.terminator = .return(value: nil)
        }
    }

    private func process(_ effects: [IREffect], loopStack: inout [LoopContext]) {
        for effect in effects {
            switch effect {
            case .label(let name):
                switchToLabel(name)

            case .branch(let label):
                let target = getOrCreateLabelBlock(label)
                terminateWithBranch(to: target)

            case .branchIf(let condition, let label):
                let trueTarget = getOrCreateLabelBlock(label)
                let fallthroughBlock = createBlock()
                terminateWithCondBranch(
                    condition: condition, trueTarget: trueTarget, falseTarget: fallthroughBlock)

            case .returnStmt(let value):
                terminateWithReturn(value)

            case .breakStmt:
                guard let loop = loopStack.last else {
                    terminateWithTrap()
                    continue
                }
                terminateWithBranch(to: loop.breakTarget)

            case .continueStmt:
                guard let loop = loopStack.last else {
                    terminateWithTrap()
                    continue
                }
                terminateWithBranch(to: loop.continueTarget)

            case .ifStmt(let condition, let thenBody, let elseBody):
                let thenBlock = createBlock()
                let mergeBlock = createBlock()
                let elseBlock = elseBody != nil ? createBlock() : nil

                if let elseBlock {
                    currentBlock.terminator = .condBranch(
                        condition: condition, trueTarget: thenBlock, falseTarget: elseBlock)
                } else {
                    currentBlock.terminator = .condBranch(
                        condition: condition, trueTarget: thenBlock, falseTarget: mergeBlock)
                }

                currentBlock = thenBlock
                process(thenBody, loopStack: &loopStack)
                if case .none = currentBlock.terminator {
                    currentBlock.terminator = .branch(target: mergeBlock)
                }

                if let elseBlock, let elseBody {
                    currentBlock = elseBlock
                    process(elseBody, loopStack: &loopStack)
                    if case .none = currentBlock.terminator {
                        currentBlock.terminator = .branch(target: mergeBlock)
                    }
                }

                currentBlock = mergeBlock

            case .whileStmt(let condition, let body):
                let headerBlock = createBlock()
                let bodyBlock = createBlock()
                let exitBlock = createBlock()

                if case .none = currentBlock.terminator {
                    currentBlock.terminator = .branch(target: headerBlock)
                }

                headerBlock.terminator = .condBranch(
                    condition: condition, trueTarget: bodyBlock, falseTarget: exitBlock)

                let ctx = LoopContext(breakTarget: exitBlock, continueTarget: headerBlock)
                loopStack.append(ctx)

                currentBlock = bodyBlock
                process(body, loopStack: &loopStack)
                if case .none = currentBlock.terminator {
                    currentBlock.terminator = .branch(target: headerBlock)
                }

                _ = loopStack.popLast()

                currentBlock = exitBlock

            case .repeatStmt(let body, let condition):
                let bodyBlock = createBlock()
                let condBlock = createBlock()
                let exitBlock = createBlock()

                if case .none = currentBlock.terminator {
                    currentBlock.terminator = .branch(target: bodyBlock)
                }

                let ctx = LoopContext(breakTarget: exitBlock, continueTarget: condBlock)
                loopStack.append(ctx)

                currentBlock = bodyBlock
                process(body, loopStack: &loopStack)
                if case .none = currentBlock.terminator {
                    currentBlock.terminator = .branch(target: condBlock)
                }

                _ = loopStack.popLast()

                condBlock.terminator = .condBranch(
                    condition: condition, trueTarget: exitBlock, falseTarget: bodyBlock)
                currentBlock = exitBlock

            case .forStmt(let index, let start, let end, let step, let body):
                // Init in the current block.
                currentBlock.instructions.append(.assignLocal(index: index, value: start))

                let headerBlock = createBlock()
                let bodyBlock = createBlock()
                let latchBlock = createBlock()
                let exitBlock = createBlock()

                if case .none = currentBlock.terminator {
                    currentBlock.terminator = .branch(target: headerBlock)
                }

                let loopVarType = start.type
                let loopVar = IRValue.localGet(index: index, type: loopVarType)

                // For-loop direction:
                // - Positive step: continue while i <= end
                // - Negative step: continue while i >= end
                // - Unknown step: (step > 0 && i <= end) || (step < 0 && i >= end)
                let stepVal = step ?? .constI32(1)
                let cond: IRValue
                if case .constI32(let s) = stepVal {
                    if s < 0 {
                        cond = IRValue.binary(op: ">=", lhs: loopVar, rhs: end, resultType: .i32)
                    } else {
                        cond = IRValue.binary(op: "<=", lhs: loopVar, rhs: end, resultType: .i32)
                    }
                } else {
                    let zero: IRValue = .constI32(0)
                    let stepGT0 = IRValue.binary(op: ">", lhs: stepVal, rhs: zero, resultType: .i32)
                    let stepLT0 = IRValue.binary(op: "<", lhs: stepVal, rhs: zero, resultType: .i32)
                    let pos = IRValue.binary(
                        op: "And", lhs: stepGT0,
                        rhs: IRValue.binary(op: "<=", lhs: loopVar, rhs: end, resultType: .i32),
                        resultType: .i32)
                    let neg = IRValue.binary(
                        op: "And", lhs: stepLT0,
                        rhs: IRValue.binary(op: ">=", lhs: loopVar, rhs: end, resultType: .i32),
                        resultType: .i32)
                    cond = IRValue.binary(op: "Or", lhs: pos, rhs: neg, resultType: .i32)
                }
                headerBlock.terminator = .condBranch(
                    condition: cond, trueTarget: bodyBlock, falseTarget: exitBlock)

                let ctx = LoopContext(breakTarget: exitBlock, continueTarget: latchBlock)
                loopStack.append(ctx)

                currentBlock = bodyBlock
                process(body, loopStack: &loopStack)
                if case .none = currentBlock.terminator {
                    currentBlock.terminator = .branch(target: latchBlock)
                }

                _ = loopStack.popLast()

                currentBlock = latchBlock
                let incStep = step ?? .constI32(1)
                let inc = IRValue.binary(
                    op: "+", lhs: loopVar, rhs: incStep, resultType: loopVarType)
                currentBlock.instructions.append(.assignLocal(index: index, value: inc))
                currentBlock.terminator = .branch(target: headerBlock)

                currentBlock = exitBlock

            default:
                currentBlock.instructions.append(effect)
            }
        }
    }

    private func updateConnectivity() {
        for block in blocks {
            block.predecessors.removeAll()
            block.successors.removeAll()
        }

        for block in blocks {
            switch block.terminator {
            case .branch(let target):
                block.successors.insert(target)
                target.predecessors.insert(block)
            case .condBranch(_, let trueTarget, let falseTarget):
                block.successors.insert(trueTarget)
                block.successors.insert(falseTarget)
                trueTarget.predecessors.insert(block)
                falseTarget.predecessors.insert(block)
            default:
                break
            }
        }
    }
}
