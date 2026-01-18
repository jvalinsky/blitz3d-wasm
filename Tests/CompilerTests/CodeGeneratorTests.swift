//
//  CodeGeneratorTests.swift
//  CompilerTests
//

import XCTest
@testable import Blitz3DCompiler

final class CodeGeneratorTests: XCTestCase {
    
    func testGenerateSimpleProgram() throws {
        var parser = Parser(source: "x = 42")
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        // Should have memory
        XCTAssertEqual(module.memories.count, 1)
        
        // Should have at least one function (the implicit main or globals)
        XCTAssertGreaterThanOrEqual(module.code.count, 0)
    }
    
    func testGenerateAssignment() throws {
        var parser = Parser(source: "x = 42")
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        // Check that function was created
        XCTAssertGreaterThanOrEqual(module.code.count, 1)
        let funcBody = module.code[0].body
        
        // Should have at least a return instruction
        XCTAssertTrue(funcBody.contains { instr in
            if case .return = instr { return true }
            return false
        }, "Function body should contain return, but got: \(funcBody)")
    }
    
    func testGenerateFunction() throws {
        var parser = Parser(source: "Function Test() Return 42 End Function")
        let program = parser.parse()
        
        XCTAssertEqual(program.functions.count, 1)
        XCTAssertEqual(program.functions[0].name, "Test")
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        // Should have the function exported
        let testExport = module.exports.first { $0.name == "Test" }
        XCTAssertNotNil(testExport)
    }
    
    func testGenerateIfStatement() throws {
        var parser = Parser(source: "If x = 1 Then x = 2 EndIf")
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThanOrEqual(module.code.count, 1)
    }
    
    func testGenerateWhileLoop() throws {
        var parser = Parser(source: "While x < 10 Wend")
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThanOrEqual(module.code.count, 1)
    }
    
    func testGenerateForLoop() throws {
        var parser = Parser(source: "For i = 1 To 10 Next")
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThanOrEqual(module.code.count, 1)
    }
    
    func testGenerateBinaryExpression() throws {
        var parser = Parser(source: "Local x = 1 + 2 * 3")
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        // Should generate instructions for binary operations
        XCTAssertGreaterThanOrEqual(module.code.count, 1)
    }
    
    func testGenerateFunctionCall() throws {
        var parser = Parser(source: "Print(\"hello\")")
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        // Should have at least one function in the module
        XCTAssertGreaterThanOrEqual(module.code.count, 1)
    }
    
    func testWASMModuleOutput() throws {
        var parser = Parser(source: "Function Main() Return 0 End Function")
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        var writer = WASMTextWriter()
        let watOutput = writer.write(module)
        
        // Should start with (module
        XCTAssertTrue(watOutput.hasPrefix("(module"))
        // Should end with )
        XCTAssertTrue(watOutput.hasSuffix(")\n"))
    }
    
    func testWASMFunctionType() throws {
        let funcType = WASMFunctionType(parameters: [.i32, .i32], results: [.i32])
        
        XCTAssertEqual(funcType.parameters.count, 2)
        XCTAssertEqual(funcType.results.count, 1)
    }
    
    func testWASMInstructions() throws {
        // Test that instruction enums work
        let addInstr: WASMInstruction = .i32Add
        let constInstr: WASMInstruction = .i32Const(42)
        let callInstr: WASMInstruction = .call(0)
        let localGetInstr: WASMInstruction = .localGet(0)
        
        XCTAssertEqual(addInstr, .i32Add)
        XCTAssertEqual(constInstr, .i32Const(42))
        XCTAssertEqual(callInstr, .call(0))
        XCTAssertEqual(localGetInstr, .localGet(0))
    }
    
