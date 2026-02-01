---
name: swiftwasm-porting
description: Check Swift on WASM compatibility, identify incompatible frameworks, and refactor code for WebAssembly
---

# Swift WebAssembly Porting Skill

You are a Swift on WebAssembly (WASM) compatibility expert. Your task is to help port Swift projects to run in WebAssembly environments by identifying incompatibilities and providing WebAssembly-safe alternatives.

## Core Capabilities

1. **Check WASM Compatibility** - Analyze Swift packages for WASM readiness
2. **Identify Incompatible APIs** - Detect platform-specific frameworks
3. **Refactor for WASM** - Use conditional compilation patterns
4. **Build and Test** - Verify with SwiftWasm toolchain
5. **Find Alternatives** - Suggest WASM-safe replacements

## Incompatible Frameworks

These frameworks are **NOT available** on WebAssembly:

### UI Frameworks
- ❌ `UIKit` - iOS UI framework
- ❌ `AppKit` - macOS UI framework  
- ❌ `SwiftUI` - Declarative UI (partially supported with Tokamak)

### Graphics & Media
- ❌ `CoreGraphics` - 2D graphics rendering
- ❌ `CoreImage` - Image processing
- ❌ `CoreML` - Machine learning models
- ❌ `AVFoundation` - Audio/video playback
- ❌ `Metal` - GPU programming

### System Frameworks
- ❌ `URLSession` - Network requests (use fetch via JavaScript)
- ❌ `Accelerate` - SIMD/BLAS operations
- ❌ `CoreLocation` - GPS/location services
- ❌ `CoreBluetooth` - Bluetooth connectivity
- ❌ `HealthKit` - Health data access

### File System
- ⚠️ `FileManager` - Limited support (WASI virtual filesystem only)
- ⚠️ `Foundation.URL` - Limited to in-memory or WASI paths

## Conditional Compilation Patterns

Use `#if` directives to provide platform-specific implementations:

### Basic Pattern

```swift
#if canImport(UIKit)
import UIKit
// iOS implementation
#elseif canImport(AppKit)
import AppKit
// macOS implementation
#else
// WASM implementation
#endif
```

### OS-Specific

```swift
#if os(WASI)
// WebAssembly implementation
#elseif os(iOS)
// iOS implementation
#elseif os(macOS)
// macOS implementation
#endif
```

### Accelerate Replacement

```swift
#if canImport(Accelerate)
import Accelerate

func matrixMultiply(_ a: [Float], _ b: [Float]) -> [Float] {
    // Use vDSP_mmul for high performance
    var result = [Float](repeating: 0, count: a.count)
    vDSP_mmul(a, 1, b, 1, &result, 1, vDSP_Length(n), vDSP_Length(m), vDSP_Length(k))
    return result
}
#else
// WASM fallback: Use Matft or pure Swift
func matrixMultiply(_ a: [Float], _ b: [Float]) -> [Float] {
    // Pure Swift implementation or Matft library
    return pureSwiftMatrixMultiply(a, b)
}
#endif
```

## WASM-Safe Alternatives

### Networking

**Problem**: `URLSession` not available

**Solution**: Use JavaScriptKit to call fetch API

```swift
#if os(WASI)
import JavaScriptKit

func fetchData(from url: String) async throws -> String {
    let fetch = JSObject.global.fetch
    let response = try await JSPromise(fetch(url).object!)!.value
    let text = try await JSPromise(response.object!.text().object!)!.value
    return text.string!
}
#else
import Foundation

func fetchData(from url: String) async throws -> String {
    let (data, _) = try await URLSession.shared.data(from: URL(string: url)!)
    return String(data: data, encoding: .utf8)!
}
#endif
```

### Math/Numerics

**Problem**: `Accelerate` not available

**Solutions**:
1. **Matft** - NumPy-like library for Swift
2. **CLAPACK** - Linear algebra (can be compiled to WASM)
3. **Pure Swift** - Implement algorithms directly
4. **SIMD** - Use Swift's built-in SIMD types

```swift
import SIMD

func vectorAdd(_ a: [Float], _ b: [Float]) -> [Float] {
    var result = [Float]()
    result.reserveCapacity(a.count)
    
    let simdCount = a.count / 4
    for i in 0..<simdCount {
        let aVec = SIMD4<Float>(a[i*4..<i*4+4])
        let bVec = SIMD4<Float>(b[i*4..<i*4+4])
        let resultVec = aVec + bVec
        result.append(contentsOf: [resultVec.x, resultVec.y, resultVec.z, resultVec.w])
    }
    
    return result
}
```

### Graphics

**Problem**: `CoreGraphics`, `Metal` not available

**Solutions**:
- **Canvas API** - Use JavaScript Canvas via JavaScriptKit
- **WebGL** - Access WebGL for 3D rendering
- **SVG** - Generate SVG programmatically

```swift
#if os(WASI)
import JavaScriptKit

class CanvasRenderer {
    let canvas: JSObject
    let context: JSObject
    
    init(canvasId: String) {
        let document = JSObject.global.document
        self.canvas = document.getElementById!(canvasId).object!
        self.context = canvas.getContext!("2d").object!
    }
    
    func drawRect(x: Double, y: Double, width: Double, height: Double) {
        _ = context.fillRect!(x, y, width, height)
    }
}
#else
import CoreGraphics

class CanvasRenderer {
    let context: CGContext
    // iOS/macOS implementation
}
#endif
```

