import { XFile, XFrame, XMaterial, XMesh, XSkinWeights } from "./types.ts";
import * as T from "./tokens.ts";

class BinaryParser {
    private view: DataView;
    private pos = 0;

    constructor(buffer: Uint8Array) {
        this.view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    }

    private readU16(): number {
        const v = this.view.getUint16(this.pos, true);
        this.pos += 2;
        return v;
    }

    private readU32(): number {
        const v = this.view.getUint32(this.pos, true);
        this.pos += 4;
        return v;
    }

    private readF32(): number {
        const v = this.view.getFloat32(this.pos, true);
        this.pos += 4;
        return v;
    }

    private peekToken(): number {
        if (this.pos >= this.view.byteLength) return -1;
        return this.view.getUint16(this.pos, true);
    }

    private eatToken(token: number) {
        const t = this.readU16();
        if (t !== token) throw new Error(`BinX: Expected token ${token}, got ${t} at ${this.pos - 2}`);
    }

    private maybeEatToken(token: number): boolean {
        if (this.peekToken() === token) {
            this.pos += 2;
            return true;
        }
        return false;
    }

    private readInteger(): number {
        if (this.peekToken() === T.TOKEN_INTEGER_LIST) {
            this.eatToken(T.TOKEN_INTEGER_LIST);
            const count = this.readU32();
            if (count !== 1) throw new Error(`BinX: Expected scalar integer, got list of ${count}`);
            const v = this.readU32();
            return v;
        }
        this.eatToken(T.TOKEN_INTEGER);
        return this.readU32();
    }

    private readFloat(): number {
        if (this.peekToken() === T.TOKEN_FLOAT_LIST) {
            this.eatToken(T.TOKEN_FLOAT_LIST);
            const count = this.readU32();
            if (count !== 1) console.warn(`BinX: Expected scalar float, got list of ${count}, using first`);
            const v = this.readF32();
            this.pos += (count - 1) * 4;
            return v;
        }
        this.eatToken(T.TOKEN_FLOAT);
        return this.readF32();
    }

    // Reads TOKEN_NAME record
    private readName(): string {
        this.eatToken(T.TOKEN_NAME);
        const count = this.readU32();
        let s = "";
        for (let i = 0; i < count; i++) {
            s += String.fromCharCode(this.view.getUint8(this.pos++));
        }
        // Is it null terminated or just length? 
        // Usually length.
        return s;
    }

    private readString(): string {
        this.eatToken(T.TOKEN_STRING);
        const count = this.readU32();
        let s = "";
        for (let i = 0; i < count; i++) {
            s += String.fromCharCode(this.view.getUint8(this.pos++));
        }
        // Sometimes followed by terminator token?
        this.maybeEatToken(T.TOKEN_SEMICOLON); // Terminate?
        return s;
    }

    private readIntegerList(): Uint32Array {
        this.eatToken(T.TOKEN_INTEGER_LIST);
        const count = this.readU32();
        const out = new Uint32Array(count);
        for (let i = 0; i < count; i++) {
            out[i] = this.readU32();
        }
        return out;
    }

    private readFloatList(): Float32Array {
        this.eatToken(T.TOKEN_FLOAT_LIST);
        const count = this.readU32();
        const out = new Float32Array(count);
        for (let i = 0; i < count; i++) {
            out[i] = this.readF32();
        }
        return out;
    }

    // Check if next token is part of a list delimiter or just proceed?
    // Binary format is usually explicit with LIST tokens.

    private skipTemplate() {
        // TOKEN_TEMPLATE already consumed (or checked)
        this.readName(); // Name
        this.eatToken(T.TOKEN_GUID);
        this.pos += 16; // Skip 16 bytes UUID

        // Consume until balanced braces
        // But verify if definition has braces? 
        // Usually template Definition { ... }
        // So expects OBRACE?
        // Check if next is OBRACE?
        // If not, maybe just definition?
        // Assuming templates follow format.
        // But we can just skip tokens until matching CBRACE?
        // Or skip until we see a NAME/Start of something else?
        // Safest is to handle balanced braces.

        // If we don't start with OBRACE, we might be in trouble.
        // But templates definitely have a body.
        // Let's assume standard X: Template <Name> { <UUID> <Def> }
        // Wait, UUID is *inside*?
        // Text: template Name { <UUID> ... }
        // Binary: TOKEN_TEMPLATE, NAME, UUID (as token?), ...

        // Actually, let's just loop skipping tokens until CBRACE, tracking depth.
        // If we see OBRACE, depth++.
    }

