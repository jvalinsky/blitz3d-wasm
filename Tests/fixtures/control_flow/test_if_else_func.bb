Function Test()
    Local a# = 0
    Local x = 1
    If x Then a# = Float(5) Else a# = Float(10)
End Function

Function Float#(x)
    Return x
End Function
