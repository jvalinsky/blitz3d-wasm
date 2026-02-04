# Testing, Tooling, and CI Gates (Rebuild Checklist)

The project is only “rebuildable” if correctness is continuously validated.

## “From Scratch” Acceptance Checklist (What Must Stay True)

Use these as the rebuild’s non-negotiable gates.

### Compiler gates

- ✅ Compiles a fixture set without crashing.
- ✅ `wasm-validate` passes on produced `.wasm` artifacts (no invalid stack/control flow).
- ✅ Include handling matches SCPCB needs (case-insensitive include resolution).
- ✅ String ABI matches runtime (`[refCount][len][bytes...][0]`).
- ✅ Array semantics are correct (`arr(i)` is not accidentally treated as a function call at runtime).

### Runtime/loader gates

- ✅ Default execution is “no-freeze” (Worker-based; no UI-thread `Main()` by default).
- ✅ Every worker call has a watchdog timeout and terminates on hang.
- ✅ Command buffer ABI mismatch fails fast (clear error).
- ✅ Memory growth doesn’t leave stale typed array views in hot-path code (recreate views on use).
- ✅ All runtime resources have deterministic disposal paths (RAF, listeners, Three.js resources).

## Compiler Correctness Gates

- Unit tests for parsing + lowering edge cases.
- Integration tests that compile fixtures and run:
  - `wasm-validate` on the artifact,
  - a small runtime harness to call known exports.

Key docs:
- `docs/STACK_BALANCE_HEURISTICS.md`
- `docs/COMPILER_STATUS_ANALYSIS.md`

## Runtime Correctness Gates

- Import surface tests:
  - wrong type/arity should fail loudly,
  - missing imports should be detected early (and optionally stubbed only in debug).
- Worker protocol tests:
  - timeouts, cancellation, termination behavior.

## Leak / Freeze Tooling (Must-Have)

Treat leak/freeze regressions as test failures:

- Headless create/dispose cycles (JS-side resource checks)
- SCPCB churn steps (exercise runtime imports repeatedly)
- Pattern scan for common leaks (RAF, listeners, Three.js dispose)

See: `docs/MEMORY_LEAK_DETECTION.md`.

## Asset Pipeline Gates

- Conversion tools produce deterministic output.
- Runtime can load the converted package and validate expected counts/hashes.

## “CI Minimum”

Even on day 1, aim for:

- `swift test`
- `deno test` (runtime + tooling)
- `wasm-validate` on a small fixture set

## Concrete Commands (What We Actually Run In This Repo)

These commands are the fastest way to validate “we didn’t regress fundamentals”.

### Quick (developer)

- `deno task test:swift`
- `deno task test:web:unit`
- `deno task memleak:scan`

### Full (CI-ish)

- `deno task test:all`

### No-freeze / hang regression probes

- Worker/timeout probe: `deno task memleak:wasm:timeout`

### Headless leak checks (no browser)

- JS lifecycle leakcheck:
  - `deno task memleak:run -- --cycles 5 --settle-ms 10 --fail-on-growth-bytes 10485760`
  - For more stable heap numbers:
    - `deno run -A --node-modules-dir --v8-flags=--expose-gc Tools/memleak/leakcheck.ts --cycles 5 --settle-ms 10`

- SCPCB churn (headless; exercises runtime import maps + optional WASM growth checks):
  - `deno task memleak:scpcb:compile`
  - `deno task memleak:scpcb:churn -- --wasm Main.leaktest.wasm --export \"__LeakTestStep%\" --steps 2000 --check-every 50 --fail-on-growth-bytes 25000000`

## Where These Gates Live (Code-First)

- Deno tasks: `deno.json`
- Leak tooling:
  - `Tools/memleak/leakcheck.ts`
  - `Tools/memleak/scpcb_churn.ts`
  - `Tools/memleak/wasm_timeout_probe.ts`

