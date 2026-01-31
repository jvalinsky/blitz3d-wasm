/**
 * Minimal DirectX .x (text) parser for SCPCB conversion.
 *
 * Supports the subset used by SCPCB static meshes:
 * - Frame / FrameTransformMatrix
 * - Mesh / MeshNormals / MeshTextureCoords / MeshMaterialList / Material / TextureFilename
 * - SkinWeights (optional; produces joint influences + inverse bind matrices)
 *
 * Does NOT attempt to support:
 * - compressed X files
 * - full template system (templates are skipped)
 * - animations (AnimationSet) for now
 */

export type XMaterial = {
  name?: string;
  diffuse: [number, number, number, number]; // rgba 0..1
  texture?: string;
};

export type XSkinWeights = {
  boneName: string;
  vertexIndices: Uint32Array;
  weights: Float32Array;
  matrixOffset: Float32Array; // 16 floats
};

export type XMesh = {
  name?: string;
  positions: Float32Array; // 3*n
  indices: Uint32Array; // triangles
  normals?: Float32Array; // 3*n
  uvs0?: Float32Array; // 2*n
  faceMaterial?: Uint32Array; // per-face material index (triangles after triangulation)
  materials?: XMaterial[];
  skins?: XSkinWeights[];
};

export type XFrame = {
  name?: string;
  transform?: Float32Array; // 16 floats, row-major as stored in file
  children: XFrame[];
  mesh?: XMesh;
};

export type XFile = {
  root: XFrame;
  meshes: XMesh[];
  animTicksPerSecond?: number;
};

type TokType = "id" | "num" | "str" | "sym" | "eof";
type Tok = { type: TokType; text: string; pos: number };

class Lexer {
  private s: string;
  private i = 0;

  constructor(text: string) {
    this.s = text;
  }

  private peekChar(): string {
    return this.i < this.s.length ? this.s[this.i]! : "";
  }

  private nextChar(): string {
    return this.i < this.s.length ? this.s[this.i++]! : "";
  }

  private skipWsAndComments() {
    while (true) {
      // whitespace
      while (this.i < this.s.length) {
        const c = this.peekChar();
        if (c === " " || c === "\t" || c === "\r" || c === "\n") this.i++;
        else break;
      }

      // comment: //...
      if (this.peekChar() === "/" && this.s[this.i + 1] === "/") {
        this.i += 2;
        while (this.i < this.s.length && this.peekChar() !== "\n") this.i++;
        continue;
      }

      // comment: #...
      if (this.peekChar() === "#") {
        while (this.i < this.s.length && this.peekChar() !== "\n") this.i++;
        continue;
      }

      break;
    }
  }

