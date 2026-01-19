# SCPB WASM Browser Deployment Technical Plan

**Document Version:** 1.0  
**Created:** 2026-01-18 19:52:00 UTC  
**Git Hash:** f2dd13e52ef6fbfba9ab97e8de7005a27c13d065  
**Author:** OpenCode AI System:** Planning / Proposed  
**Status

---

## Executive Summary

This document outlines the technical plan for deploying SCP - Containment Breach (SCPCB) as a WebAssembly application running in web browsers. The original game, written in BlitzBasic (~52,000 lines across 35 .bb files), will be compiled to WASM using the blitz3d-wasm compiler infrastructure and served with optimized assets for web delivery.

### Key Metrics

| Metric | Value |
|--------|-------|
| Estimated Total Download | 34-66 MB (optimized) |
| Initial Load (First Visit) | 5-10 MB |
| Estimated Load Time (4G) | 40-60 seconds total |
| Estimated Load Time (5G) | 5-10 seconds total |
| Return Visit Load | 5-10 seconds (cached) |
| Target Platform | Modern browsers (Chrome, Firefox, Edge, Safari) |
| Compiler | blitz3d-wasm (Swift-based) |
| Runtime | JavaScript + Three.js |

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Browser                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              SCPB WASM Application                       │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │    │
│  │  │ core.wasm   │  │ runtime.js  │  │ Three.js        │  │    │
│  │  │ (2-5 MB)    │  │ (200-500 KB)│  │ (minified)      │  │    │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘  │    │
│  │                                                        │    │
│  │  ┌─────────────────────────────────────────────────┐  │    │
│  │  │              IndexedDB Cache                     │  │    │
│  │  │  Textures │ Audio │ Models │ Save Games         │  │    │
│  │  └─────────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Service Worker (Caching)                    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              CDN / Web Server                            │    │
│  │  /initial/     /assets/     /streaming/     /updates/   │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. Asset Analysis and Size Breakdown

### 1.1 Original SCPB Asset Inventory

The original SCPB game contains approximately 266-527 MB of assets:

| Category | Original Size | File Types | Notes |
|----------|--------------|------------|-------|
| 3D Models (Rooms) | 8-15 MB | .b3d | Room meshes, collision geometry |
| 3D Models (NPCs) | 3-5 MB | .b3d | 15+ NPC types, animations |
| 3D Models (Items) | 2-4 MB | .b3d | Pickable items, props |
| Room Textures | 30-50 MB | .png, .dds | Walls, floors, ceilings |
| NPC Textures | 10-20 MB | .png, .dds | Characters, creatures |
| Item Textures | 5-10 MB | .png | Icons, inventory items |
| UI Textures | 5-10 MB | .png | Menus, HUD, icons |
| Background Music | 100-200 MB | .ogg, .wav | 10-20 tracks |
| Sound Effects | 50-100 MB | .ogg, .wav | Door sounds, footsteps, etc. |
| Voice Lines | 30-50 MB | .ogg | SCP announcements, radio |
| Configuration | 1-2 MB | .ini | Rooms, events, NPCs |
| Scripts (BB) | 1-2 MB | .bb | Game logic (~52K lines) |
| **Total** | **266-527 MB** | | |

### 1.2 Optimized Target Sizes

| Category | Original | Optimized | Compression | Format |
|----------|----------|-----------|-------------|--------|
| **3D Models** | 15-25 MB | 3-5 MB | 70-80% | glTF + Draco |
| **Textures** | 50-100 MB | 8-15 MB | 80-85% | WebP |
| **Audio (Music)** | 100-200 MB | 15-25 MB | 85-90% | OGG 64-96kbps |
| **Audio (SFX)** | 50-100 MB | 8-15 MB | 80-85% | OGG 32-64kbps |
| **Audio (Voice)** | 30-50 MB | 5-10 MB | 75-85% | OGG 16-32kbps |
| **Configuration** | 1-2 MB | 0.5 MB | 50% | Minified JSON |
| **Scripts (WASM)** | 1-2 MB | 2-5 MB | +150% | Compiled |
| **Runtime JS** | N/A | 200-500 KB | 50% | Minified |
| **Total** | **266-527 MB** | **34-66 MB** | **75-85%** | |

### 1.3 Detailed Texture Breakdown

| Texture Type | Original | Optimized | Max Resolution | Format |
|--------------|----------|-----------|----------------|--------|
| Room walls | 15-25 MB | 2-4 MB | 1024x1024 | WebP 80% |
| Room floors | 10-15 MB | 1.5-2 MB | 1024x1024 | WebP 80% |
| Room ceilings | 5-8 MB | 0.5-1 MB | 512x512 | WebP 70% |
| NPC skins | 8-12 MB | 1-2 MB | 1024x1024 | WebP 85% |
| Item icons | 3-5 MB | 0.5-1 MB | 256x256 | WebP 90% |
| UI elements | 2-4 MB | 0.3-0.5 MB | 512x512 | WebP 90% |
| Lightmaps | 5-10 MB | 0.5-1 MB | 2048x2048 | WebP 75% |
| Normal maps | 3-5 MB | 0.3-0.5 MB | 1024x1024 | WebP 70% |
| **Subtotal** | **50-100 MB** | **8-15 MB** | | |

### 1.4 Detailed Audio Breakdown

| Audio Type | Original | Optimized | Bitrate | Notes |
|------------|----------|-----------|---------|-------|
| Music tracks | 100-200 MB | 15-25 MB | 64-96 kbps | Streamed |
| Ambient loops | 10-20 MB | 2-4 MB | 64 kbps | Cached |
| Footsteps | 5-10 MB | 0.5-1 MB | 32 kbps | Cached |
| Door sounds | 3-5 MB | 0.3-0.5 MB | 32 kbps | Cached |
| SCP vocals | 15-25 MB | 2-4 MB | 32 kbps | Cached |
| Radio/PA | 10-15 MB | 1-2 MB | 32 kbps | Cached |
| Announcer | 5-10 MB | 1-2 MB | 24 kbps | Cached |
| **Subtotal** | **180-300 MB** | **28-45 MB** | | |

