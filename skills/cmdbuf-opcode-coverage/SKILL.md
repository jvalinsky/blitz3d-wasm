---
name: cmdbuf-opcode-coverage
description: Extend Track B CMDB opcode coverage end-to-end (WASM emit → JS drain → rendering/audio side effects). Use when adding new CmdOpcode entries or when graphics/audio actions are “missing” despite compiling.
---

# CMDB Opcode Coverage

## Workflow

1. Identify missing behavior
   - Find the opcode in `web/src/shared/command_buffer.ts` and confirm decode
     coverage in `web/src/runtime/command_executor.ts`.
   - Confirm the runtime drain hook actually reads the correct memory slice and
     advances readOffset.

2. Implement the handler in the runtime
   - Prefer implementing in the Track B path (CMDB executor), not as per-call
     imports.
   - Keep entity/resource handle ownership clear (WASM is authoritative; JS
     mirrors).

3. Add a focused test
   - Extend `Tools/tests/command_buffer.test.ts` for encode/decode.
   - If the opcode affects instantiation/worker behavior, add a small
     integration test under `Tools/tests/*worker*`.

4. Verify no regressions
   - `deno task test:web:unit`
   - `deno test --allow-read --allow-write=/tmp --allow-run=deno Tools/tests/command_buffer.test.ts`
