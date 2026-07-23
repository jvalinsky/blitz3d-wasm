---
name: cmdbuf-abi-evolver
description: Safely add or evolve Track B command-buffer (cmdbuf) ABI commands across Blitz3D-WASM runtime. Use when adding a new opcode, changing command encoding/layout, bumping ABI versions, or when CMDB ABI mismatches occur between WASM exports and the web runtime.
---

# CmdBuf ABI Evolver

## Key files (web runtime side)

- ABI check: `web/src/shared/cmdbuf_abi.ts`
- Encoding/decoding + opcodes: `web/src/shared/command_buffer.ts`
- Dispatch layer: `web/src/runtime/command_executor.ts`
- Export presence checker: `Tools/cmdbuf_wasm_check.ts`

## Rules (don’t break consumers)

- Treat opcodes as append-only: **never reuse or renumber** existing opcodes.
- Only bump ABI/version when you change:
  - binary layout of a command,
  - shared header structure,
  - semantics that would misdecode old streams.
- New commands should be backward compatible when possible (older runtimes can
  ignore unknown opcodes only if the stream stays parseable).

## Add a new command (workflow)

1. Define the opcode and its decoded shape:
   - Add to `CmdOpcode` / `Cmd` union in `web/src/shared/command_buffer.ts`.

2. Update decoding to produce a typed `Cmd`:
   - Keep parsing aligned with how bytes are written from WASM-side producer.

3. Add executor plumbing:
   - Extend `CommandExecutor` with `onYourNewCommand`.
   - Add a `case` in `dispatchCmd(...)` in
     `web/src/runtime/command_executor.ts`.

4. If ABI versioning is involved:
   - Ensure `web/src/shared/cmdbuf_abi.ts` agrees with the module’s exported
     `__CmdBufAbiVersion`.

## Verify

- If you built/updated `web/public/scpcb.wasm`:
  - `deno run -A Tools/scpcb_import_leak_gate.ts --wasm web/public/scpcb.wasm --require-root`
- Run unit/build gates that touch runtime parsing:
  - `deno task test:web:unit`
  - `deno task test:web:build`

## Triage: “CMDB: ABI mismatch”

- The runtime saw `__CmdBufPtr/__CmdBufBytes` and compared `__CmdBufAbiVersion`
  against `CMDB_VERSION`.
- Fix by aligning:
  - the runtime `CMDB_VERSION` (and any decoder assumptions), and
  - the WASM producer’s exported ABI version / encoding.
