
import Testing
@testable import Blitz3DCompiler

struct IRPipelineTests {

    private func compile(_ source: String) -> WASMModule {
        var parser = Parser(source: source)
        let program = parser.parse()
        var codeGen = CodeGenerator()
        return codeGen.generateFromIR(program)
    }

    private func getMainFunction(in module: WASMModule) -> WASMFunction? {
        if let idx = module.functionNames.enumerated().first(where: { $0.element.lowercased() == "main" })?.offset {
            if idx >= 0 && idx < module.code.count {
                return module.code[idx]
            }
        }
        return module.code.last
    }

    // MARK: - Helpers

    private func walkInstructions(_ instructions: [WASMInstruction], visit: (WASMInstruction) -> Void) {
        for instr in instructions {
            switch instr {
            case .sourceLocation(_, let inner):
                walkInstructions([inner], visit: visit)
            case .block(_, let body), .loop(_, let body):
                visit(instr)
                walkInstructions(body, visit: visit)
            case .if(_, let thenBody, let elseBody):
                visit(instr)
                walkInstructions(thenBody, visit: visit)
                if let elseBody {
                    walkInstructions(elseBody, visit: visit)
                }
            default:
                visit(instr)
            }
        }
    }

    private func containsInstruction(_ instructions: [WASMInstruction], where predicate: (WASMInstruction) -> Bool) -> Bool {
        var found = false
        walkInstructions(instructions) { instr in
            if !found && predicate(instr) {
                found = true
            }
        }
        return found
    }

    private final class ModuleTypeContext: ValidatorTypeContext {
        private let module: WASMModule
        private let function: WASMFunction

        init(module: WASMModule, function: WASMFunction) {
            self.module = module
            self.function = function
        }

        func localType(at index: Int) -> WASMType? {
            guard function.typeIndex >= 0 && function.typeIndex < module.types.count else { return nil }
            let paramTypes = module.types[function.typeIndex].parameters
            if index < paramTypes.count { return paramTypes[index] }
            let localIndex = index - paramTypes.count
            guard localIndex >= 0 && localIndex < function.locals.count else { return nil }
            return function.locals[localIndex]
        }

        func globalType(at index: Int) -> WASMType? {
            guard index >= 0 && index < module.globals.count else { return nil }
            return module.globals[index].type
        }

        func functionSignature(at index: Int) -> (params: [WASMType], results: [WASMType])? {
            // Global function indices are: [imports...] + [defined functions...]
            if index < module.imports.count {
                let imp = module.imports[index]
                guard imp.kind == .function else { return nil }
                guard imp.index >= 0 && imp.index < module.types.count else { return nil }
                let ty = module.types[imp.index]
                return (params: ty.parameters, results: ty.results)
            }

            let localIndex = index - module.imports.count
            guard localIndex >= 0 && localIndex < module.functions.count else { return nil }
            let typeIndex = module.functions[localIndex]
            guard typeIndex >= 0 && typeIndex < module.types.count else { return nil }
            let ty = module.types[typeIndex]
            return (params: ty.parameters, results: ty.results)
        }
    }

    private func assertStackValid(_ module: WASMModule, function: WASMFunction, file: StaticString = #filePath, line: UInt = #line) {
        guard function.typeIndex >= 0 && function.typeIndex < module.types.count else {
            XCTFail("Function typeIndex out of range", file: file, line: line)
            return
        }

        let sig = module.types[function.typeIndex]
        let validator = StackValidator(returnTypes: sig.results)
        let typeContext = ModuleTypeContext(module: module, function: function)
        validator.typeContext = typeContext

        for instr in function.body {
            validator.validateInstruction(instr)
        }

        if !validator.isValid {
            XCTFail("Stack validation failed:\n\(validator.errors.joined(separator: "\n"))", file: file, line: line)
        }
    }

    @Test func testIfStatementStackBalance() throws {
        let source = """
        Function Main()
            Local x = 1
            If x = 1 Then
                x = 2
            EndIf
            Return 0
        End Function
        """
        let module = compile(source)
        guard let main = getMainFunction(in: module) else {
            XCTFail("Main function not found")
            return
        }
        assertStackValid(module, function: main)
    }

