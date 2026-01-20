; Test 2: Colon-separated function calls

Function Foo%()
    Return 42
End Function

Function Bar%()
    Return 99
End Function

Function Main()
    Local x% = 1
    If x% = 1 Then Foo() : Bar()
End Function
