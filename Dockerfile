FROM swift:6.0-jammy

# Install dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    unzip \
    libsqlite3-dev \
    && rm -rf /var/lib/apt/lists/*

# Install SwiftWasm SDK
# We download and compute checksum because Swift 6 requires it for local/untrusted bundles.
RUN ARCH=$(uname -m) && \
    if [ "$ARCH" = "x86_64" ]; then SDK_ARCH="x86_64"; else SDK_ARCH="aarch64"; fi && \
    SDK_URL="https://github.com/swiftwasm/swift/releases/download/swift-wasm-6.0.3-RELEASE/swift-wasm-6.0.3-RELEASE-linux-${SDK_ARCH}.tar.gz" && \
    curl -L "$SDK_URL" -o sdk.tar.gz && \
    CHECKSUM=$(swift package compute-checksum sdk.tar.gz) && \
    swift sdk install sdk.tar.gz --checksum "$CHECKSUM" && \
    rm sdk.tar.gz

WORKDIR /app

# Copy project files
COPY . .

# Build the project
# We build the compiler first (native Linux binary to use for further steps if needed)
RUN swift build

# Build the WASM engine
RUN mkdir -p dist && \
    swift build --product blitz3d-engine --swift-sdk 6.0.3-RELEASE-wasm32-unknown-wasi --triple wasm32-unknown-wasip1 -Xlinker --export-all -Xlinker --no-entry -Xswiftc -enable-experimental-feature -Xswiftc Extern -c release && \
    cp .build/wasm32-unknown-wasip1/release/blitz3d-engine.wasm dist/engine.wasm

CMD ["/bin/bash"]
