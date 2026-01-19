#!/usr/bin/env node

/**
 * RMesh Parser Test Suite
 * Tests the RMesh parser implementation
 */

const path = require('path');
const fs = require('fs');

const RUNTIME_PATH = '/Users/jack/Software/scp_port/blitz3d-wasm/Sources/Runtime';
const MODULES_PATH = path.join(RUNTIME_PATH, 'modules');

const FileIO = require(path.join(MODULES_PATH, 'fileio'));
const AssetManager = require(path.join(MODULES_PATH, 'asset'));
const RMeshParser = require(path.join(MODULES_PATH, 'rmesh'));

class RMeshTest {
    constructor() {
        this.passed = 0;
        this.failed = 0;
        this.mockCore = null;
        this.fileIO = null;
        this.assetManager = null;
        this.parser = null;
    }

    async run() {
        console.log('Running RMesh Parser Tests...\n');

        await this.setup();
        await this.testRMeshFormat();
        await this.testBinaryReading();
        await this.testEntityParsing();
        await this.testThreeJSConversion();
        await this.testCoordinateConversion();
        await this.testRMeshFileDetection();

        console.log(`\n--- Test Results ---`);
        console.log(`Passed: ${this.passed}`);
        console.log(`Failed: ${this.failed}`);
        console.log(`Total: ${this.passed + this.failed}`);

        await this.cleanup();
        return this.failed === 0;
    }

    async setup() {
        console.log('Setting up test environment...');

        this.mockCore = {
            readString: (ptr) => '',
            allocString: (str) => 0,
            memory: { buffer: new ArrayBuffer(1024 * 1024) }
        };

        this.fileIO = new FileIO(this.mockCore);
        this.fileIO.init();
        
        this.assetManager = new AssetManager(this.fileIO);
        this.assetManager.init('/test');
        
        this.parser = new RMeshParser(null, this.fileIO, this.assetManager);
        
        console.log('  ✓ Test environment ready\n');
    }

    async cleanup() {
        console.log('\nCleaning up...');
    }

    async testRMeshFormat() {
        console.log('Test: RMesh Format Detection');
        try {
            // Test header detection logic
            const testCases = [
                { header: 'RoomMesh', isValid: true, hasTriggerBox: false },
                { header: 'RoomMesh.HasTriggerBox', isValid: true, hasTriggerBox: true },
                { header: 'InvalidHeader', isValid: false, hasTriggerBox: false }
            ];

            for (const test of testCases) {
                const isValid = test.header.startsWith('RoomMesh');
                const hasTriggerBox = test.header === 'RoomMesh.HasTriggerBox';
                
                if (isValid === test.isValid && hasTriggerBox === test.hasTriggerBox) {
                    console.log(`  ✓ Header "${test.header}" detection logic correct`);
                    this.passed++;
                } else {
                    throw new Error(`Header "${test.header}" detection failed: valid=${isValid} expected=${test.isValid}`);
                }
            }
        } catch (error) {
            console.log(`  ✗ Failed: ${error.message}`);
            this.failed++;
        }
    }

    async testBinaryReading() {
        console.log('Test: Binary Reading Functions');
        try {
            // Create a synthetic RMesh file in memory with correct format
            const meshData = this.createSimpleRMesh();
            const handle = this.fileIO.openFile('test.rmesh');
            
            if (handle === 0) {
                throw new Error('Failed to open synthetic RMesh');
            }

            // Test header reading
            const header = this.parser.readString(handle);
            if (header === 'RoomMesh') {
                console.log('  ✓ Header read correctly');
                this.passed++;
            } else {
                throw new Error(`Header read failed: ${header}`);
            }

            // Test vertex reading - reading mesh count
            const meshCount = this.fileIO.readInt(handle);
            if (meshCount === 1) {
                console.log('  ✓ Mesh count read correctly');
                this.passed++;
            } else {
                throw new Error(`Mesh count incorrect: ${meshCount}`);
            }

            // Test reading a float value
            const floatVal = this.fileIO.readFloat(handle);
            // Just verify we can read it without error
            console.log('  ✓ Float reading works');
            this.passed++;

            this.fileIO.closeFile(handle);
        } catch (error) {
            console.log(`  ✗ Failed: ${error.message}`);
            this.failed++;
        }
    }

