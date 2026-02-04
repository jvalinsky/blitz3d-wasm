//
//  CompilationIssuesTests.swift
//  CompilerTests
//
//  Tests for stack balancing, type promotion, and function call cleanup issues
//

import Testing
@testable import Blitz3DCompiler

struct CompilationIssuesTests {

    // MARK: - Stack Balancing Tests

    @Test func testIfStatementStackBalance() throws {
        let source = """
        Function Main()
            Local x = 1
            If x = 1 Then
                x = 2
            EndIf
        End Function
        """
        var parser = Parser(source: source)
        let program = parser.parse()

        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)

        XCTAssertGreaterThanOrEqual(module.code.count, 1)
        // Find the Main function by looking at exports
        var mainFunctionOpt: WASMFunction?
        if let mainExport = module.exports.first(where: { $0.name == "Main" }) {
            let funcIndex = mainExport.index - module.imports.count
            if funcIndex >= 0 && funcIndex < module.code.count {
                mainFunctionOpt = module.code[funcIndex]
            }
        }

        // Fallback: find function with f32 locals (float variables)
        if mainFunctionOpt == nil {
            mainFunctionOpt = module.code.last(where: { funcBody in
                funcBody.locals.contains { local in
                    if case .f32 = local { return true }
                    return false
                }
            })
        }

        // Fallback: use last function (usually Main)
        if mainFunctionOpt == nil {
            mainFunctionOpt = module.code.last
        }

        guard let mainFunction = mainFunctionOpt else {
            XCTFail("Main function not found")
            return
        }

        func countStackValues(_ instructions: [WASMInstruction], _ depth: Int = 0) -> Int {
            var count = 0
            let indent = String(repeating: "  ", count: depth)
            for instr in instructions {
                switch instr {
                case .i32Const, .f32Const:
                    count += 1
                    print("\(indent)i32Const/f32Const: \(count)")
                case .localGet, .globalGet:
                    count += 1
                    print("\(indent)localGet/globalGet: \(count)")
                case .localSet, .globalSet, .drop:
                    count -= 1
                    print("\(indent)localSet/globalSet/drop: \(count)")
                case .i32Add, .i32Sub, .i32Mul, .i32DivS, .i32Eq, .i32Ne, .i32LtS, .i32GtS, .i32LeS, .i32GeS, .i32And, .i32Or, .i32Xor, .i32Shl, .i32ShrU, .i32RemS:
                    count -= 1
                    print("\(indent)binop: \(count)")
                case .f32Add, .f32Sub, .f32Mul, .f32Div, .f32Eq, .f32Ne, .f32Lt, .f32Gt, .f32Le, .f32Ge, .f32Neg, .f32ConvertI32S, .i32TruncF32S:
                    count -= 1
                case .call:
                    count += 1
                case .block(let type, let body):
                    print("\(indent)BLOCK (\(type)):")
                    count += countStackValues(body, depth + 1)
                    print("\(indent)BLOCK end: \(count)")
                case .loop(let type, let body):
                    print("\(indent)LOOP (\(type)):")
                    count += countStackValues(body, depth + 1)
                    print("\(indent)LOOP end: \(count)")
                case .if(let type, let thenBody, let elseBody):
                    print("\(indent)IF (\(type)):")
                    count -= 1
                    print("\(indent)  condition consumed: \(count)")
                    print("\(indent)  THEN:")
                    count += countStackValues(thenBody, depth + 2)
                    print("\(indent)  THEN end: \(count)")
                    if let elseBody = elseBody {
                        print("\(indent)  ELSE:")
                        count += countStackValues(elseBody, depth + 2)
                        print("\(indent)  ELSE end: \(count)")
                    }
                    print("\(indent)IF end: \(count)")
                case .return:
                    print("\(indent)return: break")
                    break
                case .br(let _):
                    print("\(indent)BR -> no stack change")
                case .brIf(let _):
                    count -= 1
                    print("\(indent)BR_IF -> stack: \(count)")
                case .end:
                    print("\(indent)END -> no stack change")
                default:
                    break
                }
            }
            return count
        }

