; Phase 5 Integration Test: Lighting & Fog

Graphics3D 800, 600, 0, 2
SetBuffer BackBuffer()

; Create world
pivot = CreatePivot()
PositionEntity pivot, 0, 0, 0

; Create objects to see lights/fog
For i = 1 To 10
    c = CreateCube()
    PositionEntity c, Rnd(-10, 10), Rnd(-2, 2), Rnd(5, 20)
    RotateEntity c, Rnd(360), Rnd(360), 0
Next

cam = CreateCamera()
PositionEntity cam, 0, 0, 0

; Initial lighting
AmbientLight 30, 30, 30
light = CreateLight(2) ; Point light
PositionEntity light, 0, 5, 10
LightColor light, 255, 200, 100
LightRange light, 20

; Fog setup
FogMode 1 ; Linear
FogColor 50, 50, 50
FogRange 5, 25

; Camera setup
CameraClsColor cam, 20, 20, 30

angle# = 0

While Not KeyHit(1)
    angle = angle + 1
    
    ; Dynamic Ambient
    amb# = (Sin(angle) + 1) * 50
    AmbientLight amb, amb, amb
    
    ; Move point light
    PositionEntity light, Cos(angle) * 10, 5, 10 + Sin(angle) * 5
    
    ; Change Fog Color
    fc# = (Cos(angle) + 1) * 30
    FogColor fc, fc * 1.5, fc * 2
    
    RenderWorld
    
    Text 10, 10, "Phase 5: Lighting & Fog Test"
    Text 10, 30, "Ambient: " + Int(amb)
    Text 10, 50, "Fog Color: " + Int(fc)
    
    Flip
Wend

End
