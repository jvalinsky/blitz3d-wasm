//
//  CodeGenerator.swift
//  Blitz3DCompiler
//
//  Generates WebAssembly from AST using modular architecture
//

public struct CodeGenerator {
    private var module: WASMModule
    private var currentFunction: WASMFunction?
    
    // Module instances
    private var variableManagement = VariableManagement()
    private var typeHandling = TypeHandling()
    private var expressionGenerator: ExpressionGeneration
    private var statementGenerator: StatementGeneration
    private var functionGenerator: FunctionGeneration
    
    // Maps
    private var functionIndexMap: [String: Int] = [:]
    private var typeIndexMap: [String: Int] = [:]
    private var importDefinitions: [String: ImportDefinition] = [:]
    private var dataStatements: [DataBlock] = []
    private var dataOffsetMap: [String: Int] = [:]
    private var currentDataOffset: Int = 0
    private var dataPtrIndex: Int = -1
    
    // User type support
    private var userTypes: [String: UserTypeInfo] = [:]
    private var fieldOffsets: [String: [String: Int]] = [:]
    private var typeCollectionGlobal: Int = -1
    private var scratchGlobal: Int = -1
    private var scratchGlobal2: Int = -1
    
    // GOTO/Label support
    private var labelStateMap: [String: Int] = [:]
    private var gotoStateLocalIdx: Int = -1
    private var hasGotoInCurrentFunction: Bool = false
    
    private struct DataBlock {
        var label: String?
        var values: [DataValue]
        var offset: Int
    }
    
    private struct ImportDefinition {
        let params: [WASMType]
        let results: [WASMType]
    }
    
    public init() {
        self.module = WASMModule()
        self.expressionGenerator = ExpressionGeneration(
            module: WASMModule(),
            typeIndexMap: [:],
            functionIndexMap: [:]
        )
        self.statementGenerator = StatementGeneration(
            module: WASMModule(),
            typeIndexMap: [:]
        )
        self.functionGenerator = FunctionGeneration(
            module: WASMModule(),
            typeIndexMap: [:],
            functionIndexMap: [:]
        )
    }
    
    public mutating func generate(from program: ProgramNode) -> WASMModule {
        module.memories = [WASMMemory(initial: 1, maximum: 2)]
        
        let dataPtrGlobal = WASMGlobal(type: .i32, mutability: true, initExpr: .i32Const(256))
        dataPtrIndex = module.globals.count
        module.globals.append(dataPtrGlobal)
        
        addCommonTypes()
        addImports()
        
        processTypeDeclarations(program.types)
        setupUserTypeGlobals(program.types)
        processGlobalDeclarations(program.statements)
        
        collectDataStatements(program.statements)
        for function in program.functions {
            collectDataStatements(function.body)
        }
        serializeDataSection()
        
        let topLevelStatements = extractTopLevelStatements(program.statements)
        generateMainFunction(topLevelStatements)
        
        addAllocFunction()
        
        functionIndexMap.forEach { name, idx in
            if name != "_main" && name != "__Alloc" && name != "Main" {
                module.exports.append(WASMExport(name: name, kind: .function, index: idx))
            }
        }
        
        for functionNode in program.functions {
            generateFunction(functionNode)
        }
        
        return module
    }
    
