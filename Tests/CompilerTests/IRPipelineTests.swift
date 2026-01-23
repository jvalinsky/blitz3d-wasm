
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
        // In the IR emitter, the last function added is usually Main if it was top-level,
        // but since we are lowering function nodes, we just look for "main" (lowercased)
        if let idx = module.functionNames.firstIndex(of: "main") {
            // Function names includes imports
            let funcIdx = idx - module.imports.count
            if funcIdx >= 0 && funcIdx < module.code.count {
                return module.code[funcIdx]
            }
        }
        return module.code.last
    }

    func testIfStatementStackBalance() throws {
        let source = """
        Function Main()
            Local x = 1
            If x = 1 Then
                x = 2
            EndIf
        End Function
        """
        let module = compile(source)
        guard let main = getMainFunction(in: module) else {
            XCTFail("Main function not found")
            return
        }

        // Verify stack neutrality
        let delta = calculateStackDelta(main.body)
        XCTAssertEqual(delta, 0, "Function should have net 0 stack delta")
    }

    func testWhileLoopStackBalance() throws {
        let source = """
        Function Main()
            Local x = 0
            While x < 10
                x = x + 1
            Wend
        End Function
        """
        let module = compile(source)
        guard let main = getMainFunction(in: module) else {
            XCTFail("Main function not found")
            return
        }

        let delta = calculateStackDelta(main.body)
        XCTAssertEqual(delta, 0, "Function should have net 0 stack delta")
    }

    func testForLoopStackBalance() throws {
        let source = """
        Function Main()
            Local i
            For i = 1 To 10
                PrintInt(i)
            Next
        End Function
        """
        let module = compile(source)
        guard let main = getMainFunction(in: module) else {
            XCTFail("Main function not found")
            return
        }

        let delta = calculateStackDelta(main.body)
        XCTAssertEqual(delta, 0, "Function should have net 0 stack delta")
    }

    func testTypePromotion() throws {
        let source = """
        Function Main()
            Local x# = 1 + 2.5
        End Function
        """
        let module = compile(source)
        guard let main = getMainFunction(in: module) else {
            XCTFail("Main function not found")
            return
        }

        // Check if f32Add is used
        let hasF32Add = main.body.contains { instr in
            if case .f32Add = instr { return true }
            return false
        }
        XCTAssertTrue(hasF32Add, "Should use f32Add for float arithmetic")
    }

    // MARK: - Stack Delta Calculator
    private func calculateStackDelta(_ instructions: [WASMInstruction]) -> Int {
        var count = 0
        for instr in instructions {
            switch instr {
            case .i32Const, .f32Const, .localGet, .globalGet:
                count += 1
            case .localSet, .globalSet, .drop:
                count -= 1
            case .i32Add, .i32Sub, .i32Mul, .i32DivS, .i32Eq, .i32Ne, .i32LtS, .i32GtS, .i32LeS, .i32GeS, .i32And, .i32Or, .i32Xor, .i32Shl, .i32ShrS, .i32RemS:
                count -= 1 // 2 in, 1 out
            case .f32Add, .f32Sub, .f32Mul, .f32Div, .f32Eq, .f32Ne, .f32Lt, .f32Gt, .f32Le, .f32Ge:
                count -= 1 // 2 in, 1 out
            case .call:
                // This is tricky without signature info, but for these tests we know
                // most calls are void or return i32.
                // In IR emitter, we have the signature.
                // For simplicity in tests, assume it pushes 1 if we expect a result.
                // But the IR emitter handles this.
                break 
            case .block(let type, let body), .loop(let type, let body):
                let inner = calculateStackDelta(body)
                count += inner
                if type != .void && inner == 0 { count += 1 }
            case .if(let type, let thenBody, let elseBody):
                count -= 1 // condition
                let thenDelta = calculateStackDelta(thenBody)
                count += thenDelta
                // assuming then/else have same effect
            case .return:
                return count // stop here
            default:
                break
            }
        }
        return count
    }
}
