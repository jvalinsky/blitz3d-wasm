Type Test
    Field x# = 1.0
    Field y% = 5
End Type

Function Main()
    Local t.Test = New Test
    Print t\x
    Print t\y
End Function
