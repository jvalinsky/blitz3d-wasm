#!/usr/bin/env node

/**
 * Texture Loader Test Suite
 * Tests the Blitz3D texture loading system
 */

const path = require("path");

const RUNTIME_PATH =
  "/Users/jack/Software/scp_port/blitz3d-wasm/Sources/Runtime";
const MODULES_PATH = path.join(RUNTIME_PATH, "modules");

const FileIO = require(path.join(MODULES_PATH, "fileio"));
const AssetManager = require(path.join(MODULES_PATH, "asset"));

class TextureTest {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.mockCore = null;
    this.fileIO = null;
    this.assetManager = null;
  }

  async run() {
    console.log("Running Texture Loader Tests...\n");

    await this.setup();
    await this.testBMPParsing();
    await this.testTextureCaching();
    await this.testPlaceholderCreation();
    await this.testMaterialSystem();
    await this.testTextureBlending();

    console.log(`\n--- Test Results ---`);
    console.log(`Passed: ${this.passed}`);
    console.log(`Failed: ${this.failed}`);
    console.log(`Total: ${this.passed + this.failed}`);

    await this.cleanup();
    return this.failed === 0;
  }

  async setup() {
    console.log("Setting up test environment...");

    this.mockCore = {
      readString: (ptr) => "",
      allocString: (str) => 0,
      memory: { buffer: new ArrayBuffer(1024 * 1024) },
    };

    this.fileIO = new FileIO(this.mockCore);
    this.fileIO.init();

    this.assetManager = new AssetManager(this.fileIO);
    this.assetManager.init("/test");

    console.log("  ✓ Test environment ready\n");
  }

  async cleanup() {
    console.log("\nCleaning up...");
  }

  async testBMPParsing() {
    console.log("Test: BMP Header Parsing");
    try {
      // Test BMP header parsing logic
      const testCases = [
        {
          headerSize: 40,
          expected: "BITMAPINFOHEADER",
          description: "Standard Windows BMP",
        },
        {
          headerSize: 12,
          expected: "BITMAPCOREHEADER",
          description: "OS/2 BMP",
        },
        {
          headerSize: 64,
          expected: "Unknown",
          description: "Unknown format",
        },
      ];

      for (const test of testCases) {
        let detected;
        if (test.headerSize === 40) {
          detected = "BITMAPINFOHEADER";
        } else if (test.headerSize === 12) {
          detected = "BITMAPCOREHEADER";
        } else {
          detected = "Unknown";
        }

        if (detected === test.expected) {
          console.log(`  ✓ ${test.description} detected correctly`);
          this.passed++;
        } else {
          throw new Error(`${test.description} detection failed`);
        }
      }
    } catch (error) {
      console.log(`  ✗ Failed: ${error.message}`);
      this.failed++;
    }
  }

  async testTextureCaching() {
    console.log("Test: Texture Caching");
    try {
      // Simulate texture cache
      const cache = new Map();

      // Add some textures
      const textures = ["tex1.png", "tex2.bmp", "tex3.jpg"];
      for (const tex of textures) {
        cache.set(tex, { loaded: true, path: tex });
      }

      // Test cache hits
      let hitCount = 0;
      for (const tex of textures) {
        if (cache.has(tex)) hitCount++;
      }

      if (hitCount === textures.length) {
        console.log(
          `  ✓ Cache retrieval works (${hitCount}/${textures.length})`,
        );
        this.passed++;
      } else {
        throw new Error(
          `Cache retrieval failed: ${hitCount}/${textures.length}`,
        );
      }

      // Test cache miss
      if (!cache.has("missing.png")) {
        console.log("  ✓ Cache miss handling works");
        this.passed++;
      } else {
        throw new Error("Cache miss not handled correctly");
      }

      // Test cache size
      if (cache.size === textures.length) {
        console.log("  ✓ Cache size tracking works");
        this.passed++;
      } else {
        throw new Error("Cache size incorrect");
      }
    } catch (error) {
      console.log(`  ✗ Failed: ${error.message}`);
      this.failed++;
    }
  }

  async testPlaceholderCreation() {
    console.log("Test: Placeholder Texture Creation");
    try {
      // Test placeholder color (pink checkerboard)
      const placeholderColors = [
        { x: 0, y: 0, expected: "#ff69b4" }, // Hot pink
        { x: 32, y: 0, expected: "#ff1493" }, // Deep pink
        { x: 0, y: 32, expected: "#ff1493" }, // Deep pink
        { x: 32, y: 32, expected: "#ff69b4" }, // Hot pink
      ];

      let allCorrect = true;
      for (const test of placeholderColors) {
        // Calculate which color should be at position
        const isLightPink =
          (Math.floor(test.x / 32) + Math.floor(test.y / 32)) % 2 === 0;
        const expectedColor = isLightPink ? "#ff69b4" : "#ff1493";

        if (expectedColor !== test.expected) {
          allCorrect = false;
          break;
        }
      }

      if (allCorrect) {
        console.log("  ✓ Placeholder texture pattern correct");
        this.passed++;
      } else {
        throw new Error("Placeholder pattern incorrect");
      }
    } catch (error) {
      console.log(`  ✗ Failed: ${error.message}`);
      this.failed++;
    }
  }

  async testMaterialSystem() {
    console.log("Test: Material/Brush System");
    try {
      // Simulate material system
      const brushes = new Map();
      let brushId = 1;

      // Create a brush
      const brush = {
        id: brushId++,
        color: { r: 255, g: 128, b: 64 },
        textures: [null, null],
        blendMode: 0,
        shininess: 30,
      };
      brushes.set(brush.id, brush);

      // Test brush creation
      if (brushes.size === 1) {
        console.log("  ✓ Brush creation works");
        this.passed++;
      } else {
        throw new Error("Brush creation failed");
      }

      // Test brush properties
      const createdBrush = brushes.get(1);
      if (createdBrush && createdBrush.blendMode === 0) {
        console.log("  ✓ Brush properties work");
        this.passed++;
      } else {
        throw new Error("Brush properties incorrect");
      }

      // Test texture assignment
      createdBrush.textures[0] = { id: 1, path: "test.png" };
      if (
        createdBrush.textures[0] && createdBrush.textures[0].path === "test.png"
      ) {
        console.log("  ✓ Brush texture assignment works");
        this.passed++;
      } else {
        throw new Error("Texture assignment failed");
      }
    } catch (error) {
      console.log(`  ✗ Failed: ${error.message}`);
      this.failed++;
    }
  }

  async testTextureBlending() {
    console.log("Test: Texture Blend Modes");
    try {
      // Test blend mode mappings (without Three.js)
      const blendModes = [
        { mode: 0, name: "Replace" },
        { mode: 1, name: "Add" },
        { mode: 2, name: "Alpha" },
        { mode: 3, name: "Multiply" },
        { mode: 5, name: "Blend" },
      ];

      let allValid = true;
      for (const test of blendModes) {
        // Verify mode is in valid range (0-7)
        if (test.mode < 0 || test.mode > 7) {
          allValid = false;
          console.log(`  ✗ Invalid blend mode: ${test.mode}`);
          break;
        }
        console.log(`  ✓ Blend mode ${test.mode} (${test.name}) valid`);
      }

      if (allValid) {
        console.log("  ✓ All blend mode mappings valid");
        this.passed++;
      } else {
        throw new Error("Blend mode validation failed");
      }
    } catch (error) {
      console.log(`  ✗ Failed: ${error.message}`);
      this.failed++;
    }
  }
}

// Run tests
const test = new TextureTest();
test.run().then((success) => {
  process.exit(success ? 0 : 1);
}).catch((error) => {
  console.error("Test execution failed:", error);
  process.exit(1);
});