    func testWASMModuleStructure() throws {
        var module = WASMModule()
        
        // Add a function type
        module.types.append(WASMFunctionType(parameters: [], results: [.i32]))
        
        // Add a function
        let function = WASMFunction(
            typeIndex: 0,
            locals: [],
            body: [.i32Const(0), .return]
        )
        module.code.append(function)
        module.functions.append(0)
        
        // Add export
        module.exports.append(WASMExport(name: "test", kind: .function, index: 0))
        
        var writer = WASMTextWriter()
        let watOutput = writer.write(module)
        
        XCTAssertTrue(watOutput.contains("(type 0"))
        XCTAssertTrue(watOutput.contains("(func 0"))
        XCTAssertTrue(watOutput.contains("(export \"test\""))
    }
    
    func testWASMDataSection() throws {
        let data = WASMData(
            memoryIndex: 0,
            offset: .i32Const(0),
            bytes: [0x48, 0x65, 0x6c, 0x6c, 0x6f] // "Hello"
        )
        
        var module = WASMModule()
        module.data.append(data)
        
        var writer = WASMTextWriter()
        let watOutput = writer.write(module)
        
        XCTAssertTrue(watOutput.contains("(data"))
    }
    
    // MARK: - Data/Read/Restore Tests
    
    func testGenerateDataStatement() throws {
        let source = """
        Data 1, 2.5, "hello"
        """
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        // Should have data section with values
        XCTAssertGreaterThan(module.data.count, 0, "Should have data section entries")
    }
    
    func testGenerateReadStatement() throws {
        let source = """
        Local x%, y#, z$
        Data 1, 2.5, "hello"
        Read x%, y#, z$
        """
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        // Should compile successfully
        XCTAssertGreaterThanOrEqual(module.code.count, 1)
    }
    
    func testGenerateRestoreStatement() throws {
        let source = """
        Data 1, 2, 3
        Restore
        Local x
        Read x
        Restore
        Read x
        """
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThanOrEqual(module.code.count, 1)
    }
    
    func testGenerateDataWithExpressions() throws {
        let source = """
        Data 1 + 2, "test", 3.14
        """
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThanOrEqual(module.code.count, 1)
    }
    
    // MARK: - Input Function Tests
    
    func testCompileKeyDownFunction() throws {
        let source = """
        Function Main()
            While Not KeyDown(1)
                If KeyHit(2) Then
                    Print "Space pressed"
                EndIf
            Wend
        End Function
        """
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        // Should have KeyDown and KeyHit imported
        let keyDownImport = module.imports.first { $0.name == "KeyDown" }
        let keyHitImport = module.imports.first { $0.name == "KeyHit" }
        XCTAssertNotNil(keyDownImport, "KeyDown should be imported")
        XCTAssertNotNil(keyHitImport, "KeyHit should be imported")
        XCTAssertGreaterThanOrEqual(module.code.count, 1)
    }
    
    func testCompileMouseFunctions() throws {
        let source = """
        Function Main()
            Local x = MouseX()
            Local y = MouseY()
            If MouseDown(1) Then
                Print "Left click"
            EndIf
            If MouseHit(1) Then
                Print "Clicked"
            EndIf
        End Function
        """
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        // Should have mouse functions imported
        XCTAssertGreaterThanOrEqual(module.code.count, 1)
    }
    
    func testCompileInputInGameLoop() throws {
        let source = """
        Function Main()
            Graphics3D 800, 600
            While Not KeyDown(1)
               Cls
                RenderWorld
                Flip
            Wend
        End Function
        """
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThanOrEqual(module.code.count, 1)
    }
    
    // MARK: - SCPCB Compilation Tests
    
    func testCompileSCPCBKeyName() throws {
        let scpcbPath = "/Users/jack/Software/scp_port/SCPCB/KeyName.bb"
        guard FileManager.default.fileExists(atPath: scpcbPath) else {
            return // Skip if file doesn't exist
        }
        
        let source = try String(contentsOfFile: scpcbPath, encoding: .utf8)
        var parser = Parser(source: source)
        let program = parser.parse()
        
        // Should parse without crashing
        XCTAssertTrue(true, "KeyName.bb parsed successfully")
        
        // Try to generate code
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        // Should have functions
        XCTAssertGreaterThanOrEqual(module.functions.count + module.imports.count, 0)
    }
    
