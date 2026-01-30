/**
 * Blitz3D Runtime Graphics Module
 * WebGL/Three.js integration for 3D rendering
 */
import * as THREE from "three";
import { Blitz3DMesh, Blitz3DSurface } from "./mesh";
import { decodeSmpk, SMPKLoader } from "./smpk";
import { Blitz3DAnimation } from "./animation";
import { XLoader } from "./xloader";
import { Blitz3DAudio } from "./audio";
import { CmdOpcode, drainCmds } from "../shared/command_buffer";
import { dispatchCmd } from "./command_executor";

export class Blitz3DGraphics {
  [key: string]: any;

  constructor(core: any) {
    this.core = core;
    this.Blitz3DSurface = Blitz3DSurface;
    this.Blitz3DAnimation = Blitz3DAnimation;
    this.XLoader = XLoader;

    this.animationSystem = new this.Blitz3DAnimation(this, core);
    this.audioSystem = new Blitz3DAudio(core);
    this.meshSystem = Blitz3DMesh(this);
    this.xLoader = null; // Initialized lazily when first needed
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.entities = {};
    this.textures = {};
    this.animMixers = new Set();
    this.images = {};
    this.nextImageId = 1;
    this.nextEntityId = 1;
    this.surfaces = {};
    this.nextSurfaceId = 1;
    this.textures = {};
    this.nextTextureId = 1;
    this.brushes = {};
    this.nextBrushId = 1;
    this.lastPick = {
      entity: 0,
      x: 0,
      y: 0,
      z: 0,
      nx: 0,
      ny: 0,
      nz: 0,
      surface: 0,
      triangle: 0,
    };
    this.aaFonts = {};
    this.currentAAFont = null;
    this.currentFont = "arial";
    this.currentFontSize = 12;
    this.currentColor = [255, 255, 255, 255];
    this.clearColor = [0, 0, 0, 1];
    this.lastTime = 0;
    this.ambientLight = null;
    this.fog = null;
    this.fogState = { mode: 0, r: 0, g: 0, b: 0, near: 0, far: 1000, density: 0.001 };

    this._stopped = false;
    this._rafHandle = null;
    this._inputInstalled = false;
    this._inputHandlers = null;
    this.enablePointerLock = true; // Default to true for FPS
  }

  init3D() {
    console.log("init3D called");

    // Assert core is available
    if (!this.core) {
      console.error("init3D: core is not available");
      return;
    }

    // Assert canvas is available
    if (!this.core.canvas) {
      console.error("init3D: canvas is not available");
      return;
    }

    // Validate canvas dimensions
    const canvasWidth = this.core.canvas.width;
    const canvasHeight = this.core.canvas.height;
    console.log(
      "Canvas dimensions from core: " + canvasWidth + "x" + canvasHeight,
    );

    if (!canvasWidth || canvasWidth <= 0) {
      console.error(
        "init3D: Invalid canvas width: " + canvasWidth + ", defaulting to 800",
      );
      this.core.canvas.width = 800;
    }
    if (!canvasHeight || canvasHeight <= 0) {
      console.error(
        "init3D: Invalid canvas height: " + canvasHeight +
        ", defaulting to 600",
      );
      this.core.canvas.height = 600;
    }

    // Check Three.js availability
    if (!THREE) {
      console.error("Three.js not loaded! Cannot initialize 3D graphics.");
      return;
    }

    console.log("Three.js version: " + THREE.REVISION);

    this.scene = new THREE.Scene();
    console.log("THREE.Scene created");

    const createMockRenderer = () => {
      // Minimal mock renderer for environments without WebGL (e.g. Deno headless tooling).
      this.renderer = {
        setSize: (w, h) => {
          if (this.core && this.core.canvas) {
            this.core.canvas.width = w;
            this.core.canvas.height = h;
          }
        },
        render: (_scene, _camera) => { },
        setClearColor: (_color, _alpha) => { },
        clear: () => { },
        setPixelRatio: () => { },
        capabilities: { getMaxAnisotropy: () => 1 },
        domElement: this.core.canvas,
      };
    };

    const isHeadless = (globalThis as any).__BLITZ3D_HEADLESS === true;
    const hasWebGL = (() => {
      try {
        const c = this.core?.canvas;
        if (!c || typeof c.getContext !== "function") return false;
        return Boolean(c.getContext("webgl") || c.getContext("webgl2"));
      } catch {
        return false;
      }
    })();

    // Create WebGL renderer with validation
    console.log("Creating WebGLRenderer...");
    if (isHeadless || !hasWebGL) {
      createMockRenderer();
    } else {
      try {
        this.renderer = new THREE.WebGLRenderer({
          antialias: false,
          alpha: false,
          powerPreference: "high-performance",
        });
        console.log("WebGLRenderer created successfully");

        // Ensure renderer canvas is attached to DOM
        if (
          this.renderer.domElement && this.core.canvas &&
          this.renderer.domElement !== this.core.canvas
        ) {
          const oldCanvas = this.core.canvas;
          if (oldCanvas.parentElement) {
            oldCanvas.parentElement.replaceChild(
              this.renderer.domElement,
              oldCanvas,
            );
          }
          this.core.canvas = this.renderer.domElement;
        }

        // Verify renderer was created properly
        if (!this.renderer) {
          throw new Error("Renderer is null after construction");
        }

        // Verify renderer has required methods
        if (typeof this.renderer.setSize !== "function") {
          throw new Error("Renderer missing setSize method");
        }
        if (typeof this.renderer.render !== "function") {
          throw new Error("Renderer missing render method");
        }

        // Set size
        this.renderer.setSize(this.core.canvas.width, this.core.canvas.height);
        this.renderer.autoClear = false;
        console.log(
          "Renderer size set to: " + this.core.canvas.width + "x" +
          this.core.canvas.height,
        );

        const gl = this.renderer.getContext?.();
        if (gl) {
          console.log("WebGL context verified");
          console.log("WebGL Renderer: " + gl.getParameter(gl.RENDERER));
          console.log("WebGL Version: " + gl.getParameter(gl.VERSION));
        } else {
          console.warn("Could not verify WebGL context");
        }
      } catch (e) {
        console.error("WebGL Init Failed: " + e.message);
        console.warn("Falling back to mock renderer");

        // Create mock renderer for debugging
        createMockRenderer();
      }
    }

    // Expose THREE for debugging
    (window as any).THREE = THREE;

    console.log("Animation system initialized");

    // In headless mode, skip RAF-based animation to keep tooling deterministic and avoid
    // WebGLRenderer creation entirely.
    if (!isHeadless) {
      this._stopped = false;
      this.animate(0);
      console.log("Animation loop started");
    } else {
      this._stopped = true;
      this._rafHandle = null;
    }
  }

  render(time: number) {
    const delta = (time - this.lastTime) / 1000.0;
    this.lastTime = time;

    if (delta > 0 && delta < 0.1) {
      this.animMixers.forEach((mixer) => mixer.update(delta));
    }

    // Debug Log every ~100 frames (approx 1.6s)
    this.frameCount = (this.frameCount || 0) + 1;
    const debug = (globalThis as any).__BLITZ3D_DEBUG === true;
    if (debug && this.frameCount % 100 === 0) {
      console.log("--- Debug Frame " + this.frameCount + " ---");
      console.log("Loop Running. Camera:", this.camera ? "Exists" : "MISSING");
      if (this.camera) {
        console.log("Camera Pos:", this.camera.position);
        console.log("Camera Rot:", this.camera.rotation);
      }
      if (this.scene) {
        console.log("Scene Children:", this.scene.children.length);
      }
    }

    if (this.renderer && this.scene && this.camera) {
      this.updateSurfaces();
      this.renderer.render(this.scene, this.camera);
      this.audioSystem?.updateListener(this.camera);
    }
  }

  animate(time: number) {
    if (this._stopped) return;
    this._rafHandle = requestAnimationFrame((t) => this.animate(t));
    this.render(time);
  }

  ensureUniqueMaterial(child: any) {
    if (!child || !child.material || Array.isArray(child.material)) return;
    const mat = child.material as any;
    if (mat.userData?.__blitz3dUnique) return;
    const clone = mat.clone();
    clone.userData = { ...(clone.userData || {}), __blitz3dUnique: true };
    child.material = clone;
  }

  detachTextureFromMaterial(material: any, texture: any) {
    if (!material || !texture) return;
    const textureSlots = [
      "map",
      "alphaMap",
      "aoMap",
      "bumpMap",
      "displacementMap",
      "emissiveMap",
      "envMap",
      "lightMap",
      "metalnessMap",
      "roughnessMap",
      "normalMap",
      "specularMap",
    ];
    for (const slot of textureSlots) {
      if (material[slot] === texture) {
        material[slot] = null;
        material.needsUpdate = true;
      }
    }
  }

  detachTextureFromScene(texture: any) {
    if (!this.scene || !texture) return;
    this.scene.traverse((obj: any) => {
      if (!obj.material) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((m: any) => this.detachTextureFromMaterial(m, texture));
    });
  }

  disposeObject3D(root: any) {
    if (!root) return;
    root.traverse?.((obj: any) => {
      const mixer = obj.userData?.mixer;
      if (mixer && this.animMixers?.has?.(mixer)) {
        try {
          mixer.stopAllAction?.();
          mixer.uncacheRoot?.(obj);
        } catch { }
        this.animMixers.delete(mixer);
        if (obj.userData) {
          delete obj.userData.mixer;
          delete obj.userData.action;
          delete obj.userData.animationClip;
        }
      }

      if (obj.geometry?.dispose) {
        try {
          obj.geometry.dispose();
        } catch { }
      }
      if (obj.material) {
        const mats = Array.isArray(obj.material)
          ? obj.material
          : [obj.material];
        mats.forEach((m: any) => {
          if (m?.dispose) {
            try {
              m.dispose();
            } catch { }
          }
        });
      }
    });
  }

  installInputListeners() {
    if (this._inputInstalled || typeof window === "undefined") return;

    const toBlitzKey = (e: any): number => {
      const code = typeof e?.code === "string" ? e.code : "";
      // Blitz3D key codes match DirectInput scan codes (DIK_*), not DOM keyCode.
      // We map from `KeyboardEvent.code` (physical key) for layout-independent behavior.
      const map: Record<string, number> = {
        Escape: 1,
        Digit1: 2,
        Digit2: 3,
        Digit3: 4,
        Digit4: 5,
        Digit5: 6,
        Digit6: 7,
        Digit7: 8,
        Digit8: 9,
        Digit9: 10,
        Digit0: 11,
        Minus: 12,
        Equal: 13,
        Backspace: 14,
        Tab: 15,
        KeyQ: 16,
        KeyW: 17,
        KeyE: 18,
        KeyR: 19,
        KeyT: 20,
        KeyY: 21,
        KeyU: 22,
        KeyI: 23,
        KeyO: 24,
        KeyP: 25,
        BracketLeft: 26,
        BracketRight: 27,
        Enter: 28,
        ControlLeft: 29,
        KeyA: 30,
        KeyS: 31,
        KeyD: 32,
        KeyF: 33,
        KeyG: 34,
        KeyH: 35,
        KeyJ: 36,
        KeyK: 37,
        KeyL: 38,
        Semicolon: 39,
        Quote: 40,
        Backquote: 41,
        ShiftLeft: 42,
        Backslash: 43,
        KeyZ: 44,
        KeyX: 45,
        KeyC: 46,
        KeyV: 47,
        KeyB: 48,
        KeyN: 49,
        KeyM: 50,
        Comma: 51,
        Period: 52,
        Slash: 53,
        ShiftRight: 54,
        NumpadMultiply: 55,
        AltLeft: 56,
        Space: 57,
        CapsLock: 58,
        F1: 59,
        F2: 60,
        F3: 61,
        F4: 62,
        F5: 63,
        F6: 64,
        F7: 65,
        F8: 66,
        F9: 67,
        F10: 68,
        NumLock: 69,
        ScrollLock: 70,
        Numpad7: 71,
        Numpad8: 72,
        Numpad9: 73,
        NumpadSubtract: 74,
        Numpad4: 75,
        Numpad5: 76,
        Numpad6: 77,
        NumpadAdd: 78,
        Numpad1: 79,
        Numpad2: 80,
        Numpad3: 81,
        Numpad0: 82,
        NumpadDecimal: 83,
        F11: 87,
        F12: 88,
        ControlRight: 157,
        AltRight: 184,
        NumpadEnter: 156,
        NumpadDivide: 181,
        Insert: 210,
        Delete: 211,
        Home: 199,
        End: 207,
        PageUp: 201,
        PageDown: 209,
        ArrowUp: 200,
        ArrowLeft: 203,
        ArrowRight: 205,
        ArrowDown: 208,
      };
      const v = map[code];
      if (typeof v === "number") return v;

      // Fallback: some browsers/devices provide only keyCode; keep best-effort support.
      const keyCode = Number(e?.keyCode ?? 0);
      return Number.isFinite(keyCode) ? keyCode : 0;
    };

    this._inputHandlers = {
      keydown: (e: any) => {
        const keyStr = typeof e.key === "string" ? e.key : "";
        const ascii = (keyStr.length === 1)
          ? keyStr.charCodeAt(0)
          : (e.keyCode ?? 0);
        const blitzKey = toBlitzKey(e);
        if (blitzKey) {
          this.keysDown[blitzKey] = true;
          this.keysHit[blitzKey] = (this.keysHit[blitzKey] || 0) + 1;
        }
        // GetKey/WaitKey return an ASCII-ish code; keep feeding printable characters.
        if (Number.isFinite(ascii) && ascii) {
          (this.keyQueue as number[]).push(ascii);
        }
      },
      keyup: (e: any) => {
        const blitzKey = toBlitzKey(e);
        if (blitzKey) this.keysDown[blitzKey] = false;
      },
      mousemove: (e: any) => {
        this.mouseXSpeed = e.movementX;
        this.mouseYSpeed = e.movementY;
        this.mouseX = e.clientX;
        this.mouseY = e.clientY;
      },
      mousedown: (e: any) => {
        this.mouseDown[e.button + 1] = true;
        this.mouseHit[e.button + 1] = (this.mouseHit[e.button + 1] || 0) + 1;

        if (this.enablePointerLock && this.renderer?.domElement) {
          const el = this.renderer.domElement;
          if (document.pointerLockElement !== el) {
            try {
              // Only request on user gesture (mousedown matches this requirement)
              el.requestPointerLock();
            } catch (err) {
              console.warn("Pointer lock failed:", err);
            }
          }
        }
      },
      mouseup: (e: any) => {
        this.mouseDown[e.button + 1] = false;
      },
    };

    window.addEventListener("keydown", this._inputHandlers.keydown);
    window.addEventListener("keyup", this._inputHandlers.keyup);
    window.addEventListener("mousemove", this._inputHandlers.mousemove);
    window.addEventListener("mousedown", this._inputHandlers.mousedown);
    window.addEventListener("mouseup", this._inputHandlers.mouseup);

    // Resume Audio Context on interaction
    const resumeAudio = () => {
      this.audioSystem?.resume();
      window.removeEventListener("mousedown", resumeAudio);
      window.removeEventListener("keydown", resumeAudio);
    };
    window.addEventListener("mousedown", resumeAudio);
    window.addEventListener("keydown", resumeAudio);

    this._inputInstalled = true;
  }

  removeInputListeners() {
    if (
      !this._inputInstalled || typeof window === "undefined" ||
      !this._inputHandlers
    ) return;

    window.removeEventListener("keydown", this._inputHandlers.keydown);
    window.removeEventListener("keyup", this._inputHandlers.keyup);
    window.removeEventListener("mousemove", this._inputHandlers.mousemove);
    window.removeEventListener("mousedown", this._inputHandlers.mousedown);
    window.removeEventListener("mouseup", this._inputHandlers.mouseup);

    this._inputInstalled = false;
    this._inputHandlers = null;
  }

