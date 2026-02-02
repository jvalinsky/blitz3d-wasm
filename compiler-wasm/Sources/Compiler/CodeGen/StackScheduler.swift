// StackScheduler.swift
// Koopman-style Stack Scheduling Optimization
// Based on: https://users.ece.cmu.edu/~koopman/stack_compiler/stack_co.html
//
// This pass optimizes redundant local variable loads within basic blocks by:
// 1. Finding use-reuse pairs (same variable loaded multiple times)
// 2. Using local.tee instead of local.set followed by local.get
// 3. Reordering instructions when safe to keep values on the stack

import Foundation

/// Tracks access to a variable
struct VariableAccess {
    let localIndex: Int
    let instructionIndex: Int
    let isRead: Bool  // true = local.get, false = local.set
}

/// A pair of accesses to the same variable that could be optimized
struct UseReusePair {
    let localIndex: Int
    let firstAccessIndex: Int
    let secondAccessIndex: Int
    let distance: Int  // Instructions between accesses
}

/// Koopman-style Stack Scheduler
/// Optimizes redundant local variable loads within basic blocks
public final class StackScheduler {

    /// Analyze a basic block and find use-reuse pairs
    private func analyzeBlock(_ instructions: [WASMInstruction]) -> ([VariableAccess], [UseReusePair]) {
        var accesses: [VariableAccess] = []

        // Scan for local accesses
        for (index, instr) in instructions.enumerated() {
            switch instr {
            case .localGet(let idx):
                accesses.append(VariableAccess(localIndex: idx, instructionIndex: index, isRead: true))
            case .localSet(let idx):
                accesses.append(VariableAccess(localIndex: idx, instructionIndex: index, isRead: false))
            case .localTee(let idx):
                // Tee is both read and write
                accesses.append(VariableAccess(localIndex: idx, instructionIndex: index, isRead: false))
                accesses.append(VariableAccess(localIndex: idx, instructionIndex: index, isRead: true))
            default:
                break
            }
        }

        // Find use-reuse pairs (consecutive reads of the same variable)
        var pairs: [UseReusePair] = []
        var lastRead: [Int: Int] = [:]  // localIndex -> instruction index of last read

        for access in accesses {
            if access.isRead {
                if let prevIndex = lastRead[access.localIndex] {
                    // Found a reuse - same variable read again
                    let distance = access.instructionIndex - prevIndex
                    pairs.append(UseReusePair(
                        localIndex: access.localIndex,
                        firstAccessIndex: prevIndex,
                        secondAccessIndex: access.instructionIndex,
                        distance: distance
                    ))
                }
                lastRead[access.localIndex] = access.instructionIndex
            } else {
                // Write invalidates previous read for this variable
                lastRead.removeValue(forKey: access.localIndex)
            }
        }

        return (accesses, pairs)
    }

    /// Check if it's safe to use local.tee optimization
    /// The value must be used immediately after the tee (no intervening instructions that modify the local)
    private func isSafeForTee(setIndex: Int, getIndex: Int, in instructions: [WASMInstruction]) -> Bool {
        // Check that there's no other write to this local between set and get
        guard case .localSet(let localIdx) = instructions[setIndex] else { return false }
        guard case .localGet(let getLocalIdx) = instructions[getIndex] else { return false }
        guard localIdx == getLocalIdx else { return false }

        // Check intervening instructions don't write to this local
        for i in (setIndex + 1)..<getIndex {
            switch instructions[i] {
            case .localSet(let idx), .localTee(let idx):
                if idx == localIdx { return false }
            default:
                break
            }
        }

        return true
    }

    /// Optimize a basic block using Koopman's algorithm
    /// Returns the optimized instruction sequence
    public func optimize(_ instructions: [WASMInstruction]) -> [WASMInstruction] {
        var result = instructions
        var optimizationsMade = 0

        // Find set-get pairs where we can use tee instead
        var setGetPairs: [(setIndex: Int, getIndex: Int)] = []

        for i in 0..<result.count {
            guard case .localSet(let setIdx) = result[i] else { continue }

            // Look for a subsequent get of the same local
            for j in (i + 1)..<result.count {
                guard case .localGet(let getIdx) = result[j] else { continue }
                if setIdx == getIdx && isSafeForTee(setIndex: i, getIndex: j, in: result) {
                    setGetPairs.append((i, j))
                    break  // Only optimize the first reuse for now
                }
            }
        }

        // Apply optimizations in reverse order (to preserve indices)
        for (setIndex, getIndex) in setGetPairs.reversed() {
            guard case .localSet(let localIdx) = result[setIndex] else { continue }

            // Check if the get is immediately after the set (distance 1)
            // If so, we can replace set with tee and remove the get
            if getIndex == setIndex + 1 {
                // Replace localSet with localTee
                result[setIndex] = .localTee(localIdx)
                // Remove the localGet
                result.remove(at: getIndex)
                optimizationsMade += 1
            }
            // For non-adjacent pairs, we'd need more complex reordering
            // which is not safe without full dataflow analysis
        }

        if optimizationsMade > 0 {
        }

        return result
    }