  next(): Tok {
    this.skipWsAndComments();
    const pos = this.i;
    if (this.i >= this.s.length) return { type: "eof", text: "", pos };

    const c = this.nextChar();

    // symbols
    if ("{}[](),;".includes(c)) return { type: "sym", text: c, pos };

    // string
    if (c === '"') {
      let out = "";
      while (this.i < this.s.length) {
        const ch = this.nextChar();
        if (ch === '"') break;
        out += ch;
      }
      return { type: "str", text: out, pos };
    }

    // number (allow leading - and decimals, exponent)
    if ((c >= "0" && c <= "9") || c === "-" || c === ".") {
      let out = c;
      while (this.i < this.s.length) {
        const p = this.peekChar();
        if (
          (p >= "0" && p <= "9") || p === "." || p === "e" || p === "E" ||
          p === "+" || p === "-"
        ) {
          out += this.nextChar();
        } else break;
      }
      // A lone "-" can appear in templates; treat as id.
      const numLike = /^[-+]?(?:\d+(\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?$/.test(out);
      return { type: numLike ? "num" : "id", text: out, pos };
    }

    // identifier
    if (
      (c >= "A" && c <= "Z") || (c >= "a" && c <= "z") || c === "_" ||
      c === "$"
    ) {
      let out = c;
      while (this.i < this.s.length) {
        const p = this.peekChar();
        if (
          (p >= "A" && p <= "Z") || (p >= "a" && p <= "z") ||
          (p >= "0" && p <= "9") || p === "_" || p === "-" || p === "."
        ) {
          out += this.nextChar();
        } else break;
      }
      return { type: "id", text: out, pos };
    }

    // unknown char; return as sym
    return { type: "sym", text: c, pos };
  }
}

class Parser {
  private lex: Lexer;
  private look: Tok;

  constructor(text: string) {
    this.lex = new Lexer(text);
    this.look = this.lex.next();
  }

  private eat(type?: TokType, text?: string): Tok {
    const t = this.look;
    if (type && t.type !== type) throw new Error(`X parse: expected ${type}, got ${t.type} at ${t.pos}`);
    if (text && t.text !== text) throw new Error(`X parse: expected '${text}', got '${t.text}' at ${t.pos}`);
    this.look = this.lex.next();
    return t;
  }

  private maybeEat(type: TokType, text?: string): boolean {
    if (this.look.type !== type) return false;
    if (text != null && this.look.text !== text) return false;
    this.look = this.lex.next();
    return true;
  }

  private skipTemplate() {
    // "template Name { ... }"
    this.eat("id", "template");
    if (this.look.type === "id") this.eat("id");
    this.eat("sym", "{");
    let depth = 1;
    while (depth > 0 && this.look.type !== "eof") {
      if (this.maybeEat("sym", "{")) depth++;
      else if (this.maybeEat("sym", "}")) depth--;
      else this.look = this.lex.next();
    }
  }

  private readF32(): number {
    const t = this.eat("num");
    const n = Number(t.text);
    if (!Number.isFinite(n)) throw new Error(`X parse: bad number '${t.text}'`);
    return n;
  }

  private readU32(): number {
    const n = this.readF32();
    return (n >>> 0);
  }

  private expectSep() {
    // numbers in .x use both ';' and ',' as separators, often in patterns like:
    //   x;y;z;,
    // and list terminators like:
    //   ...;;
    // Consume one-or-more delimiters in any order.
    let consumed = false;
    while (true) {
      if (this.maybeEat("sym", ";")) {
        consumed = true;
        continue;
      }
      if (this.maybeEat("sym", ",")) {
        consumed = true;
        continue;
      }
      break;
    }
    if (!consumed) throw new Error(`X parse: expected delimiter at ${this.look.pos}`);
  }

  private readFloatList(count: number): Float32Array {
    const out = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      out[i] = this.readF32();
      if (i + 1 < count) this.maybeEat("sym", ",");
    }
    return out;
  }

  private readIntList(count: number): Uint32Array {
    const out = new Uint32Array(count);
    for (let i = 0; i < count; i++) {
      out[i] = this.readU32();
      if (i + 1 < count) this.maybeEat("sym", ",");
    }
    return out;
  }

  private parseFrame(name?: string): XFrame {
    // Frame [Name] { ... }
    if (name == null) name = this.parseName();
    this.eat("sym", "{");
    const frame: XFrame = { name, children: [] };
    while (this.look.type !== "eof" && !(this.look.type === "sym" && this.look.text === "}")) {
      if (this.look.type === "id" && this.look.text === "template") {
        this.skipTemplate();
        continue;
      }
      if (this.look.type !== "id") {
        this.look = this.lex.next();
        continue;
      }
      const kind = this.eat("id").text;
      if (kind === "FrameTransformMatrix") {
        this.eat("sym", "{");
        const m = new Float32Array(16);
        for (let i = 0; i < 16; i++) {
          m[i] = this.readF32();
          if (i + 1 < 16) this.maybeEat("sym", ",");
        }
        this.maybeEat("sym", ";");
        this.maybeEat("sym", ";");
        this.eat("sym", "}");
        frame.transform = m;
        continue;
      }
      if (kind === "Frame") {
        const childName = this.parseName();
        const child = this.parseFrame(childName);
        frame.children.push(child);
        continue;
      }
      if (kind === "Mesh") {
        const meshName = this.parseName();
        frame.mesh = this.parseMesh(meshName);
        continue;
      }

      // Unknown object: try to skip balanced braces if present.
      if (this.look.type === "id") {
        // optional id
        this.eat("id");
      }
      if (this.maybeEat("sym", "{")) {
        let depth = 1;
        while (depth > 0 && this.look.type !== "eof") {
          if (this.maybeEat("sym", "{")) depth++;
          else if (this.maybeEat("sym", "}")) depth--;
          else this.look = this.lex.next();
        }
      }
    }
    this.eat("sym", "}");
    return frame;
  }

  private parseName(): string | undefined {
    // Parser for optional object name.
    // Standard X requires simple identifiers (alphanumeric, no start digit).
    // Some exporters (e.g. for SCPCB) produce names like "09_-_Default", which lex as num(09) + id(_-_Default).
    // We relax expectations to consume a sequence of IDs/NUMs as the name.
    if (this.look.type !== "id" && this.look.type !== "num") return undefined;

    let name = "";
    while (this.look.type === "id" || this.look.type === "num") {
      name += this.look.text;
      this.look = this.lex.next();
      // If we see a symbol next (like '{'), stop.
      if (this.look.type === "sym") break;
    }
    return name;
  }

  private parseMaterial(name?: string): XMaterial {
    // Material [name] { r;g;b;a;; power; spec(r,g,b); emiss(r,g,b); [TextureFilename { "..." ; }]
    if (name == null) name = this.parseName();
    this.eat("sym", "{");
    const r = this.readF32(); this.eat("sym", ";");
    const g = this.readF32(); this.eat("sym", ";");
    const b = this.readF32(); this.eat("sym", ";");
    const a = this.readF32(); this.eat("sym", ";");
    this.maybeEat("sym", ";");

    // power
    this.readF32(); this.expectSep();
    // specular rgb
    this.readF32(); this.eat("sym", ";");
    this.readF32(); this.eat("sym", ";");
    this.readF32(); this.expectSep();
    // emissive rgb
    this.readF32(); this.eat("sym", ";");
    this.readF32(); this.eat("sym", ";");
    this.readF32(); this.expectSep();

    let texture: string | undefined;
    while (!(this.look.type === "sym" && this.look.text === "}")) {
      if (this.look.type === "id" && (this.look.text === "TextureFilename" || this.look.text === "TextureFileName")) {
        this.eat("id");
        this.eat("sym", "{");
        texture = this.eat("str").text;
        this.expectSep();
        this.eat("sym", "}");
      } else {
        // skip unknown
        this.look = this.lex.next();
      }
    }
    this.eat("sym", "}");
    return { name, diffuse: [r, g, b, a], texture };
  }

  private parseMeshNormals(): Float32Array | undefined {
    // MeshNormals { nNormals; normals[nNormals]; nFaceNormals; faceNormals[...] }
    this.eat("sym", "{");
    const n = this.readU32(); this.expectSep();
    const normals = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      normals[i * 3 + 0] = this.readF32(); this.eat("sym", ";");
      normals[i * 3 + 1] = this.readF32(); this.eat("sym", ";");
      normals[i * 3 + 2] = this.readF32(); this.expectSep();
    }
    // face normals section: skip (we only support per-vertex)
    const fn = this.readU32(); this.expectSep();
    for (let i = 0; i < fn; i++) {
      const cnt = this.readU32(); this.eat("sym", ";");
      for (let j = 0; j < cnt; j++) {
        this.readU32();
        if (j + 1 < cnt) this.maybeEat("sym", ",");
      }
      this.expectSep();
    }
    this.eat("sym", "}");
    return normals;
  }

