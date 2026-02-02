// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "Blitz3D-Interpreter",
    platforms: [.macOS(.v14)],
    products: [
        .executable(name: "interpreter", targets: ["Interpreter"])
    ],
    dependencies: [
        .package(url: "https://github.com/swiftwasm/JavaScriptKit.git", from: "0.19.0")
    ],
    targets: [
        .executableTarget(
            name: "Interpreter",
            dependencies: [
                .product(name: "JavaScriptKit", package: "JavaScriptKit"),
                .product(name: "JavaScriptEventLoop", package: "JavaScriptKit"),
            ],
            path: "src"
        )
    ]
)
