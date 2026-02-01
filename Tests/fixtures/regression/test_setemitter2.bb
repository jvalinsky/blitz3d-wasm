Type Template
    Field tex%
End Type

Function Handle%(obj.Template)
    Return 123
End Function

Function SetEmitter%(owner%, template%, fixed%)
    Return 999
End Function

Function Main()
    Local owner% = 1
    Local fixed% = 0
    Dim e.Template(10)
    Local i% = 0
    
    e[i] = New Template
    e[i]\tex = 1
    
    If e[i]\tex Then SetEmitter(owner, Handle(e[i]), fixed)
End Function
