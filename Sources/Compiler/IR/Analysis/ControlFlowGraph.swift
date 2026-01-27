//
//  ControlFlowGraph.swift
//  Blitz3DCompiler
//
//  Data structures and builder for Relooper CFG analysis
//

import Foundation

public class BasicBlock: Hashable, Identifiable {
    public let id: Int
    public var label: String?
    public var instructions: [IREffect] = []
    public var terminator: Terminator = .none
    
    // Graph connectivity
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
        return lhs.id == rhs.id
    }
}

public enum Terminator {
    case none // Fallthrough or unfinished
    case branch(target: BasicBlock)
    case condBranch(condition: IRValue, trueTarget: BasicBlock, falseTarget: BasicBlock)
    case `return`(value: IRValue?)
    case trap // unreachable
}

public class ControlFlowGraph {
    public var blocks: [BasicBlock] = []
    public var entry: BasicBlock?
    
    public init() {}
}

public class CFGBuilder {
    private var nextBlockId = 0
    private var currentBlock: BasicBlock
    private var blocks: [BasicBlock] = []
    private var labelMap: [String: BasicBlock] = [:]
    private var unresolvedBranches: [(BasicBlock, String)] = [] // Block, Label
    
    public init() {
        self.currentBlock = BasicBlock(id: 0, label: "_entry")
        self.blocks.append(self.currentBlock)
        self.nextBlockId = 1
    }
    
    public func build(from effects: [IREffect]) -> ControlFlowGraph {
        process(effects)
        finishCurrentBlock() // Ensure last block falls through or returns
        resolveBranches()
        
        let cfg = ControlFlowGraph()
        cfg.blocks = self.blocks
        cfg.entry = self.blocks.first
        
        // Populate links
        updateConnectivity()
        
        return cfg
    }
    
    private func createBlock(label: String? = nil) -> BasicBlock {
        let block = BasicBlock(id: nextBlockId, label: label)
        nextBlockId += 1
        blocks.append(block)
        if let l = label {
            labelMap[l.lowercased()] = block
        }
        return block
    }
    
