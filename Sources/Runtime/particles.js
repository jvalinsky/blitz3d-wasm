/**
 * DevilParticleSystem Replacement
 *
 * Custom WebGL particle system matching the DevilParticleSystem API.
 * Uses instanced rendering for performance.
 */

class ParticleSystem {
  constructor(gl) {
    this.gl = gl;
    this.templates = new Map();
    this.emitters = new Map();
    this.particles = [];
    this.nextTemplateId = 1;
    this.nextEmitterId = 1;
    this.nextParticleId = 1;

    this.initShaders();
    this.initBuffers();
  }

  initShaders() {
    const gl = this.gl;

    const vsSource = `#version 300 es
            precision highp float;
            
            in vec3 a_position;
            in vec2 a_texCoord;
            
            in vec3 a_instancePosition;
            in vec4 a_instanceColor;
            in float a_instanceSize;
            in float a_instanceRotation;
            
            uniform mat4 u_projection;
            uniform mat4 u_view;
            
            out vec2 v_texCoord;
            out vec4 v_color;
            
            void main() {
                float c = cos(a_instanceRotation);
                float s = sin(a_instanceRotation);
                mat2 rot = mat2(c, -s, s, c);
                
                vec2 rotated = rot * (a_position.xy * a_instanceSize);
                vec3 worldPos = vec3(rotated + a_instancePosition.xy, a_position.z);
                
                gl_Position = u_projection * u_view * vec4(worldPos, 1.0);
                v_texCoord = a_texCoord;
                v_color = a_instanceColor;
            }
        `;

    const fsSource = `#version 300 es
            precision highp float;
            
            in vec2 v_texCoord;
            in vec4 v_color;
            
            uniform sampler2D u_texture;
            uniform int u_blendMode;
            
            out vec4 fragColor;
            
            void main() {
                vec4 texColor = texture(u_texture, v_texCoord);
                
                if (u_blendMode == 1) {
                    fragColor = vec4(texColor.rgb * texColor.a * v_color.rgb, texColor.a * v_color.a);
                } else if (u_blendMode == 2) {
                    fragColor = vec4(texColor.rgb * v_color.rgb, texColor.a * v_color.a);
                } else {
                    fragColor = texColor * v_color;
                }
                
                if (fragColor.a < 0.01) discard;
            }
        `;

    const vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, vsSource);
    gl.compileShader(vs);

    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, fsSource);
    gl.compileShader(fs);

    this.program = gl.createProgram();
    gl.attachShader(this.program, vs);
    gl.attachShader(this.program, fs);
    gl.linkProgram(this.program);

    this.locations = {
      a_position: gl.getAttribLocation(this.program, "a_position"),
      a_texCoord: gl.getAttribLocation(this.program, "a_texCoord"),
      a_instancePosition: gl.getAttribLocation(
        this.program,
        "a_instancePosition",
      ),
      a_instanceColor: gl.getAttribLocation(this.program, "a_instanceColor"),
      a_instanceSize: gl.getAttribLocation(this.program, "a_instanceSize"),
      a_instanceRotation: gl.getAttribLocation(
        this.program,
        "a_instanceRotation",
      ),
      u_projection: gl.getUniformLocation(this.program, "u_projection"),
      u_view: gl.getUniformLocation(this.program, "u_view"),
      u_texture: gl.getUniformLocation(this.program, "u_texture"),
      u_blendMode: gl.getUniformLocation(this.program, "u_blendMode"),
    };
  }

  initBuffers() {
    const gl = this.gl;

    const quadVertices = new Float32Array([
      -0.5,
      -0.5,
      0,
      0,
      0.5,
      -0.5,
      1,
      0,
      0.5,
      0.5,
      1,
      1,
      -0.5,
      -0.5,
      0,
      0,
      0.5,
      0.5,
      1,
      1,
      -0.5,
      0.5,
      0,
      1,
    ]);

    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);

    this.quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);

    gl.enableVertexAttribArray(this.locations.a_position);
    gl.vertexAttribPointer(
      this.locations.a_position,
      2,
      gl.FLOAT,
      false,
      16,
      0,
    );
    gl.enableVertexAttribArray(this.locations.a_texCoord);
    gl.vertexAttribPointer(
      this.locations.a_texCoord,
      2,
      gl.FLOAT,
      false,
      16,
      8,
    );

    this.instanceBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);

    const stride = 11 * 4; // 11 floats per instance
    gl.enableVertexAttribArray(this.locations.a_instancePosition);
    gl.vertexAttribPointer(
      this.locations.a_instancePosition,
      3,
      gl.FLOAT,
      false,
      stride,
      0,
    );
    gl.vertexAttribDivisor(this.locations.a_instancePosition, 1);

    gl.enableVertexAttribArray(this.locations.a_instanceColor);
    gl.vertexAttribPointer(
      this.locations.a_instanceColor,
      4,
      gl.FLOAT,
      false,
      stride,
      12,
    );
    gl.vertexAttribDivisor(this.locations.a_instanceColor, 1);

    gl.enableVertexAttribArray(this.locations.a_instanceSize);
    gl.vertexAttribPointer(
      this.locations.a_instanceSize,
      1,
      gl.FLOAT,
      false,
      stride,
      28,
    );
    gl.vertexAttribDivisor(this.locations.a_instanceSize, 1);

    gl.enableVertexAttribArray(this.locations.a_instanceRotation);
    gl.vertexAttribPointer(
      this.locations.a_instanceRotation,
      1,
      gl.FLOAT,
      false,
      stride,
      32,
    );
    gl.vertexAttribDivisor(this.locations.a_instanceRotation, 1);

    gl.bindVertexArray(null);
  }

  CreateTemplate() {
    const template = {
      id: this.nextTemplateId++,
      blendMode: 0,
      interval: 100,
      particlesPerInterval: 1,
      maxParticles: 100,
      particleLifeMin: 1000,
      particleLifeMax: 2000,
      emitterLife: 0,
      texture: null,
      animTexture: null,
      animFrames: 1,
      animSpeed: 100,
      offsetRange: { x: 0, y: 0, z: 0 },
      velocityRange: { x: [0, 0], y: [0, 0], z: [0, 0] },
      rotationRange: { min: 0, max: 0 },
      alignToFall: false,
      gravity: { x: 0, y: 0, z: 0 },
      sizeRange: { min: 0.1, max: 0.2 },
      sizeVelRange: { min: 0, max: 0 },
      alphaRange: { start: 1, end: 0 },
      alphaVel: 0,
      colors: [{ r: 1, g: 1, b: 1, a: 1 }],
      brightness: 1,
      floorY: -Infinity,
      fixAngles: false,
      subTemplate: null,
    };
    this.templates.set(template.id, template);
    return template.id;
  }

  FreeTemplate(templateId) {
    this.templates.delete(templateId);
  }

  SetTemplateEmitterBlend(templateId, blend) {
    const t = this.templates.get(templateId);
    if (t) t.blendMode = blend;
  }

  SetTemplateInterval(templateId, ms) {
    const t = this.templates.get(templateId);
    if (t) t.interval = ms;
  }

  SetTemplateParticlesPerInterval(templateId, count) {
    const t = this.templates.get(templateId);
    if (t) t.particlesPerInterval = count;
  }

  SetTemplateMaxParticles(templateId, max) {
    const t = this.templates.get(templateId);
    if (t) t.maxParticles = max;
  }

  SetTemplateParticleLifeTime(templateId, min, max) {
    const t = this.templates.get(templateId);
    if (t) {
      t.particleLifeMin = min;
      t.particleLifeMax = max;
    }
  }

  SetTemplateEmitterLifeTime(templateId, ms) {
    const t = this.templates.get(templateId);
    if (t) t.emitterLife = ms;
  }

  SetTemplateTexture(templateId, textureId) {
    const t = this.templates.get(templateId);
    if (t) t.texture = textureId;
  }

  SetTemplateAnimTexture(templateId, textureId, frames, speed) {
    const t = this.templates.get(templateId);
    if (t) {
      t.animTexture = textureId;
      t.animFrames = frames;
      t.animSpeed = speed;
    }
  }

  SetTemplateOffset(templateId, x, y, z) {
    const t = this.templates.get(templateId);
    if (t) t.offsetRange = { x, y, z };
  }

  SetTemplateVelocity(templateId, minX, maxX, minY, maxY, minZ, maxZ) {
    const t = this.templates.get(templateId);
    if (t) {
      t.velocityRange = { x: [minX, maxX], y: [minY, maxY], z: [minZ, maxZ] };
    }
  }

  SetTemplateRotation(templateId, min, max) {
    const t = this.templates.get(templateId);
    if (t) t.rotationRange = { min, max };
  }

  SetTemplateAlignToFall(templateId, align) {
    const t = this.templates.get(templateId);
    if (t) t.alignToFall = align;
  }

  SetTemplateGravity(templateId, x, y, z) {
    const t = this.templates.get(templateId);
    if (t) t.gravity = { x, y, z };
  }

  SetTemplateSize(templateId, min, max) {
    const t = this.templates.get(templateId);
    if (t) t.sizeRange = { min, max };
  }

  SetTemplateSizeVel(templateId, min, max) {
    const t = this.templates.get(templateId);
    if (t) t.sizeVelRange = { min, max };
  }

  SetTemplateAlpha(templateId, start, end) {
    const t = this.templates.get(templateId);
    if (t) t.alphaRange = { start, end };
  }

  SetTemplateAlphaVel(templateId, rate) {
    const t = this.templates.get(templateId);
    if (t) t.alphaVel = rate;
  }

  SetTemplateColors(templateId, r1, g1, b1, r2, g2, b2, r3, g3, b3) {
    const t = this.templates.get(templateId);
    if (t) {
      t.colors = [
        { r: r1, g: g1, b: b1, a: 1 },
        { r: r2, g: g2, b: b2, a: 1 },
        { r: r3, g: g3, b: b3, a: 1 },
      ];
    }
  }

  SetTemplateBrightness(templateId, value) {
    const t = this.templates.get(templateId);
    if (t) t.brightness = value;
  }

  SetTemplateFloor(templateId, y) {
    const t = this.templates.get(templateId);
    if (t) t.floorY = y;
  }

  SetTemplateFixAngles(templateId, pitch, yaw) {
    const t = this.templates.get(templateId);
    if (t) t.fixAngles = true;
  }

  SetTemplateSubTemplate(templateId, subTemplateId) {
    const t = this.templates.get(templateId);
    if (t) t.subTemplate = subTemplateId;
  }

  SetEmitter(entity, templateId) {
    const template = this.templates.get(templateId);
    if (!template) return 0;

    const emitter = {
      id: this.nextEmitterId++,
      entity: entity,
      template: template,
      position: new Float32Array(3),
      active: true,
      timeSinceEmit: 0,
      particles: [],
      age: 0,
    };

    this.emitters.set(emitter.id, emitter);
    return emitter.id;
  }

  FreeEmitter(emitterId) {
    const emitter = this.emitters.get(emitterId);
    if (emitter) {
      for (const p of emitter.particles) {
        this.particles.delete(p.id);
      }
    }
    this.emitters.delete(emitterId);
  }

  FreezeEmitter(emitterId) {
    const emitter = this.emitters.get(emitterId);
    if (emitter) emitter.active = false;
  }

  UnfreezeEmitter(emitterId) {
    const emitter = this.emitters.get(emitterId);
    if (emitter) emitter.active = true;
  }

  UpdateParticles(deltaTime) {
    const gl = this.gl;
    const entities = Blitz3D.entities;

    for (const [emitterId, emitter] of this.emitters) {
      if (!emitter.active) continue;

      const entity = entities[emitter.entity];
      if (!entity) continue;

      emitter.position[0] = entity.position.x;
      emitter.position[1] = entity.position.y;
      emitter.position[2] = entity.position.z;

      emitter.age += deltaTime;
      if (
        emitter.template.emitterLife > 0 &&
        emitter.age > emitter.template.emitterLife
      ) {
        this.FreeEmitter(emitterId);
        continue;
      }

      emitter.timeSinceEmit += deltaTime;
      if (emitter.timeSinceEmit >= emitter.template.interval) {
        emitter.timeSinceEmit = 0;

        for (let i = 0; i < emitter.template.particlesPerInterval; i++) {
          if (emitter.particles.length >= emitter.template.maxParticles) break;

          const particle = this._createParticle(emitter);
          emitter.particles.push(particle);
          this.particles.set(particle.id, particle);
        }
      }
    }

    const particlesToRemove = [];
    for (const [id, particle] of this.particles) {
      particle.age += deltaTime;

      if (particle.age >= particle.lifeTime) {
        particlesToRemove.push(id);
        continue;
      }

      particle.velocity[0] += particle.gravityX * deltaTime / 1000;
      particle.velocity[1] += particle.gravityY * deltaTime / 1000;
      particle.velocity[2] += particle.gravityZ * deltaTime / 1000;

      particle.position[0] += particle.velocity[0] * deltaTime / 1000;
      particle.position[1] += particle.velocity[1] * deltaTime / 1000;
      particle.position[2] += particle.velocity[2] * deltaTime / 1000;

      particle.size += particle.sizeVel * deltaTime / 1000;

      particle.rotation += particle.rotationVel * deltaTime / 1000;

      if (
        particle.floorY !== -Infinity && particle.position[1] < particle.floorY
      ) {
        particle.position[1] = particle.floorY;
        particle.velocity[1] = -particle.velocity[1] * 0.3;
      }
    }

    for (const id of particlesToRemove) {
      const particle = this.particles.get(id);
      if (particle) {
        for (const [emitterId, emitter] of this.emitters) {
          const idx = emitter.particles.findIndex((p) => p.id === id);
          if (idx >= 0) emitter.particles.splice(idx, 1);
        }
        this.particles.delete(id);
      }
    }

    DebugOverlay.setStat("particleCount", this.particles.size);
  }

  _createParticle(emitter) {
    const t = emitter.template;
    const lifeTime = t.particleLifeMin +
      Math.random() * (t.particleLifeMax - t.particleLifeMin);

    return {
      id: this.nextParticleId++,
      position: [
        emitter.position[0] + (Math.random() - 0.5) * t.offsetRange.x,
        emitter.position[1] + (Math.random() - 0.5) * t.offsetRange.y,
        emitter.position[2] + (Math.random() - 0.5) * t.offsetRange.z,
      ],
      velocity: [
        t.velocityRange.x[0] +
        Math.random() * (t.velocityRange.x[1] - t.velocityRange.x[0]),
        t.velocityRange.y[0] +
        Math.random() * (t.velocityRange.y[1] - t.velocityRange.y[0]),
        t.velocityRange.z[0] +
        Math.random() * (t.velocityRange.z[1] - t.velocityRange.z[0]),
      ],
      lifeTime: lifeTime,
      age: 0,
      size: t.sizeRange.min +
        Math.random() * (t.sizeRange.max - t.sizeRange.min),
      sizeVel: t.sizeVelRange.min +
        Math.random() * (t.sizeVelRange.max - t.sizeVelRange.min),
      rotation: t.rotationRange.min +
        Math.random() * (t.rotationRange.max - t.rotationRange.min),
      rotationVel: 0,
      gravityX: t.gravity.x,
      gravityY: t.gravity.y,
      gravityZ: t.gravity.z,
      floorY: t.floorY,
      colors: t.colors,
      alphaStart: t.alphaRange.start,
      alphaEnd: t.alphaRange.end,
    };
  }

  render(projectionMatrix, viewMatrix) {
    const gl = this.gl;

    if (this.particles.size === 0) return;

    gl.useProgram(this.program);
    gl.uniformMatrix4fv(this.locations.u_projection, false, projectionMatrix);
    gl.uniformMatrix4fv(this.locations.u_view, false, viewMatrix);

    const instanceData = new Float32Array(this.particles.size * 11);
    let offset = 0;

    for (const [id, particle] of this.particles) {
      const lifeRatio = particle.age / particle.lifeTime;
      const alpha = particle.alphaStart +
        (particle.alphaEnd - particle.alphaStart) * lifeRatio;

      let color;
      if (particle.colors.length === 1) {
        color = particle.colors[0];
      } else if (particle.colors.length === 3) {
        const t = lifeRatio * 2;
        if (t < 1) {
          color = particle.colors[0];
        } else if (t < 2) {
          color = particle.colors[1];
        } else {
          color = particle.colors[2];
        }
      } else {
        color = particle.colors[0];
      }

      instanceData[offset++] = particle.position[0];
      instanceData[offset++] = particle.position[1];
      instanceData[offset++] = particle.position[2];
      instanceData[offset++] =
        color.r * particle.colors[0].r * particle.colors[0].r *
          this.templates.get(1)?.brightness || color.r;
      instanceData[offset++] = color.g * particle.colors[0].g *
        particle.colors[0].g;
      instanceData[offset++] = color.b * particle.colors[0].b *
        particle.colors[0].b;
      instanceData[offset++] = alpha;
      instanceData[offset++] = particle.size;
      instanceData[offset++] = particle.rotation;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, instanceData, gl.DYNAMIC_DRAW);

    gl.bindVertexArray(this.vao);

    const blendMode = this.templates.size > 0
      ? this.templates.values().next().value.blendMode
      : 0;
    gl.uniform1i(this.locations.u_blendMode, blendMode);

    if (blendMode === 1) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    } else {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }

    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.particles.size);

    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);

    DebugOverlay.incrementStat("drawCalls");
  }
}

window.ParticleSystem = ParticleSystem;
