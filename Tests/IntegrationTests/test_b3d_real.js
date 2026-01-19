/**
 * Test B3D loader with real SCPCB B3D file
 */

const fs = require('fs');
const path = require('path');

const modulesDir = path.join(__dirname, '../../Sources/Runtime/modules');
const B3DLoader = require(path.join(modulesDir, 'b3d'));

const b3dPath = '/Users/jack/Software/scp_port/scpcb/GFX/npcs/173_2.b3d';

console.log(`Testing B3D loader with: ${b3dPath}`);

// Read the file
const fileData = fs.readFileSync(b3dPath);
console.log(`File size: ${fileData.length} bytes`);

// Create mock graphics/core
const mockGraphics = {
    nextEntityId: 1,
    entities: {},
    scene: null,
    textureLoader: {
        loadTexture: async (path, flags) => {
            console.log(`  Loading texture: ${path}`);
            return null;
        }
    }
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
loader.debugMode = true;

// Parse the B3D file
console.log('\nParsing B3D file...');
const startTime = Date.now();
const result = loader.parseBinaryData(fileData);
const parseTime = Date.now() - startTime;

console.log(`\nParse time: ${parseTime}ms`);
console.log(`Textures: ${result.textures.length}`);
console.log(`Brushes: ${result.brushes.length}`);
console.log(`Meshes: ${result.meshes.length}`);
console.log(`Animations: ${result.animations.length}`);
console.log(`Bones: ${result.bones.length}`);

if (result.meshes.length > 0) {
    const firstMesh = result.meshes[0];
    console.log(`\nFirst mesh:`);
    console.log(`  Vertex count: ${firstMesh.vertexCount || 'N/A'}`);
    console.log(`  Triangle count: ${firstMesh.triangleCount || 'N/A'}`);
    console.log(`  Brush index: ${firstMesh.brushIndex}`);
}

if (result.brushes.length > 0) {
    console.log(`\nFirst brush:`);
    const firstBrush = result.brushes[0];
    console.log(`  Name: ${firstBrush.name}`);
    console.log(`  Color: RGB(${firstBrush.color.r}, ${firstBrush.color.g}, ${firstBrush.color.b})`);
    console.log(`  Alpha: ${firstBrush.alpha}`);
    console.log(`  Texture IDs: [${firstBrush.textureIds.join(', ')}]`);
}

if (result.textures.length > 0) {
    console.log(`\nFirst texture:`);
    const firstTex = result.textures[0];
    console.log(`  Name: ${firstTex.name}`);
}

console.log('\n✓ B3D file parsed successfully!');
