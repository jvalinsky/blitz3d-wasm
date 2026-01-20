; Minimal UpdateEvents-like pattern

Type NPCs
    Field State%
End Type

Type Rooms
    Field NPC.NPCs[12]
End Type

Type Events  
    Field room.Rooms
End Type

Function SetNPCFrame(npc.NPCs, frame%)
End Function

Function UpdateEvents()
    Local e.Events = New Events
    e\room = New Rooms
    e\room\NPC[0] = New NPCs
    
    ; UpdateEvents.bb line 87:
    If e\room\NPC[0] <> Null Then SetNPCFrame(e\room\NPC[0], 74) : e\room\NPC[0]\State = 8
End Function

Function Main()
    UpdateEvents()
End Function