---

## 2. Optimization Strategy

### 2.1 3D Model Optimization

#### Conversion Pipeline

```
original_assets/
├── rooms/
│   ├── lcz_001.b3d
│   ├── hcz_002.b3d
│   └── ...
├── npcs/
│   ├── scp_173.b3d
│   ├── scp_096.b3d
│   └── ...
└── items/
    ├── medkit.b3d
    └── ...

        ▼ [Blender + glTF Export]

optimized_assets/
├── rooms/
│   ├── lcz_001.glb (Draco compressed)
│   ├── hcz_002.glb (Draco compressed)
│   └── ...
├── npcs/
│   ├── scp_173.glb (Draco compressed)
│   └── ...
└── items/
    ├── medkit.glb (Draco compressed)
    └── ...

        ▼ [Brotli Compression]

compressed_assets/
├── rooms/
│   ├── lcz_001.glb.br
│   ├── hcz_002.glb.br
│   └── ...
├── npcs/
│   ├── scp_173.glb.br
│   └── ...
└── items/
    ├── medkit.glb.br
    └── ...
```

#### Optimization Techniques

1. **glTF + Draco Compression**
   - Convert from B3D to glTF format
   - Apply Draco mesh compression (70-80% size reduction)
   - Maintain all animations and skinning data

2. **Geometry Simplification**
   - Remove duplicate vertices
   - Simplify collision meshes (separate from visual)
   - LOD chains for distant objects

3. **Texture Atlas Creation**
   - Combine room textures into atlases
   - Reduce draw calls significantly
   - Example: Room atlas = 2048x2048 = 16 rooms

4. **Mesh Instancing**
   - Identify repeated objects (pillars, pipes, crates)
   - Use GPU instancing for performance
   - Reduces memory footprint

#### Model Size Examples

| Original Model | Original Size | Optimized Size | Reduction |
|----------------|---------------|----------------|-----------|
| Room LCZ (complex) | 1.2 MB | 180 KB | 85% |
| Room HCZ (medium) | 800 KB | 120 KB | 85% |
| SCP-173 | 400 KB | 60 KB | 85% |
| SCP-096 | 350 KB | 50 KB | 86% |
| SCP-106 | 450 KB | 70 KB | 84% |
| SCP-049 | 300 KB | 45 KB | 85% |
| SCP-939 | 500 KB | 75 KB | 85% |
| Medkit item | 25 KB | 5 KB | 80% |
| Keycard | 15 KB | 3 KB | 80% |

### 2.2 Texture Optimization

#### Pipeline

```
original_textures/
├── rooms/
│   ├── wall_001.png (2048x2048, 8MB)
│   └── floor_001.png (2048x2048, 8MB)
└── npcs/
    ├── scp_173_diffuse.png
    └── ...

        ▼ [ImageMagick + cwebp]

optimized_textures/
├── rooms/
│   ├── wall_001.webp (512x512, 80KB)
│   └── floor_001.webp (512x512, 60KB)
└── npcs/
    ├── scp_173_diffuse.webp
    └── ...

        ▼ [Crunch Compression]

crunch_textures/
└── [ETC2/DXT5 textures for WebGL]
```

#### Optimization Settings

| Texture Type | Target Resolution | WebP Quality | Format | Notes |
|--------------|-------------------|--------------|--------|-------|
| Room walls | 1024x1024 | 80 | WebP | Mipmaps enabled |
| Room floors | 1024x1024 | 80 | WebP | Mipmaps enabled |
| Room ceilings | 512x512 | 70 | WebP | Lower quality OK |
| NPC faces | 1024x1024 | 85 | WebP | Important for immersion |
| NPC bodies | 512x512 | 75 | WebP | Less detailed |
| Item icons | 256x256 | 90 | WebP | Sharp for HUD |
| UI elements | 512x512 | 90 | WebP | UI crispness |
| Lightmaps | 2048x2048 | 75 | WebP | HDR-like quality |
| Normal maps | 1024x1024 | 70 | WebP | Subtle differences |

#### Texture Atlas Strategy

```
2048x2048 Atlas (8MB uncompressed, ~500KB WebP)

┌─────────────┬─────────────┬─────────────┬─────────────┐
│   Room 01   │   Room 02   │   Room 03   │   Room 04   │
│  512x512    │  512x512    │  512x512    │  512x512    │
├─────────────┼─────────────┼─────────────┼─────────────┤
│   Room 05   │   Room 06   │   Room 07   │   Room 08   │
│  512x512    │  512x512    │  512x512    │  512x512    │
├─────────────┼─────────────┼─────────────┼─────────────┤
│   Room 09   │   Room 10   │   Room 11   │   Room 12   │
│  512x512    │  512x512    │  512x512    │  512x512    │
├─────────────┼─────────────┼─────────────┼─────────────┤
│   Room 13   │   Room 14   │   Room 15   │   Room 16   │
│  512x512    │  512x512    │  512x512    │  512x512    │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

### 2.3 Audio Optimization

#### Pipeline

```
original_audio/
├── music/
│   ├── track01.ogg (15MB)
│   └── ...
├── sfx/
│   ├── footsteps.ogg (10MB)
│   └── ...
└── voice/
    ├── scp_announce.ogg (5MB)
    └── ...

        ▼ [ffmpeg + OGG optimization]

optimized_audio/
├── music/
│   ├── track01.ogg (1.5MB, 64kbps)
│   └── ...
├── sfx/
│   ├── footsteps.ogg (50KB, 32kbps)
│   └── ...
└── voice/
    ├── scp_announce.ogg (200KB, 24kbps)
    └── ...

        ▼ [Streaming for music, caching for SFX]
