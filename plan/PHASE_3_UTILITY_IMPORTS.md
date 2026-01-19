# Phase 3: Utility Imports

This phase fills the gaps in core string, math, and system utilities.

## 1. Core Built-ins
Missing fundamental functions used for data parsing and debugging.

### Tasks:
- [ ] **CodeGenerator:** Add imports for:
    - `Asc(string$)`
    - `Chr$(code)`
    - `Hex$(value)`
    - `Bin$(value)`
- [ ] **Runtime (JS):** Implement using standard JavaScript `charCodeAt`, `String.fromCharCode`, and `toString(16/2)`.

## 2. System Timing & Logic
Required for game state management and frame-independent logic.

### Tasks:
- [ ] **CodeGenerator:** Add imports for:
    - `MilliSecs()`
    - `AppTitle(title$, [close_prompt$])`
    - `Delay(ms)`
- [ ] **Runtime (JS):** 
    - `MilliSecs` -> `performance.now()`.
    - `AppTitle` -> `document.title`.
    - `Delay` -> Implement as a blocking loop or async wait if supported.

## 3. Input Expansion
Support for more complex input patterns.

### Tasks:
- [ ] **CodeGenerator:** Add imports for:
    - `WaitKey()`
    - `FlushKeys()`
    - `MouseXSpeed()`, `MouseYSpeed()`
- [ ] **Runtime (JS):** Update event listeners to track delta movement and key buffers.

## Verification
- Compile and validate `Blitz_Basic_Bank.bb`.
- Ensure `validate_compiler.sh` passes for all math and string utility files in `scpcb/`.
