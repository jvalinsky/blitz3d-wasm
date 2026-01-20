Type NPCs
    Field State#
End Type

Function Test()
    Local n.NPCs = New NPCs
    ; Pattern that might cause the issue:
    ; Local assigned from field, then compared
    Local temp = n\State
    If temp > 0 Then
        Print temp
    EndIf
End Function
