; Test Case 1: Simple If Balance
; Should compile without errors

Function GetValue()
    Return 42
End Function

Function Test()
    Local x
    If x Then
        GetValue()  ; Returns value, should auto-insert drop
    EndIf
End Function
