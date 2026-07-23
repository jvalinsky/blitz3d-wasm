export const CMDB_MAGIC = 0x434d4442; // "CMDB"
export const CMDB_VERSION = 1;

// Header layout (little-endian u32s):
// 0: magic
// 4: version
// 8: totalBytes
// 12: writeOffset (bytes from start of data region)
// 16: readOffset  (bytes from start of data region)
// 20: flags (bit0 overflow)
export const CMDB_HEADER_BYTES = 24;

export const enum CmdBufFlag {
  Overflow = 1 << 0,
}

export const enum CmdOpcode {
  CreateEntity = 1,
  DestroyEntity = 2,
  SetTransform = 3,
  DebugLogPtrLen = 4,
  SetVisibility = 5,
  SetMaterial = 6,
  PlaySound = 7,
  SetPosition = 8,
  SetRotationEuler = 9,
  SetScale = 10,
  MoveEntity = 11,
  TurnEntity = 12,
  SetParent = 13,
  LoadMesh = 14,
  LoadAnimMesh = 15,
  CreateMesh = 16,
  LoadTexture = 17,
  TextureBlend = 18,
  TextureCoords = 19,
  CreateBrush = 20,
  BrushColor = 21,
  BrushAlpha = 22,
  BrushShininess = 23,
  BrushTexture = 24,
  EntityTexture = 25,
  EntityColor = 26,
  EntityAlpha = 27,
  EntityShininess = 28,
  EntityFX = 29,
  EntityBlend = 30,
  FreeEntity = 31,
}

export type Cmd =
  | {
    op: CmdOpcode.CreateEntity;
    entityType: number;
    parent: number;
    id: number;
  }
  | { op: CmdOpcode.DestroyEntity; id: number }
  | {
    op: CmdOpcode.SetTransform;
    id: number;
    pos: [number, number, number];
    rot: [number, number, number, number]; // xyzw
    scl: [number, number, number];
  }
  | { op: CmdOpcode.DebugLogPtrLen; ptr: number; len: number }
  | { op: CmdOpcode.SetVisibility; id: number; visible: number }
  | { op: CmdOpcode.SetMaterial; id: number; materialId: number }
  | {
    op: CmdOpcode.PlaySound;
    soundId: number;
    volume: number;
    loop: number;
    outChannelPtr?: number;
  }
  | { op: CmdOpcode.SetPosition; id: number; x: number; y: number; z: number }
  | {
    op: CmdOpcode.SetRotationEuler;
    id: number;
    pitch: number;
    yaw: number;
    roll: number;
    global: number;
  }
  | { op: CmdOpcode.SetScale; id: number; x: number; y: number; z: number }
  | { op: CmdOpcode.MoveEntity; id: number; x: number; y: number; z: number }
  | {
    op: CmdOpcode.TurnEntity;
    id: number;
    pitch: number;
    yaw: number;
    roll: number;
    global: number;
  }
  | { op: CmdOpcode.SetParent; id: number; parent: number; global: number }
  | { op: CmdOpcode.LoadMesh; id: number; parent: number; pathPtr: number }
  | { op: CmdOpcode.LoadAnimMesh; id: number; parent: number; pathPtr: number }
  | { op: CmdOpcode.CreateMesh; id: number; parent: number }
  | { op: CmdOpcode.LoadTexture; id: number; pathPtr: number; flags: number }
  | { op: CmdOpcode.TextureBlend; id: number; blend: number }
  | { op: CmdOpcode.TextureCoords; id: number; coords: number }
  | { op: CmdOpcode.CreateBrush; id: number }
  | { op: CmdOpcode.BrushColor; id: number; r: number; g: number; b: number }
  | { op: CmdOpcode.BrushAlpha; id: number; a: number }
  | { op: CmdOpcode.BrushShininess; id: number; s: number }
  | {
    op: CmdOpcode.BrushTexture;
    brushId: number;
    textureId: number;
    frame: number;
    index: number;
  }
  | {
    op: CmdOpcode.EntityTexture;
    entityId: number;
    textureId: number;
    frame: number;
    index: number;
  }
  | {
    op: CmdOpcode.EntityColor;
    entityId: number;
    r: number;
    g: number;
    b: number;
  }
  | { op: CmdOpcode.EntityAlpha; entityId: number; a: number }
  | { op: CmdOpcode.EntityShininess; entityId: number; s: number }
  | { op: CmdOpcode.EntityFX; entityId: number; fx: number }
  | { op: CmdOpcode.EntityBlend; entityId: number; blend: number }
  | { op: CmdOpcode.FreeEntity; id: number };

