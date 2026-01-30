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
