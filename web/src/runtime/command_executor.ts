import type { Cmd } from "../shared/command_buffer";
import { CmdOpcode } from "../shared/command_buffer";

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
  onPlaySound?: (soundId: number, volume: number, loop: number, outChannelPtr?: number) => void;
  onDebugLogPtrLen?: (ptr: number, len: number) => void;
  onSetPosition?: (id: number, x: number, y: number, z: number) => void;
  onSetRotationEuler?: (id: number, pitch: number, yaw: number, roll: number, global: number) => void;
  onSetScale?: (id: number, x: number, y: number, z: number) => void;
  onMoveEntity?: (id: number, x: number, y: number, z: number) => void;
  onTurnEntity?: (id: number, pitch: number, yaw: number, roll: number, global: number) => void;
  onSetParent?: (id: number, parent: number, global: number) => void;
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
      exec.onSetRotationEuler?.(cmd.id, cmd.pitch, cmd.yaw, cmd.roll, cmd.global);
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
    default: {
      const _exhaustive: never = cmd;
      throw new Error(`command_executor: unknown cmd ${(cmd as any).op}`);
    }
  }
};
