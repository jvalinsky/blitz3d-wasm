; 3D Rotating Cube
; Initialize 3D graphics
Graphics3D 800, 600

; Create a simple cube mesh
cube = CreateCube()

; Position camera
camera = CreateCamera()
PositionEntity camera, 0, 0, -5

; Main loop
While True
    ; Rotate the cube
    TurnEntity cube, 0.5, 1.0, 0.0
    
    ; Render the scene
    RenderWorld
    Flip
Wend
