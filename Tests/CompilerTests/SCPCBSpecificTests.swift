//
//  SCPCBSpecificTests.swift
//  CompilerTests
//
//  Tests for SCP:CB specific functions
//

import Testing
@testable import Blitz3DCompiler

struct SCPCBSpecificTests {
    
    @Test func testOpenMovie() throws {
        let source = """
        Function TestOpenMovie()
            Local movie = OpenMovie("intro.mp4")
        End Function
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThan(module.code.count, 0)
    }
    
    @Test func testDrawMovie() throws {
        let source = """
        Function TestDrawMovie()
            Local movie = OpenMovie("intro.mp4")
            DrawMovie(movie, 0, 0, 800, 600)
        End Function
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThan(module.code.count, 0)
    }
    
    @Test func testMoviePlaying() throws {
        let source = """
        Function TestMoviePlaying()
            Local movie = OpenMovie("intro.mp4")
            Local playing = MoviePlaying(movie)
        End Function
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThan(module.code.count, 0)
    }
    
    @Test func testZlibWapiOpen() throws {
        let source = """
        Function TestZlibOpen()
            Local zip = ZlibWapi_Open("assets.zip")
        End Function
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThan(module.code.count, 0)
    }
    
    @Test func testZlibWapiGetFileCount() throws {
        let source = """
        Function TestZlibGetFileCount()
            Local zip = ZlibWapi_Open("assets.zip")
            Local count = ZlibWapi_GetFileCount(zip)
        End Function
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThan(module.code.count, 0)
    }
    
    @Test func testZlibWapiExtractFile() throws {
        let source = """
        Function TestZlibExtract()
            Local zip = ZlibWapi_Open("assets.zip")
            Local result = ZlibWapi_ExtractFile(zip, 0, "extracted/mesh.b3d")
        End Function
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThan(module.code.count, 0)
    }
    
    @Test func testOpenTCPStream() throws {
        let source = """
        Function TestTCPStream()
            Local stream = OpenTCPStream("localhost", 8080)
        End Function
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThan(module.code.count, 0)
    }
    
    @Test func testWriteLine() throws {
        let source = """
        Function TestWriteLine()
            Local stream = OpenTCPStream("localhost", 8080)
            WriteLine(stream, "Hello Server")
        End Function
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThan(module.code.count, 0)
    }
    
    @Test func testReadLine() throws {
        let source = """
        Function TestReadLine()
            Local stream = OpenTCPStream("localhost", 8080)
            Local line$ = ReadLine(stream)
        End Function
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThan(module.code.count, 0)
    }
    
    @Test func testReadAvail() throws {
        let source = """
        Function TestReadAvail()
            Local stream = OpenTCPStream("localhost", 8080)
            Local avail = ReadAvail(stream)
        End Function
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThan(module.code.count, 0)
    }
    
    @Test func testSendNetMsg() throws {
        let source = """
        Function TestSendNetMsg()
            Local stream = OpenTCPStream("localhost", 8080)
            SendNetMsg(stream, 1, 100, "test data", 1)
        End Function
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThan(module.code.count, 0)
    }
    
    @Test func testSCPIntroSequence() throws {
        let source = """
        Function PlayIntro()
            ' Open and play intro movie
            Local movie = OpenMovie("media/intro.mp4")
            If movie <> 0
                DrawMovie(movie, 0, 0, 800, 600)
                While Not MoviePlaying(movie)
                    Delay(100)
                Wend
                While MoviePlaying(movie)
                    Flip
                Wend
            End If
            
            ' Load game assets from zip
            Local zip = ZlibWapi_Open("assets.zip")
            If zip <> 0
                Local count = ZlibWapi_GetFileCount(zip)
                For i = 0 To count - 1
                    Local name$ = ZlibWapi_GetFileName(zip, i)
                    ZlibWapi_ExtractFile(zip, i, "cache/" + name)
                Next
                ZlibWapi_Close(zip)
            End If
        End Function
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        XCTAssertEqual(program.functions.count, 1)
        XCTAssertEqual(program.functions[0].name, "PlayIntro")
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThan(module.code.count, 0)
    }
}
