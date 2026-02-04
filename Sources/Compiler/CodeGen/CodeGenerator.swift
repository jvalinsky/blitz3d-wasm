//
//  CodeGenerator.swift
//  Blitz3DCompiler
//
//  Generates WebAssembly from AST using modular architecture
//

public struct CodeGenerator {
    private var context: ModuleContext

    public struct ProgressEvent: Sendable {
        public let phase: String
        public let current: Int
        public let total: Int
        public let name: String
    }

    // Optional progress hook for long compiles (used by the CLI for progress bars).
    public var progressHandler: ((ProgressEvent) -> Void)? = nil

    // Module instances
    private var expressionGenerator: ExpressionGeneration
    private var statementGenerator: StatementGeneration
    private var functionGenerator: FunctionGeneration
    private var dataGenerator: DataGeneration

    // Stack optimization (Koopman's algorithm)
    private var stackScheduler: StackScheduler
    private var enableStackOptimization: Bool = false  // Toggle for debugging

    // Track B: Command buffer ABI (WASM-first runtime)
    private var enableCommandBufferABI: Bool = false
    private let cmdBufAbiVersion: Int32 = 1

    // Internal state for things not yet moved to context/modules
    private var typeCollectionGlobal: Int = -1
    private var scratchGlobal: Int = -1
    private var scratchGlobal2: Int = -1

    public init() {
        let module = WASMModule()
        self.context = ModuleContext(module: module)
        self.expressionGenerator = ExpressionGeneration(context: context)
        self.statementGenerator = StatementGeneration(context: context)
        self.functionGenerator = FunctionGeneration(context: context)
        self.dataGenerator = DataGeneration(context: context)
        self.stackScheduler = StackScheduler()

        self.statementGenerator.configure(expressionGenerator: expressionGenerator, dataGenerator: dataGenerator)
        self.functionGenerator.configure(statementGenerator: statementGenerator)
    }

    public var diagnostics: [CompilerDiagnostic] {
        context.diagnostics
    }

    public var hasDiagnostics: Bool {
        !context.diagnostics.isEmpty
    }
    
    public mutating func enableAutoImports(_ names: Set<String>, arities: [String: Int] = [:]) {
        context.autoImportNames = names
        context.autoImportArities = arities
        expressionGenerator.updateContext(context)
        statementGenerator.updateContext(context)
        functionGenerator.updateContext(context)
    }

    public mutating func enableCommandBuffer() {
        enableCommandBufferABI = true
        context.enableCommandBufferABI = true
        expressionGenerator.updateContext(context)
        statementGenerator.updateContext(context)
        functionGenerator.updateContext(context)
    }

    /// Pre-register an auto-import with a fixed signature so later calls can pad to it.
    /// Deprecated: prefer arity-based registration at first call site to avoid clobbering user-defined functions.
    public mutating func preRegisterAutoImport(name: String, params: [WASMType], results: [WASMType]) {
        _ = context.registerAutoImport(name: name, params: params, results: results)
        expressionGenerator.updateContext(context)
        statementGenerator.updateContext(context)
        functionGenerator.updateContext(context)
    }
    
    public mutating func enableSourceMapping(_ generator: SourceMapGenerator) {
        context.sourceMapGenerator = generator
        // Disable optimization to preserve source mapping structure and order
        enableStackOptimization = false
    }
    
    public mutating func enableDebugging(_ generator: DebugGenerator) {
        context.debugGenerator = generator
        // Disable optimization for debugging accuracy
        enableStackOptimization = false
    }
    
    public mutating func generate(from program: ProgramNode) -> WASMModule {
        context.module.memories = [WASMMemory(initial: 256, maximum: 512)]

        // Export memory so JavaScript can access strings
        context.module.exports.append(WASMExport(name: "memory", kind: .memory, index: 0))

        dataGenerator.setup()

        // Avoid registering imports that collide with user-defined functions.
        // Imports are required at instantiation time even if later shadowed by a local definition.
        let userFunctionNames = Set(program.functions.map { $0.name.lowercased() })
        addImports(excluding: userFunctionNames)

        // IMPORTANT: finalize any auto-imported stubs before we assign/emit any local function indices.
        // Adding imports later would shift all local function indices and invalidate previously emitted calls.
        // NOTE: Do not pre-register auto-imports in the Typed IR pipeline.
        // Auto-imports must be registered with typed call-site signatures during lowering,
        // otherwise we pollute the module with incorrect (all-i32) import types and fail wasm-validate.
        
        processTypeDeclarations(program.types)
        setupUserTypeGlobals(program.types)
        processConstantDeclarations(program.statements, functions: program.functions)
        processGlobalDeclarations(program.statements)

        // String/heap allocators are used by expression generation (e.g. string concatenation),
        // so they must be registered before we emit any function bodies.
        addAllocFunction()
        
        let topLevelStatements = extractTopLevelStatements(program.statements)

        // Pre-pass: Register all function signatures and indices
        registerFunctionSignatures(program.functions, hasMain: !topLevelStatements.isEmpty)
        
        dataGenerator.collectDataStatements(program.statements)
        for function in program.functions {
            dataGenerator.collectDataStatements(function.body)
        }
        dataGenerator.serializeDataSection()

        let totalUserFunctions = program.functions.count + (topLevelStatements.isEmpty ? 0 : 1)
        var userFunctionProgress = 0

        if !topLevelStatements.isEmpty {
            userFunctionProgress += 1
            progressHandler?(.init(phase: "function", current: userFunctionProgress, total: totalUserFunctions, name: "_main"))
        }
        generateMainFunction(topLevelStatements)
        
        // Export only user-defined functions.
        // Do NOT export imports: export names must be unique across kinds, and SCPCB frequently uses
        // global variable names that collide with built-in runtime imports (e.g. `ParticlePiv`).
        context.userFunctionIndices.sorted(by: { $0.key < $1.key }).forEach { lowerName, idx in
            var exportName = context.functionOriginalNames[lowerName] ?? lowerName
            
            // Reconstruct function name with type suffix if it was explicit in source
            if let originalReturnType = context.functionExplicitSuffixes[lowerName] {
                // Add type suffix based on original TypeAnnotation
                if let returnType = originalReturnType {
                    switch returnType {
                    case .integer:
                        exportName += "%"
                    case .float:
                        exportName += "#"
                    case .string:
                        exportName += "$"
                    case .void:
                        break  // No suffix for void
                    }
                }
            }
            
            // Filter out internal functions only (_main is internal entry point alias, __alloc/__stringalloc/__stringconcat are internal allocators)
            if lowerName != "_main" && lowerName != "__alloc" && lowerName != "__stringalloc" && lowerName != "__stringconcat" {
                context.module.exports.append(WASMExport(name: exportName, kind: .function, index: idx))
            }
        }
        
        for functionNode in program.functions {
            userFunctionProgress += 1
            progressHandler?(.init(phase: "function", current: userFunctionProgress, total: totalUserFunctions, name: functionNode.name))
            generateFunction(functionNode)
        }

        // Post-processing: Apply Koopman stack scheduling optimization
        if enableStackOptimization {
            applyStackOptimizations()
        }

        return context.module
    }

    private mutating func preRegisterAutoImportsIfNeeded() {
        guard !context.autoImportNames.isEmpty, !context.autoImportArities.isEmpty else { return }

        // Deterministic ordering keeps import indices stable across builds.
        for (name, arity) in context.autoImportArities.sorted(by: { $0.key < $1.key }) {
            let lower = name.lowercased()
            if context.functionIndexMap[lower] != nil { continue } // already known (built-in import or pre-registered)

            let targetArity = max(0, arity)
            let params = Array(repeating: WASMType.i32, count: targetArity)
            _ = context.registerAutoImport(name: lower, params: params, results: [.i32])
        }
    }

    /// Apply Koopman-style stack scheduling optimization to all function bodies
    private mutating func applyStackOptimizations() {
        var totalOptimized = 0

        for i in 0..<context.module.code.count {
            let originalBody = context.module.code[i].body
            let optimizedBody = stackScheduler.optimizeFunction(originalBody)

            if optimizedBody.count != originalBody.count {
                totalOptimized += 1
            }

            context.module.code[i].body = optimizedBody
        }

        if totalOptimized > 0 {
            CompilerLogger.debug("DEBUG_SCHEDULER: Optimized \(totalOptimized) function(s) with stack scheduling")
        }
    }
    