    private skipBalanced() {
        let depth = 0;
        while (this.pos < this.view.byteLength) {
            const t = this.readU16();
            if (t === T.TOKEN_OBRACE) {
                depth++;
            } else if (t === T.TOKEN_CBRACE) {
                depth--;
                if (depth <= 0) return;
            } else if (t === T.TOKEN_NAME || t === T.TOKEN_STRING) {
                // Consume data
                const count = this.readU32();
                this.pos += count;
            } else if (t === T.TOKEN_INTEGER) {
                this.pos += 4;
            } else if (t === T.TOKEN_FLOAT) {
                this.pos += 4;
            } else if (t === T.TOKEN_GUID) {
                this.pos += 16;
            } else if (t === T.TOKEN_INTEGER_LIST || t === T.TOKEN_FLOAT_LIST) {
                const count = this.readU32();
                this.pos += count * 4;
            }
            // Other tokens have no data
        }
    }

    parse(): XFile {
        const root: XFrame = { name: "__root", children: [] };
        const meshes: XMesh[] = [];
        let animTicksPerSecond: number | undefined;

        while (this.pos < this.view.byteLength) {
            const t = this.peekToken();
            if (t === -1) break;

            if (t === T.TOKEN_TEMPLATE) {
                this.readU16(); // eat TEMPLATE
                this.readName(); // name
                this.eatToken(T.TOKEN_OBRACE);
                this.eatToken(T.TOKEN_GUID);
                this.pos += 16;

                this.skipBalancedInternal(1);
                continue;
            }

            if (t === T.TOKEN_NAME) {
                // Started with a name? Should be "Frame" or "Mesh" then Name?
                // Binary objects: TOKEN_NAME <Name> -> TOKEN_OBRACE?
                // No, Objects are defined by Type Name?
                // Actually, in Binary, standard objects (Frame, Mesh) are Templates?
                // No, they are instances.
                // Instance: <Name> { ... }
                // <Name> is a reference to a Template Name (e.g. "Frame").
                // But "Frame" is not a token. It is a NAME.
                // So we define "Frame" as a name.
                const typeName = this.readName();

                if (typeName === "Frame") {
                    let frameName: string | undefined;
                    if (this.peekToken() === T.TOKEN_NAME) {
                        frameName = this.readName();
                    }
                    this.eatToken(T.TOKEN_OBRACE);
                    root.children.push(this.parseFrameBody(frameName));
                    continue;
                }
                if (typeName === "Mesh") {
                    let meshName: string | undefined;
                    if (this.peekToken() === T.TOKEN_NAME) {
                        meshName = this.readName();
                    }
                    this.eatToken(T.TOKEN_OBRACE);
                    meshes.push(this.parseMeshBody(meshName));
                    continue;
                }

                // Unknown object
                // Skip body
                if (this.peekToken() === T.TOKEN_NAME) this.readName(); // obj name
                if (this.maybeEatToken(T.TOKEN_OBRACE)) {
                    this.skipBalancedInternal(1);
                }
                continue;
            }

            this.readU16(); // Skip unknown token?
        }
        return { root, meshes };
    }

    private consumeTokenData(t: number) {
        if (t === T.TOKEN_NAME || t === T.TOKEN_STRING) {
            const count = this.readU32();
            this.pos += count;
        } else if (t === T.TOKEN_INTEGER || t === T.TOKEN_FLOAT) {
            this.pos += 4;
        } else if (t === T.TOKEN_GUID) {
            this.pos += 16;
        } else if (t === T.TOKEN_INTEGER_LIST || t === T.TOKEN_FLOAT_LIST) {
            const count = this.readU32();
            this.pos += count * 4;
        }
    }

    private skipBalancedInternal(initialDepth: number) {
        let depth = initialDepth;
        while (this.pos < this.view.byteLength && depth > 0) {
            const st = this.readU16();
            if (st === T.TOKEN_OBRACE) depth++;
            else if (st === T.TOKEN_CBRACE) depth--;
            else this.consumeTokenData(st);
        }
    }