export const initCmdBuf = (
  buffer: ArrayBuffer,
  byteOffset = 0,
  totalBytes?: number,
) => {
  const bytes = totalBytes ?? (buffer.byteLength - byteOffset);
  if (bytes < CMDB_HEADER_BYTES) throw new Error("CMDB: buffer too small");
  const dv = new DataView(buffer, byteOffset, bytes);
  dv.setUint32(0, CMDB_MAGIC, true);
  dv.setUint32(4, CMDB_VERSION, true);
  dv.setUint32(8, bytes >>> 0, true);
  dv.setUint32(12, 0, true);
  dv.setUint32(16, 0, true);
  dv.setUint32(20, 0, true);
  return dv;
};

export const validateCmdBuf = (dv: DataView) => {
  if (dv.byteLength < CMDB_HEADER_BYTES) {
    throw new Error("CMDB: buffer too small");
  }
  const magic = dv.getUint32(0, true);
  if (magic !== CMDB_MAGIC) throw new Error("CMDB: bad magic");
  const version = dv.getUint32(4, true);
  if (version !== CMDB_VERSION) {
    throw new Error(`CMDB: unsupported version ${version}`);
  }
  const total = dv.getUint32(8, true);
  if (total !== dv.byteLength) throw new Error("CMDB: totalBytes mismatch");
};

const getWriteOff = (dv: DataView) => dv.getUint32(12, true) >>> 0;
const setWriteOff = (dv: DataView, v: number) =>
  dv.setUint32(12, v >>> 0, true);
const getReadOff = (dv: DataView) => dv.getUint32(16, true) >>> 0;
const setReadOff = (dv: DataView, v: number) => dv.setUint32(16, v >>> 0, true);
const getFlags = (dv: DataView) => dv.getUint32(20, true) >>> 0;
const setFlags = (dv: DataView, v: number) => dv.setUint32(20, v >>> 0, true);

const dataCapacity = (dv: DataView) => dv.byteLength - CMDB_HEADER_BYTES;

const ensureSpace = (dv: DataView, bytesNeeded: number) => {
  const w = getWriteOff(dv);
  const cap = dataCapacity(dv);
  if (w + bytesNeeded > cap) {
    setFlags(dv, getFlags(dv) | CmdBufFlag.Overflow);
    throw new Error(`CMDB overflow: need=${bytesNeeded} have=${cap - w}`);
  }
};

const writeU32 = (dv: DataView, relOff: number, v: number) =>
  dv.setUint32(CMDB_HEADER_BYTES + relOff, v >>> 0, true);
const writeF32 = (dv: DataView, relOff: number, v: number) =>
  dv.setFloat32(CMDB_HEADER_BYTES + relOff, v, true);
const readU32 = (dv: DataView, relOff: number) =>
  dv.getUint32(CMDB_HEADER_BYTES + relOff, true) >>> 0;
const readF32 = (dv: DataView, relOff: number) =>
  dv.getFloat32(CMDB_HEADER_BYTES + relOff, true);

// Command encoding:
// u32 opcode
// u32 byteLen (including this 8-byte header)
// payload...
const CMD_HDR = 8;

export const beginFrame = (dv: DataView) => {
  validateCmdBuf(dv);
  setWriteOff(dv, 0);
  setReadOff(dv, 0);
  setFlags(dv, getFlags(dv) & ~CmdBufFlag.Overflow);
};

