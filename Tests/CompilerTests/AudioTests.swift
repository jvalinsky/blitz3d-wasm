//
//  AudioTests.swift
//  CompilerTests
//
//  Tests for Audio API functions compilation
//

import Testing
@testable import Blitz3DCompiler

struct AudioTests {
    
    @Test func testLoadSound() throws {
        let source = """
        Function TestLoadSound()
            Local snd = LoadSound("scream.wav")
        End Function
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThan(module.code.count, 0)
    }
    
    @Test func testPlaySound() throws {
        let source = """
        Function TestPlaySound()
            Local snd = LoadSound("scream.wav")
            Local ch = PlaySound(snd)
        End Function
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThan(module.code.count, 0)
    }
    
    @Test func testFreeSound() throws {
        let source = """
        Function TestFreeSound()
            Local snd = LoadSound("scream.wav")
            FreeSound(snd)
        End Function
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThan(module.code.count, 0)
    }
    
    @Test func testChannelVolume() throws {
        let source = """
        Function TestChannelVolume()
            Local ch = PlaySound(1)
            ChannelVolume(ch, 0.5)
        End Function
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThan(module.code.count, 0)
    }
    
    @Test func testChannelPaused() throws {
        let source = """
        Function TestChannelPaused()
            Local ch = PlaySound(1)
            ChannelPaused(ch, 1)
            ChannelPaused(ch, 0)
        End Function
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThan(module.code.count, 0)
    }
    
    @Test func testFSOUND_Init() throws {
        let source = """
        Function TestFSOUND_Init()
            Local result = FSOUND_Init(44100, 32, 0)
        End Function
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThan(module.code.count, 0)
    }
    
    @Test func testFSOUND_StreamOpen() throws {
        let source = """
        Function TestStreamOpen()
            Local stream = FSOUND_Stream_Open("ambient.ogg", 0, 0, 0)
        End Function
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThan(module.code.count, 0)
    }
    
    @Test func testFSOUND_StreamPlay() throws {
        let source = """
        Function TestStreamPlay()
            Local stream = FSOUND_Stream_Open("music.mp3", 0, 0, 0)
            FSOUND_Stream_Play(0, stream)
        End Function
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThan(module.code.count, 0)
    }
    
    @Test func testFSOUND_StreamStop() throws {
        let source = """
        Function TestStreamStop()
            Local stream = FSOUND_Stream_Open("music.mp3", 0, 0, 0)
            FSOUND_Stream_Play(0, stream)
            FSOUND_Stream_Stop(stream)
        End Function
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThan(module.code.count, 0)
    }
    
    @Test func testFSOUND_SetVolume() throws {
        let source = """
        Function TestSetVolume()
            Local stream = FSOUND_Stream_Open("music.mp3", 0, 0, 0)
            FSOUND_SetVolume(stream, 0.75)
        End Function
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThan(module.code.count, 0)
    }
    
    @Test func testSound3D() throws {
        let source = """
        Function TestSound3D()
            Local snd = LoadSound("footstep.wav")
            Sound3D(snd, 10, 0, 5)
        End Function
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThan(module.code.count, 0)
    }
    
    @Test func testSetListenerLocation() throws {
        let source = """
        Function TestListener()
            SetListenerLocation(0, 0, 0, 0, 0, -1, 0, 1, 0)
        End Function
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThan(module.code.count, 0)
    }
    
    @Test func testAudioSystemIntegration() throws {
        let source = """
        Function InitAudio()
            FSOUND_Init(44100, 32, 0)
            
            Local music = FSOUND_Stream_Open("music.ogg", 0, 0, 0)
            If music <> 0
                FSOUND_SetVolume(music, 0.8)
                FSOUND_Stream_Play(0, music)
            End If
            
            Local scream = LoadSound("scream.wav")
            If scream <> 0
                Local ch = PlaySound(scream)
                If ch <> 0
                    ChannelVolume(ch, 1.0)
                End If
            End If
        End Function
        """
        
        var parser = Parser(source: source)
        let program = parser.parse()
        
        XCTAssertEqual(program.functions.count, 1)
        XCTAssertEqual(program.functions[0].name, "InitAudio")
        
        var codeGen = CodeGenerator()
        let module = codeGen.generate(from: program)
        
        XCTAssertGreaterThan(module.code.count, 0)
    }
}
