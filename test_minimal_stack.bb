; Minimal test: Function call as statement should drop return value

Function GetValue%()
    Return 42
End Function

Function Main()
    GetValue()  ; ← Return value should be dropped
    GetValue()  ; ← Another one
    GetValue()  ; ← And another
End Function
