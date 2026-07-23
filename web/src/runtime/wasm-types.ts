/**
 * TypeScript type definitions for Blitz3D WASM Engine
 * Auto-generated from Swift @_cdecl exports
 */

/**
 * Memory management functions exported by WASM
 */
export interface WasmMemoryExports {
  memory: WebAssembly.Memory;
  malloc: (size: number) => number;
  free: (ptr: number) => void;
  wasm_malloc: (size: number) => number;
  wasm_free: (ptr: number) => void;
}

/**
 * Bank (memory buffer) operations
 */
export interface BankExports {
  CreateBank: (size: number) => number;
  FreeBank: (id: number) => void;
  BankSize: (id: number) => number;
  GetBankPtr: (id: number) => number;
  PeekByte: (id: number, offset: number) => number;
  PokeByte: (id: number, offset: number, value: number) => void;
  PeekInt: (id: number, offset: number) => number;
  PokeInt: (id: number, offset: number, value: number) => void;
  PeekFloat: (id: number, offset: number) => number;
  PokeFloat: (id: number, offset: number, value: number) => void;
}

/**
 * String operations
 */
export interface StringExports {
  CreateString: (cstrPtr: number) => number;
  GetStringPtr: (stringId: number) => number;
  FreeString: (stringId: number) => void;
  StringLength: (stringId: number) => number;
}

/**
 * Math operations
 */
export interface MathExports {
  Sin: (angle: number) => number;
  Cos: (angle: number) => number;
  Tan: (angle: number) => number;
  ASin: (value: number) => number;
  ACos: (value: number) => number;
  ATan: (value: number) => number;
  ATan2: (y: number, x: number) => number;
  Sqrt: (value: number) => number;
  Sqr: (value: number) => number;
  Abs: (value: number) => number;
  Sgn: (value: number) => number;
  Floor: (value: number) => number;
  Ceil: (value: number) => number;
  Exp: (value: number) => number;
  Log: (value: number) => number;
  Log10: (value: number) => number;
  Rand: (min: number, max: number) => number;
  Rnd: (min: number, max: number) => number;
  SeedRnd: (seed: number) => void;
}

/**
 * File I/O operations
 */
export interface FileIOExports {
  OpenFile: (pathPtr: number) => number;
  ReadFile: (pathPtr: number) => number;
  WriteFile: (pathPtr: number) => number;
  CloseFile: (handle: number) => void;
  ReadByte: (handle: number) => number;
  WriteByte: (handle: number, value: number) => void;
  ReadInt: (handle: number) => number;
  WriteInt: (handle: number, value: number) => void;
  ReadFloat: (handle: number) => number;
  WriteFloat: (handle: number, value: number) => void;
  ReadString: (handle: number) => number;
  WriteString: (handle: number, stringId: number) => void;
  ReadLine: (handle: number) => number;
  WriteLine: (handle: number, stringId: number) => void;
  FilePos: (handle: number) => number;
  SeekFile: (handle: number, pos: number) => void;
  FileSize: (pathPtr: number) => number;
  FileType: (pathPtr: number) => number;
  Eof: (handle: number) => number;
}

/**
 * Graphics/Mesh operations
 */
export interface GraphicsExports {
  LoadMesh: (pathPtr: number) => number;
  LoadAnimMesh: (pathPtr: number) => number;
  CreateMesh: () => number;
  FreeMesh: (handle: number) => void;
  CopyMesh: (handle: number) => number;
  AddMesh: (srcHandle: number, destHandle: number) => void;
  ScaleMesh: (handle: number, x: number, y: number, z: number) => void;
  RotateMesh: (
    handle: number,
    pitch: number,
    yaw: number,
    roll: number,
  ) => void;
  PositionMesh: (handle: number, x: number, y: number, z: number) => void;
  FitMesh: (
    handle: number,
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    depth: number,
  ) => void;
  UpdateNormals: (handle: number) => void;
  FlipMesh: (handle: number) => void;
  MeshWidth: (handle: number) => number;
  MeshHeight: (handle: number) => number;
  MeshDepth: (handle: number) => number;
}