    @Test func testWhileLoopStackBalance() throws {
        let source = """
        Function Main()
            Local x = 0
            While x < 10
                x = x + 1
            Wend
            Return 0
        End Function
        """
        let module = compile(source)
        guard let main = getMainFunction(in: module) else {
            XCTFail("Main function not found")
            return
        }
        assertStackValid(module, function: main)
    }

    @Test func testForLoopStackBalance() throws {
        let source = """
        Function Main()
            Local i
            For i = 1 To 10
                PrintInt(i)
            Next
            Return 0
        End Function
        """
        let module = compile(source)
        guard let main = getMainFunction(in: module) else {
            XCTFail("Main function not found")
            return
        }
        assertStackValid(module, function: main)
    }

    @Test func testTypePromotion() throws {
        let source = """
        Function Main()
            Local x# = 1 + 2.5
            Return 0
        End Function
        """
        let module = compile(source)
        guard let main = getMainFunction(in: module) else {
            XCTFail("Main function not found")
            return
        }

        let hasF32Add = containsInstruction(main.body) { instr in
            if case .f32Add = instr { return true }
            return false
        }
        XCTAssertTrue(hasF32Add)
    }

    @Test func testMultiDimensionalArray() throws {
        let source = """
        Function Main()
            Dim A(10, 10)
            A(1, 2) = 42
            Local x = A(1, 2)
            Return x
        End Function
        """
        let module = compile(source)
        guard let main = getMainFunction(in: module) else {
            XCTFail("Main function not found")
            return
        }

        var hasMul = false
        var hasAdd = false
        
        func check(instrs: [WASMInstruction]) {
            for instr in instrs {
                let actual: WASMInstruction
                if case .sourceLocation(_, let inner) = instr { actual = inner } else { actual = instr }
                
                switch actual {
                case .i32Mul: hasMul = true
                case .i32Add: hasAdd = true
                case .block(_, let body), .loop(_, let body), .if(_, let body, _):
                    check(instrs: body)
                default: break
                }
            }
        }
        
        check(instrs: main.body)
        XCTAssertTrue(hasMul, "Should use multiplication for indexing")
        XCTAssertTrue(hasAdd, "Should use addition for indexing")
    }

    @Test func testForLoopNegativeStep() throws {
        let source = """
        Function Main()
            Local i
            Local count = 0
            For i = 10 To 1 Step -1
                count = count + 1
            Next
            Return count
        End Function
        """
        let module = compile(source)
        guard let main = getMainFunction(in: module) else {
            XCTFail("Main function not found")
            return
        }
        assertStackValid(module, function: main)
        
        let bodyStr = "\(main.body)"
        XCTAssertTrue(bodyStr.contains("i32GeS"), "Negative step loop should use i32.ge_s comparison")
    }

    @Test func testDefaultArguments() throws {
        let source = """
        Function TestDef(a, b=42)
            Return a + b
        End Function

        Function Main()
            Local x = TestDef(10)
            Return x
        End Function
        """
        let module = compile(source)
        guard let main = getMainFunction(in: module) else {
            XCTFail("Main function not found")
            return
        }

        let found42 = containsInstruction(main.body) { instr in
            if case .i32Const(let val) = instr, val == 42 { return true }
            return false
        }
        XCTAssertTrue(found42, "Should synthesize default argument 42")
    }

    @Test func testStringDeduplication() throws {
        let source = """
        Function Main()
            Local a$ = "hello"
            Local b$ = "hello"
            Return 0
        End Function
        """
        var parser = Parser(source: source)
        let program = parser.parse()
        let lowering = ASTLowering(context: ModuleContext(module: WASMModule()))
        let irModule = lowering.lower(program)

        func leBytes(_ v: Int32) -> [UInt8] {
            withUnsafeBytes(of: v.littleEndian) { Array($0) }
        }

        // Strings are stored as: [refCount:i32][length:i32][utf8 bytes...][0]
        let helloBytes = leBytes(1) + leBytes(Int32("hello".utf8.count)) + Array("hello".utf8) + [0]
        let helloSegments = irModule.data.filter { Array($0.data) == helloBytes }
        XCTAssertEqual(helloSegments.count, 1)
    }
}
