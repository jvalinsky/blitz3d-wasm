; Phase 4 Integration Test: FPS Movement & Collisions

Graphics3D 800, 600, 0, 2
SetBuffer BackBuffer()

; Create world
light = CreateLight()
RotateEntity light, 45, 45, 0

; Create Room (Floor, Walls)
floor = CreateCube()
ScaleEntity floor, 10, 0.1, 10
EntityType floor, 1 ; Type 1: Environment

wall1 = CreateCube()
ScaleEntity wall1, 1, 5, 10
PositionEntity wall1, -11, 5, 0
EntityType wall1, 1

wall2 = CreateCube()
ScaleEntity wall2, 1, 5, 10
PositionEntity wall2, 11, 5, 0
EntityType wall2, 1

; Create Player
pivot = CreatePivot()
PositionEntity pivot, 0, 2, 0
EntityRadius pivot, 1.0, 1.0
EntityType pivot, 2 ; Type 2: Player

cam = CreateCamera(pivot)
PositionEntity cam, 0, 1.5, 0 ; Eyes at 1.5m

; Set Collisions (Player vs Environment, Sphere-to-Poly, Sliding)
Collisions 2, 1, 2, 2

HidePointer()

; Main loop
While Not KeyHit(1) ; ESC to quit
    ; Mouse Look
    mxs# = MouseXSpeed() * 0.1
    mys# = MouseYSpeed() * 0.1
    
    yaw# = EntityYaw(pivot) - mxs
    pitch# = EntityPitch(cam) + mys
    
    If pitch > 89 Then pitch = 89
    If pitch < -89 Then pitch = -89
    
    RotateEntity pivot, 0, yaw, 0
    RotateEntity cam, pitch, 0, 0
    
    ; Movement
    move# = 0.1
    If KeyDown(17) Then MoveEntity pivot, 0, 0, move  ; W
    If KeyDown(31) Then MoveEntity pivot, 0, 0, -move ; S
    If KeyDown(30) Then MoveEntity pivot, -move, 0, 0 ; A
    If KeyDown(32) Then MoveEntity pivot, move, 0, 0  ; D
    
    ; Update Physics
    UpdateWorld 1.0
    
    ; Render
    RenderWorld
    Flip
Wend

ShowPointer()
End
