/**
 * GL Command Buffer Replay
 *
 * Reads a flat byte array (from WASM shared memory) containing GL-level
 * rendering commands and replays them against a WebGL2 context.
 *
 * Command format:
 *   [u32 opcode][typed payload...]
 *
 * Each command is 4-byte aligned. The buffer is prefixed with a u32 command
 * count, followed by sequential commands.
 *
 * Buffer layout:
 *   u32 commandCount
 *   Command[commandCount]
 */

import type { Renderer } from "./renderer.ts";
import type { GPUResources } from "./gpu_resources.ts";

// GL command opcodes (must match Swift engine RenderCommand.swift)
export const enum GLCmd {
  ClearColor = 0x01,
  Clear = 0x02,
  BindShader = 0x03,
  SetUniform4f = 0x04,
  SetUniformMat4 = 0x05,
  SetUniform1i = 0x06,
  SetUniform1f = 0x07,
  SetUniform3f = 0x08,
  BindVAO = 0x09,
  BindTexture = 0x0A,
  DrawElements = 0x0B,
  DrawArrays = 0x0C,
  Enable = 0x0D,
  Disable = 0x0E,
  BlendFunc = 0x0F,
  DepthMask = 0x10,
  CullFace = 0x11,
  UploadVB = 0x12,
  UploadIB = 0x13,
  SetViewport = 0x14,
  SetUniformMat3 = 0x15,
}

/**
 * Replay a GL command buffer.
 *
 * @param buffer  DataView over the command buffer bytes
 * @param renderer  The Renderer instance (for program binding)
 * @param resources The GPUResources instance (for VAO/buffer/texture binding)
 * @param wasmMemory  The WASM linear memory (for pointer dereference in upload commands)
 */
