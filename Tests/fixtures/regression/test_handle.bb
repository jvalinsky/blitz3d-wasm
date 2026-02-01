Type Template
    Field value%
End Type

Function FreeTemplate(handle%)
End Function

Function Handle%(obj.Template)
    Return 123
End Function

Function Main()
    Dim tmp.Template(10)
    Local i% = 0
    
    tmp[i] = New Template
    If tmp[i] <> Null Then FreeTemplate(Handle(tmp[i]))
End Function
