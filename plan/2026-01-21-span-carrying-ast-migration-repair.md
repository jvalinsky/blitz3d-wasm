# 2026-01-21 — Span-Carrying AST Migration Repair Plan

## Context

We are migrating the compiler AST to carry `SourceSpan` at the enum-layer:

- `StatementNode` cases are now `case foo(FooNode, SourceSpan)` (or similar).
- `ExpressionNode` cases are now `case bar(BarNode, SourceSpan)` (or similar).

The build currently fails because several compiler subsystems still pattern-match enum cases as if they had a single associated value (or construct enum cases without providing the required `SourceSpan`). Swift also warns that matching multi-associated-value cases “as a tuple” is deprecated.

This plan is designed to minimize churn:

- Do **not** “panic revert” after partial compiler failures.
- Avoid compiling after every small edit; instead, fix a whole category across a file-set, then do a single build to validate.

## Symptoms (from `/tmp/swift_build.log`)

### Category A — Tuple-pattern matches against span-carrying cases

Typical failure patterns:

- `case .binary(let binaryOp):` → `binaryOp` becomes `(BinaryOpNode, SourceSpan)` so `binaryOp.op` fails.
- `case .label(let name):` → `name` becomes `(String, SourceSpan)` so dictionary subscripts misbehave.
- `if case .identifier(let id) = expr { ... id.name ... }` → `id` becomes `(IdentifierNode, SourceSpan)`.

Typical fix:

- Destructure the case: `case .binary(let binaryOp, _):`
- Or `if case .identifier(let id, _) = expr { ... }`

### Category B — Case construction missing the new span argument

Typical failure patterns:

- `.functionCall(call)` now requires `.functionCall(call, span)`
- `.fieldAccess(fieldAccess)` now requires `.fieldAccess(fieldAccess, span)`

Standardize on one of these strategies:

1. Prefer using an existing span (e.g. `call.span` if `FunctionCallNode` already carries one).
2. Otherwise use `SourceSpan.unknown` (or an equivalent sentinel) for synthetic nodes created during codegen.

### Category C — Arity changes in “special” expression cases

Some expression cases are multi-argument beyond `(payload, span)`. Example observed:

- `.objectCast` is `(String, ExpressionNode, SourceSpan)`

Fix patterns must match the correct arity:

- `case .objectCast(let type, _, _):` (not `case .objectCast(let type, _)`)

### Category D — “type Any has no member …” inside instruction arrays

Example from `ExpressionGeneration.swift`:

- `instrs.append(.if(.i32, [ .globalGet(...) ], [ .i32Const(0) ]))`
- Error: `type 'Any' has no member 'globalGet'`

This usually means the array literals lost type context (Swift inferred `[Any]`) because the surrounding `.if(...)` call is no longer type-checking cleanly. Fix the upstream mismatch first (often a signature/argument mismatch), and/or add explicit array typing:

- `let thenInstrs: [WasmInstruction] = [ .globalGet(...) ]`
- `let elseInstrs: [WasmInstruction] = [ .i32Const(0) ]`

## Repair Strategy (Order Matters)

The goal is to get back to a clean build with *consistent* span-carrying enums, without repeatedly undoing work.

### Step 1 — Make CodeGen compile against the new AST (highest leverage)

Fix the CodeGen layer first because it touches most enum patterns and tends to produce the most errors.

Primary file groups:

1. `Sources/Compiler/CodeGen/TypeHandling.swift`
2. `Sources/Compiler/CodeGen/FunctionGeneration.swift`
3. `Sources/Compiler/CodeGen/ExpressionGeneration.swift`
4. `Sources/Compiler/CodeGen/StatementGeneration.swift`
5. Any remaining `Sources/Compiler/CodeGen/*.swift` files that pattern-match `StatementNode` / `ExpressionNode`

For each file:

- Replace tuple-pattern matches (`case .foo(let x):`) with destructured matches (`case .foo(let x, _):`).
- Update `if case .foo(let x) = …` similarly.
- Update enum constructions to pass a span (`.foo(payload, payloadSpanOrUnknown)`).
- Fix “special arity” cases like `.insert(..., ..., span)` and `.objectCast(type, expr, span)`.

Expected outcome:

- Deprecation warnings disappear (or reduce sharply).
- All “tuple has no member …” errors disappear.

### Step 2 — Verify Parser is producing the new enum shapes consistently

Once CodeGen compiles, ensure the Parser is returning the correct arity for every node it emits.

Checks:

- Every `return .integerLiteral(value, span)`-style call matches the new enum definition.
- Every `return .identifier(IdentifierNode(...), span)` is consistent.
- Ensure helper methods that synthesize nodes set span sanely (`startSpan()`/`endSpan(from:)`).

Goal:

- Parser produces spans for all nodes so runtime debugging can rely on them.

### Step 3 — Validator / TypeInference / Utilities sweep

Anything that inspects AST must be updated:

- `TypeInference.swift` (pattern matches, constant folding checks)
- `ValidatorTypeContext` conformances, if they switch on statements/expressions
- Any helper code in `Sources/Compiler/*` that assumes old arity

### Step 4 — Add “Span ergonomics” helpers (optional but recommended)

To reduce future churn and make debugging features easier to build:

- Add helpers to unwrap payloads while ignoring span:
  - e.g. `ExpressionNode.payload` or `ExpressionNode.destructureBinary()`
- Add helpers to construct new nodes with a default span:
  - e.g. `ExpressionNode.binary(_ node: BinaryOpNode, span: SourceSpan = .unknown)`

Only do this *after* the basic build is green, to avoid adding more moving parts mid-repair.

### Step 5 — One validation build at the end of the sweep

Run one build once Steps 1–3 are complete:

- `SWIFTPM_CUSTOM_CACHE_PATH=/tmp/swiftpm-cache swift build -c debug --product blitz3d-wasm > /tmp/swift_build.log`

Then iterate based on the new `/tmp/swift_build.log` until clean.

## Practical “Search & Fix” Checklist

Run targeted searches to find remaining broken patterns (examples):

- `rg -n \"case \\.([A-Za-z0-9_]+)\\(let\" Sources/Compiler/CodeGen`
- `rg -n \"if case \\.([A-Za-z0-9_]+)\\(let\" Sources/Compiler/CodeGen`
- `rg -n \"\\.functionCall\\(\" Sources/Compiler/CodeGen`
- `rg -n \"\\.fieldAccess\\(\" Sources/Compiler/CodeGen`
- `rg -n \"\\.integerLiteral\\(\" Sources/Compiler`

Fix rule-of-thumb:

- If the enum case is defined as `case X(Y, SourceSpan)`:
  - Matching must be `case .X(let y, _)`
  - Construction must be `.X(y, span)`

## Notes for Debugger Work (Why This Matters)

Once this compiles cleanly:

- Every statement/expression has a `SourceSpan`.
- CodeGen can emit bbdbg hooks with line/column information.
- The browser debugger can reliably “jump to source” and highlight the exact BB line that produced each WASM fragment.

