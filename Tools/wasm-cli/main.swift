//
//  main.swift
//  blitz3d-wasm
//
//  CLI tool for compiling Blitz3D BASIC to WebAssembly
//

import Blitz3DCompiler
import Foundation

func printUsage() {
    print("Blitz3D WASM Compiler")
    print("Usage: blitz3d-wasm [options] <input.bb|project.json> [-o <output.wasm>]")
    print("")
    print("Options:")
    print("  -o, --output <file>     Output WASM file (default: input.wasm)")
    print("  -h, --help              Show this help")
    print("  -t, --tokens            Show tokens only (debug)")
    print("  -w, --wat               Output WebAssembly text format (.wat)")
    print("  -a, --assets <dir>      Include assets from directory")
    print("  -I, --input-dir <dir>   Input directory for multi-file projects")
    print("  -p, --project <file>    Project file (JSON) specifying sources and assets")
    print("  --embed-assets          Embed assets into WASM data sections")
    print("  --manifest              Generate asset manifest JSON")
    print("")
    print("Examples:")
    print("  blitz3d-wasm game.bb -o game.wasm")
    print("  blitz3d-wasm project.json -o game.wasm --assets ./assets")
    print("  blitz3d-wasm game.bb --embed-assets --manifest")
}

struct ProjectConfig: Codable {
    let entry: String
    let sources: [String]?
    let assets: [String]?
    let output: String?
}

struct ParsedProject {
    let entry: String
    let sources: [String]
    let assets: [String]
}

func parseProjectFile(at path: String) throws -> ParsedProject {
    let jsonData = try Data(contentsOf: URL(fileURLWithPath: path))
    let config = try JSONDecoder().decode(ProjectConfig.self, from: jsonData)
    
    let projectDir = (path as NSString).deletingLastPathComponent
    
    var sources: [String] = []
    if let sourceList = config.sources {
        sources = sourceList.map { (projectDir as NSString).appendingPathComponent($0) }
    } else if !config.entry.isEmpty {
        sources = [(projectDir as NSString).appendingPathComponent(config.entry)]
    }
    
    var assets: [String] = []
    if let assetList = config.assets {
        assets = assetList.map { (projectDir as NSString).appendingPathComponent($0) }
    }
    
    return ParsedProject(entry: config.entry, sources: sources, assets: assets)
}

func collectAllSourceFiles(from sources: [String], in inputDir: String) throws -> [String] {
    var allFiles: [String] = []
    var processedIncludes: Set<String> = []
    
    for sourcePath in sources {
        let fullPath = (inputDir as NSString).appendingPathComponent(sourcePath)
        try collectIncludes(from: fullPath, to: &allFiles, processed: &processedIncludes, rootDir: inputDir)
    }
    
    return allFiles
}

func collectIncludes(from file: String, to files: inout [String], processed: inout Set<String>, rootDir: String) throws {
        let url = URL(fileURLWithPath: file)
        let canonicalPath = url.standardizedFileURL.path
        guard !processed.contains(canonicalPath) else { return }
        processed.insert(canonicalPath)
        
        if !files.contains(canonicalPath) {
            files.append(canonicalPath)
        }
        
        let content = try String(contentsOf: url, encoding: .utf8)
        let lines = content.components(separatedBy: .newlines)
        
        for line in lines {
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            if trimmed.lowercased().hasPrefix("include ") {
                let parts = trimmed.split(separator: "\"", maxSplits: 2)
                if parts.count >= 2 {
                    let includePath = String(parts[1])
                    let fullIncludePath = (rootDir as NSString).appendingPathComponent(includePath)
                    try collectIncludes(from: fullIncludePath, to: &files, processed: &processed, rootDir: rootDir)
                }
            }
        }
    }

func collectAssets(from directories: [String]) -> [(path: String, data: Data, type: String)] {
    var assets: [(path: String, data: Data, type: String)] = []
    
    for dir in directories {
        guard let enumerator = FileManager.default.enumerator(at: URL(fileURLWithPath: dir), includingPropertiesForKeys: nil) else {
            continue
        }
        
        while let fileURL = enumerator.nextObject() as? URL {
            let relativePath = fileURL.path.replacingOccurrences(of: dir + "/", with: "")
            if !fileURL.hasDirectoryPath {
                if let data = try? Data(contentsOf: fileURL) {
                    let ext = fileURL.pathExtension.lowercased()
                    var type = "binary"
                    if ext == "png" || ext == "jpg" || ext == "jpeg" { type = "image" }
                    else if ext == "wav" || ext == "mp3" || ext == "ogg" { type = "audio" }
                    else if ext == "json" || ext == "txt" { type = "text" }
                    
                    assets.append((path: relativePath, data: data, type: type))
                }
            }
        }
    }
    
    return assets
}