    private mutating func addCommonTypes() {
        module.types.append(WASMFunctionType(parameters: [], results: [.i32]))
        typeIndexMap["() -> i32"] = 0
        
        module.types.append(WASMFunctionType(parameters: [.i32], results: [.i32]))
        typeIndexMap["(i32) -> i32"] = 1
        
        module.types.append(WASMFunctionType(parameters: [.i32, .i32], results: [.i32]))
        typeIndexMap["(i32, i32) -> i32"] = 2
        
        module.types.append(WASMFunctionType(parameters: [], results: []))
        typeIndexMap["() -> void"] = 3
        
        module.types.append(WASMFunctionType(parameters: [.i32], results: []))
        typeIndexMap["(i32) -> void"] = 4
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
            ("CreateLight", "CreateLight", [], [.i32]),
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
            ("PositionEntity", "PositionEntity", [.i32, .f32, .f32, .f32, .i32], []),
            ("RotateEntity", "RotateEntity", [.i32, .f32, .f32, .f32, .i32], []),
            ("ScaleEntity", "ScaleEntity", [.i32, .f32, .f32, .f32], []),
            ("MoveEntity", "MoveEntity", [.i32, .f32, .f32, .f32], []),
            ("TurnEntity", "TurnEntity", [.i32, .f32, .f32, .f32, .i32], []),
            ("EntityTexture", "EntityTexture", [.i32, .i32, .i32, .i32], []),
            ("LoadTexture", "LoadTexture", [.i32, .i32], [.i32]),
            ("LoadAsset", "LoadAsset", [.i32], [.i32]),
            ("GetAssetData", "GetAssetData", [.i32], [.i32]),
            ("GetAssetSize", "GetAssetSize", [.i32], [.i32]),
            ("LoadMesh", "LoadMesh", [.i32, .i32], [.i32]),
            ("CreateMesh", "CreateMesh", [.i32], [.i32]),
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
            ("FSOUND_Close", "FSOUND_Close", [], [])
        ]
        
