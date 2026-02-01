/**
 * Simple SMPK loader - extracts vertex data without Three.js
 * SMPK format: MAGIC(4) + VERSION(4) + JSON_LEN(4) + BIN_LEN(4) + JSON + BIN
 */

export interface SMPKPrimitive {
    positions: Float32Array;
    normals?: Float32Array;
    uvs?: Float32Array;
    uv2?: Float32Array;           // Second UV set for lightmaps
    indices?: Uint16Array | Uint32Array;
    vertexCount: number;
    indexCount: number;
    texturePath?: string;         // Path to base color texture (diffuse)
    lightmapPath?: string;        // Path to lightmap texture
}

export interface SMPKMesh {
    primitives: SMPKPrimitive[];
}

interface SMPKAccessor {
    name?: string;
    offset: number;
    count: number;
    componentType: string; // "f32", "u16", etc.
    type: string; // "VEC3", "VEC2", "SCALAR"
}

interface SMPKJson {
    version: number;
    accessors: SMPKAccessor[];
    meshes: Array<{
        primitives: Array<{
            attributes: Record<string, number>; // attribute name -> accessor index
            indices?: number; // accessor index
            material?: number; // material index
        }>;
    }>;
    materials?: Array<{
        name?: string;
        baseColorTexture?: string;
        lightmapTexture?: string;
    }>;
}

const MAGIC = [0x53, 0x4D, 0x50, 0x4B]; // "SMPK"

/**
 * Load SMPK file and extract all mesh primitives
 */
export async function loadSMPK(url: string): Promise<SMPKMesh> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to load ${url}: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    
    // Verify magic number
    for (let i = 0; i < 4; i++) {
        if (bytes[i] !== MAGIC[i]) {
            throw new Error('Invalid SMPK magic number');
        }
    }
    
    // Read header
    const dv = new DataView(bytes.buffer);
    const version = dv.getUint32(4, true);
    if (version !== 1) {
        throw new Error(`Unsupported SMPK version: ${version}`);
    }
    
    const jsonLen = dv.getUint32(8, true);
    const binLen = dv.getUint32(12, true);
    
    // Extract JSON and binary data
    const jsonStart = 16;
    const jsonEnd = jsonStart + jsonLen;
    const binStart = jsonEnd;
    
    const jsonText = new TextDecoder().decode(bytes.subarray(jsonStart, jsonEnd));
    const json: SMPKJson = JSON.parse(jsonText);
    const bin = bytes.subarray(binStart);
    
    // Get first mesh and all its primitives
    if (!json.meshes || json.meshes.length === 0) {
        throw new Error('No meshes in SMPK file');
    }
    
    const mesh = json.meshes[0];
    const primitives: SMPKPrimitive[] = [];
    
    // Process each primitive (each can have its own material/texture)
    for (const primitive of mesh.primitives) {
        // Extract vertex data
        const positionIdx = primitive.attributes.POSITION;
        const normalIdx = primitive.attributes.NORMAL;
        const texcoord0Idx = primitive.attributes.TEXCOORD_0;
        const texcoord1Idx = primitive.attributes.TEXCOORD_1;
        const indicesIdx = primitive.indices;
        
        let positions: Float32Array | undefined;
        let normals: Float32Array | undefined;
        let uvs: Float32Array | undefined;
        let uv2: Float32Array | undefined;
        let indices: Uint16Array | Uint32Array | undefined;
        
        // Read positions
        if (positionIdx !== undefined) {
            positions = readAccessor(bin, json.accessors[positionIdx]) as Float32Array;
        }
        
        // Read normals
        if (normalIdx !== undefined) {
            normals = readAccessor(bin, json.accessors[normalIdx]) as Float32Array;
        }
        
        // Read first UV set (diffuse)
        if (texcoord0Idx !== undefined) {
            uvs = readAccessor(bin, json.accessors[texcoord0Idx]) as Float32Array;
        }
        
        // Read second UV set (lightmap)
        if (texcoord1Idx !== undefined) {
            uv2 = readAccessor(bin, json.accessors[texcoord1Idx]) as Float32Array;
        }
        
        // Read indices
        if (indicesIdx !== undefined) {
            indices = readAccessor(bin, json.accessors[indicesIdx]) as Uint16Array | Uint32Array;
        }
        
        if (!positions) {
            continue; // Skip primitives without positions
        }
        
        // Get texture paths from material
        let texturePath: string | undefined;
        let lightmapPath: string | undefined;
        if (primitive.material !== undefined && json.materials) {
            const material = json.materials[primitive.material];
            if (material?.baseColorTexture) {
                texturePath = material.baseColorTexture;
            }
            if (material?.lightmapTexture) {
                lightmapPath = material.lightmapTexture;
            }
        }
        
        primitives.push({
            positions,
            normals,
            uvs,
            uv2,
            indices,
            vertexCount: positions.length / 3,
            indexCount: indices ? indices.length : 0,
            texturePath,
            lightmapPath
        });
    }
    
    return { primitives };
}

/**
 * Read typed array from accessor
 */
function readAccessor(bin: Uint8Array, accessor: SMPKAccessor): Float32Array | Uint16Array | Uint32Array {
    const { offset, count, componentType, type } = accessor;
    
    // Determine component count
    let componentCount = 1;
    if (type === 'VEC2') componentCount = 2;
    else if (type === 'VEC3') componentCount = 3;
    else if (type === 'VEC4') componentCount = 4;
    
    const totalCount = count * componentCount;
    
    // Create view into binary data
    const dv = new DataView(bin.buffer, bin.byteOffset + offset);
    
    if (componentType === 'f32') {
        const result = new Float32Array(totalCount);
        for (let i = 0; i < totalCount; i++) {
            result[i] = dv.getFloat32(i * 4, true);
        }
        return result;
    } else if (componentType === 'u16') {
        const result = new Uint16Array(totalCount);
        for (let i = 0; i < totalCount; i++) {
            result[i] = dv.getUint16(i * 2, true);
        }
        return result;
    } else if (componentType === 'u32') {
        const result = new Uint32Array(totalCount);
        for (let i = 0; i < totalCount; i++) {
            result[i] = dv.getUint32(i * 4, true);
        }
        return result;
    } else {
        throw new Error(`Unsupported component type: ${componentType}`);
    }
}
