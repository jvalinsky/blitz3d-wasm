# 11 — Relooper Algorithm Implementation Plan

## Overview
To support `Goto` and unstructured control flow in WebAssembly (which requires structured `block`/`loop` nesting), we will implement the **Relooper Algorithm** (as used in Emscripten and LLVM).

The current IR pipeline produces a linear list of `IREffect`s. While `If`/`While` are structured, `Goto` introduces arbitrary jumps. The Relooper transforms this "spaghetti" CFG (Control Flow Graph) into a valid tree of WASM blocks.

## Architecture
This will be implemented as a transformation pass on the Typed IR.

`AST` -> `Linear IR` (with Labels/Gotos) -> **`RelooperPass`** -> `Structured IR` (Nested Blocks) -> `WASM`

## Data Structures

### 1. BasicBlock
A sequence of instructions that executes linearly, ending in a transfer of control.

```swift
class BasicBlock: Hashable {
    let id: Int
    var label: String?
    var body: [IREffect] // Excluding terminator
    var terminator: Terminator
    
    // Graph connectivity
    var predecessors: Set<BasicBlock> = []
    var successors: Set<BasicBlock> = []
}

enum Terminator {
    case branch(target: BasicBlock)
    case condBranch(condition: IRValue, trueTarget: BasicBlock, falseTarget: BasicBlock)
    case `return`(value: IRValue?)
    case trap // For unreachable/error states
}
```

### 2. CFG Builder
A pass that:
1.  Scans `IRFunction.body`.
2.  Splits instructions into `BasicBlock`s at `Label` boundaries and after jumps.
3.  Resolves `Label` names to Block references.
4.  Populates `predecessors` and `successors`.

## The Algorithm (Recursive)

Function `reloop(blocks: Set<BasicBlock>) -> IREffect`

This function takes a set of blocks and returns a single structured `IREffect` (usually a `Block` or `Loop` containing others) that represents the control flow within that set.

### 1. Simple Rule
**Pattern:** One block `B` dominates the others (it's the entry point) and flows into only one other block (or leaves the set).
**Action:** 
1.  Emit `B.body`.
2.  Recurse on `blocks - {B}`.

### 2. Loop Rule
**Pattern:** The entry block `B` is the target of a back-edge (it's a loop header).
**Action:**
1.  Identify the **Loop Body**: all blocks in the set that can reach `B` without going through any other block outside the set.
2.  Emit `Loop { reloop(LoopBody) }`.
3.  Recurse on `blocks - LoopBody` (the code after the loop).

### 3. Multiple Rule (The "GOTO" Handler)
**Pattern:** Complex/Irreducible flow. We can't cleanly separate the graph.
**Action:**
1.  Emit a **State Machine**.
2.  Assign a unique ID to each entry block.
3.  Create a local variable `$state`.
4.  Emit:
    ```
    Loop {
        Switch($state) {
            Case ID_1: reloop({Block1})
            Case ID_2: reloop({Block2})
            ...
        }
        Break // Exit the dispatch loop if no continuation
    }
    ```
5.  Inside the blocks, branches become assignments to `$state` followed by `Continue`.

## Implementation Steps

### Step 1: Define CFG Types
Create `Sources/Compiler/IR/Analysis/ControlFlowGraph.swift`
- [ ] Define `BasicBlock` class and `Terminator` enum.
- [ ] Implement `CFGBuilder` to convert `[IREffect]` -> `ControlFlowGraph`.
- [ ] Handle implicit fallthroughs (e.g., label following a statement).

### Step 2: Implement Reachability Analysis
The Relooper needs to know which blocks can reach which others to identify loops.
- [ ] Implement `findReachable(from: BasicBlock, strictlyWithin: Set<BasicBlock>) -> Set<BasicBlock>`.

### Step 3: Implement Relooper Pass
Create `Sources/Compiler/IR/Passes/Relooper.swift`
- [ ] Implement the `Relooper` class.
- [ ] Implement `reloop()` recursive function.
- [ ] Handle `Multiple` shape using a `Select` (Switch) or `If/Else` chain if WASM `br_table` is tricky to target directly from high-level IR.

### Step 4: Integrate
- [ ] Update `ASTLowering` to preserve `Goto` and `Label` as explicit IR nodes (currently ignored or partially handled).
- [ ] Update `CodeGenerator` to run `RelooperPass` before emission.
- [ ] Verify `reloop` output creates valid `IREffect` trees (no dangling branches).

## Validation Strategy
1.  **Diamond Test:** simple `If/Else` flow.
2.  **Loop Test:** simple `While` loop.
3.  **Irreducible Test:** "Duff's Device" or interlaced Gotos.
4.  **Integration:** Run on `UpdateEvents.bb` (heavy Goto usage).
