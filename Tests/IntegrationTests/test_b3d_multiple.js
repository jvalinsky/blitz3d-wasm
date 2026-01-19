/**
 * Test B3D loader with multiple SCPCB B3D files
 */

const fs = require('fs');
const path = require('path');

const modulesDir = path.join(__dirname, '../../Sources/Runtime/modules');
const B3DLoader = require(path.join(modulesDir, 'b3d'));

const testFiles = [
    '/Users/jack/Software/scp_port/scpcb/GFX/npcs/173_2.b3d',
    '/Users/jack/Software/scp_port/scpcb/GFX/npcs/106_2.b3d',
    '/Users/jack/Software/scp_port/scpcb/GFX/173box.b3d',
];

console.log('Testing B3D loader with multiple SCPCB files\n');

for (const b3dPath of testFiles) {
    if (!fs.existsSync(b3dPath)) {
        console.log(`Skipping ${b3dPath} - file not found`);
        continue;
    }

    const fileData = fs.readFileSync(b3dPath);
    const fileName = path.basename(b3dPath);
    
    console.log(`\n=== ${fileName} ===`);
    console.log(`Size: ${(fileData.length / 1024).toFixed(1)} KB`);

    const mockGraphics = {
        nextEntityId: 1,
        entities: {},
        scene: null,
        textureLoader: null
    };

    const mockCore = {
        fileIO: {
            openFile: () => 1,
            closeFile: () => {},
            fileSize: () => fileData.length,
            readByte: (handle, pos) => fileData[pos],
            readInt: () => 0,
            readFloat: () => 0
        }
    };

    const loader = new B3DLoader(mockGraphics, mockCore);
    loader.debugMode = false;

    const startTime = Date.now();
    const result = loader.parseBinaryData(fileData);
    const parseTime = Date.now() - startTime;

    console.log(`Parse time: ${parseTime}ms`);
    console.log(`Textures: ${result.textures.length}`);
    console.log(`Brushes: ${result.brushes.length}`);
    console.log(`Meshes: ${result.meshes.length}`);
    
    if (result.meshes.length > 0) {
        const mesh = result.meshes[0];
        console.log(`Vertices: ${mesh.vertexCount}`);
        console.log(`Triangles: ${mesh.triangleCount}`);
    }
    
    console.log(`Bones/Nodes: ${result.bones.length}`);
}

console.log('\n✓ All B3D files parsed successfully!');
