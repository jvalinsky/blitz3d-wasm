Function Test()
    ; Rand() should return i32
    Local x = Rand(0, 10)
    If x > 5 Then
        Print x
    EndIf
End Function