    private mutating func addImports(excluding excludedInternalNames: Set<String>) {
        var imports: [(String, String, [WASMType], [WASMType], String)] = [
            ("PrintInt", "printint", [.i32], [], "env"),
            ("PrintFloat", "printfloat", [.f32], [], "env"),
            ("PrintString", "printstring", [.i32], [], "env"),
            ("Graphics3D", "Graphics3D", [.i32, .i32, .i32, .i32], [], "env"),
            ("Cls", "Cls", [], [], "env"),
            ("Flip", "Flip", [], [], "env"),
            ("ClsColor", "ClsColor", [.i32, .i32, .i32], [], "env"),
            ("Color", "Color", [.i32, .i32, .i32], [], "env"),
            ("GetColor", "GetColor", [.i32, .i32], [], "env"),
            ("Rect", "Rect", [.i32, .i32, .i32, .i32, .i32], [], "env"),
            ("Oval", "Oval", [.i32, .i32, .i32, .i32, .i32], [], "env"),
            ("Line", "Line", [.i32, .i32, .i32, .i32], [], "env"),
            ("Text", "Text", [.i32, .i32, .i32, .i32, .i32], [], "env"),
            
            // Font Functions
            ("LoadFont", "LoadFont", [.i32, .i32, .i32, .i32, .i32], [.i32], "env"),
            ("SetFont", "SetFont", [.i32], [], "env"),
            ("FreeFont", "FreeFont", [.i32], [], "env"),
            
            ("LoadImage", "LoadImage", [.i32], [.i32], "env"),
            ("CreateImage", "CreateImage", [.i32, .i32, .i32], [.i32], "env"),
            ("DrawImage", "DrawImage", [.i32, .i32, .i32, .i32], [], "env"),
            ("DrawImageRect", "DrawImageRect", [.i32, .i32, .i32, .i32, .i32, .i32, .i32, .i32], [], "env"),
            ("DrawBlock", "DrawBlock", [.i32, .i32, .i32, .i32], [], "env"),
            ("TileImage", "TileImage", [.i32, .i32, .i32, .i32], [], "env"),
            ("ImageWidth", "ImageWidth", [.i32], [.i32], "env"),
            ("ImageHeight", "ImageHeight", [.i32], [.i32], "env"),
            ("HandleImage", "HandleImage", [.i32, .i32, .i32], [], "env"),
            ("MidHandle", "MidHandle", [.i32], [], "env"),
            ("AutoMidHandle", "AutoMidHandle", [.i32], [], "env"),
            ("MaskImage", "MaskImage", [.i32, .i32, .i32, .i32], [], "env"),
            ("ScaleImage", "ScaleImage", [.i32, .f32, .f32], [], "env"),
            ("ResizeImage", "ResizeImage", [.i32, .i32, .i32], [], "env"),
            ("RotateImage", "RotateImage", [.i32, .f32], [], "env"),
            ("FreeImage", "FreeImage", [.i32], [], "env"),
            
            // Buffer Functions
            ("LockBuffer", "LockBuffer", [.i32], [], "env"),
            ("UnlockBuffer", "UnlockBuffer", [.i32], [], "env"),
            ("SetBuffer", "SetBuffer", [.i32], [], "env"),
            ("BackBuffer", "BackBuffer", [], [.i32], "env"),
            ("FrontBuffer", "FrontBuffer", [], [.i32], "env"),
            ("ImageBuffer", "ImageBuffer", [.i32, .i32], [.i32], "env"),
            ("TextureBuffer", "TextureBuffer", [.i32, .i32], [.i32], "env"),
            ("WritePixelFast", "WritePixelFast", [.i32, .i32, .i32, .i32], [], "env"),
            ("ReadPixelFast", "ReadPixelFast", [.i32, .i32, .i32], [.i32], "env"),
            ("KeyDown", "KeyDown", [.i32], [.i32], "env"),
            ("KeyHit", "KeyHit", [.i32], [.i32], "env"),
            ("PlaySound", "PlaySound", [.i32], [.i32], "env"),
            ("FreeSound", "FreeSound", [.i32], [], "env"),
            ("LoadSound", "LoadSound", [.i32], [.i32], "env"),
            ("StopChannel", "StopChannel", [.i32], [], "env"),
            ("ChannelVolume", "ChannelVolume", [.i32, .f32], [], "env"),
            ("ChannelPaused", "ChannelPaused", [.i32, .i32], [], "env"),
            ("ChannelPlaying", "ChannelPlaying", [.i32], [.i32], "env"),
            ("ChannelPan", "ChannelPan", [.i32, .f32], [], "env"),
            ("PauseChannel", "PauseChannel", [.i32], [], "env"),
            ("ResumeChannel", "ResumeChannel", [.i32], [], "env"),
            ("FSOUND_Init", "FSOUND_Init", [.i32, .i32, .i32], [.i32], "env"),
            ("FSOUND_Close", "FSOUND_Close", [], [], "env"),
            ("FSOUND_Stream_Open", "FSOUND_Stream_Open", [.i32, .i32, .i32, .i32], [.i32], "env"),
            ("FSOUND_Stream_Play", "FSOUND_Stream_Play", [.i32, .i32], [.i32], "env"),
            ("FSOUND_Stream_Stop", "FSOUND_Stream_Stop", [.i32], [], "env"),
            ("FSOUND_SetVolume", "FSOUND_SetVolume", [.i32, .f32], [], "env"),
            ("FSOUND_SetPaused", "FSOUND_SetPaused", [.i32, .i32], [], "env"),
            ("FSOUND_StopSound", "FSOUND_StopSound", [.i32], [], "env"),
            ("FSOUND_Stream_Close", "FSOUND_Stream_Close", [.i32], [], "env"),
            ("FSOUND_Stream_Stop", "FSOUND_Stream_Stop", [.i32], [], "env"),
            ("FSOUND_IsPlaying", "FSOUND_IsPlaying", [.i32], [.i32], "env"),
            ("FSOUND_SetPan", "FSOUND_SetPan", [.i32, .i32], [], "env"),
            ("Sound3D", "Sound3D", [.i32, .f32, .f32, .f32], [], "env"),
            ("SetListenerLocation", "SetListenerLocation", [.f32, .f32, .f32, .f32, .f32, .f32, .f32, .f32, .f32], [], "env"),
            ("MouseX", "MouseX", [], [.i32], "env"),
            ("MouseY", "MouseY", [], [.i32], "env"),
            ("MouseZ", "MouseZ", [], [.i32], "env"),
            ("MouseDown", "MouseDown", [.i32], [.i32], "env"),
            ("MouseHit", "MouseHit", [.i32], [.i32], "env"),
            ("MouseXSpeed", "MouseXSpeed", [], [.i32], "env"),
            ("MouseYSpeed", "MouseYSpeed", [], [.i32], "env"),
            ("MoveMouse", "MoveMouse", [.i32, .i32], [], "env"),
            ("FlushKeys", "FlushKeys", [], [], "env"),
            ("FlushMouse", "FlushMouse", [], [], "env"),
            ("HidePointer", "HidePointer", [], [], "env"),
            ("ShowPointer", "ShowPointer", [], [], "env"),
            ("MilliCSecs", "MilliCSecs", [], [.i32], "env"),
            ("CreateCamera", "CreateCamera", [.i32], [.i32], "env"),
            ("CreateLight", "CreateLight", [.i32], [.i32], "env"),
            ("AmbientLight", "AmbientLight", [.f32, .f32, .f32], [], "env"),
            ("LightColor", "LightColor", [.i32, .f32, .f32, .f32], [], "env"),
            ("LightRange", "LightRange", [.i32, .f32], [], "env"),
            ("CameraClsColor", "CameraClsColor", [.i32, .f32, .f32, .f32], [], "env"),
            ("CameraRange", "CameraRange", [.i32, .f32, .f32], [], "env"),
            ("CameraZoom", "CameraZoom", [.i32, .f32], [], "env"),
            ("CameraProjMode", "CameraProjMode", [.i32, .i32], [], "env"),
            ("CameraViewport", "CameraViewport", [.i32, .i32, .i32, .i32, .i32], [], "env"),
            ("FogMode", "FogMode", [.i32], [], "env"),
            ("FogColor", "FogColor", [.f32, .f32, .f32], [], "env"),
            ("FogRange", "FogRange", [.f32, .f32], [], "env"),
            ("FogDensity", "FogDensity", [.f32], [], "env"),
            ("CreateCube", "CreateCube", [.i32], [.i32], "env"),
            ("CreateSphere", "CreateSphere", [.i32], [.i32], "env"),
            ("CreatePlane", "CreatePlane", [.i32], [.i32], "env"),
            ("CreateBrush", "CreateBrush", [], [.i32], "env"),
            ("BrushColor", "BrushColor", [.i32, .i32, .i32, .i32], [], "env"),
            ("BrushAlpha", "BrushAlpha", [.i32, .i32], [], "env"),
            ("BrushShininess", "BrushShininess", [.i32, .f32], [], "env"),
            ("BrushTexture", "BrushTexture", [.i32, .i32, .i32, .i32], [], "env"),
            ("BrushFX", "BrushFX", [.i32, .i32], [], "env"),
            ("BrushBlend", "BrushBlend", [.i32, .i32], [], "env"),
            ("FreeBrush", "FreeBrush", [.i32], [], "env"),
            ("PaintEntity", "PaintEntity", [.i32, .i32], [], "env"),
            ("PaintMesh", "PaintMesh", [.i32, .i32], [], "env"),
            ("PaintSurface", "PaintSurface", [.i32, .i32], [], "env"),
            ("TextureWidth", "TextureWidth", [.i32], [.i32], "env"),
            ("TextureHeight", "TextureHeight", [.i32], [.i32], "env"),
            ("FreeTexture", "FreeTexture", [.i32], [], "env"),
            ("TextureBlend", "TextureBlend", [.i32, .i32], [], "env"),
            ("TextureCoords", "TextureCoords", [.i32, .i32], [], "env"),
            ("ScaleTexture", "ScaleTexture", [.i32, .f32, .f32], [], "env"),
            ("PositionTexture", "PositionTexture", [.i32, .f32, .f32], [], "env"),
            ("RotateTexture", "RotateTexture", [.i32, .f32], [], "env"),
            ("PositionEntity", "PositionEntity", [.i32, .f32, .f32, .f32, .i32], [], "env"),
            ("RotateEntity", "RotateEntity", [.i32, .f32, .f32, .f32, .i32], [], "env"),
            ("ScaleEntity", "ScaleEntity", [.i32, .f32, .f32, .f32], [], "env"),
            ("MoveEntity", "MoveEntity", [.i32, .f32, .f32, .f32], [], "env"),
            ("TurnEntity", "TurnEntity", [.i32, .f32, .f32, .f32, .i32], [], "env"),
            ("EntityTexture", "EntityTexture", [.i32, .i32, .i32, .i32], [], "env"),
            
            // Entity Creation & Management
            ("CreatePivot", "CreatePivot", [.i32], [.i32], "env"),
            ("FreeEntity", "FreeEntity", [.i32], [], "env"),
            
            // Entity Property Getters
            ("EntityX", "EntityX", [.i32, .i32], [.f32], "env"),
            ("EntityY", "EntityY", [.i32, .i32], [.f32], "env"),
            ("EntityZ", "EntityZ", [.i32, .i32], [.f32], "env"),
            ("EntityPitch", "EntityPitch", [.i32, .i32], [.f32], "env"),
            ("EntityYaw", "EntityYaw", [.i32, .i32], [.f32], "env"),
            ("EntityRoll", "EntityRoll", [.i32, .i32], [.f32], "env"),
            ("EntityDistance", "EntityDistance", [.i32, .i32], [.f32], "env"),
            
            // Entity Hierarchy
            ("CountChildren", "CountChildren", [.i32], [.i32], "env"),
            ("GetChild", "GetChild", [.i32, .i32], [.i32], "env"),
            ("FindChild", "FindChild", [.i32, .i32], [.i32], "env"),
            ("GetParent", "GetParent", [.i32], [.i32], "env"),
            
            // Sprite Functions
            ("CreateSprite", "CreateSprite", [.i32], [.i32], "env"),
            ("ScaleSprite", "ScaleSprite", [.i32, .f32, .f32], [], "env"),
            ("SpriteViewMode", "SpriteViewMode", [.i32, .i32], [], "env"),
            
            // Entity Functions (extended)
            ("TranslateEntity", "TranslateEntity", [.i32, .f32, .f32, .f32], [], "env"),
            ("EntityAlpha", "EntityAlpha", [.i32, .f32], [], "env"),
            ("EntityColor", "EntityColor", [.i32, .f32, .f32, .f32], [], "env"),
            ("EntityShininess", "EntityShininess", [.i32, .f32], [], "env"),
            ("EntityFX", "EntityFX", [.i32, .i32], [], "env"),
            ("EntityBlend", "EntityBlend", [.i32, .i32], [], "env"),
            ("EntityParent", "EntityParent", [.i32, .i32, .i32], [], "env"),
            ("HideEntity", "HideEntity", [.i32], [], "env"),
            ("ShowEntity", "ShowEntity", [.i32], [], "env"),
            ("EntityVisible", "EntityVisible", [.i32, .i32], [.i32], "env"),
            ("EntityInView", "EntityInView", [.i32, .i32], [.i32], "env"),
            ("EntityPick", "EntityPick", [.i32, .f32], [.i32], "env"),
            ("EntityPickMode", "EntityPickMode", [.i32, .i32, .i32], [], "env"),
            ("EntityCollided", "EntityCollided", [.i32, .i32], [.i32], "env"),
            ("CopyEntity", "CopyEntity", [.i32, .i32], [.i32], "env"),
            ("NameEntity", "NameEntity", [.i32, .i32], [], "env"),
            ("Kill", "Kill", [.i32], [], "env"),
            
            // Picking Functions
            ("LinePick", "LinePick", [.f32, .f32, .f32, .f32, .f32, .f32, .f32], [.i32], "env"),
            ("LoadBrush", "LoadBrush", [.i32, .f32, .f32, .f32, .f32], [.i32], "env"),
            ("PickedX", "PickedX", [], [.f32], "env"),
            ("PickedY", "PickedY", [], [.f32], "env"),
            ("PickedZ", "PickedZ", [], [.f32], "env"),
            
            // Asset Loading (_Strict versions)
            ("LoadMesh_Strict", "LoadMesh_Strict", [.i32], [.i32], "env"),
            ("LoadAnimMesh_Strict", "LoadAnimMesh_Strict", [.i32], [.i32], "env"),
            ("LoadTexture_Strict", "LoadTexture_Strict", [.i32, .i32], [.i32], "env"),
            ("LoadImage_Strict", "LoadImage_Strict", [.i32], [.i32], "env"),
            ("FreeSound_Strict", "FreeSound_Strict", [.i32], [], "env"),
            ("LoadTempSound", "LoadTempSound", [.i32], [.i32], "env"),
            
            // Sound Functions  
            ("LoopSound2", "LoopSound2", [.i32, .i32, .f32, .f32], [.i32], "env"),
            
            // Debug/Utility
            ("DebugLog", "DebugLog", [.i32], [], "env"),
            ("RuntimeError", "RuntimeError", [.i32], [], "env"),
            ("End", "End", [], [], "env"),
            ("CatchErrors", "CatchErrors", [], [], "env"),
            ("MilliSecs2", "MilliSecs2", [], [.i32], "env"),
            ("CurrentDate", "CurrentDate", [], [.i32], "env"),
            
            ("RenderWorld", "RenderWorld", [.f32], [], "env"),
            ("Flip", "Flip", [.i32], [], "env"),
            ("LoadTexture", "LoadTexture", [.i32, .i32], [.i32], "env"),
            ("CreateTexture", "CreateTexture", [.i32, .i32, .i32, .i32], [.i32], "env"),
            ("LoadAsset", "LoadAsset", [.i32], [.i32], "env"),
            ("GetAssetData", "GetAssetData", [.i32], [.i32], "env"),
            ("GetAssetSize", "GetAssetSize", [.i32], [.i32], "env"),
            ("LoadMesh", "LoadMesh", [.i32, .i32], [.i32], "env"),
            ("CreateMesh", "CreateMesh", [.i32], [.i32], "env"),
            ("CreateSurface", "CreateSurface", [.i32, .i32], [.i32], "env"),
            ("AddVertex", "AddVertex", [.i32, .f32, .f32, .f32, .f32, .f32, .f32], [.i32], "env"),
            ("AddTriangle", "AddTriangle", [.i32, .i32, .i32, .i32], [.i32], "env"),
            ("VertexColor", "VertexColor", [.i32, .i32, .f32, .f32, .f32, .f32], [], "env"),
            ("VertexTexCoords", "VertexTexCoords", [.i32, .i32, .f32, .f32, .f32, .i32], [], "env"),
            ("UpdateNormals", "UpdateNormals", [.i32], [], "env"),
            ("CountSurfaces", "CountSurfaces", [.i32], [.i32], "env"),
            ("GetSurface", "GetSurface", [.i32, .i32], [.i32], "env"),
            ("LoadAnimMesh", "LoadAnimMesh", [.i32, .i32], [.i32], "env"),
            ("Animate", "Animate", [.i32, .i32, .f32, .i32, .f32], [], "env"),
            ("SetAnimTime", "SetAnimTime", [.i32, .f32, .i32], [], "env"),
            ("AnimTime", "AnimTime", [.i32], [.f32], "env"),
            ("AnimLength", "AnimLength", [.i32], [.i32], "env"),
            ("ExtractAnimSeq", "ExtractAnimSeq", [.i32, .i32, .i32], [.i32], "env"),
            ("AddAnimSeq", "AddAnimSeq", [.i32, .i32], [.i32], "env"),
            ("AnimSeq", "AnimSeq", [.i32], [.i32], "env"),
            ("Animating", "Animating", [.i32], [.i32], "env"),
            ("Delay", "Delay", [.i32], [], "env"),
            
            // Collision System
            ("Collisions", "Collisions", [.i32, .i32, .i32, .i32], [], "env"),
            ("ClearCollisions", "ClearCollisions", [], [], "env"),
            ("EntityType", "EntityType", [.i32, .i32, .i32], [], "env"),
            ("EntityRadius", "EntityRadius", [.i32, .f32, .f32], [], "env"),
            ("EntityBox", "EntityBox", [.i32, .f32, .f32, .f32, .f32, .f32, .f32], [], "env"),
            ("ResetEntity", "ResetEntity", [.i32], [], "env"),
            ("UpdateWorld", "UpdateWorld", [.f32], [], "env"),
            
            // Collision Queries
            ("CountCollisions", "CountCollisions", [.i32], [.i32], "env"),
            ("CollisionX", "CollisionX", [.i32, .i32], [.f32], "env"),
            ("CollisionY", "CollisionY", [.i32, .i32], [.f32], "env"),
            ("CollisionZ", "CollisionZ", [.i32, .i32], [.f32], "env"),
            ("CollisionNX", "CollisionNX", [.i32, .i32], [.f32], "env"),
            ("CollisionNY", "CollisionNY", [.i32, .i32], [.f32], "env"),
            ("CollisionNZ", "CollisionNZ", [.i32, .i32], [.f32], "env"),
            ("CollisionEntity", "CollisionEntity", [.i32, .i32], [.i32], "env"),
            ("CollisionSurface", "CollisionSurface", [.i32, .i32], [.i32], "env"),
            ("CollisionTriangle", "CollisionTriangle", [.i32, .i32], [.i32], "env"),
            ("CollisionTime", "CollisionTime", [.i32, .i32], [.f32], "env"),
            
            // Custom Math Stubs (for compilation only)
            ("WrapAngle", "WrapAngle", [.f32], [.f32], "env"),
            ("CurveValue", "CurveValue", [.f32, .f32, .f32], [.f32], "env"),
            ("Distance", "Distance", [.f32, .f32, .f32, .f32, .f32, .f32], [.f32], "env"),
            ("Point_Direction", "Point_Direction", [.f32, .f32, .f32, .f32], [.f32], "env"),

            
            // System
            ("DebugLog", "printstring", [.i32], [], "env"),
            ("MilliSecs", "millisecs", [], [.i32], "env"),
            ("Print", "printstring", [.i32], [], "env"),
            ("KeyDown", "keydown", [.i32], [.i32], "env"),
            ("KeyHit", "keyhit", [.i32], [.i32], "env"),
            ("TFormVector", "tformvector", [.f32, .f32, .f32, .i32, .i32], [], "env"),
            ("TFormedX", "tformedx", [], [.f32], "env"),
            ("TFormedY", "tformedy", [], [.f32], "env"),
            ("TFormedZ", "tformedz", [], [.f32], "env"),
            ("ReadFile", "ReadFile", [.i32], [.i32], "env"),
            ("WriteFile", "WriteFile", [.i32], [.i32], "env"),
            ("OpenFile", "OpenFile", [.i32], [.i32], "env"),
            ("CloseFile", "CloseFile", [.i32], [], "env"),
            ("ReadInt", "ReadInt", [.i32], [.i32], "env"),
            ("ReadFloat", "ReadFloat", [.i32], [.f32], "env"),
            ("ReadString", "ReadString", [.i32], [.i32], "env"),
            ("ReadLine", "ReadLine", [.i32], [.i32], "env"),
            ("ReadByte", "ReadByte", [.i32], [.i32], "env"),
            ("Eof", "Eof", [.i32], [.i32], "env"),
            ("FilePos", "FilePos", [.i32], [.i32], "env"),
            ("SeekFile", "SeekFile", [.i32, .i32], [], "env"),
            ("FileSize", "FileSize", [.i32], [.i32], "env"),
            ("FileType", "FileType", [.i32], [.i32], "env"),
            ("ReadShort", "ReadShort", [.i32], [.i32], "env"),
            ("WriteInt", "WriteInt", [.i32, .i32], [], "env"),
            ("WriteFloat", "WriteFloat", [.i32, .f32], [], "env"),
            ("WriteString", "WriteString", [.i32, .i32], [], "env"),
            ("WriteByte", "WriteByte", [.i32, .i32], [], "env"),
            ("WriteShort", "WriteShort", [.i32, .i32], [], "env"),
            ("Eof", "Eof", [.i32], [.i32], "env"),
            ("SeekFile", "SeekFile", [.i32, .i32], [], "env"),
            ("FilePos", "FilePos", [.i32], [.i32], "env"),
            ("FileSize", "FileSize", [.i32], [.i32], "env"),
            ("FileType", "FileType", [.i32], [.i32], "env"),
            ("ReadData", "ReadData", [.i32, .i32, .i32], [.i32], "env"),
            ("RestoreData", "RestoreData", [.i32], [], "env"),
            ("CreateDir", "CreateDir", [.i32], [.i32], "env"),
            ("DeleteDir", "DeleteDir", [.i32], [.i32], "env"),
            ("DeleteFile", "DeleteFile", [.i32], [.i32], "env"),
            ("CopyFile", "CopyFile", [.i32, .i32], [.i32], "env"),
            ("ExecFile", "ExecFile", [.i32], [.i32], "env"),
            
            // System and Window Metrics
            ("AppTitle", "AppTitle", [.i32, .i32], [], "env"),
            ("SystemProperty", "SystemProperty", [.i32], [.i32], "env"),
            ("GraphicsWidth", "GraphicsWidth", [], [.i32], "env"),
            ("GraphicsHeight", "GraphicsHeight", [], [.i32], "env"),
            ("WindowWidth", "WindowWidth", [], [.i32], "env"),
            ("WindowHeight", "WindowHeight", [], [.i32], "env"),
            ("VWait", "VWait", [.i32], [], "env"),
            
            // Networking (TCP) for SCP:CB multiplayer
            ("OpenTCPStream", "OpenTCPStream", [.i32, .i32], [.i32], "env"),
            ("CloseTCPStream", "CloseTCPStream", [.i32], [], "env"),
            ("WriteLine", "WriteLine", [.i32, .i32], [.i32], "env"),
            ("ReadLine", "ReadLine", [.i32], [.i32], "env"),
            ("ReadAvail", "ReadAvail", [.i32], [.i32], "env"),
            ("SendNetMsg", "SendNetMsg", [.i32, .i32, .i32, .i32, .i32], [.i32], "env"),
            
            ("StringConcat", "StringConcat", [.i32, .i32], [.i32], "env"),
            ("IntToString", "IntToString", [.i32], [.i32], "env"),
            ("FloatToString", "FloatToString", [.f32], [.i32], "env"),
            ("CreateBank", "CreateBank", [.i32], [.i32], "blitz3d"),
            ("FreeBank", "FreeBank", [.i32], [], "blitz3d"),
            ("BankSize", "BankSize", [.i32], [.i32], "blitz3d"),
            ("ResizeBank", "ResizeBank", [.i32, .i32], [], "env"),
            ("CopyBank", "CopyBank", [.i32, .i32, .i32, .i32, .i32], [], "env"),
            ("PeekByte", "PeekByte", [.i32, .i32], [.i32], "blitz3d"),
            ("PokeByte", "PokeByte", [.i32, .i32, .i32], [], "blitz3d"),
            ("PeekInt", "PeekInt", [.i32, .i32], [.i32], "blitz3d"),
            ("PokeInt", "PokeInt", [.i32, .i32, .i32], [], "blitz3d"),
            ("PeekFloat", "PeekFloat", [.i32, .i32], [.f32], "blitz3d"),
            ("PokeFloat", "PokeFloat", [.i32, .i32, .f32], [], "blitz3d"),
            ("PeekShort", "PeekShort", [.i32, .i32], [.i32], "blitz3d"),
            ("PokeShort", "PokeShort", [.i32, .i32, .i32], [], "blitz3d"),
            
            // Math Functions
            ("Sin", "Sin", [.f32], [.f32], "blitz3d"),
            ("Cos", "Cos", [.f32], [.f32], "blitz3d"),
            ("Tan", "Tan", [.f32], [.f32], "blitz3d"),
            ("ASin", "ASin", [.f32], [.f32], "blitz3d"),
            ("ACos", "ACos", [.f32], [.f32], "blitz3d"),
            ("ATan", "ATan", [.f32], [.f32], "blitz3d"),
            ("ATan2", "ATan2", [.f32, .f32], [.f32], "blitz3d"),
            ("Sqrt", "Sqrt", [.f32], [.f32], "blitz3d"),
            ("Sqr", "Sqr", [.f32], [.f32], "blitz3d"),
            ("Abs", "Abs", [.f32], [.f32], "blitz3d"),
            ("AbsInt", "AbsInt", [.i32], [.i32], "blitz3d"),
            ("Sgn", "Sgn", [.f32], [.i32], "blitz3d"),
            ("Floor", "Floor", [.f32], [.f32], "blitz3d"),
            ("Ceil", "Ceil", [.f32], [.f32], "blitz3d"),
            ("Exp", "Exp", [.f32], [.f32], "blitz3d"),
            ("Log", "Log", [.f32], [.f32], "blitz3d"),
            ("Log10", "Log10", [.f32], [.f32], "blitz3d"),
            ("Rand", "Rand", [.i32, .i32], [.i32], "blitz3d"),
            ("Rnd", "Rnd", [.f32], [.f32], "blitz3d"),
            ("SeedRnd", "SeedRnd", [.i32], [], "blitz3d"),
            ("Min", "Min", [.f32, .f32], [.f32], "blitz3d"),
            ("MinInt", "MinInt", [.i32, .i32], [.i32], "blitz3d"),
            ("Max", "Max", [.f32, .f32], [.f32], "blitz3d"),
            ("MaxInt", "MaxInt", [.i32, .i32], [.i32], "blitz3d"),
            ("Mod", "Mod", [.i32, .i32], [.i32], "blitz3d"),
            ("ModFloat", "ModFloat", [.f32, .f32], [.f32], "blitz3d"),
            ("Pow", "Pow", [.f32, .f32], [.f32], "blitz3d"),
            ("Int", "Int", [.f32], [.i32], "blitz3d"),
            ("Float", "Float_", [.i32], [.f32], "blitz3d"),
            
            // String Functions
            ("Len", "Len", [.i32], [.i32], "blitz3d"),
            ("Mid", "Mid", [.i32, .i32, .i32], [.i32], "blitz3d"),
            ("Left", "Left", [.i32, .i32], [.i32], "blitz3d"),
            ("Right", "Right", [.i32, .i32], [.i32], "blitz3d"),
            ("Upper", "Upper", [.i32], [.i32], "blitz3d"),
            ("Lower", "Lower", [.i32], [.i32], "blitz3d"),
            ("Trim", "Trim", [.i32], [.i32], "blitz3d"),
            ("LTrim", "LTrim", [.i32], [.i32], "blitz3d"),
            ("RTrim", "RTrim", [.i32], [.i32], "blitz3d"),
            ("Instr", "Instr", [.i32, .i32, .i32], [.i32], "blitz3d"),
            ("Replace", "Replace", [.i32, .i32, .i32], [.i32], "blitz3d"),
            ("Chr", "Chr", [.i32], [.i32], "blitz3d"),
            ("Asc", "Asc", [.i32], [.i32], "blitz3d"),
            ("String", "StringRepeat", [.i32, .i32], [.i32], "blitz3d"),
            ("Hex", "Hex", [.i32], [.i32], "blitz3d"),
            ("Bin", "Bin", [.i32], [.i32], "blitz3d"),
            ("LSet", "LSet", [.i32, .i32], [.i32], "blitz3d"),
            ("RSet", "RSet", [.i32, .i32], [.i32], "blitz3d"),
            ("CurrentDate", "CurrentDate", [], [.i32], "blitz3d"),
            ("CurrentTime", "CurrentTime", [], [.i32], "blitz3d"),
            ("StoreString", "StoreString", [.i32], [.i32], "blitz3d"),
            ("FreeString", "FreeString", [.i32], [], "blitz3d"),
            
            // File I/O Functions
            ("ReadFile", "ReadFile", [.i32], [.i32], "blitz3d"),
            ("WriteFile", "WriteFile", [.i32], [.i32], "blitz3d"),
            ("OpenFile", "OpenFile", [.i32], [.i32], "blitz3d"),
            ("CloseFile", "CloseFile", [.i32], [], "blitz3d"),
            ("FilePos", "FilePos", [.i32], [.i32], "blitz3d"),
            ("SeekFile", "SeekFile", [.i32, .i32], [], "blitz3d"),
            ("Eof", "Eof", [.i32], [.i32], "blitz3d"),
            ("ReadByte", "ReadByte", [.i32], [.i32], "blitz3d"),
            ("ReadShort", "ReadShort", [.i32], [.i32], "blitz3d"),
            ("ReadInt", "ReadInt", [.i32], [.i32], "blitz3d"),
            ("ReadFloat", "ReadFloat", [.i32], [.f32], "blitz3d"),
            ("ReadLine", "ReadLine", [.i32], [.i32], "blitz3d"),
            ("ReadString", "ReadString", [.i32], [.i32], "blitz3d"),
            ("WriteByte", "WriteByte", [.i32, .i32], [], "blitz3d"),
            ("WriteShort", "WriteShort", [.i32, .i32], [], "blitz3d"),
            ("WriteInt", "WriteInt", [.i32, .i32], [], "blitz3d"),
            ("WriteFloat", "WriteFloat", [.i32, .f32], [], "blitz3d"),
            ("WriteLine", "WriteLine", [.i32, .i32], [], "blitz3d"),
            ("WriteString", "WriteString", [.i32, .i32], [], "blitz3d"),
            ("FileSize", "FileSize", [.i32], [.i32], "blitz3d"),
            ("FileType", "FileType", [.i32], [.i32], "blitz3d"),
            ("ReadDir", "ReadDir", [.i32], [.i32], "blitz3d"),
            ("NextFile", "NextFile", [], [.i32], "blitz3d"),
            ("MoreFiles", "MoreFiles", [], [.i32], "blitz3d"),
            ("CurrentDir", "CurrentDir", [], [.i32], "blitz3d"),
            ("ChangeDir", "ChangeDir", [.i32], [.i32], "blitz3d"),
            ("CreateDir", "CreateDir", [.i32], [.i32], "blitz3d"),
            ("DeleteDir", "DeleteDir", [.i32], [.i32], "blitz3d"),
            
            // Graphics Asset Loading Functions
            ("LoadMesh", "LoadMesh", [.i32, .i32], [.i32], "blitz3d"),
            ("LoadAnimMesh", "LoadAnimMesh", [.i32, .i32], [.i32], "blitz3d"),
            ("FreeMesh", "FreeMesh", [.i32], [], "blitz3d"),
            ("LoadTexture", "LoadTexture", [.i32, .i32], [.i32], "blitz3d"),
            ("LoadAnimTexture", "LoadAnimTexture", [.i32, .i32, .i32, .i32, .i32, .i32], [.i32], "blitz3d"),
            ("TextureWidth", "TextureWidth", [.i32], [.i32], "blitz3d"),
            ("TextureHeight", "TextureHeight", [.i32], [.i32], "blitz3d"),
            ("TextureName", "TextureName", [.i32], [.i32], "blitz3d"),
            ("LoadImage", "LoadImage", [.i32], [.i32], "blitz3d"),
            ("LoadAnimImage", "LoadAnimImage", [.i32, .i32, .i32, .i32, .i32], [.i32], "blitz3d"),
            ("CopyImage", "CopyImage", [.i32], [.i32], "blitz3d"),
            ("ImageWidth", "ImageWidth", [.i32], [.i32], "blitz3d"),
            ("ImageHeight", "ImageHeight", [.i32], [.i32], "blitz3d"),
            ("TextureBlend", "TextureBlend", [.i32, .i32], [], "blitz3d"),
            ("TextureCoords", "TextureCoords", [.i32, .i32], [], "blitz3d"),
            ("ScaleTexture", "ScaleTexture", [.i32, .f32, .f32], [], "blitz3d"),
            ("PositionTexture", "PositionTexture", [.i32, .f32, .f32], [], "blitz3d"),
            ("RotateTexture", "RotateTexture", [.i32, .f32], [], "blitz3d"),
            ("TextureFilter", "TextureFilter", [.i32, .i32], [], "blitz3d"),
            ("DrawImage", "DrawImage", [.i32, .i32, .i32, .i32], [], "blitz3d"),
            ("DrawImageRect", "DrawImageRect", [.i32, .i32, .i32, .i32, .i32, .i32, .i32, .i32], [], "blitz3d"),
            ("DrawBlock", "DrawBlock", [.i32, .i32, .i32, .i32], [], "blitz3d"),
            ("TileImage", "TileImage", [.i32, .i32, .i32, .i32], [], "blitz3d"),
            ("TileBlock", "TileBlock", [.i32, .i32, .i32, .i32], [], "blitz3d"),
            ("HandleImage", "HandleImage", [.i32, .i32, .i32], [], "blitz3d"),
            ("MidHandle", "MidHandle", [.i32], [], "blitz3d"),
            ("AutoMidHandle", "AutoMidHandle", [.i32], [], "blitz3d"),
            ("MaskImage", "MaskImage", [.i32, .i32, .i32, .i32], [], "blitz3d"),
            ("ScaleImage", "ScaleImage", [.i32, .f32, .f32], [], "blitz3d"),
            ("ResizeImage", "ResizeImage", [.i32, .i32, .i32], [], "blitz3d"),
            ("RotateImage", "RotateImage", [.i32, .f32], [], "blitz3d"),
            ("TFormImage", "TFormImage", [.i32, .f32, .f32, .f32, .f32], [], "blitz3d"),
            ("TFormFilter", "TFormFilter", [.i32], [], "blitz3d"),
            ("GrabImage", "GrabImage", [.i32, .i32, .i32, .i32], [], "blitz3d"),
            ("ImageRectOverlap", "ImageRectOverlap", [.i32, .i32, .i32, .i32, .i32, .i32], [.i32], "blitz3d"),
            ("ImageRectCollide", "ImageRectCollide", [.i32, .i32, .i32, .i32, .i32, .i32, .i32, .i32], [.i32], "blitz3d"),
            ("RectsOverlap", "RectsOverlap", [.i32, .i32, .i32, .i32, .i32, .i32, .i32, .i32], [.i32], "blitz3d"),
            ("ImagesOverlap", "ImagesOverlap", [.i32, .i32, .i32, .i32, .i32, .i32], [.i32], "blitz3d"),
            ("ImagesCollide", "ImagesCollide", [.i32, .i32, .i32, .i32, .i32, .i32, .i32, .i32], [.i32], "blitz3d"),
            
            // Camera Functions
            ("CameraClsMode", "CameraClsMode", [.i32, .i32, .i32], [], "blitz3d"),
            ("CameraPick", "CameraPick", [.i32, .f32, .f32], [.i32], "blitz3d"),
            ("ProjectedX", "ProjectedX", [], [.f32], "blitz3d"),
            ("ProjectedY", "ProjectedY", [], [.f32], "blitz3d"),
            ("CameraProject", "CameraProject", [.i32, .f32, .f32, .f32], [], "blitz3d"),
            
            // Mesh Operations
            ("AddMesh", "AddMesh", [.i32, .i32], [], "blitz3d"),
            ("CopyMesh", "CopyMesh", [.i32, .i32], [.i32], "blitz3d"),
            ("PositionMesh", "PositionMesh", [.i32, .f32, .f32, .f32], [], "blitz3d"),
            ("RotateMesh", "RotateMesh", [.i32, .f32, .f32, .f32], [], "blitz3d"),
            ("ScaleMesh", "ScaleMesh", [.i32, .f32, .f32, .f32], [], "blitz3d"),
            ("CountVertices", "CountVertices", [.i32], [.i32], "blitz3d"),
            ("VertexCoords", "VertexCoords", [.i32, .i32, .f32, .f32, .f32], [], "blitz3d"),
            ("VertexX", "VertexX", [.i32, .i32], [.f32], "blitz3d"),
            ("VertexY", "VertexY", [.i32, .i32], [.f32], "blitz3d"),
            ("VertexZ", "VertexZ", [.i32, .i32], [.f32], "blitz3d"),
            
            // Display/Graphics Functions
            ("ClearSurface", "ClearSurface", [.i32, .i32, .i32], [], "blitz3d"),
            ("ClearWorld", "ClearWorld", [.i32, .i32, .i32], [], "blitz3d"),
            ("AntiAlias", "AntiAlias", [.i32], [], "blitz3d"),
            ("WireFrame", "WireFrame", [.i32], [], "blitz3d"),
            ("GraphicsBuffer", "GraphicsBuffer", [], [.i32], "blitz3d"),
            ("GfxModeWidth", "GfxModeWidth", [.i32], [.i32], "blitz3d"),
            ("GfxModeHeight", "GfxModeHeight", [.i32], [.i32], "blitz3d"),
            ("CountGfxDrivers", "CountGfxDrivers", [], [.i32], "blitz3d"),
            ("GfxDriverName", "GfxDriverName", [.i32], [.i32], "blitz3d"),
            ("CopyRect", "CopyRect", [.i32, .i32, .i32, .i32, .i32, .i32, .i32, .i32], [], "blitz3d"),
            ("TrisRendered", "TrisRendered", [], [.i32], "blitz3d"),
            
            // Color Functions
            ("ColorRed", "ColorRed", [.i32], [.i32], "blitz3d"),
            ("ColorGreen", "ColorGreen", [.i32], [.i32], "blitz3d"),
            ("ColorBlue", "ColorBlue", [.i32], [.i32], "blitz3d"),
            
            // Font/Text Functions
            ("FontWidth", "FontWidth", [.i32], [.i32], "blitz3d"),
            ("FontHeight", "FontHeight", [.i32], [.i32], "blitz3d"),
            ("StringWidth", "StringWidth", [.i32], [.i32], "blitz3d"),
            ("StringHeight", "StringHeight", [.i32], [.i32], "blitz3d"),
            
            // Audio Channel Functions
            ("ChannelPitch", "ChannelPitch", [.i32, .f32], [], "blitz3d"),
            ("LoopSound", "LoopSound", [.i32], [.i32], "blitz3d"),
            ("SoundVolume", "SoundVolume", [.i32, .f32], [], "blitz3d"),
            ("SoundPan", "SoundPan", [.i32, .f32], [], "blitz3d"),
            
            // Entity Functions
            ("EntityName", "EntityName", [.i32], [.i32], "blitz3d"),
            ("GetEntityType", "GetEntityType", [.i32], [.i32], "blitz3d"),
            ("DeltaPitch", "DeltaPitch", [.i32, .i32], [.f32], "blitz3d"),
            ("DeltaYaw", "DeltaYaw", [.i32, .i32], [.f32], "blitz3d"),
            ("DeltaRoll", "DeltaRoll", [.i32, .i32], [.f32], "blitz3d"),
            ("VectorYaw", "VectorYaw", [.f32, .f32, .f32], [.f32], "blitz3d"),
            
            // Input Functions
            ("GetKey", "GetKey", [], [.i32], "blitz3d"),
            ("MouseZSpeed", "MouseZSpeed", [], [.i32], "blitz3d"),
            
            // System Functions
            ("ErrorLog", "ErrorLog", [.i32], [.i32], "blitz3d"),
            ("TotalVidMem", "TotalVidMem", [], [.i32], "blitz3d"),
            ("AvailVidMem", "AvailVidMem", [], [.i32], "blitz3d"),
            ("GlobalMemoryStatus", "GlobalMemoryStatus", [.i32, .i32, .i32, .i32, .i32, .i32, .i32], [], "blitz3d"),
            ("ActiveTextures", "ActiveTextures", [], [.i32], "blitz3d"),
            
            // Platform Stubs (Windows API)
            ("API_SetWindowLong", "API_SetWindowLong", [.i32, .i32, .i32], [.i32], "blitz3d"),
            ("API_SetWindowPos", "API_SetWindowPos", [.i32, .i32, .i32, .i32, .i32, .i32, .i32], [.i32], "blitz3d"),
            ("API_GetFocus", "API_GetFocus", [], [.i32], "blitz3d"),
            ("API_GetModuleFilename", "API_GetModuleFilename", [.i32, .i32, .i32], [.i32], "blitz3d"),
            
            // ZIP Library Stubs
            ("ZlibWapi_CompressBound", "ZlibWapi_CompressBound", [.i32], [.i32], "blitz3d"),
            ("ZlibWapi_Compress2", "ZlibWapi_Compress2", [.i32, .i32, .i32, .i32, .i32], [.i32], "blitz3d"),
            ("ZlibWapi_Uncompress", "ZlibWapi_Uncompress", [.i32, .i32, .i32, .i32], [.i32], "blitz3d"),
            ("ZlibWapi_UnzOpen", "ZlibWapi_UnzOpen", [.i32], [.i32], "blitz3d"),
            ("ZlibWapi_UnzClose", "ZlibWapi_UnzClose", [.i32], [.i32], "blitz3d"),
            ("ZlibWapi_UnzLocateFile", "ZlibWapi_UnzLocateFile", [.i32, .i32, .i32], [.i32], "blitz3d"),
            ("ZlibWapi_UnzOpenCurrentFile", "ZlibWapi_UnzOpenCurrentFile", [.i32], [.i32], "blitz3d"),
            ("ZlibWapi_UnzOpenCurrentFilePassword", "ZlibWapi_UnzOpenCurrentFilePassword", [.i32, .i32], [.i32], "blitz3d"),
            ("ZlibWapi_UnzReadCurrentFile", "ZlibWapi_UnzReadCurrentFile", [.i32, .i32, .i32], [.i32], "blitz3d"),
            ("ZlibWapi_UnzCloseCurrentFile", "ZlibWapi_UnzCloseCurrentFile", [.i32], [.i32], "blitz3d"),
            ("ZlibWapi_UnzGetCurrentFileInfo", "ZlibWapi_UnzGetCurrentFileInfo", [.i32, .i32, .i32, .i32, .i32, .i32, .i32, .i32], [.i32], "blitz3d"),
            ("ZlibWapi_UnzGoToFirstFile", "ZlibWapi_UnzGoToFirstFile", [.i32], [.i32], "blitz3d"),
            ("ZlibWapi_UnzGoToNextFile", "ZlibWapi_UnzGoToNextFile", [.i32], [.i32], "blitz3d"),
            ("ZlibWapi_UnzGetGlobalInfo", "ZlibWapi_UnzGetGlobalInfo", [.i32, .i32], [.i32], "blitz3d"),
            ("ZlibWapi_UnzGetGlobalComment", "ZlibWapi_UnzGetGlobalComment", [.i32, .i32, .i32], [.i32], "blitz3d"),
            ("ZlibWapi_ZipOpen", "ZlibWapi_ZipOpen", [.i32, .i32], [.i32], "blitz3d"),
            ("ZlibWapi_ZipClose", "ZlibWapi_ZipClose", [.i32, .i32], [.i32], "blitz3d"),
            ("ZlibWapi_ZipOpenNewFileInZip", "ZlibWapi_ZipOpenNewFileInZip", [.i32, .i32, .i32, .i32, .i32, .i32, .i32, .i32, .i32, .i32], [.i32], "blitz3d"),
            ("ZlibWapi_ZipOpenNewFileInZip3", "ZlibWapi_ZipOpenNewFileInZip3", [.i32, .i32, .i32, .i32, .i32, .i32, .i32, .i32, .i32, .i32, .i32, .i32, .i32, .i32, .i32, .i32], [.i32], "blitz3d"),
            ("ZlibWapi_ZipWriteFileInZip", "ZlibWapi_ZipWriteFileInZip", [.i32, .i32, .i32], [.i32], "blitz3d"),
            ("ZlibWapi_ZipCloseFileInZip", "ZlibWapi_ZipCloseFileInZip", [.i32], [.i32], "blitz3d"),
            ("ZlibWapi_Crc32", "ZlibWapi_Crc32", [.i32, .i32, .i32], [.i32], "blitz3d"),
            ("ZlibWapi_Adler32", "ZlibWapi_Adler32", [.i32, .i32, .i32], [.i32], "blitz3d"),
            
            // Video Playback Stubs
            ("BlitzMovie_Open", "BlitzMovie_Open", [.i32], [.i32], "blitz3d"),
            ("BlitzMovie_Close", "BlitzMovie_Close", [.i32], [.i32], "blitz3d"),
            ("BlitzMovie_GetWidth", "BlitzMovie_GetWidth", [.i32], [.i32], "blitz3d"),
            ("BlitzMovie_GetHeight", "BlitzMovie_GetHeight", [.i32], [.i32], "blitz3d"),
            ("BlitzMovie_OpenDecodeToImage", "BlitzMovie_OpenDecodeToImage", [.i32, .i32], [.i32], "blitz3d"),
            ("BlitzMovie_Play", "BlitzMovie_Play", [.i32], [.i32], "blitz3d"),
            ("BlitzMovie_Stop", "BlitzMovie_Stop", [.i32], [.i32], "blitz3d"),
            
            // Miscellaneous Functions
            ("Forest_Pivot", "Forest_Pivot", [], [.i32], "blitz3d"),
            ("SX", "SX", [.i32], [.f32], "blitz3d"),
            ("SY", "SY", [.i32], [.f32], "blitz3d"),
            ("ParticlePiv", "ParticlePiv", [.i32], [.i32], "blitz3d"),
            ("D", "D", [.f32], [.f32], "blitz3d"),
            ("Temp", "Temp", [], [.f32], "blitz3d"),
            ("TextureBumpEnvMat", "TextureBumpEnvMat", [.i32, .f32, .f32, .f32, .f32], [], "blitz3d"),
            ("TextureBumpEnvOffset", "TextureBumpEnvOffset", [.i32, .f32], [], "blitz3d"),
            ("TextureBumpEnvScale", "TextureBumpEnvScale", [.i32, .f32], [], "blitz3d"),
            ("TextureLODBias", "TextureLODBias", [.i32, .f32], [], "blitz3d"),
            ("CloseDir", "CloseDir", [.i32], [], "blitz3d"),
            ("ReadBytes", "ReadBytes", [.i32, .i32, .i32, .i32], [.i32], "blitz3d"),
            ("WriteBytes", "WriteBytes", [.i32, .i32, .i32, .i32], [.i32], "blitz3d"),
            
            ("ParseB3D", "ParseB3D", [.i32], [.i32], "blitz3d"),
            ("ParseRMesh", "ParseRMesh", [.i32], [.i32], "blitz3d"),
            ("GetMeshSurfaceCount", "GetMeshSurfaceCount", [.i32], [.i32], "blitz3d"),
            ("GetSurfaceVertexCount", "GetSurfaceVertexCount", [.i32, .i32], [.i32], "blitz3d"),
            ("GetSurfaceIndexCount", "GetSurfaceIndexCount", [.i32, .i32], [.i32], "blitz3d"),
            ("GetSurfaceVerticesPtr", "GetSurfaceVerticesPtr", [.i32, .i32], [.i32], "blitz3d"),
            ("GetSurfaceIndicesPtr", "GetSurfaceIndicesPtr", [.i32, .i32], [.i32], "blitz3d"),
            ("AddVertexExtended", "AddVertexExtended", [.i32, .f32, .f32, .f32, .f32, .f32, .f32, .f32, .i32, .i32, .i32], [.i32], "env"),
            ("SetSurfaceTexture", "SetSurfaceTexture", [.i32, .i32, .i32], [], "env"),
            ("SetSurfaceLightmap", "SetSurfaceLightmap", [.i32, .i32], [], "env"),
            ("AddCollisionVertex", "AddCollisionVertex", [.f32, .f32, .f32], [], "env"),
            ("AddCollisionTriangle", "AddCollisionTriangle", [.i32, .i32, .i32], [], "env"),
            ("AddEntity", "AddEntity", [.i32, .f32, .f32, .f32], [], "env"),
            ("StringEqual", "StringEqual", [.i32, .i32], [.i32], "env"),
            ("ZlibWapi_Open", "ZlibWapi_Open", [.i32], [.i32], "env"),
            ("ZlibWapi_Close", "ZlibWapi_Close", [.i32], [], "env"),
            ("ZlibWapi_GetFileCount", "ZlibWapi_GetFileCount", [.i32], [.i32], "env"),
            ("ZlibWapi_GetFileName", "ZlibWapi_GetFileName", [.i32, .i32], [.i32], "env"),
            ("ZlibWapi_ExtractFile", "ZlibWapi_ExtractFile", [.i32, .i32, .i32], [.i32], "env"),
            
            // Movie Functions (SCP:CB intro videos)
            ("OpenMovie", "OpenMovie", [.i32], [.i32], "env"),
            ("DrawMovie", "DrawMovie", [.i32, .i32, .i32, .i32, .i32], [], "env"),
            ("MoviePlaying", "MoviePlaying", [.i32], [.i32], "env"),
            
            // Audio Functions
            ("FSOUND_Stream_Open", "FSOUND_Stream_Open", [.i32, .i32, .i32, .i32], [.i32], "env"),
            ("FSOUND_Stream_Play", "FSOUND_Stream_Play", [.i32, .i32], [.i32], "env"),
            ("FSOUND_SetVolume", "FSOUND_SetVolume", [.i32, .i32], [], "env"),
            ("FSOUND_SetPaused", "FSOUND_SetPaused", [.i32, .i32], [], "env"),
            ("FSOUND_Stream_Stop", "FSOUND_Stream_Stop", [.i32], [], "env"),
            ("FSOUND_Close", "FSOUND_Close", [], [], "env"),

            // OpenAL Functions (BlitzAL wrapper)
            ("alInit", "alInit", [.f32, .f32], [], "al"),
            ("alGetAvailableDeviceCount", "alGetAvailableDeviceCount", [], [.i32], "al"),
            ("alGetAvailableDeviceName", "alGetAvailableDeviceName", [.i32], [.i32], "al"),
            ("alDeviceInit", "alDeviceInit", [.i32, .i32, .i32], [.i32], "al"),
            ("alGetNumSources", "alGetNumSources", [], [.i32], "al"),
            ("alDestroy", "alDestroy", [], [], "al"),
            ("alUpdate", "alUpdate", [], [], "al"),
            ("alListenerSetPosition", "alListenerSetPosition", [.f32, .f32, .f32], [], "al"),
            ("alListenerSetDirection", "alListenerSetDirection", [.f32, .f32, .f32], [], "al"),
            ("alListenerSetUp", "alListenerSetUp", [.f32, .f32, .f32], [], "al"),
            ("alListenerSetVelocity", "alListenerSetVelocity", [.f32, .f32, .f32], [], "al"),
            ("alListenerSetMasterVolume", "alListenerSetMasterVolume", [.f32], [], "al"),
            ("alCreateBuffer", "alCreateBuffer", [.i32, .i32], [.i32], "al"),
            ("alFreeBuffer", "alFreeBuffer", [.i32], [], "al"),
            ("alCreateSource", "alCreateSource", [.i32, .i32, .i32], [.i32], "al"),
            ("alCreateSource_", "alCreateSource_", [.i32, .i32, .i32], [.i32], "al"),
            ("alFreeSource", "alFreeSource", [.i32], [], "al"),
            ("alSourcePlay", "alSourcePlay", [.i32, .i32], [.i32], "al"),
            ("alSourcePlay_", "alSourcePlay_", [.i32, .i32], [.i32], "al"),
            ("alSourcePlay2D", "alSourcePlay2D", [.i32, .i32], [.i32], "al"),
            ("alSourcePlay2D_", "alSourcePlay2D_", [.i32, .i32], [.i32], "al"),
            ("alSourcePlay3D", "alSourcePlay3D", [.i32, .i32], [.i32], "al"),
            ("alSourcePlay3D_", "alSourcePlay3D_", [.i32, .i32], [.i32], "al"),
            ("alSourcePause", "alSourcePause", [.i32], [], "al"),
            ("alSourceResume", "alSourceResume", [.i32], [], "al"),
            ("alSourceStop", "alSourceStop", [.i32], [], "al"),
            ("alSourceIsPlaying", "alSourceIsPlaying", [.i32], [.i32], "al"),
            ("alSourceIsPaused", "alSourceIsPaused", [.i32], [.i32], "al"),
            ("alSourceIsStopped", "alSourceIsStopped", [.i32], [.i32], "al"),
            ("alSourceSetVolume", "alSourceSetVolume", [.i32, .f32], [], "al"),
            ("alSourceSetPitch", "alSourceSetPitch", [.i32, .f32], [], "al"),
            ("alSourceSetLoop", "alSourceSetLoop", [.i32, .i32], [], "al"),
            ("alSourceSeek", "alSourceSeek", [.i32, .f32, .i32], [], "al"),
            ("alSourceGetAudioTime", "alSourceGetAudioTime", [.i32, .i32], [.f32], "al"),
            ("alSourceGetLenght", "alSourceGetLenght", [.i32, .i32], [.f32], "al"),
            ("alSourceSet3DPosition", "alSourceSet3DPosition", [.i32, .f32, .f32, .f32], [], "al"),
            ("alSourceSetRolloffFactor", "alSourceSetRolloffFactor", [.i32, .f32], [], "al"),
            ("alCreateEffect", "alCreateEffect", [], [.i32], "al"),
            ("alFreeEffect", "alFreeEffect", [.i32], [], "al"),
            ("alEffectSetEAXReverb", "alEffectSetEAXReverb", [.i32, .f32, .f32, .f32, .f32, .f32, .f32, .f32, .f32, .f32, .f32, .f32, .f32, .f32, .f32, .f32, .i32, .f32, .f32, .f32, .f32, .f32], [], "al"),

            // Performance Functions
            ("MilliSecs", "MilliSecs", [], [.i32], "env"),
            ("CountFPS", "CountFPS", [], [.i32], "env"),
            ("PerformanceStats", "PerformanceStats", [], [.i32], "env"),
            
            // String Functions
            ("Left", "Left", [.i32, .i32], [.i32], "env"),
            ("Right", "Right", [.i32, .i32], [.i32], "env"),
            ("Mid", "Mid", [.i32, .i32, .i32], [.i32], "env"),
            ("Upper", "Upper", [.i32], [.i32], "env"),
            // Note: String and Math functions now imported from blitz3d module (see above)
            ("Abs", "Abs", [.f32], [.f32], "env"),
            ("Sgn", "Sgn", [.f32], [.f32], "env"),
            ("Ceil", "Ceil", [.f32], [.f32], "env"),
            ("Floor", "Floor", [.f32], [.f32], "env"),
            ("Mod", "Mod", [.f32, .f32], [.f32], "env"),
            
            // Transformation Functions
            ("TFormVector", "TFormVector", [.f32, .f32, .f32, .i32, .i32], [], "env"),
            ("TFormPoint", "TFormPoint", [.f32, .f32, .f32, .i32, .i32], [], "env"),
            ("TFormNormal", "TFormNormal", [.f32, .f32, .f32, .i32, .i32], [], "env"),
            ("TFormedX", "TFormedX", [], [.f32], "env"),
            ("TFormedY", "TFormedY", [], [.f32], "env"),
            ("TFormedZ", "TFormedZ", [], [.f32], "env"),
            
            // Particle System
            ("CreateParticle", "CreateParticle", [.i32, .f32, .f32, .f32, .i32, .f32, .i32, .i32], [.i32], "env"),
            ("UpdateParticles", "UpdateParticles", [], [], "env"),
            ("RemoveParticle", "RemoveParticle", [.i32], [], "env"),
            ("ParticleTextures", "ParticleTextures", [.i32, .i32, .i32], [.i32], "env"),
            
            // Devil Particle System (DLL)
            ("SetEmitter", "SetEmitter", [.i32, .i32], [.i32], "env"),
            ("UpdateEmitters", "UpdateEmitters", [.i32], [], "env"),
            ("DeleteDevilEmitters", "DeleteDevilEmitters", [], [], "env"),
            ("UpdateDevilEmitters", "UpdateDevilEmitters", [], [], "env"),
            
            // Decal System
            ("CreateDecal", "CreateDecal", [.i32, .f32, .f32, .f32, .f32, .f32, .f32, .f32, .i32], [.i32], "env"),
            ("UpdateDecals", "UpdateDecals", [], [], "env"),
            
            // Game-Specific Functions
            ("GiveAchievement", "GiveAchievement", [.i32], [], "env"),
            ("Update294", "Update294", [], [], "env"),
            ("UpdateItems", "UpdateItems", [], [], "env"),
            ("PickItem", "PickItem", [.i32], [], "env"),
            ("DropItem", "DropItem", [.i32], [], "env"),
            // Animate2 mirrors Blitz3D Animate2 semantics: entity, currentFrame, start, end, speed, loopFlag -> returns new frame (f32)
            ("Animate2", "Animate2", [.i32, .f32, .f32, .f32, .f32, .i32], [.f32], "env"),
            ("ChangeNPCTextureID", "ChangeNPCTextureID", [.i32, .i32], [], "env"),
            ("CheckForNPCInFacility", "CheckForNPCInFacility", [.i32], [.i32], "env"),
            ("Console_SpawnNPC", "Console_SpawnNPC", [.i32], [], "env"),
            ("ChangeAngleValueForCorrectBoneAssigning", "ChangeAngleValueForCorrectBoneAssigning", [.f32], [.f32], "env"),
            ("UseDoor", "UseDoor", [.i32, .i32, .i32], [], "env"),
            ("PlaySound2", "PlaySound2", [.i32, .i32, .i32, .f32, .f32], [.i32], "env"),
            ("LoopSound2", "LoopSound2", [.i32, .i32, .i32, .i32, .f32, .f32], [.i32], "env"),
            ("UpdateSoundOrigin", "UpdateSoundOrigin", [.i32, .i32, .i32, .f32, .f32], [], "env"),
            ("UpdateSoundOrigin2", "UpdateSoundOrigin2", [.i32, .i32, .i32, .f32, .f32], [], "env"),
            ("SetNPCFrame", "SetNPCFrame", [.i32, .f32], [], "env"),
            ("RemoveNPC", "RemoveNPC", [.i32], [], "env"),
            ("FindPath", "FindPath", [.i32, .f32, .f32, .f32], [.i32], "env"),
            ("PointEntity", "PointEntity", [.i32, .i32], [], "env"),
            ("CreateEmitter", "CreateEmitter", [.f32, .f32, .f32, .i32], [.i32], "env"),
            ("RemoveEvent", "RemoveEvent", [.i32], [], "env"),
            ("LoadEventSound", "LoadEventSound", [.i32, .i32, .i32], [.i32], "env"),
            ("DrawLoading", "DrawLoading", [.i32, .i32], [], "env"),
            ("sky_CreateSky", "sky_CreateSky", [.i32, .i32], [.i32], "env"),
            ("UpdateSky", "UpdateSky", [], [], "env"),
            ("CameraFogMode", "CameraFogMode", [.i32, .i32], [], "env"),
            ("CameraFogColor", "CameraFogColor", [.i32, .i32, .i32, .i32], [], "env"),
            ("LoadSprite", "LoadSprite", [.i32, .i32], [.i32], "env"),
            ("ScaleMesh", "ScaleMesh", [.i32, .f32, .f32, .f32], [], "env"),
            ("StreamSound_Strict", "StreamSound_Strict", [.i32, .f32, .i32], [.i32], "env"),
            ("StopStream_Strict", "StopStream_Strict", [.i32], [], "env"),
            ("SetStreamVolume_Strict", "SetStreamVolume_Strict", [.i32, .f32], [], "env"),
            ("PlayAnnouncement", "PlayAnnouncement", [.i32], [], "env"),
            ("HideChunks", "HideChunks", [], [], "env"),
            ("UpdateEndings", "UpdateEndings", [], [], "env"),
            
            // Geometry/Math Helpers
            ("AlignToVector", "AlignToVector", [.i32, .f32, .f32, .f32, .i32, .f32], [], "env"),
            ("CurveAngle", "CurveAngle", [.f32, .f32, .f32], [.f32], "env"),
            // Math helpers
            ("Pow", "pow", [.f32, .f32], [.f32], "env"),
            
            // Camera Functions
            ("CameraProject", "CameraProject", [.i32, .f32, .f32, .f32], [], "env"),
            ("CameraFogRange", "CameraFogRange", [.i32, .f32, .f32], [], "env"),
            
            // Additional runtime helpers
            ("DeltaYaw", "DeltaYaw", [.i32, .i32], [.f32], "env"),
            ("EntityAutoFade", "EntityAutoFade", [.i32, .f32, .f32], [], "env"),
            ("GetBrushTexture", "GetBrushTexture", [.i32, .i32], [.i32], "env"),
            ("GetSurfaceBrush", "GetSurfaceBrush", [.i32], [.i32], "env"),
            ("KeyName", "KeyName", [.i32], [.i32], "env"),
            ("MeshWidth", "MeshWidth", [.i32], [.f32], "env"),
            ("MeshHeight", "MeshHeight", [.i32], [.f32], "env"),
            ("MeshDepth", "MeshDepth", [.i32], [.f32], "env"),
            ("FlipMesh", "FlipMesh", [.i32, .i32, .i32, .i32], [], "env"),
            ("MeshCullBox", "MeshCullBox", [.i32, .f32, .f32, .f32, .f32, .f32, .f32], [], "env"),
            ("EntityOrder", "EntityOrder", [.i32, .i32], [], "env"),
            ("LightConeAngles", "LightConeAngles", [.i32, .f32, .f32], [], "env"),
            ("PickedEntity", "PickedEntity", [], [.i32], "env"),
            ("PickedNX", "PickedNX", [], [.f32], "env"),
            ("PickedNY", "PickedNY", [], [.f32], "env"),
            ("PickedNZ", "PickedNZ", [], [.f32], "env"),
            ("TextureName", "TextureName", [.i32], [.i32], "env"),
            ("RndSeed", "RndSeed", [], [.i32], "env")
        ]
        
        // Add debug helper imports if debugging is enabled
        if context.debugGenerator != nil {
            // Note: the runtime debug module expects these exact names.
            imports.append(("__bbdbg_enter", "__bbdbg_enter", [.i32], [], "bbdbg"))
            imports.append(("__bbdbg_leave", "__bbdbg_leave", [.i32], [], "bbdbg"))
            imports.append(("__bbdbg_stmt", "__bbdbg_stmt", [.i32, .i32], [], "bbdbg"))
        }

        for (name, internalName, params, results, moduleName) in imports {
            let lowerName = name.lowercased()
            let lowerInternal = internalName.lowercased()
            if excludedInternalNames.contains(lowerName) || excludedInternalNames.contains(lowerInternal) {
                continue
            }
            var defaults: [Int: ExpressionNode]? = nil
            
            // Add some common defaults
            if name == "Graphics" || name == "Graphics3D" {
                defaults = [2: .integerLiteral(0, .unknown), 3: .integerLiteral(0, .unknown)]
            } else if name == "CreateCamera" {
                defaults = [0: .integerLiteral(0, .unknown)]
            } else if name == "CreateLight" {
                defaults = [0: .integerLiteral(1, .unknown), 1: .integerLiteral(0, .unknown)]
            } else if name == "Flip" {
                defaults = [0: .integerLiteral(1, .unknown)]
            } else if name == "VWait" {
                defaults = [0: .integerLiteral(1, .unknown)]
            } else if name == "Text" {
                defaults = [3: .integerLiteral(0, .unknown), 4: .integerLiteral(0, .unknown)]
            } else if name == "Cls" {
                defaults = [0: .integerLiteral(1, .unknown), 1: .integerLiteral(1, .unknown)]
            } else if name == "EntityX" || name == "EntityY" || name == "EntityZ" {
                defaults = [1: .integerLiteral(0, .unknown)]
            } else if name == "EntityPitch" || name == "EntityYaw" || name == "EntityRoll" {
                defaults = [1: .integerLiteral(0, .unknown)]
            } else if name == "LoadMesh" || name == "LoadAnimMesh" || name == "LoadTexture" || name == "LoadImage" || name == "LoadSound" || name == "LoadFont" {
                defaults = [1: .integerLiteral(0, .unknown)]
            } else if name == "CreateImage" {
                // CreateImage(width, height[, frames]) - frames defaults to 1
                defaults = [2: .integerLiteral(1, .unknown)]
            } else if name == "CreateTexture" {
                // CreateTexture(width, height[, flags[, frames]]) - flags defaults to 0, frames defaults to 1
                defaults = [2: .integerLiteral(0, .unknown), 3: .integerLiteral(1, .unknown)]
            } else if name == "ScaleEntity" || name == "PositionEntity" || name == "RotateEntity" || name == "MoveEntity" || name == "TurnEntity" || name == "TranslateEntity" {
                defaults = [4: .integerLiteral(0, .unknown)]
            } else if name == "EntityPick" || name == "LinePick" {
                defaults = [4: .floatLiteral(0.0, .unknown)]
            } else if name == "CameraRange" || name == "CameraZoom" {
                defaults = [1: .floatLiteral(1.0, .unknown)]
            } else if name == "CameraFogColor" || name == "EntityColor" || name == "Color" || name == "ClsColor" || name == "AmbientLight" {
                // These often take 3 components, but let's check
            }
            
            let importIdx = context.registerImport(
                name: name,
                internalName: internalName,
                params: params,
                results: results,
                module: moduleName,
                defaults: defaults
            )
            
            if name == "PrintInt" {
                context.functionIndexMap["print"] = importIdx
                context.functionDefinitions["print"] = FunctionDefinition(params: params, results: results, defaults: defaults)
            }
        }

        // Validation: Ensure all imported functions are in BOTH maps
        #if DEBUG
        for (name, _) in context.functionIndexMap {
            if context.functionDefinitions[name] == nil {
                CompilerLogger.warn("WARNING: Function '\(name)' in functionIndexMap but missing from functionDefinitions")
            }
        }
        #endif
        
        // Capture debug function indices
        if context.debugGenerator != nil {
            if let enter = context.functionIndexMap["__bbdbg_enter"],
               let leave = context.functionIndexMap["__bbdbg_leave"],
               let stmt = context.functionIndexMap["__bbdbg_stmt"] {
                context.debugIndices = (enter, leave, stmt)
            }
        }
    }
    