export function replayGLCommands(
  buffer: DataView,
  renderer: Renderer,
  resources: GPUResources,
  wasmMemory?: ArrayBuffer,
): void {
  const gl = renderer.gl;
  const cmdCount = buffer.getUint32(0, true);
  let offset = 4;

  for (let i = 0; i < cmdCount; i++) {
    if (offset + 4 > buffer.byteLength) break;
    const op = buffer.getUint32(offset, true);
    offset += 4;

    switch (op) {
      case GLCmd.ClearColor: {
        const r = buffer.getFloat32(offset, true);
        const g = buffer.getFloat32(offset + 4, true);
        const b = buffer.getFloat32(offset + 8, true);
        const a = buffer.getFloat32(offset + 12, true);
        gl.clearColor(r, g, b, a);
        offset += 16;
        break;
      }

      case GLCmd.Clear: {
        const mask = buffer.getUint32(offset, true);
        gl.clear(mask);
        offset += 4;
        break;
      }

      case GLCmd.BindShader: {
        const programId = buffer.getUint32(offset, true);
        renderer.useProgramById(programId);
        offset += 4;
        break;
      }

      case GLCmd.SetUniform4f: {
        const loc = buffer.getUint32(offset, true);
        const x = buffer.getFloat32(offset + 4, true);
        const y = buffer.getFloat32(offset + 8, true);
        const z = buffer.getFloat32(offset + 12, true);
        const w = buffer.getFloat32(offset + 16, true);
        // loc is treated as a uniform location index -- resolve via renderer
        gl.uniform4f(loc as unknown as WebGLUniformLocation, x, y, z, w);
        offset += 20;
        break;
      }

      case GLCmd.SetUniformMat4: {
        const loc = buffer.getUint32(offset, true);
        offset += 4;
        // 16 floats
        const mat = new Float32Array(16);
        for (let j = 0; j < 16; j++) {
          mat[j] = buffer.getFloat32(offset, true);
          offset += 4;
        }
        gl.uniformMatrix4fv(loc as unknown as WebGLUniformLocation, false, mat);
        break;
      }

      case GLCmd.SetUniform1i: {
        const loc = buffer.getUint32(offset, true);
        const val = buffer.getInt32(offset + 4, true);
        gl.uniform1i(loc as unknown as WebGLUniformLocation, val);
        offset += 8;
        break;
      }

      case GLCmd.SetUniform1f: {
        const loc = buffer.getUint32(offset, true);
        const val = buffer.getFloat32(offset + 4, true);
        gl.uniform1f(loc as unknown as WebGLUniformLocation, val);
        offset += 8;
        break;
      }

      case GLCmd.SetUniform3f: {
        const loc = buffer.getUint32(offset, true);
        const x = buffer.getFloat32(offset + 4, true);
        const y = buffer.getFloat32(offset + 8, true);
        const z = buffer.getFloat32(offset + 12, true);
        gl.uniform3f(loc as unknown as WebGLUniformLocation, x, y, z);
        offset += 16;
        break;
      }

      case GLCmd.BindVAO: {
        const vaoId = buffer.getUint32(offset, true);
        resources.bindVAO(vaoId);
        offset += 4;
        break;
      }

      case GLCmd.BindTexture: {
        const unit = buffer.getUint32(offset, true);
        const texId = buffer.getUint32(offset + 4, true);
        resources.bindTexture(unit, texId);
        offset += 8;
        break;
      }

      case GLCmd.DrawElements: {
        const mode = buffer.getUint32(offset, true);
        const count = buffer.getUint32(offset + 4, true);
        const type = buffer.getUint32(offset + 8, true);
        const byteOffset = buffer.getUint32(offset + 12, true);
        gl.drawElements(mode, count, type, byteOffset);
        offset += 16;
        break;
      }

      case GLCmd.DrawArrays: {
        const mode = buffer.getUint32(offset, true);
        const first = buffer.getUint32(offset + 4, true);
        const count = buffer.getUint32(offset + 8, true);
        gl.drawArrays(mode, first, count);
        offset += 12;
        break;
      }

      case GLCmd.Enable: {
        const cap = buffer.getUint32(offset, true);
        gl.enable(cap);
        offset += 4;
        break;
      }

      case GLCmd.Disable: {
        const cap = buffer.getUint32(offset, true);
        gl.disable(cap);
        offset += 4;
        break;
      }

      case GLCmd.BlendFunc: {
        const src = buffer.getUint32(offset, true);
        const dst = buffer.getUint32(offset + 4, true);
        gl.blendFunc(src, dst);
        offset += 8;
        break;
      }

      case GLCmd.DepthMask: {
        const flag = buffer.getUint32(offset, true);
        gl.depthMask(flag !== 0);
        offset += 4;
        break;
      }

      case GLCmd.CullFace: {
        const face = buffer.getUint32(offset, true);
        gl.cullFace(face);
        offset += 4;
        break;
      }

      case GLCmd.UploadVB: {
        const bufferId = buffer.getUint32(offset, true);
        const dataPtr = buffer.getUint32(offset + 4, true);
        const size = buffer.getUint32(offset + 8, true);
        if (wasmMemory) {
          const data = new Uint8Array(wasmMemory, dataPtr, size);
          resources.uploadBuffer(bufferId, gl.ARRAY_BUFFER, data);
        }
        offset += 12;
        break;
      }

      case GLCmd.UploadIB: {
        const bufferId = buffer.getUint32(offset, true);
        const dataPtr = buffer.getUint32(offset + 4, true);
        const size = buffer.getUint32(offset + 8, true);
        if (wasmMemory) {
          const data = new Uint8Array(wasmMemory, dataPtr, size);
          resources.uploadBuffer(bufferId, gl.ELEMENT_ARRAY_BUFFER, data);
        }
        offset += 12;
        break;
      }

      case GLCmd.SetViewport: {
        const x = buffer.getInt32(offset, true);
        const y = buffer.getInt32(offset + 4, true);
        const w = buffer.getInt32(offset + 8, true);
        const h = buffer.getInt32(offset + 12, true);
        gl.viewport(x, y, w, h);
        offset += 16;
        break;
      }

      case GLCmd.SetUniformMat3: {
        const loc = buffer.getUint32(offset, true);
        offset += 4;
        const mat = new Float32Array(9);
        for (let j = 0; j < 9; j++) {
          mat[j] = buffer.getFloat32(offset, true);
          offset += 4;
        }
        gl.uniformMatrix3fv(loc as unknown as WebGLUniformLocation, false, mat);
        break;
      }

      default:
        console.warn(
          `gl_replay: unknown opcode 0x${op.toString(16)} at offset ${
            offset - 4
          }`,
        );
        return; // Stop replaying on unknown opcode
    }
  }
}

/**
 * Build a GL command buffer manually from JS (for testing / non-engine usage).
 * Returns an ArrayBuffer containing the command stream.
 */
export class GLCommandBuilder {
  private data: number[] = [];
  private cmdCount = 0;

  private pushU32(v: number): void {
    this.data.push(v >>> 0);
  }

  private pushF32(v: number): void {
    // Store float as uint32 bits
    const buf = new ArrayBuffer(4);
    new Float32Array(buf)[0] = v;
    this.data.push(new Uint32Array(buf)[0]);
  }

  private pushI32(v: number): void {
    const buf = new ArrayBuffer(4);
    new Int32Array(buf)[0] = v;
    this.data.push(new Uint32Array(buf)[0]);
  }

