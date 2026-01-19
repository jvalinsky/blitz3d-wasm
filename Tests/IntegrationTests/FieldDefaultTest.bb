Type TestType
    Field x = 123
    Field y# = 45.6
    Field z$ = "Hello"
End Type

Function Main()
    Local t.TestType = New TestType
    Print "Default X: "
    Print t\x
    Print "Default Y: "
    Print Int(t\y) ; PrintInt helper only handles Int for now
    Print "Default Z: "
    Print t\z
End Function

Main()
