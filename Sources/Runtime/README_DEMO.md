# SCPCB Asset Viewer Demo

A web-based demo showcasing the Blitz3D-WASM runtime for loading and rendering SCP: Containment Breach assets in the browser.

## Features

- **Room Viewer**: Browse and load SCPCB room environments
- **Texture Browser**: Preview textures used in the game
- **3D Rendering**: Powered by Three.js with WebGL
- **Debug Controls**: Wireframe, collision, normals, bounds visualization
- **Real-time Stats**: FPS, draw calls, triangle count

## Quick Start

### Option 1: Using the server script
```bash
cd Sources/Runtime
npm start
```

Then open http://localhost:8080 in your browser.

### Option 2: Direct HTML file
Open `examples/scpcb_asset_viewer.html` directly in a web browser.

## Requirements

- Modern web browser with WebGL support
- Three.js (loaded via CDN)
- For local development: Node.js

## Asset Categories

### Rooms
- SCP-173 Containment Chamber
- Checkpoint Rooms
- Server Room
- Exit Rooms
- And more...

### Textures
- Environment textures
- Decals
- Light effects
- Monitor screens

## Controls

- **Left-click + Drag**: Rotate camera
- **Right-click + Drag**: Pan camera
- **Scroll Wheel**: Zoom in/out

## Debug Options

- **Wireframe Mode**: Show mesh wireframes
- **Show Collision**: Display collision geometry
- **Show Normals**: Visualize surface normals
- **Show Bounds**: Display bounding boxes
- **Show Lights**: Highlight light sources

## Architecture

```
examples/
├── scpcb_asset_viewer.html    # Main demo application
├── room_viewer.html           # Alternative viewer

modules/
├── fileio.js                  # File I/O system
├── rmesh.js                   # RMesh parser
├── texture.js                 # Texture loader
├── material.js                # Material system
└── room.js                    # Room loader

tools/
├── test_fileio.js             # File I/O tests
├── test_rmesh.js              # RMesh tests
└── test_texture.js            # Texture tests
```

## Credits

- **SCPCB Assets**: Joon Rik KIM (SCP: Containment Breach)
- **Three.js**: Ricardo Cabello (mr.doob)
- **Blitz3D Runtime**: Custom implementation

## License

MIT License
