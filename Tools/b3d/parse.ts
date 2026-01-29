/**
 * Minimal B3D parser for offline conversion.
 *
 * Implements the same core structure as blitz3d-ng's loader_b3d.cpp:
 * - BB3D header
 * - Chunked containers (tag is BE fourcc, size is LE u32)
 * - TEXS/BRUS/NODE/MESH/VRTS/TRIS/BONE/KEYS/ANIM
 *
 * Notes:
 * - Colors are read as 4 float32 (r,g,b,a) per blitz3d-ng (not 4 bytes).
 * - Quaternions in B3D keys are stored as (w,x,y,z) floats.
 */

export type B3DTexture = {
  name: string;
  flags: number;
  blend: number;
  pos: [number, number];
  scale: [number, number];
  rot: number;
};

export type B3DBrush = {
  name: string;
  color: [number, number, number];
  alpha: number;
  shininess: number;
  blend: number;
  fx: number;
  texIds: number[];
};

export type B3DMesh = {
  brushId: number;
  vertexFlags: number;
  texCoordSets: number;
  texCoordSize: number;
  positions: Float32Array;
  normals: Float32Array | null;
  colors: Uint8Array | null; // RGBA 0..255
  uvs0: Float32Array | null;
  uvs1: Float32Array | null;
  indices: Uint32Array;
};

export type B3DBoneWeights = Array<{ vertex: number; weight: number }>;

export type B3DKeys = {
  flags: number;
  frames: number[];
  positions?: Float32Array; // 3 * frames.length
  scales?: Float32Array; // 3 * frames.length
  rotationsWxyz?: Float32Array; // 4 * frames.length, (w,x,y,z)
};

export type B3DNode = {
  name: string;
  translation: [number, number, number];
  scale: [number, number, number];
  rotationWxyz: [number, number, number, number];
  mesh?: B3DMesh;
  bone?: B3DBoneWeights;
  keys?: B3DKeys;
  children: B3DNode[];
};

export type B3DFile = {
  version: number;
  textures: B3DTexture[];
  brushes: B3DBrush[];
  root: B3DNode | null;
  animLenFrames: number;
  animFps: number;
  sequences?: Array<{ name: string; firstFrame: number; lastFrame: number }>;
};

type Chunk = { tag: string; start: number; end: number };

class Reader {
  private view: DataView;
  private u8: Uint8Array;
  off = 0;