```

#### Audio Settings

| Audio Type | Bitrate | Channels | Format | Delivery |
|------------|---------|----------|--------|----------|
| Music (main) | 96 kbps | Stereo | OGG | Streamed with buffering |
| Music (ambient) | 64 kbps | Stereo | OGG | Streamed |
| SCP vocals | 32 kbps | Mono | OGG | Cached |
| Announcer | 24 kbps | Mono | OGG | Cached |
| SFX (frequent) | 32 kbps | Mono | OGG | Cached |
| SFX (rare) | 64 kbps | Mono | OGG | Cached |
| Radio/PA | 32 kbps | Mono | OGG | Cached |

#### Audio Streaming Strategy

```javascript
// audio-manager.js
class AudioManager {
  constructor() {
    this.musicContext = new AudioContext();
    this.sfxContext = new AudioContext();
    this.musicBuffer = null;
    this.musicSource = null;
    this.cache = new Map(); // For SFX
  }

  async streamMusic(trackUrl) {
    // Fetch and decode in chunks
    const response = await fetch(trackUrl);
    const reader = response.body.getReader();
    const chunks = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    // Combine and decode
    const blob = new Blob(chunks);
    const arrayBuffer = await blob.arrayBuffer();
    this.musicBuffer = await this.musicContext.decodeAudioData(arrayBuffer);

    // Play
    this.playMusic();
  }

  async preloadSFX(sfxUrls) {
    // Preload common SFX into cache
    for (const url of sfxUrls) {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.sfxContext.decodeAudioData(arrayBuffer);
      this.cache.set(url, audioBuffer);
    }
  }

  playSFX(url) {
    const buffer = this.cache.get(url);
    if (buffer) {
      const source = this.sfxContext.createBufferSource();
      source.buffer = buffer;
      source.connect(this.sfxContext.destination);
      source.start(0);
    }
  }
}
```

### 2.4 WASM Binary Optimization

#### Compiler Flags

```bash
# Swift compiler flags for WASM
swift build \
  --configuration release \
  -Xswiftc -O \
  -Xswiftc -Xlinker --lto=full \
  -Xswiftc -opt-size
```

#### Optimization Techniques

1. **Link-Time Optimization (LTO)**
   - Cross-module optimization
   - Dead code elimination
   - 15-25% size reduction

2. **Aggressive Inlining Control**
   - Inline hot paths
   - Don't inline cold code
   - Reduces binary size

3. **Exception Handling**
   - Disable exceptions if not needed
   - Use error codes instead
   - Significant size savings

4. **Runtime Stripping**
   - Remove unused runtime functions
   - Custom runtime for minimal footprint

#### Size Breakdown

| Component | Unoptimized | Optimized | Notes |
|-----------|-------------|-----------|-------|
| core.wasm | 10-15 MB | 2-5 MB | LTO + stripping |
| runtime.js | 400 KB | 200-500 KB | Minified |
| Three.js | 600 KB | 200-300 KB | Module + minified |
| Total | 11-16 MB | 3-6 MB | |

---

## 3. Streaming and Lazy Loading Strategy

### 3.1 Initial Load Package (5-10 MB)

The initial load package contains everything needed for the menu and first room:

```
initial_load/
├── core.wasm              # 2-5 MB (WASM binary)
├── runtime.js             # 200-500 KB
├── three.min.js           # 200-300 KB (module)
├── menu_assets/
│   ├── title_screen/      # 1-2 MB
│   │   ├── background.webp
│   │   ├── logo.webp
│   │   └── animation.webm
│   ├── ui_elements/       # 200-400 KB
│   │   ├── buttons.webp
│   │   ├── icons.webp
│   │   └── fonts.woff2
│   └── menu_music.ogg     # 1-2 MB (looping ambient)
├── starting_room/         # 2-3 MB
│   ├── entrance_hall.glb  # 100-200 KB (Draco compressed)
│   ├── entrance_hall_textures/
│   │   ├── walls_atlas.webp    # 300-500 KB
│   │   ├── floor_atlas.webp    # 200-300 KB
│   │   └── ceiling_atlas.webp  # 100-200 KB
│   ├── entrance_ambient.ogg    # 200-300 KB
│   └── collision.glb           # 50-100 KB
├── save_slots/            # 50-100 KB
│   ├── empty_slot_1.json
│   ├── empty_slot_2.json
│   └── empty_slot_3.json
└── loading_screen/
    ├── progress_bar.webp
    └── loading_tips.json
```

### 3.2 On-Demand Asset Loading

Assets are loaded as needed based on player location and events:

```
on_demand/
├── containment_rooms/     # 8-12 MB total (lazy)
│   ├── scp_173/
│   │   ├── room.glb      # 150 KB
│   │   ├── textures.webp # 300 KB
│   │   └── scp_173.glb   # 60 KB
│   ├── scp_096/
│   │   └── ...
│   ├── scp_106/
│   │   └── ...
│   ├── scp_049/
│   │   └── ...
│   └── scp_939/
│       └── ...
├── hc_rooms/              # 5-8 MB total
│   ├── room_001.glb
│   ├── room_002.glb
│   └── ...
├── ez_rooms/              # 5-8 MB total
│   ├── room_001.glb
│   └── ...
├── forest_areas/          # 3-5 MB
│   ├── forest_edge.glb
│   ├── forest_deep.glb
│   └── ...
├── music/                 # 15-30 MB total (streamed)
│   ├── track_01.ogg      # 1-2 MB
│   ├── track_02.ogg
│   └── ...
├── sfx/                   # 10-20 MB total (cached)
│   ├── footsteps/
│   ├── doors/
│   ├── ambience/
│   └── scp_sounds/
└── voice/                 # 5-10 MB total (cached)
    ├── scp_announce/
    └── radio/
```

### 3.3 Loading Priority

```javascript
// Loading priority system
const LOADING_PRIORITY = {
  CRITICAL: 0,      // Current room geometry + textures
  HIGH: 1,          // Current room audio, NPC models
  MEDIUM: 2,        // Adjacent rooms
  LOW: 3,           // Music tracks, distant areas
  BACKGROUND: 4     // Optional content, optimization
};

class AssetLoader {
  constructor() {
    this.queue = new PriorityQueue();
    this.loaded = new Set();
    this.loading = new Set();
  }

  requestAsset(url, priority = LOADING_PRIORITY.MEDIUM) {
    if (this.loaded.has(url)) return;

    this.queue.push({ url, priority });
    this.processQueue();
  }