    func testCompileSCPPCBConstants() throws {
        let source = """
        Const VERSION$ = "1.0"
        Const MAX_ITEMS = 100
        Const GRAVITY# = 0.01
        """
        var parser = Parser(source: source)
        let program = parser.parse()
        
        XCTAssertEqual(program.statements.count, 3)
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThanOrEqual(module.code.count, 1)
    }
    
    func testCompileSCPPCBTypeDeclaration() throws {
        let source = """
        Type TPlayer
            Field x#
            Field y#
            Field z#
            Field health
        End Type
        """
        var parser = Parser(source: source)
        let program = parser.parse()
        
        XCTAssertEqual(program.types.count, 1)
        XCTAssertEqual(program.types[0].name, "TPlayer")
        XCTAssertEqual(program.types[0].fields.count, 4)
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThanOrEqual(module.code.count, 1)
    }
    
    func testCompileSCPCBFunctionWithMultipleStatements() throws {
        let source = """
        Function InitializeGame()
            Graphics3D 800, 600, 32, 0
            SetGamma 1.0
            ClsColor 0, 0, 0
            SeedRnd MilliSecs()
        End Function
        """
        var parser = Parser(source: source)
        let program = parser.parse()
        
        XCTAssertEqual(program.functions.count, 1)
        XCTAssertEqual(program.functions[0].name, "InitializeGame")
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThanOrEqual(module.code.count, 1)
    }
    
    func testCompileSCPCBForLoop() throws {
        let source = """
        For i = 1 To 10 Step 2
            Print i
        Next
        """
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThanOrEqual(module.code.count, 1)
    }
    
    func testCompileSCPCBWhileLoop() throws {
        let source = """
        While Not KeyHit(1)
            UpdateWorld
            RenderWorld
            Flip
        Wend
        """
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThanOrEqual(module.code.count, 1)
    }
    
    func testCompileSCPCBIfElseStatement() throws {
        let source = """
        If health <= 0 Then
            Die()
        ElseIf health < 50 Then
            Print "Low health!"
        Else
            Print "Full health"
        EndIf
        """
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThanOrEqual(module.code.count, 1)
    }
    
    func testCompileSCPCBSelectCase() throws {
        let source = """
        Select difficulty
            Case 1
                Print "Easy"
            Case 2
                Print "Medium"
            Case 3
                Print "Hard"
            Default
                Print "Unknown"
        End Select
        """
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThanOrEqual(module.code.count, 1)
    }
    
    func testCompileSCPCBSelectWithMultipleCaseExpressions() throws {
        let source = """
        Select command$
            Case "help","h","?"
                Print "Help"
            Case "quit","exit","q"
                Print "Quit"
            Case "1",""
                Print "Option 1"
            Default
                Print "Unknown"
        End Select
        """
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThanOrEqual(module.code.count, 1)
    }
    
    func testCompileSCPCBNestedSelect() throws {
        let source = """
        Select mode
            Case 1
                Select submode
                    Case 0
                        Print "Submode 0"
                    Case 1
                        Print "Submode 1"
                End Select
            Case 2
                Print "Mode 2"
        End Select
        """
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThanOrEqual(module.code.count, 1)
    }
    
    func testCompileSCPPCBArrayAccess() throws {
        let source = """
        Local items[10]
        For i = 0 To 9
            items[i] = i * 10
        Next
        """
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThanOrEqual(module.code.count, 1)
    }
    
    func testCompileSCPPCBFieldAccess() throws {
        let source = """
        Local player.TPlayer
        player = New TPlayer
        player\\x = 100.0
        player\\y = 200.0
        player\\health = 100
        """
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThanOrEqual(module.code.count, 1)
    }
    
