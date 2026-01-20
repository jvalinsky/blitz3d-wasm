; Test from testComplexFunctionWithAllThreeIssues

Function Calc#(x%, y#)
    Return x% + y#
End Function

Function Main()
    Local result#
    Local i%
    For i% = 1 To 5
        result# = Calc(i%, 1.5)
    Next
    
    While i% > 0
        If result# > 0 Then
            Calc(i%, 2.0)  ; ← Statement context - should drop return value
        EndIf
        i% = i% - 1
    Wend
End Function