  async processQueue() {
    if (this.loading.size >= 4) return; // Max 4 concurrent

    const item = this.queue.pop();
    if (!item) return;

    this.loading.add(item.url);

    try {
      await this.fetchAndCache(item.url);
      this.loaded.add(item.url);
      this.onLoadProgress(item.url);
    } catch (error) {
      console.error(`Failed to load: ${item.url}`, error);
      // Retry with backoff
      setTimeout(() => this.requestAsset(item.url, item.priority), 5000);
    }

    this.loading.delete(item.url);
    this.processQueue(); // Continue processing
  }
}
```

### 3.4 Preloading Strategy

```javascript
// Preload adjacent rooms when in current room
class RoomPreloader {
  constructor(assetLoader) {
    this.loader = assetLoader;
  }

  preloadAdjacentRooms(currentRoom) {
    const adjacent = this.getAdjacentRooms(currentRoom);

    for (const room of adjacent) {
      // Low priority preload
      this.loader.requestAsset(
        `rooms/${room}/geometry.glb`,
        LOADING_PRIORITY.MEDIUM
      );
      this.loader.requestAsset(
        `rooms/${room}/textures.webp`,
        LOADING_PRIORITY.LOW
      );
    }
  }

  preloadSCPWhenNear(scpLocation, distance) {
    if (distance < 50) { // 50 units away
      this.loader.requestAsset(
        `npcs/${scpType}/model.glb`,
        LOADING_PRIORITY.HIGH
      );
      this.loader.requestAsset(
        `npcs/${scpType}/textures.webp`,
        LOADING_PRIORITY.HIGH
      );
      this.loader.requestAsset(
        `npcs/${scpType}/sounds.ogg`,
        LOADING_PRIORITY.MEDIUM
      );
    }
  }
}
```

---

## 4. Caching Strategy

### 4.1 Service Worker Caching

```javascript
// sw.js - Service Worker
const CACHE_NAME = 'scpcb-v1.0.0';
const ASSETS = {
  CRITICAL: [
    '/',
    '/index.html',
    '/core.wasm',
    '/runtime.js',
    '/three.module.js',
    '/manifest.json'
  ],
  INITIAL: [
    '/menu_assets/',
    '/starting_room/',
    '/save_slots/'
  ],
  PERSISTENT: [
    // Large assets that shouldn't auto-clear
    '/npcs/',
    '/music/'
  ]
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Install critical assets immediately
      await cache.addAll(ASSETS.CRITICAL);

      // Precache initial assets in background
      self.skipWaiting();
      caches.open(CACHE_NAME).then((cache) => {
        cache.addAll(ASSETS.INITIAL);
      });
    })
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip cross-origin requests
  if (url.origin !== location.origin) return;

  // Check cache first for critical assets
  if (ASSETS.CRITICAL.includes(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return cached || fetch(event.request);
      })
    );
    return;
  }

  // Network first, cache fallback for assets
  event.respondWith(
    fetch(event.request).then((response) => {
      // Cache successful responses
      if (response.ok) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, clone);
        });
      }
      return response;
    }).catch(() => {
      return caches.match(event.request);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});
```

### 4.2 IndexedDB Asset Storage

```javascript
// asset-cache.js - IndexedDB for large binary assets
const DB_NAME = 'scpcb-assets';
const DB_VERSION = 1;

class AssetCache {
  constructor() {
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Textures store
        if (!db.objectStoreNames.contains('textures')) {
          const textureStore = db.createObjectStore('textures', { keyPath: 'id' });
          textureStore.createIndex('hash', 'hash', { unique: false });
        }

        // Audio store
        if (!db.objectStoreNames.contains('audio')) {
          const audioStore = db.createObjectStore('audio', { keyPath: 'id' });
          audioStore.createIndex('hash', 'hash', { unique: false });
        }

        // 3D Models store
        if (!db.objectStoreNames.contains('models')) {
          const modelStore = db.createObjectStore('models', { keyPath: 'id' });
          modelStore.createIndex('hash', 'hash', { unique: false });
        }

        // Save games store
        if (!db.objectStoreNames.contains('saves')) {
          db.createObjectStore('saves', { keyPath: 'slot' });
        }
      };
    });
  }

  async getAsset(store, id) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([store], 'readonly');
      const request = transaction.objectStore(store).get(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result?.data);
    });
  }

  async setAsset(store, id, data, hash) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([store], 'readwrite');
      const request = transaction.objectStore(store).put({
        id,
        data,
        hash,
        timestamp: Date.now()
      });

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async hasAsset(store, id) {
    return new Promise((resolve) => {
      const transaction = this.db.transaction([store], 'readonly');
      const request = transaction.objectStore(store).count(id);

      request.onerror = () => resolve(false);
      request.onsuccess = () => resolve(request.result > 0);
    });
  }

  async getAssetHash(store, id) {
    return new Promise((resolve) => {
      const transaction = this.db.transaction([store], 'readonly');
      const request = transaction.objectStore(store).get(id);

      request.onerror = () => resolve(null);
      request.onsuccess = () => {
        resolve(request.result?.hash || null);
      };
    });
  }
}

// Usage
async function loadTexture(id) {
  const cache = new AssetCache();
  await cache.init();

  // Get manifest entry
  const manifest = await fetch(`/assets/manifest.json`).then(r => r.json());
  const entry = manifest.textures[id];

  // Check cache with hash verification
  const cachedHash = await cache.getAssetHash('textures', id);
  if (cachedHash === entry.hash) {
    return await cache.getAsset('textures', id);
  }

  // Fetch and cache
  const response = await fetch(entry.url);
  const blob = await response.blob();

  await cache.setAsset('textures', id, blob, entry.hash);

  return blob;
}
```

### 4.3 Cache Invalidation Strategy

```javascript
// cache-invalidation.js
class CacheManager {
  constructor() {
    this.manifest = null;
  }

  async loadManifest() {
    this.manifest = await fetch('/assets/manifest.json').then(r => r.json());
  }

