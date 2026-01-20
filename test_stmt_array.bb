; Test: Array assignment in single-line if

Function Main()
    Dim arr%(10)
    Local x% = 1
    
    If x% = 1 Then arr(0) = 5 : arr(1) = 10
End Function
