; Minimal test to trace stack calculation

Function DoWork%()
    Return 42
End Function

Function Main()
    Local x% = 1
    
    ; Single-line if with colon separator and function call
    If x% = 1 Then DoWork() : x% = 5
End Function
