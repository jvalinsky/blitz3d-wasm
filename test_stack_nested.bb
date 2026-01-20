; Test Case 2: Nested Control Flow
; Tests if/else and loop balancing

Function GetValue(x)
    Return x * 2
End Function

Function Test()
    Local x, y
    
    ; If with unbalanced branches
    If x Then
        GetValue(5)  ; Returns value
    Else
        y = 10       ; No return value
    EndIf
    
    ; While loop with function call
    While y < 10
        GetValue(y)  ; Returns value, needs drop
        y = y + 1
    Wend
    
    ; For loop with nested if
    For i = 1 To 5
        If i > 2 Then
            GetValue(i)  ; Returns value
        EndIf
    Next
End Function
