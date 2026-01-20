; Test deeply nested if statements

Function Foo%()
    Return 42
End Function

Function Main()
    Local x% = 1
    Local y% = 2
    Local z% = 3
    
    ; Nested if with colon separators
    If x% = 1 Then
        If y% = 2 Then
            If z% = 3 Then Foo() : x% = 10
        EndIf
    EndIf
End Function
