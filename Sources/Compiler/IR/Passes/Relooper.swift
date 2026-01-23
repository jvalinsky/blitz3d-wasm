//
//  Relooper.swift
//  Blitz3DCompiler
//
//  Implements the Relooper algorithm to reconstruct structured control flow
//

import Foundation

public class Relooper {
    private var cfg: ControlFlowGraph
    
    public init(cfg: ControlFlowGraph) {
        self.cfg = cfg
    }
    
    public func reloop() -> IREffect {
        guard let entry = cfg.entry else { return .nop }
        
        let allBlocks = Set(cfg.blocks)
        return reloop(blocks: allBlocks, entry: entry)
    }
    
    // Recursive Relooper function
    private func reloop(blocks: Set<BasicBlock>, entry: BasicBlock) -> IREffect {
        if blocks.isEmpty { return .nop }
        
        // 1. Simple Rule
        // A block is Simple if it's the entry and it dominates the rest (which is trivial if we only pass reachable blocks)
        // and it has only one successor inside the set.
        
        // Check if entry flows to only one block (or none) within the current set
        // And entry must be the only way to reach the rest?
        // Actually, 'entry' is by definition the entry to this set.
        // We just need to check if we can peel it off.
        
        // Simple Rule:
        // If entry has 0 or 1 successors in 'blocks':
        //   Emit entry
        //   Recurse on (blocks - {entry}) with successor as new entry
        
        let internalSuccessors = entry.successors.intersection(blocks)
        
        if internalSuccessors.count <= 1 {
            let nextEntry = internalSuccessors.first
            let remainingBlocks = blocks.subtracting([entry])
            
            let nextEffect: IREffect
            if let next = nextEntry {
                 nextEffect = reloop(blocks: remainingBlocks, entry: next)
            } else {
                 nextEffect = .nop
            }
            
            // Combine entry instructions + terminator + nextEffect
            // Note: Terminator might need to be converted to structured flow
            return combineSimple(entry, next: nextEffect)
        }
        
        // 2. Loop Rule
        // Check if 'entry' can be reached from inside 'blocks' (back-edge)
        // Find Loop Body
        
        let backEdges = entry.predecessors.intersection(blocks)
        if !backEdges.isEmpty {
            // It's a loop header
            let loopBody = findLoopBody(header: entry, scope: blocks)
            
            // Recurse on Loop Body
            let loopContent = reloop(blocks: loopBody, entry: entry)
            
            // Recurse on Follow
            let followBlocks = blocks.subtracting(loopBody)
            // We need to find the entry for the follow blocks.
            // Loop exits must converge or we have multiple entries?
            // Relooper handles multiple entries via 'Multiple' block if needed.
            // But strict Loop Rule assumes clean separation.
            
            // Simplification: Assume single exit or handle via Multiple.
            // For now, let's just return Loop { content } followed by rest?
            // No, 'rest' is unreachable from 'entry' except via loop exit.
            // If we have multiple follow entries, we might need the Multiple handler for the *follow* set.
            
            if followBlocks.isEmpty {
                 return .loop(label: "loop_\(entry.id)", body: [loopContent])
            }
            
            // If there are follow blocks, we need a way to reach them.
            // The loop body must contain a 'break' to the follow code.
            // The 'reloop' of the body will handle internal structure.
            // We wrap it:
            // Block {
            //    Loop { body }
            //    follow
            // }
            // 'Break' in body targets the Block.
            
            // We need to determine the entry for followBlocks.
            // It's the set of blocks in followBlocks that are successors of loopBody.
            let followEntries = followBlocks.filter { block in
                !block.predecessors.intersection(loopBody).isEmpty
            }
            
            if followEntries.count == 1, let followEntry = followEntries.first {
                 let followContent = reloop(blocks: followBlocks, entry: followEntry)
                 return .block(label: "loop_wrapper", body: [
                     .loop(label: "loop", body: [loopContent]),
                     followContent
                 ])
            }
            
            // Fallback to Multiple if messy exits
             return handleMultiple(blocks: blocks, entries: [entry])
        }
        
        // 3. Multiple Rule
        return handleMultiple(blocks: blocks, entries: [entry])
    }
    
