# RMesh Parser Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a high-performance binary RMesh parser in Swift to replace legacy Blitz3D parsing, enabling instant loading of SCP:CB assets.

**Architecture:** 
A `RMeshParser` class wraps `BinaryReader` to traverse the RMesh file structure. It populates the existing `Mesh` and `Surface` classes in `Blitz3DEngine`. The parser unpacks the compact RMesh vertex format (Pos + 2xUV + Color) into the engine's standard vertex format (Pos + Normal + UV + Color).

**Tech Stack:** Swift 6.0, UnsafeMutableBufferPointer (for performance), Blitz3D-WASM Runtime

### Task 1: Skeleton & Test Setup

**Files:**
- Modify: `Sources/Blitz3DEngine/Parsers/RMeshParser.swift`
- Create: `Tests/CompilerTests/RMeshParserTests.swift`

**Step 1: Create Test Harness**

Create `Tests/CompilerTests/RMeshParserTests.swift`:
```swift
import XCTest
@testable import Blitz3DEngine

final class RMeshParserTests: XCTestCase {
    func testHeaderParsing() throws {
        // Create a minimal valid RMesh header
        let header = "RoomMesh"
        var data = [UInt8]()
        data.append(contentsOf: header.utf8)
        data.append(0) // Null terminator
        
        // Add minimal empty mesh counts
        // Drawn mesh count: 0
        data.append(contentsOf: withUnsafeBytes(of: Int32(0).littleEndian) { Array($0) })
        // Collision mesh count: 0
        data.append(contentsOf: withUnsafeBytes(of: Int32(0).littleEndian) { Array($0) })
        // Point entity count: 0
        data.append(contentsOf: withUnsafeBytes(of: Int32(0).littleEndian) { Array($0) })
        
        let buffer = data.withUnsafeBytes { buffer in
            UnsafeRawBufferPointer(start: buffer.baseAddress, count: buffer.count)
        }
        
        let parser = RMeshParser(data: buffer)
        XCTAssertNoThrow(try parser.parse())
    }
}
```

**Step 2: Run test to verify it fails (or compile error)**

Run: `swift test --filter RMeshParserTests`
Expected: Fail (Methods unimplemented or logic missing)

**Step 3: Update Skeleton**

Modify `Sources/Blitz3DEngine/Parsers/RMeshParser.swift` to ensure `parse()` can handle the minimal structure without error.

**Step 4: Run test to verify it passes**

Run: `swift test --filter RMeshParserTests`
Expected: PASS

**Step 5: Commit**

```bash
git add Sources/Blitz3DEngine/Parsers/RMeshParser.swift Tests/CompilerTests/RMeshParserTests.swift
git commit -m "feat: skeleton rmesh parser and basic header test"
```

### Task 2: Drawn Mesh Parsing (Geometry)

**Files:**
- Modify: `Sources/Blitz3DEngine/Parsers/RMeshParser.swift`
- Modify: `Tests/CompilerTests/RMeshParserTests.swift`

**Step 1: Enhance Test Case**

Add `testDrawnMeshParsing` to `Tests/CompilerTests/RMeshParserTests.swift`:
- Construct a binary buffer representing:
    - 1 Drawn Mesh
    - 0 Textures
    - 3 Vertices (Triangle)
    - 1 Triangle (Indices 0, 1, 2)
- Assert that `MeshManager` contains the new mesh and it has correct vertex count.

**Step 2: Run test to verify failure**

Run: `swift test --filter RMeshParserTests`
Expected: Fail (Parser logic for meshes is empty/wrong)

**Step 3: Implement `parseDrawnMeshes`**

Update `Sources/Blitz3DEngine/Parsers/RMeshParser.swift`:
- Read Texture Flags & Paths
- Read Vertex Count
- Loop Vertices:
    - Read X, Y, Z
    - Read UVs (2 sets)
    - Read RGB
    - **Logic:** Call `surface.addVertex(...)` (Need to ensure `Surface` supports this)
- Read Triangle Count
- Loop Triangles:
    - Read v0, v1, v2
    - **Logic:** Call `surface.addTriangle(...)`

**Step 4: Run test to verify pass**

Run: `swift test --filter RMeshParserTests`
Expected: PASS

**Step 5: Commit**

```bash
git add Sources/Blitz3DEngine/Parsers/RMeshParser.swift Tests/CompilerTests/RMeshParserTests.swift
git commit -m "feat: implement drawn mesh geometry parsing"
```

### Task 3: Collision Mesh Parsing

**Files:**
- Modify: `Sources/Blitz3DEngine/Parsers/RMeshParser.swift`

**Step 1: Enhance Test Case**

Add `testCollisionMeshParsing`:
- Construct binary buffer with 1 Collision Mesh.
- Verify parser reads it correctly (skips or processes it).

**Step 2: Implement `parseCollisionMeshes`**

Update `Sources/Blitz3DEngine/Parsers/RMeshParser.swift`:
- Logic similar to drawn meshes but simpler vertex format (Pos only).
- Create a `Mesh` with name "CollisionMesh".

**Step 3: Verify**

Run tests.

**Step 4: Commit**

```bash
git add Sources/Blitz3DEngine/Parsers/RMeshParser.swift
git commit -m "feat: implement collision mesh parsing"
```

### Task 4: Entity Parsing (Lights/Screens/Waypoints)

**Files:**
- Modify: `Sources/Blitz3DEngine/Parsers/RMeshParser.swift`

**Step 1: Enhance Test Case**

Add `testEntityParsing`:
- Construct buffer with 1 "light" entity.

**Step 2: Implement `parsePointEntities`**

Update `Sources/Blitz3DEngine/Parsers/RMeshParser.swift`:
- Switch statement on entity type string.
- Create `Entity` objects (Pivot/Light) in the scene graph.

**Step 3: Verify**

Run tests.

**Step 4: Commit**

```bash
git add Sources/Blitz3DEngine/Parsers/RMeshParser.swift
git commit -m "feat: implement rmesh entity parsing"
```

### Task 5: Integration & API Exposure

**Files:**
- Modify: `Sources/Blitz3DEngine/Exports.swift`

**Step 1: Expose to C/WASM**

Add `_bb_LoadRMesh` function:
```swift
@_cdecl("_bb_LoadRMesh")
public func _bb_LoadRMesh(pathPtr: UnsafePointer<CChar>) -> Int32 {
    let path = String(cString: pathPtr)
    // Load file data...
    // Call parser...
    // Return Mesh Handle
}
```

**Step 2: Commit**

```bash
git add Sources/Blitz3DEngine/Exports.swift
git commit -m "feat: expose LoadRMesh to runtime"
```
