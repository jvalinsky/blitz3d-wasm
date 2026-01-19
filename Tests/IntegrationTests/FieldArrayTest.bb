Type TestType
    Field arr[10]
End Type

Function Main()
    Local t.TestType = New TestType
    t\arr[5] = 42
    Print "Field Array Value: "
    Print t\arr[5]
    
    ; Test boundaries
    t\arr[0] = 1
    t\arr[10] = 11
    Print "Field Array Ends: "
    Print t\arr[0]
    Print t\arr[10]
End Function

Main()
