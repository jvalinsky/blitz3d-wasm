Type Emitter
    Field fixed%
    Field owner%
End Type

Function FreeEntity(ent%)
End Function

Function UpdateParticles()
    Local e.Emitter
    
    For e.Emitter = Each Emitter
        If e\fixed And e\owner Then FreeEntity e\owner
    Next
End Function

Function Main()
    UpdateParticles()
End Function
