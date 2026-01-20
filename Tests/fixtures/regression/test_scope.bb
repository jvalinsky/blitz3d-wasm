; Test local in if, used in else
If 1 Then
    Local y# = 200 - 13
Else
    y# = 200  ; This should auto-declare y as global!
EndIf

Function Test()
End Function
