; NPC Demo - Load and animate an NPC model via WASM
; This demonstrates WASM-compiled code controlling 3D model rendering

Graphics3D 800, 600, 0, 2

PrintString "=== NPC Demo ==="
PrintString "Loading NPC model..."

; Create camera
camera = CreateCamera()
PositionEntity camera, 0, 2, -8
CameraRange camera, 0.1, 1000

; Create lights
AmbientLight 60, 60, 60

dirLight = CreateLight(1)
PositionEntity dirLight, 5, 10, -5
RotateEntity dirLight, 45, 45, 0

; Create ground
ground = CreatePlane(0)
PositionEntity ground, 0, 0, 0
ScaleEntity ground, 20, 1, 20
; Make ground gray
groundBrush = CreateBrush()
BrushColor groundBrush, 80, 80, 80
PaintEntity ground, groundBrush

PrintString "Loading NPC model from WASM..."

; Load NPC model - this is controlled entirely by WASM-compiled BB code!
npc = LoadAnimMesh("GFX/npcs/035.b3d")

If npc = 0
    PrintString "Failed to load NPC, using placeholder"
    npc = CreateCube(0)
EndIf

PositionEntity npc, 0, 0, 0
PrintString "NPC loaded!"

; Start animation (loop, normal speed, sequence 0)
Animate npc, 1, 1.0, 0, 0

PrintString ""
PrintString "NPC Animation Control:"
PrintString "SPACE - Toggle animation"
PrintString "WASD - Move camera"
PrintString "1/2 - Slower/Faster animation"
PrintString ""
PrintString "Animating..."

; Animation state
animating = 1
animSpeed# = 1.0

frame = 0
While Not KeyHit(1)
    ; Camera controls
    If KeyDown(17) ; W
        MoveEntity camera, 0, 0, 0.1
    EndIf
    If KeyDown(31) ; S
        MoveEntity camera, 0, 0, -0.1
    EndIf
    If KeyDown(30) ; A
        MoveEntity camera, -0.1, 0, 0
    EndIf
    If KeyDown(32) ; D
        MoveEntity camera, 0.1, 0, 0
    EndIf
    
    ; Animation speed controls
    If KeyHit(2) ; 1
        animSpeed# = animSpeed# * 0.5
        If animSpeed# < 0.1 Then animSpeed# = 0.1
        Animate npc, animating, animSpeed#, 0, 0
        PrintString "Speed: " + animSpeed#
    EndIf
    If KeyHit(3) ; 2
        animSpeed# = animSpeed# * 2.0
        If animSpeed# > 4.0 Then animSpeed# = 4.0
        Animate npc, animating, animSpeed#, 0, 0
        PrintString "Speed: " + animSpeed#
    EndIf
    
    ; Toggle animation
    If KeyHit(57) ; Space
        animating = 1 - animating
        Animate npc, animating, animSpeed#, 0, 0
        If animating = 1
            PrintString "Animation ON"
        Else
            PrintString "Animation OFF"
        EndIf
    EndIf
    
    ; NPC AI: simple wandering behavior controlled by WASM
    frame = frame + 1
    If frame > 60
        frame = 0
        ; Every second, slightly rotate NPC
        TurnEntity npc, 0, Rand(-5, 5), 0
    EndIf
    
    ; Render
    RenderWorld
    
    ; HUD
    Text 10, 10, "NPC Demo - WASM-Controlled Animation", True
    Text 10, 35, "NPC Entity: " + npc
    Text 10, 55, "Animating: " + Animating(npc)
    Text 10, 75, "Anim Time: " + AnimTime(npc)
    Text 10, 95, "Anim Length: " + AnimLength(npc)
    Text 10, 115, "NPC Position: " + EntityX(npc) + ", " + EntityY(npc) + ", " + EntityZ(npc)
    Text 10, 550, "Controls: WASD=camera, SPACE=toggle anim, 1/2=speed", True
    
    Flip
Wend

PrintString "Demo complete!"
End
