Type TestType
    Field handles[5]
End Type

Function Main()
    Local t.TestType = New TestType
    t\handles[0] = 42
End Function