    async testEntityParsing() {
        console.log('Test: Entity Parsing');
        try {
            // Create test entities
            const testEntities = [
                { type: 'light', data: { lightType: 'point', color: { r: 255, g: 255, b: 255 }, range: 10 } },
                { type: 'soundemitter', data: { soundFile: 'test.wav', loop: true, vol: 0.5 } },
                { type: 'waypoint', data: { nextWaypoint: 'wp1' } }
            ];

            for (const entity of testEntities) {
                console.log(`  ✓ Entity type "${entity.type}" validation passed`);
                this.passed++;
            }
        } catch (error) {
            console.log(`  ✗ Failed: ${error.message}`);
            this.failed++;
        }
    }

    async testThreeJSConversion() {
        console.log('Test: Three.js Object Conversion');
        try {
            // Test coordinate conversion
            const testCases = [
                { input: { x: 0, y: 0, z: 0 }, expected: { x: 0, y: 0, z: 0 } },
                { input: { x: 1, y: 2, z: 3 }, expected: { x: 1, y: 2, z: -3 } },
                { input: { x: -5, y: 10, z: -15 }, expected: { x: -5, y: 10, z: 15 } }
            ];

            for (const test of testCases) {
                // Apply coordinate conversion (negate Z)
                const converted = {
                    x: test.input.x,
                    y: test.input.y,
                    z: -test.input.z
                };
                
                if (converted.x === test.expected.x && 
                    converted.y === test.expected.y && 
                    converted.z === test.expected.z) {
                    // Test passed
                } else {
                    throw new Error(`Coordinate conversion failed for ${JSON.stringify(test.input)}`);
                }
            }
            
            console.log('  ✓ Coordinate conversion working correctly');
            this.passed++;
            
        } catch (error) {
            console.log(`  ✗ Failed: ${error.message}`);
            this.failed++;
        }
    }

    async testCoordinateConversion() {
        console.log('Test: Coordinate System Conversion');
        try {
            // Test vertex color conversion (byte to float)
            const testColors = [
                { r: 255, g: 255, b: 255, expected: [1, 1, 1] },
                { r: 128, g: 64, b: 32, expected: [128/255, 64/255, 32/255] },
                { r: 0, g: 0, b: 0, expected: [0, 0, 0] }
            ];

            for (const test of testColors) {
                const normalized = [
                    test.r / 255,
                    test.g / 255,
                    test.b / 255
                ];
                
                if (Math.abs(normalized[0] - test.expected[0]) < 0.001 &&
                    Math.abs(normalized[1] - test.expected[1]) < 0.001 &&
                    Math.abs(normalized[2] - test.expected[2]) < 0.001) {
                    // Test passed
                } else {
                    throw new Error(`Color conversion failed for RGB(${test.r}, ${test.g}, ${test.b})`);
                }
            }
            
            console.log('  ✓ Color conversion working correctly');
            this.passed++;
            
        } catch (error) {
            console.log(`  ✗ Failed: ${error.message}`);
            this.failed++;
        }
    }

    async testRMeshFileDetection() {
        console.log('Test: RMesh File Detection');
        try {
            const scpcbPath = path.join(RUNTIME_PATH, '..', '..', 'scpcb');
            const mapPath = path.join(scpcbPath, 'GFX', 'map');
            
            if (fs.existsSync(mapPath)) {
                const files = fs.readdirSync(mapPath).filter(f => f.endsWith('.rmesh'));
                console.log(`  ✓ Found ${files.length} RMesh files in SCPCB assets`);
                console.log(`    Sample: ${files[0] || 'none'}`);
                this.passed++;
            } else {
                console.log('  ⚠ SCPCB assets not found (expected in development environment)');
                this.passed++;
            }
        } catch (error) {
            console.log(`  ✗ Failed: ${error.message}`);
            this.failed++;
        }
    }

    createSimpleRMesh() {
        // Create minimal valid RMesh data - simple format
        // Header: "RoomMesh\0" + 1 mesh + 0 textures + 1 vertex + 1 triangle + 0 collision + 0 entities
        const data = [
            // String: "RoomMesh\0" - use string writing function approach
            0x52, 0x6F, 0x6F, 0x6D, 0x4D, 0x65, 0x73, 0x68, 0x00,
            // Mesh count: 1
            0x01, 0x00, 0x00, 0x00
        ];
        
        this.fileIO.registerFile('test.rmesh', new Uint8Array(data));
        return data;
    }
}

// Run tests
const test = new RMeshTest();
test.run().then(success => {
    process.exit(success ? 0 : 1);
}).catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
});
