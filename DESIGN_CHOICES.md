# Blitz3D WASM Compiler: Design Choices

This document outlines the architectural and implementation decisions made for
the Blitz3D to WebAssembly compiler, specifically tailored for porting
large-scale games like **SCP: Containment Breach (SCPCB)**.

## 1. Modular Compiler Architecture

The compiler was refactored from a monolithic 2,600+ line file into a modular
system of specialized classes (`ExpressionGeneration`, `StatementGeneration`,
`FunctionGeneration`, etc.) sharing a common `ModuleContext`.

**Rationale:**

- **Maintainability:** Focused modules are easier to debug and extend.
- **Scalability:** Large game codebases (like SCPCB) require a robust structure
  to handle complex edge cases without circular dependency issues.
- **Shared State:** Using a `final class ModuleContext` allows reference-based
  sharing of the WASM module and variable maps across modules without redundant
  copies.

## 2. Memory Allocation: Size-Classed Pool Allocator

For SCPCB, we chose a **Size-Classed Pool Allocator** combined with a fallback
**Bump Allocator**.

**Design:**

- Each Blitz3D `Type` maintains its own "free stack" via a WASM global.
- `New` checks the free stack first ($O(1)$).
- `Delete` adds the object back to the free stack ($O(1)$).
- If the stack is empty, it falls back to a bump allocator that increments a
  heap pointer.

**Rationale:**

- **Speed:** SCPCB frequently creates and destroys objects (particles, room
  triggers). $O(1)$ allocation/deallocation is critical for maintaining 60 FPS.
- **Fragmentation:** By segregating by type, we eliminate fragmentation within
  size classes.
- **Sustainability:** Unlike a simple bump allocator, this allows memory reuse,
  preventing memory exhaustion during long game sessions.

## 3. Object Header & Type Safety

We implemented a **12-byte header** for all object instances:

- `Offset 0`: `__prev` (i32) - Pointer to previous instance in the type's linked
  list.
- `Offset 4`: `__next` (i32) - Pointer to next instance.
- `Offset 8`: `__typeID` (i32) - Unique identifier for the object's type.

**Rationale:**

- **Automatic Linked Lists:** Blitz3D automatically manages linked lists for
  every type. Reserving space in the header allows for $O(1)$ stitching and
  iteration.
- **Runtime Safety:** SCPCB logic often passes handles (integers) between
  systems. The `__typeID` allows the `Object.Type(handle)` cast to verify the
  object is valid and of the correct type at runtime, preventing silent memory
  corruption.

## 4. GOTO/Label Implementation (State Machine)

Blitz3D's `GOTO` and `GOSUB` are implemented using a state machine wrapper
around the function body.

**Rationale:**

- **WASM Compatibility:** WebAssembly does not support arbitrary jumps across
  block boundaries. A `br_table` based state machine allows the compiler to
  resume execution at any labeled point while adhering to structured control
  flow requirements.
