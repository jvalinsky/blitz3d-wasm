Type N
    Field id
End Type

Local a.N = New N
a\id = 1
Local b.N = New N
b\id = 2
Local c.N = New N
c\id = 3

Insert c Before b

Local t.N
For t = Each N
    Print "id=" + t\id
Next

