# NPC Demo Documentation

## URL

**https://blitz3d.exe.xyz:8000/npc_smpk_demo.html**

## Overview

Browser-based viewer for SCPCB NPC models converted to SMPK format.
Demonstrates:

- SMPK format loading with full material/texture support
- SCPCB-style lighting and atmosphere
- Camera controls for model inspection
- Auto-detection of normal and specular maps

## Controls

### Movement

| Key             | Action                |
| --------------- | --------------------- |
| W / Arrow Up    | Move forward          |
| S / Arrow Down  | Move backward         |
| A / Arrow Left  | Strafe left           |
| D / Arrow Right | Strafe right          |
| Q               | Move up (free mode)   |
| E               | Move down (free mode) |

### Camera Modes

| Input              | Action                                 |
| ------------------ | -------------------------------------- |
| Right-click + drag | Orbit around model                     |
| Left-click + drag  | Aim flashlight                         |
| Scroll wheel       | Zoom (orbit mode)                      |
| M                  | Cycle modes: Free → Orbit → Flashlight |
| R                  | Reset view                             |

### View Presets

| Key | View     |
| --- | -------- |
| 1   | Front    |
| 2   | Back     |
| 3   | Top      |
| 4   | Side     |
| 5   | Close-up |
| 6   | Feet     |

### Animation

| Key   | Action                   |
| ----- | ------------------------ |
| SPACE | Toggle NPC auto-rotation |

## Lighting (SCPCB-Style)

Values derived from SCPCB source code analysis:

| Setting       | Value                                     | Notes                          |
| ------------- | ----------------------------------------- | ------------------------------ |
| Brightness    | 140/255 (0.55)                            | SCPCB options.ini default      |
| Ambient Light | Color(0.55, 0.55, 0.55)                   | Gray, not blue-tinted          |
| Flashlight    | SpotLight(0xfff5e0, 8, 20, π/5, 0.4, 1.5) | Warm white, held in right hand |
| Room Light    | PointLight(0xfff5e0, 1.5, 12, 1.5)        | Ceiling-mounted                |
| Fog           | FogExp2(0x0a0a12, 0.035)                  | Exponential, dark corridors    |
| Tone Mapping  | ACESFilmic, exposure 0.7                  | Realistic falloff              |

Flashlight position: (0.15, -0.1, 0.3) relative to camera - simulates held
position.

## Materials

### Supported SMPK Material Properties

| Property         | Type                          | Description                     |
| ---------------- | ----------------------------- | ------------------------------- |
| name             | string                        | Material name                   |
| baseColorTexture | string                        | Diffuse/albedo texture path     |
| color            | [r, g, b]                     | RGB color, defaults to white    |
| roughness        | number                        | 0-1, derived from B3D shininess |
| metalness        | number                        | 0-1, default 0.0                |
| normalTexture    | string                        | Normal map path                 |
| normalScale      | number                        | Normal intensity, default 1     |
| emissiveTexture  | string                        | Emissive map path               |
| emissiveFactor   | [r, g, b]                     | Emissive color                  |
| lightmapTexture  | string                        | Lightmap path                   |
| alpha            | number                        | 0-1, default 1.0                |
| alphaMode        | "OPAQUE" \| "BLEND" \| "MASK" | Transparency mode               |
| alphaCutoff      | number                        | Threshold for MASK mode         |
| blendMode        | number                        | B3D blend mode (0-7)            |
| fx               | number                        | B3D FX flags                    |

### Auto-Detected Textures

Textures are auto-detected based on base texture name:

```
Base: 173texture.jpg
Detected: 173_Norm.jpg, 173_Spec.jpg
```

Suffixes tried:

- Normal: `_Norm`, `_normal`, `_N`
- Specular: `_Spec`, `_spec`, `_S`

### B3D Brush Mapping

B3D brushes are converted to SMPK materials:

| B3D Field   | SMPK Field           | Conversion                |
| ----------- | -------------------- | ------------------------- |
| name        | name                 | Direct                    |
| color[0-2]  | color                | RGB → RGB                 |
| alpha       | alpha                | Direct                    |
| shininess   | roughness, shininess | roughness = 1 - shininess |
| blend       | blendMode            | Direct                    |
| fx          | fx                   | Direct                    |
| texIds[0]   | baseColorTexture     | Texture lookup            |
| texIds[1]   | detailTexture        | As roughnessMap           |
| texIds[2-3] | detailTexture2/3     | Logged only               |
| texIds[7]   | cubeTexture          | Logged only               |

## Model Auto-Scaling

Models are scaled to similar visual size:

```typescript
const referenceMaxDim = 22.0; // SCP-173
const targetRadius = maxDim * 0.35;
```

This ensures SCP-173 (22m tall) and SCP-049 (0.9m tall) appear at similar sizes.

## Known Issues

1. **Skeletal animation**: SkinnedMesh causes distortion, requires bind pose fix
2. **Multi-texturing**: Detail textures 2-3 and cube textures require custom
   shaders
3. **FX flags**: Only logged, not fully implemented

## Files

| File                            | Purpose               |
| ------------------------------- | --------------------- |
| `web/public/npc_smpk_demo.html` | Demo HTML/JS          |
| `web/src/runtime/smpk.ts`       | Runtime SMPK loader   |
| `Tools/convert_b3d_to_smpk.ts`  | B3D to SMPK converter |
| `Tools/smpk/types.ts`           | SMPK type definitions |
