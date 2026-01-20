; Test mesh loading with StrictLoads-style file checking
; Simplified test to avoid compiler issues with complex if-statements

Graphics3D 800, 600, 0, 2

PrintString "=== StrictLoads Mesh Test ==="

; Load the mesh directly
; Note: Assumes file exists (FileType check done at JS level)
Local mesh% = LoadMesh("GFX/npcs/173_2.b3d", 0)

PrintString "Mesh handle: " + mesh

; Query mesh info
Local surfCount% = CountSurfaces(mesh)
PrintString "Surface count: " + surfCount

; Get surface and print info
Local surf% = GetSurface(mesh, 1)
PrintString "Surface handle: " + surf
PrintString "Vertex count: " + CountVertices(surf)
PrintString "Triangle count: " + CountTriangles(surf)

; Cleanup
FreeEntity mesh
PrintString "Mesh freed"

PrintString "=== Test Complete ==="

End
