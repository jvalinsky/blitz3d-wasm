; Test exact UpdateEvents pattern: array of types with field access

Type NPC
    Field State%
End Type

Type Room  
    ; Blitz3D doesn't support arrays in types like this
    ; It uses separate NPC instances
End Type

Dim NPCArray.NPC(10)

Type Event
    Field room.Room
End Type

Function SetNPCFrame(npc.NPC, frame%)
End Function

Function Main()
    Local e.Event = New Event
    e\room = New Room
    e\room\NPC[0] = New NPC
    
    ; This is the EXACT UpdateEvents pattern:
    If e\room\NPC[0] <> Null Then SetNPCFrame(e\room\NPC[0], 74) : e\room\NPC[0]\State = 8
End Function