func embedAssetsIntoModule(_ module: inout WASMModule, assets: [(path: String, data: Data, type: String)], startingAt offset: Int) -> [(path: String, offset: Int, size: Int)] {
    var manifest: [(path: String, offset: Int, size: Int)] = []
    var currentOffset = offset
    
    for asset in assets {
        let assetOffset = currentOffset
        let bytes = [UInt8](asset.data)
        
        // Create data segment for asset
        let dataSegment = WASMData(
            memoryIndex: 0,
            offset: .i32Const(Int32(assetOffset)),
            bytes: bytes
        )
        module.data.append(dataSegment)
        
        manifest.append((path: asset.path, offset: assetOffset, size: asset.data.count))
        currentOffset += asset.data.count
    }
    
    return manifest
}

func generateManifestJSON(assets: [(path: String, offset: Int, size: Int)], embedAssets: Bool) -> String {
    var manifest: [String: Any] = [:]
    var assetList: [[String: Any]] = []
    
    for asset in assets {
        var entry: [String: Any] = [
            "path": asset.path,
            "size": asset.size
        ]
        if embedAssets {
            entry["offset"] = asset.offset
        }
        assetList.append(entry)
    }
    
    manifest["version"] = "1.0"
    manifest["embedAssets"] = embedAssets
    manifest["assets"] = assetList
    
    do {
        let data = try JSONSerialization.data(withJSONObject: manifest, options: .prettyPrinted)
        return String(data: data, encoding: .utf8) ?? "{}"
    } catch {
        return "{}"
    }
}

func tokenizeAndPrint(source: String, sourceFile: String) {
    var lexer = Lexer(source: source, sourceFile: sourceFile)
    let tokens = lexer.tokenize()
    
    for token in tokens {
        if token.type == .endOfFile {
            break
        }
        print(token)
    }
}

func compileFile(inputPath: String, outputPath: String, outputWat: Bool = false, assets: [(path: String, data: Data, type: String)] = [], embedAssets: Bool = false, generateManifest: Bool = false) {
    do {
        print("Compiling: \(inputPath)")
        print("Output: \(outputPath)")
        
        if !assets.isEmpty {
            print("Assets: \(assets.count) files")
            for asset in assets {
                print("  - \(asset.path) (\(asset.data.count) bytes)")
            }
        }
        print("")
        
        // Preprocess
        var preprocessor = Preprocessor()
        let source = try preprocessor.process(file: inputPath)
        print("Preprocessed source size: \(source.count) characters")
        
        // Parse
        var parser = Parser(source: source, sourceFile: inputPath)
        let program = parser.parse()
        
        print("Parsed program:")
        print("  - \(program.statements.count) top-level statements")
        print("  - \(program.functions.count) functions")
        
        var totalStatements = program.statements.count
        for fn in program.functions {
            totalStatements += fn.body.count
        }
        print("  - \(totalStatements) total statements (including functions)")
        
        print("  - \(program.types.count) type declarations")
        print("")
        
        // Generate WASM
        var codeGen = CodeGenerator()
        let mutatableModule = codeGen.generate(from: program)
        var module = mutatableModule
        
        // Embed assets if requested
        var assetManifest: [(path: String, offset: Int, size: Int)] = []
        if embedAssets && !assets.isEmpty {
            // Reserve space for assets after data section (start at 256 + data size)
            let dataOffset = 256 + module.data.reduce(0) { $0 + $1.bytes.count }
            assetManifest = embedAssetsIntoModule(&module, assets: assets, startingAt: dataOffset)
        }
        
        print("Generated WASM module:")
        print("  - \(module.types.count) function types")
        print("  - \(module.functions.count) functions")
        print("  - \(module.memories.count) memory pages")
        print("  - \(module.globals.count) globals")
        print("  - \(module.exports.count) exports")
        print("  - \(module.code.count) function bodies")
        print("  - \(module.data.count) data segments")
        print("")
        
        if outputWat {
            // Generate WAT (text format)
            var writer = WASMTextWriter()
            let watOutput = writer.write(module)
            
            let watPath = outputPath.replacingOccurrences(of: ".wasm", with: ".wat")
            try watOutput.write(toFile: watPath, atomically: true, encoding: .utf8)
            print("Wrote WAT file: \(watPath)")
            print("")
        }
        
        // Generate WASM (binary format)
        var encoder = WASMBinaryEncoder()
        let wasmBytes = encoder.encode(module)
        
        try Data(wasmBytes).write(to: URL(fileURLWithPath: outputPath))
        print("Wrote WASM file: \(outputPath) (\(wasmBytes.count) bytes)")
        
        // Generate manifest if requested
        if generateManifest {
            let manifestPath = outputPath.replacingOccurrences(of: ".wasm", with: "_manifest.json")
            let manifestJSON = generateManifestJSON(assets: assetManifest, embedAssets: embedAssets)
            try manifestJSON.write(toFile: manifestPath, atomically: true, encoding: .utf8)
            print("Wrote manifest: \(manifestPath)")
        }
        
    } catch {
        print("Error: \(error)")
        exit(1)
    }
}

