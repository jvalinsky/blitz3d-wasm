Type Emitter
    Field tmp%
End Type

Function UpdateParticles()
    Local e.Emitter
    
    For e.Emitter = Each Emitter
        If e\tmp Then
            frame = frame + texspeed#
        EndIf
    Next
End Function

Function Main()
    UpdateParticles()
End Function
