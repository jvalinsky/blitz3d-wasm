Function Test()
    ; Maybe Rnd() returns f32 but assigned to i32 local?
    Local x = Rnd(0, 10)
    If x > 5 Then
        Print x
    EndIf
End Function
