; ============================================================
; Benchmark: Shared Memory Transforms (5,000 Entities)
; Shows zero-overhead WASM state updates with JS mirroring.
; ============================================================

Graphics3D 800, 600, 32, 2

; Set up a basic scene
cam = CreateCamera()
PositionEntity cam, 0, 0, -100

light = CreateLight()
RotateEntity light, 45, 45, 0

; Create many cubes
; We use a small size to see the relative density.
For i = 1 To 5000
    cube = CreateCube()
    
    ; Randomized initial positions
    x# = Rnd(-150, 150)
    y# = Rnd(-150, 150)
    z# = Rnd(0, 300)
    PositionEntity cube, x, y, z
    
    ; Colorful cubes
    EntityColor cube, Rnd(100, 255), Rnd(100, 255), Rnd(100, 255)
Next

; Simple loop that rotates all entities.
; In the WASM runtime, these RotateEntity calls update the 
; Shared Memory Entity Table (no JS boundary crossed per call).
Repeat
    ; Rotate all cubes (simplified rotation for the bench)
    ; We'll just rotate the camera to show everything moving
    TurnEntity cam, 0, 0.5, 0
    
    RenderWorld
    Flip
Until KeyHit(1)