  constructor(bytes: Uint8Array) {
    this.u8 = bytes;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  ensure(n: number) {
    if (this.off + n > this.u8.byteLength) throw new Error("B3D truncated");
  }

  readU8(): number {
    this.ensure(1);
    return this.u8[this.off++]!;
  }

  readI32LE(): number {
    this.ensure(4);
    const v = this.view.getInt32(this.off, true);
    this.off += 4;
    return v;
  }

  readU32LE(): number {
    this.ensure(4);
    const v = this.view.getUint32(this.off, true);
    this.off += 4;
    return v;
  }

  readU32BE(): number {
    this.ensure(4);
    const v = this.view.getUint32(this.off, false);
    this.off += 4;
    return v;
  }

  readF32LE(): number {
    this.ensure(4);
    const v = this.view.getFloat32(this.off, true);
    this.off += 4;
    return v;
  }

  readZString(): string {
    const start = this.off;
    while (this.off < this.u8.byteLength && this.u8[this.off] !== 0) this.off++;
    if (this.off >= this.u8.byteLength) throw new Error("B3D unterminated string");
    const bytes = this.u8.subarray(start, this.off);
    this.off++; // NUL
    return new TextDecoder("latin1").decode(bytes);
  }
}

const fourccToString = (v: number) =>
  String.fromCharCode((v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff);

const clamp01 = (x: number) => x < 0 ? 0 : x > 1 ? 1 : x;

const readColorF32 = (r: Reader): [number, number, number, number] => {
  const rr = clamp01(r.readF32LE());
  const gg = clamp01(r.readF32LE());
  const bb = clamp01(r.readF32LE());
  const aa = clamp01(r.readF32LE());
  return [rr, gg, bb, aa];
};

const beginChunk = (r: Reader): Chunk => {
  const tagBE = r.readU32BE();
  const size = r.readU32LE();
  const start = r.off;
  const end = start + size;
  if (end > (r as any).u8.byteLength) throw new Error("B3D chunk exceeds file");
  return { tag: fourccToString(tagBE), start, end };
};

const withChunk = <T>(r: Reader, chunk: Chunk, fn: () => T): T => {
  const prev = r.off;
  r.off = chunk.start;
  const out = fn();
  r.off = chunk.end;
  // ignore unread bytes
  void prev;
  return out;
};

export const parseB3D = (bytes: Uint8Array): B3DFile => {
  const r = new Reader(bytes);

  const magic = String.fromCharCode(r.readU8(), r.readU8(), r.readU8(), r.readU8());
  if (magic !== "BB3D") throw new Error(`Invalid B3D magic ${magic}`);

  // Some files contain a size field after magic; blitz3d-ng doesn't rely on it.
  // Heuristic: if the next u32 equals remaining bytes or remaining-4, skip.
  const possibleSize = r.readU32LE();
  const remaining = bytes.byteLength - r.off;
  if (!(possibleSize === remaining || possibleSize === remaining - 4)) {
    // not a size field; rewind 4
    r.off -= 4;
  }

  const version = r.readI32LE();
  if (version > 1) throw new Error(`Unsupported B3D version ${version}`);

  const textures: B3DTexture[] = [];
  const brushes: B3DBrush[] = [];
  let root: B3DNode | null = null;
  let animLenFrames = 0;
  let animFps = 60;
  const sequences: Array<{ name: string; firstFrame: number; lastFrame: number }> = [];

  while (r.off + 8 <= bytes.byteLength) {
    const chunk = beginChunk(r);
    switch (chunk.tag) {
      case "TEXS":
        withChunk(r, chunk, () => {
          while (r.off < chunk.end) {
            const name = r.readZString();
            const flags = r.readI32LE();
            const blend = r.readI32LE();
            const posU = r.readF32LE();
            const posV = r.readF32LE();
            const sclU = r.readF32LE();
            const sclV = r.readF32LE();
            const rot = r.readF32LE();
            textures.push({ name, flags, blend, pos: [posU, posV], scale: [sclU, sclV], rot });
          }
        });
        break;
      case "BRUS":
        withChunk(r, chunk, () => {
          const numTexs = r.readI32LE();
          while (r.off < chunk.end) {
            const name = r.readZString();
            const col = [r.readF32LE(), r.readF32LE(), r.readF32LE(), r.readF32LE()] as const;
            const shininess = r.readF32LE();
            const blend = r.readI32LE();
            const fx = r.readI32LE();
            const texIds: number[] = [];
            for (let i = 0; i < numTexs; i++) texIds.push(r.readI32LE());
            brushes.push({
              name,
              color: [col[0], col[1], col[2]],
              alpha: col[3],
              shininess,
              blend,
              fx,
              texIds,
            });
          }
        });
        break;
      case "SEQS":
        withChunk(r, chunk, () => {
          while (r.off < chunk.end) {
            const name = r.readZString();
            const firstFrame = r.readI32LE();
            const lastFrame = r.readI32LE();
            if (name) sequences.push({ name, firstFrame, lastFrame });
          }
        });
        break;
      case "NODE":
        root = withChunk(r, chunk, () => readNode(r, chunk.end, () => ({ textures, brushes })));
        break;
      default:
        // skip
        break;
    }
    r.off = chunk.end;
  }

  // Capture top-level ANIM chunk if present (some exporters put it under NODE, but blitz3d-ng reads it inside NODE)
  // We parse it inside node and lift max values.
  const scanAnim = (n: B3DNode | null) => {
    if (!n) return;
    const walk = (node: B3DNode) => {
      if (node.keys) {
        // nothing
      }
      for (const c of node.children) walk(c);
    };
    walk(n);
  };
  scanAnim(root);

  // Parse may have set animLenFrames/animFps via node parsing callback
  // (these are updated in readNode)
  // Keep defaults otherwise.

  const out: B3DFile = { version, textures, brushes, root, animLenFrames, animFps };
  if (sequences.length) out.sequences = sequences;
  return out;

  function readNode(
    r: Reader,
    end: number,
    ctx: () => { textures: B3DTexture[]; brushes: B3DBrush[] },
  ): B3DNode {
    const name = r.readZString();
    const tx = r.readF32LE();
    const ty = r.readF32LE();
    const tz = r.readF32LE();
    const sx = r.readF32LE();
    const sy = r.readF32LE();
    const sz = r.readF32LE();
    const rw = r.readF32LE();
    const rx = r.readF32LE();
    const ry = r.readF32LE();
    const rz = r.readF32LE();

    const node: B3DNode = {
      name,
      translation: [tx, ty, tz],
      scale: [sx, sy, sz],
      rotationWxyz: [rw, rx, ry, rz],
      children: [],
    };

    while (r.off + 8 <= end) {
      const ch = beginChunk(r);
      switch (ch.tag) {
        case "MESH":
          node.mesh = withChunk(r, ch, () => readMesh(r, ch.end, ctx()));
          break;
        case "BONE":
          node.bone = withChunk(r, ch, () => readBone(r, ch.end));
          break;
        case "KEYS":
          node.keys = withChunk(r, ch, () => readKeys(r, ch.end));
          break;
        case "ANIM":
          withChunk(r, ch, () => {
            r.readI32LE(); // flags
            const frames = r.readI32LE();
            const fps = r.readF32LE();
            if (frames > animLenFrames) animLenFrames = frames;
            if (fps > 0) animFps = fps;
          });
          break;
        case "NODE":
          node.children.push(withChunk(r, ch, () => readNode(r, ch.end, ctx)));
          break;
        default:
          break;
      }
      r.off = ch.end;
    }

    return node;
  }

  function readMesh(
    r: Reader,
    end: number,
    ctx: { textures: B3DTexture[]; brushes: B3DBrush[] },
  ): B3DMesh {
    const brushId = r.readI32LE();
    let vertexFlags = 0;
    let texCoordSets = 0;
    let texCoordSize = 0;
    const positions: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];
    const uvs0: number[] = [];
    const uvs1: number[] = [];
    const indices: number[] = [];

    while (r.off + 8 <= end) {
      const ch = beginChunk(r);
      switch (ch.tag) {
        case "VRTS":
          withChunk(r, ch, () => {
            vertexFlags = r.readI32LE();
            texCoordSets = r.readI32LE();
            texCoordSize = r.readI32LE();
            while (r.off < ch.end) {
              positions.push(r.readF32LE(), r.readF32LE(), r.readF32LE());
              if (vertexFlags & 1) normals.push(r.readF32LE(), r.readF32LE(), r.readF32LE());
              if (vertexFlags & 2) {
                const [rr, gg, bb, aa] = readColorF32(r);
                colors.push(
                  Math.round(rr * 255),
                  Math.round(gg * 255),
                  Math.round(bb * 255),
                  Math.round(aa * 255),
                );
              }
              for (let set = 0; set < texCoordSets; set++) {
                const u = r.readF32LE();
                const v = r.readF32LE();
                // skip extra coords if present
                for (let k = 2; k < texCoordSize; k++) r.readF32LE();
                if (set === 0) uvs0.push(u, v);
                else if (set === 1) uvs1.push(u, v);
              }
            }
          });
          break;
        case "TRIS":
          withChunk(r, ch, () => {
            r.readI32LE(); // tris brush id
            while (r.off < ch.end) {
              indices.push(r.readU32LE(), r.readU32LE(), r.readU32LE());
            }
          });
          break;
        default:
          break;
      }
      r.off = ch.end;
    }

    void ctx;

    return {
      brushId,
      vertexFlags,
      texCoordSets,
      texCoordSize,
      positions: new Float32Array(positions),
      normals: normals.length ? new Float32Array(normals) : null,
      colors: colors.length ? new Uint8Array(colors) : null,
      uvs0: uvs0.length ? new Float32Array(uvs0) : null,
      uvs1: uvs1.length ? new Float32Array(uvs1) : null,
      indices: new Uint32Array(indices),
    };
  }

  function readBone(r: Reader, end: number): B3DBoneWeights {
    const weights: B3DBoneWeights = [];
    while (r.off < end) {
      const v = r.readI32LE();
      const w = r.readF32LE();
      weights.push({ vertex: v, weight: w });
    }
    return weights;
  }

  function readKeys(r: Reader, end: number): B3DKeys {
    const flags = r.readI32LE();
    const frames: number[] = [];
    const pos: number[] = [];
    const scl: number[] = [];
    const rot: number[] = [];
    while (r.off < end) {
      const frame = r.readI32LE();
      frames.push(frame);
      if (flags & 1) pos.push(r.readF32LE(), r.readF32LE(), r.readF32LE());
      if (flags & 2) scl.push(r.readF32LE(), r.readF32LE(), r.readF32LE());
      if (flags & 4) rot.push(r.readF32LE(), r.readF32LE(), r.readF32LE(), r.readF32LE());
    }
    const out: B3DKeys = { flags, frames };
    if (pos.length) out.positions = new Float32Array(pos);
    if (scl.length) out.scales = new Float32Array(scl);
    if (rot.length) out.rotationsWxyz = new Float32Array(rot);
    return out;
  }
};
