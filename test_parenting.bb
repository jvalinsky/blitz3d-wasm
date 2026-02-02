; Test: Simple entity parenting and camera
Graphics3D 800, 600, 32, 2
SetFont LoadFont("Arial", 24)

; Create camera
camera = CreateCamera()
PositionEntity camera, 0, 10, -20
RotateEntity camera, 30, 0, 0

; Create parent pivot
parent = CreatePivot()
PositionEntity parent, 0, 0, 0

; Create child box attached to parent
child = CreateCube()
EntityParent child, parent, True
PositionEntity child, 2, 0, 0

; Create ground
ground = CreatePlane()
PositionEntity ground, 0, -2, 0

; Create light
light = CreateLight()
PositionEntity light, 0, 10, 0

; Main loop
While Not KeyHit(KEY_ESCAPE)
    ; Rotate parent
    RotateEntity parent, 0, 1, 0
    
    ; Check parenting - child should orbit parent
    Local px#, py#, pz#
    GetEntityChildWorldPosition(child, px#, py#, pz#)
    
    ; Update camera to look at scene
    CameraProject camera, px#, py#, pz#
    
    RenderWorld
    Flip
Wend

End

; Helper function for testing
Function GetEntityChildWorldPosition(entity, Variable:Float Var x#, Variable:Float Var y#, Variable:Float Var z#)
    ; Get world position through parenting
    x# = EntityX(entity, True)
    y# = EntityY(entity, True)
    z# = EntityZ(entity, True)
End Function