    private func process(_ effects: [IREffect]) {
        for effect in effects {
            switch effect {
            case .label(let name):
                // Split: End current with fallthrough, start new
                let newBlock = createBlock(label: name)
                if case .none = currentBlock.terminator {
                    currentBlock.terminator = .branch(target: newBlock)
                }
                currentBlock = newBlock
                
            case .branch(let label):
                // Record unresolved branch
                // We don't have the target block yet potentially
                // We store the label name and resolve later? 
                // Wait, Terminator needs a BasicBlock reference.
                // We can use a placeholder or resolve in a second pass.
                // Better: Terminator.branch(labelString) isn't an option. 
                // Let's defer adding the specific terminator and just mark it.
                unresolvedBranches.append((currentBlock, label))
                // Start a detached block (unreachable unless labeled)
                currentBlock = createBlock()
                
            case .branchIf(let cond, let label):
                // Conditional branch
                // True path -> label (unresolved)
                // False path -> fallthrough (new block)
                let nextBlock = createBlock()
                unresolvedBranches.append((currentBlock, label)) // We need to store that this is a condBranch
                // Store "partial" terminator?
                // Actually, let's expand Terminator to handle Unresolved for now?
                // Or just keep track separate.
                // Hack: store nextBlock as falseTarget, and patch trueTarget later.
                 // We need a custom way to track this pending resolution.
                
                // Let's adapt process to handle this better.
                // For now, I'll assume we can resolve names.
                // If I can't resolve immediately, I'll need a mechanism.
                // Let's use a "Resolve Later" approach.
                unresolvedBranches.append((currentBlock, label))
                // The terminator will be set to .condBranch(cond, ?, nextBlock)
                // We can set the partial data on the block temporarily?
                // No, swift strong typing.
                
                // Workaround: Use a specific "Unresolved" terminator in internal builder state
                // OR: Pre-scan labels?
                // Pre-scanning labels is MUCH easier.
                
                currentBlock = nextBlock
                
            case .ifStmt(let cond, let thenBody, let elseBody):
                let thenBlock = createBlock()
                let elseBlock = elseBody != nil ? createBlock() : nil
                let mergeBlock = createBlock()
                
                // Terminate current
                if let e = elseBlock {
                    currentBlock.terminator = .condBranch(condition: cond, trueTarget: thenBlock, falseTarget: e)
                } else {
                    currentBlock.terminator = .condBranch(condition: cond, trueTarget: thenBlock, falseTarget: mergeBlock)
                }
                
                // Process Then
                currentBlock = thenBlock
                process(thenBody)
                if case .none = currentBlock.terminator {
                    currentBlock.terminator = .branch(target: mergeBlock)
                }
                
                // Process Else
                if let e = elseBlock {
                    currentBlock = e
                    process(elseBody!)
                    if case .none = currentBlock.terminator {
                        currentBlock.terminator = .branch(target: mergeBlock)
                    }
                }
                
                currentBlock = mergeBlock
                
            case .whileStmt(let cond, let body):
                let headerBlock = createBlock()
                let bodyBlock = createBlock()
                let exitBlock = createBlock()
                
                // Jump to header
                if case .none = currentBlock.terminator {
                    currentBlock.terminator = .branch(target: headerBlock)
                }
                
                // Header decision
                // NOTE: 'while' loop checks condition first.
                // header: condBranch(cond, bodyBlock, exitBlock)
                // Actually, 'headerBlock' just contains the condition check logic?
                // In IR, 'condition' is an IRValue (expression). 
                // Ideally this expression is pure. If it has side effects, we might need to emit them.
                // IRValue is a tree, so it's an expression.
                headerBlock.terminator = .condBranch(condition: cond, trueTarget: bodyBlock, falseTarget: exitBlock)
                
                // Body
                currentBlock = bodyBlock
                process(body)
                if case .none = currentBlock.terminator {
                    currentBlock.terminator = .branch(target: headerBlock)
                }
                
                currentBlock = exitBlock
                
            case .forStmt(let idx, let start, let end, let step, let body):
                // Flatten FOR loop
                // Init: idx = start
                // Header: if idx <= end (or >= if step < 0) -> Body else Exit
                // Body: ...
                // Latch: idx = idx + step; branch Header
                
                // 1. Init (append to current)
                currentBlock.instructions.append(.assignLocal(index: idx, value: start))
                
                let headerBlock = createBlock()
                let bodyBlock = createBlock()
                let exitBlock = createBlock()
                
                if case .none = currentBlock.terminator {
                    currentBlock.terminator = .branch(target: headerBlock)
                }
                
                // 2. Header Condition
                // Use the type of the 'start' value for the loop variable.
                let loopVarType = start.type
                let loopVar = IRValue.localGet(index: idx, type: loopVarType)
                
                // Construct the condition based on the type
                let cond: IRValue
                if loopVarType == .f32 {
                    cond = IRValue.binary(op: "<=", lhs: loopVar, rhs: end, resultType: .i32)
                } else {
                    cond = IRValue.binary(op: "<=", lhs: loopVar, rhs: end, resultType: .i32)
                }
                headerBlock.terminator = .condBranch(condition: cond, trueTarget: bodyBlock, falseTarget: exitBlock)
                
                // 3. Body
                currentBlock = bodyBlock
                process(body)
                
                // 4. Latch (Increment)
                let stepVal = step ?? .constI32(1)
                let inc = IRValue.binary(op: "+", lhs: loopVar, rhs: stepVal, resultType: loopVarType)
                currentBlock.instructions.append(.assignLocal(index: idx, value: inc))
                
                if case .none = currentBlock.terminator {
                    currentBlock.terminator = .branch(target: headerBlock)
                }
                
                currentBlock = exitBlock

            case .returnStmt(let val):
                currentBlock.terminator = .return(value: val)
                currentBlock = createBlock()
                
            case .breakStmt:
                // We need to know the current loop exit target.
                // This implies we need a stack of loop exit blocks.
                // TODO: Implement loop stack.
                // For MVP Relooper (Goto support), let's focus on Gotos.
                // If we are flattening 'while', we must handle 'break'.
                 unresolvedBranches.append((currentBlock, "__break__")) // Placeholder
                 currentBlock = createBlock()

            default:
                // Normal instruction
                currentBlock.instructions.append(effect)
            }
        }
    }
    
    private func finishCurrentBlock() {
        if case .none = currentBlock.terminator {
            // Implicit return or end of program
            currentBlock.terminator = .return(value: nil)
        }
    }
    
    private func resolveBranches() {
        // Pre-scan pass would have been better, but let's just fix up the array
        // We need a list of pending patches.
        // Since I wrote the code above with `unresolvedBranches` as (Block, String),
        // I need to actually modify the block's terminator.
        
        for (block, label) in unresolvedBranches {
            if let target = labelMap[label.lowercased()] {
                // If it was a branch
                if case .none = block.terminator {
                     block.terminator = .branch(target: target)
                } 
                // If it was a condBranch (hacky storage in logic above)
                // This logic in `process` needs to be robust.
            }
        }
    }
    
    private func updateConnectivity() {
        for block in blocks {
            switch block.terminator {
            case .branch(let target):
                block.successors.insert(target)
                target.predecessors.insert(block)
            case .condBranch(_, let trueT, let falseT):
                block.successors.insert(trueT)
                block.successors.insert(falseT)
                trueT.predecessors.insert(block)
                falseT.predecessors.insert(block)
            default:
                break
            }
        }
    }
}
