// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "Blitz3DCompilerWASM",
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
                .unsafeFlags(
                    ["-Xlinker", "--export=malloc", "-Xlinker", "--export=free", "-Xlinker", "--export=compile_blitz3d"],
                    .when(platforms: [.wasi])
                )
            ]
        ),
        .target(
            name: "Blitz3DCompiler",
            path: "Sources/Compiler",
            exclude: [
                "AGENTs.md",
                "AST/AGENTs.md",
                "CodeGen/AGENTs.md",
                "CodeGen/REFACTORING_PLAN.md",
                "IR/AGENTs.md",
                "IR/PLACEHOLDER.md",
                "Lexer/AGENTs.md",
                "Lowering/AGENTs.md",
                "Parser/AGENTs.md",
                "Preprocessor/AGENTs.md",
            ]
        )
    ]
)