func main() {
    let args = CommandLine.arguments
    
    guard args.count >= 2 else {
        printUsage()
        exit(0)
    }
    
    var inputPath: String?
    var outputPath: String?
    var showTokens = false
    var outputWat = false
    var assetsDir: String?
    var inputDir: String = ""
    var embedAssets = false
    var generateManifest = false
    
    var i = 1
    while i < args.count {
        let arg = args[i]
        
        switch arg {
        case "-h", "--help":
            printUsage()
            exit(0)
            
        case "-t", "--tokens":
            showTokens = true
            i += 1
            
        case "-w", "--wat":
            outputWat = true
            i += 1
            
        case "-a", "--assets":
            i += 1
            if i < args.count {
                assetsDir = args[i]
            } else {
                print("Error: -a/--assets requires a directory path")
                exit(1)
            }
            i += 1
            
        case "-I", "--input-dir":
            i += 1
            if i < args.count {
                inputDir = args[i]
            } else {
                print("Error: -I/--input-dir requires a directory path")
                exit(1)
            }
            i += 1
            
        case "--embed-assets":
            embedAssets = true
            i += 1
            
        case "--manifest":
            generateManifest = true
            i += 1
            
        case "-o", "--output":
            i += 1
            if i < args.count {
                outputPath = args[i]
            } else {
                print("Error: -o requires a filename")
                exit(1)
            }
            i += 1
            
        default:
            if inputPath == nil {
                inputPath = arg
            } else {
                print("Error: Unexpected argument: \(arg)")
                exit(1)
            }
            i += 1
        }
    }
    
    guard let input = inputPath else {
        print("Error: No input file specified")
        exit(1)
    }
    
    // Check if input is a project file
    if input.hasSuffix(".json") {
        do {
            let projectConfig = try parseProjectFile(at: input)
            
            let projectDir = URL(fileURLWithPath: input).deletingLastPathComponent()
            let entryURL = projectDir.appendingPathComponent(projectConfig.entry)
            var finalOutputURL: URL
            if let outPath = outputPath {
                finalOutputURL = URL(fileURLWithPath: outPath)
            } else {
                finalOutputURL = entryURL.deletingPathExtension().appendingPathExtension("wasm")
            }
            
            var assets: [(path: String, data: Data, type: String)] = []
            if let assetsDirectory = assetsDir {
                assets = collectAssets(from: [assetsDirectory])
            } else if !projectConfig.assets.isEmpty {
                assets = collectAssets(from: projectConfig.assets)
            }
            
            compileFile(inputPath: entryURL.path, outputPath: finalOutputURL.path, outputWat: outputWat, assets: assets, embedAssets: embedAssets, generateManifest: generateManifest)
            exit(0)
        } catch {
            print("Error parsing project file: \(error)")
            exit(1)
        }
    }
    
    do {
        // Handle single file
        let inputURL = URL(fileURLWithPath: input)
        let inputDirURL = inputDir.isEmpty ? inputURL.deletingLastPathComponent() : URL(fileURLWithPath: inputDir)
        let finalInputURL = inputDirURL.appendingPathComponent(inputURL.lastPathComponent)
        var finalOutputURL: URL
        if let outPath = outputPath {
            finalOutputURL = URL(fileURLWithPath: outPath)
        } else {
            finalOutputURL = finalInputURL.deletingPathExtension().appendingPathExtension("wasm")
        }
        
        var assets: [(path: String, data: Data, type: String)] = []
        if let assetsDirectory = assetsDir {
            assets = collectAssets(from: [assetsDirectory])
        }
        
        let source = try String(contentsOf: finalInputURL, encoding: .utf8)
        
        if showTokens {
            tokenizeAndPrint(source: source, sourceFile: finalInputURL.path)
        } else {
            compileFile(inputPath: finalInputURL.path, outputPath: finalOutputURL.path, outputWat: outputWat, assets: assets, embedAssets: embedAssets, generateManifest: generateManifest)
        }
        
    } catch {
        print("Error: \(error)")
        exit(1)
    }
}

main()
