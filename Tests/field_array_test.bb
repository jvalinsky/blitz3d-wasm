Type MyType
    Field arr[10]
End Type

t.MyType = New MyType
t\arr[5] = 123
If t\arr[5] = 123
    Print "SUCCESS: Field array storage and retrieval works!"
Else
    Print "FAILURE: Expected 123, got " + t\arr[5]
EndIf
