# Building Blitz3D WASM Compiler

This document provides instructions for building the Blitz3D WASM compiler on macOS, Linux, and Windows.

## macOS

### Prerequisites
- Xcode or Command Line Tools (latest version recommended)
- Swift Toolchain (included with Xcode)

### Handling SDK Mismatch (nix-darwin / NixOS)
If you encounter errors like `missing SDK` or `target not found` when using nix, ensure your `SDKROOT` is set correctly:

```bash
export SDKROOT=$(xcrun --show-sdk-path)
swift build
```

Alternatively, ensure Xcode is active:
```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

### Build Command
```bash
swift build
```

---

## Linux

### Prerequisites
- Swift Toolchain (Ubuntu/CentOS/Fedora)
- Required dependencies:
  ```bash
  sudo apt-get install clang libicu-dev libpython3-dev libncurses5-dev libsqlite3-dev libxml2-dev libblocksruntime-dev
  ```

### Build Command
```bash
swift build
```

---

## Windows

### Prerequisites
- [Swift for Windows](https://swift.org/download/#windows)
- [Visual Studio 2022](https://visualstudio.microsoft.com/) with "Desktop development with C++" workload.

### Build Command
Use the **Developer PowerShell for VS 2022**:

```powershell
swift build
```

---

## Testing

### Swift Tests
```bash
swift test
```

### WASM Integration Tests
Requires [Node.js](https://nodejs.org/):
```bash
npm run test:all
```
