# Plan Maintenance

## When to create a new plan set

Create a new timestamped plan set when:
- the first failing wasm validation error changes meaningfully
- a major subsystem lands (CFG/relooper/type coercion, etc.)
- priorities shift (e.g. from correctness → coverage → optimization)

## Archiving

- Old plan sets should be moved under `docs/compiler_improvements/archive/`.
- Keep them intact (don’t rewrite history); add a note in the master `INDEX.md`.

## AGENTs.md

- `docs/compiler_improvements/AGENTs.md` should list the current plan set and `archive/` as children.
- If folder names change, update `INDEX.md` + `AGENTs.md` together.

## Build warnings about AGENTs.md

SwiftPM currently warns about `AGENTs.md` files that live under `Sources/` and `Tests/`. These are not part of this docs plan set, but they are worth cleaning up because they add noise to test output.

Preferred fixes (pick one):
- Exclude those files from targets in `Package.swift`.
- Move developer-instructions files outside `Sources/` / `Tests/` trees.