  async checkForUpdates() {
    if (!this.manifest) await this.loadManifest();

    const updates = [];

    // Check each asset type
    for (const [type, assets] of Object.entries(this.manifest)) {
      for (const [id, entry] of Object.entries(assets)) {
        const cachedHash = await this.getCachedHash(type, id);
        if (cachedHash !== entry.hash) {
          updates.push({ type, id, ...entry });
        }
      }
    }

    return updates;
  }

  async getCachedHash(type, id) {
    // Check IndexedDB for current hash
    const cache = new AssetCache();
    await cache.init();
    return await cache.getAssetHash(type, id);
  }

  async downloadUpdates(updates, onProgress) {
    let downloaded = 0;
    const total = updates.length;

    for (const update of updates) {
      const response = await fetch(update.url);
      const blob = await response.blob();

      await this.cacheAsset(update.type, update.id, blob, update.hash);

      downloaded++;
      onProgress(downloaded / total);
    }
  }

  async cacheAsset(type, id, data, hash) {
    const cache = new AssetCache();
    await cache.init();
    await cache.setAsset(type, id, data, hash);
  }
}
```

---

## 5. Technical Architecture

### 5.1 Directory Structure

```
scpcb-wasm/
├── index.html                 # Entry point, canvas container
├── manifest.json              # PWA manifest
├── sw.js                      # Service worker
├── favicon.ico
│
├── core/                      # Core application
│   ├── index.html            # Game container
│   ├── main.js               # Bootstrap, initialization
│   ├── style.css             # UI styling
│   ├── core.wasm             # Compiled game logic
│   ├── core.wasm.map         # Source map (dev only)
│   ├── runtime.js            # BlitzBasic runtime shim
│   ├── config.json           # Runtime configuration
│   └── error-boundary.js     # Error handling wrapper
│
├── assets/
│   ├── manifest.json         # Asset manifest with hashes
│   ├── compressed/           # Pre-compressed assets (.br, .gz)
│   │   ├── textures/
│   │   ├── models/
│   │   ├── audio/
│   │   └── config/
│   ├── initial/              # Initial load package
│   │   ├── core.wasm.br
│   │   ├── runtime.js.br
│   │   ├── menu_assets/
│   │   └── starting_room/
│   ├── streaming/            # Lazy loaded
│   │   ├── rooms/
│   │   ├── npcs/
│   │   └── music/
│   └── cache/                # IndexedDB-managed
│       ├── textures/
│       ├── audio/
│       └── models/
│
├── libs/
│   ├── three.module.js       # Three.js (ES module)
│   ├── draco/                # Draco decoder
│   │   ├── draco_decoder.js
│   │   └── draco_decoder.wasm
│   └── zlib.wasm             # For compressed assets
│
├── save_data/                 # IndexedDB save storage
├── debug/                     # Development tools
│   ├── console.html
│   └── profiler.html
│
└── docs/
    ├── controls.md
    └── troubleshooting.md
```

### 5.2 Runtime Architecture

```javascript
// main.js - Application bootstrap
class SCPBGame {
  constructor() {
    this.canvas = null;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.assetLoader = null;
    this.audioManager = null;
    this.gameState = null;
    this.wasmModule = null;
  }

  async init() {
    // Create canvas
    this.createCanvas();

    // Initialize Three.js
    this.initThreeJS();

    // Load WASM
    await this.loadWASM();

    // Initialize asset loader
    this.assetLoader = new AssetLoader();
    await this.assetLoader.init();

    // Initialize audio
    this.audioManager = new AudioManager();
    await this.audioManager.init();

    // Load initial assets
    await this.loadInitialAssets();

    // Start game
    this.startGame();
  }

  createCanvas() {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'game-canvas';
    document.getElementById('game-container').appendChild(this.canvas);
  }

  async loadWASM() {
    const response = await fetch('/core/core.wasm');
    const buffer = await response.arrayBuffer();
    this.wasmModule = await WebAssembly.instantiate(buffer, {
      env: this.createWASMImports()
    });
  }

  createWASMImports() {
    return {
      // Graphics functions
      createTexture: (ptr, len) => this.createTexture(ptr, len),
      createMaterial: (ptr) => this.createMaterial(ptr),
      createMesh: (ptr) => this.createMesh(ptr),

      // Input functions
      keyDown: (key) => this.input.keyDown(key),
      keyHit: (key) => this.input.keyHit(key),
      mouseX: () => this.input.mouseX(),
      mouseY: () => this.input.mouseY(),

      // Audio functions
      playSound: (ptr) => this.audioManager.playSound(ptr),
      stopSound: (id) => this.audioManager.stopSound(id),

      // Memory functions
      allocate: (size) => this.memory.allocate(size),
      free: (ptr) => this.memory.free(ptr),

      // Logging
      print: (ptr, len) => console.log(this.memory.readString(ptr, len))
    };
  }

  async loadInitialAssets() {
    // Show loading screen
    this.showLoadingScreen();

    // Load core assets
    await Promise.all([
      this.assetLoader.loadPriority('critical'),
      this.assetLoader.loadPriority('initial')
    ]);

    // Hide loading screen
    this.hideLoadingScreen();
  }

