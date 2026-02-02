Const A = 1
Const B = 2

Local x = 2
Select x
    Case A
        Print "A"
    Case B
        Print "B"
    Default
        Print "D"
End Select

x = 4
Select x
    Case 1 To 3
        Print "range"
    Default
        Print "other"
End Select

x = 3
Select x
    Case 1 To 3
        Print "range"
    Default
        Print "other"
End Select

