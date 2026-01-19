Type Player
    Field x, y
    Field name$
End Type

p.Player = New Player
p\x = 10
p\y = 20

Print p\x
Print p\y

p2.Player = New Player
p2\x = 100

Print p2\x

For pi.Player = Each Player
    Print pi\x
Next

Delete p

Print "After delete"
For pi.Player = Each Player
    Print pi\x
Next
