Function GetValue()
    Return 42
End Function

Function Test()
    If 1 Then
        GetValue()  ; Call function but ignore return value
    EndIf
End Function
