/**
 * Graphics Examples for Blitz3D Web IDE
 *
 * These examples demonstrate 3D graphics, 2D sprites, and asset loading
 */

export const graphicsExamples = {
  cube3d: `; 3D Rotating Cube
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
Wend`,

  colorfulCube: `; Colorful Rotating Cube
Graphics3D 800, 600

; Create cube with colored faces
cube = CreateMesh()
surf = CreateSurface(cube)

; Add vertices (8 corners of cube)
AddVertex surf, -1, -1, -1  ; 0
AddVertex surf, 1, -1, -1   ; 1
AddVertex surf, 1, 1, -1    ; 2
AddVertex surf, -1, 1, -1   ; 3
AddVertex surf, -1, -1, 1   ; 4
AddVertex surf, 1, -1, 1    ; 5
AddVertex surf, 1, 1, 1     ; 6
AddVertex surf, -1, 1, 1    ; 7

; Add triangles (12 triangles = 6 faces)
; Front face
AddTriangle surf, 0, 1, 2
AddTriangle surf, 0, 2, 3
; Back face
AddTriangle surf, 5, 4, 7
AddTriangle surf, 5, 7, 6
; Top face
AddTriangle surf, 3, 2, 6
AddTriangle surf, 3, 6, 7
; Bottom face
AddTriangle surf, 4, 5, 1
AddTriangle surf, 4, 1, 0
; Right face
AddTriangle surf, 1, 5, 6
AddTriangle surf, 1, 6, 2
; Left face
AddTriangle surf, 4, 0, 3
AddTriangle surf, 4, 3, 7

; Create camera
camera = CreateCamera()
PositionEntity camera, 0, 0, -5

; Main loop
angle# = 0.0
While True
    angle = angle + 1.0
    RotateEntity cube, angle, angle * 0.5, 0
    
    RenderWorld
    Flip
Wend`,

  sprite2d: `; 2D Sprite Example
Graphics 800, 600

; Load a sprite image
sprite = LoadImage("player.png")

; Sprite position
x% = 400
y% = 300
speed% = 5

; Main loop
While True
    ; Clear screen
    Cls
    
    ; Handle input
    If KeyDown(200) Then y = y - speed  ; Up arrow
    If KeyDown(208) Then y = y + speed  ; Down arrow
    If KeyDown(203) Then x = x - speed  ; Left arrow
    If KeyDown(205) Then x = x + speed  ; Right arrow
    
    ; Draw sprite
    DrawImage sprite, x, y
    
    ; Update screen
    Flip
Wend`,

  particles: `; Simple Particle System
Graphics3D 800, 600

; Create particle array
Dim particleX#(100)
Dim particleY#(100)
Dim particleZ#(100)
Dim particleVX#(100)
Dim particleVY#(100)
Dim particleVZ#(100)

; Initialize particles
For i% = 0 To 99
    particleX(i) = Rnd(-10, 10)
    particleY(i) = Rnd(-10, 10)
    particleZ(i) = Rnd(-10, 10)
    particleVX(i) = Rnd(-0.1, 0.1)
    particleVY(i) = Rnd(-0.1, 0.1)
    particleVZ(i) = Rnd(-0.1, 0.1)
Next

; Create camera
camera = CreateCamera()
PositionEntity camera, 0, 0, -20

; Create particle mesh
particle = CreateSphere(8)
ScaleEntity particle, 0.2, 0.2, 0.2

; Main loop
While True
    ; Update particles
    For i = 0 To 99
        particleX(i) = particleX(i) + particleVX(i)
        particleY(i) = particleY(i) + particleVY(i)
        particleZ(i) = particleZ(i) + particleVZ(i)
        
        ; Wrap around
        If particleX(i) > 10 Then particleX(i) = -10
        If particleX(i) < -10 Then particleX(i) = 10
        If particleY(i) > 10 Then particleY(i) = -10
        If particleY(i) < -10 Then particleY(i) = 10
        If particleZ(i) > 10 Then particleZ(i) = -10
        If particleZ(i) < -10 Then particleZ(i) = 10
    Next
    
    ; Render particles
    For i = 0 To 99
        PositionEntity particle, particleX(i), particleY(i), particleZ(i)
        RenderWorld
    Next
    
    Flip
Wend`,

  textureLoad: `; Texture Loading Example
Graphics3D 800, 600

; Create a cube
cube = CreateCube()

; Load and apply texture
texture = LoadTexture("crate.png")
EntityTexture cube, texture

; Create camera
camera = CreateCamera()
PositionEntity camera, 0, 0, -5

; Main loop
While True
    TurnEntity cube, 0.5, 1.0, 0.0
    RenderWorld
    Flip
Wend`,

  meshLoad: `; 3D Model Loading
Graphics3D 800, 600

; Load a 3D model
model = LoadMesh("character.b3d")

; Scale and position
ScaleEntity model, 0.1, 0.1, 0.1
PositionEntity model, 0, -2, 0

; Create camera
camera = CreateCamera()
PositionEntity camera, 0, 0, -5

; Animation
frame% = 0

; Main loop
While True
    ; Rotate model
    TurnEntity model, 0, 1, 0
    
    ; Animate if model has animation
    frame = frame + 1
    If frame > 100 Then frame = 0
    Animate model, 1, 0.1, frame
    
    RenderWorld
    Flip
Wend`,

  lighting: `; Lighting Example
Graphics3D 800, 600

; Create a sphere
sphere = CreateSphere(32)

; Create lights
light1 = CreateLight(1)  ; Directional light
RotateEntity light1, 45, 45, 0

light2 = CreateLight(2)  ; Point light
PositionEntity light2, 2, 0, -3
LightColor light2, 255, 0, 0

light3 = CreateLight(2)
PositionEntity light3, -2, 0, -3
LightColor light3, 0, 0, 255

; Create camera
camera = CreateCamera()
PositionEntity camera, 0, 0, -5

; Main loop
angle# = 0.0
While True
    angle = angle + 1.0
    
    ; Rotate lights around sphere
    PositionEntity light2, Cos(angle) * 3, 0, -3 + Sin(angle) * 3
    PositionEntity light3, -Cos(angle) * 3, 0, -3 - Sin(angle) * 3
    
    RenderWorld
    Flip
Wend`,

  collision: `; Simple Collision Detection
Graphics3D 800, 600

; Create player sphere
player = CreateSphere(16)
PositionEntity player, 0, 0, 0
ScaleEntity player, 0.5, 0.5, 0.5

; Create obstacle
obstacle = CreateCube()
PositionEntity obstacle, 3, 0, 0

; Create camera
camera = CreateCamera()
PositionEntity camera, 0, 2, -8
PointEntity camera, player

; Player movement
speed# = 0.1

While True
    ; Get player position
    px# = EntityX(player)
    py# = EntityY(player)
    pz# = EntityZ(player)
    
    ; Handle input
    If KeyDown(200) Then pz = pz + speed  ; Up
    If KeyDown(208) Then pz = pz - speed  ; Down
    If KeyDown(203) Then px = px - speed  ; Left
    If KeyDown(205) Then px = px + speed  ; Right
    
    ; Update player position
    PositionEntity player, px, py, pz
    
    ; Check collision
    If EntityDistance(player, obstacle) < 1.5 Then
        Print "Collision detected!"
    EndIf
    
    RenderWorld
    Flip
Wend`,

  skybox: `; Skybox Example
Graphics3D 800, 600

; Create skybox
skybox = CreateSkyBox("sky")

; Create ground plane
ground = CreatePlane()
EntityColor ground, 100, 200, 100

; Create some objects
For i% = 0 To 10
    cube = CreateCube()
    PositionEntity cube, Rnd(-20, 20), 0.5, Rnd(-20, 20)
    ScaleEntity cube, Rnd(0.5, 2), Rnd(0.5, 2), Rnd(0.5, 2)
Next

; Create camera
camera = CreateCamera()
PositionEntity camera, 0, 2, -10

; Main loop
angle# = 0.0
While True
    angle = angle + 0.5
    
    ; Rotate camera around scene
    PositionEntity camera, Sin(angle) * 15, 5, Cos(angle) * 15
    PointEntity camera, ground
    
    RenderWorld
    Flip
Wend`,
};
