; Mesh Integration Test
Graphics3D 800, 600, 0, 2
PrintInt 1111

; SetBuffer BackBuffer()

PrintInt 2222
camera = CreateCamera(0)
PrintString "Camera Created"
PrintInt 3333
light = CreateLight(1)
PrintString "Light Created"

; Create a custom triangle mesh
mesh = CreateMesh(0)
surf = CreateSurface(mesh, 0)

v0 = AddVertex(surf, -1.0, -1.0, 0.0, 0, 1, 0)
v1 = AddVertex(surf, 1.0, -1.0, 0.0, 1, 1, 0)
v2 = AddVertex(surf, 0.0, 1.0, 0.0, 0.5, 0, 0)

tri = AddTriangle(surf, v0, v1, v2)

VertexColor surf, v0, 255, 0, 0, 1
VertexColor surf, v1, 0, 255, 0, 1
VertexColor surf, v2, 0, 0, 255, 1

UpdateNormals mesh

PositionEntity mesh, 0, 0, 5

ClsColor 64, 64, 64
PrintString "MeshTest Complete"

While Not KeyHit(1)
    Cls
    TurnEntity mesh, 1, 1, 0
    RenderWorld
    Flip
Wend

End
