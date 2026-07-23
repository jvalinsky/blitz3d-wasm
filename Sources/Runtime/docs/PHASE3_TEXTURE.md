# Phase 3: Texture Loading System

## Overview

Phase 3 implements a comprehensive texture loading system for SCPCB assets,
supporting BMP, JPG, PNG, and DDS formats with proper caching and material
integration.

## Components

### 1. Texture Loader (`texture.js`)

Core texture loading system with features:

- **Format Support**: BMP, JPG, PNG, DDS
- **Caching**: LRU-style texture cache
- **Async Loading**: Non-blocking texture loading
- **Placeholder System**: Pink checkerboard for missing textures
- **Mipmap Generation**: Automatic mipmap creation
- **Anisotropy**: Enhanced texture quality at angles

### 2. Material System (`material.js`)

Blitz3D-compatible material/brush system:

- **Brush Creation**: Create and configure brushes
- **Texture Assignment**: Up to 2 texture units per brush
- **Blend Modes**: Replace, Add, Alpha, Multiply, Blend
- **Material Properties**: Color, ambient, emissive, shininess
- **Surface Painting**: Apply materials to surfaces

### 3. Graphics Integration

Updated `graphics.js` with:

- Texture loader initialization
- Material system integration
- WASM imports for texture/material functions

## Features

### Supported Texture Formats

| Format | Support | Notes                                     |
| ------ | ------- | ----------------------------------------- |
| BMP    | Full    | Uncompressed, 8/16/24/32-bit              |
| JPG    | Full    | Baseline JPEG                             |
| PNG    | Full    | RGBA support                              |
| DDS    | Partial | Basic support, compressed formats limited |

### BMP Format Support

```
Header Types:
├── BITMAPINFOHEADER (40 bytes) - Windows
└── BITMAPCOREHEADER (12 bytes) - OS/2

Pixel Formats:
├── 8-bit indexed color
├── 16-bit (5-6-5 RGB)
├── 24-bit RGB
└── 32-bit RGBA
```

### Texture Cache System

```
┌─────────────────────────────────────┐
│         Texture Cache               │
├─────────────────────────────────────┤
│  path -> THREE.Texture              │
│  - Automatic caching                │
│  - LRU eviction (100 textures)      │
│  - Loading state tracking           │
│  - Memory management                │
└─────────────────────────────────────┘
```

### Blend Mode Mapping

| Blitz3D Mode | Name     | Three.js Blending            |
| ------------ | -------- | ---------------------------- |
| 0            | Replace  | NoBlending                   |
| 1            | Add      | AdditiveBlending             |
| 2            | Alpha    | NormalBlending (transparent) |
| 3            | Multiply | MultiplyBlending             |
| 5            | Blend    | NormalBlending (opacity)     |

## Usage

### Basic Texture Loading

```javascript
// Initialize texture loader
const textureLoader = new Blitz3DTextureLoader(graphics, fileIO, assetManager);
textureLoader.init();

// Load a texture
const texture = await textureLoader.loadTexture("textures/wall.png", {
  smooth: true,
  wrapU: THREE.RepeatWrapping,
  wrapV: THREE.RepeatWrapping,
});
```

### Using with Materials

```javascript
// Create a brush
const brushId = material.createBrush();

// Set brush color
material.brushColor(brushId, 255, 128, 64);

// Add textures
material.brushTexture(brushId, textureId1, 0, 0); // Diffuse
material.brushTexture(brushId, textureId2, 0, 1); // Lightmap

// Set blend mode
material.brushBlend(brushId, 3); // Multiply (lightmap)

// Paint surface
material.paintSurface(surfaceId, brushId);
```

### Direct Material Creation

```javascript
// Create material from brush
const threeMaterial = material.createMaterialFromBrush(brush);

// Apply to mesh
mesh.material = threeMaterial;
```

## Texture Options

```javascript
const options = {
  smooth: true, // Linear filtering
  wrapU: THREE.RepeatWrapping, // U wrapping
  wrapV: THREE.RepeatWrapping, // V wrapping
  flags: 0, // Blitz3D texture flags
};
```

## Placeholder Textures

When textures fail to load, a pink checkerboard pattern is used:

```
Pink (#ff69b4) + Deep Pink (#ff1493) checkerboard
Standard indicator for missing textures in games
```

## Performance

### Optimization Strategies

1. **Texture Atllas**: Combine multiple small textures
2. **Mipmaps**: Pre-generate for better performance
3. **Compression**: Use DDS BC formats where supported
4. **Streaming**: Load textures on demand

### Cache Management

```javascript
// Get cache stats
const stats = textureLoader.getStats();
console.log(`Cached: ${stats.cached}, Loading: ${stats.loading}`);

// Clear cache
textureLoader.clearCache();

// Remove specific texture
textureLoader.uncacheTexture("textures/wall.png");
```

## WASM Integration

### Texture Functions

```blitz3d
; Load texture with flags
tex = LoadTexture("textures/wall.png", 1)

; Free texture
FreeTexture(tex)

; Get texture dimensions
width = TextureWidth(tex)
height = TextureHeight(tex)

; Set texture blend mode
TextureBlend(tex, 3)  ; Multiply
```

### Material Functions

```blitz3d
; Create brush
brush = CreateBrush()

; Set brush properties
BrushColor brush, 255, 128, 64
BrushAmbient brush, 64, 64, 64
BrushShininess brush, 30

; Add texture to brush
BrushTexture brush, tex, 0, 0

; Paint surface
PaintSurface surface, brush

; Free brush
FreeBrush brush
```

## Testing

Run texture tests:

```bash
cd Sources/Runtime
node tools/test_texture.js
```

Expected output:

```
Running Texture Loader Tests...

Test: BMP Header Parsing
  ✓ Standard Windows BMP detected
  ✓ OS/2 BMP detected
Test: Texture Caching
  ✓ Cache retrieval works
  ✓ Cache miss handling
  ✓ Cache size tracking
Test: Placeholder Texture
  ✓ Placeholder pattern correct
Test: Material System
  ✓ Brush creation
  ✓ Brush properties
  ✓ Texture assignment
Test: Texture Blending
  ✓ Blend mode mappings

--- Test Results ---
Passed: 12
Failed: 0
Total: 12
```

## Limitations

1. **DDS Compression**: DXT compressed textures use placeholder
2. **Animation**: Animated textures not yet supported
3. **Cubemaps**: Basic support, incomplete
4. **NPOT Textures**: Some filtering limitations

## Future Enhancements

- [ ] DDS compression support (BC1-BC7)
- [ ] Texture animation system
- [ ] Procedural texture generation
- [ ] Texture compression tools
- [ ] GPU texture compression
- [ ] Virtual texturing
