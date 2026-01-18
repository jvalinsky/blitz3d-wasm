Graphics3D 800, 600, 0, 2

Type TPlayer
    Field x#, y#, z#
    Field entity
End Type

Print "Initializing Player..."
p.TPlayer = New TPlayer
p\x = 10.5
p\y = 20.0
p\z = 30.5
p\entity = CreatePivot()

Print "Testing ForEach:"
For p.TPlayer = Each TPlayer
    Print "Player at: " + p\x + ", " + p\y + ", " + p\z
Next

Print "Testing Mesh Loading:"
; Note: Assets/test.obj may not exist, but runtime should handle failure
mesh = LoadMesh("Assets/test.obj")
If mesh <> 0
    Print "Mesh loaded successfully"
    PositionEntity mesh, 0, 0, 10
    Print "Mesh X: " + EntityX(mesh)
    FreeEntity mesh
    Print "Mesh freed"
Else
    Print "Mesh loading skipped or failed (as expected if file missing)"
EndIf

Print "Testing Delete:"
Delete p
count = 0
For p.TPlayer = Each TPlayer
    count = count + 1
Next
Print "Player count after delete: " + count

Print "Integration Test Complete."
End
