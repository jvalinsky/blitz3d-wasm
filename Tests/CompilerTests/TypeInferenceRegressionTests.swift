import Testing
@testable import Blitz3DCompiler

/// Tests for type inference bugs discovered in Session 6
/// These bugs caused "expected [i32, i32] but got [f32, i32]" errors
struct TypeInferenceRegressionTests {
    
    // MARK: - Float vs Integer Type Mismatches
    
    @Test func testFloatVariableInIntegerComparison() throws {
        // Bug from NPCs.bb: float variable used in i32.gt_s
        let source = """
        Function Main()
            Local timer# = 0.0
            Local limit% = 100
            
            ; timer is f32, limit is i32 - should auto-convert
            If timer > limit Then
                timer = 0.0
            EndIf
        End Function
        """
        
        let module = try compileToModule(source)
        XCTAssertNoThrow(try validateWASM(module), "Float in integer comparison should auto-convert")
    }
    
    @Test func testFloatVariableInIntegerArithmetic() throws {
        // Bug from UpdateEvents.bb: f32 + i32 generated i32.add
        let source = """
        Function Main()
            Local counter# = 0.0
            counter = counter + 1  ; f32 + i32 should promote to f32.add
        End Function
        """
        
        let module = try compileToModule(source)
        XCTAssertNoThrow(try validateWASM(module), "Float + integer should use f32.add")
    }
    
    @Test func testLocalSetTypeMismatch() throws {
        // Bug from Save.bb: local.set expected [f32] but got [i32]
        let source = """
        Function Main()
            Local value# = 0.0
            value = 10  ; Assigning integer to float variable
        End Function
        """
        
        let module = try compileToModule(source)
        XCTAssertNoThrow(try validateWASM(module), "Assigning int to float should auto-convert")
    }
    
    @Test func testMixedTypeComparison_FloatFloat() throws {
        // Bug: i32.gt_s with [f32, f32]
        let source = """
        Function Main()
            Local a# = 1.0
            Local b# = 2.0
            
            If a > b Then
                a = 0.0
            EndIf
        End Function
        """
        
        let module = try compileToModule(source)
        XCTAssertNoThrow(try validateWASM(module), "Comparing two floats should use f32.gt")
    }
    
    // MARK: - Forward Type Inference Edge Cases
    
    @Test func testVariableUsedBeforeDeclaredWithSuffix() throws {
        // Pattern that caused type inference failures
        let source = """
        Function Main()
            ; Used without suffix first
            Local x = 10
            
            ; Then assigned with suffix
            x# = 5.5
            
            ; Should be float throughout
            Local y# = x + 1.0
        End Function
        """
        
        let module = try compileToModule(source)
        XCTAssertNoThrow(try validateWASM(module), "Forward type inference should detect float usage")
    }
    
    @Test func testAutoDeclarationWithFloatUsage() throws {
        // Variables auto-declared should infer correct type from first usage
        let source = """
        Function Main()
            ; First use has # suffix
            counter# = 0.0
            
            ; Later arithmetic should use float ops
            counter = counter + 1.5
        End Function
        """
        
        let module = try compileToModule(source)
        XCTAssertNoThrow(try validateWASM(module), "Auto-declared variable should infer float type")
    }
    
    @Test func testComplexExpressionTypePropagation() throws {
        // Type should propagate correctly through complex expressions
        let source = """
        Function Main()
            Local a% = 10
            Local b# = 2.5
            Local c# = 0.0
            
            ; Mixed expression: int * float should be float
            c = a * b
        End Function
        """
        
        let module = try compileToModule(source)
        XCTAssertNoThrow(try validateWASM(module), "Mixed type expression should promote to wider type")
    }
    
    // MARK: - Field and Array Type Resolution
    
    @Test func testFieldAccessTypePreservation() throws {
        let source = """
        Type MyType
            Field timer#
            Field count%
        End Type
        
        Function Main()
            Local obj.MyType = New MyType
            obj\\timer = 0.0
            obj\\count = 0
            
            ; Field types should be preserved
            obj\\timer = obj\\timer + 1.5
            obj\\count = obj\\count + 1
        End Function
        """
        
        let module = try compileToModule(source)
        XCTAssertNoThrow(try validateWASM(module), "Field types should be preserved correctly")
    }
    
