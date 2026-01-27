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
            path: "Tools/wasm-cli",
            exclude: ["AGENTs.md"],
            linkerSettings: [
                .unsafeFlags(["-Xlinker", "-stack_size", "-Xlinker", "0x10000000"])  // 256MB stack for deep recursion
            ]
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
                "Utils/AGENTs.md"
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
                "Preprocessor/AGENTs.md"
            ]
        ),
        .testTarget(
            name: "CompilerTests",
            dependencies: ["Blitz3DCompiler"],
            path: "Tests/CompilerTests",
            exclude: ["AGENTs.md"]
        )
    ]
)
