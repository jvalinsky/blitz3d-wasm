# Building Blitz3D WASM with Docker

If you encounter Swift compiler crashes (Signal 6) on macOS when building the WASM target, you can use Docker to build in a stable Linux environment.

## Prerequisites

- Docker Desktop installed and running.

## Build Instructions

1. **Build the Docker Image:**

   ```bash
   docker build -t blitz3d-wasm-build .
   ```

2. **Run the Build and Extract the WASM Binary:**

   ```bash
   # Run the container and copy the output
   docker run --name blitz3d-temp blitz3d-wasm-build
   docker cp blitz3d-temp:/app/dist/engine.wasm ./dist/engine.wasm
   docker rm blitz3d-temp
   ```

3. **Incremental Builds (Mounting Volume):**

   If you want to build iteratively without rebuilding the entire image:

   ```bash
   docker run -it -v $(pwd):/app blitz3d-wasm-build /bin/bash
   # Inside the container:
   swift build --product blitz3d-engine --swift-sdk 6.0.3-RELEASE-wasm32-unknown-wasi --triple wasm32-unknown-wasip1 -Xlinker --export-all -Xlinker --no-entry -Xswiftc -enable-experimental-feature -Xswiftc Extern -c release
   ```

## Troubleshooting

- **Architecture:** The Dockerfile automatically detects `x86_64` vs `aarch64` (Apple Silicon).
- **SDK Version:** If the build fails due to SDK mismatch, check the latest WASM SDK version at [swiftwasm.org](https://swiftwasm.org/).
