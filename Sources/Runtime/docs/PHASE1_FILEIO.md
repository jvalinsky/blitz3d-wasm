# Phase 1: File I/O Foundation Implementation

## Overview
This implementation adds comprehensive file I/O capabilities to the Blitz3D-WASM runtime, enabling the loading of SCPCB assets (RMesh files, textures, etc.) in the browser.

## Components

### 1. File I/O Module (`fileio.js`)
The core file reading system that handles:
- **Virtual File System**: In-memory file storage and retrieval
- **Binary Reading**: ReadInt, ReadFloat, ReadString, ReadByte, ReadShort, etc.
- **File Management**: Open, close, seek, tell operations
- **WASM Integration**: Direct memory access for reading data into WASM heap
- **Asset Bundles**: Support for packaged asset bundles

### 2. Asset Manager (`asset.js`)
Asset caching and management system:
- **Bundle Creation**: Package directory of files into single JSON bundle
- **Asset Caching**: LRU-style caching for textures and meshes
- **Texture Loading**: Async image loading with caching
- **Preloading**: Batch load multiple assets with progress tracking

### 3. Integration (`core.js`, `runtime.js`)
Updated core and runtime modules to integrate file I/O:
- File I/O initialization with base path configuration
- WASM imports for all file operations
- Asset bundle loading APIs
- Cache management utilities

### 4. Build Tools (`tools/`)
Utility scripts for asset management:
- **build_assets.js**: Create asset bundles from directories
- **test_fileio.js**: Test file I/O system functionality

## Usage

### Basic Initialization

```javascript
// Initialize Blitz3D with file I/O
Blitz3D.init('canvasId', {
    basePath: './assets',
    compression: true
});
```

### Loading Asset Bundles

```javascript
// Load pre-built asset bundle
await Blitz3D.loadAssetBundle('scpcb_assets.json');

// Or create bundle from directory
await Blitz3D.createAssetBundle('./scpcb/GFX', 'assets.json');
```

### Registering Individual Files

```javascript
// Register single file
Blitz3D.core.registerFile('room.rmesh', fileData);

// Register entire directory
Blitz3D.registerAssetDirectory('./scpcb/GFX/map');
```

### Cache Management

```javascript
// Get cache statistics
const stats = Blitz3D.getCacheStats();
console.log(`Cached: ${stats.totalCached} items`);

// Clear cache
Blitz3D.clearCache();
```

## File Format Support

### Binary Reading Functions
- `ReadInt(handle)` - 32-bit signed integer (little-endian)
- `ReadUInt(handle)` - 32-bit unsigned integer
- `ReadFloat(handle)` - 32-bit float (little-endian)
- `ReadDouble(handle)` - 64-bit float
- `ReadByte(handle)` - Signed byte (-128 to 127)
- `ReadShort(handle)` - 16-bit signed integer
- `ReadUShort(handle)` - 16-bit unsigned integer
- `ReadString(handle)` - Null-terminated string
- `ReadPString(handle)` - Pascal string (length byte + data)
- `ReadLString(handle)` - Length-prefixed string (4-byte length)
- `ReadData(handle, buffer, count)` - Raw byte reading

### File Operations
- `OpenFile(path)` - Returns file handle (0 on failure)
- `CloseFile(handle)` - Close file handle
- `Eof(handle)` - Check if end of file (1=true, 0=false)
- `FileSize(path)` - Get file size in bytes
- `FileSeek(handle, position)` - Seek to position
- `FileTell(handle)` - Get current position

## Creating Asset Bundles

### Command Line
```bash
# Create bundle from directory
node tools/build_assets.js ./scpcb/GFX ./assets.json

# Without compression
node tools/build_assets.js ./scpcb/GFX ./assets.json --no-compress

# Custom extensions
node tools/build_assets.js ./assets ./bundle.json --extensions=.rmesh,.bmp,.png
```

### Programmatic
```javascript
const AssetManager = require('./modules/asset');

const manager = new AssetManager(fileIO);
await manager.createBundle('./scpcb/GFX', 'assets.json', {
    compression: true
});
```

## WASM Integration

The file I/O system integrates with WASM by providing functions in the import object:

```javascript
// In WASM, call these functions:
handle = ReadFile(pathPointer)
value = ReadInt(handle)
value = ReadFloat(handle)
str = ReadString(handle)
```

The system handles:
- Reading strings from WASM memory
- Allocating new strings in WASM heap
- Writing binary data directly to WASM memory

## Testing

Run the file I/O tests:
```bash
node tools/test_fileio.js
```

Expected output:
```
Running File I/O System Tests...

Test: FileIO Creation
  ✓ FileIO created successfully
Test: Virtual File System  
  ✓ File registered in VFS
Test: Binary Reading
  ✓ ReadInt works correctly
  ✓ ReadFloat works correctly
  ✓ ReadByte works correctly
  ✓ ReadShort works correctly
Test: Asset Bundle
  ✓ Asset Manager created successfully
Test: RMesh Format Detection
  ✓ Found XX RMesh files

--- Test Results ---
Passed: 9
Failed: 0
Total: 9
```

## RMesh File Format Support

The file I/O system is designed to support SCPCB RMesh files:

```javascript
// Example: Reading RMesh header
const header = fileIO.readString(handle);  // "RoomMesh" or "RoomMesh.HasTriggerBox"
const hasTriggerBox = (header === "RoomMesh.HasTriggerBox");
```

The format requires:
- String reading for header
- Integer reading for vertex/triangle counts
- Float reading for coordinates
- Binary reading for mesh data

## Next Steps

Phase 1 provides the foundation for:
1. **Phase 2**: RMesh parser implementation (uses File I/O)
2. **Phase 3**: Texture loading system (uses Asset Manager)
3. **Phase 4**: Integration with LoadMesh function

## Limitations

- Write operations are not fully implemented (read-only file system)
- Network-based asset loading requires fetch API wrapper
- Large file streaming not yet implemented

## Troubleshooting

### "File not found" errors
- Ensure base path is correctly configured
- Check file paths use forward slashes

### "Cannot allocate string" errors
- Verify WASM memory is accessible
- Check allocString function is set

### Cache not working
- Verify asset paths match exactly
- Check cache eviction isn't happening too aggressively
