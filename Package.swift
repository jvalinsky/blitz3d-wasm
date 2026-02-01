// swift-tools-version:6.0
// WASM-only Package.swift - ONLY the engine, no compiler
import PackageDescription

let package = Package(
    name: "Blitz3DEngine",
    products: [
        // WASM executable that exports engine functions
        .executable(
            name: "blitz3d-engine",
            targets: ["Blitz3DEngineWASM"]
        ),
    ],
    dependencies: [
        // Use 0.19.2 - last version before BridgeJS plugin was added
        // BridgeJS requires SwiftSyntax which can't compile for WASM
        .package(url: "https://github.com/swiftwasm/JavaScriptKit.git", exact: "0.19.2")
    ],
    targets: [
        .executableTarget(
            name: "Blitz3DEngineWASM",
            dependencies: [
                "Blitz3DEngine"
            ],
            path: "Tools/engine-wasm",
            exclude: [],
            linkerSettings: [
                // Export all symbols so WASM exports are accessible from JavaScript
                // Increase initial memory to 64MB to handle Swift Dictionary allocations
                .unsafeFlags([
                    "-Xlinker", "--export-all",
                    "-Xlinker", "--initial-memory=67108864",  // 64MB
                    "-Xlinker", "--max-memory=134217728"      // 128MB max
                ], .when(platforms: [.wasi]))
            ]
        ),
        .target(
            name: "Blitz3DEngine",
            dependencies: [
                .product(name: "JavaScriptKit", package: "JavaScriptKit", condition: .when(platforms: [.wasi, .linux]))
            ],
            path: "Sources/Blitz3DEngine",
            exclude: [
                "AGENTs.md",
                "Banks/AGENTs.md",
                "Graphics/AGENTs.md",
                "Parsers/AGENTs.md",
                "Physics/AGENTs.md",
                "Utils/AGENTs.md",
                "SceneGraph/AGENTs.md",
                "Renderer/AGENTs.md",
            ],
            swiftSettings: [
                .enableExperimentalFeature("Extern")
            ]
        ),
    ]
)
