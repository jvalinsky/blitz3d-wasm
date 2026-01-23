# Asset Pipeline & Mesh System Architecture

## Overview

This document outlines the architecture of the asset pipeline, focusing on how RMesh assets are loaded, parsed, and represented in the Swift-based Blitz3D Runtime.

```mermaid
graph TB
    subgraph "Asset Sources"
        RMesh["Level Geometry (.rmesh)"]
        B3D["3D Models (.b3d)"]
        Textures["Textures (.jpg/.png)"]
    end

    subgraph "Parsing Layer (Swift/WASM)"
        Reader["BinaryReader (UnsafeRawBufferPointer)"]
        Parser["RMeshParser"]
        
        RMesh --> Reader
        Reader --> Parser
    end

    subgraph "Runtime Core (Swift)"
        Scene["Scene Graph (Entity Hierarchy)"]
        Mesh["Mesh (Geometry)"]
        Surface["Surface (Vertex Buffer)"]
        
        Parser -->|"Creates"| Mesh
        Mesh -->|"Contains"| Surface
        
        Surface -->|"Hold"| VBO["UnsafeMutablePointer<Vertex>"]
        Surface -->|"Hold"| IBO["UnsafeMutablePointer<Int32>"]
    end

    subgraph "Rendering Bridge (JS/WebGL)"
        JS["Runtime (JS)"]
        WebGL["WebGL Context"]
        
        Surface -.->|"Pointers (WASM Memory)"| JS
        JS -->|"gl.bufferData"| WebGL
    end
```

## Mesh Data Structure

The `Mesh` class is the core geometry container. It mimics the Blitz3D structure but is optimized for WebGL data transfer.

```mermaid
classDiagram
    class Entity {
        +Vec3 position
        +Vec3 rotation
        +Vec3 scale
        +Entity parent
        +Entity[] children
    }
    
    class Mesh {
        +Surface[] surfaces
        +AABB boundingBox
    }
    
    class Surface {
        +UnsafeMutablePointer~Vertex~ vertices
        +UnsafeMutablePointer~Int32~ indices
        +Int32 vertexCount
        +Int32 indexCount
        +Material material
    }
    
    class Vertex {
        +Vec3 position
        +Vec3 normal
        +Vec2 uv0
        +Vec2 uv1
        +Byte[4] color
    }
    
    Entity <|-- Mesh
    Mesh "1" --> "*" Surface
    Surface "1" --> "*" Vertex
```

## RMesh Parsing Flow

The parsing process converts the compact, game-specific RMesh format into the runtime's standard `Mesh` format.

```mermaid
sequenceDiagram
    participant B as BB Runtime
    participant E as Swift Engine
    participant P as RMeshParser
    participant M as Mesh
    participant S as Surface

    B->>E: _bb_LoadRMesh("map.rmesh")
    E->>E: Load File to Memory
    E->>P: init(data)
    E->>P: parse()
    
    loop Drawn Meshes
        P->>M: Create Mesh
        P->>S: Create Surface
        P->>S: Read Vertices (Pos+UV+Color)
        Note right of S: Convert to Pos+Norm+UV+Color
        P->>S: Read Triangles
    end
    
    loop Entities
        P->>E: Create Point Entities (Lights, etc.)
    end
    
    P-->>E: Return Mesh Handle
    E-->>B: Return Handle (Int32)
```

## Asset Pipeline: File to GPU

1.  **File Loading:** The file is fetched (via fetch API or embedded FS) into WASM Linear Memory.
2.  **Parsing:** `RMeshParser` reads the raw bytes and populates `Surface` vertex buffers directly in WASM memory.
3.  **Rendering Sync:**
    *   JS Runtime queries the WASM memory address of the Vertex Buffer.
    *   JS creates a `Float32Array` view on that WASM memory.
    *   JS calls `gl.bufferData` to upload it to the GPU.
    *   *Result:* Zero-copy from Parse to Upload (view only).

## Collision Integration

The parsed mesh data is reused for physics.

```mermaid
flowchart TD
    A[Parsed Surface] --> B{Usage}
    B -->|Rendering| C[WebGL VBO]
    B -->|Physics| D[Collision Triangle Soup]
    
    D --> E[Spatial Partitioning (Octree/Grid)]
    E --> F[Collision World]
```
