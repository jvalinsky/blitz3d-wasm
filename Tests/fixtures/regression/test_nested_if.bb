Function ReturnsValue%()
    Return 999
End Function

Function Main()
    Local i%
    For i = 0 To 7
        If i < 5 Then
            If i > 2 Then ReturnsValue()
        EndIf
    Next
End Function
