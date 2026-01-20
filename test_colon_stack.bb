; Minimal test: Colon-separated statements in if-then should balance stack

Function GetValue%()
    Return 42
End Function

Function Main()
    Local x% = 1
    
    ; Single statement - should work
    If x% = 1 Then GetValue()
    
    ; Colon-separated: function call + assignment
    ; The assignment "x = 5" leaves a value on stack!
    If x% = 1 Then GetValue() : x% = 5
    
    ; Multiple colon-separated statements
    If x% = 5 Then x% = 10 : x% = 20 : x% = 30
End Function