  dispose() {
    this._stopped = true;
    if (this._rafHandle != null) {
      try {
        cancelAnimationFrame(this._rafHandle);
      } catch { }
      this._rafHandle = null;
    }

    this.removeInputListeners();

    if (this.scene) {
      try {
        this.disposeObject3D(this.scene);
      } catch { }
    }

    if (this.textures) {
      for (
        const [id, tex] of Object.entries(this.textures as Record<string, any>)
      ) {
        if (!tex) continue;
        try {
          this.detachTextureFromScene(tex);
          tex.dispose?.();
        } catch { }
        delete (this.textures as any)[id];
      }
    }

    if (this.movies) {
      for (const [id, movie] of this.movies.entries()) {
        try {
          if (movie?.video) {
            movie.video.pause?.();
            movie.video.removeAttribute?.("src");
            movie.video.load?.();
          }
        } catch { }
        try {
          this.movies.delete(id);
        } catch { }
      }
    }

    if (this.renderer) {
      try {
        this.renderer.dispose?.();
      } catch { }
      try {
        this.renderer.forceContextLoss?.();
      } catch { }
    }
  }

  setupImports(imports) {
    if (this.meshSystem && this.meshSystem.setupImports) {
      this.meshSystem.setupImports(imports);
    }

    imports.env.Graphics3D = (width, height, depth, mode) => {
      console.log(
        "Graphics3D called: " + width + "x" + height + ", depth=" + depth +
        ", mode=" + mode,
      );

      // Validate dimensions
      if (width <= 0 || height <= 0) {
        console.error(
          "Graphics3D: Invalid dimensions " + width + "x" + height +
          ", using defaults",
        );
        width = 800;
        height = 600;
      }

      if (width > 4096 || height > 4096) {
        console.warn("Graphics3D: dimensions exceed maximum, capping to 4096");
        width = Math.min(width, 4096);
        height = Math.min(height, 4096);
      }

      if (this.core.canvas) {
        console.log(
          "Updating canvas from " + this.core.canvas.width + "x" +
          this.core.canvas.height + " to " + width + "x" + height,
        );
        this.core.canvas.width = width;
        this.core.canvas.height = height;
      } else {
        console.error("Graphics3D: canvas is not available!");
      }

      if (this.renderer) {
        console.log("Setting renderer size to " + width + "x" + height);
        this.renderer.setSize(width, height);

        // Important: Update camera aspect ratio
        if (this.camera) {
          console.log(
            "Updating camera aspect from " + this.camera.aspect + " to " +
            (width / height),
          );
          this.camera.aspect = width / height;
          this.camera.updateProjectionMatrix();
          console.log("Camera projection updated");
        } else {
          console.warn("Graphics3D: No camera to update aspect ratio");
        }
      } else {
        console.error("Graphics3D: renderer is not initialized!");
      }

      console.log("Graphics3D initialization complete");
    };

    imports.env.ClsColor = (r, g, b) => {
      this.clearColor = [r / 255.0, g / 255.0, b / 255.0, 1.0];
      if (this.renderer) {
        this.renderer.setClearColor(
          new THREE.Color(r / 255.0, g / 255.0, b / 255.0),
          1.0,
        );
      }
    };

    imports.env.Cls = () => {
      if (this.renderer) {
        this.renderer.clear();
      }
      if (this.core.ctx2d) {
        this.core.ctx2d.clearRect(
          0,
          0,
          this.core.textCanvas.width,
          this.core.textCanvas.height,
        );
      }
    };

    imports.env.Color = (r, g, b) => {
      this.currentColor = [r, g, b, 255];
      if (this.core.ctx2d) {
        this.core.ctx2d.fillStyle = `rgb(${r},${g},${b})`;
        this.core.ctx2d.strokeStyle = `rgb(${r},${g},${b})`;
      }
    };

    // Helpers for buffer-backed pixel operations (ImageBuffer/TextureBuffer/etc).
    const getBufferContext = (bufferId) => {
      // BackBuffer/front buffer use the shared text canvas
      if (!bufferId || bufferId === -1) {
        return this.core.ctx2d || null;
      }

      const img = this.images[bufferId];
      if (!img) return null;

      // Lazily create an offscreen canvas for writable images
      if (!img.canvas) {
        const canvas = document.createElement("canvas");
        canvas.width = img.width || img.element?.width || 1;
        canvas.height = img.height || img.element?.height || 1;
        const ctx = canvas.getContext("2d");
        if (img.element && img.loaded) {
          ctx.drawImage(img.element, 0, 0);
        }
        img.canvas = canvas;
        img.canvasCtx = ctx;
      }
      return img.canvasCtx || null;
    };

    const computeBounds = (entity) => {
      if (!entity) return null;
      try {
        const box = new THREE.Box3().setFromObject(entity);
        if (typeof box.isEmpty === "function" && box.isEmpty()) {
          return null;
        }
        return box;
      } catch (e) {
        return null;
      }
    };

    imports.env.GetColor = (x, y) => {
      return 0;
    };
    imports.env.ColorRed = () => this.currentColor[0] || 0;
    imports.env.ColorGreen = () => this.currentColor[1] || 0;
    imports.env.ColorBlue = () => this.currentColor[2] || 0;

    // Bitwise helpers that sometimes get imported as functions
    imports.env.And = (a, b) => (a | 0) & (b | 0);
    imports.env.Or = (a, b) => (a | 0) | (b | 0);

    // Graphics Metrics
    imports.env.GraphicsWidth = () =>
      this.core.canvas ? this.core.canvas.width : 800;
    imports.env.GraphicsHeight = () =>
      this.core.canvas ? this.core.canvas.height : 600;
    imports.env.WindowWidth = () => window.innerWidth;
    imports.env.WindowHeight = () => window.innerHeight;
    imports.env.VWait = (n) => { }; // No-op

    // 2D Primitives Stubs
    imports.env.Rect = (x, y, w, h, solid) => {
      if (this.core.ctx2d) {
        if (solid) this.core.ctx2d.fillRect(x, y, w, h);
        else this.core.ctx2d.strokeRect(x, y, w, h);
      }
    };
    imports.env.Oval = (x, y, w, h, solid) => {
      if (this.core.ctx2d) {
        this.core.ctx2d.beginPath();
        this.core.ctx2d.ellipse(
          x + w / 2,
          y + h / 2,
          w / 2,
          h / 2,
          0,
          0,
          2 * Math.PI,
        );
        if (solid) this.core.ctx2d.fill();
        else this.core.ctx2d.stroke();
      }
    };
    imports.env.Line = (x1, y1, x2, y2) => {
      if (this.core.ctx2d) {
        this.core.ctx2d.beginPath();
        this.core.ctx2d.moveTo(x1, y1);
        this.core.ctx2d.lineTo(x2, y2);
        this.core.ctx2d.stroke();
      }
    };
    imports.env.Text = (x, y, txtPtr, cx, cy) => {
      const txt = this.core.readString(txtPtr);
      if (this.core.ctx2d) {
        this.core.ctx2d.font = `${this.currentFontSize}px ${this.currentFont}`;
        this.core.ctx2d.textBaseline = "top";

        // Handle centering
        let finalX = x;
        let finalY = y;

        if (cx) {
          const metrics = this.core.ctx2d.measureText(txt);
          finalX -= metrics.width / 2;
        }

        if (cy) {
          finalY -= this.currentFontSize / 2;
        }

        this.core.ctx2d.fillText(txt, finalX, finalY);
      }
    };

    // Text metrics helpers for UI positioning
    const measureText = (txt) => {
      if (!this.core.ctx2d) return { width: 0, height: this.currentFontSize };
      this.core.ctx2d.font = `${this.currentFontSize}px ${this.currentFont}`;
      const metrics = this.core.ctx2d.measureText(txt);
      const height =
        (metrics.actualBoundingBoxAscent || this.currentFontSize * 0.8) +
        (metrics.actualBoundingBoxDescent || this.currentFontSize * 0.2);
      return { width: metrics.width || 0, height };
    };

    imports.env.StringWidth = (txtPtr) => {
      const txt = this.core.readString(txtPtr);
      return Math.floor(measureText(txt).width);
    };

    imports.env.StringHeight = (txtPtr) => {
      const txt = this.core.readString(txtPtr);
      return Math.floor(measureText(txt).height);
    };

    imports.env.FontWidth = () => Math.floor(this.currentFontSize * 0.6);
    imports.env.FontHeight = () => Math.floor(this.currentFontSize);

    // Font Functions
    imports.env.LoadFont = (namePtr, size, bold, italic, underline) => {
      const fontName = this.core.readString(namePtr);
      const id = this.nextImageId++; // Reuse image ID counter for fonts
      this.images[id] = {
        type: "font",
        name: fontName,
        size: size || 12,
        bold: bold || 0,
        italic: italic || 0,
        underline: underline || 0,
      };
      return id;
    };

    imports.env.SetFont = (fontId) => {
      const font = this.images[fontId];
      if (font && font.type === "font") {
        let fontStyle = "";
        if (font.italic) fontStyle += "italic ";
        if (font.bold) fontStyle += "bold ";

        this.currentFont = font.name;
        this.currentFontSize = font.size;

        if (this.core.ctx2d) {
          this.core.ctx2d.font = `${fontStyle}${font.size}px ${font.name}`;
        }
      }
    };

    imports.env.FreeFont = (fontId) => {
      if (this.images[fontId]) {
        delete this.images[fontId];
      }
    };

    // AAText compatibility (minimal rendering shim)
    imports.env.InitAAFont = (fontId) => {
      this.currentAAFont = fontId;
      this.aaFonts[fontId] = { id: fontId };
      return fontId;
    };

    imports.env.AAFont = (fontId) => {
      this.currentAAFont = fontId;
      return fontId;
    };

    imports.env.AASetFont = (fontId) => {
      this.currentAAFont = fontId;
      imports.env.SetFont(fontId);
    };

    imports.env.ReloadAAFont = (fontId) => {
      // No-op placeholder – real implementation would reload atlas textures.
      return fontId;
    };

    imports.env.AAText = (x, y, txtPtr, centerX, centerY) => {
      // Delegate to Text to keep behavior consistent
      imports.env.Text(x, y, txtPtr, centerX, centerY);
    };

    imports.env.AAStringWidth = (txtPtr) => imports.env.StringWidth(txtPtr);
    imports.env.AAStringHeight = (txtPtr) => imports.env.StringHeight(txtPtr);
    imports.env.AASpritePosition = (spriteId, x, y) => {
      const sprite = this.entities[spriteId];
      if (sprite) sprite.position.set(x, y, sprite.position.z);
    };
    imports.env.AASpriteScale = (spriteId, sx, sy) => {
      const sprite = this.entities[spriteId];
      if (sprite) sprite.scale.set(sx, sy, sprite.scale.z || 1);
    };

    // Image Functions
    imports.env.LoadImage = (pathPtr) => {
      const path = this.core.readString(pathPtr);
      const img = new Image();
      const id = this.nextImageId++;

      this.images[id] = {
        type: "image",
        element: img,
        width: 0,
        height: 0,
        loaded: false,
        handleX: 0,
        handleY: 0,
      };

      img.onload = () => {
        this.images[id].width = img.width;
        this.images[id].height = img.height;
        this.images[id].loaded = true;
      };

      img.src = path;
      return id;
    };

    imports.env.LoadImage_Strict = (pathPtr) => {
      return imports.env.LoadImage(pathPtr);
    };

    imports.env.CreateImage = (width, height, frames) => {
      const id = this.nextImageId++;
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, width);
      canvas.height = Math.max(1, height);
      this.images[id] = {
        type: "image",
        element: canvas,
        canvas,
        canvasCtx: canvas.getContext("2d"),
        width: canvas.width,
        height: canvas.height,
        loaded: true,
        handleX: 0,
        handleY: 0,
      };
      return id;
    };

    imports.env.CreateTexture = (width, height, flags) => {
      const data = new Uint8Array((width || 1) * (height || 1) * 4).fill(255);
      const tex = new THREE.DataTexture(data, width || 1, height || 1);
      tex.needsUpdate = true;
      tex.image = { width: width || 1, height: height || 1, data: data as any };
      tex.name = `runtime_texture_${this.nextTextureId}`;
      const id = this.nextTextureId++;
      this.textures[id] = tex;
      return id;
    };

