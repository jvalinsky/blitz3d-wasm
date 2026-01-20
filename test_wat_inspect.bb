; Generate simple case to inspect WAT

Function Foo%()
    Return 42
End Function

Function Main()
    Local x% = 1
    If x% = 1 Then Foo() : x% = 5
End Function
