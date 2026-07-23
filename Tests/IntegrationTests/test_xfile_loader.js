/**
 * Integration test for X File loader
 * Tests that the X File loader module can be required and basic parsing works
 */

const path = require("path");
const fs = require("fs");

const modulesDir = path.join(__dirname, "../../Sources/Runtime/modules");

// Test 1: Module can be required
console.log("Test 1: XFileLoader module requires without error...");
try {
  const XFileLoader = require(path.join(modulesDir, "xfile"));
  if (typeof XFileLoader !== "function") {
    throw new Error("XFileLoader is not a constructor function");
  }
  console.log("  ✓ XFileLoader module loaded successfully");
} catch (err) {
  console.error("  ✗ Failed to require XFileLoader:", err.message);
  process.exit(1);
}

// Test 2: XFileLoader can be instantiated
console.log(
  "Test 2: XFileLoader can be instantiated with mock dependencies...",
);
try {
  const XFileLoader = require(path.join(modulesDir, "xfile"));

  const mockGraphics = {
    nextEntityId: 1,
    entities: {},
    scene: null,
  };

  const mockCore = {};

  const loader = new XFileLoader(mockGraphics, mockCore);
  if (!loader) {
    throw new Error("XFileLoader instantiation returned undefined");
  }
  console.log("  ✓ XFileLoader instantiated successfully");
} catch (err) {
  console.error("  ✗ Failed to instantiate XFileLoader:", err.message);
  process.exit(1);
}

// Test 3: XFileLoader can parse text format
console.log("Test 3: XFileLoader can parse X file header...");
try {
  const XFileLoader = require(path.join(modulesDir, "xfile"));

  const mockGraphics = {
    nextEntityId: 1,
    entities: {},
    scene: null,
  };

  const mockCore = {};

  const loader = new XFileLoader(mockGraphics, mockCore);

  const sampleXFile = `xof 0302txt 0064
Header {
  1;
  0;
  1;
}
Mesh test {
  3;
  0.0;0.0;0.0;,
  1.0;0.0;0.0;,
  0.0;1.0;0.0;;
  1;
  3;0,1,2;;
}
`;

  const result = loader.parseText(sampleXFile);
  if (!result) {
    throw new Error("parseText returned null");
  }

  if (result.meshes.length !== 1) {
    throw new Error(`Expected 1 mesh, got ${result.meshes.length}`);
  }

  const mesh = result.meshes[0];
  if (mesh.vertexCount !== 3) {
    throw new Error(`Expected 3 vertices, got ${mesh.vertexCount}`);
  }

  if (mesh.triangleCount !== 1) {
    throw new Error(`Expected 1 triangle, got ${mesh.triangleCount}`);
  }

  console.log("  ✓ X file parsing works correctly");
} catch (err) {
  console.error("  ✗ X file parsing test failed:", err.message);
  process.exit(1);
}

// Test 4: Real X file parsing
console.log("Test 4: Real X file parsing...");
try {
  const XFileLoader = require(path.join(modulesDir, "xfile"));

  const mockGraphics = {
    nextEntityId: 1,
    entities: {},
    scene: null,
  };

  const mockCore = {};

  const loader = new XFileLoader(mockGraphics, mockCore);
  loader.debugMode = false;

  const xFilePath = "/Users/jack/Software/scp_port/scpcb/GFX/map/914knob.x";
  if (!fs.existsSync(xFilePath)) {
    console.log("  ⊘ Skipping - test file not found");
  } else {
    const content = fs.readFileSync(xFilePath, "utf8");
    const result = loader.parseText(content);

    if (!result || result.meshes.length === 0) {
      throw new Error("Failed to parse X file");
    }

    const mesh = result.meshes[0];
    console.log(
      `  ✓ Real X file parsed: ${mesh.vertexCount} verts, ${mesh.triangleCount} tris`,
    );
    console.log(
      `    Materials: ${result.materials.length}, Textures: ${result.textures.length}`,
    );
  }
} catch (err) {
  console.error("  ✗ Real X file parsing test failed:", err.message);
  process.exit(1);
}

console.log("\n✓ All X File loader integration tests passed!");