  clearColor(r: number, g: number, b: number, a: number): this {
    this.pushU32(GLCmd.ClearColor);
    this.pushF32(r);
    this.pushF32(g);
    this.pushF32(b);
    this.pushF32(a);
    this.cmdCount++;
    return this;
  }

  clear(mask: number): this {
    this.pushU32(GLCmd.Clear);
    this.pushU32(mask);
    this.cmdCount++;
    return this;
  }

  bindShader(programId: number): this {
    this.pushU32(GLCmd.BindShader);
    this.pushU32(programId);
    this.cmdCount++;
    return this;
  }

  setUniform1i(loc: number, val: number): this {
    this.pushU32(GLCmd.SetUniform1i);
    this.pushU32(loc);
    this.pushI32(val);
    this.cmdCount++;
    return this;
  }

  setUniform1f(loc: number, val: number): this {
    this.pushU32(GLCmd.SetUniform1f);
    this.pushU32(loc);
    this.pushF32(val);
    this.cmdCount++;
    return this;
  }

  setUniform3f(loc: number, x: number, y: number, z: number): this {
    this.pushU32(GLCmd.SetUniform3f);
    this.pushU32(loc);
    this.pushF32(x);
    this.pushF32(y);
    this.pushF32(z);
    this.cmdCount++;
    return this;
  }

  setUniform4f(loc: number, x: number, y: number, z: number, w: number): this {
    this.pushU32(GLCmd.SetUniform4f);
    this.pushU32(loc);
    this.pushF32(x);
    this.pushF32(y);
    this.pushF32(z);
    this.pushF32(w);
    this.cmdCount++;
    return this;
  }

  setUniformMat4(loc: number, mat: Float32Array): this {
    this.pushU32(GLCmd.SetUniformMat4);
    this.pushU32(loc);
    for (let i = 0; i < 16; i++) this.pushF32(mat[i]);
    this.cmdCount++;
    return this;
  }

  setUniformMat3(loc: number, mat: Float32Array): this {
    this.pushU32(GLCmd.SetUniformMat3);
    this.pushU32(loc);
    for (let i = 0; i < 9; i++) this.pushF32(mat[i]);
    this.cmdCount++;
    return this;
  }

  bindVAO(vaoId: number): this {
    this.pushU32(GLCmd.BindVAO);
    this.pushU32(vaoId);
    this.cmdCount++;
    return this;
  }

  bindTexture(unit: number, texId: number): this {
    this.pushU32(GLCmd.BindTexture);
    this.pushU32(unit);
    this.pushU32(texId);
    this.cmdCount++;
    return this;
  }

  drawElements(
    mode: number,
    count: number,
    type: number,
    byteOffset: number,
  ): this {
    this.pushU32(GLCmd.DrawElements);
    this.pushU32(mode);
    this.pushU32(count);
    this.pushU32(type);
    this.pushU32(byteOffset);
    this.cmdCount++;
    return this;
  }

  drawArrays(mode: number, first: number, count: number): this {
    this.pushU32(GLCmd.DrawArrays);
    this.pushU32(mode);
    this.pushU32(first);
    this.pushU32(count);
    this.cmdCount++;
    return this;
  }

  enable(cap: number): this {
    this.pushU32(GLCmd.Enable);
    this.pushU32(cap);
    this.cmdCount++;
    return this;
  }

  disable(cap: number): this {
    this.pushU32(GLCmd.Disable);
    this.pushU32(cap);
    this.cmdCount++;
    return this;
  }

  blendFunc(src: number, dst: number): this {
    this.pushU32(GLCmd.BlendFunc);
    this.pushU32(src);
    this.pushU32(dst);
    this.cmdCount++;
    return this;
  }

  depthMask(flag: boolean): this {
    this.pushU32(GLCmd.DepthMask);
    this.pushU32(flag ? 1 : 0);
    this.cmdCount++;
    return this;
  }

  cullFace(face: number): this {
    this.pushU32(GLCmd.CullFace);
    this.pushU32(face);
    this.cmdCount++;
    return this;
  }

  setViewport(x: number, y: number, w: number, h: number): this {
    this.pushU32(GLCmd.SetViewport);
    this.pushI32(x);
    this.pushI32(y);
    this.pushI32(w);
    this.pushI32(h);
    this.cmdCount++;
    return this;
  }

  build(): ArrayBuffer {
    // Prefix with command count
    const totalU32 = 1 + this.data.length;
    const buf = new ArrayBuffer(totalU32 * 4);
    const u32 = new Uint32Array(buf);
    u32[0] = this.cmdCount;
    for (let i = 0; i < this.data.length; i++) {
      u32[i + 1] = this.data[i];
    }
    return buf;
  }
}
