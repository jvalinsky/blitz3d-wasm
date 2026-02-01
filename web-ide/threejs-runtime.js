/**
 * Three.js Graphics Runtime for Blitz3D Web IDE
 * 
 * Implements the Blitz3D graphics API using Three.js
 */

export class Blitz3DGraphicsRuntime {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.entities = new Map(); // Handle -> Three.js Object3D
    this.nextHandle = 1;
    this.animationFrameId = null;
    this.renderCallback = null;
  }

  // Initialize 3D graphics
  graphics3d(width, height) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);

    this.renderer = new THREE.WebGLRenderer({ 
      canvas: this.canvas,
      antialias: true 
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(window.devicePixelRatio);

    // Default ambient light
    const ambientLight = new THREE.AmbientLight(0x404040);
    this.scene.add(ambientLight);

    console.log(`✅ Graphics3D initialized: ${width}x${height}`);
  }

  // Create entities
  createcube() {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
    const cube = new THREE.Mesh(geometry, material);
    
    const handle = this.nextHandle++;
    this.entities.set(handle, cube);
    this.scene.add(cube);
    
    console.log(`Created cube, handle: ${handle}`);
    return handle;
  }

  createsphere(segments) {
    const geometry = new THREE.SphereGeometry(1, segments, segments);
    const material = new THREE.MeshStandardMaterial({ color: 0x0088ff });
    const sphere = new THREE.Mesh(geometry, material);
    
    const handle = this.nextHandle++;
    this.entities.set(handle, sphere);
    this.scene.add(sphere);
    
    console.log(`Created sphere, handle: ${handle}`);
    return handle;
  }

  createmesh() {
    const geometry = new THREE.BufferGeometry();
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const mesh = new THREE.Mesh(geometry, material);
    
    const handle = this.nextHandle++;
    this.entities.set(handle, mesh);
    this.scene.add(mesh);
    
    return handle;
  }

  createcamera() {
    if (!this.renderer) {
      throw new Error('Graphics3D must be called before CreateCamera');
    }
    
    const aspect = this.renderer.domElement.width / this.renderer.domElement.height;
    const camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
    camera.position.set(0, 0, 5);
    
    const handle = this.nextHandle++;
    this.entities.set(handle, camera);
    this.camera = camera; // Set as active camera
    
    console.log(`Created camera, handle: ${handle}`);
    return handle;
  }

  createlight(type) {
    let light;
    if (type === 1) {
      // Directional light
      light = new THREE.DirectionalLight(0xffffff, 1.0);
      light.position.set(1, 1, 1);
    } else if (type === 2) {
      // Point light
      light = new THREE.PointLight(0xffffff, 1.0, 100);
    } else {
      // Ambient light
      light = new THREE.AmbientLight(0xffffff, 0.5);
    }
    
    const handle = this.nextHandle++;
    this.entities.set(handle, light);
    this.scene.add(light);
    
    console.log(`Created light type ${type}, handle: ${handle}`);
    return handle;
  }

  // Entity transformations
  positionentity(handle, x, y, z) {
    const entity = this.entities.get(handle);
    if (entity) {
      entity.position.set(x, y, z);
    }
  }

  rotateentity(handle, pitch, yaw, roll) {
    const entity = this.entities.get(handle);
    if (entity) {
      // Convert degrees to radians
      entity.rotation.set(
        pitch * Math.PI / 180,
        yaw * Math.PI / 180,
        roll * Math.PI / 180
      );
    }
  }

  turnentity(handle, pitch, yaw, roll) {
    const entity = this.entities.get(handle);
    if (entity) {
      // Incremental rotation (degrees to radians)
      entity.rotation.x += pitch * Math.PI / 180;
      entity.rotation.y += yaw * Math.PI / 180;
      entity.rotation.z += roll * Math.PI / 180;
    }
  }

  scaleentity(handle, sx, sy, sz) {
    const entity = this.entities.get(handle);
    if (entity) {
      entity.scale.set(sx, sy, sz);
    }
  }

  // Entity queries
  entityx(handle) {
    const entity = this.entities.get(handle);
    return entity ? entity.position.x : 0;
  }

  entityy(handle) {
    const entity = this.entities.get(handle);
    return entity ? entity.position.y : 0;
  }

  entityz(handle) {
    const entity = this.entities.get(handle);
    return entity ? entity.position.z : 0;
  }

  entitydistance(handle1, handle2) {
    const entity1 = this.entities.get(handle1);
    const entity2 = this.entities.get(handle2);
    if (entity1 && entity2) {
      return entity1.position.distanceTo(entity2.position);
    }
    return 0;
  }

  pointentity(handle, targetHandle) {
    const entity = this.entities.get(handle);
    const target = this.entities.get(targetHandle);
    if (entity && target) {
      entity.lookAt(target.position);
    }
  }

  // Entity properties
  lightcolor(handle, r, g, b) {
    const light = this.entities.get(handle);
    if (light && light.isLight) {
      light.color.setRGB(r / 255, g / 255, b / 255);
    }
  }

  entitycolor(handle, r, g, b) {
    const entity = this.entities.get(handle);
    if (entity && entity.material) {
      entity.material.color.setRGB(r / 255, g / 255, b / 255);
    }
  }

  // Rendering
  renderworld() {
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  flip() {
    // In WebGL, flip is implicit (double buffering handled by browser)
    // We use this as a signal to update the display
    this.renderworld();
  }

  cls() {
    if (this.renderer) {
      this.renderer.clear();
    }
  }

  // Start animation loop
  startAnimationLoop(stepCallback) {
    const animate = () => {
      this.animationFrameId = requestAnimationFrame(animate);
      
      // Call the WASM step function
      if (stepCallback) {
        try {
          stepCallback();
        } catch (e) {
          console.error('Animation loop error:', e);
          this.stopAnimationLoop();
        }
      }
    };
    
    animate();
  }

  stopAnimationLoop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  // Cleanup
  dispose() {
    this.stopAnimationLoop();
    
    if (this.renderer) {
      this.renderer.dispose();
    }
    
    this.entities.forEach(entity => {
      if (entity.geometry) entity.geometry.dispose();
      if (entity.material) entity.material.dispose();
    });
    
    this.entities.clear();
  }
}