/**
 * Entity/Scene operations
 */
export interface EntityExports {
  CreateEntity: () => number;
  FreeEntity: (handle: number) => void;
  CopyEntity: (handle: number) => number;
  PositionEntity: (handle: number, x: number, y: number, z: number) => void;
  RotateEntity: (
    handle: number,
    pitch: number,
    yaw: number,
    roll: number,
  ) => void;
  ScaleEntity: (handle: number, x: number, y: number, z: number) => void;
  MoveEntity: (handle: number, x: number, y: number, z: number) => void;
  TurnEntity: (
    handle: number,
    pitch: number,
    yaw: number,
    roll: number,
  ) => void;
  EntityX: (handle: number) => number;
  EntityY: (handle: number) => number;
  EntityZ: (handle: number) => number;
  EntityPitch: (handle: number) => number;
  EntityYaw: (handle: number) => number;
  EntityRoll: (handle: number) => number;
  HideEntity: (handle: number) => void;
  ShowEntity: (handle: number) => void;
  EntityHidden: (handle: number) => number;
}

/**
 * Camera operations
 */
export interface CameraExports {
  CreateCamera: () => number;
  CameraViewport: (
    handle: number,
    x: number,
    y: number,
    width: number,
    height: number,
  ) => void;
  CameraProject: (handle: number, x: number, y: number, z: number) => void;
  CameraZoom: (handle: number, zoom: number) => void;
  CameraRange: (handle: number, near: number, far: number) => void;
}

/**
 * Input operations
 */
export interface InputExports {
  KeyDown: (scancode: number) => number;
  KeyHit: (scancode: number) => number;
  FlushKeys: () => void;
  MouseX: () => number;
  MouseY: () => number;
  MouseZ: () => number;
  MouseXSpeed: () => number;
  MouseYSpeed: () => number;
  MouseDown: (button: number) => number;
  MouseHit: (button: number) => number;
  FlushMouse: () => void;
}

/**
 * Audio operations
 */
export interface AudioExports {
  LoadSound: (pathPtr: number, flags: number) => number;
  PlaySound: (
    handle: number,
    volume: number,
    pan: number,
    rate: number,
    loop: number,
  ) => number;
  FreeSound: (handle: number) => void;
  StopChannel: (channel: number) => void;
  ChannelPitch: (channel: number, pitch: number) => void;
  ChannelVolume: (channel: number, volume: number) => void;
  ChannelPan: (channel: number, pan: number) => void;
}

/**
 * Complete Blitz3D WASM Engine exports
 */
export interface Blitz3DEngineExports
  extends
    WasmMemoryExports,
    BankExports,
    StringExports,
    MathExports,
    FileIOExports,
    GraphicsExports,
    EntityExports,
    CameraExports,
    InputExports,
    AudioExports {
  // Entry point (if needed)
  _start?: () => void;
}

/**
 * WASM imports that the engine expects from JavaScript
 */
export interface Blitz3DEngineImports {
  env: {
    // Audio imports (from AudioImports.swift)
    js_LoadSound: (pathPtr: number, flags: number) => number;
    js_PlaySound: (
      sound: number,
      volume: number,
      pan: number,
      rate: number,
      loop: number,
    ) => number;
    js_FreeSound: (sound: number) => void;
    js_StopChannel: (channel: number) => void;
    js_ChannelPitch: (channel: number, pitch: number) => void;
    js_ChannelVolume: (channel: number, volume: number) => void;
    js_ChannelPan: (channel: number, pan: number) => void;
    js_PauseChannel: (channel: number) => void;
    js_ResumeChannel: (channel: number) => void;
    js_EmitSound: (sound: number, entityId: number) => number;
    js_ChannelPosition: (
      channel: number,
      x: number,
      y: number,
      z: number,
    ) => void;
    js_PlayMusic: (pathPtr: number) => number;
    js_StopMusic: () => void;
    js_MusicVolume: (volume: number) => void;
  };
}
