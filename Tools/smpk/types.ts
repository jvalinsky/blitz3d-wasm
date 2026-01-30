export type SmpkComponentType =
  | "u8"
  | "u16"
  | "u32"
  | "i16"
  | "i32"
  | "f32";

export type SmpkValueType =
  | "SCALAR"
  | "VEC2"
  | "VEC3"
  | "VEC4"
  | "MAT4";

export type SmpkAccessor = {
  name?: string;
  offset: number; // byte offset into BIN
  count: number;
  componentType: SmpkComponentType;
  type: SmpkValueType;
  byteStride?: number; // optional, for interleaved data
};

export type SmpkPrimitive = {
  attributes: Record<string, number>; // semantic -> accessor index
  indices?: number; // accessor index
  material?: number; // material index
};

export type SmpkMesh = {
  name?: string;
  primitives: SmpkPrimitive[];
};

export type SmpkNode = {
  name?: string;
  parent?: number;
  children?: number[];
  translation?: [number, number, number];
  rotation?: [number, number, number, number]; // quat (x,y,z,w)
  scale?: [number, number, number];
  mesh?: number;
  skin?: number;
};

export type SmpkSkin = {
  name?: string;
  joints: number[]; // node indices
  inverseBindMatrices?: number; // accessor index (MAT4), count=joints.length
};

export type SmpkAnimSampler = {
  input: number; // accessor index (SCALAR), f32 time in seconds
  output: number; // accessor index (VEC3/VEC4), f32
  interpolation?: "LINEAR" | "STEP";
};

export type SmpkAnimChannel = {
  sampler: number;
  targetNode: number;
  path: "translation" | "rotation" | "scale";
};

export type SmpkAnimation = {
  name?: string;
  samplers: SmpkAnimSampler[];
  channels: SmpkAnimChannel[];
  // Optional metadata carried through from source formats (e.g. B3D SEQS).
  sequences?: Array<{ name: string; firstFrame: number; lastFrame: number }>;
  fps?: number;
};

export type SmpkMaterial = {
  /** Material name from B3D brush */
  name?: string;
  /** Diffuse/albedo texture path */
  baseColorTexture?: string;
  /** Detail texture (texIds[1]), mapped to roughnessMap */
  detailTexture?: string;
  /** Detail texture 2 (texIds[2]), requires custom shader */
  detailTexture2?: string;
  /** Detail texture 3 (texIds[3]), requires custom shader */
  detailTexture3?: string;
  /** Environment/cube map (texIds[7]), requires envMap */
  cubeTexture?: string;
  /** Normal map path */
  normalTexture?: number;
  /** Normal intensity (0-2), default 1 */
  normalScale?: number;
  /** 0-1, default 0.8, derived from B3D shininess as 1-shininess */
  roughness?: number;
  /** 0-1, default 0.0 */
  metalness?: number;
  /** B3D shininess 0-1, stored for reference */
  shininess?: number;
  /** Emissive map path */
  emissiveTexture?: string;
  /** RGB emissive color, default [0,0,0] */
  emissiveFactor?: [number, number, number];
  /** Lightmap path */
  lightmapTexture?: string;
  /** RGB color override, default white */
  color?: [number, number, number];
  /** 0-1, default 1.0 */
  alpha?: number;
  /** "OPAQUE" | "BLEND" | "MASK", default "OPAQUE" */
  alphaMode?: "OPAQUE" | "BLEND" | "MASK";
  /** Alpha cutoff for MASK mode, default 0.5 */
  alphaCutoff?: number;
  /** B3D blend mode 0-7 */
  blendMode?: number;
  /** B3D FX_* flags, bitmask */
  fx?: number;
};

export type SmpkRmeshTriggerAabb = {
  min: [number, number, number];
  max: [number, number, number];
};

export type SmpkRmeshTrigger = {
  name: string;
  aabb: SmpkRmeshTriggerAabb;
};

export type SmpkRmeshExtras = {
  triggers?: SmpkRmeshTrigger[];
  entities?: unknown[];
};

export type SmpkExtras = {
  rmesh?: SmpkRmeshExtras;
  // Allow future metadata (gltf-style "extras").
  [k: string]: unknown;
};

export type SmpkJson = {
  version: 1;
  generator?: string;
  accessors: SmpkAccessor[];
  meshes: SmpkMesh[];
  nodes: SmpkNode[];
  skins?: SmpkSkin[];
  animations?: SmpkAnimation[];
  materials?: SmpkMaterial[];
  sceneRoots?: number[]; // node indices
  extras?: SmpkExtras;
};

export type SmpkFile = {
  json: SmpkJson;
  bin: Uint8Array;
};