  startGame() {
    // Initialize WASM game state
    this.wasmModule.exports.game_init();

    // Start render loop
    this.animate();

    // Start game loop (WASM side handles this)
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    // Update WASM
    this.wasmModule.exports.game_update();

    // Render
    this.renderer.render(this.scene, this.camera);
  }
}
```

### 5.3 Three.js Integration

```javascript
// graphics.js - Three.js wrapper
class GraphicsManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      75, canvas.width / canvas.height, 0.1, 1000
    );
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });

    this.textures = new Map();
    this.materials = new Map();
    this.meshes = new Map();
    this.lights = [];

    this.init();
  }

  init() {
    // Renderer settings
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Fog for atmosphere
    this.scene.fog = new THREE.FogExp2(0x000000, 0.03);

    // Camera setup
    this.camera.position.set(0, 1.7, 0);

    // Default lighting
    this.setupDefaultLighting();
  }

  setupDefaultLighting() {
    // Ambient light (dim)
    const ambient = new THREE.AmbientLight(0x222222);
    this.scene.add(ambient);

    // Flashlight (attached to camera later)
    this.flashlight = new THREE.SpotLight(0xffffff, 1);
    this.flashlight.position.set(0.3, -0.3, -0.5);
    this.flashlight.angle = Math.PI / 6;
    this.flashlight.penumbra = 0.5;
    this.flashlight.distance = 30;
    this.flashlight.castShadow = true;
    this.camera.add(this.flashlight);

    // Add camera to scene
    this.scene.add(this.camera);
  }

  async loadTexture(id, url) {
    if (this.textures.has(id)) {
      return this.textures.get(id);
    }

    const response = await fetch(url);
    const blob = await response.blob();
    const imageBitmap = await createImageBitmap(blob);

    const texture = new THREE.CanvasTexture(imageBitmap);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.maxFilter = THREE.LinearFilter;

    this.textures.set(id, texture);
    return texture;
  }

  async loadModel(id, url) {
    if (this.meshes.has(id)) {
      return this.meshes.get(id);
    }

    const response = await fetch(url);
    const blob = await response.blob();

    // Load glTF with Draco
    const loader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('/libs/draco/');
    loader.setDRACOLoader(dracoLoader);

    const gltf = await new Promise((resolve, reject) => {
      loader.load(
        URL.createObjectURL(blob),
        resolve,
        undefined,
        reject
      );
    });

    const mesh = gltf.scene;
    this.meshes.set(id, mesh);
    this.scene.add(mesh);

    return mesh;
  }

  setFlashlight(enabled) {
    this.flashlight.visible = enabled;
  }

  resize(width, height) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }
}
```

---

## 6. Save System Architecture

### 6.1 Save Data Structure

```javascript
// Save data stored in IndexedDB
const saveData = {
  header: {
    version: 11,
    timestamp: Date.now(),
    playTime: 3600, // seconds
    difficulty: 'HARD'
  },
  player: {
    room: 123, // Room ID
    health: 75,
    stamina: 50,
    sanity: 80,
    blinkTimer: 0.8,
    position: { x: 5.2, y: 1.7, z: -3.1 },
    rotation: { pitch: 0, yaw: 180, roll: 0 }
  },
  inventory: {
    slots: [
      { type: 'medkit', quantity: 1 },
      { type: 'battery', quantity: 2 },
      null,
      // ... 9 slots total
    ],
    equipment: {
      nvg: false,
      gasMask: false,
      flashlight: false
    }
  },
  gameProgress: {
    deadNPCs: ['scp_173', 'scp_049'],
    visitedRooms: [100, 101, 102, 123],
    completedEvents: ['mtf_ambush_1'],
    achievements: []
  },
  world: {
    doorStates: { 'door_123_0': 'open' },
    itemStates: { 'key_456': 'picked_up' },
    npcStates: {
      'scp_096': {
        triggered: false,
        position: { x: 0, y: 0, z: 0 }
      }
    }
  }
};
```

### 6.2 Save System Implementation

```javascript
// save-system.js
class SaveSystem {
  constructor(assetCache) {
    this.cache = assetCache;
    this.currentSlot = -1;
  }

  async save(slot, data) {
    const saveData = {
      ...data,
      header: {
        ...data.header,
        version: SAVE_VERSION,
        timestamp: Date.now()
      }
    };

    // Validate data
    if (!this.validateSaveData(saveData)) {
      throw new Error('Invalid save data');
    }

    // Add checksum
    saveData.checksum = this.calculateChecksum(saveData);

    // Save to IndexedDB
    await this.cache.setAsset('saves', `slot_${slot}`, saveData);

    // Also backup to localStorage (small saves only)
    try {
      localStorage.setItem(`scpcb_save_${slot}`, JSON.stringify({
        header: saveData.header,
        player: saveData.player,
        inventory: saveData.inventory
      }));
    } catch (e) {
      // localStorage full, ignore
    }

    this.currentSlot = slot;
    this.updateSaveSlotUI(slot);
  }

  async load(slot) {
    // Try IndexedDB first
    let saveData = await this.cache.getAsset('saves', `slot_${slot}`);

    if (!saveData) {
      // Try localStorage backup
      const backup = localStorage.getItem(`scpcb_save_${slot}`);
      if (backup) {
        saveData = JSON.parse(backup);
      }
    }

    if (!saveData) {
      throw new Error(`No save found in slot ${slot}`);
    }

    // Verify checksum
    if (!this.verifyChecksum(saveData)) {
      throw new Error('Save file corrupted');
    }

    // Verify version
    if (saveData.header.version !== SAVE_VERSION) {
      // Handle migration
      saveData = await this.migrateSave(saveData);
    }

    this.currentSlot = slot;
    return saveData;
  }

