// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "Blitz3DCompilerWASM",
    platforms: [
        .macOS(.v13)
    ],
    products: [
        .executable(
            name: "blitz3d-compiler",
            targets: ["CompilerWASM"]
        )
    ],
    targets: [
        .executableTarget(
            name: "CompilerWASM",
            dependencies: ["Blitz3DCompiler"],
            path: ".",
            exclude: ["Package.swift", ".build", "Sources/"],
            swiftSettings: [
                .enableExperimentalFeature("Extern")
            ],
            linkerSettings: [
                .unsafeFlags(["-Xlinker", "--export=malloc", "-Xlinker", "--export=free", "-Xlinker", "--export=compile_blitz3d"])
            ]
        ),
        .target(
            name: "Blitz3DCompiler",
            path: "Sources/Compiler",
            exclude: ["AGENTs.md", "REFACTORING_PLAN.md", "PLACEHOLDER.md"]
        )
    ]
)
