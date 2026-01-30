; ============================================================
; Demo: Integration Sandbox
; Playable demo with Input, 3D Audio, and Advanced Rendering.
; ============================================================

Graphics3D 800, 600, 32, 2

cam = CreateCamera()
PositionEntity cam, 0, 1.7, -5

; Set up fog for depth
FogMode 1
FogColor 10, 10, 15
FogRange 1, 50

; Load Environment
room = LoadMesh("GFX/map/room2_opt.smpk")

; Load and Emit 3D Audio
hiss = Load3DSound("SFX/General/Hiss.ogg")
LoopSound hiss
EmitSound hiss, room ; Point source at room origin

; Integration Logic
Repeat
    ; WASD movement
    If KeyDown(17) MoveEntity cam, 0, 0, 0.1  ; W
    If KeyDown(31) MoveEntity cam, 0, 0, -0.1 ; S
    If KeyDown(30) TurnEntity cam, 0, 2, 0    ; A
    If KeyDown(32) TurnEntity cam, 0, -2, 0   ; D

    RenderWorld
    
    Text 10, 10, "Integration Sandbox: WASD to walk, listen for 3D positional hiss."
    Text 10, 30, "Features: Fog, Smpk Rendering, WebAudio 3D, Pointer Lock Input."

    Flip
Until KeyHit(1)
