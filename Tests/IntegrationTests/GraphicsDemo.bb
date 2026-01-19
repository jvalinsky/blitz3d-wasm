; Graphics Demo - Non-blocking version
; Uses frame counter instead of blocking loop

Graphics3D 1024, 768, 0, 2

camera = CreateCamera(0)
PositionEntity camera, 0, 2, -10
CameraRange camera, 0.1, 1000

ground = CreatePlane(0)
PositionEntity ground, 0, -2, 0
ScaleEntity ground, 20, 1, 20
ground_brush = CreateBrush()
BrushColor ground_brush, 64, 64, 64
PaintEntity ground, ground_brush

cube = CreateCube(0)
PositionEntity cube, 0, 0, 0
ScaleEntity cube, 2, 2, 2
cube_brush = CreateBrush()
BrushColor cube_brush, 200, 50, 50
BrushAlpha cube_brush, 255
BrushShininess cube_brush, 50
PaintEntity cube, cube_brush

sphere1 = CreateSphere(0)
PositionEntity sphere1, 5, 1, 0
sphere1_brush = CreateBrush()
BrushColor sphere1_brush, 50, 200, 50
BrushShininess sphere1_brush, 100
PaintEntity sphere1, sphere1_brush

sphere2 = CreateSphere(0)
PositionEntity sphere2, -5, 1, 0
sphere2_brush = CreateBrush()
BrushColor sphere2_brush, 50, 50, 200
BrushShininess sphere2_brush, 100
PaintEntity sphere2, sphere2_brush

sphere3 = CreateSphere(0)
PositionEntity sphere3, 0, 1, 5
sphere3_brush = CreateBrush()
BrushColor sphere3_brush, 200, 200, 50
BrushShininess sphere3_brush, 100
PaintEntity sphere3, sphere3_brush

light = CreateLight(1)
PositionEntity light, 0, 10, 0
LightRange light, 50
LightColor light, 255, 255, 255

AmbientLight 40, 40, 40

dir_light = CreateLight(3)
RotateEntity dir_light, 45, 45, 0
LightColor dir_light, 100, 100, 150

angle# = 0
sphere_angle# = 0
auto_rotate = 1
frame = 0

Cls
RenderWorld
Flip

PrintString "=== Graphics Demo ==="
PrintString "WASD to move, Space to toggle rotate"
PrintString "Running... (check console for updates)"

; Run for 600 frames (~10 seconds at 60fps)
While frame < 600
    Cls

    If KeyDown(17)
        MoveEntity camera, 0, 0, 0.2
    EndIf
    If KeyDown(31)
        MoveEntity camera, 0, 0, -0.2
    EndIf
    If KeyDown(30)
        MoveEntity camera, -0.2, 0, 0
    EndIf
    If KeyDown(32)
        MoveEntity camera, 0.2, 0, 0
    EndIf

    If KeyHit(57)
        auto_rotate = 1 - auto_rotate
    EndIf

    If auto_rotate = 1
        sphere_angle# = sphere_angle# + 1
    EndIf

    PositionEntity sphere1, Cos(sphere_angle# * 0.5) * 5, 1, Sin(sphere_angle# * 0.5) * 5
    PositionEntity sphere2, Cos(sphere_angle# * 0.5 + 2.09) * 5, 1, Sin(sphere_angle# * 0.5 + 2.09) * 5
    PositionEntity sphere3, Cos(sphere_angle# * 0.5 + 4.18) * 5, 1, Sin(sphere_angle# * 0.5 + 4.18) * 5

    TurnEntity cube, 0.5, 1, 0

    PositionEntity light, Sin(angle#) * 5, 10, Cos(angle#) * 5
    angle# = angle# + 0.02

    RenderWorld
    Flip

    frame = frame + 1
Wend

PrintString "Demo complete!"
