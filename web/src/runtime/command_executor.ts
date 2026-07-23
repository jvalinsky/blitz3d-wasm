import type { Cmd } from "../shared/command_buffer.ts";
import { CmdOpcode } from "../shared/command_buffer.ts";

export type CommandExecutor = {
  onCreateEntity?: (entityType: number, parent: number, id: number) => void;
  onDestroyEntity?: (id: number) => void;
  onSetTransform?: (
    id: number,
    pos: [number, number, number],
    rot: [number, number, number, number],
    scl: [number, number, number],
  ) => void;
  onSetVisibility?: (id: number, visible: number) => void;
  onSetMaterial?: (id: number, materialId: number) => void;
  onPlaySound?: (
    soundId: number,
    volume: number,
    loop: number,
    outChannelPtr?: number,
  ) => void;
  onDebugLogPtrLen?: (ptr: number, len: number) => void;
  onSetPosition?: (id: number, x: number, y: number, z: number) => void;
  onSetRotationEuler?: (
    id: number,
    pitch: number,
    yaw: number,
    roll: number,
    global: number,
  ) => void;
  onSetScale?: (id: number, x: number, y: number, z: number) => void;
  onMoveEntity?: (id: number, x: number, y: number, z: number) => void;
  onTurnEntity?: (
    id: number,
    pitch: number,
    yaw: number,
    roll: number,
    global: number,
  ) => void;
  onSetParent?: (id: number, parent: number, global: number) => void;
  onLoadMesh?: (id: number, parent: number, pathPtr: number) => void;
  onLoadAnimMesh?: (id: number, parent: number, pathPtr: number) => void;
  onCreateMesh?: (id: number, parent: number) => void;
  onLoadTexture?: (id: number, pathPtr: number, flags: number) => void;
  onTextureBlend?: (id: number, blend: number) => void;
  onTextureCoords?: (id: number, coords: number) => void;
  onCreateBrush?: (id: number) => void;
  onBrushColor?: (id: number, r: number, g: number, b: number) => void;
  onBrushAlpha?: (id: number, a: number) => void;
  onBrushShininess?: (id: number, s: number) => void;
  onBrushTexture?: (
    brushId: number,
    textureId: number,
    frame: number,
    index: number,
  ) => void;
  onEntityTexture?: (
    entityId: number,
    textureId: number,
    frame: number,
    index: number,
  ) => void;
  onEntityColor?: (entityId: number, r: number, g: number, b: number) => void;
  onEntityAlpha?: (entityId: number, a: number) => void;
  onEntityShininess?: (entityId: number, s: number) => void;
  onEntityFX?: (entityId: number, fx: number) => void;
  onEntityBlend?: (entityId: number, blend: number) => void;
  onFreeEntity?: (id: number) => void;
};

export const dispatchCmd = (exec: CommandExecutor, cmd: Cmd) => {
  switch (cmd.op) {
    case CmdOpcode.CreateEntity:
      exec.onCreateEntity?.(cmd.entityType, cmd.parent, cmd.id);
      return;
    case CmdOpcode.DestroyEntity:
      exec.onDestroyEntity?.(cmd.id);
      return;
    case CmdOpcode.SetTransform:
      exec.onSetTransform?.(cmd.id, cmd.pos, cmd.rot, cmd.scl);
      return;
    case CmdOpcode.SetPosition:
      exec.onSetPosition?.(cmd.id, cmd.x, cmd.y, cmd.z);
      return;
    case CmdOpcode.SetRotationEuler:
      exec.onSetRotationEuler?.(
        cmd.id,
        cmd.pitch,
        cmd.yaw,
        cmd.roll,
        cmd.global,
      );
      return;
    case CmdOpcode.SetScale:
      exec.onSetScale?.(cmd.id, cmd.x, cmd.y, cmd.z);
      return;
    case CmdOpcode.MoveEntity:
      exec.onMoveEntity?.(cmd.id, cmd.x, cmd.y, cmd.z);
      return;
    case CmdOpcode.TurnEntity:
      exec.onTurnEntity?.(cmd.id, cmd.pitch, cmd.yaw, cmd.roll, cmd.global);
      return;
    case CmdOpcode.SetParent:
      exec.onSetParent?.(cmd.id, cmd.parent, cmd.global);
      return;
    case CmdOpcode.SetVisibility:
      exec.onSetVisibility?.(cmd.id, cmd.visible);
      return;
    case CmdOpcode.SetMaterial:
      exec.onSetMaterial?.(cmd.id, cmd.materialId);
      return;
    case CmdOpcode.PlaySound:
      exec.onPlaySound?.(cmd.soundId, cmd.volume, cmd.loop, cmd.outChannelPtr);
      return;
    case CmdOpcode.DebugLogPtrLen:
      exec.onDebugLogPtrLen?.(cmd.ptr, cmd.len);
      return;
    case CmdOpcode.LoadMesh:
      exec.onLoadMesh?.(cmd.id, cmd.parent, cmd.pathPtr);
      return;
    case CmdOpcode.LoadAnimMesh:
      exec.onLoadAnimMesh?.(cmd.id, cmd.parent, cmd.pathPtr);
      return;
    case CmdOpcode.CreateMesh:
      exec.onCreateMesh?.(cmd.id, cmd.parent);
      return;
    case CmdOpcode.LoadTexture:
      exec.onLoadTexture?.(cmd.id, cmd.pathPtr, cmd.flags);
      return;
    case CmdOpcode.TextureBlend:
      exec.onTextureBlend?.(cmd.id, cmd.blend);
      return;
    case CmdOpcode.TextureCoords:
      exec.onTextureCoords?.(cmd.id, cmd.coords);
      return;
    case CmdOpcode.CreateBrush:
      exec.onCreateBrush?.(cmd.id);
      return;
    case CmdOpcode.BrushColor:
      exec.onBrushColor?.(cmd.id, cmd.r, cmd.g, cmd.b);
      return;
    case CmdOpcode.BrushAlpha:
      exec.onBrushAlpha?.(cmd.id, cmd.a);
      return;
    case CmdOpcode.BrushShininess:
      exec.onBrushShininess?.(cmd.id, cmd.s);
      return;
    case CmdOpcode.BrushTexture:
      exec.onBrushTexture?.(cmd.brushId, cmd.textureId, cmd.frame, cmd.index);
      return;
    case CmdOpcode.EntityTexture:
      exec.onEntityTexture?.(cmd.entityId, cmd.textureId, cmd.frame, cmd.index);
      return;
    case CmdOpcode.EntityColor:
      exec.onEntityColor?.(cmd.entityId, cmd.r, cmd.g, cmd.b);
      return;
    case CmdOpcode.EntityAlpha:
      exec.onEntityAlpha?.(cmd.entityId, cmd.a);
      return;
    case CmdOpcode.EntityShininess:
      exec.onEntityShininess?.(cmd.entityId, cmd.s);
      return;
    case CmdOpcode.EntityFX:
      exec.onEntityFX?.(cmd.entityId, cmd.fx);
      return;
    case CmdOpcode.EntityBlend:
      exec.onEntityBlend?.(cmd.entityId, cmd.blend);
      return;
    case CmdOpcode.FreeEntity:
      exec.onFreeEntity?.(cmd.id);
      return;
    default: {
      const _exhaustive: never = cmd;
      throw new Error(`command_executor: unknown cmd ${(cmd as any).op}`);
    }
  }
};
