Type NPCs
    Field NPCtype%, ID%
End Type

Function Test()
    Local n.NPCs = New NPCs
    n\NPCtype = 1
    n\ID = 2
    Print n\NPCtype
End Function
