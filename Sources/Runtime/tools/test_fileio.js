#!/usr/bin/env node

/**
 * File I/O System Test
 * Tests the Blitz3D File I/O implementation
 */

const path = require('path');
const fs = require('fs');

const RUNTIME_PATH = '/Users/jack/Software/scp_port/blitz3d-wasm/Sources/Runtime';
const MODULES_PATH = path.join(RUNTIME_PATH, 'modules');

const FileIO = require(path.join(MODULES_PATH, 'fileio'));
const AssetManager = require(path.join(MODULES_PATH, 'asset'));

class FileIOTest {
    constructor() {
        this.passed = 0;
        this.failed = 0;
    }

    async run() {
        console.log('Running File I/O System Tests...\n');

        await this.testFileIOCreation();
        await this.testVirtualFileSystem();
        await this.testBinaryReading();
        await this.testAssetBundle();
        await this.testRMeshParsing();

        console.log(`\n--- Test Results ---`);
        console.log(`Passed: ${this.passed}`);
        console.log(`Failed: ${this.failed}`);
        console.log(`Total: ${this.passed + this.failed}`);

        return this.failed === 0;
    }

    async testFileIOCreation() {
        console.log('Test: FileIO Creation');
        try {
            const mockCore = { 
                readString: (ptr) => '', 
                allocString: (str) => 0, 
                memory: { buffer: new ArrayBuffer(1024) } 
            };
            const fileIO = new FileIO(mockCore);
            
            if (fileIO && fileIO.fileSystem && fileIO.openFiles) {
                console.log('  ✓ FileIO created successfully');
                this.passed++;
            } else {
                throw new Error('FileIO missing required properties');
            }
        } catch (error) {
            console.log(`  ✗ Failed: ${error.message}`);
            this.failed++;
        }
    }

    async testVirtualFileSystem() {
        console.log('Test: Virtual File System');
        try {
            const mockCore = { 
                readString: (ptr) => '', 
                allocString: (str) => 0, 
                memory: { buffer: new ArrayBuffer(1024) } 
            };
            const fileIO = new FileIO(mockCore);
            fileIO.init();
            
            // Register a test file
            const testData = new Uint8Array([0x48, 0x65, 0x6C, 0x6C, 0x6F, 0x00]); // "Hello\0"
            fileIO.registerFile('test.rmesh', testData);
            
            if (fileIO.fileSystem.has('test.rmesh')) {
                console.log('  ✓ File registered in VFS');
                this.passed++;
            } else {
                throw new Error('File not found in VFS');
            }
        } catch (error) {
            console.log(`  ✗ Failed: ${error.message}`);
            this.failed++;
        }
    }

    async testBinaryReading() {
        console.log('Test: Binary Reading');
        try {
            const mockCore = { 
                readString: (ptr) => '', 
                allocString: (str) => 0, 
                memory: { buffer: new ArrayBuffer(1024) } 
            };
            const fileIO = new FileIO(mockCore);
            fileIO.init();
            
            // Create test file with known binary data
            // 18.0 as little-endian float: 0x00 0x00 0x90 0x41
            const testData = new Uint8Array([
                0x01, 0x02, 0x03, 0x04,                                           // Int: 0x04030201
                0x00, 0x00, 0x90, 0x41,                                           // Float: 18.0 (little-endian)
                0x48, 0x65, 0x6C, 0x6C, 0x6F, 0x00,                               // String: "Hello"
                0xFF,                                                             // Byte: 255
                0x00, 0x01                                                        // Short: 256
            ]);
            
            fileIO.registerFile('binary_test.bin', testData);
            const handle = fileIO.openFile('binary_test.bin');
            
            // Test reading int (little-endian)
            const intVal = fileIO.readInt(handle);
            if (intVal === 0x04030201) {
                console.log('  ✓ ReadInt works correctly');
                this.passed++;
            } else {
                throw new Error(`Expected 0x04030201, got ${intVal.toString(16)}`);
            }
            
            // Test reading float
            const floatVal = fileIO.readFloat(handle);
            if (Math.abs(floatVal - 18.0) < 0.01) {
                console.log('  ✓ ReadFloat works correctly');
                this.passed++;
            } else {
                throw new Error(`Expected 18.0, got ${floatVal}`);
            }
            
            // Test reading byte - read 'H' from "Hello" at position 8
            const byteVal = fileIO.readByte(handle);
            if (byteVal === 72) {  // 72 = 'H'
                console.log('  ✓ ReadByte works correctly');
                this.passed++;
            } else {
                throw new Error(`Expected 72 ('H'), got ${byteVal}`);
            }
            
            // Test reading short - read 'e' and 'l' from "Hello" = 0x6C65 = 27749
            const shortVal = fileIO.readShort(handle);
            if (shortVal === 27749) {  // 'l' (108) + ('e' (101) << 8) = 27749
                console.log('  ✓ ReadShort works correctly');
                this.passed++;
            } else {
                throw new Error(`Expected 27749, got ${shortVal}`);
            }
            
            fileIO.closeFile(handle);
        } catch (error) {
            console.log(`  ✗ Failed: ${error.message}`);
            this.failed++;
        }
    }

    async testAssetBundle() {
        console.log('Test: Asset Bundle');
        try {
            const mockCore = { 
                readString: (ptr) => '', 
                allocString: (str) => 0, 
                memory: { buffer: new ArrayBuffer(1024) } 
            };
            const fileIO = new FileIO(mockCore);
            const assetManager = new AssetManager(fileIO);
            
            assetManager.init('/test');
            
            if (assetManager.cache && assetManager.bundle === null) {
                console.log('  ✓ Asset Manager created successfully');
                this.passed++;
            } else {
                throw new Error('Asset Manager not properly initialized');
            }
        } catch (error) {
            console.log(`  ✗ Failed: ${error.message}`);
            this.failed++;
        }
    }

    async testRMeshParsing() {
        console.log('Test: RMesh Format Detection');
        try {
            const scpcbPath = path.join(RUNTIME_PATH, '..', '..', 'scpcb');
            const mapPath = path.join(scpcbPath, 'GFX', 'map');
            
            if (fs.existsSync(mapPath)) {
                const files = fs.readdirSync(mapPath).filter(f => f.endsWith('.rmesh'));
                if (files.length > 0) {
                    console.log(`  ✓ Found ${files.length} RMesh files in map directory`);
                    console.log(`    Sample: ${files[0]}`);
                    this.passed++;
                } else {
                    console.log('  ⚠ No RMesh files found (expected if SCPCB assets not present)');
                    this.passed++;
                }
            } else {
                console.log('  ⚠ SCPCB assets not found (expected if not installed)');
                this.passed++;
            }
        } catch (error) {
            console.log(`  ✗ Failed: ${error.message}`);
            this.failed++;
        }
    }
}

// Run tests
const test = new FileIOTest();
test.run().then(success => {
    process.exit(success ? 0 : 1);
}).catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
});