    private func evaluateIntExpression(_ expr: ExpressionNode) -> Int? {
        switch expr {
        case .integerLiteral(let value, _):
            return value
        case .binary(let binop, _):
            if let left = evaluateIntExpression(binop.left),
               let right = evaluateIntExpression(binop.right) {
                switch binop.op {
                case "+": return left + right
                case "-": return left - right
                case "*": return left * right
                case "/": return right != 0 ? left / right : nil
                default: return nil
                }
            }
        case .unary(let unop, _):
            if let val = evaluateIntExpression(unop.expression) {
                switch unop.op {
                case "-": return -val
                default: return nil
                }
            }
        default:
            return nil
        }
        return nil
    }
    
    private mutating func processTypeDeclarations(_ types: [TypeNode]) {
        context.fieldDimensions = [:]
        
        for (index, typeNode) in types.enumerated() {
            let sanitizedTypeName = typeNode.name.map { ch -> Character in
                if ch.isLetter || ch.isNumber || ch == "_" { return ch }
                return "_"
            }
            var offset = 12 // Header: prev(4), next(4), typeID(4)
            var typeFieldOffsets: [String: Int] = [:]
            var typeFieldTypes: [String: String] = [:]
            var typeFieldDimensions: [String: [Int]] = [:]
            var typeFieldDefaults: [String: ExpressionNode] = [:]
            typeFieldOffsets["__prev"] = 0
            typeFieldOffsets["__next"] = 4
            typeFieldOffsets["__typeID"] = 8
            context.fieldOffsets[typeNode.name.lowercased()] = [:]
            context.fieldDimensions[typeNode.name.lowercased()] = [:]
            
            var debugFields: [DebugFieldInfo] = []
            debugFields.append(
                DebugFieldInfo(
                    name: "__prev",
                    offsetBytes: 0,
                    wasmType: "i32",
                    declaredType: "Int",
                    customTypeName: nil,
                    dimensions: nil
                )
            )
            debugFields.append(
                DebugFieldInfo(
                    name: "__next",
                    offsetBytes: 4,
                    wasmType: "i32",
                    declaredType: "Int",
                    customTypeName: nil,
                    dimensions: nil
                )
            )
            debugFields.append(
                DebugFieldInfo(
                    name: "__typeID",
                    offsetBytes: 8,
                    wasmType: "i32",
                    declaredType: "Int",
                    customTypeName: nil,
                    dimensions: nil
                )
            )
            
            let typeHandling = TypeHandling()
            for field in typeNode.fields {
                let fieldWasmType = typeHandling.typeInfo(from: field.type?.rawValue ?? "Int").wasmType
                let fieldSize = context.typeSize(for: fieldWasmType)
                let wasmTypeStr = fieldWasmType.rawValue
                
                // Calculate array size from dimensions
                var arraySize = 1
                var dimensions: [Int] = []
                for dimExpr in field.dimensions {
                    if let dimValue = evaluateIntExpression(dimExpr), dimValue > 0 {
                        dimensions.append(dimValue)
                        arraySize *= dimValue
                    }
                }
                
                // Align offset
                if offset % fieldSize != 0 {
                    offset = ((offset / fieldSize) + 1) * fieldSize
                }
                
                context.fieldOffsets[typeNode.name.lowercased()]?[field.name.lowercased()] = offset
                typeFieldOffsets[field.name.lowercased()] = offset
                CompilerLogger.debug("DEBUG_FIELD: Type=\(typeNode.name) Field=\(field.name) Offset=\(offset)")
                typeFieldTypes[field.name.lowercased()] = field.type?.rawValue ?? "Int"
                
                debugFields.append(
                    DebugFieldInfo(
                        name: field.name,
                        offsetBytes: offset,
                        wasmType: wasmTypeStr,
                        declaredType: field.type?.rawValue ?? "Int",
                        customTypeName: field.typeName,
                        dimensions: dimensions.isEmpty ? nil : dimensions
                    )
                )
                
                // Store dimensions if field is an array
                if !dimensions.isEmpty {
                    typeFieldDimensions[field.name.lowercased()] = dimensions
                    context.fieldDimensions[typeNode.name.lowercased()]?[field.name.lowercased()] = dimensions
                }
                
                // Store default value if present
                if let defaultValue = field.defaultValue {
                    typeFieldDefaults[field.name.lowercased()] = defaultValue
                }
                
                // Move offset by fieldSize * arraySize
                offset += fieldSize * arraySize
            }
            
            var info = UserTypeInfo(
                typeID: index + 1,
                fieldOffsets: typeFieldOffsets,
                fieldTypes: typeFieldTypes,
                fieldDimensions: typeFieldDimensions,
                fieldDefaults: typeFieldDefaults,
                instanceSize: offset
            )
            
            if let gen = context.debugGenerator {
                gen.registerType(
                    DebugTypeInfo(
                        id: index + 1,
                        name: typeNode.name,
                        instanceSizeBytes: offset,
                        fields: debugFields
                    )
                )
            }
            
            // Register globals for this type's management
            info.firstGlobalIdx = context.registerGlobal(type: .i32, mutability: true, initExpr: .i32Const(0))
            info.lastGlobalIdx = context.registerGlobal(type: .i32, mutability: true, initExpr: .i32Const(0))
            info.freeHeadGlobalIdx = context.registerGlobal(type: .i32, mutability: true, initExpr: .i32Const(0))

            // Debug helpers: expose list heads so the web inspector can find live instances without guessing.
            if context.debugGenerator != nil {
                context.module.exports.append(
                    WASMExport(
                        name: "__bbdbg_first_\(sanitizedTypeName)",
                        kind: .global,
                        index: info.firstGlobalIdx
                    )
                )
                context.module.exports.append(
                    WASMExport(
                        name: "__bbdbg_last_\(sanitizedTypeName)",
                        kind: .global,
                        index: info.lastGlobalIdx
                    )
                )
                context.module.exports.append(
                    WASMExport(
                        name: "__bbdbg_freeHead_\(sanitizedTypeName)",
                        kind: .global,
                        index: info.freeHeadGlobalIdx
                    )
                )
            }
            
            context.userTypes[typeNode.name.lowercased()] = info
        }
    }
    
