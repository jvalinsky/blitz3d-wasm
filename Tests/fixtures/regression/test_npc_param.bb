Type NPCs
    Field NPCtype%, ID%
End Type

Function CreateNPC.NPCs(NPCtype%, x#, y#, z#)
    Local n.NPCs = New NPCs
    n\NPCtype = NPCtype
    Return n
End Function

Function Test()
    Local npc.NPCs = CreateNPC(1, 0.0, 0.0, 0.0)
    Print npc\NPCtype
End Function
