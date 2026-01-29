export type RMeshTexture = {
  slot: 0 | 1;
  kind: number; // isAlpha() byte from SCPCB converter (0/1/2/3)
  name?: string; // filename stored in RMESH (usually no path)
};

export type RMeshSurface = {
  textures: [RMeshTexture, RMeshTexture];
  positions: Float32Array; // 3*n
  uvs0: Float32Array; // 2*n
  uvs1: Float32Array; // 2*n (lightmap uv)
  colorsRgb: Uint8Array; // 3*n
  indices: Uint32Array; // 3*m
};

export type RMeshCollisionSurface = {
  positions: Float32Array; // 3*n
  indices: Uint32Array; // 3*m
};

export type RMeshTriggerBox = {
  name: string;
  surfaces: RMeshCollisionSurface[];
};

export type RMeshPointEntity =
  | { type: "screen"; x: number; y: number; z: number; imgPath: string }
  | { type: "waypoint"; x: number; y: number; z: number }
  | { type: "light"; x: number; y: number; z: number; range: number; color: string; intensity: number }
  | {
    type: "spotlight";
    x: number;
    y: number;
    z: number;
    range: number;
    color: string;
    intensity: number;
    angles: string;
    innerCone: number;
    outerCone: number;
  }
  | { type: "soundemitter"; x: number; y: number; z: number; sound: number; range: number }
  | { type: "playerstart"; x: number; y: number; z: number; angles: string }
  | {
    type: "model";
    file: string;
    x: number;
    y: number;
    z: number;
    pitch: number;
    yaw: number;
    roll: number;
    sx: number;
    sy: number;
    sz: number;
  }
  | { type: string; raw: unknown };

export type RMeshFile = {
  header: "RoomMesh" | "RoomMesh.HasTriggerBox";
  drawn: RMeshSurface[];
  collision: RMeshCollisionSurface[];
  triggers: RMeshTriggerBox[];
  entities: RMeshPointEntity[];
};

class Reader {
  private dv: DataView;
  private u8: Uint8Array;
  off = 0;

