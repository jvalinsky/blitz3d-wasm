# Plan 02 — Runtime ABI + Command Buffer (Thin JS, WASM-First)

Created: 2026-01-29
Last updated: 2026-01-29 16:21 EST

Goal: minimize JS↔WASM overhead by moving from many fine-grained imports to a stable, batched command buffer ABI.

## A) ABI Design

- [ ] Define stable ABI versioning:
  - [x] `__CmdBufAbiVersion` constant exposed by WASM (2026-01-29)
  - [x] JS checks version match at boot (2026-01-29: `web/src/main.ts`)
- [ ] Define handle model:
  - [ ] entity handles (mesh/node/light/sound/etc.)
  - [ ] resource handles (texture/audio buffers)
  - [ ] explicit destroy calls to avoid leaks
- [x] Define WASM-side state ownership:
  - [x] entity transform/state tables live in WASM (authoritative for game logic) (2026-01-29: `web/src/shared/entity_table.ts`)
  - [x] JS mirrors state via CMDB (render-only; can be 0–1 frame behind) (2026-01-29)

## B) Command Buffer Spec

- [ ] Choose encoding:
  - [x] fixed-size structs / fixed payload layouts (fast parse). (2026-01-29: `web/src/shared/command_buffer.ts`)
  - [ ] varint/compact (smaller) (only if needed)
- [ ] Define command set (first pass):
  - [x] `CREATE_ENTITY(type,parent)` (2026-01-29)
  - [x] `DESTROY_ENTITY(id)` (2026-01-29)
  - [x] `SET_POSITION(id, x/y/z)` (2026-01-29)
  - [x] `SET_ROTATION_EULER(id, pitch/yaw/roll[, global])` (2026-01-29)
  - [x] `SET_SCALE(id, x/y/z)` (2026-01-29)
  - [x] `MOVE_ENTITY(id, x/y/z[, global])` (2026-01-29)
  - [x] `TURN_ENTITY(id, pitch/yaw/roll[, global])` (2026-01-29)
  - [ ] `SET_TRANSFORM(id, pos/rot/scale)` (reserved; optional) (2026-01-29)
  - [x] `SET_VISIBILITY(id, bool)` (2026-01-29)
  - [x] `SET_MATERIAL(id, materialId / params)` (stub v1: basic mapping) (2026-01-29)
  - [x] `PLAY_SOUND(soundId, volume, loop)` (stub v1: calls existing audio imports) (2026-01-29)
  - [x] `DEBUG_LOG(ptr/len)` (optional, can be separate ring buffer) (2026-01-29)
- [ ] Define buffer memory layout:
  - [x] header (write cursor, read cursor, capacity, flags) (2026-01-29)
  - [ ] command stream
  - [ ] scratch for strings/blobs (optional)

## C) Implementation Steps

- [x] Implement JS executor stub: (2026-01-29: `web/src/runtime/command_executor.ts`)
  - [x] reads buffer once per frame (render loop drain hook). (2026-01-29: `web/src/main.ts` + `web/src/runtime/graphics.ts`)
  - [x] applies to Three (create/destroy entity, set transform, set visibility). (2026-01-29)
  - [x] validates bounds/unknown opcodes (fail fast; decoder throws). (2026-01-29: `web/src/shared/command_buffer.ts` + `Tools/tests/command_buffer.test.ts`)
- [x] Implement minimal WASM-side CMDB writers (compiler lowering, behind a flag). (2026-01-29: `Tools/wasm-cli/main.swift` `--cmdbuf`, `Sources/Compiler/CodeGen/ExpressionGeneration.swift`)
  - [x] reserve/append with bounds check + overflow flag (2026-01-29)
  - [x] write entity/transform/visibility commands (2026-01-29)
  - [x] migrate more imports (LoadMesh/Brush/Surfaces/Textures) to CMDB (2026-01-29)
- [x] Add WASM-side entity state tables + lower getters: (2026-01-29)
  - [x] maintain pos/rot/scale/visible in linear memory by entity handle (2026-01-29: `web/src/shared/entity_table.ts`)
  - [x] lower `EntityX/Y/Z/Pitch/Yaw/Roll` to read WASM state (not JS) (2026-01-29: `web/src/runtime/graphics.ts`)
  - [x] (optional) lower `MoveEntity/TurnEntity` to mutate WASM state correctly (v1 yaw-only MoveEntity) (2026-01-29)

## D) Backpressure + Safety

- [ ] Define overflow behavior:
  - [ ] drop (only for non-critical commands)
  - [ ] grow buffer (bounded)
  - [ ] assert in debug
- [ ] Add “no runaway allocations” guardrails.

## E) Tests (Deno + Browser)

- [x] Deno unit tests for command encoding/decoding: (2026-01-29: `Tools/tests/command_buffer.test.ts`)
  - [x] roundtrip: write commands → parse → expected operations (2026-01-29)
  - [x] invalid inputs (bounds, unknown opcode) (2026-01-29)
- [ ] Browser integration test:
  - [ ] run 300 frames with a scripted scene and assert:
    - [ ] no exceptions
    - [ ] stable handle counts
    - [ ] no command buffer overflow

Acceptance Criteria:
- [ ] Per-frame import calls reduced to O(1) (single “drain commands” call + a few timing/io calls).
- [ ] 60fps stable in a representative scene (define benchmark scenario).
