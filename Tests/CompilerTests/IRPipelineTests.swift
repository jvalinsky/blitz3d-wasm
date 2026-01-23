
import XCTest
@testable import Blitz3DCompiler

final class IRPipelineTests: XCTestCase {

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

    // MARK: - Stack Delta Calculator
    private func calculateStackDelta(_ instructions: [WASMInstruction], trace: inout String) -> Int {
        var count = 0
        for instr in instructions {
            let actualInstr: WASMInstruction
            if case .sourceLocation(_, let inner) = instr {
                actualInstr = inner
            } else {
                actualInstr = instr
            }

            let prevCount = count
            switch actualInstr {
            case .i32Const, .f32Const, .localGet, .globalGet:
                count += 1
            case .localSet, .globalSet, .localTee, .drop, .brIf:
                count -= 1
            case .brTable:
                count -= 1
            case .i32Add, .i32Sub, .i32Mul, .i32DivS, .i32Eq, .i32Ne, .i32LtS, .i32GtS, .i32LeS, .i32GeS, .i32And, .i32Or, .i32Xor, .i32Shl, .i32ShrS, .i32RemS:
                count -= 1 
            case .f32Add, .f32Sub, .f32Mul, .f32Div, .f32Eq, .f32Ne, .f32Lt, .f32Gt, .f32Le, .f32Ge:
                count -= 1
            case .i32EqZ, .f32Neg, .f32ConvertI32S, .i32TruncF32S:
                break 
            case .i32Load, .f32Load:
                break 
            case .i32Store, .f32Store:
                count -= 2
            case .call(let idx):
                // Simplified arity for tests
                if idx == 0 { count -= 1 } else { count += 1 }
            case .block(_, let body), .loop(_, let body):
                var innerTrace = ""
                let inner = calculateStackDelta(body, trace: &innerTrace)
                count += inner
            case .if(_, let thenBody, let elseBody):
                count -= 1 // condition
                var tTrace = ""
                let thenDelta = calculateStackDelta(thenBody, trace: &tTrace)
                count += thenDelta
            case .return:
                return count
            default:
                break
            }
        }
        return count
    }

    func testIfStatementStackBalance() throws {
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

        var trace = ""
        let delta = calculateStackDelta(main.body, trace: &trace)
        XCTAssertEqual(delta, 1)
    }

    func testWhileLoopStackBalance() throws {
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

        var trace = ""
        let delta = calculateStackDelta(main.body, trace: &trace)
        XCTAssertEqual(delta, 1)
    }

    func testForLoopStackBalance() throws {
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

        var trace = ""
        let delta = calculateStackDelta(main.body, trace: &trace)
        XCTAssertEqual(delta, 1)
    }

    func testTypePromotion() throws {
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

        let hasF32Add = main.body.contains { instr in
            let actual: WASMInstruction
            if case .sourceLocation(_, let inner) = instr { actual = inner } else { actual = instr }
            if case .f32Add = actual { return true }
            return false
        }
        XCTAssertTrue(hasF32Add)
    }

    func testMultiDimensionalArray() throws {
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

    func testForLoopNegativeStep() throws {
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

        var trace = ""
        let delta = calculateStackDelta(main.body, trace: &trace)
        if delta != 1 {
            XCTFail("Function returning i32 should have net 1 stack delta, got \(delta)\nTrace:\n\(trace)")
        }
        
        let bodyStr = "\(main.body)"
        XCTAssertTrue(bodyStr.contains("i32LtS"), "Negative step loop should use i32.lt_s comparison")
    }

    func testDefaultArguments() throws {
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

        var found42 = false
        for instr in main.body {
            let actual: WASMInstruction
            if case .sourceLocation(_, let inner) = instr { actual = inner } else { actual = instr }
            if case .i32Const(let val) = actual, val == 42 { found42 = true }
        }
        XCTAssertTrue(found42, "Should synthesize default argument 42")
    }

    func testStringDeduplication() throws {
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
        
        let helloBytes = Array("hello".utf8) + [0]
        let helloSegments = irModule.data.filter { Array($0.data) == helloBytes }
        XCTAssertEqual(helloSegments.count, 1)
    }
}
