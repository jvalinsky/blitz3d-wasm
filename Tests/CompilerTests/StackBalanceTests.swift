import Testing
@testable import Blitz3DCompiler

/// Tests for stack balance correctness - catching real bugs from Session 6
struct StackBalanceTests {
    
    // MARK: - Statement Balance Tests
    
    // Note: calculateStackDelta tests removed - function is private and tested indirectly
    
    @Test func testReturnStatement_DoesNotLeaveValue() throws {
        let source = """
        Function GetValue%()
            Local x% = 5
            Return x
        End Function
        """
        
        let module = try compileToModule(source)
        
        // Validate the WASM
        XCTAssertNoThrow(try validateWASM(module), "Return statement should not leave value on stack")
    }
    
    @Test func testFunctionCallStatement_DropsReturnValue() throws {
        let source = """
        Function DoSomething%()
            Return 42
        End Function
        
        Function Main()
            DoSomething()
        End Function
        """
        
        let module = try compileToModule(source)
        XCTAssertNoThrow(try validateWASM(module), "Function call as statement should drop return value")
    }
    
    @Test func testArrayAssignment_FunctionCallSyntax() throws {
        // Bug discovered: IntroSFX(5) = value wasn't handled
        let source = """
        Dim MyArray%(10)
        
        Function Main()
            MyArray(5) = 42
        End Function
        """
        
        let module = try compileToModule(source)
        XCTAssertNoThrow(try validateWASM(module), "Array assignment via function-call syntax should work")
    }
    
    @Test func testFieldArrayAssignment_ResolutionFailure() throws {
        // Bug discovered: field array assignments failed resolution and left dummy i32.const(0)
        // This test verifies graceful handling even when field isn't found
        let source = """
        Type MyType
            Field value%
        End Type
        
        Function Main()
            Local obj.MyType = New MyType
            ; Even if this field doesn't exist, shouldn't leave values on stack
            obj\\unknownField = 42
        End Function
        """
        
        let module = try compileToModule(source)
        // Should compile (even if field unknown) and not crash validation
        XCTAssertNoThrow(try validateWASM(module), "Failed field resolution should still balance stack")
    }
    
    @Test func testAssignmentInIfThen_SingleLine() throws {
        // Colon-separated statements in single-line if-then
        let source = """
        Function Main()
            Local x% = 1
            Local y% = 0
            
            If x = 1 Then y = 5 : x = 10
        End Function
        """
        
        let module = try compileToModule(source)
        XCTAssertNoThrow(try validateWASM(module), "Colon-separated assignments in if-then should balance")
    }
    
    @Test func testStringConcatenationAssignment() throws {
        // Bug pattern: string concatenation assignments left 2 values
        let source = """
        Function Main()
            Local msg$ = ""
            msg = "Hello" + " " + "World"
        End Function
        """
        
        let module = try compileToModule(source)
        XCTAssertNoThrow(try validateWASM(module), "String concatenation assignment should balance")
    }
    
    @Test func testLocalDeclarationWithInitializer() throws {
        // Bug found: local declarations with function call initializers
        let source = """
        Function GetValue%()
            Return 42
        End Function
        
        Function Main()
            Local x% = GetValue()
        End Function
        """
        
        let module = try compileToModule(source)
        XCTAssertNoThrow(try validateWASM(module), "Local with function call initializer should balance")
    }
    
    @Test func testNestedIfStatements_CouldLeaveValues() throws {
        let source = """
        Function Main()
            Local x% = 1
            Local y% = 2
            
            If x = 1 Then
                If y = 2 Then
                    x = 10
                EndIf
            EndIf
        End Function
        """
        
        let module = try compileToModule(source)
        XCTAssertNoThrow(try validateWASM(module), "Nested if statements should balance")
    }
    
    // MARK: - Regression Tests from Session 6
    
    @Test func testUpdateEventsPattern_FieldArrayAssignment() throws {
        // Exact pattern from UpdateEvents.bb line 87
        let source = """
        Type NPCs
            Field State%
        End Type
        
        Type Rooms
            Field NPC.NPCs[12]
        End Type
        
        Type Events
            Field room.Rooms
        End Type
        
        Function SetNPCFrame(npc.NPCs, frame%)
        End Function
        
        Function Main()
            Local e.Events = New Events
            e\\room = New Rooms
            e\\room\\NPC[0] = New NPCs
            
            If e\\room\\NPC[0] <> Null Then SetNPCFrame(e\\room\\NPC[0], 74) : e\\room\\NPC[0]\\State = 8
        End Function
        """
        
        let module = try compileToModule(source)
        XCTAssertNoThrow(try validateWASM(module), "UpdateEvents pattern should compile and validate")
    }
    