export const writeCmd = (dv: DataView, cmd: Cmd) => {
  validateCmdBuf(dv);
  const w0 = getWriteOff(dv);
  const base = w0;

  const commit = (byteLen: number) => {
    ensureSpace(dv, byteLen);
    writeU32(dv, base + 0, cmd.op);
    writeU32(dv, base + 4, byteLen);
    setWriteOff(dv, base + byteLen);
  };

  switch (cmd.op) {
    case CmdOpcode.CreateEntity: {
      const byteLen = CMD_HDR + 12;
      commit(byteLen);
      writeU32(dv, base + 8, cmd.entityType);
      writeU32(dv, base + 12, cmd.parent);
      writeU32(dv, base + 16, cmd.id);
      return;
    }
    case CmdOpcode.DestroyEntity: {
      const byteLen = CMD_HDR + 4;
      commit(byteLen);
      writeU32(dv, base + 8, cmd.id);
      return;
    }
    case CmdOpcode.SetTransform: {
      const byteLen = CMD_HDR + (4 + (3 + 4 + 3) * 4);
      commit(byteLen);
      writeU32(dv, base + 8, cmd.id);
      let o = base + 12;
      writeF32(dv, o, cmd.pos[0]);
      o += 4;
      writeF32(dv, o, cmd.pos[1]);
      o += 4;
      writeF32(dv, o, cmd.pos[2]);
      o += 4;
      writeF32(dv, o, cmd.rot[0]);
      o += 4;
      writeF32(dv, o, cmd.rot[1]);
      o += 4;
      writeF32(dv, o, cmd.rot[2]);
      o += 4;
      writeF32(dv, o, cmd.rot[3]);
      o += 4;
      writeF32(dv, o, cmd.scl[0]);
      o += 4;
      writeF32(dv, o, cmd.scl[1]);
      o += 4;
      writeF32(dv, o, cmd.scl[2]);
      o += 4;
      return;
    }
    case CmdOpcode.DebugLogPtrLen: {
      const byteLen = CMD_HDR + 8;
      commit(byteLen);
      writeU32(dv, base + 8, cmd.ptr);
      writeU32(dv, base + 12, cmd.len);
      return;
    }
    case CmdOpcode.SetVisibility: {
      const byteLen = CMD_HDR + 8;
      commit(byteLen);
      writeU32(dv, base + 8, cmd.id);
      writeU32(dv, base + 12, cmd.visible ? 1 : 0);
      return;
    }
    case CmdOpcode.SetMaterial: {
      const byteLen = CMD_HDR + 8;
      commit(byteLen);
      writeU32(dv, base + 8, cmd.id);
      writeU32(dv, base + 12, cmd.materialId);
      return;
    }
    case CmdOpcode.PlaySound: {
      const byteLen = CMD_HDR + 16;
      commit(byteLen);
      writeU32(dv, base + 8, cmd.soundId);
      writeF32(dv, base + 12, cmd.volume);
      writeU32(dv, base + 16, cmd.loop ? 1 : 0);
      writeU32(dv, base + 20, cmd.outChannelPtr ?? 0);
      return;
    }
    case CmdOpcode.SetPosition: {
      const byteLen = CMD_HDR + 16;
      commit(byteLen);
      writeU32(dv, base + 8, cmd.id);
      writeF32(dv, base + 12, cmd.x);
      writeF32(dv, base + 16, cmd.y);
      writeF32(dv, base + 20, cmd.z);
      return;
    }
    case CmdOpcode.SetRotationEuler: {
      const byteLen = CMD_HDR + 20;
      commit(byteLen);
      writeU32(dv, base + 8, cmd.id);
      writeF32(dv, base + 12, cmd.pitch);
      writeF32(dv, base + 16, cmd.yaw);
      writeF32(dv, base + 20, cmd.roll);
      writeU32(dv, base + 24, cmd.global ? 1 : 0);
      return;
    }
    case CmdOpcode.SetScale: {
      const byteLen = CMD_HDR + 16;
      commit(byteLen);
      writeU32(dv, base + 8, cmd.id);
      writeF32(dv, base + 12, cmd.x);
      writeF32(dv, base + 16, cmd.y);
      writeF32(dv, base + 20, cmd.z);
      return;
    }
    case CmdOpcode.MoveEntity: {
      const byteLen = CMD_HDR + 16;
      commit(byteLen);
      writeU32(dv, base + 8, cmd.id);
      writeF32(dv, base + 12, cmd.x);
      writeF32(dv, base + 16, cmd.y);
      writeF32(dv, base + 20, cmd.z);
      return;
    }
    case CmdOpcode.TurnEntity: {
      const byteLen = CMD_HDR + 20;
      commit(byteLen);
      writeU32(dv, base + 8, cmd.id);
      writeF32(dv, base + 12, cmd.pitch);
      writeF32(dv, base + 16, cmd.yaw);
      writeF32(dv, base + 20, cmd.roll);
      writeU32(dv, base + 24, cmd.global ? 1 : 0);
      return;
    }
    case CmdOpcode.SetParent: {
      const byteLen = CMD_HDR + 12;
      commit(byteLen);
      writeU32(dv, base + 8, cmd.id);
      writeU32(dv, base + 12, cmd.parent);
      writeU32(dv, base + 16, cmd.global ? 1 : 0);
      return;
    }
    case CmdOpcode.LoadMesh: {
      const byteLen = CMD_HDR + 12;
      commit(byteLen);
      writeU32(dv, base + 8, cmd.id);
      writeU32(dv, base + 12, cmd.parent);
      writeU32(dv, base + 16, cmd.pathPtr);
      return;
    }
    case CmdOpcode.LoadAnimMesh: {
      const byteLen = CMD_HDR + 12;
      commit(byteLen);
      writeU32(dv, base + 8, cmd.id);
      writeU32(dv, base + 12, cmd.parent);
      writeU32(dv, base + 16, cmd.pathPtr);
      return;
    }
    case CmdOpcode.CreateMesh: {
      const byteLen = CMD_HDR + 8;
      commit(byteLen);
      writeU32(dv, base + 8, cmd.id);
      writeU32(dv, base + 12, cmd.parent);
      return;
    }
    case CmdOpcode.LoadTexture: {
      const byteLen = CMD_HDR + 12;
      commit(byteLen);
      writeU32(dv, base + 8, cmd.id);
      writeU32(dv, base + 12, cmd.pathPtr);
      writeU32(dv, base + 16, cmd.flags);
      return;
    }
    case CmdOpcode.TextureBlend: {
      const byteLen = CMD_HDR + 8;
      commit(byteLen);
      writeU32(dv, base + 8, cmd.id);
      writeU32(dv, base + 12, cmd.blend);
      return;
    }
    case CmdOpcode.TextureCoords: {
      const byteLen = CMD_HDR + 8;
      commit(byteLen);
      writeU32(dv, base + 8, cmd.id);
      writeU32(dv, base + 12, cmd.coords);
      return;
    }
    case CmdOpcode.CreateBrush: {
      const byteLen = CMD_HDR + 4;
      commit(byteLen);
      writeU32(dv, base + 8, cmd.id);
      return;
    }
    case CmdOpcode.BrushColor: {
      const byteLen = CMD_HDR + 16;
      commit(byteLen);
      writeU32(dv, base + 8, cmd.id);
      writeF32(dv, base + 12, cmd.r);
      writeF32(dv, base + 16, cmd.g);
      writeF32(dv, base + 20, cmd.b);
      return;
    }
    case CmdOpcode.BrushAlpha: {
      const byteLen = CMD_HDR + 8;
      commit(byteLen);
      writeU32(dv, base + 8, cmd.id);
      writeF32(dv, base + 12, cmd.a);
      return;
    }
    case CmdOpcode.BrushShininess: {
      const byteLen = CMD_HDR + 8;
      commit(byteLen);
      writeU32(dv, base + 8, cmd.id);
      writeF32(dv, base + 12, cmd.s);
      return;
    }
    case CmdOpcode.BrushTexture: {
      const byteLen = CMD_HDR + 16;
      commit(byteLen);
      writeU32(dv, base + 8, cmd.brushId);
      writeU32(dv, base + 12, cmd.textureId);
      writeU32(dv, base + 16, cmd.frame);
      writeU32(dv, base + 20, cmd.index);
      return;
    }
    case CmdOpcode.EntityTexture: {
      const byteLen = CMD_HDR + 16;
      commit(byteLen);
      writeU32(dv, base + 8, cmd.entityId);
      writeU32(dv, base + 12, cmd.textureId);
      writeU32(dv, base + 16, cmd.frame);
      writeU32(dv, base + 20, cmd.index);
      return;
    }
    case CmdOpcode.EntityColor: {
      const byteLen = CMD_HDR + 16;
      commit(byteLen);
      writeU32(dv, base + 8, cmd.entityId);
      writeF32(dv, base + 12, cmd.r);
      writeF32(dv, base + 16, cmd.g);
      writeF32(dv, base + 20, cmd.b);
      return;
    }
    case CmdOpcode.EntityAlpha: {
      const byteLen = CMD_HDR + 8;
      commit(byteLen);
      writeU32(dv, base + 8, cmd.entityId);
      writeF32(dv, base + 12, cmd.a);
      return;
    }
    case CmdOpcode.EntityShininess: {
      const byteLen = CMD_HDR + 8;
      commit(byteLen);
      writeU32(dv, base + 8, cmd.entityId);
      writeF32(dv, base + 12, cmd.s);
      return;
    }
    case CmdOpcode.EntityFX: {
      const byteLen = CMD_HDR + 8;
      commit(byteLen);
      writeU32(dv, base + 8, cmd.entityId);
      writeU32(dv, base + 12, cmd.fx);
      return;
    }
    case CmdOpcode.EntityBlend: {
      const byteLen = CMD_HDR + 8;
      commit(byteLen);
      writeU32(dv, base + 8, cmd.entityId);
      writeU32(dv, base + 12, cmd.blend);
      return;
    }
    case CmdOpcode.FreeEntity: {
      const byteLen = CMD_HDR + 4;
      commit(byteLen);
      writeU32(dv, base + 8, cmd.id);
      return;
    }
    default: {
      const _exhaustive: never = cmd;
      throw new Error(`CMDB write: unknown opcode ${(cmd as any).op}`);
    }
  }
};

