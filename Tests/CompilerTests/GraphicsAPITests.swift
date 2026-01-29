//
//  GraphicsAPITests.swift
//  CompilerTests
//
//  Tests for Graphics API functions compilation
//

import XCTest
@testable import Blitz3DCompiler

final class GraphicsAPITests: XCTestCase {
    
    func testEntityAlpha() throws {
        let source = """
        Function TestAlpha()
            Local ent = CreateCube()
            EntityAlpha(ent, 0.5)
        End Function
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThan(module.code.count, 0)
    }
    
    func testEntityColor() throws {
        let source = """
        Function TestColor()
            Local ent = CreateSphere()
            EntityColor(ent, 255, 128, 64)
        End Function
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThan(module.code.count, 0)
    }
    
    func testEntityFX() throws {
        let source = """
        Function TestFX()
            Local ent = CreatePlane()
            EntityFX(ent, 1)  ' fullbright
        End Function
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThan(module.code.count, 0)
    }
    
    func testEntityBlend() throws {
        let source = """
        Function TestBlend()
            Local ent = CreateCube()
            EntityBlend(ent, 3)  ' additive
        End Function
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThan(module.code.count, 0)
    }
    
    func testPointEntity() throws {
        let source = """
        Function TestPointEntity()
            Local cam = CreateCamera()
            Local target = CreateCube()
            PointEntity(cam, target)
        End Function
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThan(module.code.count, 0)
    }
    
    func testNameEntity() throws {
        let source = """
        Function TestNameEntity()
            Local ent = CreateLight()
            NameEntity(ent, "myLight")
        End Function
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThan(module.code.count, 0)
    }
    
    func testEntityName() throws {
        let source = """
        Function TestEntityName()
            Local ent = CreatePivot()
            Local n$ = EntityName(ent)
        End Function
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThan(module.code.count, 0)
    }
    
    func testVertexTexCoords() throws {
        let source = """
        Function TestVertexTexCoords()
            Local mesh = CreateMesh()
            Local surf = CreateSurface(mesh, 0)
            Local v = AddVertex(surf, 0, 0, 0, 0, 0)
            VertexTexCoords(surf, v, 0.5, 0.5)
        End Function
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThan(module.code.count, 0)
    }
    
    func testCombinedEntityProperties() throws {
        let source = """
        Function SetupNPC(npc%)
            Local ent = CreateCube()
            EntityColor(ent, 255, 0, 0)
            EntityAlpha(ent, 0.8)
            EntityFX(ent, 1)
            EntityBlend(ent, 3)
            NameEntity(ent, "NPC_" + Str(npc))
            Return ent
        End Function
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        XCTAssertEqual(program.functions.count, 1)
        XCTAssertEqual(program.functions[0].name, "SetupNPC")
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)

        XCTAssertGreaterThan(module.code.count, 0)
    }

    // MARK: - Entity Parenting Tests

    func testEntityParentingCompiles() throws {
        let source = """
        Local grandparent = CreatePivot()
        Local parent = CreatePivot()
        Local child = CreatePivot()

        PositionEntity grandparent, 10, 0, 0
        RotateEntity grandparent, 0, 90, 0

        PositionEntity parent, 5, 0, 0
        RotateEntity parent, 45, 0, 0
        EntityParent parent, grandparent

        PositionEntity child, 0, 3, 0
        EntityParent child, parent

        Local gx# = EntityX(child, 1)
        Local gy# = EntityY(child, 1)
        Local gz# = EntityZ(child, 1)
        """

        var parser = Parser(source: source)
        let program = parser.parse()

        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)

        XCTAssertGreaterThan(module.code.count, 0, "Multi-level parenting should produce code")

        // Verify it encodes to valid WASM binary
        var encoder = WASMBinaryEncoder()
        let bytes = encoder.encode(module)
        XCTAssertGreaterThan(bytes.count, 8, "Should produce valid WASM binary")
        XCTAssertEqual(bytes[0], 0x00)
        XCTAssertEqual(bytes[1], 0x61) // 'a'
        XCTAssertEqual(bytes[2], 0x73) // 's'
        XCTAssertEqual(bytes[3], 0x6D) // 'm'
    }

    func testEntityGlobalPositionQuery() throws {
        // Tests that EntityX/Y/Z with global=1 compiles correctly
        // This exercises the parent chain walk with rotation and scale
        let source = """
        Function TestGlobalPos#(ent%, axis%)
            If axis = 0 Then Return EntityX(ent, 1)
            If axis = 1 Then Return EntityY(ent, 1)
            Return EntityZ(ent, 1)
        End Function
        """

        var parser = Parser(source: source)
        let program = parser.parse()

        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)

        XCTAssertGreaterThan(module.code.count, 0, "Global position query should produce code")

        var encoder = WASMBinaryEncoder()
        let bytes = encoder.encode(module)
        XCTAssertGreaterThan(bytes.count, 8, "Should produce valid WASM binary")
    }
}