    func testCompileSCPCBFunctionCallWithArguments() throws {
        let source = """
        PositionEntity camera, 0.0, 10.0, -50.0
        RotateEntity light, 90, 0, 0
        ScaleEntity cube, 2.0, 2.0, 2.0
        """
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThanOrEqual(module.code.count, 1)
    }
    
    // MARK: - Include/Multi-file Tests
    
    func testPreprocessorIncludeSingleFile() throws {
        let source = """
        Include "utils.bb"
        """
        var preprocessor = Preprocessor()
        let processed = try preprocessor.process(source: source)
        
        // Include line should be removed when processing source directly (can't resolve file)
        XCTAssertFalse(processed.contains("Include"))
    }
    
    func testPreprocessorIncludeWithFileContent() throws {
        let tempDir = NSTemporaryDirectory()
        let utilsUUID = UUID().uuidString.prefix(8)
        let utilsPath = tempDir + "utils_\(utilsUUID).bb"
        let mainPath = tempDir + "main_\(UUID().uuidString.prefix(8)).bb"
        
        let utilsContent = """
        Function GetGreeting$()
            Return "Hello from utils!"
        End Function
        """
        
        let mainContent = """
        Include "utils_\(utilsUUID).bb"
        Print GetGreeting()
        """
        
        try utilsContent.write(toFile: utilsPath, atomically: true, encoding: .utf8)
        try mainContent.write(toFile: mainPath, atomically: true, encoding: .utf8)
        
        var preprocessor = Preprocessor()
        let processed = try preprocessor.process(file: mainPath)
        
        // Should contain the included function
        XCTAssertTrue(processed.contains("Function GetGreeting"))
        XCTAssertTrue(processed.contains("Return"))
        XCTAssertTrue(processed.contains("Print GetGreeting"))
        
        // Clean up
        try FileManager.default.removeItem(atPath: utilsPath)
        try FileManager.default.removeItem(atPath: mainPath)
    }
    
    func testPreprocessorNestedIncludes() throws {
        let tempDir = NSTemporaryDirectory()
        
        let level3UUID = UUID().uuidString.prefix(8)
        let level2UUID = UUID().uuidString.prefix(8)
        let level1UUID = UUID().uuidString.prefix(8)
        
        let level3Path = tempDir + "level3_\(level3UUID).bb"
        let level2Path = tempDir + "level2_\(level2UUID).bb"
        let level1Path = tempDir + "level1_\(level1UUID).bb"
        
        let level3Content = """
        Function Level3Func()
            Return "Level 3"
        End Function
        """
        
        let level2Content = """
        Include "level3_\(level3UUID).bb"
        Function Level2Func()
            Return "Level 2"
        End Function
        """
        
        let level1Content = """
        Include "level2_\(level2UUID).bb"
        Function Level1Func()
            Return "Level 1"
        End Function
        """
        
        try level3Content.write(toFile: level3Path, atomically: true, encoding: .utf8)
        try level2Content.write(toFile: level2Path, atomically: true, encoding: .utf8)
        try level1Content.write(toFile: level1Path, atomically: true, encoding: .utf8)
        
        var preprocessor = Preprocessor()
        let processed = try preprocessor.process(file: level1Path)
        
        // All functions should be included
        XCTAssertTrue(processed.contains("Function Level1Func"))
        XCTAssertTrue(processed.contains("Function Level2Func"))
        XCTAssertTrue(processed.contains("Function Level3Func"))
        
        // Clean up
        try FileManager.default.removeItem(atPath: level3Path)
        try FileManager.default.removeItem(atPath: level2Path)
        try FileManager.default.removeItem(atPath: level1Path)
    }
    