export const drainCmds = (dv: DataView, onCmd: (cmd: Cmd) => void) => {
  validateCmdBuf(dv);
  const w = getWriteOff(dv);
  let r = getReadOff(dv);
  if (r > w) throw new Error("CMDB: readOffset past writeOffset");

  while (r + CMD_HDR <= w) {
    const op = readU32(dv, r + 0);
    const byteLen = readU32(dv, r + 4);
    if (byteLen < CMD_HDR) throw new Error("CMDB: bad cmd length");
    if (r + byteLen > w) throw new Error("CMDB: truncated cmd");

    switch (op) {
      case CmdOpcode.CreateEntity: {
        const entityType = readU32(dv, r + 8);
        const parent = readU32(dv, r + 12);
        const id = readU32(dv, r + 16);
        onCmd({ op, entityType, parent, id });
        break;
      }
      case CmdOpcode.DestroyEntity: {
        const id = readU32(dv, r + 8);
        onCmd({ op, id });
        break;
      }
      case CmdOpcode.SetTransform: {
        const id = readU32(dv, r + 8);
        let o = r + 12;
        const pos: [number, number, number] = [
          readF32(dv, o),
          readF32(dv, o + 4),
          readF32(dv, o + 8),
        ];
        o += 12;
        const rot: [number, number, number, number] = [
          readF32(dv, o),
          readF32(dv, o + 4),
          readF32(dv, o + 8),
          readF32(dv, o + 12),
        ];
        o += 16;
        const scl: [number, number, number] = [
          readF32(dv, o),
          readF32(dv, o + 4),
          readF32(dv, o + 8),
        ];
        onCmd({ op, id, pos, rot, scl });
        break;
      }
      case CmdOpcode.DebugLogPtrLen: {
        const ptr = readU32(dv, r + 8);
        const len = readU32(dv, r + 12);
        onCmd({ op, ptr, len });
        break;
      }
      case CmdOpcode.SetVisibility: {
        const id = readU32(dv, r + 8);
        const visible = readU32(dv, r + 12) ? 1 : 0;
        onCmd({ op, id, visible });
        break;
      }
      case CmdOpcode.SetMaterial: {
        const id = readU32(dv, r + 8);
        const materialId = readU32(dv, r + 12);
        onCmd({ op, id, materialId });
        break;
      }
      case CmdOpcode.PlaySound: {
        const soundId = readU32(dv, r + 8);
        const volume = readF32(dv, r + 12);
        const loop = readU32(dv, r + 16) ? 1 : 0;
        const outChannelPtr = readU32(dv, r + 20) || undefined;
        onCmd({ op, soundId, volume, loop, outChannelPtr });
        break;
      }
      case CmdOpcode.SetPosition: {
        const id = readU32(dv, r + 8);
        const x = readF32(dv, r + 12);
        const y = readF32(dv, r + 16);
        const z = readF32(dv, r + 20);
        onCmd({ op, id, x, y, z });
        break;
      }
      case CmdOpcode.SetRotationEuler: {
        const id = readU32(dv, r + 8);
        const pitch = readF32(dv, r + 12);
        const yaw = readF32(dv, r + 16);
        const roll = readF32(dv, r + 20);
        const global = readU32(dv, r + 24) ? 1 : 0;
        onCmd({ op, id, pitch, yaw, roll, global });
        break;
      }
      case CmdOpcode.SetScale: {
        const id = readU32(dv, r + 8);
        const x = readF32(dv, r + 12);
        const y = readF32(dv, r + 16);
        const z = readF32(dv, r + 20);
        onCmd({ op, id, x, y, z });
        break;
      }
      case CmdOpcode.MoveEntity: {
        const id = readU32(dv, r + 8);
        const x = readF32(dv, r + 12);
        const y = readF32(dv, r + 16);
        const z = readF32(dv, r + 20);
        onCmd({ op, id, x, y, z });
        break;
      }
      case CmdOpcode.TurnEntity: {
        const id = readU32(dv, r + 8);
        const pitch = readF32(dv, r + 12);
        const yaw = readF32(dv, r + 16);
        const roll = readF32(dv, r + 20);
        const global = readU32(dv, r + 24) ? 1 : 0;
        onCmd({ op, id, pitch, yaw, roll, global });
        break;
      }
      case CmdOpcode.SetParent: {
        const id = readU32(dv, r + 8);
        const parent = readU32(dv, r + 12);
        const global = readU32(dv, r + 16) ? 1 : 0;
        onCmd({ op, id, parent, global });
        break;
      }
      case CmdOpcode.LoadMesh: {
        const id = readU32(dv, r + 8);
        const parent = readU32(dv, r + 12);
        const pathPtr = readU32(dv, r + 16);
        onCmd({ op, id, parent, pathPtr });
        break;
      }
      case CmdOpcode.LoadAnimMesh: {
        const id = readU32(dv, r + 8);
        const parent = readU32(dv, r + 12);
        const pathPtr = readU32(dv, r + 16);
        onCmd({ op, id, parent, pathPtr });
        break;
      }
      case CmdOpcode.CreateMesh: {
        const id = readU32(dv, r + 8);
        const parent = readU32(dv, r + 12);
        onCmd({ op, id, parent });
        break;
      }
      case CmdOpcode.LoadTexture: {
        const id = readU32(dv, r + 8);
        const pathPtr = readU32(dv, r + 12);
        const flags = readU32(dv, r + 16);
        onCmd({ op, id, pathPtr, flags });
        break;
      }
      case CmdOpcode.TextureBlend: {
        const id = readU32(dv, r + 8);
        const blend = readU32(dv, r + 12);
        onCmd({ op, id, blend });
        break;
      }
      case CmdOpcode.TextureCoords: {
        const id = readU32(dv, r + 8);
        const coords = readU32(dv, r + 12);
        onCmd({ op, id, coords });
        break;
      }
      case CmdOpcode.CreateBrush: {
        const id = readU32(dv, r + 8);
        onCmd({ op, id });
        break;
      }
      case CmdOpcode.BrushColor: {
        const id = readU32(dv, r + 8);
        const rVal = readF32(dv, r + 12);
        const gVal = readF32(dv, r + 16);
        const bVal = readF32(dv, r + 20);
        onCmd({ op, id, r: rVal, g: gVal, b: bVal });
        break;
      }
      case CmdOpcode.BrushAlpha: {
        const id = readU32(dv, r + 8);
        const a = readF32(dv, r + 12);
        onCmd({ op, id, a });
        break;
      }
      case CmdOpcode.BrushShininess: {
        const id = readU32(dv, r + 8);
        const s = readF32(dv, r + 12);
        onCmd({ op, id, s });
        break;
      }
      case CmdOpcode.BrushTexture: {
        const brushId = readU32(dv, r + 8);
        const textureId = readU32(dv, r + 12);
        const frame = readU32(dv, r + 16);
        const index = readU32(dv, r + 20);
        onCmd({ op, brushId, textureId, frame, index });
        break;
      }
      case CmdOpcode.EntityTexture: {
        const entityId = readU32(dv, r + 8);
        const textureId = readU32(dv, r + 12);
        const frame = readU32(dv, r + 16);
        const index = readU32(dv, r + 20);
        onCmd({ op, entityId, textureId, frame, index });
        break;
      }
      case CmdOpcode.EntityColor: {
        const entityId = readU32(dv, r + 8);
        const rVal = readF32(dv, r + 12);
        const gVal = readF32(dv, r + 16);
        const bVal = readF32(dv, r + 20);
        onCmd({ op, entityId, r: rVal, g: gVal, b: bVal });
        break;
      }
      case CmdOpcode.EntityAlpha: {
        const entityId = readU32(dv, r + 8);
        const a = readF32(dv, r + 12);
        onCmd({ op, entityId, a });
        break;
      }
      case CmdOpcode.EntityShininess: {
        const entityId = readU32(dv, r + 8);
        const s = readF32(dv, r + 12);
        onCmd({ op, entityId, s });
        break;
      }
      case CmdOpcode.EntityFX: {
        const entityId = readU32(dv, r + 8);
        const fx = readU32(dv, r + 12);
        onCmd({ op, entityId, fx });
        break;
      }
      case CmdOpcode.EntityBlend: {
        const entityId = readU32(dv, r + 8);
        const blend = readU32(dv, r + 12);
        onCmd({ op, entityId, blend });
        break;
      }
      case CmdOpcode.FreeEntity: {
        const id = readU32(dv, r + 8);
        onCmd({ op, id });
        break;
      }
      default:
        throw new Error(`CMDB: unknown opcode ${op}`);
    }

    r += byteLen;
  }

  // v1 policy: drain fully and reset for reuse.
  // This avoids requiring a separate “beginFrame” call from the host and keeps the WASM writer simple.
  setReadOff(dv, 0);
  setWriteOff(dv, 0);
};

export const hasOverflowed = (dv: DataView) =>
  (getFlags(dv) & CmdBufFlag.Overflow) !== 0;
