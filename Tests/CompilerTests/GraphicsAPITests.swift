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
}