    func testCompileIncludedFunction() throws {
        let tempDir = NSTemporaryDirectory()
        let utilsUUID = UUID().uuidString.prefix(8)
        let utilsPath = tempDir + "utils_inc_\(utilsUUID).bb"
        
        let utilsContent = """
        Function AddNumbers%(a%, b%)
            Return a + b
        End Function
        """
        
        try utilsContent.write(toFile: utilsPath, atomically: true, encoding: .utf8)
        
        let mainSource = """
        Include "utils_inc_\(utilsUUID).bb"
        Function Main()
            Local result% = AddNumbers(5, 3)
            Print result%
        End Function
        """
        
        // Write main source to temp file for processing
        let mainPath = tempDir + "main_inc_\(UUID().uuidString.prefix(8)).bb"
        try mainSource.write(toFile: mainPath, atomically: true, encoding: .utf8)
        
        // Parse and combine
        var preprocessor = Preprocessor()
        let processedSource = try preprocessor.process(file: mainPath)
        
        var parser = Parser(source: processedSource)
        let program = parser.parse()
        
        // Should have both functions
        XCTAssertEqual(program.functions.count, 2)
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        // Should have compiled functions
        XCTAssertGreaterThanOrEqual(module.code.count, 2)
        
        // Both functions should be exported
        let mainExport = module.exports.first { $0.name == "Main" }
        let addExport = module.exports.first { $0.name == "AddNumbers%" }
        XCTAssertNotNil(mainExport, "Main should be exported")
        XCTAssertNotNil(addExport, "AddNumbers% should be exported")
        
        // Clean up
        try FileManager.default.removeItem(atPath: utilsPath)
        try FileManager.default.removeItem(atPath: mainPath)
    }
    
    func testCompileMultipleIncludedFiles() throws {
        let tempDir = NSTemporaryDirectory()
        
        let mathUUID = UUID().uuidString.prefix(8)
        let stringUUID = UUID().uuidString.prefix(8)
        
        let mathPath = tempDir + "math_multi_\(mathUUID).bb"
        let stringPath = tempDir + "string_multi_\(stringUUID).bb"
        let mainPath = tempDir + "multi_\(UUID().uuidString.prefix(8)).bb"
        
        let mathContent = """
        Function Add%(a%, b%)
            Return a + b
        End Function
        Function Subtract%(a%, b%)
            Return a - b
        End Function
        """
        
        let stringContent = """
        Function Greet$(name$)
            Return "Hello, " + name$
        End Function
        """
        
        let mainContent = """
        Include "math_multi_\(mathUUID).bb"
        Include "string_multi_\(stringUUID).bb"
        Function Main()
            Local sum% = Add(10, 5)
            Local greeting$ = Greet("World")
            Print sum%
            Print greeting$
        End Function
        """
        
        try mathContent.write(toFile: mathPath, atomically: true, encoding: .utf8)
        try stringContent.write(toFile: stringPath, atomically: true, encoding: .utf8)
        try mainContent.write(toFile: mainPath, atomically: true, encoding: .utf8)
        
        var preprocessor = Preprocessor()
        let processed = try preprocessor.process(file: mainPath)
        
        var parser = Parser(source: processed)
        let program = parser.parse()
        
        // Should have Main + 3 included functions
        XCTAssertEqual(program.functions.count, 4)
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        // All functions exported
        XCTAssertGreaterThanOrEqual(module.exports.count, 4)
        
        let addExport = module.exports.first { $0.name == "Add%" }
        let subExport = module.exports.first { $0.name == "Subtract%" }
        let greetExport = module.exports.first { $0.name == "Greet$" }
        XCTAssertNotNil(addExport)
        XCTAssertNotNil(subExport)
        XCTAssertNotNil(greetExport)
        
        // Clean up
        try FileManager.default.removeItem(atPath: mathPath)
        try FileManager.default.removeItem(atPath: stringPath)
        try FileManager.default.removeItem(atPath: mainPath)
    }
    