    @Test func testAchievementsPattern_FunctionCallArray() throws {
        // Pattern from Achievements.bb
        let source = """
        Dim AchievementStrings$(10)
        Dim Achievements%(10)
        
        Function Main()
            Local i% = 0
            AchievementStrings(i) = "Test"
            Achievements(i) = 1
        End Function
        """
        
        let module = try compileToModule(source)
        XCTAssertNoThrow(try validateWASM(module), "Achievements array pattern should work")
    }

    @Test func testComparisonOperatorEqualLess_IsCanonicalized() throws {
        // Blitz3D accepts `=<` as a synonym for `<=` (SCPCB uses this).
        let source = """
        Function Main()
            Local x% = 0
            If 1 =< 2 Then x = 1
        End Function
        """

        let module = try compileToModule(source)
        XCTAssertNoThrow(try validateWASM(module))
    }

    @Test func testDeleteStatement_DoesNotAssumeLocal0Exists() throws {
        // Regression: Delete used a hard-coded local[0] scratch, which fails in functions with no locals.
        let source = """
        Type T
            Field x%
        End Type

        Function Main()
            Delete Each T
        End Function
        """

        let module = try compileToModule(source)
        XCTAssertNoThrow(try validateWASM(module))
    }

    @Test func testForwardCallStatement_DropsReturnValue() throws {
        // Regression: statement-level drop decisions must work even when the callee is defined later.
        let source = """
        Function Main()
            B()
        End Function

        Function B%()
            Return 1
        End Function
        """

        let module = try compileToModule(source)
        XCTAssertNoThrow(try validateWASM(module))
    }

    @Test func testVoidImportCallInIf_DoesNotUnderflow() throws {
        // Regression: do not drop after void imports (e.g. Flip).
        let source = """
        Function Main()
            If 1 Then Flip()
        End Function
        """

        let module = try compileToModule(source)
        XCTAssertNoThrow(try validateWASM(module))
    }
    
    // MARK: - Helper Methods
    
    private func compileToModule(_ source: String) throws -> WASMModule {
        var parser = Parser(source: source)
        let program = parser.parse()
        var codeGen = CodeGenerator()
        return codeGen.generate(from: program)
    }
    
    private func validateWASM(_ module: WASMModule) throws {
        // Validate stack types and ensure local indices are in range.
        // This catches a large class of "wasm-validate"/JS instantiation errors without shelling out.

        func walkInstructions(_ instructions: [WASMInstruction], visit: (WASMInstruction) -> Void) {
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
                    if let elseBody { walkInstructions(elseBody, visit: visit) }
                default:
                    visit(instr)
                }
            }
        }

        final class ModuleTypeContext: ValidatorTypeContext {
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

        for function in module.code {
            guard function.typeIndex >= 0 && function.typeIndex < module.types.count else {
                throw ValidationError("Function typeIndex out of range")
            }

            let sig = module.types[function.typeIndex]
            let paramCount = sig.parameters.count
            let maxLocal = paramCount + function.locals.count - 1

            // Local index range scan (catches invalid local.get/set/tee).
            walkInstructions(function.body) { instr in
                let localIdx: Int?
                switch instr {
                case .localGet(let idx), .localSet(let idx), .localTee(let idx):
                    localIdx = idx
                default:
                    localIdx = nil
                }
                if let idx = localIdx, idx > maxLocal {
                    XCTFail("Invalid local index \(idx) (max \(maxLocal)) in function typeIndex=\(function.typeIndex)")
                }
            }

            // Stack/type validation.
            let validator = StackValidator(returnTypes: sig.results)
            let typeContext = ModuleTypeContext(module: module, function: function)
            validator.typeContext = typeContext
            for instr in function.body {
                validator.validateInstruction(instr)
            }

            if !validator.isValid {
                XCTFail("Stack validation failed:\n\(validator.errors.joined(separator: "\n"))")
            }
        }
    }

    private struct ValidationError: Error, CustomStringConvertible {
        let description: String
        init(_ description: String) { self.description = description }
    }
}