  constructor(bytes: Uint8Array) {
    this.u8 = bytes;
    this.dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  private ensure(n: number) {
    if (this.off + n > this.u8.byteLength) throw new Error("RMESH truncated");
  }

  readU8(): number {
    this.ensure(1);
    return this.u8[this.off++]!;
  }

  readI32LE(): number {
    this.ensure(4);
    const v = this.dv.getInt32(this.off, true);
    this.off += 4;
    return v;
  }

  readF32LE(): number {
    this.ensure(4);
    const v = this.dv.getFloat32(this.off, true);
    this.off += 4;
    return v;
  }

  readString(): string {
    const n = this.readI32LE();
    if (n < 0 || n > 1024 * 1024) throw new Error(`RMESH bad string len ${n}`);
    this.ensure(n);
    const s = new TextDecoder().decode(this.u8.subarray(this.off, this.off + n));
    this.off += n;
    return s;
  }
}

const readCollisionSurface = (r: Reader): RMeshCollisionSurface => {
  const vCount = r.readI32LE();
  if (vCount < 0 || vCount > 10_000_000) throw new Error(`RMESH bad vertexCount ${vCount}`);
  const pos = new Float32Array(vCount * 3);
  for (let i = 0; i < vCount; i++) {
    pos[i * 3 + 0] = r.readF32LE();
    pos[i * 3 + 1] = r.readF32LE();
    pos[i * 3 + 2] = r.readF32LE();
  }
  const tCount = r.readI32LE();
  if (tCount < 0 || tCount > 10_000_000) throw new Error(`RMESH bad triCount ${tCount}`);
  const idx = new Uint32Array(tCount * 3);
  for (let i = 0; i < tCount; i++) {
    idx[i * 3 + 0] = r.readI32LE() >>> 0;
    idx[i * 3 + 1] = r.readI32LE() >>> 0;
    idx[i * 3 + 2] = r.readI32LE() >>> 0;
  }
  return { positions: pos, indices: idx };
};

export const parseRMesh = (bytes: Uint8Array): RMeshFile => {
  const r = new Reader(bytes);
  const header = r.readString();
  if (header !== "RoomMesh" && header !== "RoomMesh.HasTriggerBox") {
    throw new Error(`Invalid RMESH header: ${header}`);
  }

  const drawnCount = r.readI32LE();
  if (drawnCount < 0 || drawnCount > 100_000) throw new Error(`RMESH bad drawnCount ${drawnCount}`);
  const drawn: RMeshSurface[] = [];

  for (let s = 0; s < drawnCount; s++) {
    const tex0Kind = r.readU8();
    const tex0Name = tex0Kind ? r.readString() : undefined;
    const tex1Kind = r.readU8();
    const tex1Name = tex1Kind ? r.readString() : undefined;
    const vCount = r.readI32LE();
    if (vCount < 0 || vCount > 10_000_000) throw new Error(`RMESH bad vertexCount ${vCount}`);

    const positions = new Float32Array(vCount * 3);
    const uvs0 = new Float32Array(vCount * 2);
    const uvs1 = new Float32Array(vCount * 2);
    const colorsRgb = new Uint8Array(vCount * 3);

    for (let i = 0; i < vCount; i++) {
      positions[i * 3 + 0] = r.readF32LE();
      positions[i * 3 + 1] = r.readF32LE();
      positions[i * 3 + 2] = r.readF32LE();

      uvs0[i * 2 + 0] = r.readF32LE();
      uvs0[i * 2 + 1] = r.readF32LE();
      uvs1[i * 2 + 0] = r.readF32LE();
      uvs1[i * 2 + 1] = r.readF32LE();

      colorsRgb[i * 3 + 0] = r.readU8();
      colorsRgb[i * 3 + 1] = r.readU8();
      colorsRgb[i * 3 + 2] = r.readU8();
    }

    const tCount = r.readI32LE();
    if (tCount < 0 || tCount > 10_000_000) throw new Error(`RMESH bad triCount ${tCount}`);
    const indices = new Uint32Array(tCount * 3);
    for (let i = 0; i < tCount; i++) {
      indices[i * 3 + 0] = r.readI32LE() >>> 0;
      indices[i * 3 + 1] = r.readI32LE() >>> 0;
      indices[i * 3 + 2] = r.readI32LE() >>> 0;
    }

    drawn.push({
      textures: [
        { slot: 0, kind: tex0Kind, name: tex0Name },
        { slot: 1, kind: tex1Kind, name: tex1Name },
      ],
      positions,
      uvs0,
      uvs1,
      colorsRgb,
      indices,
    });
  }

  const collisionCount = r.readI32LE();
  if (collisionCount < 0 || collisionCount > 100_000) throw new Error(`RMESH bad collisionCount ${collisionCount}`);
  const collision: RMeshCollisionSurface[] = [];
  for (let i = 0; i < collisionCount; i++) collision.push(readCollisionSurface(r));

  const triggers: RMeshTriggerBox[] = [];
  if (header === "RoomMesh.HasTriggerBox") {
    const triggerCount = r.readI32LE();
    if (triggerCount < 0 || triggerCount > 10_000) throw new Error(`RMESH bad triggerCount ${triggerCount}`);
    for (let t = 0; t < triggerCount; t++) {
      const surfCount = r.readI32LE();
      if (surfCount < 0 || surfCount > 1_000_000) throw new Error(`RMESH bad trigger surfCount ${surfCount}`);
      const surfaces: RMeshCollisionSurface[] = [];
      for (let s = 0; s < surfCount; s++) surfaces.push(readCollisionSurface(r));
      const name = r.readString();
      triggers.push({ name, surfaces });
    }
  }

  const entityCount = r.readI32LE();
  if (entityCount < 0 || entityCount > 100_000) throw new Error(`RMESH bad entityCount ${entityCount}`);
  const entities: RMeshPointEntity[] = [];

  for (let i = 0; i < entityCount; i++) {
    const type = r.readString().toLowerCase();
    switch (type) {
      case "screen": {
        const x = r.readF32LE();
        const y = r.readF32LE();
        const z = r.readF32LE();
        const imgPath = r.readString();
        entities.push({ type: "screen", x, y, z, imgPath });
        break;
      }
      case "waypoint": {
        const x = r.readF32LE();
        const y = r.readF32LE();
        const z = r.readF32LE();
        entities.push({ type: "waypoint", x, y, z });
        break;
      }
      case "light": {
        const x = r.readF32LE();
        const y = r.readF32LE();
        const z = r.readF32LE();
        const range = r.readF32LE();
        const color = r.readString();
        const intensity = r.readF32LE();
        entities.push({ type: "light", x, y, z, range, color, intensity });
        break;
      }
      case "spotlight": {
        const x = r.readF32LE();
        const y = r.readF32LE();
        const z = r.readF32LE();
        const range = r.readF32LE();
        const color = r.readString();
        const intensity = r.readF32LE();
        const angles = r.readString();
        const innerCone = r.readI32LE();
        const outerCone = r.readI32LE();
        entities.push({ type: "spotlight", x, y, z, range, color, intensity, angles, innerCone, outerCone });
        break;
      }
      case "soundemitter": {
        const x = r.readF32LE();
        const y = r.readF32LE();
        const z = r.readF32LE();
        const sound = r.readI32LE();
        const range = r.readF32LE();
        entities.push({ type: "soundemitter", x, y, z, sound, range });
        break;
      }
      case "playerstart": {
        const x = r.readF32LE();
        const y = r.readF32LE();
        const z = r.readF32LE();
        const angles = r.readString();
        entities.push({ type: "playerstart", x, y, z, angles });
        break;
      }
      case "model": {
        const file = r.readString();
        const x = r.readF32LE();
        const y = r.readF32LE();
        const z = r.readF32LE();
        const pitch = r.readF32LE();
        const yaw = r.readF32LE();
        const roll = r.readF32LE();
        const sx = r.readF32LE();
        const sy = r.readF32LE();
        const sz = r.readF32LE();
        entities.push({ type: "model", file, x, y, z, pitch, yaw, roll, sx, sy, sz });
        break;
      }
      default: {
        // Unknown: best-effort skip by consuming until EOF marker is reached at the end.
        // We can't safely recover without a template; keep raw tag for debugging.
        entities.push({ type, raw: null });
        break;
      }
    }
  }

  // Some exporters write a final "EOF" string; tolerate missing.
  try {
    const tail = r.readString();
    void tail;
  } catch {
    // ignore
  }

  return { header, drawn, collision, triggers, entities };
};

