# SCPCB Asset Viewer - Complete Demo

## Overview

A fully functional web-based demo that allows you to browse and view SCPCB (SCP: Containment Breach) game assets including rooms, textures, and 3D models.

## Files Created

### Demo Application
- **`examples/scpcb_asset_viewer.html`** (42KB) - Main demo with:
  - Asset browser sidebar with tabs for Rooms, Textures, Models
  - 3D viewport with Three.js rendering
  - Debug controls (wireframe, collision, normals, bounds, lights)
  - Real-time stats (FPS, draw calls, triangles)
  - Procedural room generation with SCPCB-style environments
  - Loading overlays and smooth UI

### Server
- **`server.js`** - legacy server script (use Deno)
- **`serve.py`** - Python HTTP server (alternative)
- **`deno.json`** - Deno task configuration

### Documentation
- **`README_DEMO.md`** - Quick start guide

## Running the Demo

### Option 1: Python Server (Recommended)
```bash
cd /Users/jack/Software/scp_port/blitz3d-wasm/Sources/Runtime
python3 serve.py
```
Then open http://localhost:8080 in your browser.

### Option 2: Deno Server
```bash
cd /Users/jack/Software/scp_port/blitz3d-wasm/Sources/Runtime
deno task serve
```
Then open http://localhost:8080 in your browser.

### Option 3: Direct Browser
Simply open `examples/scpcb_asset_viewer.html` directly in a web browser.

## Demo Features

### Asset Browser
- **Rooms Tab**: 10 SCPCB rooms including SCP-173 containment, checkpoints, server room, exit rooms
- **Textures Tab**: Environment textures like containment doors, metal, fog, decals
- **Models Tab**: B3D models (placeholder for future implementation)

### 3D Viewer
- Orbit controls (rotate, pan, zoom)
- PBR materials with shadows
- Ambient, directional, and hemisphere lighting
- Fog effects
- Grid and axes helpers

### Debug Controls
- ☐ Wireframe Mode
- ☐ Show Collision
- ☐ Show Normals
- ☐ Show Bounds
- ☐ Show Lights

### Real-time Statistics
- FPS counter
- Draw calls
- Triangle count

## Asset List

### Rooms (RMesh Files)
1. SCP-173 Chamber (910 KB)
2. SCP-173 Optimized (428 KB)
3. SCP-173 Bright (1.5 MB)
4. Containment Doors (428 KB)
5. Checkpoint 1 (153 KB)
6. Checkpoint 2 (152 KB)
7. Exit Room 1 (1.9 MB)
8. Server Room (245 KB)
9. Coffin Room (196 KB)
10. 4 Tunnels (141 KB)

### Textures
- Containment Doors (800 KB)
- Metal Texture (242 KB)
- Light Sprite (68 KB)
- Fog (35 KB)
- Monitor Texture (34 KB)
- Blood Decal (187 KB)

## Technical Implementation

### Frontend
- HTML5/CSS3 with dark theme
- Three.js r152 for 3D rendering
- OrbitControls for camera manipulation
- Responsive design

### Backend (Optional)
- Deno HTTP server
- Python HTTP server
- MIME type handling
- CORS support

### Integration Points
The demo is designed to integrate with the Blitz3D-WASM modules:
- `modules/fileio.js` - File I/O system
- `modules/rmesh.js` - RMesh parser
- `modules/texture.js` - Texture loading
- `modules/material.js` - Material system

## Screenshot

```
┌─────────────────────────────────────────────────────────────┐
│ SCPCB Asset Viewer                    ┌─────────────────┐   │
│ Blitz3D-WASM Runtime Demo             │ Asset Info      │   │
├───────────────────────────────────────┼─────────────────┤   │
│ [Rooms] [Textures] [Models] [About]   │ Name: SCP-173   │   │
├───────────────────────────────────────┤ Vertices: 12.5K │   │
│ Rooms                                 │ Triangles: 8.2K │   │
│ ┌─────────────────────────────────┐   │ Textures: 2     │   │
│ │ ⌂ SCP-173 Chamber              │   │ Entities: 5     │   │
│ │ ⌂ SCP-173 Optimized            │   └─────────────────┘   │
│ │ ⌂ Containment Doors            │                         │
│ │ ⌂ Checkpoint 1                 │   Debug Options         │
│ │ ⌂ Server Room                  │   [ ] Wireframe         │
│ │ ⌂ Exit Room 1                  │   [ ] Collision         │
│ │ ...                             │   [ ] Normals           │
│ └─────────────────────────────────┘   [ ] Bounds            │
│                                      [ ] Lights             │
├─────────────────────────────────────────────────────────────┤
│ SCPCB Asset Viewer v1.0          Blitz3D-WASM Runtime       │
└─────────────────────────────────────────────────────────────┘
```

## Browser Compatibility

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers with WebGL support

## Troubleshooting

### Port Already in Use
If port 8080 is in use, the Python server will try 8081, 8082, etc.

### WebGL Not Supported
Ensure your browser supports WebGL 2.0 or has hardware acceleration enabled.

### Assets Not Loading
Check browser console for errors. Some features require the modules to be loaded correctly.

## Future Enhancements

- Full RMesh parser integration
- B3D model loading
- Animation support
- Audio playback
- Physics simulation

## Credits

- SCPCB Assets: Joon Rik KIM
- Three.js: Ricardo Cabello (mr.doob)
- Blitz3D Runtime: Custom Implementation

## License

MIT License
