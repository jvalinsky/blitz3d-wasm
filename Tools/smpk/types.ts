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
  name?: string;
  baseColorTexture?: string;
  lightmapTexture?: string;
  alphaMode?: "OPAQUE" | "BLEND" | "MASK";
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
