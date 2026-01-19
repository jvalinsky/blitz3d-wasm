//
//  CodeGenerator.swift
//  Blitz3DCompiler
//
//  Generates WebAssembly from AST using modular architecture
//

public struct CodeGenerator {
    private var context: ModuleContext
    
    // Module instances
    private var expressionGenerator: ExpressionGeneration
    private var statementGenerator: StatementGeneration
    private var functionGenerator: FunctionGeneration
    private var dataGenerator: DataGeneration
    
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
        
        // Link generators
        self.statementGenerator.configure(expressionGenerator: expressionGenerator, dataGenerator: dataGenerator)
        self.functionGenerator.configure(statementGenerator: statementGenerator)
    }
    
    public mutating func generate(from program: ProgramNode) -> WASMModule {
        context.module.memories = [WASMMemory(initial: 256, maximum: 512)]
        
        dataGenerator.setup()
        
        addImports()
        
        processTypeDeclarations(program.types)
        setupUserTypeGlobals(program.types)
        processGlobalDeclarations(program.statements)
        
        // Pre-pass: Register all function signatures
        registerFunctionSignatures(program.functions)
        
        dataGenerator.collectDataStatements(program.statements)
        for function in program.functions {
            dataGenerator.collectDataStatements(function.body)
        }
        dataGenerator.serializeDataSection()
        
        let topLevelStatements = extractTopLevelStatements(program.statements)
        generateMainFunction(topLevelStatements)
        
        addAllocFunction()
        
        context.functionIndexMap.forEach { name, idx in
            if name != "_main" && name != "__Alloc" && name != "Main" {
                context.module.exports.append(WASMExport(name: name, kind: .function, index: idx))
            }
        }
        
        for functionNode in program.functions {
            generateFunction(functionNode)
        }
        
        return context.module
    }
    
    private mutating func addImports() {
        let imports: [(String, String, [WASMType], [WASMType], String)] = [
            ("PrintInt", "PrintInt", [.i32], [], "env"),
            ("PrintString", "PrintString", [.i32], [], "env"),
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
            ("LoadImage", "LoadImage", [.i32], [.i32], "env"),
            ("DrawImage", "DrawImage", [.i32, .i32, .i32, .i32], [], "env"),
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
            ("FreeImage", "FreeImage", [.i32], [], "env"),
            ("KeyDown", "KeyDown", [.i32], [.i32], "env"),
            ("KeyHit", "KeyHit", [.i32], [.i32], "env"),
            ("PlaySound", "PlaySound", [.i32], [.i32], "env"),
            ("FreeSound", "FreeSound", [.i32], [], "env"),
            ("LoadSound", "LoadSound", [.i32], [.i32], "env"),
            ("StopChannel", "StopChannel", [.i32], [], "env"),
            ("ChannelVolume", "ChannelVolume", [.i32, .f32], [], "env"),
            ("ChannelPaused", "ChannelPaused", [.i32, .i32], [], "env"),
            ("ChannelPlaying", "ChannelPlaying", [.i32], [.i32], "env"),
            ("FSOUND_Init", "FSOUND_Init", [.i32, .i32, .i32], [.i32], "env"),
            ("FSOUND_Close", "FSOUND_Close", [], [], "env"),
            ("FSOUND_Stream_Open", "FSOUND_Stream_Open", [.i32, .i32, .i32, .i32], [.i32], "env"),
            ("FSOUND_Stream_Play", "FSOUND_Stream_Play", [.i32, .i32], [.i32], "env"),
            ("FSOUND_Stream_Stop", "FSOUND_Stream_Stop", [.i32], [], "env"),
            ("FSOUND_SetVolume", "FSOUND_SetVolume", [.i32, .f32], [], "env"),
            ("FSOUND_SetPaused", "FSOUND_SetPaused", [.i32, .i32], [], "env"),
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
            ("RenderWorld", "RenderWorld", [.f32], [], "env"),
            ("Flip", "Flip", [.i32], [], "env"),
            ("LoadTexture", "LoadTexture", [.i32, .i32], [.i32], "env"),
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
            ("WaitKey", "WaitKey", [], [.i32], "env"),
            ("CreatePivot", "CreatePivot", [.i32], [.i32], "env"),
            ("FreeEntity", "FreeEntity", [.i32], [], "env"),
            ("CopyEntity", "CopyEntity", [.i32, .i32], [.i32], "env"),
            ("EntityX", "EntityX", [.i32, .i32], [.f32], "env"),
            ("EntityY", "EntityY", [.i32, .i32], [.f32], "env"),
            ("EntityZ", "EntityZ", [.i32, .i32], [.f32], "env"),
            ("EntityPitch", "EntityPitch", [.i32, .i32], [.f32], "env"),
            ("EntityYaw", "EntityYaw", [.i32, .i32], [.f32], "env"),
            ("EntityRoll", "EntityRoll", [.i32, .i32], [.f32], "env"),
            ("EntityDistance", "EntityDistance", [.i32, .i32], [.f32], "env"),
            ("EntityPick", "EntityPick", [.i32, .f32], [.i32], "env"),
            ("LinePick", "LinePick", [.f32, .f32, .f32, .f32, .f32, .f32, .f32], [.i32], "env"),
            ("EntityVisible", "EntityVisible", [.i32, .i32], [.i32], "env"),
            ("EntityInView", "EntityInView", [.i32, .i32], [.i32], "env"),
            ("EntityType", "EntityType", [.i32, .i32, .i32], [], "env"),
            ("PointEntity", "PointEntity", [.i32, .i32, .f32], [], "env"),
            ("EntityAlpha", "EntityAlpha", [.i32, .f32], [], "env"),
            ("EntityColor", "EntityColor", [.i32, .f32, .f32, .f32], [], "env"),
            ("EntityFX", "EntityFX", [.i32, .i32], [], "env"),
            ("EntityBlend", "EntityBlend", [.i32, .i32], [], "env"),
            ("NameEntity", "NameEntity", [.i32, .i32], [], "env"),
            ("EntityName", "EntityName", [.i32], [.i32], "env"),
            ("EntityParent", "EntityParent", [.i32, .i32, .i32], [], "env"),
            ("GetParent", "GetParent", [.i32], [.i32], "env"),
            ("EntityClass", "EntityClass", [.i32], [.i32], "env"),
            ("EntityOrder", "EntityOrder", [.i32, .i32], [], "env"),
            ("EntityAutoFade", "EntityAutoFade", [.i32, .f32, .f32], [], "env"),
            ("HideEntity", "HideEntity", [.i32], [], "env"),
            ("ShowEntity", "ShowEntity", [.i32], [], "env"),
            ("EntityRadius", "EntityRadius", [.i32, .f32, .f32], [], "env"),
            ("Collisions", "Collisions", [.i32, .i32, .i32, .i32], [], "env"),
            ("UpdateWorld", "UpdateWorld", [.f32], [], "env"),
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
            ("ReadFile", "ReadFile", [.i32], [.i32], "env"),
            ("WriteFile", "WriteFile", [.i32], [.i32], "env"),
            ("CloseFile", "CloseFile", [.i32], [], "env"),
            ("ReadInt", "ReadInt", [.i32], [.i32], "env"),
            ("ReadFloat", "ReadFloat", [.i32], [.f32], "env"),
            ("ReadString", "ReadString", [.i32], [.i32], "env"),
            ("ReadByte", "ReadByte", [.i32], [.i32], "env"),
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
            ("ParseB3D", "ParseB3D", [.i32], [.i32], "blitz3d"),
            ("ParseRMesh", "ParseRMesh", [.i32], [.i32], "blitz3d"),
            ("GetMeshSurfaceCount", "GetMeshSurfaceCount", [.i32], [.i32], "blitz3d"),
            ("GetSurfaceVertexCount", "GetSurfaceVertexCount", [.i32, .i32], [.i32], "blitz3d"),
            ("GetSurfaceIndexCount", "GetSurfaceIndexCount", [.i32, .i32], [.i32], "blitz3d"),
            ("GetSurfaceVerticesPtr", "GetSurfaceVerticesPtr", [.i32, .i32], [.i32], "blitz3d"),
            ("GetSurfaceIndicesPtr", "GetSurfaceIndicesPtr", [.i32, .i32], [.i32], "blitz3d"),
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
            ("Lower", "Lower", [.i32], [.i32], "env"),
            ("Replace", "Replace", [.i32, .i32, .i32], [.i32], "env"),
            ("Instr", "Instr", [.i32, .i32, .i32], [.i32], "env"),
            ("Len", "Len", [.i32], [.i32], "env"),
            ("Trim", "Trim", [.i32], [.i32], "env"),
            ("LTrim", "LTrim", [.i32], [.i32], "env"),
            ("RTrim", "RTrim", [.i32], [.i32], "env"),
            ("Asc", "Asc", [.i32], [.i32], "env"),
            ("Chr", "Chr", [.i32], [.i32], "env"),
            ("Hex", "Hex", [.i32], [.i32], "env"),
            ("Bin", "Bin", [.i32], [.i32], "env"),
            
            // Math Functions
            ("Sin", "Sin", [.f32], [.f32], "env"),
            ("Cos", "Cos", [.f32], [.f32], "env"),
            ("Tan", "Tan", [.f32], [.f32], "env"),
            ("ASin", "ASin", [.f32], [.f32], "env"),
            ("ACos", "ACos", [.f32], [.f32], "env"),
            ("ATan", "ATan", [.f32], [.f32], "env"),
            ("ATan2", "ATan2", [.f32, .f32], [.f32], "env"),
            ("Exp", "Exp", [.f32], [.f32], "env"),
            ("Log", "Log", [.f32], [.f32], "env"),
            ("Log10", "Log10", [.f32], [.f32], "env"),
            ("Sqr", "Sqr", [.f32], [.f32], "env"),
            ("Rnd", "Rnd", [.f32, .f32], [.f32], "env"),
            ("Rand", "Rand", [.i32, .i32], [.i32], "env"),
            ("SeedRnd", "SeedRnd", [.i32], [], "env")
        ]
        
        for (name, internalName, params, results, moduleName) in imports {
            let resStr = results.map { $0.rawValue }.joined(separator: ", ")
            let sig = "(" + params.map { $0.rawValue }.joined(separator: ", ") + ") -> " + (resStr.isEmpty ? "void" : resStr)
            
            let typeIdx: Int
            if let existingIdx = context.typeIndexMap[sig] {
                typeIdx = existingIdx
            } else {
                typeIdx = context.module.types.count
                context.module.types.append(WASMFunctionType(parameters: params, results: results))
                context.typeIndexMap[sig] = typeIdx
            }
            
            let importIdx = context.module.imports.count
            context.module.imports.append(WASMImport(module: moduleName, name: name, kind: .function, index: typeIdx))
            
            let lowerInternalName = internalName.lowercased()
            context.functionIndexMap[lowerInternalName] = importIdx
            context.functionDefinitions[lowerInternalName] = FunctionDefinition(params: params, results: results)
            
            if name == "CreateCamera" {
                print("DEBUG_COMPILER: Registered CreateCamera. Index: \(importIdx) Internal: \(lowerInternalName)")
            }
            
            if name == "PrintInt" {
                context.functionIndexMap["print"] = importIdx
                context.functionDefinitions["print"] = FunctionDefinition(params: params, results: results)
            }
        }
    }
    
    private func evaluateIntExpression(_ expr: ExpressionNode) -> Int? {
        switch expr {
        case .integerLiteral(let value):
            return value
        case .binary(let binop):
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
        case .unary(let unop):
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
            var offset = 12 // Header: prev(4), next(4), typeID(4)
            var typeFieldOffsets: [String: Int] = [:]
            var typeFieldTypes: [String: String] = [:]
            var typeFieldDimensions: [String: [Int]] = [:]
            var typeFieldDefaults: [String: ExpressionNode] = [:]
            typeFieldOffsets["__prev"] = 0
            typeFieldOffsets["__next"] = 4
            typeFieldOffsets["__typeID"] = 8
            context.fieldOffsets[typeNode.name] = [:]
            context.fieldDimensions[typeNode.name] = [:]
            
            let typeHandling = TypeHandling()
            for field in typeNode.fields {
                let fieldWasmType = typeHandling.typeInfo(from: field.type?.rawValue ?? "Int").wasmType
                let fieldSize = context.typeSize(for: fieldWasmType)
                
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
                
                context.fieldOffsets[typeNode.name]?[field.name] = offset
                typeFieldOffsets[field.name] = offset
                typeFieldTypes[field.name] = field.type?.rawValue ?? "Int"
                
                // Store dimensions if field is an array
                if !dimensions.isEmpty {
                    typeFieldDimensions[field.name] = dimensions
                    context.fieldDimensions[typeNode.name]?[field.name] = dimensions
                }
                
                // Store default value if present
                if let defaultValue = field.defaultValue {
                    typeFieldDefaults[field.name] = defaultValue
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
            
            // Register globals for this type's management
            
            // Register globals for this type's management
            info.firstGlobalIdx = context.registerGlobal(type: .i32, mutability: true, initExpr: .i32Const(0))
            info.lastGlobalIdx = context.registerGlobal(type: .i32, mutability: true, initExpr: .i32Const(0))
            info.freeHeadGlobalIdx = context.registerGlobal(type: .i32, mutability: true, initExpr: .i32Const(0))
            
            context.userTypes[typeNode.name] = info
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
        
        scratchGlobal = context.scratchGlobalIdx
        scratchGlobal2 = context.scratchGlobal2Idx
        
        if !types.isEmpty {
            let typeCollectionGlobalVar = WASMGlobal(type: .i32, mutability: true, initExpr: .i32Const(65536))
            context.typeCollectionGlobalIdx = context.module.globals.count
            context.module.globals.append(typeCollectionGlobalVar)
            
            context.scratchGlobalIdx = context.module.globals.count
            context.module.globals.append(WASMGlobal(type: .i32, mutability: true, initExpr: .i32Const(0)))
            context.scratchGlobal2Idx = context.module.globals.count
            context.module.globals.append(WASMGlobal(type: .i32, mutability: true, initExpr: .i32Const(0)))
            
            scratchGlobal = context.scratchGlobalIdx
            scratchGlobal2 = context.scratchGlobal2Idx
        }
    }
    
    private mutating func registerFunctionSignatures(_ functions: [FunctionNode]) {
        let typeHandling = TypeHandling()
        for function in functions {
            let paramTypes = function.parameters.map { 
                typeHandling.wasmType(from: $0.type?.rawValue ?? "Int")
            }
            let returnType = typeHandling.wasmType(from: function.returnType?.rawValue ?? "Int")
            let lowerName = function.name.lowercased()
            
            let results: [WASMType] = (returnType == .void) ? [] : [returnType]
            context.functionDefinitions[lowerName] = FunctionDefinition(params: paramTypes, results: results)
            
            // Also register the type signature in the module
            let resStr = results.map { $0.rawValue }.joined(separator: ", ")
            let sig = "(" + paramTypes.map { $0.rawValue }.joined(separator: ", ") + ") -> " + (resStr.isEmpty ? "void" : resStr)
            if context.typeIndexMap[sig] == nil {
                let typeIdx = context.module.types.count
                context.module.types.append(WASMFunctionType(parameters: paramTypes, results: results))
                context.typeIndexMap[sig] = typeIdx
            }
        }
    }
    
    private mutating func processGlobalDeclarations(_ statements: [StatementNode]) {
        let typeHandling = TypeHandling()
        for statement in statements {
            if case .global(let decl) = statement {
                for variable in decl.variables {
                    let wasmType = typeHandling.typeInfo(from: variable.typeSuffix).wasmType
                    let global = WASMGlobal(type: wasmType, mutability: true, initExpr: .i32Const(0))
                    let globalIdx = context.module.globals.count
                    context.module.globals.append(global)
                    _ = context.variableManagement.registerGlobal(variable.name, type: wasmType, typeName: variable.typeName)
                    context.module.exports.append(WASMExport(name: variable.name, kind: .global, index: globalIdx))
                }
            }
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
        context.functionIndexMap["__alloc"] = funcIdx
        context.module.exports.append(WASMExport(name: "__Alloc", kind: .function, index: funcIdx))
        
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
        context.functionIndexMap["__stringalloc"] = strFuncIdx
        context.module.exports.append(WASMExport(name: "__StringAlloc", kind: .function, index: strFuncIdx))
        
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
        context.functionIndexMap["__stringconcat"] = strConcatIdx
        context.module.exports.append(WASMExport(name: "__StringConcat", kind: .function, index: strConcatIdx))
    }
}
