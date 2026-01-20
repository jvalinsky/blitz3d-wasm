; Test 1: Single function call in if-then

Function Foo%()
    Return 42
End Function

Function Main()
    Local x% = 1
    If x% = 1 Then Foo()
End Function
