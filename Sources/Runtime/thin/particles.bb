; SCPCB-style Particles using Blitz3D rendering calls

Global FPSfactor# = 1.0

Type Particles
    Field obj%          ; Sprite entity handle
    Field x#, y#, z#    ; Position
    Field vy#           ; Velocity Y
    Field gravity#
    Field size#
    Field alpha#
    Field lifetime#
End Type

Function CreateParticleAt.Particles(x#, y#, z#)
    Local p.Particles = New Particles
    
    ; Create sprite via runtime
    p\obj = CreateSprite()
    
    ; Set initial position
    p\x = x
    p\y = y  
    p\z = z
    PositionEntity(p\obj, x, y, z)
    
    ; Set size
    p\size = 0.15
    ScaleSprite(p\obj, 0.15, 0.15)
    
    ; Physics - random velocity
    p\vy = 0.02
    p\gravity = 0.008
    
    ; Appearance
    p\alpha = 1.0
    p\lifetime = 150.0
    
    Return p
End Function

Function UpdateParticles()
    Local p.Particles
    For p.Particles = Each Particles
        ; Apply gravity
        p\vy = p\vy - p\gravity * FPSfactor
        
        ; Update position
        p\y = p\y + p\vy * FPSfactor
        PositionEntity(p\obj, p\x, p\y, p\z)
        
        ; Fade out
        p\alpha = p\alpha - 0.005 * FPSfactor
        If p\alpha > 0 Then
            EntityAlpha(p\obj, p\alpha)
        End If
        
        ; Update lifetime
        p\lifetime = p\lifetime - FPSfactor
        
        ; Remove if expired or faded
        If p\lifetime <= 0 Or p\alpha <= 0 Or p\y < -2 Then
            FreeEntity(p\obj)
            Delete p
        End If
    Next
End Function

Function GetParticleCount%()
    Local count% = 0
    Local p.Particles
    For p.Particles = Each Particles
        count = count + 1
    Next
    Return count
End Function

; Initialize - create some particles at fixed positions
Local p.Particles
p = CreateParticleAt(-1.0, 2.0, 0.0)
p = CreateParticleAt(0.0, 2.5, 0.0)
p = CreateParticleAt(1.0, 2.0, 0.0)
p = CreateParticleAt(-0.5, 3.0, -0.5)
p = CreateParticleAt(0.5, 3.0, 0.5)

Print "Created particles: " + GetParticleCount()
