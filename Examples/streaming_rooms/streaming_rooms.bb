; ============================================================
; Demo: Non-Blocking Asset Streaming
; Shows how rooms can be loaded in the background without hitches.
; ============================================================

Graphics3D 800, 600, 32, 2

cam = CreateCamera()
PositionEntity cam, 0, 1, 0

light = CreateLight()
RotateEntity light, 90, 0, 0

; Load Initial Room
Print "Loading Room A..."
roomA = LoadMesh("GFX/map/room2_opt.smpk")
PositionEntity roomA, 0, 0, 0

roomB = 0
loadingB = False

Repeat
    ; Simple WASD movement
    If KeyDown(17) MoveEntity cam, 0, 0, 0.1  ; W
    If KeyDown(31) MoveEntity cam, 0, 0, -0.1 ; S
    If KeyDown(30) TurnEntity cam, 0, 2, 0    ; A
    If KeyDown(32) TurnEntity cam, 0, -2, 0   ; D

    ; Trigger background load of Room B
    If KeyHit(57) And (Not loadingB) ; Space
        Print "Streaming Room B in background..."
        roomB = LoadMesh("GFX/map/room3_opt.smpk")
        PositionEntity roomB, 0, 0, 40 ; Offset it
        loadingB = True
    EndIf

    RenderWorld
    
    ; Hud text
    Text 10, 10, "Use WASD to Move, Space to Stream Room B"
    If loadingB Then Text 10, 30, "Room B Request Sent (Background Load)"

    Flip
Until KeyHit(1)
