; Test 3: UpdateEvents pattern - function call + field assignment

Type NPC
    Field State%
End Type

Function SetFrame(npc.NPC, frame%)
End Function

Function Main()
    Local npc.NPC = New NPC
    
    ; This is the actual UpdateEvents.bb pattern:
    ; If condition Then FunctionCall() : field\assignment = value
    If npc <> Null Then SetFrame(npc, 74) : npc\State = 8
End Function