    private mutating func setupUserTypeGlobals(_ types: [TypeNode]) {
        // Heap pointer for the bump allocator (starting after the data section)
        context.heapPointerIdx = context.registerGlobal(type: .i32, mutability: true, initExpr: .i32Const(65536))
        
        // GOSUB Stack Pointer (starts at a fixed location in memory)
        context.gosubStackPtrIdx = context.registerGlobal(type: .i32, mutability: true, initExpr: .i32Const(131072))
        
        // String Heap Pointer (starts after GOSUB stack)
        context.stringHeapPtrIdx = context.registerGlobal(type: .i32, mutability: true, initExpr: .i32Const(262144))
        
        // Scratch globals for temporary values (always needed, not just for types)
        context.scratchGlobalIdx = context.registerGlobal(type: .i32, mutability: true, initExpr: .i32Const(0))
        context.scratchGlobal2Idx = context.registerGlobal(type: .i32, mutability: true, initExpr: .i32Const(0))
        context.scratchGlobal3Idx = context.registerGlobal(type: .i32, mutability: true, initExpr: .i32Const(0))
        context.scratchGlobal4Idx = context.registerGlobal(type: .i32, mutability: true, initExpr: .i32Const(0))
        context.scratchGlobalFloatIdx = context.registerGlobal(type: .f32, mutability: true, initExpr: .f32Const(0.0))
        context.scratchGlobalFloat2Idx = context.registerGlobal(type: .f32, mutability: true, initExpr: .f32Const(0.0))
        context.scratchGlobalFloat3Idx = context.registerGlobal(type: .f32, mutability: true, initExpr: .f32Const(0.0))
        context.scratchGlobalFloat4Idx = context.registerGlobal(type: .f32, mutability: true, initExpr: .f32Const(0.0))
        context.scratchGlobalFloat5Idx = context.registerGlobal(type: .f32, mutability: true, initExpr: .f32Const(0.0))
        context.scratchGlobalFloat6Idx = context.registerGlobal(type: .f32, mutability: true, initExpr: .f32Const(0.0))

        scratchGlobal = context.scratchGlobalIdx
        scratchGlobal2 = context.scratchGlobal2Idx

        if enableCommandBufferABI {
            // Host-provided command buffer region (byte pointer to CMDB header, and total bytes).
            context.cmdBufPtrGlobalIdx = context.registerGlobal(type: .i32, mutability: true, initExpr: .i32Const(0))
            context.cmdBufBytesGlobalIdx = context.registerGlobal(type: .i32, mutability: true, initExpr: .i32Const(0))
            // Stable ABI version constant so the runtime can fail fast on mismatches.
            context.cmdBufAbiVersionGlobalIdx = context.registerGlobal(type: .i32, mutability: false, initExpr: .i32Const(cmdBufAbiVersion))
            // WASM-owned entity id allocator for CMDB entity handles.
            context.cmdNextEntityIdGlobalIdx = context.registerGlobal(type: .i32, mutability: true, initExpr: .i32Const(1))
            // WASM-owned entity state table (authoritative transform state).
            context.cmdEntStatePtrGlobalIdx = context.registerGlobal(type: .i32, mutability: true, initExpr: .i32Const(0))
            context.cmdEntStateCapGlobalIdx = context.registerGlobal(type: .i32, mutability: true, initExpr: .i32Const(0))

            context.module.exports.append(WASMExport(name: "__CmdBufPtr", kind: .global, index: context.cmdBufPtrGlobalIdx))
            context.module.exports.append(WASMExport(name: "__CmdBufBytes", kind: .global, index: context.cmdBufBytesGlobalIdx))
            context.module.exports.append(WASMExport(name: "__CmdBufAbiVersion", kind: .global, index: context.cmdBufAbiVersionGlobalIdx))
        }
        
        if !types.isEmpty {
            let typeCollectionGlobalVar = WASMGlobal(type: .i32, mutability: true, initExpr: .i32Const(65536))
            context.typeCollectionGlobalIdx = context.module.globals.count
            context.module.globals.append(typeCollectionGlobalVar)
        }
    }
    
