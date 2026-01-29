import {
  beginFrame,
  CmdOpcode,
  drainCmds,
  hasOverflowed,
  initCmdBuf,
  writeCmd,
} from "../../web/src/shared/command_buffer.ts";
import { assert } from "./assert.ts";

const make = (totalBytes = 4096) => {
  const buf = new ArrayBuffer(totalBytes);
  const dv = initCmdBuf(buf);
  beginFrame(dv);
  return dv;
};

Deno.test("command buffer roundtrip encodes/decodes in order", () => {
  const dv = make();

  writeCmd(dv, { op: CmdOpcode.CreateEntity, entityType: 7, parent: 3, id: 123 });
  writeCmd(dv, { op: CmdOpcode.SetPosition, id: 42, x: 1, y: 2, z: 3 });
  writeCmd(dv, { op: CmdOpcode.SetRotationEuler, id: 42, pitch: 10, yaw: 20, roll: 30, global: 0 });
  writeCmd(dv, { op: CmdOpcode.SetScale, id: 42, x: 1, y: 1, z: 1 });
  writeCmd(dv, { op: CmdOpcode.MoveEntity, id: 42, x: 0.1, y: 0.2, z: 0.3 });
  writeCmd(dv, { op: CmdOpcode.TurnEntity, id: 42, pitch: 1, yaw: 2, roll: 3, global: 0 });
  writeCmd(dv, { op: CmdOpcode.SetVisibility, id: 42, visible: 0 });
  writeCmd(dv, { op: CmdOpcode.SetMaterial, id: 42, materialId: 2 });
  writeCmd(dv, { op: CmdOpcode.PlaySound, soundId: 12, volume: 0.75, loop: 1 });
  writeCmd(dv, { op: CmdOpcode.DestroyEntity, id: 99 });

  const ops: number[] = [];
  drainCmds(dv, (c) => ops.push(c.op));
  assert(
    ops.join(",") ===
      `${CmdOpcode.CreateEntity},${CmdOpcode.SetPosition},${CmdOpcode.SetRotationEuler},${CmdOpcode.SetScale},${CmdOpcode.MoveEntity},${CmdOpcode.TurnEntity},${CmdOpcode.SetVisibility},${CmdOpcode.SetMaterial},${CmdOpcode.PlaySound},${CmdOpcode.DestroyEntity}`,
  );
});

Deno.test("command buffer overflow sets flag and throws", () => {
  const dv = make(64);
  let threw = false;
  try {
    // This should be too large for a tiny buffer
    writeCmd(dv, { op: CmdOpcode.SetTransform, id: 1, pos: [1, 2, 3], rot: [0, 0, 0, 1], scl: [1, 1, 1] });
  } catch {
    threw = true;
  }
  assert(threw, "expected overflow throw");
  assert(hasOverflowed(dv), "expected overflow flag");
});

Deno.test("command buffer throws on unknown opcode during drain", () => {
  const dv = make();

  // Write a fake opcode directly: u32 opcode, u32 len (8)
  const base = 24; // header bytes
  dv.setUint32(base + 0, 9999, true);
  dv.setUint32(base + 4, 8, true);
  dv.setUint32(12, 8, true); // writeOffset
  dv.setUint32(16, 0, true); // readOffset

  let threw = false;
  try {
    drainCmds(dv, () => {});
  } catch {
    threw = true;
  }
  assert(threw, "expected unknown opcode throw");
});
