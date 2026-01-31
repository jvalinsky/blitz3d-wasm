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
        .executable(
            name: "blitz3d-compiler-wasm",
            targets: ["blitz3d-compiler-wasm"]
        ),
        .library(
            name: "blitz3d-engine",
            targets: ["Blitz3DEngineWASM"]
        ),
        .library(
            name: "Blitz3DCompiler",
            targets: ["Blitz3DCompiler"]
        ),
    ],
    targets: [
        .executableTarget(
            name: "blitz3d-wasm",
            dependencies: ["Blitz3DCompiler"],
            path: "Tools/wasm-cli",
            exclude: ["AGENTs.md"]
            // Note: -stack_size linker flag only works on macOS
        ),
        .executableTarget(
            name: "blitz3d-compiler-wasm",
            dependencies: ["Blitz3DCompiler"],
            path: "Tools/compiler-wasm"
        ),
        .target(
            name: "Blitz3DEngineWASM",
            dependencies: [
                "Blitz3DEngine"
            ],
            path: "Tools/engine-wasm",
            exclude: []
        ),
        .target(
            name: "Blitz3DEngine",
            dependencies: [],
            path: "Sources/Blitz3DEngine",
            exclude: [
                "AGENTs.md",
                "Banks/AGENTs.md",
                "Graphics/AGENTs.md",
                "Parsers/AGENTs.md",
                "Physics/AGENTs.md",
                "Utils/AGENTs.md",
                "SceneGraph/AGENTs.md",  // Future proofing
                "Renderer/AGENTs.md",  // Future proofing
            ]
        ),
        .target(
            name: "Blitz3DCompiler",
            dependencies: [],
            path: "Sources/Compiler",
            exclude: [
                "CodeGen/REFACTORING_PLAN.md",
                "IR/PLACEHOLDER.md",
                "AGENTs.md",
                "AST/AGENTs.md",
                "CodeGen/AGENTs.md",
                "IR/AGENTs.md",
                "Lexer/AGENTs.md",
                "Lowering/AGENTs.md",
                "Parser/AGENTs.md",
                "Preprocessor/AGENTs.md",
            ]
        ),
        .testTarget(
            name: "CompilerTests",
            dependencies: ["Blitz3DCompiler"],
            path: "Tests/CompilerTests",
            exclude: ["AGENTs.md"]
        ),
        .executableTarget(
            name: "WasmTest",
            path: "Sources/WasmTest"
        ),
        .testTarget(
            name: "Blitz3DEngineTests",
            dependencies: ["Blitz3DEngine"],
            path: "Tests/Blitz3DEngineTests",
            exclude: []
        ),
    ]
)