  calculateChecksum(data) {
    // Create string representation
    const json = JSON.stringify({
      header: data.header,
      player: data.player,
      inventory: data.inventory,
      gameProgress: data.gameProgress,
      world: data.world
    });

    // Simple checksum (CRC32 would be better)
    let hash = 0;
    for (let i = 0; i < json.length; i++) {
      const char = json.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash;
  }

  validateSaveData(data) {
    // Check required fields
    if (!data.header) return false;
    if (!data.player) return false;
    if (!data.inventory) return false;
    if (data.header.playTime < 0) return false;
    if (data.player.health < 0 || data.player.health > 100) return false;

    return true;
  }

  getSaveSlots() {
    const slots = [];
    for (let i = 0; i < MAX_SAVE_SLOTS; i++) {
      const exists = localStorage.getItem(`scpcb_save_${i}`) !== null;
      slots.push({
        slot: i,
        exists,
        lastModified: localStorage.getItem(`scpcb_save_${i}_time`)
      });
    }
    return slots;
  }
}
```

---

## 7. Performance Targets and Monitoring

### 7.1 Performance Metrics

| Metric | Target | Acceptable | Poor |
|--------|--------|------------|------|
| Initial load time | < 10s | < 30s | > 30s |
| Time to playable | < 5s | < 15s | > 15s |
| Frame rate (playable areas) | 60 FPS | 30 FPS | < 30 FPS |
| Frame rate (intense scenes) | 30 FPS | 20 FPS | < 20 FPS |
| Memory usage | < 1 GB | < 1.5 GB | > 1.5 GB |
| Asset load time | < 1s | < 3s | > 3s |
| Save/load time | < 2s | < 5s | > 5s |

### 7.2 Monitoring Implementation

```javascript
// performance-monitor.js
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      fps: [],
      memory: [],
      loadTimes: {},
      frameTimes: []
    };

    this.startMonitoring();
  }

  startMonitoring() {
    // FPS monitoring
    setInterval(() => this.recordFPS(), 1000);

    // Memory monitoring
    if (performance.memory) {
      setInterval(() => this.recordMemory(), 5000);
    }

    // Long task monitoring
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 50) {
            this.reportLongTask(entry);
          }
        }
      });
      observer.observe({ entryTypes: ['longtask'] });
    }
  }

  recordFPS() {
    const fps = this.calculateFPS();
    this.metrics.fps.push({
      timestamp: Date.now(),
      value: fps
    });

    // Keep last 60 samples
    if (this.metrics.fps.length > 60) {
      this.metrics.fps.shift();
    }

    // Log if poor performance
    if (fps < 30) {
      console.warn('Low FPS detected:', fps);
    }
  }

  recordMemory() {
    if (performance.memory) {
      this.metrics.memory.push({
        timestamp: Date.now(),
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize
      });
    }
  }

  calculateFPS() {
    const now = performance.now();
    const frames = this.metrics.frameTimes.filter(
      t => now - t < 1000
    ).length;
    return frames;
  }

  getAverageFPS() {
    const recent = this.metrics.fps.slice(-60);
    if (recent.length === 0) return 0;

    const sum = recent.reduce((a, b) => a + b.value, 0);
    return sum / recent.length;
  }

  getMemoryUsage() {
    if (!performance.memory) return null;

    return {
      used: (performance.memory.usedJSHeapSize / 1048576).toFixed(2) + ' MB',
      total: (performance.memory.totalJSHeapSize / 1048576).toFixed(2) + ' MB',
      limit: (performance.memory.jsHeapSizeLimit / 1048576).toFixed(2) + ' MB'
    };
  }

  reportLongTask(entry) {
    console.warn('Long task detected:', {
      duration: entry.duration,
      startTime: entry.startTime,
      attribution: entry.attribution
    });
  }

  getReport() {
    return {
      fps: {
        current: this.calculateFPS(),
        average: this.getAverageFPS(),
        min: Math.min(...this.metrics.fps.map(m => m.value)),
        max: Math.max(...this.metrics.fps.map(m => m.value))
      },
      memory: this.getMemoryUsage(),
      loadTimes: this.metrics.loadTimes
    };
  }
}
```

---

## 8. Timeline and Milestones

### 8.1 Development Timeline

| Phase | Duration | Weeks | Deliverables |
|-------|----------|-------|--------------|
| **Phase 1: Infrastructure** | 2 weeks | 1-2 | Build system, WASM runtime |
| **Phase 2: Core Engine** | 3 weeks | 3-5 | Graphics, input, audio |
| **Phase 3: Asset Pipeline** | 2 weeks | 6-7 | Optimization tools, conversion |
| **Phase 4: Game Systems** | 3 weeks | 8-10 | NPC, inventory, save, events |
| **Phase 5: UI/UX** | 2 weeks | 11-12 | Menus, HUD, settings |
| **Phase 6: Testing** | 2 weeks | 13-14 | Bug fixes, optimization |
| **Phase 7: Deployment** | 1 week | 15 | CDN, PWA, analytics |

### 8.2 Milestone Breakdown

#### Milestone 1: WASM Compiler Working (Week 2)
- [ ] Swift compiler builds without errors
- [ ] Simple BB test program compiles to WASM
- [ ] Basic runtime in browser executes WASM
- [ ] Tests pass

#### Milestone 2: Core Engine (Week 5)
- [ ] Three.js renders 3D scene
- [ ] Player movement works
- [ ] Basic lighting and shadows
- [ ] Audio playback works
- [ ] Input handling (keyboard, mouse)

#### Milestone 3: Asset Pipeline (Week 7)
- [ ] Batch texture converter (WebP)
- [ ] Model converter (glTF + Draco)
- [ ] Audio converter (OGG optimization)
- [ ] Manifest generator with hashes

#### Milestone 4: Game Systems (Week 10)
- [ ] NPC AI works (at least one SCP)
- [ ] Inventory system functional
- [ ] Save/load works
- [ ] Room loading works
- [ ] Event system works

#### Milestone 5: UI/UX (Week 12)
- [ ] Main menu
- [ ] Pause menu
- [ ] Options (graphics, audio, controls)
- [ ] HUD displays correctly
- [ ] Loading screens

#### Milestone 6: Testing (Week 14)
- [ ] All SCPs functional
- [ ] No major bugs
- [ ] Performance targets met
- [ ] Tested on multiple browsers

#### Milestone 7: Deployment (Week 15)
- [ ] CDN configured
- [ ] PWA manifest works
- [ ] Service worker caching
- [ ] Analytics integrated
- [ ] Error reporting set up

---

## 9. Risks and Mitigations

### 9.1 Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| WASM binary too large | Medium | High | LTO, tree shaking, runtime stripping |
| Asset optimization insufficient | Medium | High | Multiple compression passes, WebP |
| Memory issues on low-end devices | Medium | High | Texture streaming, LOD, memory limits |
| Browser compatibility issues | Low | Medium | Test on all major browsers, fallbacks |
| Performance issues | Medium | High | Profiling, optimization passes, LOD |
| IndexedDB quota exceeded | Low | Medium | Implement cache eviction, compression |
| Network issues on slow connections | Medium | Medium | Aggressive compression, streaming |

### 9.2 Fallback Strategies

```javascript
// fallback-strategies.js
class FallbackManager {
  constructor() {
    this.qualityLevel = 'high';
    this.supportedFeatures = {};
  }

