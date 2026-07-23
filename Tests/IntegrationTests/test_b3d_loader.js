/**
 * Integration test for B3D loader
 * Tests that the B3D loader module can be required and basic parsing works
 */

const path = require("path");
const fs = require("fs");

// Get the runtime modules directory
const modulesDir = path.join(__dirname, "../../Sources/Runtime/modules");

// Test 1: Module can be required
console.log("Test 1: Module requires without error...");
try {
  const B3DLoader = require(path.join(modulesDir, "b3d"));
  if (typeof B3DLoader !== "function") {
    throw new Error("B3DLoader is not a constructor function");
  }
  console.log("  ✓ B3DLoader module loaded successfully");
} catch (err) {
  console.error("  ✗ Failed to require B3DLoader:", err.message);
  process.exit(1);
}

// Test 2: Animation module can be required
console.log("Test 2: Animation module requires without error...");
try {
  const { Blitz3DAnimation } = require(path.join(modulesDir, "animation"));
  if (typeof Blitz3DAnimation !== "function") {
    throw new Error("Blitz3DAnimation is not a constructor function");
  }
  console.log("  ✓ Animation module loaded successfully");
} catch (err) {
  console.error("  ✗ Failed to require Animation module:", err.message);
  process.exit(1);
}

// Test 3: Mock graphics/core for instantiation
console.log("Test 3: B3DLoader can be instantiated with mock dependencies...");
try {
  const B3DLoader = require(path.join(modulesDir, "b3d"));

  const mockGraphics = {
    nextEntityId: 1,
    entities: {},
    scene: null,
    textureLoader: null,
  };

  const mockCore = {
    fileIO: {
      openFile: () => 0,
      closeFile: () => {},
      fileSize: () => 0,
      readByte: () => 0,
      readInt: () => 0,
      readFloat: () => 0,
    },
  };

  const loader = new B3DLoader(mockGraphics, mockCore);
  if (!loader) {
    throw new Error("B3DLoader instantiation returned undefined");
  }
  console.log("  ✓ B3DLoader instantiated successfully");
} catch (err) {
  console.error("  ✗ Failed to instantiate B3DLoader:", err.message);
  process.exit(1);
}

// Test 4: Animation module can be instantiated
console.log(
  "Test 4: Blitz3DAnimation can be instantiated with mock dependencies...",
);
try {
  const { Blitz3DAnimation } = require(path.join(modulesDir, "animation"));

  const mockGraphics = {
    entities: {},
    scene: null,
  };

  const mockCore = {};

  const anim = new Blitz3DAnimation(mockGraphics, mockCore);
  if (!anim) {
    throw new Error("Blitz3DAnimation instantiation returned undefined");
  }
  console.log("  ✓ Blitz3DAnimation instantiated successfully");
} catch (err) {
  console.error("  ✗ Failed to instantiate Blitz3DAnimation:", err.message);
  process.exit(1);
}

// Test 5: B3D parser can parse minimal header
console.log("Test 5: B3D parser handles BB3D header...");
try {
  const B3DLoader = require(path.join(modulesDir, "b3d"));

  const mockGraphics = {
    nextEntityId: 1,
    entities: {},
    scene: null,
    textureLoader: null,
  };
  const mockCore = {
    fileIO: {
      openFile: () => 1,
      closeFile: () => {},
      fileSize: () => 8,
      readByte: (handle, pos) => {
        const header = [66, 66, 51, 68, 0, 0, 0, 1]; // "BB3D" + version 1
        return pos !== undefined ? header[pos] : header[0];
      },
      readInt: () => 1,
      readFloat: () => 0,
    },
  };

  const loader = new B3DLoader(mockGraphics, mockCore);

  // Create minimal B3D data for testing parseBinaryData
  const minimalB3D = new Uint8Array([
    66,
    66,
    51,
    68, // "BB3D"
    1,
    0,
    0,
    0, // version 1 (little endian)
    0,
    0,
    0,
    0, // Empty TEXS chunk (0 bytes)
  ]);

  const result = loader.parseBinaryData(minimalB3D);
  if (!result || !Array.isArray(result.textures)) {
    throw new Error("parseBinaryData did not return expected structure");
  }
  console.log("  ✓ B3D parser handles minimal data");
} catch (err) {
  console.error("  ✗ B3D parser test failed:", err.message);
  process.exit(1);
}

console.log("\n✓ All integration tests passed!");