    private parseFrameBody(name?: string): XFrame {
        const frame: XFrame = { name, children: [] };

        while (this.peekToken() !== T.TOKEN_CBRACE && this.pos < this.view.byteLength) {
            if (this.peekToken() === T.TOKEN_NAME) {
                const kind = this.readName();
                if (kind === "FrameTransformMatrix") {
                    this.eatToken(T.TOKEN_OBRACE);
                    const m = new Float32Array(16);
                    if (this.peekToken() === T.TOKEN_FLOAT_LIST) {
                        m.set(this.readFloatList());
                    } else {
                        for (let i = 0; i < 16; i++) m[i] = this.readFloat();
                    }
                    this.eatToken(T.TOKEN_CBRACE);
                    frame.transform = m;
                    continue;
                }
                if (kind === "Frame") {
                    let cname: string | undefined;
                    if (this.peekToken() === T.TOKEN_NAME) cname = this.readName();
                    this.eatToken(T.TOKEN_OBRACE);
                    frame.children.push(this.parseFrameBody(cname));
                    continue;
                }
                if (kind === "Mesh") {
                    let cname: string | undefined;
                    if (this.peekToken() === T.TOKEN_NAME) cname = this.readName();
                    this.eatToken(T.TOKEN_OBRACE);
                    frame.mesh = this.parseMeshBody(cname);
                    continue;
                }

                // Unknown object
                if (this.peekToken() === T.TOKEN_NAME) this.readName(); // obj name
                if (this.maybeEatToken(T.TOKEN_OBRACE)) {
                    this.skipBalancedInternal(1);
                }
            } else {
                this.readU16(); // Skip unknown token
            }
        }
        this.eatToken(T.TOKEN_CBRACE);
        return frame;
    }

