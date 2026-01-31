# Swift WebAssembly Setup on Linux

This guide covers how to set up Swift to compile to WebAssembly on Linux (Ubuntu 24.04).

## Prerequisites

- Ubuntu 24.04 LTS (or similar Linux distribution)
- ~2GB free disk space
- Internet connection

## Overview

Swift 6.2+ has native WebAssembly support through the WASI (WebAssembly System Interface) target. This allows Swift code to compile to portable WebAssembly binaries that can run in WASI-compatible runtimes.

## Installation Steps

### 1. Install Swift 6.2+

```bash
# Download Swift 6.2 for Ubuntu 24.04
cd /tmp
wget https://download.swift.org/swift-6.2-release/ubuntu2404/swift-6.2-RELEASE/swift-6.2-RELEASE-ubuntu24.04.tar.gz

# Extract
tar xzf swift-6.2-RELEASE-ubuntu24.04.tar.gz

# Install to /opt/swift
sudo mv swift-6.2-RELEASE-ubuntu24.04 /opt/swift

# Add to PATH (add this to your ~/.bashrc or ~/.zshrc)
export PATH=/opt/swift/usr/bin:$PATH

# Verify installation
swift --version
# Should show: Swift version 6.2 (swift-6.2-RELEASE)
```

### 2. Install Swift WASM SDK

The SwiftWasm project provides pre-built SDKs for WebAssembly compilation:

```bash
# Download the WASM SDK
cd /tmp
wget https://github.com/swiftwasm/swift/releases/download/swift-wasm-6.2-RELEASE/swift-wasm-6.2-RELEASE-wasm32-unknown-wasip1.artifactbundle.zip

# Extract
unzip swift-wasm-6.2-RELEASE-wasm32-unknown-wasip1.artifactbundle.zip

# Install SDK
sudo mkdir -p /opt/swift-sdks
sudo mv swift-wasm-6.2-RELEASE-wasm32-unknown-wasip1.artifactbundle /opt/swift-sdks/

# Register SDK with Swift
swift sdk install /opt/swift-sdks/swift-wasm-6.2-RELEASE-wasm32-unknown-wasip1.artifactbundle/

# Verify SDK installation
swift sdk list
# Should show the installed WASM SDK
```

### 3. Create Symbolic Links for WASI Support

Swift needs to find the WASI sysroot and standard library:

```bash
# Link WASI sysroot
sudo ln -s /opt/swift-sdks/swift-wasm-6.2-RELEASE-wasm32-unknown-wasip1.artifactbundle/6.2-RELEASE-wasm32-unknown-wasip1/wasm32-unknown-wasip1/WASI.sdk /opt/swift/usr/share/wasi-sysroot

# Link WASI standard library
sudo ln -s /opt/swift-sdks/swift-wasm-6.2-RELEASE-wasm32-unknown-wasip1.artifactbundle/6.2-RELEASE-wasm32-unknown-wasip1/wasm32-unknown-wasip1/swift.xctoolchain/usr/lib/swift/wasi /opt/swift/usr/lib/swift/wasi
```

### 4. Install WASI Runtime (Optional but Recommended)

To run WASM binaries locally, install wasmtime:

```bash
curl https://wasmtime.dev/install.sh -sSf | bash

# Add to PATH (or restart terminal)
export PATH=$HOME/.wasmtime/bin:$PATH

# Verify installation
wasmtime --version
```

## Usage

### Create a New Swift Package

```bash
mkdir my-wasm-project && cd my-wasm-project
swift package init --type executable
```

### Build for WebAssembly

```bash
# Build for WASM target
swift build --swift-sdk wasm32-unknown-wasip1

# Output will be in:
# .build/wasm32-unknown-wasip1/debug/[PackageName].wasm
```

### Run the WASM Binary

```bash
# Using wasmtime
wasmtime .build/wasm32-unknown-wasip1/debug/[PackageName].wasm
```

## Example Project

### Sources/main.swift

```swift
import Foundation

print("Hello from Swift WebAssembly!")

let numbers = [1, 2, 3, 4, 5]
let sum = numbers.reduce(0, +)
print("Sum of \(numbers) = \(sum)")

struct Person {
    let name: String
    let age: Int
}

let person = Person(name: "Alice", age: 30)
print("Person: \(person.name), \(person.age) years old")
```

### Build and Run

```bash
swift build --swift-sdk wasm32-unknown-wasip1
wasmtime .build/wasm32-unknown-wasip1/debug/MyWasmProject.wasm
```

### Expected Output

```
Hello from Swift WebAssembly!
Sum of [1, 2, 3, 4, 5] = 15
Person: Alice, 30 years old
```

## Features & Capabilities

### ✅ Supported

- Full Swift language features (structs, classes, enums, protocols)
- Foundation library (dates, strings, collections, etc.)
- Standard library (arrays, dictionaries, closures, etc.)
- Swift Concurrency (async/await, Tasks)
- Error handling
- Generics and protocols
- Value types and reference types

### ⚠️ Limitations

- No Objective-C interop
- No UIKit/AppKit (use browser APIs via JavaScript interop)
- No direct DOM access (requires JavaScript bridge)
- File I/O limited to WASI capabilities
- No native threading (use Swift Concurrency)

## Troubleshooting

### "unable to load standard library for target 'wasm32-unknown-wasip1'"

**Cause:** Missing WASI standard library link

