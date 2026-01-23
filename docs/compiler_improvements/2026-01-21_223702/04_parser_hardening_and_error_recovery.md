# 04 — Parser Hardening + Error Recovery (Make the Front-End Reliable)

## Goal

Make parsing robust for large real-world sources:
- Correct handling of statement separators (`:`), newlines, and single-line forms.
- Reliable function/type boundary detection (`End Function`, `End Type`, etc.).
- Error recovery that continues parsing after malformed regions (so we can produce multiple diagnostics per file).

## Current State (observed)

- The parser is already recursive-descent and supports most constructs:
  - `../../../Sources/Compiler/Parser/Parser.swift`
- There is some synchronization logic:
  - `Parser.synchronize()` in `Parser.swift`

## Plan

### 1. Explicitly model “statement terminators”

**Action**
- Define a consistent rule for when a statement ends:
  - newline
  - colon
  - block keywords (`Else`, `ElseIf`, `EndIf`, `Wend`, `Next`, `Until`, `End Select`, `End Function`, `End Type`)

**Why**
- The most common “big file” bugs come from consuming too far and swallowing boundary keywords.

**Acceptance**
- A unit test that parses colon-chained single-line `If` + `ElseIf` + `Else` correctly.

### 2. Harden `End Function` / `End Type` detection

**Action**
- Ensure `parseFunction()` stops at the correct boundary even when:
  - nested blocks exist inside the function
  - colon-separated statements exist on the same line
  - there are stray tokens after `End Function` (should recover)

**Acceptance**
- Add “function boundary” tests using real snippets from SCPCB’s larger files.

**Cross-link**
- This is called out as a blocker in prior planning docs:
  - `../../ROADMAP_TO_BROWSER.md`

### 3. Expand error recovery strategy

**Action**
- When an error occurs inside a block, recover to the next safe boundary token.
- Keep collecting errors instead of returning nil and aborting parsing.

**Acceptance**
- A malformed file yields multiple helpful diagnostics rather than a single cascade.

### 4. Parser corpus tests

**Action**
- Add golden tests for:
  - `Select Case` with ranges
  - `Data/Read/Restore` and label binding
  - `For Each` grammar and typed iterator variable parsing
  - field access (`obj\field`) and typed identifiers

**Refs**
- BB feature usage in SCPCB: `../../../../docs/scpcb-module-analysis.md`
- Compiler reference docs: `../../../../docs/BLITZ3D_COMPILER_REFERENCE.md`

