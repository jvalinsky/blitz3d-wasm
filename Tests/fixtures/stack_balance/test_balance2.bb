Function GetValue()
    Return 42
End Function

Function Test()
    Local x
    While x < 10
        GetValue()
        x = x + 1
    Wend
End Function
