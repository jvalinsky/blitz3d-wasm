; Test local variables in GOTO chunks

Function TestGotoLocals()
    Goto middle

    .start
    Local x = 1
    Local y = 2
    Print x + y
    Goto end_func

    .middle
    Local a = 10
    Local b = 20
    Print a + b
    Goto start

    .end_func
    Local result = 999
    Return result
End Function

Print TestGotoLocals()
