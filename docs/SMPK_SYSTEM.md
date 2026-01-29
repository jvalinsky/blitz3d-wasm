# SMPK Asset System

## Overview

SMPK (Simple Package) is a custom binary format for optimized web asset delivery in Blitz3D-WASM. It provides a compact, efficient way to bundle game assets with metadata for progressive loading in browsers.

### Design Goals

- **Binary Efficiency**: Smaller payload sizes than individual files
- **Progressive Loading**: Support for partial asset loading
- **Metadata Support**: JSON metadata alongside binary payload
- **Version Control**: Built-in versioning for format evolution
- **Web Optimization**: Designed for HTTP/2 and browser caching

## Format Specification

### File Structure

```
┌─────────────────────────────────────┐
│ Header (12 bytes)                  │
├─────────────────────────────────────┤
│ JSON Metadata (variable length)       │
├─────────────────────────────────────┤
│ Binary Payload (compressed data)    │
└─────────────────────────────────────┘
```

### Header Format

| Offset | Size | Field | Description |
|---------|-------|--------|-------------|
| 0       | 4     | Magic  | "SMPK" (0x534D504B) |
| 4       | 4     | Version| Format version (currently 1) |
| 8       | 4     | Flags  | Feature flags (unused) |

### JSON Metadata Section

```json
{
  "version": 1,
  "created": "2026-01-29T10:00:00Z",
  "assets": [
    {
      "id": "player_mesh",
      "type": "mesh",
      "format": "b3d",
      "offset": 1024,
      "size": 24576,
      "compressed": true,
      "properties": {
        "collision": true,
        "lod_levels": 3
      }
    }
  ],
  "groups": {
    "boot": ["player_mesh"],
    "init": ["ui_elements"],
    "gameplay": ["all_levels", "audio"]
  }
}
```

### Binary Payload

- **Format**: Individual asset data concatenated
- **Compression**: Optional zlib compression
- **Alignment**: 4-byte alignment for efficient loading
- **Indexing**: Metadata provides byte offsets for seeking

## Conversion Tools

### B3D to SMPK

```bash
# Convert single B3D file
deno run -A Tools/convert_b3d_to_smpk.ts input.b3d -o output.smpk

# Convert with properties
deno run -A Tools/convert_b3d_to_smpk.ts input.b3d \
  --id "player_character" \
  --properties "{\"collision\":true,\"lod\":3}" \
  --compress \
  --o output.smpk
```

### X Format to SMPK

```bash
# Convert X model format
deno run -A Tools/convert_x_to_smpk.ts model.x -o model.smpk

# Batch conversion
deno run -A Tools/convert_x_to_smpk.ts models/ --batch --output-dir smpk/
```

### RMesh to SMPK

```bash
# Convert room mesh
deno run -A Tools/convert_rmesh_to_smpk.ts room.rmesh -o room.smpk

# Level batch
deno run -A Tools/convert_rmesh_to_smpk.ts levels/ --batch --properties "{\"collision\":true}"
```

## Build Integration

### Automatic Conversion

The web build process automatically converts supported formats to SMPK:

```bash
# Build web frontend (includes asset conversion)
deno task web:build

# Build with verbose asset processing
deno task web:build --verbose-assets
```

### Build Process

1. **Asset Discovery**: Scan `web/public/assets/` for supported formats
2. **Conversion**: Convert each asset to SMPK format
3. **Metadata Generation**: Create asset manifest with groupings
4. **Validation**: Verify SMPK integrity and metadata
5. **Packaging**: Prepare for web deployment

### Manifest Generation

The build system generates `scpcb_manifest.json`:

```json
{
  "version": "1.0.0",
  "boot": {
    "groups": ["boot"],
    "assets": ["core_runtime.smpk", "initial_fonts.smpk"]
  },
  "init": {
    "groups": ["init"],
    "assets": ["ui_elements.smpk", "loading_screen.smpk"]
  },
  "facility_assets": {
    "groups": ["gameplay"],
    "assets": ["all_rooms.smpk", "npcs.smpk", "audio.smpk"]
  }
}
```

## Runtime Integration

### Asset Loading

```typescript
// Load SMPK from manifest
const smpk = await Blitz3D.loadAsset('player_mesh.smpk');

// Access metadata
const metadata = smpk.getMetadata('player_mesh');
console.log(`Asset size: ${metadata.size} bytes`);

// Get binary data
const meshData = smpk.getAssetData('player_mesh');
```

