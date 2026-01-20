; Test: Single-line If-Then with colon separator

Function Main()
    Local x% = 1
    
    ; Multi-line if-then-endif (should work)
    If x% = 1 Then
        x% = 5
        x% = 10
    EndIf
    
    ; Single-line if-then with colon (potential issue?)
    If x% = 10 Then x% = 20 : x% = 30
    
    ; Another single-line
    If x% = 30 Then x% = 40
End Function
