# Phase 2: RMesh Parser Implementation

## Overview
Phase 2 implements the RMesh parser for loading SCPCB room meshes and converting them to Three.js geometry for browser rendering.

## Components

### 1. RMesh Parser (`rmesh.js`)
The core parser that handles the SCPCB RMesh binary format:

**Features:**
- Full RMesh format parsing (header, meshes, collision, entities)
- Coordinate system conversion (Blitz3D LH → Three.js RH)
- Texture loading with caching
- Entity parsing (lights, sounds, waypoints, etc.)
- Async/await API for modern usage

**Supported Entity Types:**
- `screen` - Screen textures
- `waypoint` - Navigation waypoints
- `light` - Point/spot lights
- `spotlight` - Spotlights with angle
- `soundemitter` - 3D sound sources
- `playerstart` - Player spawn points
- `model` - Static models

**RMesh Format Support:**
```
Header: "RoomMesh" or "RoomMesh.HasTriggerBox"
├── Drawn Meshes
│   ├── Textures (2 per mesh, optional)
│   ├── Vertices (x, y, z, u0, v0, u1, v1, r, g, b)
│   └── Triangles (3 vertex indices)
├── Collision Meshes (invisible, double-sided)
├── Trigger Boxes (optional, with names)
└── Point Entities
```

### 2. Room Loader (`room.js`)
Higher-level room management system:

**Features:**
- Room loading/unloading with caching
- Entity creation and management
- Collision mesh handling
- Trigger box support
- Waypoint graph for navigation
- Light/sound management
- WASM imports for BB integration

### 3. Graphics Integration
Updated `graphics.js` to use RMesh parser:
- `LoadMesh()` now detects and loads `.rmesh` files
- Automatic coordinate conversion
- Material/texture system integration

## Usage

### Basic Room Loading
```javascript
// Initialize graphics with room support
const graphics = new Blitz3DGraphics(core);

// Load a room
const entityId = await graphics.loadRMeshFile('rooms/room1.rmesh', parentEntity);
```

### Using Room Module Directly
```javascript
const room = new Blitz3DRoom(graphics, core);

// Load room
const entityId = await room.loadRoom('GFX/map/room1.rmesh');

// Get entities by type
const lights = room.findEntitiesByType('light');
const waypoints = room.findEntitiesByType('waypoint');

// Get navigation graph
const waypointGraph = room.getWaypointGraph();

// Toggle debug visualizations
room.toggleCollisionMeshes(true);
room.toggleTriggerBoxes(true);
```

### RMesh Parser API
```javascript
const parser = new RMeshParser(graphics, fileIO, assetManager);

// Parse file and get raw data
const roomData = await parser.parseFile('room.rmesh');

// Create Three.js objects
const objects = await parser.createThreeJSObjects(roomData);

// Access parsed data
console.log(roomData.opaque.length, 'opaque meshes');
console.log(roomData.alpha.length, 'alpha meshes');
console.log(roomData.entities.length, 'entities');
```

## Coordinate System Conversion

Blitz3D uses a left-handed coordinate system where:
- +X = Right
- +Y = Up  
- +Z = Forward (toward viewer)

Three.js uses a right-handed system where:
- +X = Right
- +Y = Up
- +Z = Forward (away from viewer)

The parser automatically converts by negating Z coordinates:

```javascript
// Blitz3D: (x, y, z)
// Three.js: (x, y, -z)
positions.push(vertex.x, vertex.y, -vertex.z);
```

## Texture Handling

### Texture Loading
Textures are loaded asynchronously with caching:

```javascript
// Textures are loaded from relative paths
const texture = await assetManager.loadTexture('textures/wall.png');

// Fallback to placeholder if missing
const placeholder = parser.createPlaceholderTexture();
```

### Placeholder Texture
When textures fail to load, a pink checkerboard pattern is used (matching SCPCB's missing texture indicator).

## Entity Creation

### Light Entities
```javascript
{
    type: 'light',
    position: { x, y, z },
    rotation: { pitch, yaw, roll },
    data: {
        lightType: 'point' | 'spotlight',
        color: { r, g, b },
        range: number,
        angle: number  // spotlight only
    }
}
```

### Sound Emitters
```javascript
{
    type: 'soundemitter',
    position: { x, y, z },
    rotation: { pitch, yaw, roll },
    data: {
        soundFile: 'path/to/sound.wav',
        loop: boolean,
        vol: number  // 0.0 to 1.0
    }
}
```

### Waypoints
```javascript
{
    type: 'waypoint',
    position: { x, y, z },
    rotation: { pitch, yaw, roll },
    data: {
        nextWaypoint: 'waypoint_id'
    }
}
```

## Debug Features

### Visual Debugging
- **Collision Meshes**: Wireframe red, hidden by default
- **Trigger Boxes**: Wireframe yellow, hidden by default
- **Light Helpers**: Point/sphere at light position
- **Waypoints**: Yellow spheres

### Debug API
```javascript
// Toggle collision mesh visibility
room.toggleCollisionMeshes(true);

// Toggle trigger box visibility
room.toggleTriggerBoxes(true);

// Enable parser debug logging
parser.setDebugMode(true);
```

## WASM Integration

The room system provides WASM imports for BB scripts:

```blitz3d
; Load a room
roomEntity = LoadRoom("GFX/map/room1.rmesh")

; Get entity count
count = GetRoomEntityCount(roomEntity)

; Get light count
lights = GetRoomLightCount(roomEntity)

; Debug toggles
ToggleCollisionMeshes(True)
ToggleTriggerBoxes(True)
```

## Performance Considerations

### Memory Management
- Geometries are disposed when rooms are unloaded
- Textures are cached and reused
- Large rooms should be unloaded when not visible

### Async Loading
- Textures load asynchronously
- Room parsing is async for non-blocking UI
- Progress callbacks available for loading screens

### Optimization Tips
1. Pre-compress textures to DDS/KTX2
2. Use texture atlases for multiple small textures
3. Implement LOD for complex rooms
4. Stream rooms instead of loading all at once

## Testing

Run the RMesh parser tests:
```bash
node tools/test_rmesh.js
```

Expected output:
```
Running RMesh Parser Tests...
✓ RMesh format detection
✓ Binary reading functions
✓ Coordinate conversion
✓ Entity parsing
✓ Three.js object creation
```

## Limitations

1. **Animation**: Not yet implemented (B3D format)
2. **Complex Materials**: Basic Phong materials only
3. **Real-time Lighting**: Pre-baked lightmaps only
4. **Audio**: Sound emitter objects created but not integrated with Web Audio

## Future Enhancements

- [ ] B3D animation support
- [ ] Advanced material system (PBR)
- [ ] Lightmap rendering
- [ ] Occlusion culling
- [ ] Room streaming
- [ ] NavMesh generation
- [ ] Physics integration