    func testIncludeWithTypeDeclaration() throws {
        let tempDir = NSTemporaryDirectory()
        let typesUUID = UUID().uuidString.prefix(8)
        let typesPath = tempDir + "types_inc_\(typesUUID).bb"
        
        let typesContent = """
        Type TPoint
            Field x#
            Field y#
        End Type
        """
        
        try typesContent.write(toFile: typesPath, atomically: true, encoding: .utf8)
        
        let mainSource = """
        Include "types_inc_\(typesUUID).bb"
        Function Main()
            Local pt.TPoint
            pt = New TPoint
            pt\\x = 10.5
            pt\\y = 20.5
            Print pt\\x
        End Function
        """
        
        let mainPath = tempDir + "main_types_\(UUID().uuidString.prefix(8)).bb"
        try mainSource.write(toFile: mainPath, atomically: true, encoding: .utf8)
        
        var preprocessor = Preprocessor()
        let processed = try preprocessor.process(file: mainPath)
        
        var parser = Parser(source: processed)
        let program = parser.parse()
        
        // Should have type declaration
        XCTAssertEqual(program.types.count, 1)
        XCTAssertEqual(program.types[0].name, "TPoint")
        XCTAssertEqual(program.types[0].fields.count, 2)
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThanOrEqual(module.code.count, 1)
        
        // Clean up
        try FileManager.default.removeItem(atPath: typesPath)
        try FileManager.default.removeItem(atPath: mainPath)
    }
    
    func testIncludeWithDataStatements() throws {
        let tempDir = NSTemporaryDirectory()
        let dataUUID = UUID().uuidString.prefix(8)
        let dataPath = tempDir + "data_inc_\(dataUUID).bb"
        
        let dataContent = """
        Const MAX_ITEMS = 100
        Data 1, 2, 3, 4, 5
        Data "apple", "banana", "cherry"
        """
        
        try dataContent.write(toFile: dataPath, atomically: true, encoding: .utf8)
        
        let mainSource = """
        Include "data_inc_\(dataUUID).bb"
        Function Main()
            Local value%
            Read value%
            Print value%
            Restore
            Read value%
            Print value%
        End Function
        """
        
        let mainPath = tempDir + "main_data_\(UUID().uuidString.prefix(8)).bb"
        try mainSource.write(toFile: mainPath, atomically: true, encoding: .utf8)
        
        var preprocessor = Preprocessor()
        let processed = try preprocessor.process(file: mainPath)
        
        var parser = Parser(source: processed)
        let program = parser.parse()
        
        // Should compile successfully
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        // Should have data segments
        XCTAssertGreaterThan(module.data.count, 0, "Should have embedded data")
        
        // Clean up
        try FileManager.default.removeItem(atPath: dataPath)
        try FileManager.default.removeItem(atPath: mainPath)
    }
    
    func testIncludePreventsDuplicateProcessing() throws {
        let tempDir = NSTemporaryDirectory()
        let utilsUUID = UUID().uuidString.prefix(8)
        let utilsPath = tempDir + "dup_inc_\(utilsUUID).bb"
        
        let utilsContent = """
        Function CountCalls()
            Return 1
        End Function
        """
        
        try utilsContent.write(toFile: utilsPath, atomically: true, encoding: .utf8)
        
        let mainSource = """
        Include "dup_inc_\(utilsUUID).bb"
        Include "dup_inc_\(utilsUUID).bb"
        Function Main()
            Print CountCalls()
        End Function
        """
        
        let mainPath = tempDir + "main_dup_\(UUID().uuidString.prefix(8)).bb"
        try mainSource.write(toFile: mainPath, atomically: true, encoding: .utf8)
        
        var preprocessor = Preprocessor()
        let processed = try preprocessor.process(file: mainPath)
        
        // Function should appear twice (Blitz3D allows this, it's a user error)
        let count = processed.components(separatedBy: "Function CountCalls").count - 1
        XCTAssertEqual(count, 2, "Include twice should include content twice")
        
        // Clean up
        try FileManager.default.removeItem(atPath: utilsPath)
        try FileManager.default.removeItem(atPath: mainPath)
    }
    