    private mutating func registerFunctionSignatures(_ functions: [FunctionNode], hasMain: Bool) {
        let typeHandling = TypeHandling()
        
        // Pre-calculate function indices
        // Local functions start after imports + Main (optional) + Alloc functions
        var nextFuncIdx = context.module.imports.count 
        
        if hasMain {
            nextFuncIdx += 1
        }
        
        // Reserve slots for Alloc functions (__alloc, __stringalloc, __stringconcat)
        nextFuncIdx += 3 
        
        for function in functions {
            let paramTypes = function.parameters.map { 
                typeHandling.wasmType(from: $0.type?.rawValue ?? "Int")
            }
            let returnType = typeHandling.wasmType(from: function.returnType?.rawValue ?? "Int")
            let lowerName = function.name.lowercased()

            let results: [WASMType] = (returnType == .void) ? [] : [returnType]
            
            var defaults: [Int: ExpressionNode] = [:]
            for (i, param) in function.parameters.enumerated() {
                if let defaultValue = param.defaultValue {
                    defaults[i] = defaultValue
                }
            }
            
            let def = FunctionDefinition(params: paramTypes, results: results, defaults: defaults.isEmpty ? nil : defaults)
            
            // User-defined functions shadow any existing import definition with the same name.
            // (SCPCB defines many helper functions that may collide with auto-imported/hard-coded names.)
            context.functionDefinitions[lowerName] = def
            
            // Also register the type signature in the module
            let resStr = results.map { $0.rawValue }.joined(separator: ", ")
            let sig = "(" + paramTypes.map { $0.rawValue }.joined(separator: ", ") + ") -> " + (resStr.isEmpty ? "void" : resStr)
            
            if context.typeIndexMap[sig] == nil {
                let typeIdx = context.module.types.count
                context.module.types.append(WASMFunctionType(parameters: paramTypes, results: results))
                context.typeIndexMap[sig] = typeIdx
            }
            
            // Assign a stable local function index for this user-defined function, even if an import exists
            // with the same name. Calls should resolve to the user function within this compilation unit.
            context.functionIndexMap[lowerName] = nextFuncIdx
            context.functionDefinitionsByIndex[nextFuncIdx] = def

            // Store original name for exports (preserves case)
            context.functionOriginalNames[lowerName] = function.name
            // Store original return type if suffix was explicit in source
            context.functionExplicitSuffixes[lowerName] = function.explicitReturnTypeSuffix ? function.returnType : nil
            
            // IMPORTANT: Track user-defined function's ACTUAL index for correct exports
            // This overrides any import with the same name
            context.userFunctionIndices[lowerName] = nextFuncIdx
            
            // Always increment nextFuncIdx because this function WILL be generated in the module code section,
            // consuming a function index slot, regardless of whether it shadows an import or not.
            nextFuncIdx += 1
        }
    }
    
