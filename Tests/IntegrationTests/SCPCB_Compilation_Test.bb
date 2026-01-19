; SCP:CB Compilation Test
; Tests key patterns used in SCP: Containment Breach

; ============================================
; TYPE DEFINITIONS (with arrays and defaults)
; ============================================

Type TNPC
    Field ID%
    Field Name$
    Field Position#[3]
    Field NPCs[12]
    Field Health% = 100
    Field Alive% = 1
End Type

Type TSoundEmitter
    Field Sound$
    Field Volume# = 1.0
    Field Positions#[3]
    Field Sounds[16]
End Type

Type TDoor
    Field Open% = 0
    Field KeyRequired$
    Field Position#[3]
End Type

; ============================================
; GLOBAL VARIABLES
; ============================================

Global PlayerCamera%
Global ScreenWidth% = 800
Global ScreenHeight% = 600
Global GameRunning% = 1
Global CurrentZone% = 1

; ============================================
; MAIN GAME LOOP
; ============================================

Function StartGame()
    SeedRnd(12345)
    
    ; Create player camera
    PlayerCamera = CreateCamera()
    CameraRange(PlayerCamera, 0.1, 1000)
    CameraClsColor(PlayerCamera, 0, 0, 0)
    
    ; Initialize NPC system
    InitializeNPCs()
    
    ; Main loop
    While GameRunning = 1
        UpdateGame()
        RenderWorld()
        Flip
    Wend
End Function

Function UpdateGame()
    ; Handle input
    HandleInput()
    
    ; Update NPCs
    UpdateNPCs()
    
    ; Check zone transitions
    Select CurrentZone
        Case 1
            UpdateZone1()
        Case 2, 3
            UpdateZone2()
        Default
            UpdateZone1()
    End Select
End Function

Function HandleInput()
    If KeyDown(1) Then GameRunning = 0 ; ESC to quit
    
    If KeyDown(200) ; Up arrow
        MoveEntity PlayerCamera, 0, 0, 0.1
    End If
    
    If KeyDown(208) ; Down arrow
        MoveEntity PlayerCamera, 0, 0, -0.1
    End If
    
    If KeyHit(15) ; Tab
        ToggleDebugMode()
    End If
End Function

; ============================================
; NPC SYSTEM (using Handle/Object)
; ============================================

Function InitializeNPCs()
    Local i%
    
    For i = 1 To 5
        Local npc.TNPC = New TNPC
        npc\ID = i
        npc\Name = "Subject-" + Str(i)
        npc\Health = 100
        npc\Alive = 1
        
        ; Get handle for saving/serialization
        Local h = Handle(npc)
        
        ; Restore from handle
        Local npc2.TNPC = Object.TNPC(h)
        If npc2 <> Null
            npc2\Health = npc\Health
        End If
    Next
End Function

Function UpdateNPCs()
    Local npc.TNPC = First TNPC
    
    While npc <> Null
        If npc\Alive = 1
            ; Update NPC behavior
            UpdateNPC(npc)
        End If
        
        npc = After npc
    Wend
End Function

Function UpdateNPC(npc.TNPC)
    Local h = Handle(npc)
    
    ; NPC AI logic would go here
    Select npc\ID
        Case 1
            ; Patrol behavior
        Case 2
            ; Chase behavior
        Default
            ; Idle behavior
    End Select
End Function

; ============================================
; ZONE MANAGEMENT
; ============================================

Function UpdateZone1()
    Local zoneMsg$ = "Zone 1 - Test Chamber"
    
    If CurrentZone = 1
        ; Zone 1 specific logic
        ProcessTestChamber()
    End If
End Function

Function UpdateZone2()
    ; Zone 2 logic
End Function

Function ProcessTestChamber()
    Local door.TDoor = First TDoor
    
    While door <> Null
        If door\Open = 0
            ; Check if door should open
        End If
        door = After door
    Wend
End Function

Function ToggleDebugMode()
    ; Toggle debug overlay
End Function

; ============================================
; AUDIO SYSTEM (using FMOD stubs)
; ============================================

Function InitializeAudio()
    FSOUND_Init(44100, 32, 0)
    
    Local bgm = FSOUND_Stream_Open("media/ambience.ogg", 0, 0, 0)
    If bgm <> 0
        FSOUND_SetVolume(bgm, 0.8)
        FSOUND_Stream_Play(0, bgm)
    End If
    
    Local scream = LoadSound("media/scream.wav")
    If scream <> 0
        Local ch = PlaySound(scream)
        If ch <> 0
            ChannelVolume(ch, 1.0)
        End If
    End If
End Function

; ============================================
; ASSET LOADING (using ZIP)
; ============================================

Function LoadGameAssets()
    ; Load assets from ZIP archive
    Local zip = ZlibWapi_Open("assets.zip")
    
    If zip <> 0
        Local count = ZlibWapi_GetFileCount(zip)
        
        For i = 0 To count - 1
            Local filename$ = ZlibWapi_GetFileName(zip, i)
            Local dest$ = "cache/" + filename
            
            ZlibWapi_ExtractFile(zip, i, dest)
        Next
        
        ZlibWapi_Close(zip)
    End If
End Function

; ============================================
; MOVIE PLAYBACK (intro)
; ============================================

Function PlayIntroMovie()
    Local movie = OpenMovie("media/intro.mp4")
    
    If movie <> 0
        DrawMovie(movie, 0, 0, ScreenWidth, ScreenHeight)
        
        While Not MoviePlaying(movie)
            Delay(100)
        Wend
        
        While MoviePlaying(movie)
            Flip
        Wend
    End If
End Function

; ============================================
; STRING UTILITIES
; ============================================

Function FormatNPCName$(npcID%)
    Local name$ = "NPC-" + Str(npcID)
    name$ = Upper(name$)
    name$ = Left(name$, 8)
    Return name$
End Function

Function ExtractExtension$(filename$)
    Local pos = Instr(filename$, ".")
    If pos > 0
        Return Mid(filename$, pos + 1)
    End If
    Return ""
End Function

; ============================================
; DATA STATEMENTS
; ============================================

Function LoadNPCData()
    Restore NPCDataLabel
    
    Local npc.TNPC = First TNPC
    While npc <> Null
        ReadData npc\ID, npc\Health
        npc = After npc
    Wend
    
    .NPCDataLabel
    Data 1, 100, 2, 100, 3, 100
End Function

; ============================================
; START
; ============================================

; Play intro movie
PlayIntroMovie()

; Initialize systems
LoadGameAssets()
InitializeAudio()

; Start main game loop
StartGame()

; Exit message
Print "Game Over"
End
