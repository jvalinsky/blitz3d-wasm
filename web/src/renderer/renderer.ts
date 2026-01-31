/**
 * Blitz3D WebGL2 Renderer
 *
 * Manages the WebGL2 context, shader compilation/linking, uniform location
 * caching, and per-frame state. This replaces Three.js as the rendering
 * backend.
 */

// Shader source imports -- at build time these are inlined as strings by
// the bundler (Vite raw import).  For standalone / test usage the caller
// can pass shader source directly via `initShaders`.

export interface ShaderSources {
  standardVert: string;
  standardFrag: string;
  twoDVert: string;
  twoDFrag: string;
}

export interface CompiledProgram {
  program: WebGLProgram;
  uniforms: Map<string, WebGLUniformLocation>;
  attribs: Map<string, number>;
}

export class Renderer {
  readonly gl: WebGL2RenderingContext;
  readonly canvas: HTMLCanvasElement;

  // Compiled shader programs keyed by name
  private programs = new Map<string, CompiledProgram>();

  // Current bound program name (avoids redundant glUseProgram)
  private activeProgram: string | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: true,
      depth: true,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
    });
    if (!gl) throw new Error("WebGL2 not supported");
    this.gl = gl;

    // Sensible defaults
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.frontFace(gl.CCW);
    gl.clearColor(0, 0, 0, 1);
  }

  // ------------------------------------------------------------------
  // Shader compilation
  // ------------------------------------------------------------------

  initShaders(sources: ShaderSources): void {
    this.compileProgram("standard", sources.standardVert, sources.standardFrag);
    this.compileProgram("2d", sources.twoDVert, sources.twoDFrag);
  }

  compileProgram(name: string, vertSrc: string, fragSrc: string): CompiledProgram {
    const gl = this.gl;

    const vs = this.compileShader(gl.VERTEX_SHADER, vertSrc);
    const fs = this.compileShader(gl.FRAGMENT_SHADER, fragSrc);

    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      throw new Error(`Shader link failed (${name}): ${info}`);
    }

    // Shader objects can be freed after linking
    gl.deleteShader(vs);
    gl.deleteShader(fs);

    // Cache all active uniforms
    const uniforms = new Map<string, WebGLUniformLocation>();
    const uniformCount = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) as number;
    for (let i = 0; i < uniformCount; i++) {
      const info = gl.getActiveUniform(program, i);
      if (!info) continue;
      // For arrays, getActiveUniform returns "name[0]".  We cache both
      // the raw name and the bracket form.
      const loc = gl.getUniformLocation(program, info.name);
      if (loc !== null) {
        uniforms.set(info.name, loc);
        // Also store without [0] suffix for convenience
        const base = info.name.replace(/\[0\]$/, "");
        if (base !== info.name) uniforms.set(base, loc);
      }
      // For struct arrays like u_lights[0].type, cache individual elements
      if (info.size > 1) {
        const baseName = info.name.replace(/\[0\]$/, "");
        for (let j = 0; j < info.size; j++) {
          const elemName = `${baseName}[${j}]`;
          const elemLoc = gl.getUniformLocation(program, elemName);
          if (elemLoc !== null) uniforms.set(elemName, elemLoc);
        }
      }
    }

    // Cache all active attributes
    const attribs = new Map<string, number>();
    const attribCount = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES) as number;
    for (let i = 0; i < attribCount; i++) {
      const info = gl.getActiveAttrib(program, i);
      if (!info) continue;
      attribs.set(info.name, gl.getAttribLocation(program, info.name));
    }

    const compiled: CompiledProgram = { program, uniforms, attribs };
    this.programs.set(name, compiled);
    return compiled;
  }

  private compileShader(type: number, source: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      const typeName = type === gl.VERTEX_SHADER ? "vertex" : "fragment";
      throw new Error(`${typeName} shader compile failed: ${info}`);
    }
    return shader;
  }

  // ------------------------------------------------------------------
  // Program binding
  // ------------------------------------------------------------------

  getProgram(name: string): CompiledProgram | undefined {
    return this.programs.get(name);
  }

  useProgram(name: string): CompiledProgram {
    const p = this.programs.get(name);
    if (!p) throw new Error(`Unknown program: ${name}`);
    if (this.activeProgram !== name) {
      this.gl.useProgram(p.program);
      this.activeProgram = name;
    }
    return p;
  }

  useProgramById(id: number): void {
    // Programs are stored by name, but the command buffer references them
    // by integer ID.  We maintain a mapping.
    const name = this.programIdToName.get(id);
    if (name === undefined) return;
    this.useProgram(name);
  }

  private programIdToName = new Map<number, string>([
    [0, "standard"],
    [1, "2d"],
  ]);

  // ------------------------------------------------------------------
  // Uniform helpers
  // ------------------------------------------------------------------

  getUniformLocation(programName: string, uniformName: string): WebGLUniformLocation | null {
    const p = this.programs.get(programName);
    if (!p) return null;
    return p.uniforms.get(uniformName) ?? null;
  }

  // ------------------------------------------------------------------
  // Frame lifecycle
  // ------------------------------------------------------------------

  beginFrame(): void {
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  clear(color?: [number, number, number, number]): void {
    const gl = this.gl;
    if (color) gl.clearColor(color[0], color[1], color[2], color[3]);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }

  // ------------------------------------------------------------------
  // Resize
  // ------------------------------------------------------------------

  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
    this.gl.viewport(0, 0, width, height);
  }

  // ------------------------------------------------------------------
  // Cleanup
  // ------------------------------------------------------------------

  destroy(): void {
    for (const [, p] of this.programs) {
      this.gl.deleteProgram(p.program);
    }
    this.programs.clear();
  }
}
