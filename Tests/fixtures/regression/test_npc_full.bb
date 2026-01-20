Type NPCs
    Field obj%, obj2%, obj3%, obj4%, Collider%
    Field NPCtype%, ID%
    Field DropSpeed#, Gravity%
    Field State#, State2#, State3#, PrevState%
End Type

Function CreateNPC.NPCs(NPCtype%, x#, y#, z#)
    Local n.NPCs = New NPCs
    n\NPCtype = NPCtype
    n\State = 0.0
    n\State2 = 1.0
    n\State3 = 2.0
    Return n
End Function

Function Test()
    Local npc.NPCs = CreateNPC(1, 0.0, 0.0, 0.0)
    Print npc\NPCtype
    Print npc\State
End Function