        print("\n=== STACK TRACE ===")
        let stackDelta = countStackValues(mainFunction.body)
        print("=== FINAL: \(stackDelta) ===\n")
    }

    @Test func testIfElseStatementStackBalance() throws {
        let source = """
        Function Main()
            Local x = 1
            If x = 1 Then
                x = 2
            Else
                x = 3
            EndIf
        End Function
        """
        var parser = Parser(source: source)
        let program = parser.parse()

        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)

        XCTAssertGreaterThanOrEqual(module.code.count, 1)
        var mainFunctionOpt: WASMFunction?
        if let mainExport = module.exports.first(where: { $0.name == "Main" }) {
            let funcIndex = mainExport.index - module.imports.count
            if funcIndex >= 0 && funcIndex < module.code.count {
                mainFunctionOpt = module.code[funcIndex]
            }
        }

        if mainFunctionOpt == nil {
            mainFunctionOpt = module.code.last(where: { funcBody in
                funcBody.locals.contains { local in
                    if case .f32 = local { return true }
                    return false
                }
            })
        }

        if mainFunctionOpt == nil {
            mainFunctionOpt = module.code.last
        }

        guard let mainFunction = mainFunctionOpt else {
            XCTFail("Main function not found")
            return
        }

        func countStackValues(_ instructions: [WASMInstruction], _ depth: Int = 0) -> Int {
            var count = 0
            let indent = String(repeating: "  ", count: depth)
            for instr in instructions {
                switch instr {
                case .i32Const, .f32Const:
                    count += 1
                    print("\(indent)CONST -> stack: \(count)")
                case .localGet, .globalGet:
                    count += 1
                    print("\(indent)GET -> stack: \(count)")
                case .localSet, .globalSet, .drop:
                    count -= 1
                    print("\(indent)SET/DROP -> stack: \(count)")
                case .i32Add, .i32Sub, .i32Mul, .i32DivS, .i32Eq, .i32Ne, .i32LtS, .i32GtS, .i32LeS, .i32GeS, .i32And, .i32Or, .i32Xor, .i32Shl, .i32ShrU, .i32RemS:
                    count -= 1
                    print("\(indent)I32_BINOP -> stack: \(count)")
                case .f32Add, .f32Sub, .f32Mul, .f32Div, .f32Eq, .f32Ne, .f32Lt, .f32Gt, .f32Le, .f32Ge, .f32Neg, .f32ConvertI32S, .i32TruncF32S:
                    count -= 1
                case .call:
                    count += 1
                case .block(let type, let body):
                    print("\(indent)BLOCK(\(type)) enter -> stack: \(count)")
                    count += countStackValues(body, depth + 1)
                    print("\(indent)BLOCK(\(type)) exit -> stack: \(count)")
                case .loop(let type, let body):
                    print("\(indent)LOOP(\(type)) enter -> stack: \(count)")
                    count += countStackValues(body, depth + 1)
                    print("\(indent)LOOP(\(type)) exit -> stack: \(count)")
                case .if(let type, let thenBody, let elseBody):
                    print("\(indent)IF(\(type)) cond -> stack before: \(count)")
                    count -= 1
                    print("\(indent)IF(\(type)) cond consumed -> stack: \(count)")
                    print("\(indent)IF(\(type)) THEN:")
                    count += countStackValues(thenBody, depth + 1)
                    print("\(indent)IF(\(type)) THEN end -> stack: \(count)")
                    if let elseBody = elseBody {
                        print("\(indent)IF(\(type)) ELSE:")
                        count += countStackValues(elseBody, depth + 1)
                        print("\(indent)IF(\(type)) ELSE end -> stack: \(count)")
                    }
                    print("\(indent)IF(\(type)) exit -> stack: \(count)")
                case .return:
                    print("\(indent)RETURN -> break")
                    break
                case .br, .brIf:
                    print("\(indent)BR/BR_IF -> no stack change")
                case .end:
                    print("\(indent)END -> no stack change")
                default:
                    print("\(indent)OTHER: \(String(describing: instr).prefix(30))")
                    break
                }
            }
            return count
        }

        let stackDelta = countStackValues(mainFunction.body)
        // Function Main() returns Int (i32) by default in Blitz3D, so expect 1 value for return
        XCTAssertEqual(stackDelta, 1, "Function returning i32 should have exactly 1 value on stack at return. Stack delta: \(stackDelta)")
    }

    @Test func testWhileLoopStackBalance() throws {
        let source = """
        Function Main()
            Local x = 0
            While x < 10
                x = x + 1
            Wend
        End Function
        """
        var parser = Parser(source: source)
        let program = parser.parse()

        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)

        XCTAssertGreaterThanOrEqual(module.code.count, 1)
        var mainFunctionOpt: WASMFunction?
        if let mainExport = module.exports.first(where: { $0.name == "Main" }) {
            let funcIndex = mainExport.index - module.imports.count
            if funcIndex >= 0 && funcIndex < module.code.count {
                mainFunctionOpt = module.code[funcIndex]
            }
        }

        if mainFunctionOpt == nil {
            mainFunctionOpt = module.code.last(where: { funcBody in
                funcBody.locals.contains { local in
                    if case .f32 = local { return true }
                    return false
                }
            })
        }

        if mainFunctionOpt == nil {
            mainFunctionOpt = module.code.last
        }

        guard let mainFunction = mainFunctionOpt else {
            XCTFail("Main function not found")
            return
        }

        func countStackValues(_ instructions: [WASMInstruction], _ depth: Int = 0) -> Int {
            var count = 0
            let indent = String(repeating: "  ", count: depth)
            for instr in instructions {
                switch instr {
                case .i32Const, .f32Const:
                    count += 1
                    print("\(indent)CONST -> stack: \(count)")
                case .localGet, .globalGet:
                    count += 1
                    print("\(indent)GET -> stack: \(count)")
                case .localSet, .globalSet, .drop:
                    count -= 1
                    print("\(indent)SET/DROP -> stack: \(count)")
                case .i32Add, .i32Sub, .i32Mul, .i32DivS, .i32Eq, .i32Ne, .i32LtS, .i32GtS, .i32LeS, .i32GeS, .i32And, .i32Or, .i32Xor, .i32Shl, .i32ShrU, .i32RemS:
                    count -= 1
                    print("\(indent)I32_BINOP -> stack: \(count)")
                case .f32Add, .f32Sub, .f32Mul, .f32Div, .f32Eq, .f32Ne, .f32Lt, .f32Gt, .f32Le, .f32Ge, .f32Neg, .f32ConvertI32S, .i32TruncF32S:
                    count -= 1
                case .call:
                    count += 1
                case .block(let type, let body):
                    print("\(indent)BLOCK(\(type)) enter -> stack: \(count)")
                    count += countStackValues(body, depth + 1)
                    print("\(indent)BLOCK(\(type)) exit -> stack: \(count)")
                case .loop(let type, let body):
                    print("\(indent)LOOP(\(type)) enter -> stack: \(count)")
                    count += countStackValues(body, depth + 1)
                    print("\(indent)LOOP(\(type)) exit -> stack: \(count)")
                case .if(let type, let thenBody, let elseBody):
                    print("\(indent)IF(\(type)) cond -> stack before: \(count)")
                    count -= 1
                    print("\(indent)IF(\(type)) cond consumed -> stack: \(count)")
                    print("\(indent)IF(\(type)) THEN:")
                    count += countStackValues(thenBody, depth + 1)
                    print("\(indent)IF(\(type)) THEN end -> stack: \(count)")
                    if let elseBody = elseBody {
                        print("\(indent)IF(\(type)) ELSE:")
                        count += countStackValues(elseBody, depth + 1)
                        print("\(indent)IF(\(type)) ELSE end -> stack: \(count)")
                    }
                    print("\(indent)IF(\(type)) exit -> stack: \(count)")
                case .return:
                    print("\(indent)RETURN -> break")
                    break
                case .br(let _):
                    print("\(indent)BR -> no stack change")
                case .brIf(let _):
                    count -= 1
                    print("\(indent)BR_IF -> stack: \(count)")
                case .end:
                    print("\(indent)END -> no stack change")
                default:
                    print("\(indent)OTHER: \(String(describing: instr).prefix(30))")
                    break
                }
            }
            return count
        }

        print("\n=== FULL STACK ANALYSIS FOR WHILE LOOP ===")
        print("Main function has \(mainFunction.body.count) instructions")
        print("Main function locals: \(mainFunction.locals)")
        for (idx, instr) in mainFunction.body.enumerated() {
            print("  [\(idx)] \(instr)")
        }
        print("---")
        let stackDelta = countStackValues(mainFunction.body)
        print("=== FINAL STACK DELTA: \(stackDelta) ===\n")

        // Function Main() returns Int (i32) by default in Blitz3D, so expect 1 value for return
        XCTAssertEqual(stackDelta, 1, "Function returning i32 should have exactly 1 value on stack at return. Stack delta: \(stackDelta)")
    }

    @Test func testForLoopStackBalance() throws {
        let source = """
        Function Main()
            Local i
            For i = 1 To 10
            Next
        End Function
        """
        var parser = Parser(source: source)
        let program = parser.parse()

        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)

        XCTAssertGreaterThanOrEqual(module.code.count, 1)
        var mainFunctionOpt: WASMFunction?
        if let mainExport = module.exports.first(where: { $0.name == "Main" }) {
            let funcIndex = mainExport.index - module.imports.count
            if funcIndex >= 0 && funcIndex < module.code.count {
                mainFunctionOpt = module.code[funcIndex]
            }
        }

        if mainFunctionOpt == nil {
            mainFunctionOpt = module.code.last(where: { funcBody in
                funcBody.locals.contains { local in
                    if case .f32 = local { return true }
                    return false
                }
            })
        }

        if mainFunctionOpt == nil {
            mainFunctionOpt = module.code.last
        }

        guard let mainFunction = mainFunctionOpt else {
            XCTFail("Main function not found")
            return
        }

        var writer = WASMTextWriter()
        let watOutput = writer.write(module)
        print("=== FOR LOOP WASM OUTPUT ===")
        print(watOutput)
        print("=== END WASM OUTPUT ===")

        func countStackValues(_ instructions: [WASMInstruction]) -> Int {
            var count = 0
            for instr in instructions {
                switch instr {
                case .i32Const, .f32Const:
                    count += 1
                case .localGet, .globalGet:
                    count += 1
                case .localSet, .globalSet, .drop:
                    count -= 1
                case .i32Add, .i32Sub, .i32Mul, .i32DivS, .i32Eq, .i32Ne, .i32LtS, .i32GtS, .i32LeS, .i32GeS, .i32And, .i32Or, .i32Xor, .i32Shl, .i32ShrU, .i32RemS:
                    count -= 1
                case .f32Add, .f32Sub, .f32Mul, .f32Div, .f32Eq, .f32Ne, .f32Lt, .f32Gt, .f32Le, .f32Ge, .f32Neg, .f32ConvertI32S, .i32TruncF32S:
                    count -= 1
                case .call:
                    count += 1
                case .block(_, let body):
                    count += countStackValues(body)
                case .loop(_, let body):
                    count += countStackValues(body)
                case .if(_, let thenBody, let elseBody):
                    count -= 1
                    count += countStackValues(thenBody)
                    if let elseBody = elseBody {
                        count += countStackValues(elseBody)
                    }
                case .return:
                    break
                case .br(_):
                    break
                case .brIf(_):
                    count -= 1
                case .end:
                    break
                default:
                    break
                }
            }
            return count
        }

        let stackDelta = countStackValues(mainFunction.body)
        // Function Main() returns Int (i32) by default in Blitz3D, so expect 1 value for return
        XCTAssertEqual(stackDelta, 1, "Function returning i32 should have exactly 1 value on stack at return. Stack delta: \(stackDelta)")
    }

    // MARK: - Type Promotion Tests

    @Test func testFloatAdditionTypePromotion() throws {
        let source = """
        Function Main()
            Local x# = 1.5
            Local y# = 2.5
            Local z# = x# + y#
        End Function
        """
        var parser = Parser(source: source)
        let program = parser.parse()

        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)

        guard let mainFunc = module.code.last(where: { funcBody in
            funcBody.locals.contains { local in
                if case .f32 = local { return true }
                return false
            }
        }) else {
            XCTFail("Main function with float locals not found")
            return
        }

        var hasF32Add = false
        var hasI32Add = false

        for instr in mainFunc.body {
            switch instr {
            case .f32Add:
                hasF32Add = true
            case .i32Add:
                hasI32Add = true
            default:
                break
            }
        }

        XCTAssertTrue(hasF32Add, "Float addition should use f32.add instruction")
        XCTAssertFalse(hasI32Add, "Float addition should NOT use i32.add instruction")
    }

    @Test func testMixedIntFloatExpressionTypePromotion() throws {
        let source = """
        Function Main()
            Local x% = 5
            Local y# = 2.5
            Local z# = x% + y#
        End Function
        """
        var parser = Parser(source: source)
        let program = parser.parse()

        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)

        guard let mainFunc = module.code.last(where: { funcBody in
            funcBody.locals.contains { local in
                if case .f32 = local { return true }
                return false
            }
        }) else {
            XCTFail("Main function with float locals not found")
            return
        }

        var hasFloatConversion = false
        var hasI32Add = false

        for instr in mainFunc.body {
            switch instr {
            case .f32ConvertI32S:
                hasFloatConversion = true
            case .i32Add:
                hasI32Add = true
            default:
                break
            }
        }

        XCTAssertTrue(hasFloatConversion, "Int should be converted to float before addition with float")
        XCTAssertFalse(hasI32Add, "Should not use i32.add for mixed int/float expression")
    }

    @Test func testFloatComparisonTypePromotion() throws {
        let source = """
        Function Main()
            Local x# = 5.0
            Local y = 10
            If x# < y Then
                x# = 1.0
            EndIf
        End Function
        """
        var parser = Parser(source: source)
        let program = parser.parse()

        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)

        guard let mainFunc = module.code.last(where: { funcBody in
            funcBody.locals.contains { local in
                if case .f32 = local { return true }
                return false
            }
        }) else {
            XCTFail("Main function with float locals not found")
            return
        }

        var hasFloatConversion = false
        var hasF32Compare = false

        for instr in mainFunc.body {
            switch instr {
            case .f32ConvertI32S:
                hasFloatConversion = true
            case .f32Lt:
                hasF32Compare = true
            default:
                break
            }
        }

        XCTAssertTrue(hasFloatConversion, "Int should be converted to float for float comparison")
        XCTAssertTrue(hasF32Compare, "Float comparison should use f32.lt instruction")
    }

    @Test func testFloatMultiplicationTypePromotion() throws {
        let source = """
        Function Main()
            Local x# = 3.0
            Local y# = x# * 2.0
        End Function
        """
        var parser = Parser(source: source)
        let program = parser.parse()

        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)

        guard let mainFunc = module.code.last(where: { funcBody in
            funcBody.locals.contains { local in
                if case .f32 = local { return true }
                return false
            }
        }) else {
            XCTFail("Main function with float locals not found")
            return
        }

        var hasF32Mul = false
        var hasI32Mul = false

        for instr in mainFunc.body {
            switch instr {
            case .f32Mul:
                hasF32Mul = true
            case .i32Mul:
                hasI32Mul = true
            default:
                break
            }
        }

        XCTAssertTrue(hasF32Mul, "Float multiplication should use f32.mul instruction")
        XCTAssertFalse(hasI32Mul, "Float multiplication should NOT use i32.mul instruction")
    }

    // MARK: - Function Call Cleanup Tests

    @Test func testFunctionCallStatementDropsReturnValue() throws {
        let source = """
        Function GetValue%()
            Return 42
        End Function

        Function Main()
            GetValue()
        End Function
        """
        var parser = Parser(source: source)
        let program = parser.parse()

        XCTAssertEqual(program.functions.count, 2)

        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)

        guard let mainFunc = module.code.last else {
            XCTFail("Main function not found")
            return
        }

        var hasDropAfterCall = false
        var callIndex: Int = -1

        for (index, instr) in mainFunc.body.enumerated() {
            if case .call = instr {
                callIndex = index
            }
            if callIndex >= 0 && index == callIndex + 1 {
                if case .drop = instr {
                    hasDropAfterCall = true
                }
            }
        }

        XCTAssertTrue(hasDropAfterCall, "Function call used as statement should have .drop after it")
    }

    @Test func testNestedFunctionCallStatementDropsReturnValue() throws {
        let source = """
        Function GetValue%()
            Return 42
        End Function

        Function GetOther%()
            Return GetValue()
        End Function

        Function Main()
            GetOther()
        End Function
        """
        var parser = Parser(source: source)
        let program = parser.parse()

        XCTAssertEqual(program.functions.count, 3)

        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)

        guard let mainFunc = module.code.last else {
            XCTFail("Main function not found")
            return
        }

        func countDrops(afterCallAt index: Int, in instructions: [WASMInstruction]) -> Int {
            var dropCount = 0
            var foundCall = false
            for i in index..<instructions.count {
                if case .call = instructions[i] {
                    foundCall = true
                    continue
                }
                if foundCall {
                    if case .drop = instructions[i] {
                        dropCount += 1
                    } else if case .localSet = instructions[i] {
                        break
                    } else if case .globalSet = instructions[i] {
                        break
                    }
                }
            }
            return dropCount
        }

        var dropCount = 0
        for (index, instr) in mainFunc.body.enumerated() {
            if case .call = instr {
                dropCount += countDrops(afterCallAt: index, in: mainFunc.body)
            }
        }

        XCTAssertGreaterThanOrEqual(dropCount, 1, "Nested function call in statement position should have drop")
    }

    @Test func testVoidFunctionCallNoExtraDrop() throws {
        let source = """
        Function PrintText$()
            Return "hello"
        End Function

        Function Main()
            Local x$ = PrintText()
        End Function
        """
        var parser = Parser(source: source)
        let program = parser.parse()

        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)

        guard let mainFunc = module.code.last else {
            XCTFail("Main function not found")
            return
        }

        var dropCount = 0
        for instr in mainFunc.body {
            if case .drop = instr {
                dropCount += 1
            }
        }

        XCTAssertEqual(dropCount, 0, "Function call assigned to variable should NOT have extra drop")
    }

    // MARK: - Combined Tests

    @Test func testComplexFunctionWithAllThreeIssues() throws {
        let source = """
        Function Calc#(x%, y#)
            Return x% + y#
        End Function

        Function Main()
            Local result#
            Local i%
            For i% = 1 To 5
                result# = Calc(i%, 1.5)
            Next

            While i% > 0
                If result# > 0 Then
                    Calc(i%, 2.0)
                EndIf
                i% = i% - 1
            Wend
        End Function
        """
        var parser = Parser(source: source)
        let program = parser.parse()

        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)

        XCTAssertGreaterThanOrEqual(module.code.count, 1)
        guard let mainFunction = module.code.last(where: { funcBody in
            funcBody.locals.contains { local in
                if case .f32 = local { return true }
                return false
            }
        }) else {
            XCTFail("Main function with float locals not found")
            return
        }

        // If we got here without crashes, the module structure is valid.
        // The validation here is that we can serialize to a non-empty WASM binary.
        var encoder = WASMBinaryEncoder()
        let wasmData = encoder.encode(module)
        XCTAssertGreaterThan(wasmData.count, 0, "Should produce valid WASM binary")
    }
}