    private mutating func processGlobalDeclarations(_ statements: [StatementNode]) {
        let typeHandling = TypeHandling()
        CompilerLogger.debug("DEBUG_GLOBAL_PROC: Processing \(statements.count) statements for Global declarations")
        var globalCount = 0
        for statement in statements {
            if case .global(let decl, _) = statement {
                globalCount += 1
                CompilerLogger.debug("DEBUG_GLOBAL_PROC: Found Global statement #\(globalCount) with \(decl.variables.count) variable(s)")
                for variable in decl.variables {
                    let wasmType = typeHandling.typeInfo(from: variable.typeSuffix).wasmType
                    CompilerLogger.debug("DEBUG_GLOBAL: Registering global '\(variable.name)' with suffix=\(variable.typeSuffix?.rawValue ?? "none") → wasmType=\(wasmType)")
                    let actualGlobalIdx = context.registerGlobalWithDefaultInit(type: wasmType, mutability: true)
                    _ = context.variableManagement.registerGlobalWithIndex(variable.name, type: wasmType, typeName: variable.typeName, wasmIndex: actualGlobalIdx)
                    context.module.exports.append(WASMExport(name: variable.name, kind: .global, index: actualGlobalIdx))
                }
            }
        }
        CompilerLogger.debug("DEBUG_GLOBAL_PROC: Finished processing. Found \(globalCount) Global statements")
    }