    private func combineSimple(_ block: BasicBlock, next: IREffect) -> IREffect {
        var effects = block.instructions
        
        // Handle terminator
        switch block.terminator {
        case .branch(let target):
            // If target is next, it's a fallthrough (nop)
            // If target is elsewhere, it's a break/continue (handled by context)
            break
        case .condBranch(let cond, let t, let f):
            // Should not happen in Simple block if count > 1, 
            // but if count <= 1, it means one branch leaves the set.
            // We need to emit the branch if it leaves.
            // TODO: Handle branching out of scope
            break
        case .return(let val):
            effects.append(.returnStmt(value: val))
        default: break
        }
        
        effects.append(next)
        return .block(label: "block_\(block.id)", body: effects)
    }
    
    private func findLoopBody(header: BasicBlock, scope: Set<BasicBlock>) -> Set<BasicBlock> {
        // BFS backwards from header's predecessors inside scope
        var body: Set<BasicBlock> = [header]
        var queue = Array(header.predecessors.intersection(scope))
        
        while !queue.isEmpty {
            let block = queue.removeFirst()
            if !body.contains(block) {
                body.insert(block)
                queue.append(contentsOf: block.predecessors.intersection(scope))
            }
        }
        return body
    }
    
    // MARK: - Multiple Rule Implementation (State Machine)
    
    /// Synthetic local variable index for state tracking
    private var stateLocalIndex: Int = -1
    
    /// Get or create the state variable index
    private func getStateVariable() -> Int {
        if stateLocalIndex < 0 {
            // Reserve a high index for the synthetic $state variable
            // In practice, this should be coordinated with the function's local count
            stateLocalIndex = 9999 // Placeholder - will be fixed during WASM emission
        }
        return stateLocalIndex
    }
    
    /// Find all blocks reachable from a given block within a scope (forward reachability)
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
    
    /// Identify all entry points into a set of blocks from outside
    private func findEntries(for blocks: Set<BasicBlock>) -> [BasicBlock] {
        return blocks.filter { block in
            // A block is an entry if it has predecessors outside the set, or no predecessors
            block.predecessors.isEmpty || !block.predecessors.isSubset(of: blocks)
        }.sorted { $0.id < $1.id }
    }
    
    /// Patch branches in an effect tree to use state variable for cross-entry jumps
    private func patchBranches(_ effect: IREffect, stateIds: [Int: Int32], scope: Set<BasicBlock>) -> IREffect {
        switch effect {
        case .block(let label, let body):
            return .block(label: label, body: body.map { patchBranches($0, stateIds: stateIds, scope: scope) })
        case .loop(let label, let body):
            return .loop(label: label, body: body.map { patchBranches($0, stateIds: stateIds, scope: scope) })
        case .ifStmt(let cond, let thenBody, let elseBody):
            return .ifStmt(
                condition: cond,
                then: thenBody.map { patchBranches($0, stateIds: stateIds, scope: scope) },
                else: elseBody?.map { patchBranches($0, stateIds: stateIds, scope: scope) }
            )
        case .whileStmt(let cond, let body):
            return .whileStmt(condition: cond, body: body.map { patchBranches($0, stateIds: stateIds, scope: scope) })
        case .forStmt(let idx, let start, let end, let step, let body):
            return .forStmt(index: idx, start: start, end: end, step: step, 
                           body: body.map { patchBranches($0, stateIds: stateIds, scope: scope) })
        case .repeatStmt(let body, let cond):
            return .repeatStmt(body: body.map { patchBranches($0, stateIds: stateIds, scope: scope) }, 
                              condition: cond)
        default:
            return effect
        }
    }
    