  async detectCapabilities() {
    // Check WebGL
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    this.supportedFeatures.webgl = !!gl;

    // Check WASM
    this.supportedFeatures.wasm = typeof WebAssembly === 'object' &&
      typeof WebAssembly.instantiate === 'function';

    // Check WebGL2
    this.supportedFeatures.webgl2 = !!canvas.getContext('webgl2');

    // Check SharedArrayBuffer (for threading)
    this.supportedFeatures.sharedArrayBuffer =
      typeof SharedArrayBuffer !== 'undefined';

    // Check memory
    if (performance.memory) {
      const totalMemory = performance.memory.jsHeapSizeLimit;
      this.supportedFeatures.lowMemory = totalMemory < 1073741824; // < 1GB
    }

    return this.supportedFeatures;
  }

  adjustQuality() {
    if (!this.supportedFeatures.webgl) {
      console.error('WebGL not supported');
      this.qualityLevel = 'minimum';
      return 'unsupported';
    }

    if (this.supportedFeatures.lowMemory) {
      this.qualityLevel = 'low';
      return 'low';
    }

    const gpu = this.detectGPU();
    if (gpu.isLowEnd) {
      this.qualityLevel = 'medium';
      return 'medium';
    }

    this.qualityLevel = 'high';
    return 'high';
  }

  getQualitySettings() {
    const settings = {
      unsupported: {
        textureSize: 256,
        textureQuality: 50,
        shadowQuality: 'off',
        effects: false,
        fpsLimit: 30
      },
      low: {
        textureSize: 512,
        textureQuality: 60,
        shadowQuality: 'low',
        effects: 'low',
        fpsLimit: 30
      },
      medium: {
        textureSize: 1024,
        textureQuality: 75,
        shadowQuality: 'medium',
        effects: 'medium',
        fpsLimit: 60
      },
      high: {
        textureSize: 2048,
        textureQuality: 90,
        shadowQuality: 'high',
        effects: 'high',
        fpsLimit: 60
      }
    };

    return settings[this.qualityLevel];
  }
}
```

---

## 10. Recommendations

### 10.1 Success Factors

1. **Aggressive Asset Compression**
   - Target 50 MB total download
   - Use WebP for textures (80%+ compression)
   - Use OGG 64-96kbps for music
   - Use Draco compression for models

2. **Smart Streaming**
   - Initial load: menu + starting room only
   - Preload adjacent rooms in background
   - Stream music, cache SFX
   - Use priority queue for loading

3. **PWA with Service Worker**
   - Cache critical assets on first load
   - Enable offline play after initial load
   - Versioned cache keys for updates

4. **IndexedDB for Large Assets**
   - Store textures, audio, models
   - Hash-based cache invalidation
   - Automatic cleanup of old assets

5. **Performance Monitoring**
   - Track FPS, memory, load times
   - Auto-adjust quality based on device
   - Report metrics for optimization

### 10.2 Technical Decisions

| Decision | Recommendation | Reason |
|----------|---------------|--------|
| 3D Format | glTF + Draco | Web-ready, good compression |
| Texture Format | WebP | Best compression/quality ratio |
| Audio Format | OGG | Good compression, wide support |
| WASM Optimization | LTO + strip | Minimize binary size |
| Caching | Service Worker + IndexedDB | Best of both worlds |
| Save Storage | IndexedDB + localStorage backup | Persistent + fast |
| Asset Delivery | CDN with compression | Fast global delivery |

### 10.3 Future Enhancements

- **WebGPU Support**: Migrate from WebGL to WebGPU for better performance
- **Variable Rate Shading**: Improve performance on supported hardware
- **WebXR Support**: Enable VR mode for immersive experience
- **Cloud Saves**: Sync saves across devices
- **Mod Support**: Allow custom assets and mods
- **Multiplayer**: Add co-op or competitive modes

---

## 11. Appendices

### Appendix A: File Format References

| Format | Extension | Purpose | Tool |
|--------|-----------|---------|------|
| 3D Models | .glb, .gltf | 3D geometry | Blender, glTF-Office |
| Textures | .webp | 2D images | cwebp, ImageMagick |
| Audio | .ogg | Sound | ffmpeg |
| WASM | .wasm | Compiled code | Swift compiler |
| Configuration | .json | Game config | Text editor |
| Manifest | .json | Asset list | Custom tool |

### Appendix B: Browser Compatibility

| Browser | Version | WASM | WebGL 2 | WebP | IndexedDB |
|---------|---------|------|---------|------|-----------|
| Chrome | 80+ | ✓ | ✓ | ✓ | ✓ |
| Firefox | 75+ | ✓ | ✓ | ✓ | ✓ |
| Edge | 80+ | ✓ | ✓ | ✓ | ✓ |
| Safari | 14+ | ✓ | ✓ | ✓ | ✓ |
| Mobile Chrome | 80+ | ✓ | ✓ | ✓ | ✓ |
| Mobile Safari | 14+ | ✓ | ✓ | ✓ | ✓ |

### Appendix C: CDN Configuration

```nginx
# CDN configuration (nginx)
server {
    listen 80;
    server_name cdn.scpcb.example.com;

    # Gzip pre-compression
    gzip on;
    gzip_types application/wasm application/javascript
               application/json image/webp model/gltf+json;

    # Brotli (if available)
    brotli on;
    brotli_types application/wasm application/javascript
                 application/json image/webp model/gltf+json;

    # Cache headers
    location ~* \.(wasm|js|json|webp|glb|ogg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # Serve pre-compressed
    location ~* \.(js|wasm)$ {
        try_files $uri$br $uri $uri/ =404;
    }
}
```

---

## Document Information

| Field | Value |
|-------|-------|
| Document ID | SCPCB-WASM-PLAN-001 |
| Version | 1.0 |
| Status | Planning |
| Created | 2026-01-18 19:52:00 UTC |
| Git Hash | f2dd13e52ef6fbfba9ab97e8de7005a27c13d065 |
| Author | OpenCode AI System |
| Classification | Technical Planning Document |

---

*End of Document*