    const drawImageTransformed = (ctx, img, x, y, drawFn) => {
      const rot = img.rotation || 0;
      const sx = img.scaleX || 1;
      const sy = img.scaleY || 1;

      if (rot !== 0 || sx !== 1 || sy !== 1) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rot * Math.PI / 180);
        ctx.scale(sx, sy);
        ctx.translate(-img.handleX, -img.handleY);
        // Draw at 0,0 because we translated to x,y then offset by handle
        drawFn(0, 0);
        ctx.restore();
      } else {
        drawFn(x - img.handleX, y - img.handleY);
      }
    };

    imports.env.DrawImage = (imgId, x, y, frame) => {
      const img = this.images[imgId];
      if (img && img.type === "image" && img.loaded && this.core.ctx2d) {
        drawImageTransformed(this.core.ctx2d, img, x, y, (dx, dy) => {
          this.core.ctx2d.drawImage(img.element, dx, dy);
        });
      }
    };

    imports.env.DrawBlock = (imgId, x, y, frame) => {
      const img = this.images[imgId];
      if (img && img.type === "image" && img.loaded && this.core.ctx2d) {
        const oldOp = this.core.ctx2d.globalCompositeOperation;
        this.core.ctx2d.globalCompositeOperation = "source-over";
        drawImageTransformed(this.core.ctx2d, img, x, y, (dx, dy) => {
          this.core.ctx2d.drawImage(img.element, dx, dy);
        });
        this.core.ctx2d.globalCompositeOperation = oldOp;
      }
    };

    imports.env.DrawImageRect = (imgId, x, y, rx, ry, rw, rh, frame) => {
      const img = this.images[imgId];
      if (img && img.type === "image" && img.loaded && this.core.ctx2d) {
        drawImageTransformed(this.core.ctx2d, img, x, y, (dx, dy) => {
          this.core.ctx2d.drawImage(
            img.element,
            rx,
            ry,
            rw,
            rh,
            dx,
            dy,
            rw,
            rh,
          );
        });
      }
    };

    imports.env.TileImage = (imgId, x, y, frame) => {
      const img = this.images[imgId];
      if (img && img.type === "image" && img.loaded && this.core.ctx2d) {
        // TileImage usually ignores rotation/scale in basic implementations,
        // but checking if we need to support it.
        // For now, standard implementation.
        const pattern = this.core.ctx2d.createPattern(img.element, "repeat");
        if (pattern) {
          this.core.ctx2d.fillStyle = pattern;
          this.core.ctx2d.translate(x, y); // Offset pattern
          this.core.ctx2d.fillRect(
            -x,
            -y,
            this.core.canvas.width,
            this.core.canvas.height,
          );
          this.core.ctx2d.translate(-x, -y);
        }
      }
    };

    imports.env.ImageWidth = (imgId) => {
      const img = this.images[imgId];
      return (img && img.type === "image") ? img.width : 0;
    };

    imports.env.ImageHeight = (imgId) => {
      const img = this.images[imgId];
      return (img && img.type === "image") ? img.height : 0;
    };

    imports.env.HandleImage = (imgId, x, y) => {
      const img = this.images[imgId];
      if (img && img.type === "image") {
        img.handleX = x;
        img.handleY = y;
      }
    };

    imports.env.MidHandle = (imgId) => {
      const img = this.images[imgId];
      if (img && img.type === "image") {
        img.handleX = img.width / 2;
        img.handleY = img.height / 2;
      }
    };

    imports.env.AutoMidHandle = (enabled) => {
      // No-op
    };

    imports.env.RotateImage = (imgId, angle) => {
      const img = this.images[imgId];
      if (img && img.type === "image") {
        img.rotation = angle;
      }
    };

    imports.env.ScaleImage = (imgId, xs, ys) => {
      const img = this.images[imgId];
      if (img && img.type === "image") {
        img.scaleX = xs;
        img.scaleY = ys;
      }
    };

    imports.env.ResizeImage = (imgId, w, h) => {
      const img = this.images[imgId];
      if (img && img.type === "image") {
        // Resize logic ideally needs to resample.
        // For now, hack using scale if not strictly required to be destructive
        img.scaleX = w / (img.element.width || 1);
        img.scaleY = h / (img.element.height || 1);
        // Note: ImageWidth() will still return original width unless we update it
        // To be robust, we'd need to create a new canvas.
        // Leaving as soft-resize (scale) for now.
      }
    };

    imports.env.MaskImage = (imgId, r, g, b) => {
      // Color masking - complex, stub for now
    };

    imports.env.ScaleImage = (imgId, scaleX, scaleY) => {
      const img = this.images[imgId];
      if (img && img.type === "image") {
        img.scaleX = scaleX;
        img.scaleY = scaleY;
      }
    };

    imports.env.ResizeImage = (imgId, width, height) => {
      const img = this.images[imgId];
      if (img && img.type === "image") {
        img.width = width;
        img.height = height;
      }
    };

    imports.env.FreeImage = (imgId) => {
      if (this.images[imgId]) {
        const img = this.images[imgId];
        try {
          if (img?.element && img.element instanceof HTMLImageElement) {
            img.element.onload = null;
            img.element.onerror = null;
            img.element.src = "";
          }
        } catch { }
        delete this.images[imgId];
      }
    };

    imports.env.Handle = (imgId) => {
      const img = this.images[imgId];
      if (img) {
        // Blitz3D exposes handleX/handleY; here we pack X in low 16 bits, Y in high 16 bits.
        return ((img.handleY & 0xffff) << 16) | (img.handleX & 0xffff);
      }
      return 0;
    };

    // Buffer accessors (used by SetBuffer/CopyRect/etc.)
    imports.env.BackBuffer = () => -1;

    // --- Input System ---

    this.keysDown = {};
    this.keysHit = {};
    this.keyQueue = [];
    this.mouseDown = {};
    this.mouseHit = {};
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseZ = 0;
    this.mouseXSpeed = 0;
    this.mouseYSpeed = 0;
    this.mouseZSpeed = 0;

    this.installInputListeners();

    // Keyboard
    imports.env.KeyDown = (key) => this.keysDown[key] ? 1 : 0;
    imports.env.KeyHit = (key) => {
      const hits = this.keysHit[key] || 0;
      this.keysHit[key] = 0; // Clear hits after reading
      return hits;
    };
    imports.env.GetKey = () => {
      const q = this.keyQueue as number[] | undefined;
      if (!q || q.length === 0) return 0;
      const v = q.shift();
      return Number.isFinite(v as number) ? (v as number) : 0;
    };
    imports.env.FlushKeys = () => {
      this.keysDown = {};
      this.keysHit = {};
      this.keyQueue = [];
    };
    imports.env.WaitKey = imports.env.GetKey; // Best-effort: non-blocking

    // Mouse
    imports.env.MouseDown = (btn) => this.mouseDown[btn] ? 1 : 0;
    imports.env.MouseHit = (btn) => {
      const hits = this.mouseHit[btn] || 0;
      this.mouseHit[btn] = 0;
      return hits;
    };
    imports.env.MouseX = () => this.mouseX;
    imports.env.MouseY = () => this.mouseY;
    imports.env.MouseZ = () => this.mouseZ;
    imports.env.MouseXSpeed = () => this.mouseXSpeed;
    imports.env.MouseYSpeed = () => this.mouseYSpeed;
    imports.env.MouseZSpeed = () => this.mouseZSpeed;
    imports.env.FlushMouse = () => {
      this.mouseDown = {};
      this.mouseHit = {};
    };
    imports.env.MoveMouse = (x, y) => {
      // Cannot programmatically move system mouse in browser
      this.mouseX = x;
      this.mouseY = y;
    };

    imports.env.HidePointer = () => {
      if (this.core.canvas) this.core.canvas.style.cursor = "none";
    };

    imports.env.ShowPointer = () => {
      if (this.core.canvas) this.core.canvas.style.cursor = "default";
    };

    // Joystick (Stubs)
    imports.env.JoyDown = (btn) => 0;
    imports.env.JoyHit = (btn) => 0;
    imports.env.JoyX = () => 0;
    imports.env.JoyY = () => 0;
    imports.env.JoyZ = () => 0;
    imports.env.JoyType = () => 0; // 0 = None

    imports.env.FrontBuffer = () => -1;
    imports.env.GraphicsBuffer = () => -1;
    imports.env.ScanLine = () => 0;
    imports.env.AvailVidMem = () => 1024 * 1024 * 512; // Mock 512MB
    imports.env.TotalVidMem = () => 1024 * 1024 * 512;
    imports.env.ImageBuffer = (imgId, frame) => imgId || -1;
    imports.env.TextureBuffer = (texId) => texId || -1;
    imports.env.SetBuffer = (bufferId) => {
      this.currentBuffer = bufferId;
      if (this.core.ctx2d) {
        // Future: switch active context if bufferId is an image
      }
    };

    imports.env.LockBuffer = (bufferId) => {
      // Return a dummy pointer/handle for the locked buffer
      // In a real implementation, this might CopyImageData to a WASM memory bank
      return 1;
    };

    imports.env.UnlockBuffer = (bufferId) => {
      // Commit changes if we were using a shadow buffer
    };

    imports.env.WritePixelFast = (x, y, color, bufferId) => {
      const ctx = getBufferContext(bufferId);
      if (!ctx) return;
      const r = (color >> 16) & 0xFF;
      const g = (color >> 8) & 0xFF;
      const b = color & 0xFF;
      const a = (color >>> 24) & 0xFF || 0xFF;
      const imgData = ctx.createImageData(1, 1);
      imgData.data[0] = r;
      imgData.data[1] = g;
      imgData.data[2] = b;
      imgData.data[3] = a;
      ctx.putImageData(imgData, x, y);
    };

    imports.env.ReadPixelFast = (x, y, bufferId) => {
      const ctx = getBufferContext(bufferId);
      if (!ctx) return 0;
      const data = ctx.getImageData(x, y, 1, 1).data;
      return ((data[3] || 0) << 24) | (data[0] << 16) | (data[1] << 8) |
        data[2];
    };

    imports.env.ReadPixel = imports.env.ReadPixelFast;
    imports.env.WritePixel = imports.env.WritePixelFast;

    imports.env.CopyPixel = (
      srcX,
      srcY,
      destX,
      destY,
      srcBuffer,
      destBuffer,
    ) => {
      const srcCtx = getBufferContext(srcBuffer);
      const destCtx = getBufferContext(destBuffer);
      if (srcCtx && destCtx) {
        const pixel = srcCtx.getImageData(srcX, srcY, 1, 1);
        destCtx.putImageData(pixel, destX, destY);
      }
    };
    imports.env.CopyPixelFast = imports.env.CopyPixel;

    imports.env.CreateCamera = (parent) => {
      console.log("CreateCamera called with parent: " + parent);

      // Validation assertions
      if (!this.core) {
        console.error("CreateCamera: core is not initialized");
        return 0;
      }
      if (!this.core.canvas) {
        console.error("CreateCamera: canvas is not available");
        return 0;
      }
      if (!this.scene) {
        console.warn("CreateCamera: scene not initialized, calling init3D");
        this.init3D();
      }
      if (!this.scene) {
        console.error("CreateCamera: scene is not initialized");
        return 0;
      }

      // Check canvas dimensions
      const canvasWidth = this.core.canvas.width || 800;
      const canvasHeight = this.core.canvas.height || 600;
      if (canvasWidth <= 0 || canvasHeight <= 0) {
        console.error(
          "CreateCamera: invalid canvas dimensions " + canvasWidth + "x" +
          canvasHeight,
        );
        return 0;
      }

      console.log(
        "Creating PerspectiveCamera with aspect: " +
        (canvasWidth / canvasHeight),
      );
      const cam = new THREE.PerspectiveCamera(
        75,
        canvasWidth / canvasHeight,
        1.0,
        1000.0,
      );

      // Set camera position and look at origin
      cam.position.set(0, 0, 5);
      cam.lookAt(0, 0, 0);

      console.log(
        "Camera position set to: " + cam.position.x + ", " + cam.position.y +
        ", " + cam.position.z,
      );

      const id = this.nextEntityId++;
      this.entities[id] = cam;
      this.entities[id].isCamera = true;

      if (parent && this.entities[parent]) {
        console.log("Adding camera as child of parent entity: " + parent);
        this.entities[parent].add(cam);
      } else {
        this.scene.add(cam);
        console.log("Camera added directly to scene");
      }

      if (!this.camera) {
        console.log("Setting active camera to ID: " + id);
        this.camera = cam;
      } else {
        console.log("Active camera already exists, keeping existing camera");
      }

      console.log("CreateCamera completed, ID: " + id);
      console.log(
        "Active camera is now: " +
        (this.camera === cam ? "NEW CAMERA" : "EXISTING CAMERA"),
      );

      return id;
    };

    imports.env.Load3DSound = (pathPtr: number) => {
      const path = this.core.readString(pathPtr);
      const audio = this.audioSystem;
      if (!audio) return 0;

      const id = audio.nextSoundId++;
      audio.loadSound(path, 0); // Background load
      return id;
    };

    imports.env.EmitSound = (soundId: number, entityId: number) => {
      const ent = this.entities[entityId];
      if (!ent || !this.audioSystem) return 0;

      // Get world position
      const pos = new THREE.Vector3();
      ent.getWorldPosition(pos);

      // Blitz3D -> Three: negate Z again if we are spatializing in right-handed space
      // but WebAudio panner usually expects the same coordinate system as the listener.
      // Since our listener is Three.js based, we use pos.x, pos.y, pos.z directly.
      return this.audioSystem.playSound3D(soundId, pos.x, pos.y, pos.z);
    };

    imports.env.CreateLight = (type) => {
      console.log("CreateLight called with type: " + type);

      // Validate scene
      if (!this.scene) {
        console.error("CreateLight: scene is not initialized");
        return 0;
      }

      let light;
      switch (type) {
        case 1:
          light = new THREE.PointLight(0xffffff, 1, 100);
          console.log("Created PointLight");
          break;
        case 2:
          light = new THREE.SpotLight(0xffffff, 1);
          light.penumbra = 0.5;
          console.log("Created SpotLight");
          break;
        default:
          light = new THREE.DirectionalLight(0xffffff, 1);
          console.log("Created DirectionalLight (default)");
      }

      const id = this.nextEntityId++;
      this.entities[id] = light;
      this.scene.add(light);
      console.log("Light added to scene, ID: " + id);
      return id;
    };

    imports.env.CreateMesh = (parent) => {
      console.log("CreateMesh called with parent: " + parent);

      const mesh = new THREE.Mesh();
      // mesh.isMesh = true; // Read-only

      // Ensure mesh has a visible material
      mesh.material = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        vertexColors: true,
        side: THREE.DoubleSide,
      });

      console.log("Mesh created with default white material");

      const id = this.nextEntityId++;
      this.entities[id] = mesh;

      if (parent && this.entities[parent]) {
        console.log("Adding mesh as child of parent: " + parent);
        this.entities[parent].add(mesh);
      } else {
        this.scene.add(mesh);
        console.log(
          "Mesh added directly to scene at position: " +
          mesh.position.x + ", " + mesh.position.y + ", " + mesh.position.z,
        );
      }

      console.log("Mesh created, ID: " + id);
      return id;
    };

    imports.blitz3d.ParseRMesh = (bankId) => {
      // Parse RMESH from SMPK in bank (metadata + visual)
      const data = this.core.banks.get(bankId);
      if (!data) {
        console.error(`ParseRMesh: Invalid bankId ${bankId}`);
        return 0;
      }

      // 1. Decode SMPK to access extras
      let smpkJson;
      try {
        const { json } = decodeSmpk(data);
        smpkJson = json;
      } catch (e) {
        console.error(`ParseRMesh: Failed to decode SMPK/JSON: ${e}`);
        return 0;
      }

      // 2. Load visual mesh via SMPKLoader
      // Lazy init loader
      if (!this.smpkLoader) this.smpkLoader = new SMPKLoader(this, this.core);

      // We load it as a child of the world (0). It returns a new entity ID.
      const rootId = this.smpkLoader.loadFromBytes(data, 0, `rmesh_${bankId}`);
      const root = this.entities[rootId];
      if (!root) {
        console.error("ParseRMesh: Failed to create root entity");
        return 0;
      }

      // 3. Spawn Extras (Entities & Triggers)
      // These are spawned as children of the Room Mesh parented to it so they move together.

      const spawnEntity = (e) => {
        if (!e.type) return;
        const type = e.type.toLowerCase();
        let id = 0;

        // Map RMESH types to Blitz3D entities
        if (type === "pointlight" || type === "light") {
          // 2 = Point Light
          id = imports.env.CreateLight(2);
        } else if (type === "spotlight") {
          // 3 = Spot Light
          id = imports.env.CreateLight(3);
        } else if (
          type === "screen" || type === "waypoint" || type === "playerstart" ||
          type === "soundemitter"
        ) {
          id = imports.env.CreatePivot(rootId);
        } else if (type === "model") {
          // Models in RMESH often point to external files.
          // For now, simple pivot placeholder.
          id = imports.env.CreatePivot(rootId);
        } else {
          // Fallback
          id = imports.env.CreatePivot(rootId);
        }

        if (id) {
          // Ensure parented to room
          imports.env.EntityParent(id, rootId, 0);

          // Position (assume Blitz coords)
          imports.env.PositionEntity(id, e.x || 0, e.y || 0, e.z || 0, 0);

          // Rotation
          if (e.pitch || e.yaw || e.roll) {
            imports.env.RotateEntity(id, e.pitch || 0, e.yaw || 0, e.roll || 0);
          }

          // Name
          const obj = this.entities[id];
          if (obj && e.name) obj.name = e.name;

          // Light Props
          if (type.includes("light")) {
            if (e.r !== undefined || e.g !== undefined || e.b !== undefined) {
              const r = e.r !== undefined ? e.r * 255 : 255;
              const g = e.g !== undefined ? e.g * 255 : 255;
              const b = e.b !== undefined ? e.b * 255 : 255;
              imports.env.LightColor(id, r, g, b);
            }
            if (e.range !== undefined) {
              imports.env.LightRange(id, e.range);
            }
          }
        }
      };

      const spawnTrigger = (t) => {
        const id = imports.env.CreatePivot(rootId);
        if (id) {
          const obj = this.entities[id];
          if (obj) {
            obj.name = t.name;

            // Calculate center from AABB
            const min = t.aabb.min;
            const max = t.aabb.max;
            const cx = (min[0] + max[0]) / 2;
            const cy = (min[1] + max[1]) / 2;
            const cz = (min[2] + max[2]) / 2;

            imports.env.PositionEntity(id, cx, cy, cz, 0);

            // Store metadata
            obj.userData.trigger = true;
            obj.userData.aabbMin = min;
            obj.userData.aabbMax = max;
          }
        }
      };

      if (smpkJson.extras?.rmesh) {
        const rm = smpkJson.extras.rmesh;
        if (Array.isArray(rm.entities)) rm.entities.forEach(spawnEntity);
        if (Array.isArray(rm.triggers)) rm.triggers.forEach(spawnTrigger);
      }

      return rootId;
    };

    imports.env.PositionEntity = (ent, x, y, z) => {
      const entity = this.entities[ent];
      if (this.core.entityTable) {
        this.core.entityTable.setX(ent, x);
        this.core.entityTable.setY(ent, y);
        this.core.entityTable.setZ(ent, z);
      }
      if (entity) {
        entity.position.set(x, y, -z);
      }
    };

    imports.env.RotateEntity = (ent, pitch, yaw, roll) => {
      const entity = this.entities[ent];
      if (this.core.entityTable) {
        this.core.entityTable.setPitch(ent, pitch);
        this.core.entityTable.setYaw(ent, yaw);
        this.core.entityTable.setRoll(ent, roll);
      }
      if (entity) {
        entity.rotation.set(
          pitch * Math.PI / 180,
          yaw * Math.PI / 180,
          roll * Math.PI / 180,
        );
      }
    };

    imports.env.ScaleEntity = (ent, x, y, z) => {
      const entity = this.entities[ent];
      if (this.core.entityTable) {
        this.core.entityTable.setScaleX(ent, x);
        this.core.entityTable.setScaleY(ent, y);
        this.core.entityTable.setScaleZ(ent, z);
      }
      if (entity) entity.scale.set(x, y, z);
    };

    imports.env.MoveEntity = (ent, x, y, z) => {
      const entity = this.entities[ent];
      if (entity) {
        entity.translateX(x);
        entity.translateY(y);
        entity.translateZ(-z);
        // After relative move, sync absolute state back to entityTable if possible
        // but MoveEntity is rare in high-freq loops usually; better if WASM just writes results.
        if (this.core.entityTable) {
          this.core.entityTable.setX(ent, entity.position.x);
          this.core.entityTable.setY(ent, entity.position.y);
          this.core.entityTable.setZ(ent, -entity.position.z);
        }
      }
    };

    imports.env.TurnEntity = (ent, pitch, yaw, roll, global) => {
      const entity = this.entities[ent];
      if (entity) {
        entity.rotateX(pitch * Math.PI / 180);
        entity.rotateY(yaw * Math.PI / 180);
        entity.rotateZ(roll * Math.PI / 180);
        if (this.core.entityTable) {
          // Very simplified: this doesn't handle global=1 correctly without full matrix sync
          // but for local turns it's better than nothing.
          this.core.entityTable.setPitch(ent, entity.rotation.x * 180 / Math.PI);
          this.core.entityTable.setYaw(ent, entity.rotation.y * 180 / Math.PI);
          this.core.entityTable.setRoll(ent, entity.rotation.z * 180 / Math.PI);
        }
      }
    };

    // Entity Property Getters
    imports.env.EntityX = (ent, global) => {
      if (!global && this.core.entityTable) return this.core.entityTable.getX(ent);
      const entity = this.entities[ent];
      if (!entity) return 0.0;
      if (global) {
        const worldPos = new THREE.Vector3();
        entity.getWorldPosition(worldPos);
        return worldPos.x;
      }
      return entity.position.x;
    };

    imports.env.EntityY = (ent, global) => {
      if (!global && this.core.entityTable) return this.core.entityTable.getY(ent);
      const entity = this.entities[ent];
      if (!entity) return 0.0;
      if (global) {
        const worldPos = new THREE.Vector3();
        entity.getWorldPosition(worldPos);
        return worldPos.y;
      }
      return entity.position.y;
    };

    imports.env.EntityZ = (ent, global) => {
      if (!global && this.core.entityTable) return this.core.entityTable.getZ(ent);
      const entity = this.entities[ent];
      if (!entity) return 0.0;
      // Convert from Three.js coordinate system back to Blitz3D (negate Z)
      if (global) {
        const worldPos = new THREE.Vector3();
        entity.getWorldPosition(worldPos);
        return -worldPos.z;
      }
      return -entity.position.z;
    };

    imports.env.EntityPitch = (ent, global) => {
      if (!global && this.core.entityTable) return this.core.entityTable.getPitch(ent);
      const entity = this.entities[ent];
      if (!entity) return 0.0;
      if (global) {
        const worldRot = new THREE.Euler();
        entity.getWorldQuaternion(new THREE.Quaternion());
        worldRot.setFromQuaternion(entity.quaternion);
        return worldRot.x * 180 / Math.PI;
      }
      return entity.rotation.x * 180 / Math.PI;
    };

    imports.env.EntityYaw = (ent, global) => {
      if (!global && this.core.entityTable) return this.core.entityTable.getYaw(ent);
      const entity = this.entities[ent];
      if (!entity) return 0.0;
      if (global) {
        const worldRot = new THREE.Euler();
        entity.getWorldQuaternion(new THREE.Quaternion());
        worldRot.setFromQuaternion(entity.quaternion);
        return worldRot.y * 180 / Math.PI;
      }
      return entity.rotation.y * 180 / Math.PI;
    };

    imports.env.EntityRoll = (ent, global) => {
      if (!global && this.core.entityTable) return this.core.entityTable.getRoll(ent);
      const entity = this.entities[ent];
      if (!entity) return 0.0;
      if (global) {
        const worldRot = new THREE.Euler();
        entity.getWorldQuaternion(new THREE.Quaternion());
        worldRot.setFromQuaternion(entity.quaternion);
        return worldRot.z * 180 / Math.PI;
      }
      return entity.rotation.z * 180 / Math.PI;
    };

    imports.env.EntityDistance = (ent1, ent2) => {
      const entity1 = this.entities[ent1];
      const entity2 = this.entities[ent2];
      if (!entity1 || !entity2) return 0.0;

      const pos1 = new THREE.Vector3();
      const pos2 = new THREE.Vector3();
      entity1.getWorldPosition(pos1);
      entity2.getWorldPosition(pos2);

      return pos1.distanceTo(pos2);
    };

    const dimensionFromBounds = (entity, axis) => {
      const bounds = computeBounds(entity);
      if (!bounds) return 1.0;
      switch (axis) {
        case "x":
          return Math.max(bounds.max.x - bounds.min.x, 0.0001);
        case "y":
          return Math.max(bounds.max.y - bounds.min.y, 0.0001);
        case "z":
          return Math.max(bounds.max.z - bounds.min.z, 0.0001);
        default:
          return 1.0;
      }
    };

    imports.env.MeshWidth = (meshId) => {
      const entity = this.entities[meshId];
      return dimensionFromBounds(entity, "x");
    };

    imports.env.MeshHeight = (meshId) => {
      const entity = this.entities[meshId];
      return dimensionFromBounds(entity, "y");
    };

    imports.env.MeshDepth = (meshId) => {
      const entity = this.entities[meshId];
      return dimensionFromBounds(entity, "z");
    };

    // Entity Hierarchy Queries
    imports.env.CountChildren = (ent) => {
      const entity = this.entities[ent];
      return entity ? entity.children.length : 0;
    };

    imports.env.GetChild = (ent, index) => {
      const entity = this.entities[ent];
      if (!entity || index < 0 || index >= entity.children.length) return 0;

      const child = entity.children[index];
      // Find the entity ID for this child
      for (const [id, obj] of Object.entries(this.entities)) {
        if (obj === child) return parseInt(id);
      }
      return 0;
    };

    imports.env.FindChild = (ent, name) => {
      const entity = this.entities[ent];
      if (!entity) return 0;

      // Search through children for matching name
      for (const child of entity.children) {
        if (child.name === name) {
          // Find the entity ID for this child
          for (const [id, obj] of Object.entries(this.entities)) {
            if (obj === child) return parseInt(id);
          }
        }
      }
      return 0;
    };

    imports.env.GetParent = (ent) => {
      const entity = this.entities[ent];
      if (!entity || !entity.parent || entity.parent === this.scene) return 0;

      // Find the entity ID for the parent
      for (const [id, obj] of Object.entries(this.entities)) {
        if (obj === entity.parent) return parseInt(id);
      }
      return 0;
    };

    imports.env.PickedEntity = () => {
      return this.lastPick?.entity || 0;
    };
    imports.env.PickedNX = () => {
      return this.lastPick?.nx || 0.0;
    };
    imports.env.PickedNY = () => {
      return this.lastPick?.ny || 0.0;
    };
    imports.env.PickedNZ = () => {
      return this.lastPick?.nz || 0.0;
    };

    imports.env.CreatePivot = (parent) => this.imports.env.CreateMesh(parent);
    imports.env.FreeEntity = (ent) => {
      const entity = this.entities[ent];
      if (entity) {
        try {
          this.disposeObject3D(entity);
        } catch { }
        if (entity.parent) entity.parent.remove(entity);
        delete this.entities[ent];
      }
    };

    imports.env.EntityTexture = (ent, tex, frame, index) => {
      const entity = this.entities[ent];
      const texture = this.textures[tex];
      if (entity && texture) {
        entity.traverse((child) => {
          if (child.isMesh) {
            this.ensureUniqueMaterial(child);
            if (Array.isArray(child.material)) return;
            child.material.map = texture;
            child.material.needsUpdate = true;
          }
        });
      }
    };

    // Entity Property Functions
    imports.env.EntityAutoFade = (ent, near, far) => {
      const entity = this.entities[ent];
      if (entity) {
        entity.userData.autoFade = { near, far };
      }
    };

    imports.env.EntityOrder = (ent, order) => {
      const entity = this.entities[ent];
      if (entity) {
        entity.renderOrder = order;
      }
    };

    imports.env.EntityAlpha = (ent, alpha) => {
      const entity = this.entities[ent];
      if (entity) {
        entity.traverse((child) => {
          if (child.isMesh) {
            this.ensureUniqueMaterial(child);
            if (Array.isArray(child.material)) return;
            child.material.opacity = alpha;
            child.material.transparent = alpha < 1.0;
            child.material.needsUpdate = true;
          }
        });
      }
    };

    imports.env.EntityColor = (ent, red, green, blue) => {
      const entity = this.entities[ent];
      if (entity) {
        entity.traverse((child) => {
          if (child.isMesh) {
            this.ensureUniqueMaterial(child);
            if (Array.isArray(child.material)) return;
            child.material.color.setRGB(red / 255, green / 255, blue / 255);
            child.material.needsUpdate = true;
          }
        });
      }
    };

    imports.env.EntityFX = (ent, fx) => {
      const entity = this.entities[ent];
      if (entity) {
        entity.traverse((child) => {
          if (child.isMesh) {
            this.ensureUniqueMaterial(child);
            if (Array.isArray(child.material)) return;
            // FX flags: 1 = fullbright, 2 = modulate, 4 = add, 8 = alpha
            child.material.emissive = new THREE.Color(0, 0, 0);
            if (fx & 1) { // fullbright
              child.material.emissive.setRGB(1, 1, 1);
            }
            if (fx & 4) { // additive blending
              child.material.blending = THREE.AdditiveBlending;
            } else {
              child.material.blending = THREE.NormalBlending;
            }
            child.material.needsUpdate = true;
          }
        });
      }
    };

    imports.env.EntityBlend = (ent, blend) => {
      const entity = this.entities[ent];
      if (entity) {
        entity.traverse((child) => {
          if (child.isMesh) {
            this.ensureUniqueMaterial(child);
            if (Array.isArray(child.material)) return;
            // Blend: 0 = solid, 1 = alpha, 2 = multiply, 3 = additive
            switch (blend) {
              case 0: // solid
                child.material.transparent = false;
                child.material.blending = THREE.NoBlending;
                break;
              case 1: // alpha
                child.material.transparent = true;
                child.material.blending = THREE.NormalBlending;
                break;
              case 2: // multiply
                child.material.transparent = true;
                child.material.blending = THREE.MultiplyBlending;
                break;
              case 3: // additive
                child.material.transparent = true;
                child.material.blending = THREE.AdditiveBlending;
                break;
              default:
                child.material.transparent = false;
                child.material.blending = THREE.NormalBlending;
            }
            child.material.needsUpdate = true;
          }
        });
      }
    };

    // --- Picking System ---

    imports.env.EntityPickMode = (ent, mode, obs) => {
      const entity = this.entities[ent];
      if (entity) {
        entity.userData.pickMode = mode; // 1: sphere, 2: poly, 3: box
        entity.traverse((child) => {
          child.userData.pickMode = mode;
        });
      }
    };

    const updatePickResult = (intersect) => {
      if (!intersect) {
        this.lastPick = {
          entity: 0,
          x: 0,
          y: 0,
          z: 0,
          nx: 0,
          ny: 0,
          nz: 0,
          surface: 0,
          triangle: 0,
        };
        return 0;
      }
      // Find blitz entity ID from object or parents
      let pickedEnt = 0;
      let curr = intersect.object;
      while (curr) {
        if (curr.userData && curr.id) {
          for (let id in this.entities) {
            if (
              this.entities[id] === curr || this.entities[id] === curr.parent
            ) {
              pickedEnt = parseInt(id);
              break;
            }
          }
          if (pickedEnt) break;
        }
        curr = curr.parent;
      }

      this.lastPick.entity = pickedEnt;
      this.lastPick.x = intersect.point.x;
      this.lastPick.y = intersect.point.y;
      this.lastPick.z = intersect.point.z;
      if (intersect.face) {
        this.lastPick.nx = intersect.face.normal.x;
        this.lastPick.ny = intersect.face.normal.y;
        this.lastPick.nz = intersect.face.normal.z;
      }
      return pickedEnt;
    };

    imports.env.CameraPick = (camId, x, y) => {
      const cam = this.entities[camId];
      if (!cam) return 0;

      // Convert screen x,y to normalized device coords (-1 to +1)
      const ndcX = (x / this.core.canvas.width) * 2 - 1;
      const ndcY = -(y / this.core.canvas.height) * 2 + 1;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), cam);

      const pickables = [];
      this.scene.traverse((obj) => {
        if (obj.userData && obj.userData.pickMode) pickables.push(obj);
      });

      const intersects = raycaster.intersectObjects(pickables, false);
      if (intersects.length > 0) {
        return updatePickResult(intersects[0]);
      }
      updatePickResult(null);
      return 0;
    };

    imports.env.EntityPick = (entId, range) => {
      const ent = this.entities[entId];
      if (!ent) return 0;

      const origin = ent.position.clone();
      const direction = new THREE.Vector3(0, 0, 1).applyQuaternion(
        ent.quaternion,
      ).normalize();

      const raycaster = new THREE.Raycaster(
        origin,
        direction,
        0,
        range > 0 ? range : Infinity,
      );

      const pickables = [];
      this.scene.traverse((obj) => {
        if (obj !== ent && obj.userData && obj.userData.pickMode) {
          pickables.push(obj);
        }
      });

      const intersects = raycaster.intersectObjects(pickables, false);
      if (intersects.length > 0) {
        return updatePickResult(intersects[0]);
      }
      updatePickResult(null);
      return 0;
    };

    imports.env.LinePick = (x, y, z, dx, dy, dz, radius) => {
      const origin = new THREE.Vector3(x, y, z);
      const direction = new THREE.Vector3(dx, dy, dz);
      const length = direction.length();
      direction.normalize();

      const raycaster = new THREE.Raycaster(origin, direction, 0, length);

      const pickables = [];
      this.scene.traverse((obj) => {
        if (obj.userData && obj.userData.pickMode) pickables.push(obj);
      });

      const intersects = raycaster.intersectObjects(pickables, false);
      if (intersects.length > 0) {
        return updatePickResult(intersects[0]);
      }
      updatePickResult(null);
      return 0;
    };

    imports.env.PickedX = () => this.lastPick.x;
    imports.env.PickedY = () => this.lastPick.y;
    imports.env.PickedZ = () => this.lastPick.z;
    imports.env.PickedNX = () => this.lastPick.nx;
    imports.env.PickedNY = () => this.lastPick.ny;
    imports.env.PickedNZ = () => this.lastPick.nz;
    imports.env.PickedEntity = () => this.lastPick.entity;
    imports.env.PickedSurface = () => 0; // Stub
    imports.env.PickedTriangle = () => 0; // Stub

    imports.env.PointEntity = (ent, target) => {
      const entity = this.entities[ent];
      const targetEntity = this.entities[target];
      if (entity && targetEntity) {
        entity.lookAt(targetEntity.position);
      }
    };

    // --- Collision System (Stubs) ---

    this.collisions = []; // List of collision pairs: {src, dest, method, response}
    this.collisionState = {}; // entId -> { collisions: [], type: 0, radius: [x,y], box: [x,y,z,w,h,d] }

    // Setup
    imports.env.Collisions = (srcType, destType, method, response) => {
      this.collisions.push({ srcType, destType, method, response });
    };

    imports.env.EntityType = (entId, typeId, recurs) => {
      const ent = this.entities[entId];
      if (ent) {
        ent.userData.typeId = typeId;
        // recursive...
      }
    };

    imports.env.EntityRadius = (entId, radiusX, radiusY) => {
      const ent = this.entities[entId];
      if (ent) ent.userData.radius = [radiusX, radiusY || radiusX];
    };

    imports.env.EntityBox = (entId, x, y, z, w, h, d) => {
      const ent = this.entities[entId];
      if (ent) ent.userData.box = [x, y, z, w, h, d];
    };

    imports.env.ResetEntity = (entId) => {
      // Reset collision history
    };

    imports.env.ClearCollisions = () => {
      // Clear current frame collisions
    };

    imports.env.UpdateWorld = (step) => {
      // Perform physics/collision steps
      // 1. Move entities based on velocity/gravity? (Blitz3D handles this internally or user does?)
      // Blitz3D UpdateWorld typically handles animation and collisions.
      // We need to implement simple collision detection here if we want gameplay.
      // For now: Animation update

      // Update animations
      const now = performance.now();
      const delta = (now - this.lastTime) * 0.001;
      this.lastTime = now;

      if (this.animationSystem) {
        this.animationSystem.update(delta * step);
      }
    };

    // Query
    imports.env.EntityCollided = (entId, typeId) => {
      // Return entity ID that collided with entId of type typeId
      return 0;
    };

    imports.env.CountCollisions = (entId) => {
      return 0;
    };

    imports.env.CollisionX = (entId, index) => 0;
    imports.env.CollisionY = (entId, index) => 0;
    imports.env.CollisionZ = (entId, index) => 0;
    imports.env.CollisionNX = (entId, index) => 0;
    imports.env.CollisionNY = (entId, index) => 0;
    imports.env.CollisionNZ = (entId, index) => 0;
    imports.env.CollisionTime = (entId, index) => 0;
    imports.env.CollisionEntity = (entId, index) => 0;
    imports.env.CollisionSurface = (entId, index) => 0;
    imports.env.CollisionTriangle = (entId, index) => 0;

    imports.env.GetEntityType = (entId) => {
      const ent = this.entities[entId];
      return ent ? (ent.userData.typeId || 0) : 0;
    };

    imports.env.NameEntity = (ent, name) => {
      const entity = this.entities[ent];
      if (entity) {
        entity.name = name;
      }
    };

    imports.env.EntityName = (ent) => {
      const entity = this.entities[ent];
      if (entity && entity.name && this.core.allocString) {
        return this.core.allocString(entity.name);
      }
      return 0;
    };

    // VertexTexCoords for UV mapping
    imports.env.VertexTexCoords = (surfId, vid, u, v, w) => {
      const surface = this.surfaces[surfId];
      if (surface) {
        surface.setVertexUV(vid, u, v);
      }
    };

    // Mesh Surface Commands
    imports.env.CreateSurface = (meshId, brushId) => {
      const mesh = this.entities[meshId];
      if (mesh) {
        const surface = new this.Blitz3DSurface(mesh);
        const id = this.nextSurfaceId++;
        this.surfaces[id] = surface;
        surface.id = id;

        if (!mesh.userData.surfaces) mesh.userData.surfaces = [];
        mesh.userData.surfaces.push(surface);

        return id;
      }
      return 0;
    };

    imports.env.CountSurfaces = (meshId) => {
      const mesh = this.entities[meshId];
      if (mesh && mesh.userData && mesh.userData.surfaces) {
        return mesh.userData.surfaces.length;
      }
      return 0;
    };

    imports.env.GetSurface = (meshId, index) => {
      const mesh = this.entities[meshId];
      if (mesh && mesh.userData && mesh.userData.surfaces) {
        const surface = mesh.userData.surfaces[index - 1]; // Blitz3D is 1-indexed? No, usually 1..n for GetSurface
        return surface?.id || 0;
      }
      return 0;
    };

    imports.env.GetSurface = (meshId, index) => {
      const mesh = this.entities[meshId];
      if (mesh && mesh.children && index > 0 && index <= mesh.children.length) {
        const child = mesh.children[index - 1];
        if (child.userData && child.userData.surface) {
          for (const id in this.surfaces) {
            if (this.surfaces[id] === child.userData.surface) {
              return parseInt(id);
            }
          }
          const id = this.nextSurfaceId++;
          this.surfaces[id] = child.userData.surface;
          return id;
        }
      }
      return 0;
    };

    imports.env.AddVertex = (surfId, x, y, z, u, v, w) => {
      const surface = this.surfaces[surfId];
      if (surface) {
        const vertexIndex = surface.addVertex(x, y, z, u, v);
        // console.log("AddVertex surface " + surfId + ": index=" + vertexIndex + " at (" + x + ", " + y + ", " + z + ")");
        return vertexIndex;
      } else {
        console.error("AddVertex: surface " + surfId + " not found");
        return 0;
      }
    };

    imports.env.AddVertexExtended = (surfId, x, y, z, u, v, w, nx, ny, nz) => {
      const surface = this.surfaces[surfId];
      if (surface) {
        // Extended version supports normals
        const vertexIndex = surface.addVertex(x, y, z, u, v);
        // Set normal if surface supports it (might need to update the surface class)
        if (surface.setNormal) {
          surface.setNormal(vertexIndex, nx, ny, nz);
        }
        return vertexIndex;
      } else {
        console.error("AddVertexExtended: surface " + surfId + " not found");
        return 0;
      }
    };

    imports.env.AddTriangle = (surfId, v0, v1, v2) => {
      const surface = this.surfaces[surfId];
      if (surface) {
        const triangleIndex = surface.addTriangle(v0, v1, v2);
        if (this.frameCount < 10) {
          console.log(
            "AddTriangle surface " + surfId + ": indices=(" + v0 + ", " + v1 +
            ", " + v2 + "), triangleIndex=" + triangleIndex,
          );
        }
        return triangleIndex;
      } else {
        console.error("AddTriangle: surface " + surfId + " not found");
        return 0;
      }
    };

    imports.env.VertexColor = (surfId, vid, r, g, b, a) => {
      const surface = this.surfaces[surfId];
      if (surface) surface.vertexColor(vid, r, g, b, a);
    };

    imports.env.UpdateNormals = (meshId) => {
      const mesh = this.entities[meshId];
      if (mesh) {
        if (this.frameCount < 5) {
          console.log(
            "UpdateNormals for mesh ID: " + meshId + ", children: " +
            mesh.children.length,
          );
        }

        if (mesh.children) {
          // Iterate through children which are the surface meshes
          mesh.children.forEach((child, i) => {
            if (this.frameCount < 5) {
              console.log(
                "  Processing child " + i + ": type=" +
                (child.isMesh ? "Mesh" : "Other"),
              );
            }

            // First, update the surface if it's a Blitz3DSurface
            // This ensures geometry.attributes.position exists
            if (child.userData && child.userData.surface) {
              if (this.frameCount < 5) {
                console.log("  Found surface in userData, calling update()...");
              }
              child.userData.surface.update();
              if (this.frameCount < 5) {
                console.log("  Surface update complete");
              }
            } else {
              if (this.frameCount < 5) {
                console.log(
                  "  No surface in userData, checking surfaces map...",
                );
              }
              // Also check if this.graphics.surfaces contains a matching surface
              for (const surfId in this.surfaces) {
                const surf = this.surfaces[surfId];
                if (surf.mesh === child) {
                  if (this.frameCount < 5) {
                    console.log(
                      "  Found matching surface in map, ID: " + surfId +
                      ", calling update()...",
                    );
                  }
                  surf.update();
                  if (this.frameCount < 5) {
                    console.log("  Surface update complete");
                  }
                  break;
                }
              }
            }

            // Now check geometry status with ULTRA-SAFE guards
            try {
              if (!child || !child.geometry) {
                if (this.frameCount < 5) {
                  console.log("  Skipping child " + i + ": no geometry");
                }
                return;
              }

              // Check if attributes exist
              if (!child.geometry.attributes) {
                if (this.frameCount < 5) {
                  console.log(
                    "  Skipping child " + i + ": no attributes, available: " +
                    Object.keys(child.geometry).join(", "),
                  );
                }
                return;
              }

              // Check if position attribute exists
              if (!child.geometry.attributes.position) {
                if (this.frameCount < 5) {
                  console.log(
                    "  Skipping child " + i + ": no position attribute",
                  );
                }
                return;
              }

              // Now compute normals on the updated geometry with optional chaining
              child.geometry.computeVertexNormals?.();

              // Ultra-safe needsUpdate with optional chaining
              child.geometry.attributes.position.needsUpdate = true;

              if (this.frameCount < 5) {
                console.log("  Computed normals for child " + i);
              }
            } catch (e) {
              console.warn(
                "UpdateNormals safe-guard caught error: " + e.message,
              );
            }
          });
        }
      } else {
        if (this.frameCount < 5) {
          console.error("UpdateNormals: mesh " + meshId + " not found");
        }
      }
    };

    imports.env.LoadMesh = (pathPtr, parent) => {
      const rawPath = this.core.readString(pathPtr);
      const path = rawPath.replace(/\.(b3d|x|rmesh)$/i, ".smpk");
      console.log(`Loading Mesh: ${rawPath} -> ${path}`);

      const placeholderId = imports.env.CreateMesh(parent);
      const ent = this.entities[placeholderId];
      ent.name = rawPath;

      // Determine loader
      const lowerPath = path.toLowerCase();
      if (lowerPath.endsWith(".smpk")) {
        this.animationSystem.loadAnimMesh(path, parent).then(() => {
          console.log(`[SMPK] Loaded ${path}`);
        }).catch((err) => console.error(`[SMPK] ${path}:`, err));
      } else if (lowerPath.endsWith(".b3d") || lowerPath.endsWith(".x") || lowerPath.endsWith(".rmesh")) {
        throw new Error(`Refusing to load source mesh at runtime: ${rawPath} (convert offline to .smpk)`);
      }

      return placeholderId;
    };

    imports.env.LoadMesh_Strict = (pathPtr, parent) => {
      return imports.env.LoadMesh(pathPtr, parent);
    };

    // Animation Commands
    imports.env.LoadAnimMesh = (pathPtr, parent) => {
      const rawPath = this.core.readString(pathPtr);
      const path = rawPath.replace(/\.(b3d|x)$/i, ".smpk");
      console.log(`Loading Anim Mesh: ${rawPath} -> ${path}`);

      // Similar to LoadMesh, but via animationSystem which uses B3DLoader
      const placeholderId = imports.env.CreateMesh(parent);
      const ent = this.entities[placeholderId];
      ent.name = rawPath;

      this.animationSystem.loadAnimMesh(path, parent).then(() => {
        console.log(`[SMPK] Loaded Anim ${path}`);
      }).catch((err) => console.error(`[SMPK] Anim ${path}:`, err));

      return placeholderId;
    };

    imports.env.LoadAnimMesh_Strict = (pathPtr, parent) => {
      return imports.env.LoadAnimMesh(pathPtr, parent);
    };

    if (!imports.blitz3d) imports.blitz3d = {};
    imports.blitz3d.ParseB3D = (bankId) => {
      const bank = this.core.banks.get(bankId);
      if (!bank) return 0;
      console.log(`ParseB3D: bankId=${bankId}, size=${bank.length}`);

      // For now, return a placeholder mesh.
      // In a better implementation, we'd use B3DLoader.parseBinaryData
      const entityId = imports.env.CreateMesh(0);

      // Async load from bank data
      this.animationSystem.b3dLoader.parseBinaryData(bank);
      // Note: need to actually create the Three.js objects here

      return entityId;
    };

    imports.blitz3d.ParseRMesh = (bankId) => {
      const bank = this.core.banks.get(bankId);
      if (!bank) return 0;
      console.log(`ParseRMesh: bankId=${bankId}, size=${bank.length}`);
      return 1;
    };

    // Mesh Bridge
    imports.blitz3d.GetMeshSurfaceCount = (meshId) => {
      const ent = this.entities[meshId];
      if (!ent) return 0;
      let count = 0;
      ent.traverse((child) => {
        if (child instanceof THREE.Mesh) count++;
      });
      return count;
    };
    imports.blitz3d.GetSurfaceVertexCount = (m, s) => 0;
    imports.blitz3d.GetSurfaceIndexCount = (m, s) => 0;
    imports.blitz3d.GetSurfaceVerticesPtr = (m, s) => 0;
    imports.blitz3d.GetSurfaceIndicesPtr = (m, s) => 0;
    imports.blitz3d.GetSurfaceVertexStride = () => 11;

    imports.env.Animate = (ent, mode, speed, seq, trans) => {
      this.animationSystem.animate(ent, mode, speed, seq, trans);
    };

    imports.env.SetAnimTime = (ent, time, seq) => {
      this.animationSystem.setAnimTime(ent, time, seq);
    };

    imports.env.RenderWorld = (tween) => {
      // Validation before rendering
      if (!this.renderer) {
        if (this.frameCount % 60 === 0) {
          console.error("RenderWorld: renderer is null");
        }
        return;
      }
      if (!this.scene) {
        if (this.frameCount % 60 === 0) {
          console.error("RenderWorld: scene is null");
        }
        return;
      }
      if (!this.camera) {
        if (this.frameCount % 60 === 0) {
          console.error(
            "RenderWorld: camera is null - mesh will not be visible!",
          );
        }
        return;
      }

      // Verify camera aspect ratio
      if (isNaN(this.camera.aspect) || !isFinite(this.camera.aspect)) {
        if (this.frameCount % 60 === 0) {
          console.error(
            "RenderWorld: camera aspect is invalid: " + this.camera.aspect,
          );
          console.error(
            "Canvas dimensions: " + this.core.canvas.width + "x" +
            this.core.canvas.height,
          );
        }
        return;
      }

      // Verify renderer has render method
      if (typeof this.renderer.render !== "function") {
        if (this.frameCount % 60 === 0) {
          console.error("RenderWorld: renderer.render is not a function");
        }
        return;
      }

      // All checks passed, render
      this.updateSurfaces();
      try {
        this.renderer.render(this.scene, this.camera);
      } catch (e) {
        if (this.frameCount % 60 === 0) {
          console.error("RenderWorld: render failed: " + e.message);
        }
      }
    };

    imports.env.UpdateWorld = (elapsed) => { };

    // Camera/Light/Fog Stubs
    imports.env.AmbientLight = (r, g, b) => {
      if (this.ambientLight) {
        this.scene.remove(this.ambientLight);
      }
      this.ambientLight = new THREE.AmbientLight(
        new THREE.Color(r / 255.0, g / 255.0, b / 255.0),
      );
      this.scene.add(this.ambientLight);
    };
    imports.env.LightColor = (lightId, r, g, b) => {
      const light = this.entities[lightId];
      if (light && light.isLight) {
        light.color.setRGB(r / 255.0, g / 255.0, b / 255.0);
      }
    };
    imports.env.LightRange = (lightId, range) => {
      const light = this.entities[lightId];
      // PointLight and SpotLight have distance property
      if (light && (light.isPointLight || light.isSpotLight)) {
        light.distance = range;
      }
    };
    imports.env.CameraClsColor = (cam, r, g, b) => { };
    imports.env.CameraRange = (cam, near, far) => { };
    imports.env.CameraZoom = (cam, zoom) => { };
    imports.env.CameraProjMode = (cam, mode) => { };
    imports.env.CameraViewport = (cam, x, y, w, h) => { };
    imports.env.FogMode = (mode) => { };
    imports.env.FogColor = (r, g, b) => { };
    imports.env.FogRange = (near, far) => { };
    imports.env.FogDensity = (d) => { };

    // Primitives
    imports.env.CreateCube = (parent) => {
      const geometry = new THREE.BoxGeometry(2, 2, 2); // Blitz3D cubes are 2x2x2 by default centered at 0
      const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({ color: 0xffffff }),
      );
      const id = this.nextEntityId++;
      this.entities[id] = mesh;
      if (parent && this.entities[parent]) this.entities[parent].add(mesh);
      else this.scene.add(mesh);
      return id;
    };

    imports.env.CreateSphere = (parent, segs) => {
      const segments = segs || 16;
      const geometry = new THREE.SphereGeometry(1, segments, segments); // Radius 1
      const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({ color: 0xffffff }),
      );
      const id = this.nextEntityId++;
      this.entities[id] = mesh;
      if (parent && this.entities[parent]) this.entities[parent].add(mesh);
      else this.scene.add(mesh);
      return id;
    };

    imports.env.CreatePlane = (parent) => {
      const geometry = new THREE.PlaneGeometry(20, 20);
      const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({
          color: 0x888888,
          side: THREE.DoubleSide,
        }),
      );
      // Blitz3D planes lie on XZ; Three.js planes default to XY
      mesh.rotation.x = -Math.PI / 2;
      const id = this.nextEntityId++;
      this.entities[id] = mesh;
      if (parent && this.entities[parent]) this.entities[parent].add(mesh);
      else this.scene.add(mesh);
      return id;
    };

    // Brush/Material functions
    imports.env.CreateBrush = () => {
      const brush = {
        r: 255,
        g: 255,
        b: 255,
        alpha: 255,
        shininess: 0,
        texture: null,
      };
      const id = this.nextBrushId++;
      this.brushes[id] = brush;
      console.log("CreateBrush: ID=" + id);
      return id;
    };

    imports.env.LoadBrush = (pathPtr, flags, u_scale, v_scale) => {
      const brushId = imports.env.CreateBrush();
      const textureId = imports.env.LoadTexture(pathPtr, flags);
      if (textureId) {
        imports.env.BrushTexture(brushId, textureId, 0, 0);
        // Note: u_scale/v_scale ignored for now, would need ScaleTexture(textureId, u_scale, v_scale)
      }
      return brushId;
    };

    imports.env.BrushColor = (brushId, r, g, b) => {
      const brush = this.brushes[brushId];
      if (brush) {
        brush.r = r;
        brush.g = g;
        brush.b = b;
        console.log(
          "BrushColor: ID=" + brushId + " RGB(" + r + "," + g + "," + b + ")",
        );
      }
    };

    imports.env.BrushAlpha = (brushId, alpha) => {
      const brush = this.brushes[brushId];
      if (brush) {
        brush.alpha = alpha;
        console.log("BrushAlpha: ID=" + brushId + " alpha=" + alpha);
      }
    };

    imports.env.BrushShininess = (brushId, shininess) => {
      const brush = this.brushes[brushId];
      if (brush) {
        brush.shininess = shininess;
        console.log(
          "BrushShininess: ID=" + brushId + " shininess=" + shininess,
        );
      }
    };

    imports.env.BrushTexture = (brushId, textureId, frame, index) => {
      const brush = this.brushes[brushId];
      if (brush) {
        brush.texture = textureId;
        brush.textureFrame = frame || 0;
        brush.textureIndex = index || 0;
        console.log(
          "BrushTexture: brushId=" + brushId + " textureId=" + textureId,
        );
      }
    };

    imports.env.GetBrushTexture = (brushId, index) => {
      const brush = this.brushes[brushId];
      if (brush) {
        if (index && index !== 0) {
          console.warn(
            "GetBrushTexture: only primary texture supported, index=" + index,
          );
        }
        return brush.texture || 0;
      }
      return 0;
    };

    imports.env.BrushFX = (brushId, fx) => {
      const brush = this.brushes[brushId];
      if (brush) {
        brush.fx = fx;
        console.log("BrushFX: brushId=" + brushId + " fx=" + fx);
      }
    };

    imports.env.BrushBlend = (brushId, blend) => {
      const brush = this.brushes[brushId];
      if (brush) {
        brush.blend = blend;
        console.log("BrushBlend: brushId=" + brushId + " blend=" + blend);
      }
    };

    imports.env.FreeBrush = (brushId) => {
      delete this.brushes[brushId];
      console.log("FreeBrush: brushId=" + brushId);
    };

    imports.env.GetEntityBrush = (ent) => {
      // Stub: return a default brush
      return 1;
    };

    imports.env.PaintMesh = (meshId, brushId) => {
      const mesh = this.entities[meshId];
      if (mesh && mesh.mesh) {
        // Apply brush properties to mesh material
        console.log("PaintMesh: meshId=" + meshId + " brushId=" + brushId);
      }
    };

    imports.env.GetSurfaceBrush = (surfaceId) => {
      const surface = this.surfaces[surfaceId];
      return surface && surface.brushId ? surface.brushId : 0;
    };

    imports.env.PaintSurface = (surfaceId, brushId) => {
      console.log(
        "PaintSurface: surfaceId=" + surfaceId + " brushId=" + brushId,
      );
      const surface = this.surfaces[surfaceId];
      if (surface) {
        surface.brushId = brushId;
      }
    };

    imports.env.TextureWidth = (textureId) => {
      const texture = this.textures[textureId];
      return texture ? (texture.image?.width || 256) : 256;
    };

    imports.env.TextureHeight = (textureId) => {
      const texture = this.textures[textureId];
      return texture ? (texture.image?.height || 256) : 256;
    };

    imports.env.TextureName = (textureId) => {
      const texture = this.textures[textureId];
      return texture ? this.core.allocString(texture.name || "") : 0;
    };

    imports.env.FreeTexture = (textureId) => {
      const tex = this.textures[textureId];
      if (tex) {
        try {
          this.detachTextureFromScene(tex);
        } catch { }
        try {
          tex.dispose?.();
        } catch { }
      }
      delete this.textures[textureId];
      console.log("FreeTexture: textureId=" + textureId);
    };

    imports.env.TextureBlend = (textureId, blend) => {
      console.log("TextureBlend: textureId=" + textureId + " blend=" + blend);
    };

    imports.env.TextureCoords = (textureId, coords) => {
      console.log(
        "TextureCoords: textureId=" + textureId + " coords=" + coords,
      );
    };

    imports.env.ScaleTexture = (textureId, uScale, vScale) => {
      console.log(
        "ScaleTexture: textureId=" + textureId + " uScale=" + uScale +
        " vScale=" + vScale,
      );
    };

    imports.env.PositionTexture = (textureId, u, v) => {
      console.log(
        "PositionTexture: textureId=" + textureId + " u=" + u + " v=" + v,
      );
    };

    imports.env.RotateTexture = (textureId, angle) => {
      console.log("RotateTexture: textureId=" + textureId + " angle=" + angle);
    };

    // Store last transformed coordinates
    this.tformedX = 0;
    this.tformedY = 0;
    this.tformedZ = 0;

    imports.env.TFormVector = (x, y, z, srcEntity, destEntity) => {
      // Transform vector from src to dest coordinate space
      // For now, just store the input (TODO: proper transformation)
      this.tformedX = x;
      this.tformedY = y;
      this.tformedZ = z;
    };

    imports.env.TFormPoint = (x, y, z, srcEntity, destEntity) => {
      // Transform point from src to dest coordinate space
      // For now, just store the input (TODO: proper transformation)
      this.tformedX = x;
      this.tformedY = y;
      this.tformedZ = z;
    };

    imports.env.TFormNormal = (x, y, z, srcEntity, destEntity) => {
      // Transform normal from src to dest coordinate space
      // For now, just store the input (TODO: proper transformation)
      this.tformedX = x;
      this.tformedY = y;
      this.tformedZ = z;
    };

    imports.env.TFormedX = () => this.tformedX;
    imports.env.TFormedY = () => this.tformedY;
    imports.env.TFormedZ = () => this.tformedZ;

    imports.env.Graphics3D = (width, height, depth, mode) => {
      console.log(`Graphics3D: ${width}x${height} depth=${depth} mode=${mode}`);
      // Already initialized in init3D
    };

    imports.env.AddEntity = (entityId, parentId) => {
      const entity = this.entities[entityId];
      const parent = this.entities[parentId];
      if (entity && parent) {
        parent.add(entity);
      }
    };

    imports.env.CreatePivot = (parentId) => {
      const pivot = new THREE.Object3D();
      const id = this.nextEntityId++;
      this.entities[id] = pivot;

      if (parentId && this.entities[parentId]) {
        this.entities[parentId].add(pivot);
      } else if (this.scene) {
        this.scene.add(pivot);
      } else {
        console.warn("CreatePivot: scene not initialized; calling init3D");
        this.init3D();
        if (this.scene) {
          this.scene.add(pivot);
        } else {
          console.warn(
            "CreatePivot: scene still not initialized; deferring add",
            { id, parentId },
          );
        }
      }

      console.log("CreatePivot: id=" + id + " parent=" + parentId);
      return id;
    };

    // Sprite Functions
    imports.env.CreateSprite = (parentId) => {
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ color: 0xffffff }),
      );
      const id = this.nextEntityId++;
      this.entities[id] = sprite;

      if (parentId && this.entities[parentId]) {
        this.entities[parentId].add(sprite);
      } else {
        this.scene.add(sprite);
      }

      return id;
    };

    imports.env.ScaleSprite = (spriteId, xScale, yScale) => {
      const sprite = this.entities[spriteId];
      if (sprite) {
        sprite.scale.set(xScale, yScale, 1);
      }
    };

    imports.env.SpriteViewMode = (spriteId, mode) => {
      // Mode: 1=fixed, 2=free, 3=billboard
      console.log(`SpriteViewMode: sprite=${spriteId} mode=${mode}`);
    };

    // Extended Entity Functions
    imports.env.TranslateEntity = (entityId, x, y, z) => {
      const entity = this.entities[entityId];
      if (entity) {
        entity.translateX(x);
        entity.translateY(y);
        entity.translateZ(z);
      }
    };

    imports.env.EntityAlpha = (entityId, alpha) => {
      const entity = this.entities[entityId];
      if (entity && entity.material) {
        entity.material.opacity = alpha;
        entity.material.transparent = alpha < 1.0;
      }
    };

    imports.env.EntityColor = (entityId, r, g, b) => {
      const entity = this.entities[entityId];
      if (entity && entity.material) {
        entity.material.color.setRGB(r / 255, g / 255, b / 255);
      }
    };

    imports.env.EntityShininess = (entityId, shininess) => {
      const entity = this.entities[entityId];
      if (entity && entity.material) {
        entity.material.shininess = shininess;
      }
    };

    imports.env.EntityFX = (entityId, fx) => {
      // FX flags: 1=full-bright, 2=vertical gradient, etc.
      console.log(`EntityFX: entity=${entityId} fx=${fx}`);
    };

    imports.env.EntityBlend = (entityId, blend) => {
      const entity = this.entities[entityId];
      if (entity && entity.material) {
        // 0=solid, 1=alpha, 2=multiply, 3=add
        if (blend === 3) {
          entity.material.blending = THREE.AdditiveBlending;
        } else if (blend === 2) {
          entity.material.blending = THREE.MultiplyBlending;
        } else {
          entity.material.blending = THREE.NormalBlending;
        }
      }
    };

    imports.env.EntityParent = (entityId, parentId, global) => {
      const entity = this.entities[entityId];
      const parent = this.entities[parentId];
      if (entity && parent) {
        parent.add(entity);
      }
    };

    imports.env.EntityClass = (entityId) => {
      const ent = this.entities[entityId];
      if (!ent) return 0;
      let cls = "Object";
      if (ent.isMesh) cls = "Mesh";
      else if (ent.isCamera) cls = "Camera";
      else if (ent.isLight) cls = "Light";
      else if (ent.isSprite) cls = "Sprite";
      else if (ent.type === "Object3D") cls = "Pivot";

      return this.core.allocString(cls);
    };

    imports.env.HideEntity = (entityId) => {
      const entity = this.entities[entityId];
      if (entity) {
        entity.visible = false;
      }
    };

    imports.env.ShowEntity = (entityId) => {
      const entity = this.entities[entityId];
      if (entity) {
        entity.visible = true;
      }
    };

    imports.env.EntityVisible = (entityId, targetId) => {
      // Check if entity is visible from target (basic frustum check)
      return 1; // Stub: always visible
    };

    imports.env.EntityInView = (entityId, cameraId) => {
      // Check if entity is in camera view
      return 1; // Stub: always in view
    };

    imports.env.CopyEntity = (entityId, parentId) => {
      const entity = this.entities[entityId];
      if (entity) {
        const clone = entity.clone();
        clone.traverse?.((obj: any) => {
          if (obj?.isMesh || obj?.isSprite) {
            if (obj.geometry?.clone) {
              try {
                obj.geometry = obj.geometry.clone();
              } catch { }
            }
            if (obj.material) {
              if (Array.isArray(obj.material)) {
                obj.material = obj.material.map((m: any) => {
                  if (!m?.clone) return m;
                  const cm = m.clone();
                  cm.userData = {
                    ...(cm.userData || {}),
                    __blitz3dUnique: true,
                  };
                  return cm;
                });
              } else if (obj.material?.clone) {
                const cm = obj.material.clone();
                cm.userData = { ...(cm.userData || {}), __blitz3dUnique: true };
                obj.material = cm;
              }
            }
          }
        });
        const id = this.nextEntityId++;
        this.entities[id] = clone;

        if (parentId && this.entities[parentId]) {
          this.entities[parentId].add(clone);
        } else {
          this.scene.add(clone);
        }

        return id;
      }
      return 0;
    };

    imports.env.NameEntity = (entityId, namePtr) => {
      const entity = this.entities[entityId];
      if (entity) {
        entity.name = this.core.readString(namePtr);
      }
    };

    imports.env.EntityName = (entityId) => {
      const entity = this.entities[entityId];
      if (entity && entity.name) {
        return this.core.allocString(entity.name);
      }
      return 0;
    };

    imports.env.GetParent = (entityId) => {
      const entity = this.entities[entityId];
      if (entity && entity.parent) {
        // Find ID of parent
        for (const id in this.entities) {
          if (this.entities[id] === entity.parent) return parseInt(id);
        }
      }
      return 0;
    };

    imports.env.CountChildren = (entityId) => {
      const entity = this.entities[entityId];
      return entity ? entity.children.length : 0;
    };

    imports.env.GetChild = (entityId, index) => {
      const entity = this.entities[entityId];
      if (entity && index >= 1 && index <= entity.children.length) {
        const child = entity.children[index - 1];
        for (const id in this.entities) {
          if (this.entities[id] === child) return parseInt(id);
        }
      }
      return 0;
    };

    imports.env.FindChild = (entityId, namePtr) => {
      const entity = this.entities[entityId];
      const name = this.core.readString(namePtr).toLowerCase();
      if (entity) {
        const child = entity.getObjectByName(name);
        if (child) {
          for (const id in this.entities) {
            if (this.entities[id] === child) return parseInt(id);
          }
        }
      }
      return 0;
    };

    imports.env.Kill = (entityId) => {
      const entity = this.entities[entityId];
      if (entity) {
        if (entity.parent) {
          entity.parent.remove(entity);
        }
        delete this.entities[entityId];
      }
    };

    // Particle System
    this.particles = [];

    imports.env.CreateParticle = (x, y, z, image, size, gravity, lifetime) => {
      const particle = {
        id: this.nextEntityId++,
        x,
        y,
        z,
        image,
        size,
        gravity,
        lifetime,
        timer: 0,
      };
      this.particles.push(particle);

      // Create a sprite for the particle with bright color
      const material = new THREE.SpriteMaterial({
        color: 0xff0000, // Bright red so it's visible
        sizeAttenuation: false,
        transparent: true,
        opacity: 0.8,
      });
      const sprite = new THREE.Sprite(material);
      sprite.position.set(x, y, z);
      sprite.scale.set(size * 0.05, size * 0.05, 1); // Small particle dots
      this.scene.add(sprite);
      this.entities[particle.id] = sprite;

      console.log(
        `CreateParticle: id=${particle.id} pos=(${x},${y},${z}) size=${size}`,
      );

      return particle.id;
    };

    imports.env.UpdateParticles = () => {
      // Update all particles
      this.particles = this.particles.filter((p) => {
        p.timer += 1;
        if (p.timer > p.lifetime) return false;

        const sprite = this.entities[p.id];
        if (sprite) {
          sprite.position.y -= p.gravity;
        }
        return true;
      });
    };

    imports.env.RemoveParticle = (particleId) => {
      const index = this.particles.findIndex((p) => p.id === particleId);
      if (index !== -1) {
        this.particles.splice(index, 1);
        const sprite = this.entities[particleId];
        if (sprite) {
          this.scene.remove(sprite);
          delete this.entities[particleId];
        }
      }
    };

    imports.env.ParticleTextures = (minImage, maxImage, flags) => {
      console.log(
        `ParticleTextures: min=${minImage} max=${maxImage} flags=${flags}`,
      );
      return 1;
    };

    // Devil Particle System (DLL wrapper)
    this.emitters = {};

    imports.env.SetEmitter = (entityId, emitterId) => {
      console.log(`SetEmitter: entity=${entityId} emitter=${emitterId}`);
      this.emitters[emitterId] = { entity: entityId };
      return emitterId;
    };

    imports.env.UpdateEmitters = (roomId) => {
      // Update all emitters
      console.log(`UpdateEmitters: room=${roomId}`);
    };

    imports.env.DeleteDevilEmitters = () => {
      this.emitters = {};
    };

    imports.env.UpdateDevilEmitters = () => {
      // Update devil particle emitters
    };

    // Decal System
    this.decals = [];

    imports.env.CreateDecal = (
      id,
      x,
      y,
      z,
      pitch,
      yaw,
      roll,
      scale,
      meshId,
    ) => {
      const decal = {
        id: this.nextEntityId++,
        type: id,
        x,
        y,
        z,
        pitch,
        yaw,
        roll,
        scale,
        mesh: meshId,
      };
      this.decals.push(decal);

      // Create a plane mesh for the decal
      const geometry = new THREE.PlaneGeometry(scale, scale);
      const material = new THREE.MeshBasicMaterial({
        color: 0xff0000,
        transparent: true,
        opacity: 0.5,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      mesh.rotation.set(
        pitch * Math.PI / 180,
        yaw * Math.PI / 180,
        roll * Math.PI / 180,
      );
      this.scene.add(mesh);
      this.entities[decal.id] = mesh;

      return decal.id;
    };

    imports.env.UpdateDecals = () => {
      // Update/fade decals over time
    };

    // Game-Specific Functions
    imports.env.GiveAchievement = (achievementId) => {
      console.log(`[Achievement] Unlocked: ${achievementId}`);
    };

    imports.env.Update294 = () => {
      // Update SCP-294 (coffee machine) logic
    };

    imports.env.UpdateItems = () => {
      // Update all items in the game
    };

    imports.env.PickItem = (itemId) => {
      console.log(`PickItem: ${itemId}`);
    };

    imports.env.DropItem = (itemId) => {
      console.log(`DropItem: ${itemId}`);
    };

    imports.env.AnimateNPC = (
      npcId,
      startFrame,
      endFrame,
      speed,
      loop,
      transition,
    ) => {
      console.log(`AnimateNPC: ${npcId} frames=${startFrame}-${endFrame}`);
    };

    imports.env.Animate2 = (
      entityId,
      currentFrame,
      startFrame,
      endFrame,
      speed,
      loopFlag,
    ) => {
      // Stub: advance frame within [startFrame, endFrame] and wrap/stop based on loopFlag
      const delta = speed;
      let next = currentFrame + delta;
      const minF = Math.min(startFrame, endFrame);
      const maxF = Math.max(startFrame, endFrame);
      const ascending = endFrame >= startFrame;
      if (ascending) {
        if (next > maxF) {
          next = loopFlag ? startFrame : maxF;
        }
      } else {
        if (next < minF) {
          next = loopFlag ? startFrame : minF;
        }
      }
      return next;
    };

    imports.env.ChangeNPCTextureID = (npcId, textureId) => {
      console.log(`ChangeNPCTextureID: npc=${npcId} texture=${textureId}`);
    };

    imports.env.CheckForNPCInFacility = (npcType) => {
      console.log(`CheckForNPCInFacility: type=${npcType}`);
      return 0; // No NPC found
    };

    imports.env.Console_SpawnNPC = (npcType) => {
      console.log(`Console_SpawnNPC: type=${npcType}`);
    };

    imports.env.CreateConsoleMsg = (msgPtr) => {
      const msg = this.core.readString(msgPtr);
      console.log(`[Console] ${msg}`);
    };

    imports.env.UseDoor = (doorId, showMsg = 1, playSfx = 1) => {
      console.log(
        `UseDoor: door=${doorId} showMsg=${showMsg} playSfx=${playSfx}`,
      );
    };

    imports.env.SetNPCFrame = (npcId, frame) => {
      console.log(`SetNPCFrame: npc=${npcId} frame=${frame}`);
    };

    imports.env.CreateNPC = (npcType, x, y, z) => {
      console.log(`CreateNPC: type=${npcType} at (${x}, ${y}, ${z})`);
      return 0;
    };

    imports.env.RemoveNPC = (npcId) => {
      console.log(`RemoveNPC: npc=${npcId}`);
    };

    imports.env.FindPath = (npcId, x, y, z) => {
      console.log(`FindPath: npc=${npcId} target=(${x}, ${y}, ${z})`);
      return 0;
    };

    imports.env.PointEntity = (entityId, targetId) => {
      console.log(`PointEntity: entity=${entityId} target=${targetId}`);
    };

    imports.env.CreateEmitter = (x, y, z, emitterType) => {
      console.log(`CreateEmitter: pos=(${x}, ${y}, ${z}) type=${emitterType}`);
      return 0;
    };

    imports.env.ChangeAngleValueForCorrectBoneAssigning = (angle) => {
      // Adjust angle for bone animations
      return angle;
    };

    const updateFog = () => {
      if (!this.scene) return;
      const s = this.fogState;
      // Blitz3D colors are 0-255
      const color = new THREE.Color(s.r / 255.0, s.g / 255.0, s.b / 255.0);

      if (s.mode === 0) {
        this.scene.fog = null;
      } else if (s.mode === 1) { // Linear
        if (this.scene.fog && (this.scene.fog as any).isFog) {
          const f = this.scene.fog as THREE.Fog;
          f.color.copy(color);
          f.near = s.near;
          f.far = s.far;
        } else {
          this.scene.fog = new THREE.Fog(color, s.near, s.far);
        }
      } else { // Exponential (Mode 2 or others)
        if (this.scene.fog && (this.scene.fog as any).isFogExp2) {
          const f = this.scene.fog as THREE.FogExp2;
          f.color.copy(color);
          f.density = s.density;
        } else {
          this.scene.fog = new THREE.FogExp2(color, s.density);
        }
      }
    };

    imports.env.CameraFogRange = (cameraId, near, far) => {
      this.fogState.near = near;
      this.fogState.far = far;
      this.fogState.mode = 1; // Implicitly switch to Linear? Or just update params? Blitz docs imply Mode sets the type.
      updateFog();
    };

    imports.env.CameraFogColor = (cameraId, r, g, b) => {
      this.fogState.r = r;
      this.fogState.g = g;
      this.fogState.b = b;
      updateFog();
    };

    imports.env.CameraFogMode = (cameraId, mode) => {
      this.fogState.mode = mode;
      updateFog();
    };

    imports.env.CameraFogDensity = (cameraId, d) => {
      this.fogState.density = d;
      updateFog();
    };

    imports.env.DrawLoading = (percent, shortLoading = 0) => {
      console.log(`DrawLoading: ${percent}% short=${shortLoading}`);
    };

    imports.env.sky_CreateSky = (filenamePtr, parent = 0) => {
      const name = this.core.readString(filenamePtr);
      console.log(`sky_CreateSky: base=${name} parent=${parent}`);
      return 0;
    };

    imports.env.UpdateSky = () => {
      // Stub; real impl would position sky to camera
    };

    imports.env.LoadSprite = (pathPtr, flags) => {
      const path = this.core.readString(pathPtr);
      console.log(`LoadSprite: ${path} flags=${flags}`);
      return 0;
    };

    imports.env.ScaleMesh = (meshId, sx, sy, sz) => {
      console.log(`ScaleMesh: mesh=${meshId} scale=(${sx},${sy},${sz})`);
    };

    // SCPCB imports that may be called frequently; keep as cheap no-ops unless implemented.
    imports.env.FlipMesh = (..._args: any[]) => { };
    imports.env.MeshCullBox = (..._args: any[]) => { };
    imports.env.LightConeAngles = (..._args: any[]) => { };

    imports.env.HideChunks = () => {
      console.log("HideChunks");
    };

    imports.env.UpdateEndings = () => {
      console.log("UpdateEndings");
    };

    // Geometry/Math Helpers
    imports.env.AlignToVector = (entityId, vx, vy, vz, axis, rate) => {
      // Align entity to vector over time
      console.log(`AlignToVector: entity=${entityId} vec=(${vx},${vy},${vz})`);
    };

    imports.env.CurveAngle = (currentAngle, targetAngle, speed) => {
      // Smooth angle interpolation (already in core.js)
      let delta = targetAngle - currentAngle;
      while (delta > 180) delta -= 360;
      while (delta < -180) delta += 360;
      return currentAngle + delta * speed;
    };

    // Camera Functions
    imports.env.CameraProject = (cameraId, x, y, z) => {
      // Project 3D position to 2D screen coordinates
      console.log(`CameraProject: camera=${cameraId} pos=(${x},${y},${z})`);
    };

    imports.env.PaintEntity = (entityId, brushId) => {
      const entity = this.entities[entityId];
      const brush = this.brushes[brushId];
      if (entity && brush) {
        const color = (brush.r << 16) | (brush.g << 8) | brush.b;
        const opacity = brush.alpha / 255;

        // Create material based on brush properties
        let material;
        if (brush.shininess > 0) {
          // Use Phong material for shininess
          material = new THREE.MeshPhongMaterial({
            color: color,
            transparent: opacity < 1,
            opacity: opacity,
            shininess: brush.shininess,
            specular: 0x444444,
          });
        } else {
          // Use basic material
          material = new THREE.MeshBasicMaterial({
            color: color,
            transparent: opacity < 1,
            opacity: opacity,
          });
        }

        // Apply material to entity and all children
        entity.traverse((child) => {
          if (child.isMesh) {
            child.material = material;
          }
        });

        // Store brush reference for debugging
        entity.userData.brushId = brushId;

        console.log(
          "PaintEntity: Entity=" + entityId + " Brush=" + brushId +
          " Color=0x" + color.toString(16).padStart(6, "0"),
        );
      }
    };

    // Texture/Assets
    imports.env.LoadTexture = (pathPtr, flags) => {
      const path = this.core.readString(pathPtr);
      console.log("Loading Texture:", path);

      // Create a small placeholder texture immediately
      const placeholder = new THREE.DataTexture(
        new Uint8Array([255, 0, 255, 255]),
        1,
        1,
        THREE.RGBAFormat,
      );
      placeholder.needsUpdate = true;
      placeholder.name = path;

      const id = this.nextTextureId++;
      this.textures[id] = placeholder;

      // Load actual texture async
      const loader = new THREE.TextureLoader();
      loader.load(
        path,
        (tex) => {
          console.log(`[TextureLoader] Loaded ${path}`);
          // Handle flags
          if (flags & 2) tex.format = THREE.RGBAFormat;
          tex.name = path;

          // Texture was freed before load completed
          if (!this.textures[id]) {
            try {
              tex.dispose?.();
            } catch { }
            try {
              placeholder.dispose?.();
            } catch { }
            return;
          }

          // Swap placeholder with actual texture if placeholder still active
          const current = this.textures[id];
          this.textures[id] = tex;

          // If any materials are using the placeholder, they need to be notified
          this.scene?.traverse((obj: any) => {
            if (obj.material) {
              const mats = Array.isArray(obj.material)
                ? obj.material
                : [obj.material];
              mats.forEach((m: any) => {
                if (m.map === placeholder) m.map = tex;
                m.needsUpdate = true;
              });
            }
          });

          if (current === placeholder) {
            try {
              placeholder.dispose?.();
            } catch { }
          }
        },
        undefined,
        (err) => {
          console.error(`[TextureLoader] Error ${path}:`, err);
        },
      );

      return id;
    };

    imports.env.LoadTexture_Strict = (pathPtr, flags) => {
      return imports.env.LoadTexture(pathPtr, flags);
    };

    imports.env.LoadAsset = (pathPtr) => 0;
    imports.env.GetAssetData = (handle) => 0;
    imports.env.GetAssetSize = (handle) => 0;

    imports.env.AnimTime = (ent) => 0.0;
    imports.env.AnimLength = (ent) => 0.0;
    imports.env.ExtractAnimSeq = (ent, first, last) => 0;
    imports.env.AddAnimSeq = (ent, len) => 0;
    imports.env.AnimSeq = (ent) => 0;
    imports.env.Animating = (ent) => 0;
    imports.env.Delay = (ms) => { };
    imports.env.WaitKey = () => 0;

    // Movie Playback Functions (for SCP:CB intro videos)
    this.movies = new Map();
    this.nextMovieId = 1;

    imports.env.OpenMovie = (pathPtr) => {
      const path = this.core.readString(pathPtr);
      const id = this.nextMovieId++;

      const video = document.createElement("video");
      video.src = path;
      video.crossOrigin = "anonymous";
      video.muted = true; // Start muted for autoplay
      video.playsInline = true;

      this.movies.set(id, {
        path: path,
        video: video,
        x: 0,
        y: 0,
        width: 800,
        height: 600,
        playing: false,
      });

      console.log("OpenMovie: " + path + " (id=" + id + ")");
      return id;
    };

    imports.env.DrawMovie = (movieId, x, y, width, height) => {
      const movie = this.movies.get(movieId);
      if (movie) {
        movie.x = x;
        movie.y = y;
        movie.width = width;
        movie.height = height;

        // Store for rendering in update()
        movie.shouldRender = true;
      }
    };

    imports.env.MoviePlaying = (movieId) => {
      const movie = this.movies.get(movieId);
      if (movie && movie.video) {
        return (!movie.video.paused && !movie.video.ended) ? 1 : 0;
      }
      return 0;
    };

    // Override renderWorld to draw movies
    const originalRenderWorld = imports.env.RenderWorld;
    imports.env.RenderWorld = (interp) => {
      // First render 3D scene
      if (this.renderer && this.scene && this.camera) {
        this.renderer.setClearColor(0x000000, 1);
        this.renderer.clear();
        this.renderer.render(this.scene, this.camera);
      }

      // Then render movies on top
      for (const [id, movie] of this.movies) {
        if (movie.shouldRender && movie.video && movie.video.readyState >= 2) {
          this.drawMovieFrame(movie);
        }
      }
    };

    this.drawMovieFrame = (movie) => {
      if (
        !this.core.ctx2d || !movie.video || movie.video.paused ||
        movie.video.ended
      ) return;

      // Draw video frame to 2D canvas
      this.core.ctx2d.globalAlpha = 1.0;
      this.core.ctx2d.drawImage(
        movie.video,
        movie.x,
        movie.y,
        movie.width,
        movie.height,
      );
    };

    // Start playing movie when opened
    const originalStreamPlay = imports.env.FSOUND_Stream_Play;
    imports.env.FSOUND_Stream_Play = (channel, streamId) => {
      // Check if this is actually a movie
      const movie = this.movies.get(streamId);
      if (movie && movie.video) {
        movie.video.play().then(() => {
          movie.playing = true;
          console.log("Movie started: " + movie.path);
        }).catch((e) => {
          console.error("Failed to play movie: " + e);
        });
        return streamId;
      }
      // Otherwise, use original audio stream logic
      if (originalStreamPlay) return originalStreamPlay(channel, streamId);
      return 0;
    };

    this._cmdTextDecoder = new TextDecoder("latin1");
  }

  drainCommandBuffer() {
    const mem: WebAssembly.Memory | null = this.core?.memory ?? null;
    const ptr: number = (this.core as any)?.cmdBufPtr ?? 0;
    const bytes: number = (this.core as any)?.cmdBufBytes ?? 0;
    if (!mem || !ptr || !bytes) return 0;

    // IMPORTANT: memory.buffer can change on grow; create a fresh DataView each drain.
    if (ptr + bytes > mem.buffer.byteLength) {
      console.warn("[CMDB] ptr/len out of bounds; skipping drain");
      return 0;
    }
    const dv = new DataView(mem.buffer, ptr, bytes);

    const exec = {
      onCreateEntity: (entityType: number, parent: number, id: number) => {
        // Minimal v1: treat all create requests as a generic Object3D root.
        const root = new THREE.Group();
        root.name = `cmdb_${entityType}`;
        this.entities[id] = root;
        root.userData.entityId = id;
        if (typeof id === "number" && id >= this.nextEntityId) this.nextEntityId = (id + 1) | 0;

        if (parent) {
          const p = this.entities[parent];
          p?.add?.(root);
        } else {
          this.scene?.add?.(root);
        }
      },
      onDestroyEntity: (id: number) => {
        const ent = this.entities[id];
        if (!ent) return;
        try {
          this.disposeEntity(ent);
        } catch { }
        delete this.entities[id];
      },
      onSetTransform: (id: number, pos, rot, scl) => {
        const ent = this.entities[id];
        if (this.core.entityTable) {
          this.core.entityTable.setX(id, pos[0]);
          this.core.entityTable.setY(id, pos[1]);
          this.core.entityTable.setZ(id, pos[2]);
          this.core.entityTable.setScaleX(id, scl[0]);
          this.core.entityTable.setScaleY(id, scl[1]);
          this.core.entityTable.setScaleZ(id, scl[2]);
        }
        if (!ent) return;
        try {
          // Blitz3D -> Three: negate Z (left-handed -> right-handed).
          ent.position.set(pos[0], pos[1], -pos[2]);
          ent.quaternion.set(rot[0], rot[1], rot[2], rot[3]);
          ent.scale.set(scl[0], scl[1], scl[2]);

          if (this.core.entityTable) {
            this.core.entityTable.setPitch(id, ent.rotation.x * 180 / Math.PI);
            this.core.entityTable.setYaw(id, ent.rotation.y * 180 / Math.PI);
            this.core.entityTable.setRoll(id, ent.rotation.z * 180 / Math.PI);
          }
        } catch { }
      },
      onSetPosition: (id: number, x: number, y: number, z: number) => {
        const ent = this.entities[id];
        if (this.core.entityTable) {
          this.core.entityTable.setX(id, x);
          this.core.entityTable.setY(id, y);
          this.core.entityTable.setZ(id, z);
        }
        if (!ent) return;
        try {
          ent.position.set(x, y, -z);
        } catch { }
      },
      onSetRotationEuler: (id: number, pitch: number, yaw: number, roll: number, _global: number) => {
        const ent = this.entities[id];
        if (this.core.entityTable) {
          this.core.entityTable.setPitch(id, pitch);
          this.core.entityTable.setYaw(id, yaw);
          this.core.entityTable.setRoll(id, roll);
        }
        if (!ent) return;
        try {
          ent.rotation.set(
            (pitch * Math.PI) / 180,
            (yaw * Math.PI) / 180,
            (roll * Math.PI) / 180,
          );
        } catch { }
      },
      onSetScale: (id: number, x: number, y: number, z: number) => {
        const ent = this.entities[id];
        if (this.core.entityTable) {
          this.core.entityTable.setScaleX(id, x);
          this.core.entityTable.setScaleY(id, y);
          this.core.entityTable.setScaleZ(id, z);
        }
        if (!ent) return;
        try {
          ent.scale.set(x, y, z);
        } catch { }
      },
      onMoveEntity: (id: number, x: number, y: number, z: number) => {
        const ent = this.entities[id];
        if (!ent) return;
        try {
          ent.translateX(x);
          ent.translateY(y);
          ent.translateZ(-z);
          if (this.core.entityTable) {
            this.core.entityTable.setX(id, ent.position.x);
            this.core.entityTable.setY(id, ent.position.y);
            this.core.entityTable.setZ(id, -ent.position.z);
          }
        } catch { }
      },
      onTurnEntity: (id: number, pitch: number, yaw: number, roll: number, _global: number) => {
        const ent = this.entities[id];
        if (!ent) return;
        try {
          ent.rotateX((pitch * Math.PI) / 180);
          ent.rotateY((yaw * Math.PI) / 180);
          ent.rotateZ((roll * Math.PI) / 180);
          if (this.core.entityTable) {
            this.core.entityTable.setPitch(id, ent.rotation.x * 180 / Math.PI);
            this.core.entityTable.setYaw(id, ent.rotation.y * 180 / Math.PI);
            this.core.entityTable.setRoll(id, ent.rotation.z * 180 / Math.PI);
          }
        } catch { }
      },
      onSetParent: (id: number, parentId: number, global: number) => {
        const ent = this.entities[id];
        if (!ent) return;
        const parent = parentId ? this.entities[parentId] : this.scene;
        if (!parent) return;
        try {
          if (global && typeof (parent as any).attach === "function") {
            // Preserve world transform.
            (parent as any).attach(ent);
          } else {
            parent.add(ent);
          }
        } catch { }
      },
      onSetVisibility: (id: number, visible: number) => {
        const ent = this.entities[id];
        if (!ent) return;
        try {
          ent.visible = !!visible;
        } catch { }
      },
      onSetMaterial: (id: number, materialId: number) => {
        const ent = this.entities[id];
        if (!ent) return;
        // v1: map a small set of material ids to basic materials. This will evolve into a
        // material cache created from WASM-side brush/material definitions.
        let mat: any = undefined;
        if (materialId === 0) mat = new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide });
        else if (materialId === 1) mat = new THREE.MeshStandardMaterial({ color: 0x777777, side: THREE.DoubleSide });
        else if (materialId === 2) mat = new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.5 });
        else mat = new THREE.MeshStandardMaterial({ color: 0xff00ff, side: THREE.DoubleSide });
        try {
          ent.traverse?.((child: any) => {
            if (child && child.isMesh) child.material = mat;
          });
        } catch { }
      },
      onPlaySound: (soundId: number, volume: number, loop: number, outChannelPtr?: number) => {
        if (!this.audioSystem) return;
        try {
          const ch = this.audioSystem.playSound(soundId, volume, 0, 1, !!loop);
          if (outChannelPtr) {
            const mem0: WebAssembly.Memory | null = (this.core as any)?.memory ?? null;
            if (mem0 && outChannelPtr + 4 <= mem0.buffer.byteLength) {
              new DataView(mem0.buffer).setInt32(outChannelPtr, ch, true);
            }
          }
        } catch (e) {
          console.warn("[CMDB] PlaySound failed:", e);
        }
      },
      onDebugLogPtrLen: (p: number, len: number) => {
        if (!mem) return;
        const start = p >>> 0;
        const end = (start + (len >>> 0)) >>> 0;
        if (end > mem.buffer.byteLength) return;
        try {
          const u8 = new Uint8Array(mem.buffer, start, len >>> 0);
          const msg = this._cmdTextDecoder.decode(u8);
          console.log(`[CMDB] ${msg}`);
        } catch { }
      },
      onLoadMesh: (id: number, parent: number, pathPtr: number) => {
        const rawPath = this.core.readString(pathPtr);
        const path = rawPath.replace(/\.(b3d|x|rmesh)$/i, ".smpk");
        // Placeholder
        const mesh = new THREE.Mesh();
        mesh.material = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true });
        mesh.name = rawPath;

        this.entities[id] = mesh;
        if (parent && this.entities[parent]) this.entities[parent].add(mesh);
        else this.scene?.add(mesh);

        // Async load
        this.animationSystem.loadAnimMesh(path, parent, id) /* pass ID if updated */
          .then(() => {
            // The shared loader logic might need tweaking to *replace* the entity at ID, 
            // or we handle the swap here if loadAnimMesh returns a new object. 
            // ACTUALLY: loadAnimMesh currently creates a NEW entity via CreateMesh. 
            // We need to refactor or just accept that for now we might have a placeholder + real mesh?
            // Better: Update loadAnimMesh to accept targetID or use the placeholder.
            // For V1 of ABI, we'll assume loadAnimMesh can identify the entity by name or we patch it.
            // Let's rely on the fact that existing logic handles parenting.
          })
          .catch((e: any) => console.error(`[CMDB] LoadMesh failed: ${e}`));
      },
      // ... (We will implement other handlers in a second pass if this block is too big)
      onLoadAnimMesh: (id: number, parent: number, pathPtr: number) => {
        const rawPath = this.core.readString(pathPtr);
        const path = rawPath.replace(/\.(b3d|x|rmesh)$/i, ".smpk");
        const mesh = new THREE.Mesh();
        mesh.material = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true });
        mesh.name = rawPath;

        this.entities[id] = mesh;
        if (parent && this.entities[parent]) this.entities[parent].add(mesh);
        else this.scene?.add(mesh);

        this.animationSystem.loadAnimMesh(path, parent, id)
          .catch((e: any) => console.error(`[CMDB] LoadAnimMesh failed: ${e}`));
      },
      onCreateMesh: (id: number, parent: number) => {
        const mesh = new THREE.Mesh();
        mesh.material = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          vertexColors: true,
          side: THREE.DoubleSide,
        });
        this.entities[id] = mesh;
        if (parent && this.entities[parent]) this.entities[parent].add(mesh);
        else this.scene?.add(mesh);
      },
      onLoadTexture: (id: number, pathPtr: number, flags: number) => {
        const path = this.core.readString(pathPtr);
        // reuse existing internal LoadTexture logic if possible or replicate it
        // Existing logic: imports.env.LoadTexture calls CreateTexture(1,1) (stub) or real logic?
        // Let's assume for v1 we use a simple texture loader wrapped by our system.
        // Ideally we call a method on `this` that handles texture loading.
        // For now, let's create a placeholder texture object.

        // Note: `this.textures` stores { file:..., texture: THREE.Texture, ... } objects or just textures?
        // Looking at `graphics.ts` `LoadTexture`... it seems to be missing or I missed it.
        // `imports.env.LoadTexture` was defined as `createTexture(1,1)` stub in core.ts if noAssets=1.

        // Let's implement a basic texture load:
        const loader = new THREE.TextureLoader();
        const tex = loader.load(path); // This will fail for SMPK internal paths unless we use blob URLs.
        // TODO: Integrate with Asset Management / SMPK.
        // For now, register it.
        this.textures[id] = tex;
      },
      onTextureBlend: (id: number, blend: number) => {
        // TODO
      },
      onTextureCoords: (id: number, coords: number) => {
        // TODO
      },
      onCreateBrush: (id: number) => {
        this.brushes[id] = {
          color: [1, 1, 1], alpha: 1, shininess: 0, blend: 1, fx: 0,
          textures: []
        };
      },
      onBrushColor: (id: number, r: number, g: number, b: number) => {
        const bObj = this.brushes[id];
        if (bObj) bObj.color = [r, g, b];
      },
      onBrushAlpha: (id: number, a: number) => {
        const bObj = this.brushes[id];
        if (bObj) bObj.alpha = a;
      },
      onBrushShininess: (id: number, s: number) => {
        const bObj = this.brushes[id];
        if (bObj) bObj.shininess = s;
      },
      onBrushTexture: (brushId: number, textureId: number, frame: number, index: number) => {
        const bObj = this.brushes[brushId];
        const tex = this.textures[textureId];
        if (bObj && tex) {
          bObj.textures[index || 0] = { texture: tex, frame };
        }
      },
      onEntityTexture: (entityId: number, textureId: number, frame: number, index: number) => {
        const ent = this.entities[entityId];
        const tex = this.textures[textureId];
        if (ent && tex) {
          // Apply to all materials
          ent.traverse?.((child: any) => {
            if (child.isMesh && child.material) {
              this.ensureUniqueMaterial(child);
              const mapName = index === 0 ? "map" : `map${index}`; // simplified
              // THREE doesn't support multi-texture easily without custom shaders.
              // For v1, map index 0 to .map, index 1 to .lightMap or similar?
              if (index === 0) child.material.map = tex;
              child.material.needsUpdate = true;
            }
          });
        }
      },
      onEntityColor: (entityId: number, r: number, g: number, b: number) => {
        const ent = this.entities[entityId];
        if (ent) {
          ent.traverse?.((child: any) => {
            if (child.isMesh && child.material) {
              this.ensureUniqueMaterial(child);
              if (child.material.color) child.material.color.setRGB(r, g, b);
            }
          });
        }
      },
      onEntityAlpha: (entityId: number, a: number) => {
        const ent = this.entities[entityId];
        if (ent) {
          ent.traverse?.((child: any) => {
            if (child.isMesh && child.material) {
              this.ensureUniqueMaterial(child);
              child.material.opacity = a;
              child.material.transparent = a < 1.0;
              child.material.needsUpdate = true;
            }
          });
        }
      },
      onEntityShininess: (entityId: number, s: number) => {
        const ent = this.entities[entityId];
        if (ent) {
          ent.traverse?.((child: any) => {
            if (child.isMesh && child.material) {
              this.ensureUniqueMaterial(child);
              // Approximate shininess with roughness/metalness
              child.material.roughness = 1.0 - s;
              child.material.metalness = s * 0.5;
              child.material.needsUpdate = true;
            }
          });
        }
      },
      onEntityFX: (entityId: number, fx: number) => {
        // TODO: 1=fullbright, 2=vertexcolors, 4=flat, 8=disable fog, 16=disable culling
        const ent = this.entities[entityId];
        if (ent) {
          ent.traverse?.((child: any) => {
            if (child.isMesh && child.material) {
              this.ensureUniqueMaterial(child);
              if (fx & 1) { // Fullbright
                child.material.emissive = child.material.color;
                child.material.emissiveIntensity = 1.0;
              }
              if (fx & 2) child.material.vertexColors = true;
              if (fx & 4) child.material.flatShading = true;
              if (fx & 16) child.material.side = THREE.DoubleSide;
              child.material.needsUpdate = true;
            }
          });
        }
      },
      onEntityBlend: (entityId: number, blend: number) => {
        // 1=alpha, 2=multiply, 3=add
        const ent = this.entities[entityId];
        if (ent) {
          ent.traverse?.((child: any) => {
            if (child.isMesh && child.material) {
              this.ensureUniqueMaterial(child);
              child.material.transparent = true;
              if (blend === 1) child.material.blending = THREE.NormalBlending;
              if (blend === 2) child.material.blending = THREE.MultiplyBlending;
              if (blend === 3) child.material.blending = THREE.AdditiveBlending;
              child.material.needsUpdate = true;
            }
          });
        }
      },
      onFreeEntity: (id: number) => {
        exec.onDestroyEntity(id);
      },
    };

    try {
      drainCmds(dv, (cmd) => dispatchCmd(exec, cmd));
    } catch (e) {
      console.error("[CMDB] drain error:", e);
      return 0;
    }
    return 1;
  }

  updateSurfaces() {
    for (const id in this.surfaces) {
      this.surfaces[id].update();
    }
  }
}
