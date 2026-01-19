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
        let imports: [(String, String, [WASMType], [WASMType])] = [
            ("PrintInt", "PrintInt", [.i32], []),
            ("PrintString", "PrintString", [.i32], []),
            ("Graphics3D", "Graphics3D", [.i32, .i32, .i32, .i32], []),
            ("Cls", "Cls", [], []),
            ("Flip", "Flip", [], []),
            ("ClsColor", "ClsColor", [.i32, .i32, .i32], []),
            ("Color", "Color", [.i32, .i32, .i32], []),
            ("GetColor", "GetColor", [.i32, .i32], []),
            ("Rect", "Rect", [.i32, .i32, .i32, .i32, .i32], []),
            ("Oval", "Oval", [.i32, .i32, .i32, .i32, .i32], []),
            ("Line", "Line", [.i32, .i32, .i32, .i32], []),
            ("Text", "Text", [.i32, .i32, .i32, .i32, .i32], []),
            ("LoadImage", "LoadImage", [.i32], [.i32]),
            ("DrawImage", "DrawImage", [.i32, .i32, .i32, .i32], []),
            ("DrawBlock", "DrawBlock", [.i32, .i32, .i32, .i32], []),
            ("TileImage", "TileImage", [.i32, .i32, .i32, .i32], []),
            ("ImageWidth", "ImageWidth", [.i32], [.i32]),
            ("ImageHeight", "ImageHeight", [.i32], [.i32]),
            ("HandleImage", "HandleImage", [.i32, .i32, .i32], []),
            ("MidHandle", "MidHandle", [.i32], []),
            ("AutoMidHandle", "AutoMidHandle", [.i32], []),
            ("MaskImage", "MaskImage", [.i32, .i32, .i32, .i32], []),
            ("ScaleImage", "ScaleImage", [.i32, .f32, .f32], []),
            ("ResizeImage", "ResizeImage", [.i32, .i32, .i32], []),
            ("FreeImage", "FreeImage", [.i32], []),
            ("KeyDown", "KeyDown", [.i32], [.i32]),
            ("KeyHit", "KeyHit", [.i32], [.i32]),
            ("PlaySound", "PlaySound", [.i32], [.i32]),
            ("FreeSound", "FreeSound", [.i32], []),
            ("StopChannel", "StopChannel", [.i32], []),
            ("ChannelVolume", "ChannelVolume", [.i32, .f32], []),
            ("ChannelPaused", "ChannelPaused", [.i32, .i32], []),
            ("ChannelPlaying", "ChannelPlaying", [.i32], [.i32]),
            ("MouseX", "MouseX", [], [.i32]),
            ("MouseY", "MouseY", [], [.i32]),
            ("MouseZ", "MouseZ", [], [.i32]),
            ("MouseDown", "MouseDown", [.i32], [.i32]),
            ("MouseHit", "MouseHit", [.i32], [.i32]),
            ("MouseXSpeed", "MouseXSpeed", [], [.i32]),
            ("MouseYSpeed", "MouseYSpeed", [], [.i32]),
            ("MoveMouse", "MoveMouse", [.i32, .i32], []),
            ("HidePointer", "HidePointer", [], []),
            ("ShowPointer", "ShowPointer", [], []),
            ("MilliCSecs", "MilliCSecs", [], [.i32]),
            ("CreateCamera", "CreateCamera", [.i32], [.i32]),
            ("CreateLight", "CreateLight", [.i32], [.i32]),
            ("AmbientLight", "AmbientLight", [.f32, .f32, .f32], []),
            ("LightColor", "LightColor", [.i32, .f32, .f32, .f32], []),
            ("LightRange", "LightRange", [.i32, .f32], []),
            ("CameraClsColor", "CameraClsColor", [.i32, .f32, .f32, .f32], []),
            ("CameraRange", "CameraRange", [.i32, .f32, .f32], []),
            ("CameraZoom", "CameraZoom", [.i32, .f32], []),
            ("CameraProjMode", "CameraProjMode", [.i32, .i32], []),
            ("CameraViewport", "CameraViewport", [.i32, .i32, .i32, .i32, .i32], []),
            ("FogMode", "FogMode", [.i32], []),
            ("FogColor", "FogColor", [.f32, .f32, .f32], []),
            ("FogRange", "FogRange", [.f32, .f32], []),
            ("FogDensity", "FogDensity", [.f32], []),
            ("CreateCube", "CreateCube", [.i32], [.i32]),
            ("CreateSphere", "CreateSphere", [.i32], [.i32]),
            ("CreatePlane", "CreatePlane", [.i32], [.i32]),
            ("CreateBrush", "CreateBrush", [], [.i32]),
            ("BrushColor", "BrushColor", [.i32, .i32, .i32, .i32], []),
            ("BrushAlpha", "BrushAlpha", [.i32, .i32], []),
            ("BrushShininess", "BrushShininess", [.i32, .i32], []),
            ("PaintEntity", "PaintEntity", [.i32, .i32], []),
            ("PositionEntity", "PositionEntity", [.i32, .f32, .f32, .f32, .i32], []),
            ("RotateEntity", "RotateEntity", [.i32, .f32, .f32, .f32, .i32], []),
            ("ScaleEntity", "ScaleEntity", [.i32, .f32, .f32, .f32], []),
            ("MoveEntity", "MoveEntity", [.i32, .f32, .f32, .f32], []),
            ("TurnEntity", "TurnEntity", [.i32, .f32, .f32, .f32, .i32], []),
            ("EntityTexture", "EntityTexture", [.i32, .i32, .i32, .i32], []),
            ("RenderWorld", "RenderWorld", [.f32], []),
            ("Flip", "Flip", [.i32], []),
            ("LoadTexture", "LoadTexture", [.i32, .i32], [.i32]),
            ("LoadAsset", "LoadAsset", [.i32], [.i32]),
            ("GetAssetData", "GetAssetData", [.i32], [.i32]),
            ("GetAssetSize", "GetAssetSize", [.i32], [.i32]),
            ("LoadMesh", "LoadMesh", [.i32, .i32], [.i32]),
            ("CreateMesh", "CreateMesh", [.i32], [.i32]),
            ("CreateSurface", "CreateSurface", [.i32, .i32], [.i32]),
            ("AddVertex", "AddVertex", [.i32, .f32, .f32, .f32, .f32, .f32, .f32], [.i32]),
            ("AddTriangle", "AddTriangle", [.i32, .i32, .i32, .i32], [.i32]),
            ("VertexColor", "VertexColor", [.i32, .i32, .f32, .f32, .f32, .f32], []),
            ("UpdateNormals", "UpdateNormals", [.i32], []),
            ("LoadAnimMesh", "LoadAnimMesh", [.i32, .i32], [.i32]),
            ("Animate", "Animate", [.i32, .i32, .f32, .i32, .f32], []),
            ("SetAnimTime", "SetAnimTime", [.i32, .f32, .i32], []),
            ("AnimTime", "AnimTime", [.i32], [.f32]),
            ("AnimLength", "AnimLength", [.i32], [.i32]),
            ("ExtractAnimSeq", "ExtractAnimSeq", [.i32, .i32, .i32], [.i32]),
            ("AddAnimSeq", "AddAnimSeq", [.i32, .i32], [.i32]),
            ("AnimSeq", "AnimSeq", [.i32], [.i32]),
            ("Animating", "Animating", [.i32], [.i32]),
            ("Delay", "Delay", [.i32], []),
            ("WaitKey", "WaitKey", [], [.i32]),
            ("CreatePivot", "CreatePivot", [.i32], [.i32]),
            ("FreeEntity", "FreeEntity", [.i32], []),
            ("CopyEntity", "CopyEntity", [.i32, .i32], [.i32]),
            ("EntityX", "EntityX", [.i32, .i32], [.f32]),
            ("EntityY", "EntityY", [.i32, .i32], [.f32]),
            ("EntityZ", "EntityZ", [.i32, .i32], [.f32]),
            ("EntityPitch", "EntityPitch", [.i32, .i32], [.f32]),
            ("EntityYaw", "EntityYaw", [.i32, .i32], [.f32]),
            ("EntityRoll", "EntityRoll", [.i32, .i32], [.f32]),
            ("EntityDistance", "EntityDistance", [.i32, .i32], [.f32]),
            ("EntityPick", "EntityPick", [.i32, .f32], [.i32]),
            ("LinePick", "LinePick", [.f32, .f32, .f32, .f32, .f32, .f32, .f32], [.i32]),
            ("EntityVisible", "EntityVisible", [.i32, .i32], [.i32]),
            ("EntityInView", "EntityInView", [.i32, .i32], [.i32]),
            ("EntityType", "EntityType", [.i32, .i32, .i32], []),
            ("EntityRadius", "EntityRadius", [.i32, .f32, .f32], []),
            ("Collisions", "Collisions", [.i32, .i32, .i32, .i32], []),
            ("UpdateWorld", "UpdateWorld", [.f32], []),
            ("CountCollisions", "CountCollisions", [.i32], [.i32]),
            ("CollisionX", "CollisionX", [.i32, .i32], [.f32]),
            ("CollisionY", "CollisionY", [.i32, .i32], [.f32]),
            ("CollisionZ", "CollisionZ", [.i32, .i32], [.f32]),
            ("CollisionNX", "CollisionNX", [.i32, .i32], [.f32]),
            ("CollisionNY", "CollisionNY", [.i32, .i32], [.f32]),
            ("CollisionNZ", "CollisionNZ", [.i32, .i32], [.f32]),
            ("CollisionEntity", "CollisionEntity", [.i32, .i32], [.i32]),
            ("CollisionSurface", "CollisionSurface", [.i32, .i32], [.i32]),
            ("CollisionTriangle", "CollisionTriangle", [.i32, .i32], [.i32]),
            ("ReadFile", "ReadFile", [.i32], [.i32]),
            ("WriteFile", "WriteFile", [.i32], [.i32]),
            ("CloseFile", "CloseFile", [.i32], []),
            ("ReadInt", "ReadInt", [.i32], [.i32]),
            ("ReadFloat", "ReadFloat", [.i32], [.f32]),
            ("ReadString", "ReadString", [.i32], [.i32]),
            ("ReadByte", "ReadByte", [.i32], [.i32]),
            ("ReadShort", "ReadShort", [.i32], [.i32]),
            ("Eof", "Eof", [.i32], [.i32]),
            ("FileSize", "FileSize", [.i32], [.i32]),
            ("FileType", "FileType", [.i32], [.i32]),
            ("ReadData", "ReadData", [.i32, .i32, .i32], [.i32]),
            ("RestoreData", "RestoreData", [.i32], []),
            ("StringConcat", "StringConcat", [.i32, .i32], [.i32]),
            ("IntToString", "IntToString", [.i32], [.i32]),
            ("FloatToString", "FloatToString", [.f32], [.i32]),
            ("CreateBank", "CreateBank", [.i32], [.i32]),
            ("FreeBank", "FreeBank", [.i32], []),
            ("BankSize", "BankSize", [.i32], [.i32]),
            ("ResizeBank", "ResizeBank", [.i32, .i32], []),
            ("CopyBank", "CopyBank", [.i32, .i32, .i32, .i32, .i32], []),
            ("PeekByte", "PeekByte", [.i32, .i32], [.i32]),
            ("PokeByte", "PokeByte", [.i32, .i32, .i32], []),
            ("PeekInt", "PeekInt", [.i32, .i32], [.i32]),
            ("PokeInt", "PokeInt", [.i32, .i32, .i32], []),
            ("PeekFloat", "PeekFloat", [.i32, .i32], [.f32]),
            ("PokeFloat", "PokeFloat", [.i32, .i32, .f32], []),
            ("PeekShort", "PeekShort", [.i32, .i32], [.i32]),
            ("PokeShort", "PokeShort", [.i32, .i32, .i32], []),
            ("ZlibWapi_Open", "ZlibWapi_Open", [.i32], [.i32]),
            ("ZlibWapi_Close", "ZlibWapi_Close", [.i32], []),
            ("ZlibWapi_GetFileCount", "ZlibWapi_GetFileCount", [.i32], [.i32]),
            ("ZlibWapi_GetFileName", "ZlibWapi_GetFileName", [.i32, .i32], [.i32]),
            ("ZlibWapi_ExtractFile", "ZlibWapi_ExtractFile", [.i32, .i32, .i32], [.i32]),
            ("FSOUND_Init", "FSOUND_Init", [.i32, .i32, .i32], [.i32]),
            ("FSOUND_Stream_Open", "FSOUND_Stream_Open", [.i32, .i32, .i32, .i32], [.i32]),
            ("FSOUND_Stream_Play", "FSOUND_Stream_Play", [.i32, .i32], [.i32]),
            ("FSOUND_SetVolume", "FSOUND_SetVolume", [.i32, .i32], []),
            ("FSOUND_SetPaused", "FSOUND_SetPaused", [.i32, .i32], []),
            ("FSOUND_Stream_Stop", "FSOUND_Stream_Stop", [.i32], []),
            ("FSOUND_Close", "FSOUND_Close", [], []),
            
            // String Functions
            ("Left", "Left", [.i32, .i32], [.i32]),
            ("Right", "Right", [.i32, .i32], [.i32]),
            ("Mid", "Mid", [.i32, .i32, .i32], [.i32]),
            ("Upper", "Upper", [.i32], [.i32]),
            ("Lower", "Lower", [.i32], [.i32]),
            ("Replace", "Replace", [.i32, .i32, .i32], [.i32]),
            ("Instr", "Instr", [.i32, .i32, .i32], [.i32]),
            ("Len", "Len", [.i32], [.i32]),
            ("Trim", "Trim", [.i32], [.i32]),
            ("LTrim", "LTrim", [.i32], [.i32]),
            ("RTrim", "RTrim", [.i32], [.i32]),
            
            // Math Functions
            ("Sin", "Sin", [.f32], [.f32]),
            ("Cos", "Cos", [.f32], [.f32]),
            ("Tan", "Tan", [.f32], [.f32]),
            ("ASin", "ASin", [.f32], [.f32]),
            ("ACos", "ACos", [.f32], [.f32]),
            ("ATan", "ATan", [.f32], [.f32]),
            ("ATan2", "ATan2", [.f32, .f32], [.f32]),
            ("Exp", "Exp", [.f32], [.f32]),
            ("Log", "Log", [.f32], [.f32]),
            ("Log10", "Log10", [.f32], [.f32]),
            ("Sqr", "Sqr", [.f32], [.f32]),
            ("Rnd", "Rnd", [.f32, .f32], [.f32]),
            ("Rand", "Rand", [.i32, .i32], [.i32]),
            ("SeedRnd", "SeedRnd", [.i32], [])
        ]
        
        for (name, internalName, params, results) in imports {
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
            context.module.imports.append(WASMImport(module: "env", name: name, kind: .function, index: typeIdx))
            
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
    
    private mutating func processTypeDeclarations(_ types: [TypeNode]) {
        for (index, typeNode) in types.enumerated() {
            var offset = 12 // Header: prev(4), next(4), typeID(4)
            var typeFieldOffsets: [String: Int] = [:]
            var typeFieldTypes: [String: String] = [:]
            typeFieldOffsets["__prev"] = 0
            typeFieldOffsets["__next"] = 4
            typeFieldOffsets["__typeID"] = 8
            context.fieldOffsets[typeNode.name] = [:]
            
            let typeHandling = TypeHandling()
            for field in typeNode.fields {
                let fieldWasmType = typeHandling.typeInfo(from: field.type?.rawValue ?? "Int").wasmType
                let fieldSize = context.typeSize(for: fieldWasmType)
                if offset % fieldSize != 0 {
                    offset = ((offset / fieldSize) + 1) * fieldSize
                }
                context.fieldOffsets[typeNode.name]?[field.name] = offset
                typeFieldOffsets[field.name] = offset
                typeFieldTypes[field.name] = field.type?.rawValue ?? "Int"
                offset += fieldSize
            }
            
            var info = UserTypeInfo(
                typeID: index + 1,
                fieldOffsets: typeFieldOffsets,
                fieldTypes: typeFieldTypes,
                instanceSize: offset
            )
            
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
        
        if !types.isEmpty {
            let typeCollectionGlobalVar = WASMGlobal(type: .i32, mutability: true, initExpr: .i32Const(65536))
            context.typeCollectionGlobalIdx = context.module.globals.count
            context.module.globals.append(typeCollectionGlobalVar)
            
            scratchGlobal = context.module.globals.count
            context.module.globals.append(WASMGlobal(type: .i32, mutability: true, initExpr: .i32Const(0)))
            scratchGlobal2 = context.module.globals.count
            context.module.globals.append(WASMGlobal(type: .i32, mutability: true, initExpr: .i32Const(0)))
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