    /// Optimize a function body, handling nested control flow
    public func optimizeFunction(_ body: [WASMInstruction]) -> [WASMInstruction] {
        return optimizeInstructions(body)
    }

    /// Recursively optimize instructions, handling nested blocks
    private func optimizeInstructions(_ instructions: [WASMInstruction]) -> [WASMInstruction] {
        var result: [WASMInstruction] = []

        for instr in instructions {
            switch instr {
            case .block(let blockType, let body):
                let optimizedBody = optimizeInstructions(body)
                result.append(.block(blockType, optimizeBasicBlocks(optimizedBody)))

            case .loop(let blockType, let body):
                let optimizedBody = optimizeInstructions(body)
                result.append(.loop(blockType, optimizeBasicBlocks(optimizedBody)))

            case .if(let blockType, let thenBranch, let elseBranch):
                let optimizedThen = optimizeInstructions(thenBranch)
                let optimizedElse = elseBranch.map { optimizeInstructions($0) }
                result.append(.if(blockType, optimizeBasicBlocks(optimizedThen), optimizedElse.map { optimizeBasicBlocks($0) }))

            default:
                result.append(instr)
            }
        }

        return result
    }

    /// Optimize basic blocks within a sequence of instructions
    /// A basic block is a sequence of instructions between control flow points
    private func optimizeBasicBlocks(_ instructions: [WASMInstruction]) -> [WASMInstruction] {
        var result: [WASMInstruction] = []
        var currentBlock: [WASMInstruction] = []

        for instr in instructions {
            let isControlFlow = isControlFlowInstruction(instr)

            if isControlFlow {
                // Flush current basic block
                if !currentBlock.isEmpty {
                    result.append(contentsOf: optimize(currentBlock))
                    currentBlock = []
                }
                result.append(instr)
            } else {
                currentBlock.append(instr)
            }
        }

        // Flush remaining basic block
        if !currentBlock.isEmpty {
            result.append(contentsOf: optimize(currentBlock))
        }

        return result
    }

    /// Check if an instruction is a control flow boundary
    private func isControlFlowInstruction(_ instr: WASMInstruction) -> Bool {
        switch instr {
        case .block, .loop, .if, .br, .brIf, .brTable, .return, .call, .callIndirect:
            return true
        default:
            return false
        }
    }

    /// Find potential optimizations and report them
    public func analyzeOptimizations(_ instructions: [WASMInstruction]) -> OptimizationReport {
        let (accesses, pairs) = analyzeBlock(instructions)

        var setGetPairs = 0
        var adjacentPairs = 0

        for (setIndex, getIndex) in findSetGetPairs(in: instructions) {
            setGetPairs += 1
            if getIndex == setIndex + 1 {
                adjacentPairs += 1
            }
        }

        return OptimizationReport(
            totalAccesses: accesses.count,
            readAccesses: accesses.filter { $0.isRead }.count,
            writeAccesses: accesses.filter { !$0.isRead }.count,
            reuseablePairs: pairs.count,
            setGetPairs: setGetPairs,
            optimizablePairs: adjacentPairs
        )
    }

    /// Find all set-get pairs in instructions
    private func findSetGetPairs(in instructions: [WASMInstruction]) -> [(setIndex: Int, getIndex: Int)] {
        var pairs: [(Int, Int)] = []

        for i in 0..<instructions.count {
            guard case .localSet(let setIdx) = instructions[i] else { continue }

            for j in (i + 1)..<instructions.count {
                guard case .localGet(let getIdx) = instructions[j] else { continue }
                if setIdx == getIdx && isSafeForTee(setIndex: i, getIndex: j, in: instructions) {
                    pairs.append((i, j))
                    break
                }
            }
        }

        return pairs
    }
}

/// Report of potential optimizations
public struct OptimizationReport {
    let totalAccesses: Int
    let readAccesses: Int
    let writeAccesses: Int
    let reuseablePairs: Int
    let setGetPairs: Int
    let optimizablePairs: Int

    var description: String {
        return """
        Stack Scheduling Analysis:
          Total local accesses: \(totalAccesses)
          Read accesses (local.get): \(readAccesses)
          Write accesses (local.set): \(writeAccesses)
          Reuseable read pairs: \(reuseablePairs)
          Set-get pairs: \(setGetPairs)
          Optimizable (adjacent): \(optimizablePairs)
        """
    }
}