  private parseMeshTexCoords(): Float32Array | undefined {
    this.eat("sym", "{");
    const n = this.readU32(); this.expectSep();
    const uvs = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      uvs[i * 2 + 0] = this.readF32(); this.expectSep();
      uvs[i * 2 + 1] = this.readF32(); this.expectSep();
    }
    this.eat("sym", "}");
    return uvs;
  }

  private parseSkinWeights(): XSkinWeights {
    // SkinWeights { "bone"; nWeights; vertexIndices[nWeights]; weights[nWeights]; Matrix4x4; }
    this.eat("sym", "{");
    const boneName = this.eat("str").text;
    this.expectSep();
    const n = this.readU32(); this.expectSep();
    const vertexIndices = this.readIntList(n);
    this.expectSep();
    const weights = this.readFloatList(n);
    this.expectSep();
    const matrixOffset = this.readFloatList(16);
    this.expectSep();
    this.eat("sym", "}");
    return { boneName, vertexIndices, weights, matrixOffset };
  }

  private parseMeshMaterialList(faceCount: number): { materials: XMaterial[]; faceMat: Uint32Array } {
    this.eat("sym", "{");
    const nMat = this.readU32(); this.expectSep();
    const nFaceIdx = this.readU32(); this.expectSep();
    const faceIdx = new Uint32Array(nFaceIdx);
    for (let i = 0; i < nFaceIdx; i++) {
      faceIdx[i] = this.readU32();
      if (i + 1 < nFaceIdx) this.maybeEat("sym", ",");
    }
    this.expectSep();

    const materials: XMaterial[] = [];
    while (!(this.look.type === "sym" && this.look.text === "}")) {
      if (this.look.type === "id" && this.look.text === "Material") {
        this.eat("id");
        const name = this.look.type === "id" ? this.eat("id").text : undefined;
        materials.push(this.parseMaterial(name));
      } else {
        // Skip unhandled references
        this.look = this.lex.next();
      }
    }
    this.eat("sym", "}");

    // If faceIdx count doesn't match faces, pad/truncate.
    const outFace = new Uint32Array(faceCount);
    for (let i = 0; i < faceCount; i++) outFace[i] = faceIdx[i] ?? 0;
    // Ensure at least one material
    while (materials.length < Math.max(1, nMat)) {
      materials.push({ diffuse: [1, 1, 1, 1] });
    }
    return { materials, faceMat: outFace };
  }

  private parseMesh(name?: string): XMesh {
    this.eat("sym", "{");
    const nVerts = this.readU32(); this.expectSep();
    const positions = new Float32Array(nVerts * 3);
    for (let i = 0; i < nVerts; i++) {
      positions[i * 3 + 0] = this.readF32(); this.eat("sym", ";");
      positions[i * 3 + 1] = this.readF32(); this.eat("sym", ";");
      positions[i * 3 + 2] = this.readF32(); this.expectSep();
    }

    const nFaces = this.readU32(); this.expectSep();
    const triIndices: number[] = [];
    const faceTriMap: number[] = []; // triangle index -> face index
    for (let f = 0; f < nFaces; f++) {
      const cnt = this.readU32(); this.eat("sym", ";");
      const verts: number[] = [];
      for (let j = 0; j < cnt; j++) {
        verts.push(this.readU32());
        if (j + 1 < cnt) this.maybeEat("sym", ",");
      }
      this.expectSep();
      if (cnt >= 3) {
        for (let j = 2; j < cnt; j++) {
          triIndices.push(verts[0]!, verts[j - 1]!, verts[j]!);
          faceTriMap.push(f);
        }
      }
    }

    const mesh: XMesh = {
      name,
      positions,
      indices: new Uint32Array(triIndices),
    };

    // Parse child blocks inside Mesh
    const skins: XSkinWeights[] = [];
    while (!(this.look.type === "sym" && this.look.text === "}")) {
      if (this.look.type !== "id") {
        this.look = this.lex.next();
        continue;
      }
      const kind = this.eat("id").text;
      if (kind === "MeshNormals") {
        const n = this.parseMeshNormals();
        if (n && n.length === nVerts * 3) mesh.normals = n;
      } else if (kind === "MeshTextureCoords") {
        const u = this.parseMeshTexCoords();
        if (u && u.length === nVerts * 2) mesh.uvs0 = u;
      } else if (kind === "MeshMaterialList") {
        const mm = this.parseMeshMaterialList(faceTriMap.length);
        mesh.materials = mm.materials;
        // expand per-triangle material by faceTriMap
        const perTri = new Uint32Array(faceTriMap.length);
        for (let i = 0; i < faceTriMap.length; i++) {
          perTri[i] = mm.faceMat[faceTriMap[i]!] ?? 0;
        }
        mesh.faceMaterial = perTri;
      } else if (kind === "SkinWeights") {
        skins.push(this.parseSkinWeights());
      } else if (kind === "VertexDuplicationIndices") {
        // skip
        this.eat("sym", "{");
        let depth = 1;
        while (depth > 0 && this.look.type !== "eof") {
          if (this.maybeEat("sym", "{")) depth++;
          else if (this.maybeEat("sym", "}")) depth--;
          else this.look = this.lex.next();
        }
      } else {
        // skip unknown object
        if (this.look.type === "id") this.eat("id");
        if (this.maybeEat("sym", "{")) {
          let depth = 1;
          while (depth > 0 && this.look.type !== "eof") {
            if (this.maybeEat("sym", "{")) depth++;
            else if (this.maybeEat("sym", "}")) depth--;
            else this.look = this.lex.next();
          }
        }
      }
    }
    this.eat("sym", "}");
    if (skins.length) mesh.skins = skins;
    return mesh;
  }

  private skipObjectBodyIfPresent() {
    if (!this.maybeEat("sym", "{")) return;
    let depth = 1;
    while (depth > 0 && this.look.type !== "eof") {
      if (this.maybeEat("sym", "{")) depth++;
      else if (this.maybeEat("sym", "}")) depth--;
      else this.look = this.lex.next();
    }
  }

  private parseAnimTicksPerSecond(): number {
    this.eat("sym", "{");
    const v = this.readU32();
    this.expectSep();
    this.eat("sym", "}");
    return v;
  }

  parse(): XFile {
    // Header: "xof 0303txt 0032" etc. We'll skip tokens until we hit a top-level object.
    const root: XFrame = { name: "__root", children: [] };
    const meshes: XMesh[] = [];
    let animTicksPerSecond: number | undefined;

    while (this.look.type !== "eof") {
      if (this.look.type === "id" && this.look.text === "template") {
        this.skipTemplate();
        continue;
      }
      if (this.look.type !== "id") {
        this.look = this.lex.next();
        continue;
      }

      const kind = this.eat("id").text;
      if (kind === "Frame") {
        const name = this.look.type === "id" ? this.eat("id").text : undefined;
        root.children.push(this.parseFrame(name));
        continue;
      }
      if (kind === "Mesh") {
        const name = this.look.type === "id" ? this.eat("id").text : undefined;
        meshes.push(this.parseMesh(name));
        continue;
      }
      if (kind === "AnimTicksPerSecond") {
        animTicksPerSecond = this.parseAnimTicksPerSecond();
        continue;
      }

      // Unknown top-level object; best-effort skip.
      if (this.look.type === "id") this.eat("id"); // optional object name
      this.skipObjectBodyIfPresent();
    }

    if (!root.children.length && !meshes.length) throw new Error("X parse: no top-level objects found");
    const out: XFile = { root, meshes };
    if (animTicksPerSecond != null) out.animTicksPerSecond = animTicksPerSecond;
    return out;
  }
}

export const parseTextX = (text: string): XFile => {
  // Quick format check
  const head = text.slice(0, 16).toLowerCase();
  if (!head.includes("xof")) throw new Error("Not an X file (missing xof header)");
  if (!head.includes("txt")) {
    console.warn(`[x-convert] Skipping unsupported format: ${head.substring(4, 16).trim()}`);
    return { root: { name: "__skipped", children: [] }, meshes: [] }; // Return empty/ignored
  }
  const p = new Parser(text);
  return p.parse();
};
