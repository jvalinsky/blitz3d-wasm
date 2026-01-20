; Test: Colon-separated field assignments in if-then

Type NPC
    Field State%
End Type

Function SetNPCFrame(npc.NPC, frame%)
End Function

Function Main()
    Local npc.NPC = New NPC
    
    ; This is the actual UpdateEvents pattern
    If npc <> Null Then SetNPCFrame(npc, 74) : npc\State = 8
End Function
