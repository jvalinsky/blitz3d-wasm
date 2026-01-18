// swift-tools-version:6.0
import PackageDescription

let package = Package(
    name: "Blitz3DCompiler",
//    platforms: [
//        .macOS(.v14)
//    ],
    products: [
        .executable(
            name: "blitz3d-wasm",
            targets: ["blitz3d-wasm"]
        ),
        .library(
            name: "Blitz3DCompiler",
            targets: ["Blitz3DCompiler"]
        )
    ],
    targets: [
        .executableTarget(
            name: "blitz3d-wasm",
            dependencies: ["Blitz3DCompiler"],
            path: "Tools/wasm-cli"
        ),
        .target(
            name: "Blitz3DCompiler",
            dependencies: [],
            path: "Sources/Compiler"
        ),
        .testTarget(
            name: "CompilerTests",
            dependencies: ["Blitz3DCompiler"],
            path: "Tests/CompilerTests"
        )
    ]
)