    /// Handle irreducible control flow using a state machine
    private func handleMultiple(blocks: Set<BasicBlock>, entries: [BasicBlock]) -> IREffect {
        // If only one entry, just process it normally
        if entries.count == 1, let single = entries.first {
            // Try Simple/Loop rules again on this subset
            let internalSuccessors = single.successors.intersection(blocks)
            if internalSuccessors.count <= 1 {
                let nextEntry = internalSuccessors.first
                let remainingBlocks = blocks.subtracting([single])
                let nextEffect: IREffect
                if let next = nextEntry, remainingBlocks.contains(next) {
                    nextEffect = reloop(blocks: remainingBlocks, entry: next)
                } else {
                    nextEffect = .nop
                }
                return combineSimple(single, next: nextEffect)
            }
        }
        
        // Multiple entries: Build a state machine
        // 1. Assign state IDs to each entry block
        var stateIds: [Int: Int32] = [:]
        for (i, entry) in entries.enumerated() {
            stateIds[entry.id] = Int32(i)
        }
        
        let stateVar = getStateVariable()
        
        // 2. Build case bodies for each entry
        var cases: [(Int32, [IREffect])] = []
        
        for entry in entries {
            guard let stateId = stateIds[entry.id] else { continue }
            
            // Find blocks reachable from this entry within scope
            let reachable = findReachable(from: entry, within: blocks)
            
            // Generate code for this entry's reachable subset
            var caseBody: [IREffect] = []
            
            // Add the entry block's instructions
            caseBody.append(contentsOf: entry.instructions)
            
            // Handle terminator
            switch entry.terminator {
            case .branch(let target):
                if let targetState = stateIds[target.id] {
                    // Jump to another entry: set state and continue loop
                    caseBody.append(.assignLocal(index: stateVar, value: .constI32(targetState)))
                    caseBody.append(.continueStmt)
                } else if reachable.contains(target) {
                    // Internal branch: recurse
                    let subset = reachable.subtracting([entry])
                    if !subset.isEmpty {
                        caseBody.append(reloop(blocks: subset, entry: target))
                    }
                }
                // Else: branch leaves scope entirely, need break
                
            case .condBranch(let cond, let trueTarget, let falseTarget):
                var thenBody: [IREffect] = []
                var elseBody: [IREffect] = []
                
                // True branch
                if let trueState = stateIds[trueTarget.id] {
                    thenBody.append(.assignLocal(index: stateVar, value: .constI32(trueState)))
                    thenBody.append(.continueStmt)
                } else if reachable.contains(trueTarget) {
                    let subset = reachable.subtracting([entry])
                    if !subset.isEmpty && subset.contains(trueTarget) {
                        thenBody.append(reloop(blocks: subset, entry: trueTarget))
                    }
                }
                
                // False branch
                if let falseState = stateIds[falseTarget.id] {
                    elseBody.append(.assignLocal(index: stateVar, value: .constI32(falseState)))
                    elseBody.append(.continueStmt)
                } else if reachable.contains(falseTarget) {
                    let subset = reachable.subtracting([entry])
                    if !subset.isEmpty && subset.contains(falseTarget) {
                        elseBody.append(reloop(blocks: subset, entry: falseTarget))
                    }
                }
                
                caseBody.append(.ifStmt(condition: cond, then: thenBody, else: elseBody.isEmpty ? nil : elseBody))
                
            case .return(let val):
                caseBody.append(.returnStmt(value: val))
                
            case .trap:
                // Unreachable
                break
                
            case .none:
                // Fallthrough or incomplete
                break
            }
            
            cases.append((stateId, caseBody))
        }
        
        // 3. Build the dispatch loop:
        //    loop {
        //        switch($state) { cases... }
        //        break  // Exit if no case continues
        //    }
        
        let stateValue: IRValue = .localGet(index: stateVar, type: .i32)
        let dispatchSwitch: IREffect = .selectStmt(value: stateValue, cases: cases, default: [.breakStmt])
        
        // Initialize state to first entry
        let initState: IREffect = .assignLocal(index: stateVar, value: .constI32(0))
        
        return .block(label: "multiple_wrapper", body: [
            initState,
            .loop(label: "dispatch", body: [dispatchSwitch])
        ])
    }
}