        for (name, internalName, params, results) in imports {
            let type = WASMFunctionType(parameters: params, results: results)
            let typeIdx = module.types.count
            module.types.append(type)
            
            let importIdx = module.imports.count
            module.imports.append(WASMImport(module: "env", name: name, kind: .function, index: typeIdx))
            
            functionIndexMap[internalName] = importIdx
            importDefinitions[internalName] = ImportDefinition(params: params, results: results)
            
            if name == "PrintInt" {
                functionIndexMap["Print"] = importIdx
                importDefinitions["Print"] = ImportDefinition(params: params, results: results)
            }
        }
    }
    
    private mutating func processTypeDeclarations(_ types: [TypeNode]) {
        for typeNode in types {
            var offset = 8
            var typeFieldOffsets: [String: Int] = [:]
            var typeFieldTypes: [String: String] = [:]
            typeFieldOffsets["__prev"] = 0
            typeFieldOffsets["__next"] = 4
            fieldOffsets[typeNode.name] = [:]
            
            for field in typeNode.fields {
                let fieldWasmType = typeHandling.typeInfo(from: field.type?.rawValue ?? "Int").wasmType
                let fieldSize = typeSize(for: fieldWasmType)
                if offset % fieldSize != 0 {
                    offset = ((offset / fieldSize) + 1) * fieldSize
                }
                fieldOffsets[typeNode.name]?[field.name] = offset
                typeFieldOffsets[field.name] = offset
                typeFieldTypes[field.name] = field.type?.rawValue ?? "Int"
                offset += fieldSize
            }
            
            userTypes[typeNode.name] = UserTypeInfo(
                fieldOffsets: typeFieldOffsets,
                fieldTypes: typeFieldTypes,
                instanceSize: offset
            )
        }
    }
    
    private mutating func setupUserTypeGlobals(_ types: [TypeNode]) {
        if !types.isEmpty {
            let typeCollectionGlobalVar = WASMGlobal(type: .i32, mutability: true, initExpr: .i32Const(65536))
            typeCollectionGlobal = module.globals.count
            module.globals.append(typeCollectionGlobalVar)
            
            scratchGlobal = module.globals.count
            module.globals.append(WASMGlobal(type: .i32, mutability: true, initExpr: .i32Const(0)))
            scratchGlobal2 = module.globals.count
            module.globals.append(WASMGlobal(type: .i32, mutability: true, initExpr: .i32Const(0)))
        }
    }
    
    private mutating func processGlobalDeclarations(_ statements: [StatementNode]) {
        for statement in statements {
            if case .global(let decl) = statement {
                for variable in decl.variables {
                    let wasmType = typeHandling.typeInfo(from: variable.typeSuffix).wasmType
                    let global = WASMGlobal(type: wasmType, mutability: true, initExpr: .i32Const(0))
                    let globalIdx = module.globals.count
                    module.globals.append(global)
                    variableManagement.registerGlobal(variable.name, type: wasmType, typeName: variable.typeName)
                    module.exports.append(WASMExport(name: variable.name, kind: .global, index: globalIdx))
                }
            }
        }
    }
    
    private mutating func collectDataStatements(_ statements: [StatementNode], label: String? = nil) {
        var currentLabel = label
        for statement in statements {
            switch statement {
            case .label(let name):
                currentLabel = name
            case .data(let values):
                let block = DataBlock(label: currentLabel, values: values, offset: currentDataOffset)
                dataStatements.append(block)
                if let lbl = currentLabel {
                    dataOffsetMap[lbl] = currentDataOffset
                }
                for value in values {
                    switch value {
                    case .integer: currentDataOffset += 4
                    case .float: currentDataOffset += 4
                    case .string(let str): currentDataOffset += str.utf8.count + 1
                    }
                }
            case .function(let funcNode):
                collectDataStatements(funcNode.body, label: nil)
            case .ifStatement(let ifNode):
                collectDataStatements(ifNode.thenBranch, label: currentLabel)
                for (_, elseBranch) in ifNode.elseIfs {
                    collectDataStatements(elseBranch, label: currentLabel)
                }
                collectDataStatements(ifNode.elseBranch, label: currentLabel)
            case .whileLoop(let whileNode):
                collectDataStatements(whileNode.body, label: currentLabel)
            case .forLoop(let forNode):
                collectDataStatements(forNode.body, label: currentLabel)
            case .forEach(let forEachNode):
                collectDataStatements(forEachNode.body, label: currentLabel)
            case .repeatLoop(let repeatNode):
                collectDataStatements(repeatNode.body, label: currentLabel)
            case .select(let selectNode):
                for caseNode in selectNode.cases {
                    collectDataStatements(caseNode.body, label: currentLabel)
                }
                if let defaultCase = selectNode.defaultCase {
                    collectDataStatements(defaultCase, label: currentLabel)
                }
            default:
                break
            }
        }
    }
    
    private mutating func serializeDataSection() {
        var dataOffset = 256
        for block in dataStatements {
            for value in block.values {
                switch value {
                case .integer(let intVal):
                    let bytes = intVal.toBytes()
                    let data = WASMData(memoryIndex: 0, offset: .i32Const(Int32(dataOffset)), bytes: bytes)
                    module.data.append(data)
                    dataOffset += 4
                case .float(let floatVal):
                    let bytes = floatVal.toBytes()
                    let data = WASMData(memoryIndex: 0, offset: .i32Const(Int32(dataOffset)), bytes: bytes)
                    module.data.append(data)
                    dataOffset += 4
                case .string(let str):
                    var bytes: [UInt8] = []
                    for char in str.utf8 {
                        bytes.append(char)
                    }
                    bytes.append(0)
                    let data = WASMData(memoryIndex: 0, offset: .i32Const(Int32(dataOffset)), bytes: bytes)
                    module.data.append(data)
                    dataOffset += bytes.count
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
        
        let typeIdx = typeIndexMap["() -> void"] ?? 3
        var mainFunction = WASMFunction(typeIndex: typeIdx)
        variableManagement.clearLocals()
        
        for statement in statements {
            generateStatement(statement, function: &mainFunction)
        }
        
        mainFunction.body.append(.return)
        
        let funcIdx = module.imports.count + module.functions.count
        module.code.append(mainFunction)
        module.functions.append(typeIdx)
        
        functionIndexMap["_main"] = funcIdx
        module.exports.append(WASMExport(name: "Main", kind: .function, index: funcIdx))
    }
    
    private mutating func generateStatement(_ statement: StatementNode, function: inout WASMFunction) {
        switch statement {
        case .local(let decl):
            for id in decl.variables {
                let wasmType = typeHandling.typeInfo(from: id.typeSuffix).wasmType
                let info = variableManagement.registerLocal(id.name, type: wasmType, typeName: id.typeName)
                function.locals.append(wasmType)
            }
            
        case .global:
            break
            
        case .constant, .constants:
            break
            
        case .dim(let decl):
            var dims: [Int] = []
            for dimExpr in decl.dimensions {
                if case .integerLiteral(let value) = dimExpr {
                    dims.append(value)
                }
            }
            let wasmType = typeHandling.typeInfo(from: decl.typeName ?? "Int").wasmType
            variableManagement.registerArray(decl.name, elementType: wasmType, dimensions: dims)
            
        case .assignment(let assign):
            let valueInstrs = expressionGenerator.generate(assign.value)
            let valueType = expressionGenerator.generateWithInfo(assign.value).type
            let targetTypeName = getTypeName(from: assign.target)
            
            var finalInstrs = valueInstrs
            if targetTypeName == "String" && valueType != .i32 {
                if valueType == .f32 {
                    if let funcIdx = functionIndexMap["FloatToString"] { finalInstrs.append(.call(funcIdx)) }
                } else {
                    if let funcIdx = functionIndexMap["IntToString"] { finalInstrs.append(.call(funcIdx)) }
                }
            }
            
            switch assign.target {
            case .identifier(let id):
                if let local = variableManagement.localInfo(for: id.name) {
                    function.body.append(contentsOf: finalInstrs)
                    function.body.append(.localSet(local.index))
                } else if let global = variableManagement.globalInfo(for: id.name) {
                    function.body.append(contentsOf: finalInstrs)
                    function.body.append(.globalSet(global.index))
                }
            case .arrayAccess(let access):
                if case .identifier(let arrayId) = access.array,
                   let array = variableManagement.arrayInfo(for: arrayId.name) {
                    var offset = 0
                    for (i, indexExpr) in access.indices.enumerated() {
                        let indexInstrs = expressionGenerator.generate(indexExpr)
                        function.body.append(contentsOf: indexInstrs)
                        offset += i * array.elementSize
                    }
                    function.body.append(.i32Const(Int32(offset)))
                    function.body.append(.i32Add)
                    function.body.append(contentsOf: finalInstrs)
                    function.body.append(.i32Store(2, 0))
                }
            case .fieldAccess(let access):
                let objInstrs = expressionGenerator.generate(access.object)
                function.body.append(contentsOf: objInstrs)
                if let typeName = getTypeName(from: access.object),
                   let fieldOffset = fieldOffsets[typeName]?[access.field] {
                    function.body.append(.i32Const(Int32(fieldOffset)))
                    function.body.append(.i32Add)
                    function.body.append(contentsOf: finalInstrs)
                    function.body.append(.i32Store(2, 0))
                }
            default:
                break
            }
            
        case .functionCall(let call):
            if let funcIdx = functionIndexMap[call.name] {
                var instrs: [WASMInstruction] = []
                var expectedParams: [WASMType]? = nil
                if let importDef = importDefinitions[call.name] {
                    expectedParams = importDef.params
                }
                
                for (i, arg) in call.arguments.enumerated() {
                    let argInfo = expressionGenerator.generateWithInfo(arg)
                    instrs.append(contentsOf: argInfo.instrs)
                    if let params = expectedParams, i < params.count {
                        let expected = params[i]
                        if argInfo.type == .i32 && expected == .f32 {
                            instrs.append(.f32ConvertI32S)
                        } else if argInfo.type == .f32 && expected == .i32 {
                            instrs.append(.i32TruncF32S)
                        }
                    }
                }
                instrs.append(.call(funcIdx))
                if let importDef = importDefinitions[call.name], !importDef.results.isEmpty {
                    instrs.append(.drop)
                }
                function.body.append(contentsOf: instrs)
            } else if variableManagement.hasGlobal(call.name) {
                let arrayAccess = ArrayAccessNode(array: .identifier(IdentifierNode(name: call.name)), indices: call.arguments)
                let info = expressionGenerator.generateWithInfo(.arrayAccess(arrayAccess))
                function.body.append(contentsOf: info.instrs)
                function.body.append(.drop)
            }
            
        case .ifStatement(let ifNode):
            let condInstrs = expressionGenerator.generate(ifNode.condition)
            function.body.append(contentsOf: condInstrs)
            
            let thenBody = generateStatementBlock(ifNode.thenBranch, function: &function)
            var elseBody: [WASMInstruction]? = nil
            if !ifNode.elseBranch.isEmpty {
                elseBody = generateStatementBlock(ifNode.elseBranch, function: &function)
            }
            function.body.append(.if(.void, thenBody, elseBody))
            
        case .whileLoop(let whileNode):
            let loopStart = function.body.count
            let condInstrs = expressionGenerator.generate(whileNode.condition)
            function.body.append(contentsOf: condInstrs)
            function.body.append(.i32EqZ)
            function.body.append(.brIf(1))
            generateStatementBlock(whileNode.body, function: &function)
            function.body.append(.br(0))
            
        case .forLoop(let forNode):
            if let local = variableManagement.localInfo(for: forNode.variable.name) {
                let startInstrs = expressionGenerator.generate(forNode.startValue)
                function.body.append(contentsOf: startInstrs)
                function.body.append(.localSet(local.index))
                
                let loopStart = function.body.count
                function.body.append(.localGet(local.index))
                let endInstrs = expressionGenerator.generate(forNode.endValue)
                function.body.append(contentsOf: endInstrs)
                function.body.append(.i32GtS)
                function.body.append(.brIf(1))
                
                generateStatementBlock(forNode.body, function: &function)
                
                function.body.append(.localGet(local.index))
                if let stepExpr = forNode.stepValue {
                    let stepInstrs = expressionGenerator.generate(stepExpr)
                    function.body.append(contentsOf: stepInstrs)
                } else {
                    function.body.append(.i32Const(1))
                }
                function.body.append(.i32Add)
                function.body.append(.localSet(local.index))
                function.body.append(.br(0))
            }
            
        case .forEach(let forEachNode):
            let loopStart = function.body.count
            function.body.append(.localGet(0))
            function.body.append(.i32EqZ)
            function.body.append(.brIf(1))
            function.body.append(.localTee(1))
            generateStatementBlock(forEachNode.body, function: &function)
            function.body.append(.localGet(0))
            function.body.append(.call(0))
            function.body.append(.localSet(0))
            function.body.append(.br(0))
            
        case .repeatLoop(let repeatNode):
            let loopStart = function.body.count
            generateStatementBlock(repeatNode.body, function: &function)
            let condInstrs = expressionGenerator.generate(repeatNode.condition)
            function.body.append(contentsOf: condInstrs)
            function.body.append(.i32EqZ)
            function.body.append(.brIf(0))
            
        case .select(let selectNode):
            for caseNode in selectNode.cases {
                generateStatementBlock(caseNode.body, function: &function)
                function.body.append(.br(0))
            }
            if let defaultCase = selectNode.defaultCase {
                generateStatementBlock(defaultCase, function: &function)
            }
            
        case .returnStatement(let expr):
            if let returnExpr = expr {
                let returnInstrs = expressionGenerator.generate(returnExpr)
                function.body.append(contentsOf: returnInstrs)
            }
            function.body.append(.return)
            
        case .exit:
            function.body.append(.br(0))
            
        case .goto(let labelName):
            if gotoStateLocalIdx >= 0, let stateNum = labelStateMap[labelName] {
                function.body.append(.i32Const(Int32(stateNum)))
                function.body.append(.localSet(gotoStateLocalIdx))
                function.body.append(.nop)
            } else {
                function.body.append(.nop)
            }
            
        case .gosub(let labelName):
            if gotoStateLocalIdx >= 0, let stateNum = labelStateMap[labelName] {
                function.body.append(.i32Const(Int32(stateNum)))
                function.body.append(.localSet(gotoStateLocalIdx))
                function.body.append(.nop)
            } else {
                function.body.append(.nop)
            }
            
        case .label:
            break
            
        case .function, .data, .read, .restore, .delete, .insert, .empty, .typeDeclaration:
            break
        }
    }
    
    private mutating func generateStatementBlock(_ statements: [StatementNode], function: inout WASMFunction) -> [WASMInstruction] {
        let startCount = function.body.count
        for statement in statements {
            generateStatement(statement, function: &function)
        }
        return Array(function.body[startCount...])
    }
    
    private mutating func generateFunction(_ functionNode: FunctionNode) {
        let typeSignature = functionSignature(for: functionNode)
        let typeIdx = typeIndexMap[typeSignature] ?? 0
        
        var function = WASMFunction(typeIndex: typeIdx)
        variableManagement.clearLocals()
        
        labelStateMap = [:]
        gotoStateLocalIdx = -1
        hasGotoInCurrentFunction = false
        
        let (labels, hasGoto) = collectLabelsAndGotos(functionNode.body)
        hasGotoInCurrentFunction = hasGoto
        
        if hasGoto && !labels.isEmpty {
            var stateNum = 1
            for label in labels.sorted() {
                labelStateMap[label] = stateNum
                stateNum += 1
            }
            gotoStateLocalIdx = function.locals.count
            function.locals.append(.i32)
        }
        
        for (index, param) in functionNode.parameters.enumerated() {
            function.locals.append(.i32)
            let paramType = typeHandling.typeInfo(from: param.type?.rawValue ?? "Int")
            let localIdx = index + (hasGotoInCurrentFunction && !labels.isEmpty ? 1 : 0)
            variableManagement.registerLocal(param.name, type: paramType.wasmType, typeName: param.type?.rawValue)
            if var info = variableManagement.localInfo(for: param.name) {
                let newInfo = LocalInfo(index: localIdx, type: info.type, typeName: info.typeName, dimensions: info.dimensions)
                variableManagement.registerLocal(param.name, type: info.type, typeName: info.typeName)
            }
        }
        
        for statement in functionNode.body {
            generateStatement(statement, function: &function)
        }
        
        ensureReturn(function: &function, returnType: functionNode.returnType)
        
        let localFuncIdx = module.code.count
        let globalFuncIdx = module.imports.count + localFuncIdx
        
        module.code.append(function)
        module.functions.append(typeIdx)
        
        functionIndexMap[functionNode.name] = globalFuncIdx
        module.exports.append(WASMExport(name: functionNode.name, kind: .function, index: globalFuncIdx))
    }
    
    private func functionSignature(for function: FunctionNode) -> String {
        let paramTypes = function.parameters.map { _ in "i32" }
        let returnType = function.returnType?.rawValue ?? "void"
        return "(\(paramTypes.joined(separator: ", "))) -> \(returnType)"
    }
    
    private mutating func ensureReturn(function: inout WASMFunction, returnType: TypeAnnotation?) {
        if function.body.last == .return { return }
        
        let returnWasmType = typeHandling.typeInfo(from: returnType?.rawValue ?? "void").wasmType
        switch returnWasmType {
        case .i32, .i64: function.body.append(.i32Const(0))
        case .f32: function.body.append(.f32Const(0))
        case .f64: function.body.append(.f64Const(0))
        default: break
        }
        function.body.append(.return)
    }
    
    private func collectLabelsAndGotos(_ statements: [StatementNode]) -> (labels: Set<String>, hasGoto: Bool) {
        var labels: Set<String> = []
        var hasGoto = false
        
        for statement in statements {
            switch statement {
            case .label(let name):
                labels.insert(name)
            case .goto, .gosub:
                hasGoto = true
            case .ifStatement(let ifNode):
                let thenLabels = collectLabelsAndGotos(ifNode.thenBranch)
                labels.formUnion(thenLabels.labels)
                hasGoto = hasGoto || thenLabels.hasGoto
                for (_, elseBranch) in ifNode.elseIfs {
                    let elseIfLabels = collectLabelsAndGotos(elseBranch)
                    labels.formUnion(elseIfLabels.labels)
                    hasGoto = hasGoto || elseIfLabels.hasGoto
                }
                let elseLabels = collectLabelsAndGotos(ifNode.elseBranch)
                labels.formUnion(elseLabels.labels)
                hasGoto = hasGoto || elseLabels.hasGoto
            case .whileLoop(let whileNode):
                let loopLabels = collectLabelsAndGotos(whileNode.body)
                labels.formUnion(loopLabels.labels)
                hasGoto = hasGoto || loopLabels.hasGoto
            case .forLoop(let forNode):
                let forLabels = collectLabelsAndGotos(forNode.body)
                labels.formUnion(forLabels.labels)
                hasGoto = hasGoto || forLabels.hasGoto
            case .forEach(let forEachNode):
                let eachLabels = collectLabelsAndGotos(forEachNode.body)
                labels.formUnion(eachLabels.labels)
                hasGoto = hasGoto || eachLabels.hasGoto
            case .repeatLoop(let repeatNode):
                let repeatLabels = collectLabelsAndGotos(repeatNode.body)
                labels.formUnion(repeatLabels.labels)
                hasGoto = hasGoto || repeatLabels.hasGoto
            case .select(let selectNode):
                let selectLabels = collectLabelsAndGotos(selectNode.cases.flatMap { $0.body })
                labels.formUnion(selectLabels.labels)
                hasGoto = hasGoto || selectLabels.hasGoto
                if let defaultCase = selectNode.defaultCase {
                    let defaultLabels = collectLabelsAndGotos(defaultCase)
                    labels.formUnion(defaultLabels.labels)
                    hasGoto = hasGoto || defaultLabels.hasGoto
                }
            default:
                break
            }
        }
        
        return (labels, hasGoto)
    }
    
    private mutating func addAllocFunction() {
        let allocType = WASMFunctionType(parameters: [.i32], results: [.i32])
        let allocIdx = module.types.count
        module.types.append(allocType)
        
        let allocFunc = WASMFunction(
            typeIndex: allocIdx,
            locals: [.i32],
            body: [.localGet(0), .memoryGrow]
        )
        
        let funcIdx = module.imports.count + module.functions.count
        
        module.code.append(allocFunc)
        module.functions.append(allocIdx)
        
        functionIndexMap["__Alloc"] = funcIdx
        module.exports.append(WASMExport(name: "__Alloc", kind: .function, index: funcIdx))
    }
    
    private func getTypeName(from expr: ExpressionNode) -> String? {
        switch expr {
        case .identifier(let id):
            if let local = variableManagement.localInfo(for: id.name) {
                return local.typeName
            }
            if let global = variableManagement.globalInfo(for: id.name) {
                return global.typeName
            }
        case .fieldAccess(let access):
            if let objType = getTypeName(from: access.object),
               let fieldType = userTypes[objType]?.fieldTypes[access.field] {
                return fieldType
            }
        case .new(let type):
            return type
        case .first(let type):
            return type
        case .last(let type):
            return type
        case .before(let subExpr):
            return getTypeName(from: subExpr)
        case .after(let subExpr):
            return getTypeName(from: subExpr)
        case .objectCast(let type, _):
            return type
        default:
            break
        }
        return nil
    }
    
    private func typeSize(for wasmType: WASMType) -> Int {
        switch wasmType {
        case .i32, .f32:
            return 4
        case .i64, .f64:
            return 8
        default:
            return 4
        }
    }
}

extension Int {
    func toBytes() -> [UInt8] {
        return [
            UInt8((self >> 0) & 0xFF),
            UInt8((self >> 8) & 0xFF),
            UInt8((self >> 16) & 0xFF),
            UInt8((self >> 24) & 0xFF)
        ]
    }
}

extension Double {
    func toBytes() -> [UInt8] {
        let floatValue = Float(self)
        let intValue = floatValue.bitPattern
        return [
            UInt8((Int(intValue) >> 0) & 0xFF),
            UInt8((Int(intValue) >> 8) & 0xFF),
            UInt8((Int(intValue) >> 16) & 0xFF),
            UInt8((Int(intValue) >> 24) & 0xFF)
        ]
    }
}