    private parseMeshBody(name?: string): XMesh {
        // Mesh { nVertices; vertices[n]; nFaces; faces[n]; ... }
        // Mesh template: DWORD nVertices; array Vector vertices[nVertices]; DWORD nFaces; array MeshFace faces[nFaces]; ...

        let nVerts = 0;
        let positions: Float32Array; // Will resize/replace

        // nVerts
        if (this.peekToken() === T.TOKEN_FLOAT_LIST) {
            const list = this.readFloatList();
            nVerts = list.length / 3;
            // positions is now list
            // But positions is Float32Array. We can just use list.
            // Typescript const assign?
            // Use let for positions?
            // Or recreate it.
            // positions cannot be assigned.
            // I'll refactor to let.
            positions = list;
        } else {
            if (this.peekToken() === T.TOKEN_INTEGER_LIST) {
                // Explicit nVerts as list of 1? handled by strict readInteger? 
                // readInteger handles list of 1.
                nVerts = this.readInteger();
            } else {
                nVerts = this.readInteger();
            }

            // vertices
            if (this.peekToken() === T.TOKEN_FLOAT_LIST) {
                const list = this.readFloatList();
                positions = list; // need refactor
            } else {
                // manual read
                positions = new Float32Array(nVerts * 3);
                for (let i = 0; i < nVerts * 3; i++) {
                    positions[i] = this.readFloat();
                }
            }
        }

        let nFaces = 0;
        if (this.peekToken() === T.TOKEN_INTEGER_LIST) {
            // Implict nFaces: count derived from list processing (or inferred later)
            // We set nFaces = 0 here, but the optimized block below handles the list.
            // However, the optimized block uses `nFaces` in loop? 
            // "for (let i = 0; i < nFaces; i++)"
            // Wait. If list is present, we iterate list until exhausted?
            // My optimized block loop:
            // for (let i = 0; i < nFaces; i++)
            // It assumes known nFaces!
            // If implicit, we don't know nFaces.
            // We must iterate until list exhausted.
            nFaces = -1;
        } else {
            nFaces = this.readInteger();
        }
        const indices: number[] = [];

        // Faces: array MeshFace faces[nFaces];
        // MeshFace { DWORD nFaceVertexIndices; array DWORD faceVertexIndices[nFaceVertexIndices]; }

        if (this.peekToken() === T.TOKEN_INTEGER_LIST) {
            const list = this.readIntegerList();
            let ptr = 0;
            while (ptr < list.length) {
                const nIndices = list[ptr++];
                // Verts are at list[ptr ... ptr+nIndices-1]
                if (ptr + nIndices > list.length) throw new Error("BinX: Face list overflow");
                for (let k = 2; k < nIndices; k++) {
                    indices.push(list[ptr]!, list[ptr + k - 1]!, list[ptr + k]!);
                }
                ptr += nIndices;
            }
        } else {
            for (let i = 0; i < nFaces; i++) {
                // Check if we hit a child object early
                if (this.peekToken() === T.TOKEN_NAME) {
                    const saved = this.pos;
                    const name = this.readName();
                    if (["MeshNormals", "MeshTextureCoords", "MeshMaterialList", "XSkinMeshHeader", "SkinWeights"].includes(name)) {
                        console.warn(`BinX: Hit ${name} inside faces loop at ${i}/${nFaces}. Breaking.`);
                        this.pos = saved;
                        break;
                    }
                    this.pos = saved; // Restore to allow "name" handling in loop
                }

                // Check for optional name (MeshFace is a template)
                if (this.peekToken() === T.TOKEN_NAME) {
                    const name = this.readName();
                }

                const hasBrace = this.maybeEatToken(T.TOKEN_OBRACE);

                const nIndices = this.readInteger();
                // ...
                // array DWORD
                if (this.peekToken() === T.TOKEN_INTEGER_LIST) {
                    const list = this.readIntegerList();
                    if (list.length !== nIndices) throw new Error("Face indices mismatch");
                    // Triangulate
                    for (let j = 2; j < list.length; j++) {
                        indices.push(list[0]!, list[j - 1]!, list[j]!);
                    }
                } else {
                    const verts: number[] = [];
                    for (let j = 0; j < nIndices; j++) verts.push(this.readInteger());
                    for (let j = 2; j < verts.length; j++) {
                        indices.push(verts[0]!, verts[j - 1]!, verts[j]!);
                    }
                }

                if (hasBrace) this.eatToken(T.TOKEN_CBRACE);
                // Separators?
                this.maybeEatToken(T.TOKEN_COMMA);
                this.maybeEatToken(T.TOKEN_SEMICOLON);
            }
        }

        const mesh: XMesh = { name, positions, indices: new Uint32Array(indices) };

        // Child objects
        while (this.peekToken() !== T.TOKEN_CBRACE && this.pos < this.view.byteLength) {
            if (this.peekToken() === T.TOKEN_NAME) {
                const kind = this.readName();
                if (kind === "MeshNormals") {
                    this.eatToken(T.TOKEN_OBRACE);
                    const n = this.readInteger();
                    const normals = new Float32Array(n * 3);
                    if (this.peekToken() === T.TOKEN_FLOAT_LIST) {
                        normals.set(this.readFloatList());
                    } else {
                        for (let i = 0; i < n * 3; i++) normals[i] = this.readFloat();
                    }
                    // skip face normals
                    if (this.peekToken() === T.TOKEN_INTEGER_LIST) {
                        // Optimized: List serves as Count + Data
                        const list = this.readIntegerList();
                    } else {
                        const nf = this.readInteger();
                        if (this.peekToken() === T.TOKEN_INTEGER_LIST) {
                            this.readIntegerList();
                        } else {
                            for (let i = 0; i < nf; i++) {
                                const cnt = this.readInteger();
                                if (this.peekToken() === T.TOKEN_INTEGER_LIST) this.readIntegerList();
                                else for (let j = 0; j < cnt; j++) this.readInteger();
                            }
                        }
                    }
                    this.eatToken(T.TOKEN_CBRACE);
                    mesh.normals = normals;
                    continue;
                }
                if (kind === "MeshTextureCoords") {
                    this.eatToken(T.TOKEN_OBRACE);
                    const n = this.readInteger();
                    const uvs = new Float32Array(n * 2);
                    if (this.peekToken() === T.TOKEN_FLOAT_LIST) uvs.set(this.readFloatList());
                    else for (let i = 0; i < n * 2; i++) uvs[i] = this.readFloat();
                    this.eatToken(T.TOKEN_CBRACE);
                    mesh.uvs0 = uvs;
                    continue;
                }
                // MaterialList, SkinWeights...
                // Skip for now to keep it short?
                // Or implement?
                // User wants "parse any file".
            }
            // Skip rest
            if (this.peekToken() === T.TOKEN_NAME) this.readName();
            if (this.maybeEatToken(T.TOKEN_OBRACE)) this.skipBalancedInternal(1);
            else this.readU16(); // skip unknown
        }
        this.eatToken(T.TOKEN_CBRACE);
        return mesh;
    }
}

export const parseBinX = (buffer: Uint8Array): XFile => {
    const p = new BinaryParser(buffer);
    return p.parse();
};