### File System

**Problem**: `FileManager` has limited WASI support

**Solution**: Use protocol abstraction + dependency injection

```swift
// Define protocol for file operations
protocol FileSystemProtocol {
    func read(path: String) throws -> Data
    func write(data: Data, to path: String) throws
    func exists(path: String) -> Bool
}

#if os(WASI)
// WASM implementation using WASI VFS
class WASIFileSystem: FileSystemProtocol {
    func read(path: String) throws -> Data {
        // Use Foundation's limited WASI support
        return try Data(contentsOf: URL(fileURLWithPath: path))
    }
    
    func write(data: Data, to path: String) throws {
        try data.write(to: URL(fileURLWithPath: path))
    }
    
    func exists(path: String) -> Bool {
        return FileManager.default.fileExists(atPath: path)
    }
}
#else
// Native implementation
class NativeFileSystem: FileSystemProtocol {
    func read(path: String) throws -> Data {
        return try Data(contentsOf: URL(fileURLWithPath: path))
    }
    
    func write(data: Data, to path: String) throws {
        try data.write(to: URL(fileURLWithPath: path))
    }
    
    func exists(path: String) -> Bool {
        return FileManager.default.fileExists(atPath: path)
    }
}
#endif
```

## Porting Workflow

1. **Analyze** - Scan for incompatible imports
   ```bash
   grep -r "import UIKit\|import CoreGraphics\|import Accelerate" Sources/
   ```

2. **Identify** - List all incompatible APIs being used

3. **Design Abstractions** - Create protocols for platform-specific code
   ```swift
   protocol NetworkingProtocol {
       func fetch(_ url: String) async throws -> Data
   }
   ```

4. **Implement Conditionally** - Provide platform-specific implementations
   ```swift
   #if os(WASI)
   class WASMNetworking: NetworkingProtocol { }
   #else
   class NativeNetworking: NetworkingProtocol { }
   #endif
   ```

5. **Inject Dependencies** - Use dependency injection pattern
   ```swift
   class MyApp {
       let networking: NetworkingProtocol
       
       init(networking: NetworkingProtocol) {
           self.networking = networking
       }
   }
   ```

6. **Build and Test** - Verify with SwiftWasm toolchain
   ```bash
   swift build --triple wasm32-unknown-wasi
   ```

## Build Configuration

### Install SwiftWasm Toolchain

1. Download from [SwiftWasm Releases](https://github.com/swiftwasm/swift/releases)
2. Extract to `~/Library/Developer/Toolchains/`
3. Select toolchain:
   ```bash
   export TOOLCHAINS=swiftwasm
   ```

### Build Commands

```bash
# Build for WASM
swift build --triple wasm32-unknown-wasi

# Run tests
swift test --triple wasm32-unknown-wasi

# With specific toolchain
xcrun --toolchain swiftwasm swift build --triple wasm32-unknown-wasi
```

### Package.swift Platforms

```swift
let package = Package(
    name: "MyLibrary",
    platforms: [
        .macOS(.v13),
        .iOS(.v16),
        .wasi(.v1)  // WebAssembly System Interface
    ],
    // ...
)
```

## Common Porting Scenarios

### Porting a Math Library

```swift
// Before: Accelerate-only
import Accelerate

public func mean(_ values: [Double]) -> Double {
    var result: Double = 0
    vDSP_meanD(values, 1, &result, vDSP_Length(values.count))
    return result
}

// After: Cross-platform
#if canImport(Accelerate)
import Accelerate

public func mean(_ values: [Double]) -> Double {
    var result: Double = 0
    vDSP_meanD(values, 1, &result, vDSP_Length(values.count))
    return result
}
#else
public func mean(_ values: [Double]) -> Double {
    return values.reduce(0, +) / Double(values.count)
}
#endif
```

### Porting a UI Component

```swift
// Define protocol for UI abstraction
protocol ButtonProtocol {
    func setTitle(_ title: String)
    func setAction(_ action: @escaping () -> Void)
}

#if canImport(UIKit)
import UIKit
class NativeButton: ButtonProtocol {
    private let button: UIButton
    // UIKit implementation
}
#elseif os(WASI)
import JavaScriptKit
class WebButton: ButtonProtocol {
    private let element: JSObject
    // DOM implementation
}
#endif
```

## When to Use This Skill

Load this skill when:
- Porting existing Swift libraries to WebAssembly
- Analyzing codebase for WASM compatibility
- Finding alternatives to platform-specific frameworks
- Setting up conditional compilation
- Debugging WASM build errors
- Creating cross-platform Swift libraries

## Related Skills

- `swiftwasm-javascriptkit` - JavaScript interop for WASM
- `swiftwasm-bridgejs` - Type-safe bindings

## Resources

- [SwiftWasm GitHub](https://github.com/swiftwasm/swift)
- [SwiftWasm Book](https://book.swiftwasm.org/)
- [Matft Library](https://github.com/jjjkkkjjj/Matft)
- [WASI Documentation](https://wasi.dev/)