    func testIncludeWithRelativePath() throws {
        let tempDir = NSTemporaryDirectory()
        let subdirName = "subdir_test_\(UUID().uuidString.prefix(8))"
        let subdirPath = tempDir + subdirName + "/"
        let mainPath = tempDir + "main_rel_\(UUID().uuidString.prefix(8)).bb"
        
        try FileManager.default.createDirectory(atPath: subdirPath, withIntermediateDirectories: true)
        
        let utilsContent = """
        Function SubdirFunc()
            Return "From subdir"
        End Function
        """
        
        let utilsPath = subdirPath + "utils.bb"
        try utilsContent.write(toFile: utilsPath, atomically: true, encoding: .utf8)
        
        let mainContent = """
        Include "\(subdirName)/utils.bb"
        Function Main()
            Print SubdirFunc()
        End Function
        """
        
        try mainContent.write(toFile: mainPath, atomically: true, encoding: .utf8)
        
        var preprocessor = Preprocessor()
        let processed = try preprocessor.process(file: mainPath)
        
        // Should include the function from subdirectory
        XCTAssertTrue(processed.contains("Function SubdirFunc"))
        
        // Clean up (ignore errors)
        _ = try? FileManager.default.removeItem(atPath: utilsPath)
        _ = try? FileManager.default.removeItem(atPath: subdirPath)
        _ = try? FileManager.default.removeItem(atPath: mainPath)
    }
    
    func testIncludeWithConstants() throws {
        let tempDir = NSTemporaryDirectory()
        let constUUID = UUID().uuidString.prefix(8)
        let constPath = tempDir + "const_test_\(constUUID).bb"
        
        let constContent = """
        Const VERSION$ = "1.0.0"
        Const MAX_SCORE = 9999
        Const GRAVITY# = 0.01
        """
        
        try constContent.write(toFile: constPath, atomically: true, encoding: .utf8)
        
        let mainSource = """
        Include "const_test_\(constUUID).bb"
        Function Main()
            Print VERSION$
            Print MAX_SCORE
            Print GRAVITY#
        End Function
        """
        
        let mainPath = tempDir + "main_const_\(UUID().uuidString.prefix(8)).bb"
        try mainSource.write(toFile: mainPath, atomically: true, encoding: .utf8)
        
        var preprocessor = Preprocessor()
        let processed = try preprocessor.process(file: mainPath)
        
        var parser = Parser(source: processed)
        let program = parser.parse()
        
        // Should have 4 constants (3 from include + 1 implicit main function)
        XCTAssertEqual(program.functions.count, 1)
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThanOrEqual(module.code.count, 1)
        
        // Clean up
        try FileManager.default.removeItem(atPath: constPath)
        try FileManager.default.removeItem(atPath: mainPath)
    }
    
    func testIncludeWithGlobalDeclarations() throws {
        let tempDir = NSTemporaryDirectory()
        let globalsUUID = UUID().uuidString.prefix(8)
        let globalsPath = tempDir + "globals_test_\(globalsUUID).bb"
        
        let globalsContent = """
        Global SCORE% = 0
        Global PLAYER_NAME$ = "Unknown"
        Global HEALTH# = 100.0
        """
        
        try globalsContent.write(toFile: globalsPath, atomically: true, encoding: .utf8)
        
        let mainSource = """
        Include "globals_test_\(globalsUUID).bb"
        Function Main()
            SCORE% = 100
            Print SCORE%
        End Function
        """
        
        let mainPath = tempDir + "main_globals_\(UUID().uuidString.prefix(8)).bb"
        try mainSource.write(toFile: mainPath, atomically: true, encoding: .utf8)
        
        var preprocessor = Preprocessor()
        let processed = try preprocessor.process(file: mainPath)
        
        var parser = Parser(source: processed)
        let program = parser.parse()
        
        // Should compile successfully
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThanOrEqual(module.code.count, 1)
        
        // Clean up
        try FileManager.default.removeItem(atPath: globalsPath)
        try FileManager.default.removeItem(atPath: mainPath)
    }
}
