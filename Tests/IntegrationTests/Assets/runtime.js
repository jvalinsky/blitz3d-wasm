//
//  runtime.js
//  Blitz3D WASM Runtime
//
//  Provides WebGL, Web Audio, and other browser APIs to the WASM module
//

const Blitz3D = {
  memory: null,
  canvas: null,
  gl: null,
  audioContext: null,
  dataPointer: 256, // Start of data section
  assets: {}, // path -> { data: ArrayBuffer, embedded: boolean, offset: number }
  assetManifest: null,

  // Bank Manager
  bankManager: {
    banks: new Map(),
    nextHandle: 1,
  },

  // Zip Manager
  zipManager: {
    archives: new Map(), // Map<filename, Map<filepath_in_zip, Uint8Array>>
    mountedFiles: new Map(), // Map<handle, {name, files, keys}>
    nextHandle: 1,

    loadZip: async function (url) {
      try {
        const filename = url.replace(/\\/g, "/").split("/").pop();
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const zip = await JSZip.loadAsync(arrayBuffer);
        const fileMap = new Map();
        const promises = [];
        zip.forEach((relativePath, file) => {
          if (!file.dir) {
            promises.push(
              file.async("uint8array").then((data) => {
                fileMap.set(relativePath, data);
              }),
            );
          }
        });
        await Promise.all(promises);
        this.archives.set(filename, fileMap);
        console.log(`Mounted ZIP archive: ${filename} (${fileMap.size} files)`);
        return filename;
      } catch (err) {
        console.error(`Failed to load ZIP ${url}:`, err);
        return null;
      }
    },
  },

  // FMOD Manager
  fmodManager: {
    streams: new Map(), // handle -> { buffer: AudioBuffer, loop: boolean }
    // Active channels: Map<channelId, { source: AudioBufferSourceNode, gain: GainNode, start: number, paused: number, isPaused: boolean }>
    channels: new Map(),
    nextHandle: 1,
    context: null,
  },

  // Physics Manager
  physicsManager: {
    collisionRules: [], // [{ typeA, typeB, method, response }]
    entities: new Map(), // id -> { type, radiusX, radiusY, collisions: [] }
    picks: [],
    collided: false,
  },

  // String handling
  readString: function (ptr) {
    if (!this.memory || !this.memory.buffer) {
      return "";
    }
    const memory = new Uint8Array(this.memory.buffer);
    const maxLen = memory.length;
    let str = "";
    let i = ptr;
    // Safety limit to prevent infinite loops or reading past memory
    const maxStringLen = 1024 * 1024; // 1MB limit
    let charsRead = 0;
    while (i < maxLen && charsRead < maxStringLen) {
      const byte = memory[i];
      if (byte === 0) {
        break;
      }
      str += String.fromCharCode(byte);
      i++;
      charsRead++;
    }
    return str;
  },

  // Asset management
  loadAsset: function (path) {
    if (this.assets[path]) {
      return this.assets[path];
    }

    // Check manifest for embedded assets
    if (this.assetManifest && this.assetManifest.embedAssets) {
      const assetInfo = this.assetManifest.assets.find((a) => a.path === path);
      if (assetInfo && assetInfo.offset) {
        // Read from WASM memory
        const data = new Uint8Array(this.memory.buffer);
        const buffer = data.slice(
          assetInfo.offset,
          assetInfo.offset + assetInfo.size,
        );
        const asset = {
          data: buffer,
          embedded: true,
          offset: assetInfo.offset,
        };
        this.assets[path] = asset;
        return asset;
      }
    }

    // Fallback: try to fetch external file
    const self = this;
    return fetch(path)
      .then((response) => response.arrayBuffer())
      .then((buffer) => {
        const asset = { data: buffer, embedded: false, offset: null };
        self.assets[path] = asset;
        return asset;
      })
      .catch((err) => {
        console.error("Failed to load asset: " + path, err);
        return null;
      });
  },

  getAssetData: function (path) {
    const asset = this.assets[path];
    if (asset && asset.data) {
      return asset.data;
    }
    // Try loading synchronously if embedded
    if (this.assetManifest && this.assetManifest.embedAssets) {
      const assetInfo = this.assetManifest.assets.find((a) => a.path === path);
      if (assetInfo && assetInfo.offset) {
        const data = new Uint8Array(this.memory.buffer);
        return data.slice(assetInfo.offset, assetInfo.offset + assetInfo.size);
      }
    }
    return null;
  },

  loadAssetManifest: function (manifestUrl) {
    const self = this;
    return fetch(manifestUrl)
      .then((response) => response.json())
      .then((manifest) => {
        self.assetManifest = manifest;
        console.log(
          "Loaded asset manifest with " + (manifest.assets?.length || 0) +
            " assets",
        );
        console.log(
          "Embedded assets: " + (manifest.embedAssets ? "yes" : "no"),
        );
      })
      .catch((err) => {
        console.warn("Failed to load asset manifest: " + err);
      });
  },

  // Graphics state
  currentFont: "arial",
  currentFontSize: 12,
  currentColor: [255, 255, 255, 255],
  clearColor: [0, 0, 0, 1],

  // File System
  fs: {}, // path -> ArrayBuffer
  files: {}, // handle -> { buffer: DataView, pos: int, size: int }
  nextFileId: 1,

  // 3D Engine
  scene: null,
  camera: null,
  renderer: null,
  entities: {},
  textures: {},
  animMixers: new Set(),
  images: {},
  nextImageId: 1,
  nextEntityId: 1,
  ambientLight: null,
  fog: null,

  init: function (canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) {
      console.error("Canvas not found: " + canvasId);
      return;
    }

    // Setup 2D overlay canvas for Text commands
    this.textCanvas = document.createElement("canvas");
    this.textCanvas.width = this.canvas.width;
    this.textCanvas.height = this.canvas.height;
    this.textCanvas.style.position = "absolute";
    this.textCanvas.style.top = "0";
    this.textCanvas.style.left = "0";
    this.textCanvas.style.pointerEvents = "none";
    this.canvas.parentElement.appendChild(this.textCanvas);
    this.ctx2d = this.textCanvas.getContext("2d");

    console.log("Blitz3D Runtime Initialized");
  },

  init3D: function () {
    if (!window.THREE) {
      console.error("Three.js not loaded");
      return;
    }

    this.scene = new THREE.Scene();
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false,
    });
    this.renderer.setSize(this.canvas.width, this.canvas.height);
    this.renderer.autoClear = false; // We handle clearing manually with Cls

    // Default camera
    // this.camera = new THREE.PerspectiveCamera(75, this.canvas.width / this.canvas.height, 0.1, 1000);
    // this.scene.add(this.camera);

    this.animate();
  },

  lastTime: 0,
  animate: function (time) {
    requestAnimationFrame((t) => this.animate(t));

    const delta = (time - this.lastTime) / 1000.0;
    this.lastTime = time;

    if (delta > 0 && delta < 0.1) { // Cap delta to avoid jumps
      this.animMixers.forEach((mixer) => mixer.update(delta));
    }

    if (this.renderer && this.scene && this.camera) {
      // Render 3D
      this.renderer.render(this.scene, this.camera);
    }
  },

  // Import object for WASM
  imports: {
    env: {
      PrintInt: function (val) {
        console.log(val);
      },

      PrintString: function (ptr) {
        const str = Blitz3D.readString(ptr);
        console.log(str);
      },

      // Graphics
      Graphics3D: function (width, height, depth, mode) {
        if (Blitz3D.canvas) {
          Blitz3D.canvas.width = width;
          Blitz3D.canvas.height = height;
          if (Blitz3D.textCanvas) {
            Blitz3D.textCanvas.width = width;
            Blitz3D.textCanvas.height = height;
          }
        }
        Blitz3D.init3D();
        console.log(`Graphics3D ${width}x${height}x${depth} mode=${mode}`);
      },

      ClsColor: function (r, g, b) {
        Blitz3D.clearColor = [r / 255.0, g / 255.0, b / 255.0, 1.0];
        if (Blitz3D.renderer) {
          Blitz3D.renderer.setClearColor(
            new THREE.Color(r / 255.0, g / 255.0, b / 255.0),
            1.0,
          );
        }
      },

      Color: function (r, g, b) {
        Blitz3D.currentColor = [r, g, b, 255];
        if (Blitz3D.ctx2d) {
          Blitz3D.ctx2d.fillStyle = `rgb(${r},${g},${b})`;
          Blitz3D.ctx2d.strokeStyle = `rgb(${r},${g},${b})`;
        }
      },

      Cls: function () {
        if (Blitz3D.renderer) {
          Blitz3D.renderer.clear();
        }
        if (Blitz3D.ctx2d) {
          Blitz3D.ctx2d.clearRect(
            0,
            0,
            Blitz3D.textCanvas.width,
            Blitz3D.textCanvas.height,
          );
        }
      },

      // Entity Management
      CreateCamera: function (parent) {
        const cam = new THREE.PerspectiveCamera(
          75,
          Blitz3D.canvas.width / Blitz3D.canvas.height,
          1.0,
          1000.0,
        );
        const id = Blitz3D.nextEntityId++;
        Blitz3D.entities[id] = cam;

        if (parent && Blitz3D.entities[parent]) {
          Blitz3D.entities[parent].add(cam);
        } else {
          Blitz3D.scene.add(cam);
        }

        // If this is the first camera, make it active
        if (!Blitz3D.camera) {
          Blitz3D.camera = cam;
        }
        return id;
      },

      CreateLight: function (type, parent) {
        if (type === undefined) type = 1;
        let light;
        switch (type) {
          case 1:
            light = new THREE.DirectionalLight(0xffffff, 1);
            break;
          case 2:
            light = new THREE.PointLight(0xffffff, 1, 100);
            break;
          case 3:
            light = new THREE.SpotLight(0xffffff, 1, 100, Math.PI / 4);
            break;
          default:
            light = new THREE.DirectionalLight(0xffffff, 1);
        }
        const id = Blitz3D.nextEntityId++;
        Blitz3D.entities[id] = light;
        if (parent && Blitz3D.entities[parent]) {
          Blitz3D.entities[parent].add(light);
        } else {
          Blitz3D.scene.add(light);
        }
        return id;
      },

      AmbientLight: function (r, g, b) {
        if (!Blitz3D.ambientLight) {
          Blitz3D.ambientLight = new THREE.AmbientLight(
            new THREE.Color(r / 255, g / 255, b / 255),
            1.0,
          );
          Blitz3D.scene.add(Blitz3D.ambientLight);
        } else {
          Blitz3D.ambientLight.color.setRGB(r / 255, g / 255, b / 255);
        }
      },

      LightColor: function (lightId, r, g, b) {
        const light = Blitz3D.entities[lightId];
        if (light && light.isLight) {
          light.color.setRGB(r / 255, g / 255, b / 255);
        }
      },

      LightRange: function (lightId, range) {
        const light = Blitz3D.entities[lightId];
        if (light && (light.isPointLight || light.isSpotLight)) {
          light.distance = range;
        }
      },

      // Fog
      FogMode: function (mode) {
        if (mode === 0) {
          Blitz3D.scene.fog = null;
        } else if (mode === 1) {
          // Linear Fog
          if (!(Blitz3D.scene.fog instanceof THREE.Fog)) {
            Blitz3D.scene.fog = new THREE.Fog(0x000000, 1, 1000);
          }
        } else if (mode === 2) {
          // Exponential Fog
          if (!(Blitz3D.scene.fog instanceof THREE.FogExp2)) {
            Blitz3D.scene.fog = new THREE.FogExp2(0x000000, 0.001);
          }
        }
      },

      FogColor: function (r, g, b) {
        if (Blitz3D.scene.fog) {
          Blitz3D.scene.fog.color.setRGB(r / 255, g / 255, b / 255);
        }
      },

      FogRange: function (near, far) {
        if (Blitz3D.scene.fog instanceof THREE.Fog) {
          Blitz3D.scene.fog.near = near;
          Blitz3D.scene.fog.far = far;
        }
      },

      FogDensity: function (density) {
        if (Blitz3D.scene.fog instanceof THREE.FogExp2) {
          Blitz3D.scene.fog.density = density;
        }
      },

      // Camera
      CameraClsColor: function (camId, r, g, b) {
        // In Three.js, clear color is global on the renderer
        Blitz3D.renderer.setClearColor(
          new THREE.Color(r / 255, g / 255, b / 255),
          1,
        );
      },

      CameraRange: function (camId, near, far) {
        const cam = Blitz3D.entities[camId];
        if (cam && cam.isCamera) {
          cam.near = near;
          cam.far = far;
          cam.updateProjectionMatrix();
        }
      },

      CameraZoom: function (camId, zoom) {
        const cam = Blitz3D.entities[camId];
        if (cam && cam.isCamera) {
          cam.zoom = zoom;
          cam.updateProjectionMatrix();
        }
      },

      CameraProjMode: function (camId, mode) {
        // 1 = Perspective, 2 = Ortho
        // For now, assume perspective is default. Ortho would require replacing the object.
      },

      CameraViewport: function (cam, x, y, width, height) {
        // TODO: Sub-viewports using gl.viewport?
      },

      CreateCube: function (parent) {
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshLambertMaterial({ color: 0xffffff });
        const cube = new THREE.Mesh(geometry, material);

        const id = Blitz3D.nextEntityId++;
        Blitz3D.entities[id] = cube;

        if (parent && Blitz3D.entities[parent]) {
          Blitz3D.entities[parent].add(cube);
        } else {
          Blitz3D.scene.add(cube);
        }
        return id;
      },

      CreateSphere: function (segments, parent) {
        const segs = segments || 8;
        const geometry = new THREE.SphereGeometry(1, segs, segs);
        const material = new THREE.MeshLambertMaterial({ color: 0xffffff });
        const sphere = new THREE.Mesh(geometry, material);

        const id = Blitz3D.nextEntityId++;
        Blitz3D.entities[id] = sphere;

        if (parent && Blitz3D.entities[parent]) {
          Blitz3D.entities[parent].add(sphere);
        } else {
          Blitz3D.scene.add(sphere);
        }
        return id;
      },

      LoadTexture: function (filePtr, flags) {
        const url = Blitz3D.readString(filePtr);

        // Check for embedded or preloaded asset first
        const asset = Blitz3D.loadAsset(url);

        if (asset && asset.embedded && asset.data) {
          // Create blob URL from embedded data
          const blob = new Blob([asset.data]);
          url = URL.createObjectURL(blob);
        }

        const loader = new THREE.TextureLoader();
        const tex = loader.load(url);

        const id = Blitz3D.nextEntityId++;
        Blitz3D.textures[id] = tex;
        return id;
      },

      LoadMesh: function (filePtr, parent) {
        const url = Blitz3D.readString(filePtr);
        const id = Blitz3D.nextEntityId++;
        const group = new THREE.Group();
        Blitz3D.entities[id] = group;
        if (parent && Blitz3D.entities[parent]) {
          Blitz3D.entities[parent].add(group);
        } else {
          Blitz3D.scene.add(group);
        }

        const ext = url.split(".").pop().toLowerCase();
        let loader;
        if (ext === "obj") {
          loader = new THREE.OBJLoader();
          loader.load(url, (obj) => {
            group.add(obj);
            console.log("Loaded OBJ mesh: " + url);
          });
        } else {
          console.warn("Unsupported or unimplemented mesh format: " + url);
        }
        return id;
      },

      LoadAnimMesh: function (filePtr, parent) {
        const path = Blitz3D.readString(filePtr);
        const id = Blitz3D.nextEntityId++;

        // Use GLTFLoader for now as a better modern B3D alternative
        // Real B3D support would require a custom parser
        const loader = new THREE.Group();
        Blitz3D.entities[id] = loader;

        if (parent && Blitz3D.entities[parent]) {
          Blitz3D.entities[parent].add(loader);
        } else {
          Blitz3D.scene.add(loader);
        }

        const url = path;
        const gltfLoader = new THREE.GLTFLoader();
        gltfLoader.load(url, (gltf) => {
          loader.add(gltf.scene);
          if (gltf.animations && gltf.animations.length > 0) {
            const mixer = new THREE.AnimationMixer(gltf.scene);
            Blitz3D.animMixers.add(mixer);
            loader.blitzMixer = mixer;
            loader.blitzAnimations = gltf.animations;
          }
        });

        return id;
      },

      Animate: function (entId, mode, speed, seq, transition) {
        const obj = Blitz3D.entities[entId];
        if (obj && obj.blitzMixer && obj.blitzAnimations[seq]) {
          const mixer = obj.blitzMixer;
          const clip = obj.blitzAnimations[seq];
          const action = mixer.clipAction(clip);

          action.stop();
          action.setEffectiveTimeScale(speed);

          switch (mode) {
            case 1:
              action.setLoop(THREE.LoopRepeat);
              break;
            case 2:
              action.setLoop(THREE.LoopPingPong);
              break;
            case 3:
              action.setLoop(THREE.LoopOnce);
              break;
          }

          if (transition > 0) {
            action.fadeIn(transition / 60.0); // Blitz3D frames to seconds
          }
          action.play();
          obj.blitzActiveAction = action;
        }
      },

      SetAnimTime: function (entId, time, seq) {
        const obj = Blitz3D.entities[entId];
        if (obj && obj.blitzMixer && obj.blitzAnimations[seq]) {
          const mixer = obj.blitzMixer;
          const clip = obj.blitzAnimations[seq];
          const action = mixer.clipAction(clip);
          action.play();
          action.paused = true;
          // Blitz3D time is in frames. Three.js is in seconds.
          // CLIP length / 60 = total seconds?
          // No, Blitz3D frames are usually 60fps.
          action.time = time / 60.0;
        }
      },

      AnimTime: function (entId) {
        const obj = Blitz3D.entities[entId];
        if (obj && obj.blitzActiveAction) {
          return obj.blitzActiveAction.time * 60.0;
        }
        return 0;
      },

      AnimLength: function (entId) {
        const obj = Blitz3D.entities[entId];
        if (obj && obj.blitzAnimations) {
          // For Blitz3D compatibility, we'd return max length or sequence length
          const clip = obj.blitzAnimations[0];
          return clip ? Math.floor(clip.duration * 60.0) : 0;
        }
        return 0;
      },

      ExtractAnimSeq: function (entId, first, last) {
        // Three.js doesn't easily support extracting segments from existing clips
        // For now, return a dummy sequence ID
        return 0;
      },

      AddAnimSeq: function (entId, length) {
        return 0;
      },

      AnimSeq: function (entId) {
        return 0;
      },

      Animating: function (entId) {
        const obj = Blitz3D.entities[entId];
        return (obj && obj.blitzActiveAction &&
            obj.blitzActiveAction.isRunning())
          ? 1
          : 0;
      },

      AppTitle: function (ptr1) {
        const title = Blitz3D.readString(ptr1);
        document.title = title;
      },

      Delay: function (ms) {
        // Sync delay is impossible in JS main thread without freezing.
        // We'll treat it as a no-op or a hint.
      },

      WaitKey: function () {
        return 0;
      },

      CreateMesh: function (parent) {
        const id = Blitz3D.nextEntityId++;
        const group = new THREE.Group();
        Blitz3D.entities[id] = group;
        if (parent && Blitz3D.entities[parent]) {
          Blitz3D.entities[parent].add(group);
        } else {
          Blitz3D.scene.add(group);
        }
        return id;
      },

      CreatePivot: function (parent) {
        const id = Blitz3D.nextEntityId++;
        const group = new THREE.Group();
        Blitz3D.entities[id] = group;
        if (parent && Blitz3D.entities[parent]) {
          Blitz3D.entities[parent].add(group);
        } else {
          Blitz3D.scene.add(group);
        }
        return id;
      },

      FreeEntity: function (id) {
        const obj = Blitz3D.entities[id];
        if (obj) {
          if (obj.parent) obj.parent.remove(obj);
          obj.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach((m) => m.dispose());
              } else child.material.dispose();
            }
          });
          delete Blitz3D.entities[id];
        }
      },

      CopyEntity: function (id, parent) {
        const obj = Blitz3D.entities[id];
        if (!obj) return 0;

        const copy = obj.clone();
        const newId = Blitz3D.nextEntityId++;
        Blitz3D.entities[newId] = copy;

        if (parent && Blitz3D.entities[parent]) {
          Blitz3D.entities[parent].add(copy);
        } else if (obj.parent) {
          obj.parent.add(copy);
        } else {
          Blitz3D.scene.add(copy);
        }

        return newId;
      },

      EntityX: function (id, global) {
        const obj = Blitz3D.entities[id];
        if (!obj) return 0;
        if (global) {
          const v = new THREE.Vector3();
          obj.getWorldPosition(v);
          return v.x;
        }
        return obj.position.x;
      },

      EntityY: function (id, global) {
        const obj = Blitz3D.entities[id];
        if (!obj) return 0;
        if (global) {
          const v = new THREE.Vector3();
          obj.getWorldPosition(v);
          return v.y;
        }
        return obj.position.y;
      },

      EntityZ: function (id, global) {
        const obj = Blitz3D.entities[id];
        if (!obj) return 0;
        if (global) {
          const v = new THREE.Vector3();
          obj.getWorldPosition(v);
          return -v.z; // Invert Z for RH to LH
        }
        return -obj.position.z;
      },

      EntityPitch: function (id, global) {
        const obj = Blitz3D.entities[id];
        if (!obj) return 0;
        const rot = global ? obj.getWorldRotation() : obj.rotation;
        return rot.x * 180.0 / Math.PI;
      },

      EntityYaw: function (id, global) {
        const obj = Blitz3D.entities[id];
        if (!obj) return 0;
        const rot = global ? obj.getWorldRotation() : obj.rotation;
        return -rot.y * 180.0 / Math.PI;
      },

      EntityRoll: function (id, global) {
        const obj = Blitz3D.entities[id];
        if (!obj) return 0;
        const rot = global ? obj.getWorldRotation() : obj.rotation;
        return -rot.z * 180.0 / Math.PI;
      },

      EntityDistance: function (id1, id2) {
        const obj1 = Blitz3D.entities[id1];
        const obj2 = Blitz3D.entities[id2];
        if (!obj1 || !obj2) return 0;

        // Get world positions to be accurate
        const v1 = new THREE.Vector3();
        const v2 = new THREE.Vector3();
        obj1.getWorldPosition(v1);
        obj2.getWorldPosition(v2);

        return v1.distanceTo(v2);
      },

      EntityVisible: function (srcId, destId) {
        const src = Blitz3D.entities[srcId];
        const dest = Blitz3D.entities[destId];
        if (!src || !dest) return 0;

        // Basic raycast check
        const raycaster = new THREE.Raycaster();
        const pos1 = new THREE.Vector3();
        const pos2 = new THREE.Vector3();
        src.getWorldPosition(pos1);
        dest.getWorldPosition(pos2);

        const dir = new THREE.Vector3().subVectors(pos2, pos1).normalize();
        raycaster.set(pos1, dir);
        raycaster.far = pos1.distanceTo(pos2);

        const intersects = raycaster.intersectObjects(
          Blitz3D.scene.children,
          true,
        );

        // If the first intersection is not the destination or its child, it's blocked
        if (intersects.length > 0) {
          const first = intersects[0].object;
          let curr = first;
          while (curr) {
            if (curr === dest) return 1;
            curr = curr.parent;
          }
          return 0; // Blocked
        }
        return 1; // Clear path
      },

      EntityInView: function (entId, camId) {
        const ent = Blitz3D.entities[entId];
        const cam = Blitz3D.entities[camId];
        if (!ent || !cam || !cam.isCamera) return 0;

        const frustum = new THREE.Frustum();
        const matrix = new THREE.Matrix4().multiplyMatrices(
          cam.projectionMatrix,
          cam.matrixWorldInverse,
        );
        frustum.setFromProjectionMatrix(matrix);

        // Check bounding box or sphere
        if (ent.isMesh) {
          if (!ent.geometry.boundingSphere) {
            ent.geometry.computeBoundingSphere();
          }
          const sphere = ent.geometry.boundingSphere.clone().applyMatrix4(
            ent.matrixWorld,
          );
          return frustum.intersectsSphere(sphere) ? 1 : 0;
        } else {
          // Pivot/Group - check position
          const pos = new THREE.Vector3();
          ent.getWorldPosition(pos);
          return frustum.containsPoint(pos) ? 1 : 0;
        }
      },

      LoadAsset: function (pathPtr) {
        const path = Blitz3D.readString(pathPtr);
        const asset = Blitz3D.loadAsset(path);
        if (asset) {
          // Return a handle to the asset
          const handle = Date.now(); // Simple handle generation
          Blitz3D.assets[path] = asset;
          return handle;
        }
        return 0;
      },

      GetAssetData: function (handle) {
        // Not implemented - would need a handle-to-asset mapping
        return 0;
      },

      GetAssetSize: function (handle) {
        // Not implemented
        return 0;
      },

      // File I/O
      ReadFile: function (filePtr) {
        const path = Blitz3D.readString(filePtr).replace(/\\/g, "/");
        if (Blitz3D.fs[path]) {
          const id = Blitz3D.nextFileId++;
          Blitz3D.files[id] = {
            buffer: new DataView(Blitz3D.fs[path]),
            pos: 0,
            size: Blitz3D.fs[path].byteLength,
          };
          return id;
        }
        console.warn("ReadFile failed: " + path);
        return 0;
      },

      WriteFile: function (filePtr) {
        const path = Blitz3D.readString(filePtr).replace(/\\/g, "/");
        const id = Blitz3D.nextFileId++;
        Blitz3D.files[id] = {
          path: path,
          buffer: new Uint8Array(1024), // Initial buffer
          pos: 0,
          size: 0,
          writing: true,
        };
        return id;
      },

      CloseFile: function (stream) {
        delete Blitz3D.files[stream];
      },

      FileType: function (filePtr) {
        const path = Blitz3D.readString(filePtr).replace(/\\/g, "/");
        if (Blitz3D.fs[path]) return 1;
        for (let k in Blitz3D.fs) {
          if (k.startsWith(path + "/")) return 2;
        }
        return 0;
      },

      FileSize: function (filePtr) {
        const path = Blitz3D.readString(filePtr).replace(/\\/g, "/");
        if (Blitz3D.fs[path]) return Blitz3D.fs[path].byteLength;
        return 0;
      },

      ReadInt: function (stream) {
        const file = Blitz3D.files[stream];
        if (file && file.pos + 4 <= file.size) {
          const val = file.buffer.getInt32(file.pos, true);
          file.pos += 4;
          return val;
        }
        return 0;
      },

      ReadFloat: function (stream) {
        const file = Blitz3D.files[stream];
        if (file && file.pos + 4 <= file.size) {
          const val = file.buffer.getFloat32(file.pos, true);
          file.pos += 4;
          return val;
        }
        return 0.0;
      },

      ReadByte: function (stream) {
        const file = Blitz3D.files[stream];
        if (file && file.pos + 1 <= file.size) {
          const val = file.buffer.getUint8(file.pos);
          file.pos += 1;
          return val;
        }
        return 0;
      },

      ReadShort: function (stream) {
        const file = Blitz3D.files[stream];
        if (file && file.pos + 2 <= file.size) {
          const val = file.buffer.getInt16(file.pos, true);
          file.pos += 2;
          return val;
        }
        return 0;
      },

      ReadString: function (stream) {
        const file = Blitz3D.files[stream];
        if (file && file.pos + 4 <= file.size) {
          const len = file.buffer.getInt32(file.pos, true);
          file.pos += 4;
          if (file.pos + len <= file.size) {
            let str = "";
            for (let i = 0; i < len; i++) {
              str += String.fromCharCode(file.buffer.getUint8(file.pos + i));
            }
            file.pos += len;
            if (Blitz3D.allocString) return Blitz3D.allocString(str);
          }
        }
        return 0;
      },

      ReadData: function (stream, bankHandle, length) {
        const file = Blitz3D.files[stream];
        const bank = Blitz3D.bankManager.banks.get(bankHandle);
        if (file && bank) {
          const count = Math.min(length, file.size - file.pos, bank.size);
          const fileBytes = new Uint8Array(
            file.buffer.buffer,
            file.buffer.byteOffset + file.pos,
            count,
          );
          const bankBytes = new Uint8Array(
            Blitz3D.memory.buffer,
            bank.ptr,
            bank.size,
          );
          bankBytes.set(fileBytes);
          file.pos += count;
          return count;
        }
        return 0;
      },

      Eof: function (stream) {
        const file = Blitz3D.files[stream];
        if (file) return file.pos >= file.size ? 1 : 0;
        return 1;
      },

      EntityTexture: function (entity, texture, frame, index) {
        const obj = Blitz3D.entities[entity];
        const tex = Blitz3D.textures[texture];
        if (obj && tex) {
          if (obj.material) {
            obj.material.map = tex;
            obj.material.needsUpdate = true;
          }
        }
      },

      PositionEntity: function (entity, x, y, z, global) {
        const obj = Blitz3D.entities[entity];
        if (obj) {
          obj.position.set(x, y, -z); // Negate Z for simple RH conversion
        }
      },

      RotateEntity: function (entity, p, y, r, global) {
        const obj = Blitz3D.entities[entity];
        if (obj) {
          // Blitz3D: Pitch (X), Yaw (Y), Roll (Z). Degrees.
          // Three.js: Radians.
          const deg2rad = Math.PI / 180.0;
          obj.rotation.set(p * deg2rad, -y * deg2rad, -r * deg2rad); // Invert Y/Z for coordinate system match?
          // Need to verify rotation mapping.
        }
      },

      ScaleEntity: function (entity, x, y, z) {
        const obj = Blitz3D.entities[entity];
        if (obj) {
          obj.scale.set(x, y, z);
        }
      },

      MoveEntity: function (entity, x, y, z) {
        const obj = Blitz3D.entities[entity];
        if (obj) {
          obj.translateX(x);
          obj.translateY(y);
          obj.translateZ(-z); // Negate Z
        }
      },

      // Physics/Collisions
      EntityType: function (entity, type, recursive) {
        const obj = Blitz3D.entities[entity];
        if (obj) {
          obj.blitzType = type;
          if (recursive) {
            obj.traverse((child) => {
              child.blitzType = type;
            });
          }
        }
      },

      EntityRadius: function (entity, rx, ry) {
        const obj = Blitz3D.entities[entity];
        if (obj) {
          obj.blitzRadius = { x: rx, y: ry };
        }
      },

      Collisions: function (srcType, destType, method, response) {
        Blitz3D.physicsManager.collisionRules.push({
          src: srcType,
          dest: destType,
          method: method,
          response: response,
        });
      },

      UpdateWorld: function (elapsed) {
        // Simplified collision resolution
        const entities = Object.values(Blitz3D.entities);
        const rules = Blitz3D.physicsManager.collisionRules;

        rules.forEach((rule) => {
          const sources = entities.filter((e) =>
            e.blitzType === rule.src && e.blitzRadius
          );
          const targets = entities.filter((e) => e.blitzType === rule.dest);

          sources.forEach((src) => {
            targets.forEach((dest) => {
              if (src === dest) return;

              // Sphere-to-Sphere (Method 1)
              if (rule.method === 1 && dest.blitzRadius) {
                const dist = src.position.distanceTo(dest.position);
                const minDist = src.blitzRadius.x + dest.blitzRadius.x;
                if (dist < minDist) {
                  // Basic push-out
                  const overlap = minDist - dist;
                  const dir = new THREE.Vector3().subVectors(
                    src.position,
                    dest.position,
                  ).normalize();
                  src.position.addScaledVector(dir, overlap);
                }
              }

              // Sphere-to-Mesh (Method 2)
              if (rule.method === 2 && dest.isMesh) {
                // Simplified: Check bounding box first
                const srcSphere = new THREE.Sphere(
                  src.position,
                  src.blitzRadius.x,
                );
                if (!dest.geometry.boundingBox) {
                  dest.geometry.computeBoundingBox();
                }
                const box = dest.geometry.boundingBox.clone().applyMatrix4(
                  dest.matrixWorld,
                );

                if (box.intersectsSphere(srcSphere)) {
                  // In a real engine, we'd do per-triangle.
                  // For now, let's just push back from the box center.
                  const dir = new THREE.Vector3().subVectors(
                    src.position,
                    box.getCenter(new THREE.Vector3()),
                  ).normalize();
                  src.position.addScaledVector(dir, 0.1); // Small push
                }
              }
            });
          });
        });
      },

      EntityPick: function (entity, range) {
        const obj = Blitz3D.entities[entity];
        if (obj && Blitz3D.camera) {
          const raycaster = new THREE.Raycaster();
          // Direction for EntityPick is typically forward?
          // In Blitz3D, EntityPick picks from an entity?
          // "EntityPick picks from an entity's position along its forward axis."
          const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(
            obj.quaternion,
          );
          raycaster.set(obj.position, dir);
          raycaster.far = range;

          const intersects = raycaster.intersectObjects(
            Blitz3D.scene.children,
            true,
          );
          if (intersects.length > 0) {
            Blitz3D.physicsManager.lastPick = intersects[0];
            return 1; // Collision occurred
          }
        }
        return 0;
      },

      LinePick: function (x, y, z, dx, dy, dz, radius) {
        if (Blitz3D.scene) {
          const origin = new THREE.Vector3(x, y, -z);
          const dir = new THREE.Vector3(dx, dy, -dz).normalize();
          const raycaster = new THREE.Raycaster(origin, dir);
          raycaster.far = new THREE.Vector3(dx, dy, -dz).length();

          const intersects = raycaster.intersectObjects(
            Blitz3D.scene.children,
            true,
          );
          if (intersects.length > 0) {
            Blitz3D.physicsManager.lastPick = intersects[0];
            return 1;
          }
        }
        return 0;
      },

      CollisionX: function (ent, idx) {
        return Blitz3D.physicsManager.lastPick
          ? Blitz3D.physicsManager.lastPick.point.x
          : 0;
      },
      CollisionY: function (ent, idx) {
        return Blitz3D.physicsManager.lastPick
          ? Blitz3D.physicsManager.lastPick.point.y
          : 0;
      },
      CollisionZ: function (ent, idx) {
        return Blitz3D.physicsManager.lastPick
          ? -Blitz3D.physicsManager.lastPick.point.z
          : 0;
      },
      CollisionEntity: function (ent, idx) {
        if (Blitz3D.physicsManager.lastPick) {
          const obj = Blitz3D.physicsManager.lastPick.object;
          // Find entity ID
          for (let id in Blitz3D.entities) {
            if (Blitz3D.entities[id] === obj) return parseInt(id);
          }
        }
        return 0;
      },

      CountCollisions: function (ent) {
        return 0;
      },
      CollisionNX: function (ent, idx) {
        return 0;
      },
      CollisionNY: function (ent, idx) {
        return 0;
      },
      CollisionNZ: function (ent, idx) {
        return 0;
      },
      CollisionSurface: function (ent, idx) {
        return 0;
      },
      CollisionTriangle: function (ent, idx) {
        return 0;
      },

      TurnEntity: function (entity, p, y, r, global) {
        const obj = Blitz3D.entities[entity];
        if (obj) {
          const deg2rad = Math.PI / 180.0;
          obj.rotateX(p * deg2rad);
          obj.rotateY(-y * deg2rad);
          obj.rotateZ(-r * deg2rad);
        }
      },

      Cls: function () {
        if (Blitz3D.renderer) {
          Blitz3D.renderer.clear();
        }
        if (Blitz3D.ctx2d) {
          Blitz3D.ctx2d.clearRect(
            0,
            0,
            Blitz3D.canvas.width,
            Blitz3D.canvas.height,
          );
        }
      },

      ClsColor: function (r, g, b) {
        Blitz3D.clearColor = [r / 255.0, g / 255.0, b / 255.0, 1.0];
        if (Blitz3D.renderer) {
          Blitz3D.renderer.setClearColor(
            new THREE.Color(r / 255, g / 255, b / 255),
            1,
          );
        }
      },

      Color: function (r, g, b) {
        Blitz3D.currentColor = [r, g, b, 255];
        if (Blitz3D.ctx2d) {
          const color = `rgb(${r},${g},${b})`;
          Blitz3D.ctx2d.fillStyle = color;
          Blitz3D.ctx2d.strokeStyle = color;
        }
      },

      GetColor: function (x, y) {
        // In Blitz3D this returns color at pixel.
        // Return a dummy value or implement via 2D ctx getImageData.
        return 0;
      },

      Rect: function (x, y, w, h, solid) {
        if (Blitz3D.ctx2d) {
          if (solid) {
            Blitz3D.ctx2d.fillRect(x, y, w, h);
          } else {
            Blitz3D.ctx2d.strokeRect(x, y, w, h);
          }
        }
      },

      Oval: function (x, y, w, h, solid) {
        if (Blitz3D.ctx2d) {
          Blitz3D.ctx2d.beginPath();
          Blitz3D.ctx2d.ellipse(
            x + w / 2,
            y + h / 2,
            w / 2,
            h / 2,
            0,
            0,
            2 * Math.PI,
          );
          if (solid) Blitz3D.ctx2d.fill();
          else Blitz3D.ctx2d.stroke();
        }
      },

      Line: function (x1, y1, x2, y2) {
        if (Blitz3D.ctx2d) {
          Blitz3D.ctx2d.beginPath();
          Blitz3D.ctx2d.moveTo(x1, y1);
          Blitz3D.ctx2d.lineTo(x2, y2);
          Blitz3D.ctx2d.stroke();
        }
      },

      Text: function (x, y, strPtr, centerX, centerY) {
        if (Blitz3D.ctx2d) {
          const str = Blitz3D.readString(strPtr);
          Blitz3D.ctx2d.font =
            `${Blitz3D.currentFontSize}px ${Blitz3D.currentFont}`;
          Blitz3D.ctx2d.textAlign = centerX ? "center" : "left";
          Blitz3D.ctx2d.textBaseline = centerY ? "middle" : "top";
          Blitz3D.ctx2d.fillText(str, x, y);
        }
      },

      // Images
      LoadImage: function (filePtr) {
        const path = Blitz3D.readString(filePtr);
        const id = Blitz3D.nextImageId++;
        const img = new Image();

        const meta = {
          img: img,
          width: 0,
          height: 0,
          hx: 0,
          hy: 0,
          loaded: false,
        };

        Blitz3D.images[id] = meta;

        img.onload = () => {
          meta.width = img.width;
          meta.height = img.height;
          meta.loaded = true;
        };
        img.src = path;

        return id;
      },

      DrawImage: function (imgId, x, y, frame) {
        const meta = Blitz3D.images[imgId];
        if (meta && meta.loaded && Blitz3D.ctx2d) {
          Blitz3D.ctx2d.drawImage(meta.img, x - meta.hx, y - meta.hy);
        }
      },

      DrawBlock: function (imgId, x, y, frame) {
        const meta = Blitz3D.images[imgId];
        if (meta && meta.loaded && Blitz3D.ctx2d) {
          Blitz3D.ctx2d.drawImage(meta.img, x - meta.hx, y - meta.hy);
        }
      },

      TileImage: function (imgId, x, y, frame) {
        const meta = Blitz3D.images[imgId];
        if (meta && meta.loaded && Blitz3D.ctx2d) {
          const pattern = Blitz3D.ctx2d.createPattern(meta.img, "repeat");
          Blitz3D.ctx2d.fillStyle = pattern;
          Blitz3D.ctx2d.fillRect(
            0,
            0,
            Blitz3D.canvas.width,
            Blitz3D.canvas.height,
          );
          // Restore color
          Blitz3D.ctx2d.fillStyle = `rgb(${Blitz3D.currentColor[0]},${
            Blitz3D.currentColor[1]
          },${Blitz3D.currentColor[2]})`;
        }
      },

      ImageWidth: function (imgId) {
        const meta = Blitz3D.images[imgId];
        return meta ? meta.width : 0;
      },

      ImageHeight: function (imgId) {
        const meta = Blitz3D.images[imgId];
        return meta ? meta.height : 0;
      },

      HandleImage: function (imgId, hx, hy) {
        const meta = Blitz3D.images[imgId];
        if (meta) {
          meta.hx = hx;
          meta.hy = hy;
        }
      },

      MidHandle: function (imgId) {
        const meta = Blitz3D.images[imgId];
        if (meta && meta.loaded) {
          meta.hx = meta.width / 2;
          meta.hy = meta.height / 2;
        }
      },

      AutoMidHandle: function (enable) {
        // Not fully implemented, would need to hook into LoadImage
      },

      MaskImage: function (imgId, r, g, b) {
        // Canvas doesn't support color-key masking natively easily on DrawImage.
        // We'd need to process the image data.
      },

      ScaleImage: function (imgId, sx, sy) {
        // Would need a hidden canvas to resize
      },

      ResizeImage: function (imgId, w, h) {
        // Would need a hidden canvas to resize
      },

      FreeImage: function (imgId) {
        delete Blitz3D.images[imgId];
      },

      Flip: function () {
        // In browser, Flip is implicit via requestAnimationFrame
        // This is just a sync point
      },

      // Input
      KeyDown: function (key) {
        return Blitz3D.keys[key] ? 1 : 0;
      },

      KeyHit: function (key) {
        const hit = Blitz3D.keyHits[key] ? 1 : 0;
        Blitz3D.keyHits[key] = false;
        return hit;
      },

      MouseX: function () {
        return Blitz3D.mouseX;
      },
      MouseY: function () {
        return Blitz3D.mouseY;
      },
      MouseZ: function () {
        return Blitz3D.mouseZ;
      },
      MouseDown: function (btn) {
        return Blitz3D.mouseButtons[btn] ? 1 : 0;
      },
      MouseHit: function (btn) {
        const hit = Blitz3D.mouseButtonHits[btn] ? 1 : 0;
        Blitz3D.mouseButtonHits[btn] = false;
        return hit;
      },

      MouseXSpeed: function () {
        const speed = Blitz3D.mouseXSpeed;
        Blitz3D.mouseXSpeed = 0;
        return speed;
      },
      MouseYSpeed: function () {
        const speed = Blitz3D.mouseYSpeed;
        Blitz3D.mouseYSpeed = 0;
        return speed;
      },
      MoveMouse: function (x, y) {
        // Browser doesn't allow moving system cursor.
        // We'll use Pointer Lock for FPS.
        Blitz3D.wantPointerLock = true;
        if (Blitz3D.canvas && !Blitz3D.pointerLocked) {
          Blitz3D.canvas.requestPointerLock();
        }
      },
      HidePointer: function () {
        if (Blitz3D.canvas) Blitz3D.canvas.style.cursor = "none";
      },
      ShowPointer: function () {
        if (Blitz3D.canvas) Blitz3D.canvas.style.cursor = "default";
      },

      // Time
      MilliCSecs: function () {
        return Math.floor(performance.now());
      },

      // Math
      Abs: function (n) {
        return Math.abs(n);
      },
      Sgn: function (n) {
        return Math.sign(n);
      },
      Mod: function (a, b) {
        return a % b;
      },

      // Strings
      Left: function (ptr, n) {
        const s = Blitz3D.readString(ptr);
        return Blitz3D.allocString(s.substring(0, n));
      },
      Right: function (ptr, n) {
        const s = Blitz3D.readString(ptr);
        return Blitz3D.allocString(s.substring(s.length - n));
      },
      Mid: function (ptr, start, len) {
        const s = Blitz3D.readString(ptr);
        // Blitz3D Mid is 1-indexed
        return Blitz3D.allocString(s.substring(start - 1, start - 1 + len));
      },
      Upper: function (ptr) {
        return Blitz3D.allocString(Blitz3D.readString(ptr).toUpperCase());
      },
      Lower: function (ptr) {
        return Blitz3D.allocString(Blitz3D.readString(ptr).toLowerCase());
      },
      Len: function (ptr) {
        return Blitz3D.readString(ptr).length;
      },
      Chr: function (c) {
        return Blitz3D.allocString(String.fromCharCode(c));
      },
      Asc: function (ptr) {
        const s = Blitz3D.readString(ptr);
        return s.length > 0 ? s.charCodeAt(0) : 0;
      },
      StringConcat: function (ptr1, ptr2) {
        const s1 = Blitz3D.readString(ptr1);
        const s2 = Blitz3D.readString(ptr2);
        return Blitz3D.allocString(s1 + s2);
      },
      IntToString: function (n) {
        return Blitz3D.allocString(n.toString());
      },
      FloatToString: function (n) {
        // Blitz3D typically formats floats with some precision
        return Blitz3D.allocString(n.toString());
      },

      // System
      AppTitle: function (ptr) {
        document.title = Blitz3D.readString(ptr);
      },
      Delay: function (ms) {
        // Synchronous delay not possible in JS without blocking thread
        // For now, ignore or use shared memory?
      },
      // Audio
      LoadSound: function (filePtr) {
        const url = Blitz3D.readString(filePtr);
        Blitz3D.initAudio();
        const id = Blitz3D.nextSoundId++;
        Blitz3D.sounds[id] = { buffer: null, loaded: false };

        fetch(url)
          .then((response) => response.arrayBuffer())
          .then((arrayBuffer) =>
            Blitz3D.audioContext.decodeAudioData(arrayBuffer)
          )
          .then((audioBuffer) => {
            Blitz3D.sounds[id].buffer = audioBuffer;
            Blitz3D.sounds[id].loaded = true;
            console.log("Loaded sound: " + url);
          })
          .catch((e) => console.error("Failed to load sound: " + url, e));

        return id;
      },

      PlaySound: function (soundId) {
        if (
          Blitz3D.sounds[soundId] && Blitz3D.sounds[soundId].loaded &&
          Blitz3D.audioContext
        ) {
          const source = Blitz3D.audioContext.createBufferSource();
          source.buffer = Blitz3D.sounds[soundId].buffer;
          source.connect(Blitz3D.audioContext.destination);
          source.start(0);
          return 1; // Channel handle
        }
        return 0;
      },

      FreeSound: function (soundId) {
        delete Blitz3D.sounds[soundId];
      },

      // Data/Read/Restore
      ReadData: function (dataAddr, varAddr, type) {
        const mem = new Uint8Array(Blitz3D.memory.buffer);
        const dataView = new DataView(Blitz3D.memory.buffer);
        let nextAddr = dataAddr;

        switch (type) {
          case 0: // Integer
            const intVal = dataView.getInt32(dataAddr, true);
            dataView.setInt32(varAddr, intVal, true);
            nextAddr = dataAddr + 4;
            break;
          case 1: // Float
            const floatVal = dataView.getFloat32(dataAddr, true);
            dataView.setFloat32(varAddr, floatVal, true);
            nextAddr = dataAddr + 4;
            break;
          case 2: // String
            // Read string pointer from data section
            const strPtr = dataView.getInt32(dataAddr, true);
            const str = Blitz3D.readString(strPtr);
            // Allocate string in WASM memory and store pointer
            if (Blitz3D.allocString) {
              const newPtr = Blitz3D.allocString(str);
              dataView.setInt32(varAddr, newPtr, true);
            }
            nextAddr = dataAddr + 4;
            break;
        }

        return nextAddr;
      },

      RestoreData: function (offset) {
        Blitz3D.dataPointer = offset;
      },

      // Banks
      CreateBank: function (size) {
        if (Blitz3D.exports && Blitz3D.exports.__Alloc) {
          const ptr = Blitz3D.exports.__Alloc(size);
          const handle = Blitz3D.bankManager.nextHandle++;
          Blitz3D.bankManager.banks.set(handle, { ptr: ptr, size: size });
          return handle;
        }
        return 0;
      },

      FreeBank: function (handle) {
        const bank = Blitz3D.bankManager.banks.get(handle);
        if (bank) {
          Blitz3D.bankManager.banks.delete(handle);
        }
      },

      BankSize: function (handle) {
        const bank = Blitz3D.bankManager.banks.get(handle);
        return bank ? bank.size : 0;
      },

      ResizeBank: function (handle, size) {
        const bank = Blitz3D.bankManager.banks.get(handle);
        if (bank && Blitz3D.exports && Blitz3D.exports.__Alloc) {
          const newPtr = Blitz3D.exports.__Alloc(size);
          const oldSize = bank.size;
          const copySize = size < oldSize ? size : oldSize;

          const mem = new Uint8Array(Blitz3D.memory.buffer);
          mem.set(mem.subarray(bank.ptr, bank.ptr + copySize), newPtr);

          bank.ptr = newPtr;
          bank.size = size;
        }
      },

      CopyBank: function (srcHandle, srcOffset, destHandle, destOffset, count) {
        const src = Blitz3D.bankManager.banks.get(srcHandle);
        const dest = Blitz3D.bankManager.banks.get(destHandle);
        if (src && dest) {
          const mem = new Uint8Array(Blitz3D.memory.buffer);
          mem.set(
            mem.subarray(src.ptr + srcOffset, src.ptr + srcOffset + count),
            dest.ptr + destOffset,
          );
        }
      },

      PeekByte: function (handle, offset) {
        const bank = Blitz3D.bankManager.banks.get(handle);
        if (bank && offset >= 0 && offset < bank.size) {
          const mem = new Uint8Array(Blitz3D.memory.buffer);
          return mem[bank.ptr + offset];
        }
        return 0;
      },

      PokeByte: function (handle, offset, value) {
        const bank = Blitz3D.bankManager.banks.get(handle);
        if (bank && offset >= 0 && offset < bank.size) {
          const mem = new Uint8Array(Blitz3D.memory.buffer);
          mem[bank.ptr + offset] = value;
        }
      },

      PeekInt: function (handle, offset) {
        const bank = Blitz3D.bankManager.banks.get(handle);
        if (bank && offset >= 0 && offset + 4 <= bank.size) {
          const view = new DataView(Blitz3D.memory.buffer);
          return view.getInt32(bank.ptr + offset, true);
        }
        return 0;
      },

      PokeInt: function (handle, offset, value) {
        const bank = Blitz3D.bankManager.banks.get(handle);
        if (bank && offset >= 0 && offset + 4 <= bank.size) {
          const view = new DataView(Blitz3D.memory.buffer);
          view.setInt32(bank.ptr + offset, value, true);
        }
      },

      PeekShort: function (handle, offset) {
        const bank = Blitz3D.bankManager.banks.get(handle);
        if (bank && offset >= 0 && offset + 2 <= bank.size) {
          const view = new DataView(Blitz3D.memory.buffer);
          return view.getInt16(bank.ptr + offset, true);
        }
        return 0;
      },

      PokeShort: function (handle, offset, value) {
        const bank = Blitz3D.bankManager.banks.get(handle);
        if (bank && offset >= 0 && offset + 2 <= bank.size) {
          const view = new DataView(Blitz3D.memory.buffer);
          view.setInt16(bank.ptr + offset, value, true);
        }
      },

      // ZlibWapi
      ZlibWapi_Open: function (pathPtr) {
        const path = Blitz3D.readString(pathPtr);
        const filename = path.replace(/\\/g, "/").split("/").pop();

        if (Blitz3D.zipManager.archives.has(filename)) {
          const handle = Blitz3D.zipManager.nextHandle++;
          const files = Blitz3D.zipManager.archives.get(filename);
          Blitz3D.zipManager.mountedFiles.set(handle, {
            name: filename,
            files: files,
            keys: Array.from(files.keys()),
          });
          return handle;
        }
        console.warn("ZlibWapi_Open failed to find preloaded zip: " + filename);
        return 0;
      },

      ZlibWapi_Close: function (handle) {
        Blitz3D.zipManager.mountedFiles.delete(handle);
      },

      ZlibWapi_GetFileCount: function (handle) {
        const zip = Blitz3D.zipManager.mountedFiles.get(handle);
        return zip ? zip.keys.length : 0;
      },

      ZlibWapi_GetFileName: function (handle, index) {
        const zip = Blitz3D.zipManager.mountedFiles.get(handle);
        if (zip && index >= 0 && index < zip.keys.length) {
          const name = zip.keys[index];
          if (Blitz3D.allocString) return Blitz3D.allocString(name);
        }
        return 0;
      },

      ZlibWapi_ExtractFile: function (handle, index, destPathPtr) {
        const zip = Blitz3D.zipManager.mountedFiles.get(handle);
        const destPath = Blitz3D.readString(destPathPtr).replace(/\\/g, "/");
        if (zip && index >= 0 && index < zip.keys.length) {
          const fileName = zip.keys[index];
          const content = zip.files.get(fileName);
          if (content) {
            // Synchronous virtual extraction!
            Blitz3D.fs[destPath] = content;
            return 1;
          }
        }
        return 0;
      },

      PeekFloat: function (handle, offset) {
        const bank = Blitz3D.bankManager.banks.get(handle);
        if (bank && offset >= 0 && offset + 4 <= bank.size) {
          const view = new DataView(Blitz3D.memory.buffer);
          return view.getFloat32(bank.ptr + offset, true);
        }
        return 0.0;
      },

      PokeFloat: function (handle, offset, value) {
        const bank = Blitz3D.bankManager.banks.get(handle);
        if (bank && offset >= 0 && offset + 4 <= bank.size) {
          const view = new DataView(Blitz3D.memory.buffer);
          view.setFloat32(bank.ptr + offset, value, true);
        }
      },

      // FMOD
      FSOUND_Init: function (freq, maxchannels, flags) {
        console.log(
          `FSOUND_Init: ${freq}Hz, ${maxchannels} chans, flags=${flags}`,
        );
        Blitz3D.initAudio();
        if (Blitz3D.audioContext) {
          Blitz3D.fmodManager.context = Blitz3D.audioContext;
          return 1;
        }
        return 0;
      },

      FSOUND_Stream_Open: function (pathPtr, mode, offset, length) {
        const path = Blitz3D.readString(pathPtr).replace(/\\/g, "/");
        console.log(`FSOUND_Stream_Open: ${path}`);

        // Check virtual FS first (for extracted mods), then assets
        let data = Blitz3D.fs[path] || Blitz3D.getAssetData(path);

        if (data) {
          const handle = Blitz3D.fmodManager.nextHandle++;
          const streamInfo = { buffer: null, loop: (mode & 2) !== 0 }; // Simplified mode check
          Blitz3D.fmodManager.streams.set(handle, streamInfo);
          const ctx = Blitz3D.fmodManager.context;
          if (ctx) {
            // Ensure data is an ArrayBuffer/Uint8Array slice
            const bufferCopy = data instanceof ArrayBuffer
              ? data.slice(0)
              : data.buffer.slice(
                data.byteOffset,
                data.byteOffset + data.byteLength,
              );
            ctx.decodeAudioData(bufferCopy, (audioBuffer) => {
              console.log(`Decoded ${path}: ${audioBuffer.duration}s`);
              streamInfo.buffer = audioBuffer;
            }, (err) => {
              console.error(`Failed to decode ${path}: ${err}`);
            });
          }
          return handle;
        }
        console.warn(`FSOUND_Stream_Open: File not found ${path}`);
        return 0;
      },

      FSOUND_Stream_Play: function (channel, streamHandle) {
        const stream = Blitz3D.fmodManager.streams.get(streamHandle);
        const ctx = Blitz3D.fmodManager.context;
        if (stream && ctx && stream.buffer) {
          if (Blitz3D.fmodManager.channels.has(channel)) {
            const old = Blitz3D.fmodManager.channels.get(channel);
            try {
              old.source.stop();
            } catch (e) {}
          }
          const source = ctx.createBufferSource();
          source.buffer = stream.buffer;
          source.loop = stream.loop;
          const gain = ctx.createGain();
          source.connect(gain);
          gain.connect(ctx.destination);
          source.start(0);
          Blitz3D.fmodManager.channels.set(channel, {
            source: source,
            gain: gain,
            startTime: ctx.currentTime,
            isPaused: false,
          });
          return channel;
        }
        return -1;
      },

      FSOUND_SetVolume: function (channel, vol) {
        const ch = Blitz3D.fmodManager.channels.get(channel);
        if (ch) ch.gain.gain.value = vol / 255.0;
      },

      FSOUND_SetPaused: function (channel, paused) {
        const ch = Blitz3D.fmodManager.channels.get(channel);
        const ctx = Blitz3D.fmodManager.context;
        if (ch && ctx) {
          if (paused && !ch.isPaused) {
            ctx.suspend();
            ch.gain.gain.value = 0;
            ch.isPaused = true;
          } else if (!paused && ch.isPaused) {
            ch.gain.gain.value = 1.0;
            ch.isPaused = false;
          }
        }
      },

      StopChannel: function (channel) {
        const ch = Blitz3D.fmodManager.channels.get(channel);
        if (ch) {
          try {
            ch.source.stop();
          } catch (e) {}
          Blitz3D.fmodManager.channels.delete(channel);
        }
      },

      ChannelVolume: function (channel, vol) {
        const ch = Blitz3D.fmodManager.channels.get(channel);
        if (ch) ch.gain.gain.value = vol / 255.0;
      },

      ChannelPaused: function (channel, paused) {
        const ch = Blitz3D.fmodManager.channels.get(channel);
        if (ch) {
          if (paused) {
            // ch.source.playbackRate.value = 0; // Not ideal
            ch.isPaused = true;
          } else {
            ch.isPaused = false;
          }
        }
      },

      ChannelPlaying: function (channel) {
        return Blitz3D.fmodManager.channels.has(channel) ? 1 : 0;
      },

      FSOUND_Stream_Stop: function (stream) {
      },

      FSOUND_Close: function () {
        const ctx = Blitz3D.fmodManager.context;
        if (ctx) ctx.close();
      },
    },
  },

  // Input state
  keys: {},
  keyHits: {},
  mouseX: 0,
  mouseY: 0,
  mouseZ: 0,
  mouseXSpeed: 0,
  mouseYSpeed: 0,
  mouseButtons: {},
  mouseButtonHits: {},
  pointerLocked: false,
  consoleLine: 0,

  // Audio state
  sounds: {},
  nextSoundId: 1,

  initAudio: function () {
    if (!this.audioContext) {
      this.audioContext =
        new (window.AudioContext || window.webkitAudioContext)();
    }
  },

  setupInput: function () {
    window.addEventListener("keydown", (e) => {
      this.keys[e.keyCode] = true;
      this.keyHits[e.keyCode] = true;
    });

    window.addEventListener("keyup", (e) => {
      this.keys[e.keyCode] = false;
    });

    window.addEventListener("mousemove", (e) => {
      if (this.canvas) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouseX = e.clientX - rect.left;
        this.mouseY = e.clientY - rect.top;

        // Track movement speed (delta)
        this.mouseXSpeed += e.movementX;
        this.mouseYSpeed += e.movementY;
      }
    });

    window.addEventListener("mousedown", (e) => {
      this.mouseButtons[e.button + 1] = true; // 1=Left, 2=Right, 3=Middle
      this.mouseButtonHits[e.button + 1] = true;

      // Auto-lock pointer on click if requested
      if (this.wantPointerLock && !this.pointerLocked) {
        this.canvas.requestPointerLock();
      }
    });

    window.addEventListener("mouseup", (e) => {
      this.mouseButtons[e.button + 1] = false;
    });

    window.addEventListener("wheel", (e) => {
      this.mouseZ += e.deltaY;
    });

    document.addEventListener("pointerlockchange", () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
    });
  },

  // To be called at start of frame
  updateInput: function () {
    // Reset speeds each frame?
    // Blitz3D MouseXSpeed() returns delta since last call.
    // We'll reset it manually or on call.
  },

  // Loader
  preload: async function (fileList) {
    // Separate Zips from regular files
    const zips = fileList.filter((f) => f.toLowerCase().endsWith(".zip"));
    const files = fileList.filter((f) => !f.toLowerCase().endsWith(".zip"));

    if (zips.length > 0) {
      await this.preloadZips(zips);
    }

    for (const file of files) {
      try {
        const response = await fetch(file);
        if (response.ok) {
          const buffer = await response.arrayBuffer();
          this.fs[file] = buffer;
          console.log("Preloaded: " + file);
        } else {
          console.warn("Failed to preload: " + file);
        }
      } catch (e) {
        console.warn("Error preloading: " + file, e);
      }
    }
  },

  preloadZips: async function (urls) {
    for (const url of urls) {
      await this.zipManager.loadZip(url);
    }
  },

  load: async function (wasmUrl, canvasId) {
    if (canvasId) {
      this.init(canvasId);
    } else if (!this.canvas) {
      console.error(
        "Blitz3D canvas not initialized. Call Blitz3D.init(id) first or pass id to load().",
      );
      return;
    }
    this.setupInput();

    const response = await fetch(wasmUrl);
    const buffer = await response.arrayBuffer();
    console.log("WASM Imports:", Object.keys(this.imports.env));
    const module = await WebAssembly.instantiate(buffer, this.imports);
    this.exports = module.instance.exports;

    this.memory = module.instance.exports.memory;

    const alloc = module.instance.exports.__Alloc;
    if (alloc) {
      this.allocString = function (str) {
        const len = str.length;
        const ptr = alloc(len + 1);
        const mem = new Uint8Array(Blitz3D.memory.buffer);
        for (let i = 0; i < len; i++) {
          mem[ptr + i] = str.charCodeAt(i);
        }
        mem[ptr + len] = 0;
        return ptr;
      };
    }

    // Call main if it exists
    if (module.instance.exports.main) {
      module.instance.exports.main();
    } else if (module.instance.exports.Main) {
      module.instance.exports.Main();
    }

    return module;
  },
};

window.Blitz3D = Blitz3D;