    private mutating func processConstantDeclarations(_ statements: [StatementNode], functions: [FunctionNode]) {
        // Constants are compile-time only in this pipeline; we record them in `context.constants`
        // so expression/codegen can treat them as literals (and Select/Case can work).
        for statement in statements {
            collectConstants(in: statement)
        }
        for fn in functions {
            for statement in fn.body {
                collectConstants(in: statement)
            }
        }
    }

    private mutating func collectConstants(in statement: StatementNode) {
        switch statement {
        case .constant(let decl, _):
            if let val = evaluateConstInt(decl.value) {
                context.setConstant(decl.name, value: val)
            }
        case .constants(let decls, _):
            for decl in decls {
                if let val = evaluateConstInt(decl.value) {
                    context.setConstant(decl.name, value: val)
                }
            }
        case .include(_, let inner, _):
            for stmt in inner {
                collectConstants(in: stmt)
            }
        default:
            break
        }
    }

    private func evaluateConstInt(_ expr: ExpressionNode) -> Int? {
        switch expr {
        case .integerLiteral(let v, _):
            return v
        case .identifier(let id, _):
            return context.constantValue(id.name)
        case .unary(let u, _):
            guard u.op == "-" else { return nil }
            guard let inner = evaluateConstInt(u.expression) else { return nil }
            return -inner
        case .binary(let b, _):
            guard let l = evaluateConstInt(b.left), let r = evaluateConstInt(b.right) else { return nil }
            switch b.op.lowercased() {
            case "+": return l + r
            case "-": return l - r
            case "*": return l * r
            case "/":
                guard r != 0 else { return nil }
                return l / r
            default:
                return nil
            }
        default:
            return nil
        }
    }
    
