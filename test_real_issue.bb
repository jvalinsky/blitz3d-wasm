Function UpdateDoor()
    Return 1
End Function

Function Test()
    Local x
    If x Then
        UpdateDoor()  ; This call returns i32, needs drop INSIDE if
    EndIf
End Function
