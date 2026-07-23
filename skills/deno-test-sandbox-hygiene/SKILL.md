---
name: deno-test-sandbox-hygiene
description: Make Deno tests reliable in sandboxed/CI environments with restricted allowlists (allow-run=deno, allow-write=/tmp, no network). Use when Tools/tests fail due to NotCapable permissions, temp dir locations, or remote std imports.
---

# Deno Test Sandbox Hygiene

## Checklist

1. **Avoid `Deno.execPath()`** when `--allow-run` is restricted to `deno`:
   - Prefer `new Deno.Command("deno", ...)` for nested calls.

2. **Force temp files under `/tmp`** when CI grants `--allow-write=/tmp`:
   - Use `Deno.makeTempFile({ dir: "/tmp", ... })`
   - Use `Deno.makeTempDir({ dir: "/tmp", ... })`

3. **Keep tests hermetic**
   - Avoid importing remote `std/*` in tests that run without network; inline
     tiny `assert` helpers.
   - Avoid shelling out to external binaries (like `wasm-validate`) unless the
     test task grants it.
   - Prefer `WebAssembly.validate` + `new WebAssembly.Module(bytes)` for basic
     WASM structural validation.

4. **Avoid DOM globals in worker/unit tests**
   - Guard `document/window` usage with `typeof document !== "undefined"`.

## Quick triage commands

- `deno task test:deno > /tmp/test_deno.log 2>&1 || true`
- `rg -n \"NotCapable|permission|Requires run access\" /tmp/test_deno.log | head`
