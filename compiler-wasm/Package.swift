// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "Blitz3DCompilerWASM",
    platforms: [
        .macOS(.v13),
        .custom("wasi", versionString: "0.1")
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
            exclude: ["Package.swift"],
            swiftSettings: [
                .enableExperimentalFeature("Embedded")
            ]
        ),
        .target(
            name: "Blitz3DCompiler",
            path: "../Sources/Compiler"
        )
    ]
)