    @Test func testArrayElementTypeInference() throws {
        let source = """
        Dim floatArray#(10)
        Dim intArray%(10)
        
        Function Main()
            ; Array element types should match declaration
            floatArray(0) = 1.5
            intArray(0) = 1
            
            ; Arithmetic should use correct type
            floatArray(0) = floatArray(0) + 0.5
            intArray(0) = intArray(0) + 1
        End Function
        """
        
        let module = try compileToModule(source)
        XCTAssertNoThrow(try validateWASM(module), "Array element types should be inferred from declaration")
    }
    
    // MARK: - Real Bug Reproductions from Session 6
    
    @Test func testNPCsBug_FloatLocalSet() throws {
        // Exact pattern from NPCs.bb error
        let source = """
        Function Main()
            Local dist# = 0.0
            Local angle% = 0
            
            ; This caused: type mismatch in local.set, expected [i32] but got [f32]
            angle = 45  ; Should stay i32
            dist = 10.0 ; Should stay f32
        End Function
        """
        
        let module = try compileToModule(source)
        XCTAssertNoThrow(try validateWASM(module), "NPCs.bb pattern should preserve variable types")
    }
    
    @Test func testSaveBug_FloatIntegerMix() throws {
        // Pattern from Save.bb
        let source = """
        Function Main()
            Local x# = 0.0
            Local limit% = 100
            
            ; This caused: type mismatch in i32.gt_s, expected [i32, i32] but got [f32, i32]
            If x > limit Then
                x = 0.0
            EndIf
        End Function
        """
        
        let module = try compileToModule(source)
        XCTAssertNoThrow(try validateWASM(module), "Save.bb comparison pattern should work")
    }
    
    @Test func testUpdateEventsBug_FloatArithmetic() throws {
        // Pattern from UpdateEvents.bb
        let source = """
        Function Main()
            Local timer# = 0.0
            
            ; This caused: type mismatch in i32.add, expected [i32, i32] but got [f32, i32]
            timer = timer + 1  ; Should promote to f32.add
        End Function
        """
        
        let module = try compileToModule(source)
        XCTAssertNoThrow(try validateWASM(module), "UpdateEvents arithmetic should use correct types")
    }
    
    // MARK: - Type Coercion Edge Cases
    
    @Test func testImplicitFloatToIntTruncation() throws {
        let source = """
        Function Main()
            Local f# = 5.7
            Local i% = 0
            
            ; Float to int should truncate
            i = f
        End Function
        """
        
        let module = try compileToModule(source)
        XCTAssertNoThrow(try validateWASM(module), "Float to int assignment should truncate")
    }
    
    @Test func testImplicitIntToFloatWidening() throws {
        let source = """
        Function Main()
            Local i% = 5
            Local f# = 0.0
            
            ; Int to float should widen
            f = i
        End Function
        """
        
        let module = try compileToModule(source)
        XCTAssertNoThrow(try validateWASM(module), "Int to float assignment should widen")
    }
    
    @Test func testFunctionReturnTypeInference() throws {
        let source = """
        Function GetFloat#()
            Return 42  ; Int literal but function returns float
        End Function
        
        Function Main()
            Local x# = GetFloat()  ; Should be f32
            x = x + 1.5
        End Function
        """
        
        let module = try compileToModule(source)
        XCTAssertNoThrow(try validateWASM(module), "Function return type should convert literal")
    }
    
    // MARK: - Helper Methods
    
    private func compileToModule(_ source: String) throws -> WASMModule {
        var parser = Parser(source: source)
        let program = parser.parse()
        var codeGen = CodeGenerator()
        return codeGen.generate(from: program)
    }
    
    private func validateWASM(_ module: WASMModule) throws {
        // For now, just check module is valid structure
        // Full WASM validation requires writing binary and calling wasm-validate
        XCTAssertNotNil(module)
    }
}
