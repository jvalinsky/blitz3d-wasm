---
name: workplan
description: Execute the next increment of the canonical project plan (plan/00_GLOBAL_PLAN.md + subplans) — orient via deciduous, pick one task, implement with fixture-first/no-silent-stubs rules, verify with test gates, close out with checkboxes, deciduous logging, and a linked commit. Use at session start or on /loop to drive plan execution.
---

# Work the Plan

This repo's canonical plan is `plan/00_GLOBAL_PLAN.md` with task checklists in
`plan/subplans/`. Execute the next increment of work, end-to-end.

## 1. ORIENT (do not skip)

- `deciduous nodes && deciduous edges` — recover where the last session left off
- `git status && git log --oneline -5`
- Read the roadmap section of `plan/00_GLOBAL_PLAN.md` + the subplan for the
  current milestone.
- Current milestone: Phase A, **A-M0 (entrypoint contract)** in
  `plan/subplans/05_scpcb_integration.md` — unless the graph/checkboxes show it
  is already done, in which case advance to the next unchecked milestone task.
  Trust the checkboxes and deciduous graph over this file.

## 2. PICK

Pick exactly one unchecked task from the current milestone. Log it in deciduous
(action node, linked to its parent goal/decision) BEFORE starting.

## 3. EXECUTE (project rules)

- **Fixture-first**: any compiler/runtime bug gets a minimal `.bb` repro + test
  before the fix.
- **No silent stubs**: missing runtime imports are implemented or explicitly
  flagged, never quietly faked.
- **Verify with the real gates**: `deno task test:all` (and
  `deno task test:web:build` if dist/assets are touched). A task is done only
  when its acceptance criterion in the subplan is met.

## 4. CLOSE OUT

- Check the box in the subplan with a `YYYY-MM-DD` note.
- Log the outcome node in deciduous and link it to the action.
- Commit with a conventional message, then link it:
  `deciduous add action "..." --commit HEAD` (+ `deciduous link`).
- State plainly what passed, what failed, and what the next task is.

## Blocked?

If blocked on a genuine decision (D1–D6 in the global plan), don't guess
silently: write up the tradeoff, pick the global plan's recommendation, log it
as a deciduous decision node, and continue. Stop only if tests can't be made
green without scope changes a human must approve.
