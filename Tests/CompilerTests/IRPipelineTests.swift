
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
            case .i32Const(_), .f32Const(_), .localGet(_), .globalGet(_):
                count += 1
            case .localSet(_), .globalSet(_), .localTee(_), .drop:
                count -= 1
            case .brIf(_):
                count -= 1
            case .brTable(_, _):
                count -= 1
            case .i32Add, .i32Sub, .i32Mul, .i32DivS, .i32Eq, .i32Ne, .i32LtS, .i32GtS, .i32LeS, .i32GeS, .i32And, .i32Or, .i32Xor, .i32Shl, .i32ShrS, .i32RemS:
                count -= 1 
            case .f32Add, .f32Sub, .f32Mul, .f32Div, .f32Eq, .f32Ne, .f32Lt, .f32Gt, .f32Le, .f32Ge:
                count -= 1
            case .i32EqZ, .f32Neg, .f32ConvertI32S, .i32TruncF32S:
                break 
            case .i32Load(_, _), .f32Load(_, _):
                break 
            case .i32Store(_, _), .f32Store(_, _):
                count -= 2
            case .call(let idx):
                if idx == 0 { count -= 1 } else { count += 1 }
            case .block(let type, let body), .loop(let type, let body):
                var innerTrace = ""
                let inner = calculateStackDelta(body, trace: &innerTrace)
                count += inner
                if type != .void && inner == 0 { count += 1 }
            case .if(let type, let thenBody, let elseBody):
                count -= 1 // condition
                var tTrace = ""
                let thenDelta = calculateStackDelta(thenBody, trace: &tTrace)
                count += thenDelta
            case .return:
                trace += "  [RET] \(actualInstr): \(prevCount) -> \(count)\n"
                return count
            default:
                break
            }
            trace += "  \(actualInstr): \(prevCount) -> \(count)\n"
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
        if delta != 1 {
            XCTFail("Function returning i32 should have net 1 stack delta, got \(delta)\nTrace:\n\(trace)")
        }
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
        if delta != 1 {
            XCTFail("Function returning i32 should have net 1 stack delta, got \(delta)\nTrace:\n\(trace)")
        }
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
        if delta != 1 {
            XCTFail("Function returning i32 should have net 1 stack delta, got \(delta)\nTrace:\n\(trace)")
        }
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
        XCTAssertTrue(hasF32Add, "Should use f32Add for float arithmetic")
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

        var trace = ""
        let delta = calculateStackDelta(main.body, trace: &trace)
        
        let bodyStr = "\(main.body)"
        if !bodyStr.contains("i32Mul") || !bodyStr.contains("i32Add") {
            XCTFail("Missing indexing instructions. Trace:\n\(trace)")
        }
        
        XCTAssertEqual(delta, 1, "Should return 1 value (x). Trace:\n\(trace)")
    }
}