    private func extractTopLevelStatements(_ statements: [StatementNode]) -> [StatementNode] {
        var topLevelStatements: [StatementNode] = []
        for statement in statements {
            switch statement {
            case .function, .typeDeclaration, .global, .data:
                break
            default:
                topLevelStatements.append(statement)
            }
        }
        return topLevelStatements
    }
    
    private mutating func generateMainFunction(_ statements: [StatementNode]) {
        if statements.isEmpty { return }
        
        // Ensure () -> void type is registered
        if context.typeIndexMap["() -> void"] == nil {
            let typeIdx = context.module.types.count
            context.module.types.append(WASMFunctionType(parameters: [], results: []))
            context.typeIndexMap["() -> void"] = typeIdx
        }
        
        // Wrap top-level statements in a dummy function node
        let mainNode = FunctionNode(name: "Main", parameters: [], body: statements, returnType: .void)
        
        functionGenerator.configure(statementGenerator: statementGenerator)
        functionGenerator.generateFunction(mainNode)
        
        // Also register as _main for internal consistency
        if let idx = context.functionIndexMap["main"] {
            context.functionIndexMap["_main"] = idx
        }
    }
    
    private mutating func generateFunction(_ functionNode: FunctionNode) {
        functionGenerator.configure(statementGenerator: statementGenerator)
        functionGenerator.generateFunction(functionNode)
    }
    
    private mutating func addAllocFunction() {
        // __Alloc(size: i32, freeHeadGlobalIdx: i32) -> ptr: i32
        let allocType = WASMFunctionType(parameters: [.i32, .i32], results: [.i32])
        let allocIdx = context.module.types.count
        context.module.types.append(allocType)
        
        let allocFunc = WASMFunction(
            typeIndex: allocIdx,
            locals: [.i32], // local 2: ptr
            body: [
                .globalGet(context.heapPointerIdx),
                .localSet(2),
                .localGet(2),
                .localGet(0),
                .i32Add,
                .globalSet(context.heapPointerIdx),
                .localGet(2)
            ]
        )
        
        let funcIdx = context.module.imports.count + context.module.functions.count
        context.module.code.append(allocFunc)
        context.module.functions.append(allocIdx)
        context.module.functionNames.append("__Alloc")  // For WASM name section
        context.functionIndexMap["__alloc"] = funcIdx
        context.module.exports.append(WASMExport(name: "__Alloc", kind: .function, index: funcIdx))
        context.functionDefinitionsByIndex[funcIdx] = FunctionDefinition(params: [.i32], results: [.i32])
        
        // __StringAlloc(length: i32) -> ptr: i32
        let strAllocType = WASMFunctionType(parameters: [.i32], results: [.i32])
        let strAllocTypeIdx = context.module.types.count
        context.module.types.append(strAllocType)
        
        let strAllocFunc = WASMFunction(
            typeIndex: strAllocTypeIdx,
            locals: [.i32], // local 1: ptr
            body: [
                .globalGet(context.stringHeapPtrIdx),
                .localSet(1),
                .localGet(1),
                .localGet(0),
                .i32Const(9), // 8 header + 1 null
                .i32Add,
                .i32Add,
                .globalSet(context.stringHeapPtrIdx),
                .localGet(1)
            ]
        )
        
        let strFuncIdx = context.module.imports.count + context.module.functions.count
        context.module.code.append(strAllocFunc)
        context.module.functions.append(strAllocTypeIdx)
        context.module.functionNames.append("__StringAlloc")  // For WASM name section
        context.functionIndexMap["__stringalloc"] = strFuncIdx
        context.module.exports.append(WASMExport(name: "__StringAlloc", kind: .function, index: strFuncIdx))
        context.functionDefinitionsByIndex[strFuncIdx] = FunctionDefinition(params: [.i32], results: [.i32])
        
        // __StringConcat(a: i32, b: i32) -> ptr: i32
        let strConcatType = WASMFunctionType(parameters: [.i32, .i32], results: [.i32])
        let strConcatTypeIdx = context.module.types.count
        context.module.types.append(strConcatType)
        
        let strConcatFunc = WASMFunction(
            typeIndex: strConcatTypeIdx,
            locals: [.i32, .i32, .i32], // local 2: lenA, local 3: lenB, local 4: newPtr
            body: [
                // Get lengths (assuming 8-byte header, length at offset 4)
                .localGet(0),
                .i32Load(2, 4),
                .localSet(2),
                .localGet(1),
                .i32Load(2, 4),
                .localSet(3),
                
                // Allocate new string (lenA + lenB)
                .localGet(2),
                .localGet(3),
                .i32Add,
                .call(strFuncIdx), // __StringAlloc
                .localSet(4),
                
                // Copy A
                .localGet(4),
                .i32Const(8),
                .i32Add, // Dest
                .localGet(0),
                .i32Const(8),
                .i32Add, // Src
                .localGet(2), // Len
                .memoryCopy(0, 0),
                
                // Copy B
                .localGet(4),
                .i32Const(8),
                .i32Add,
                .localGet(2),
                .i32Add, // Dest
                .localGet(1),
                .i32Const(8),
                .i32Add, // Src
                .localGet(3), // Len
                .memoryCopy(0, 0),
                
                // Set length in new string
                .localGet(4),
                .localGet(2),
                .localGet(3),
                .i32Add,
                .i32Store(2, 4),
                
                .localGet(4)
            ]
        )
        
        let strConcatIdx = context.module.imports.count + context.module.functions.count
        context.module.code.append(strConcatFunc)
        context.module.functions.append(strConcatTypeIdx)
        context.module.functionNames.append("__StringConcat")  // For WASM name section
        context.functionIndexMap["__stringconcat"] = strConcatIdx
        context.module.exports.append(WASMExport(name: "__StringConcat", kind: .function, index: strConcatIdx))
        context.functionDefinitionsByIndex[strConcatIdx] = FunctionDefinition(params: [.i32, .i32], results: [.i32])
    }
    
    public mutating func generateFromIR(_ program: ProgramNode) -> WASMModule {
        context.debugFunctionSpans.removeAll()
        for function in program.functions {
            context.debugFunctionSpans[function.name.lowercased()] = function.span
        }
        if let firstStmt = program.statements.first {
            context.debugFunctionSpans["_start"] = firstStmt.span
        }

        let userFunctionNames = Set(program.functions.map { $0.name.lowercased() })
        addImports(excluding: userFunctionNames)
        let lowering = ASTLowering(context: context)
        var irModule = lowering.lower(program)
        
        // Relooper Pass: Structure the IR for each function
        for i in 0..<irModule.functions.count {
            // Build CFG from Linear IR
            let cfgBuilder = CFGBuilder()
            let cfg = cfgBuilder.build(from: irModule.functions[i].body)
            
            // Run Relooper to reconstruct structured control flow
            let relooper = Relooper(cfg: cfg) { [i] in
                let index = irModule.functions[i].parameters.count + irModule.functions[i].locals.count
                irModule.functions[i].locals.append(("__relooper_state", .i32, nil))
                return index
            }
            let structuredBody = relooper.reloop()
            
            // Replace function body with structured version
            irModule.functions[i].body = [structuredBody]
        }
        
        let emitter = IREmitter(module: context.module, context: context)
        let wasmModule = emitter.emit(module: irModule)
        
        return wasmModule
    }
}
