; Phase 6 Integration Test: Skeletal Animation

Graphics3D 800, 600, 0, 2
SetBuffer BackBuffer()

light = CreateLight()
RotateEntity light, 45, 45, 0

; Load an animated mesh (using the GLTF stub logic in LoadAnimMesh)
; We'll use a placeholder URL that the runtime will handle
mesh = LoadAnimMesh("Assets/robot.glb")
PositionEntity mesh, 0, 0, 10

cam = CreateCamera()
PositionEntity cam, 0, 2, 0

; Start Animation (Sequence 0, Loop=1, Speed=1.0)
Animate mesh, 1, 1.0, 0, 0

angle# = 0

While Not KeyHit(1)
    angle = angle + 1
    RotateEntity mesh, 0, angle, 0
    
    ; Display Animation Info
    RenderWorld
    
    Text 10, 10, "Phase 6: Animation Test"
    Text 10, 30, "Animating: " + Animating(mesh)
    Text 10, 50, "Time: " + AnimTime(mesh)
    Text 10, 70, "Length: " + AnimLength(mesh)
    
    Flip
Wend

End