### Progressive Loading

```typescript
// Load boot assets first
await Blitz3D.loadGroup('boot');

// Then init assets
await Blitz3D.loadGroup('init');

// Finally gameplay assets
await Blitz3D.loadGroup('facility_assets');
```

### Asset Properties

```typescript
// Check asset properties
const asset = await Blitz3D.loadAsset('player_mesh.smpk');
if (asset.properties.collision) {
  // Initialize collision mesh
}
if (asset.properties.lod_levels > 1) {
  // Setup level of detail system
}
```

## Performance Characteristics

### Size Benefits

- **30-50% smaller** than individual files due to compression
- **Reduced HTTP requests** through bundling
- **Better caching** through versioned packages

### Loading Performance

- **Sequential reading**: Efficient disk access for bundled assets
- **Memory mapping**: Direct access to binary payload
- **Lazy loading**: Load assets on-demand from memory-mapped data

### Network Optimization

- **HTTP/2 friendly**: Single large file vs many small files
- **Progressive decode**: Start loading before full download
- **Bandwidth monitoring**: Built-in progress tracking

## Development Workflow

### Adding New Assets

1. **Place asset** in `web/public/assets/`
2. **Run build** to auto-convert to SMPK
3. **Update manifest** groups if needed
4. **Test loading** in development

```bash
# Add new 3D model
cp new_character.b3d web/public/assets/

# Build and test
deno task web:build
deno task web:dev

# Test in browser
open http://localhost:8000
```

### Asset Organization

```
web/public/assets/
├── meshes/           # 3D models (.b3d, .x, .rmesh)
├── textures/         # Image textures
├── audio/           # Sound files
└── fonts/           # Font files

# After build:
web/public/
├── assets/           # SMPK converted files
├── scpcb_manifest.json  # Generated manifest
└── ...              # Other web assets
```

## Format Evolution

### Version Control

SMPK format includes version field for future evolution:

- **Version 1**: Current specification
- **Version 2**: Planned compression improvements
- **Version 3**: Planned streaming support

### Backward Compatibility

The runtime maintains backward compatibility:

```typescript
// Runtime automatically handles version differences
const smpk = await Blitz3D.loadAsset('legacy_asset.smpk');
if (smpk.version >= 2) {
  // Use version 2+ features
} else {
  // Fallback to version 1 handling
}
```

### Migration Path

When updating SMPK format:

1. **Update conversion tools** for new version
2. **Maintain compatibility** in runtime
3. **Gradual migration** of assets to new format
4. **Version deprecation** after transition period

## Best Practices

### Asset Grouping

- **Boot**: Essential runtime assets only
- **Init**: UI and initialization assets
- **Gameplay**: Level-specific and optional assets

### Compression Settings

- **Enable compression** for text-based assets
- **Consider decompression** overhead for frequently accessed assets
- **Profile** memory usage vs. compression ratio

### Performance Monitoring

```typescript
// Monitor loading performance
const startTime = performance.now();
await Blitz3D.loadGroup('facility_assets');
const loadTime = performance.now() - startTime;
console.log(`Load time: ${loadTime}ms`);
```

## Troubleshooting

### Common Issues

**Conversion fails**:
```
deno run -A Tools/convert_b3d_to_smpk.ts model.b3d -o model.smpk
# Error: Invalid B3D format
```
Solution: Validate original B3D file format and integrity

**Asset not found**:
```typescript
await Blitz3D.loadAsset('missing_model.smpk');
// Error: Asset not found in manifest
```
Solution: Ensure asset is in correct asset group and manifest is updated

**Loading performance issues**:
- Check asset grouping (too many assets in boot group)
- Verify compression settings are appropriate
- Monitor network conditions for large SMPK files

### Debug Tools

```bash
# Validate SMPK file integrity
deno run -A Tools/smpk/validate.ts asset.smpk

# Inspect SMPK metadata
deno run -A Tools/smpk/inspect.ts asset.smpk --metadata

# Compare SMPK files
deno run -A Tools/smpk/compare.ts old.smpk new.smpk
```

---

The SMPK asset system provides a robust foundation for efficient web deployment of Blitz3D games, with automatic conversion tools and progressive loading capabilities that scale from simple demos to complex games like SCP: Containment Breach.