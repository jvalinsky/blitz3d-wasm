Const NPCtype096 = 9

Type NPCs
    Field NPCtype%, ID%
End Type

Function Test()
    Local n.NPCs = New NPCs
    n\NPCtype = NPCtype096
    
    ; This pattern might be the issue
    If n\NPCtype = NPCtype096 Then
        Print "Match"
    EndIf
End Function