**Solution:**
```bash
sudo ln -s /opt/swift-sdks/swift-wasm-6.2-RELEASE-wasm32-unknown-wasip1.artifactbundle/6.2-RELEASE-wasm32-unknown-wasip1/wasm32-unknown-wasip1/swift.xctoolchain/usr/lib/swift/wasi /opt/swift/usr/lib/swift/wasi
```

### "module compiled with Swift 6.2 cannot be imported by the Swift 6.1 compiler"

**Cause:** Version mismatch between Swift compiler and WASM SDK

**Solution:** Ensure you have Swift 6.2+ installed:
```bash
swift --version  # Should show 6.2 or higher
```

### "no such SDK: /opt/swift/usr/share/wasi-sysroot"

**Cause:** Missing WASI sysroot link

**Solution:**
```bash
sudo ln -s /opt/swift-sdks/swift-wasm-6.2-RELEASE-wasm32-unknown-wasip1.artifactbundle/6.2-RELEASE-wasm32-unknown-wasip1/wasm32-unknown-wasip1/WASI.sdk /opt/swift/usr/share/wasi-sysroot
```

### Disk Space Issues

Swift and the WASM SDK require significant disk space:
- Swift 6.2: ~950MB
- WASM SDK: ~100MB
- Build artifacts: varies by project

Ensure you have at least 2GB free space.

## Version Compatibility

| Swift Version | WASM SDK Version | Status |
|--------------|------------------|--------|
| 6.2+         | 6.2+            | ✅ Recommended |
| 6.1          | 6.1             | ⚠️ Limited support |
| 6.0          | 6.0             | ⚠️ Experimental |
| < 6.0        | N/A             | ❌ Not supported |

**Important:** Always match your Swift compiler version with the WASM SDK version to avoid compatibility issues.

## Advanced Usage

### Release Builds

```bash
# Optimized release build
swift build --swift-sdk wasm32-unknown-wasip1 -c release

# Output in:
# .build/wasm32-unknown-wasip1/release/[PackageName].wasm
```

Release builds are significantly smaller and faster:
- Debug build: ~7MB
- Release build: ~2-3MB (with optimization)

### Cross-Compilation from macOS

The same WASM SDK works on macOS with Swift 6.2+:

```bash
# On macOS, install Xcode 15.3+ or Swift 6.2+ toolchain
swift build --swift-sdk wasm32-unknown-wasip1
```

### Using in CI/CD

Example GitHub Actions workflow:

```yaml
name: Build WASM
on: [push]

jobs:
  build:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      
      - name: Install Swift
        run: |
          wget https://download.swift.org/swift-6.2-release/ubuntu2404/swift-6.2-RELEASE/swift-6.2-RELEASE-ubuntu24.04.tar.gz
          tar xzf swift-6.2-RELEASE-ubuntu24.04.tar.gz
          sudo mv swift-6.2-RELEASE-ubuntu24.04 /opt/swift
          echo "/opt/swift/usr/bin" >> $GITHUB_PATH
      
      - name: Install WASM SDK
        run: |
          wget https://github.com/swiftwasm/swift/releases/download/swift-wasm-6.2-RELEASE/swift-wasm-6.2-RELEASE-wasm32-unknown-wasip1.artifactbundle.zip
          unzip swift-wasm-6.2-RELEASE-wasm32-unknown-wasip1.artifactbundle.zip
          sudo mkdir -p /opt/swift-sdks
          sudo mv swift-wasm-6.2-RELEASE-wasm32-unknown-wasip1.artifactbundle /opt/swift-sdks/
          swift sdk install /opt/swift-sdks/swift-wasm-6.2-RELEASE-wasm32-unknown-wasip1.artifactbundle/
          sudo ln -s /opt/swift-sdks/swift-wasm-6.2-RELEASE-wasm32-unknown-wasip1.artifactbundle/6.2-RELEASE-wasm32-unknown-wasip1/wasm32-unknown-wasip1/WASI.sdk /opt/swift/usr/share/wasi-sysroot
          sudo ln -s /opt/swift-sdks/swift-wasm-6.2-RELEASE-wasm32-unknown-wasip1.artifactbundle/6.2-RELEASE-wasm32-unknown-wasip1/wasm32-unknown-wasip1/swift.xctoolchain/usr/lib/swift/wasi /opt/swift/usr/lib/swift/wasi
      
      - name: Build
        run: swift build --swift-sdk wasm32-unknown-wasip1 -c release
      
      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: wasm-binary
          path: .build/wasm32-unknown-wasip1/release/*.wasm
```

## Resources

- [Swift.org WASM Documentation](https://www.swift.org/documentation/articles/wasm-getting-started.html)
- [SwiftWasm Project](https://github.com/swiftwasm/swift)
- [WASI Specification](https://github.com/WebAssembly/WASI)
- [Wasmtime Runtime](https://wasmtime.dev/)

## Related Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) - Overall project architecture
- [GETTING_STARTED.md](GETTING_STARTED.md) - General project setup
- [RUNTIME_ARCHITECTURE.md](RUNTIME_ARCHITECTURE.md) - Runtime system design

## Conclusion

Swift WebAssembly compilation works excellently on Linux with Swift 6.2+. The key requirements are:

1. ✅ Swift 6.2+ compiler installed
2. ✅ Matching SwiftWasm SDK version
3. ✅ Proper symbolic links for WASI support
4. ✅ WASI runtime for local testing

Once set up, you can use the full power of Swift to build portable WebAssembly applications.
