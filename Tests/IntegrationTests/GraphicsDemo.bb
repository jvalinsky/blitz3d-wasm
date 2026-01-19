; Graphics Demo - Interactive 3D Scene
; Demonstrates keyboard input, mouse look, lighting, and materials

Graphics3D 1024, 768, 0, 2

; Create camera with mouse look
camera = CreateCamera(0)
PositionEntity camera, 0, 2, -10
CameraRange camera, 0.1, 1000

; Create a ground plane
ground = CreatePlane(0)
PositionEntity ground, 0, -2, 0
ScaleEntity ground, 20, 1, 20
ground_brush = CreateBrush()
BrushColor ground_brush, 64, 64, 64
PaintEntity ground, ground_brush

; Create a central cube with shiny material
cube = CreateCube(0)
PositionEntity cube, 0, 0, 0
ScaleEntity cube, 2, 2, 2
cube_brush = CreateBrush()
BrushColor cube_brush, 200, 50, 50
BrushAlpha cube_brush, 255
BrushShininess cube_brush, 50
PaintEntity cube, cube_brush

; Create orbiting spheres
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

; Create point light
light = CreateLight(1)
PositionEntity light, 0, 10, 0
LightRange light, 50
LightColor light, 255, 255, 255

; Create ambient light
AmbientLight 40, 40, 40

; Create directional light for dramatic shadows
dir_light = CreateLight(3)
RotateEntity dir_light, 45, 45, 0
LightColor dir_light, 100, 100, 150

; Variables for animation
angle# = 0
sphere_angle# = 0
mouse_sensitivity# = 0.5
camera_pitch# = 0
camera_yaw# = 0

PrintString "=== Graphics Demo ==="
PrintString "Controls:"
PrintString "  WASD - Move camera"
PrintString "  Mouse - Look around"
PrintString "  Q/E - Move up/down"
PrintString "  Space - Toggle auto-rotate"
PrintString "  1/2/3 - Change cube color"
PrintString "  Escape - Exit"
PrintString ""
PrintString "Click on canvas to enable mouse look"

; Main loop
auto_rotate = 1

While Not KeyHit(1)
    ; Clear screen
    Cls

    ; Handle keyboard movement
    If KeyDown(17) ; W
        MoveEntity camera, 0, 0, 0.2
    EndIf
    If KeyDown(31) ; S
        MoveEntity camera, 0, 0, -0.2
    EndIf
    If KeyDown(30) ; A
        MoveEntity camera, -0.2, 0, 0
    EndIf
    If KeyDown(32) ; D
        MoveEntity camera, 0.2, 0, 0
    EndIf
    If KeyDown(16) ; Q
        MoveEntity camera, 0, 0.2, 0
    EndIf
    If KeyDown(18) ; E
        MoveEntity camera, 0, -0.2, 0
    EndIf

    ; Toggle auto-rotate
    If KeyHit(57) ; Space
        auto_rotate = 1 - auto_rotate
        If auto_rotate = 1
            PrintString "Auto-rotate: ON"
        Else
            PrintString "Auto-rotate: OFF"
        EndIf
    EndIf

    ; Change cube colors
    If KeyHit(2) ; 1
        BrushColor cube_brush, 255, 50, 50
        PaintEntity cube, cube_brush
        PrintString "Cube: Red"
    EndIf
    If KeyHit(3) ; 2
        BrushColor cube_brush, 50, 255, 50
        PaintEntity cube, cube_brush
        PrintString "Cube: Green"
    EndIf
    If KeyHit(4) ; 3
        BrushColor cube_brush, 50, 50, 255
        PaintEntity cube, cube_brush
        PrintString "Cube: Blue"
    EndIf

    ; Auto-rotate the spheres
    If auto_rotate = 1
        sphere_angle# = sphere_angle# + 1
    EndIf

    ; Animate orbiting spheres
    PositionEntity sphere1, Cos(sphere_angle# * 0.5) * 5, 1, Sin(sphere_angle# * 0.5) * 5
    PositionEntity sphere2, Cos(sphere_angle# * 0.5 + 2.09) * 5, 1, Sin(sphere_angle# * 0.5 + 2.09) * 5
    PositionEntity sphere3, Cos(sphere_angle# * 0.5 + 4.18) * 5, 1, Sin(sphere_angle# * 0.5 + 4.18) * 5

    ; Rotate cube
    TurnEntity cube, 0.5, 1, 0

    ; Animate point light
    PositionEntity light, Sin(angle#) * 5, 10, Cos(angle#) * 5
    angle# = angle# + 0.02

    ; Render the world
    RenderWorld

    ; Draw on-screen instructions
    Color 255, 255, 255
    Text 10, 730, "WASD: Move | Q/E: Up/Down | Mouse: Look | Space: Toggle Rotate | 1-3: Colors"

    ; Flip display
    Flip
Wend

End
