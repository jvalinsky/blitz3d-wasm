Type Template
    Field animtex%
    Field tex%
    Field texframe#
    Field texspeed#
    Field maxtexframes%
End Type

Type Emitter
    Field tmp.Template
    Field ent%
End Type

Function UpdateParticles()
    Local e.Emitter
    
    For e.Emitter = Each Emitter
        If e\tmp\animtex Then
            e\tmp\texframe# = e\tmp\texframe# + e\tmp\texspeed#
            If e\tmp\texframe# > e\tmp\maxtexframes - 1 Then e\tmp\texframe# = 0
            EntityTexture e\ent, e\tmp\tex, e\tmp\texframe#
        EndIf
    Next
End Function

Function Main()
    UpdateParticles()
End Function
