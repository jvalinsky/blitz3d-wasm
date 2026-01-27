AppTitle "Runtime Parity Test Extended"
Print "Graphics: " + GraphicsWidth() + "x" + GraphicsHeight()
Print "Window: " + WindowWidth() + "x" + WindowHeight()

Local p = CreatePivot()
NameEntity p, "Pivot1"
Print "Entity Name: " + EntityName(p)
Print "Entity Class: " + EntityClass(p)

Local c = CreatePivot(p)
Print "Children of Pivot1: " + CountChildren(p)
Print "Parent ID: " + GetParent(c)

; Picking test
EntityPick p, 100
Print "Picked X: " + PickedX()
Print "Picked Entity: " + PickedEntity()

; Audio test
Local time = FSOUND_Stream_GetTime(1)
Print "Stream Time: " + time

; Order & Fade
EntityOrder p, 10
EntityAutoFade p, 10, 50

Print "MilliSecs: " + MilliSecs()

Print "Done"
