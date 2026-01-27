Type TestNode
    Field id
End Type

Local t1.TestNode = New TestNode
t1\id = 1

Local t2.TestNode = New TestNode
t2\id = 2

Print "Iterating:"
Local t.TestNode
For t = Each TestNode
    Print "Node ID: " + t\id
Next

Print "Done"
