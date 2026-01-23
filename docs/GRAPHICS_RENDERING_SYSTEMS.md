# Graphics/Rendering Systems Documentation

## Overview
The graphics/rendering systems in SCP: Containment Breach handle advanced visual effects, particle systems, and dynamic lighting to create the game's distinctive horror atmosphere.

## Material System

### Purpose
The material system manages surface properties, textures, and visual effects that define how objects appear and interact with light.

### Architecture

#### Material Data Structure
```blitzbasic
Type Material
    Field MaterialID%          ; Unique material identifier
    Field Name$                ; Material name
    Field DiffuseTexture%      ; Main color texture
    Field NormalTexture%       ; Normal map for lighting
    Field SpecularTexture%     ; Specular map
    Field EmissionTexture%     ; Self-illumination
    
    ; Surface properties
    Field DiffuseColor#[3]     ; RGB diffuse color
    Field SpecularColor#[3]    ; RGB specular color
    Field EmissiveColor#[3]    ; RGB emissive color
    Field Shininess#           ; Specular power
    Field Roughness#           ; Surface roughness
    Field Metallic#            ; Metallic factor
    
    ; Animation properties
    Field Animated%            ; Has animated textures
    Field AnimationSpeed#      ; Animation speed
    Field UVScroll#[2]         ; UV scrolling offset
    
    ; Special effects
    Field Transparent%         ; Has transparency
    Field AlphaTest%           ; Alpha testing enabled
    Field TwoSided%            ; Render both sides
    Field BlendMode%           ; Blend mode for transparency
End Type

; Blend modes
Const BLEND_NONE% = 0         ; No blending
Const BLEND_ALPHA% = 1        ; Alpha blending
Const BLEND_ADDITIVE% = 2     ; Additive blending
Const BLEND_MULTIPLY% = 3     ; Multiply blending
```

### Material Management
```blitzbasic
Global Materials.Material[1000] ; Material library

Function LoadMaterial(materialFile$)
    file = ReadFile(materialFile)
    
    material.Material = New Material
    material\Name = ReadString(file)
    material\DiffuseTexture = LoadTexture(ReadString(file))
    material\NormalTexture = LoadTexture(ReadString(file))
    material\SpecularTexture = LoadTexture(ReadString(file))
    material\EmissionTexture = LoadTexture(ReadString(file))
    
    ; Load properties
    For i = 0 To 2
        material\DiffuseColor[i] = ReadFloat(file)
        material\SpecularColor[i] = ReadFloat(file)
        material\EmissiveColor[i] = ReadFloat(file)
    Next
    
    material\Shininess = ReadFloat(file)
    material\Roughness = ReadFloat(file)
    material\Metallic = ReadFloat(file)
    
    ; Load animation properties
    material\Animated = ReadInt(file)
    material\AnimationSpeed = ReadFloat(file)
    material\UVScroll[0] = ReadFloat(file)
    material\UVScroll[1] = ReadFloat(file)
    
    ; Load special effects
    material\Transparent = ReadInt(file)
    material\AlphaTest = ReadInt(file)
    material\TwoSided = ReadInt(file)
    material\BlendMode = ReadInt(file)
    
    Return material
End Function

Function ApplyMaterial(entity%, material.Material)
    ; Apply textures
    If material\DiffuseTexture <> 0 Then
        EntityTexture entity, material\DiffuseTexture, 0, 0
    EndIf
    
    If material\NormalTexture <> 0 Then
        EntityTexture entity, material\NormalTexture, 0, 1
    EndIf
    
    ; Apply surface properties
    EntityColor entity, material\DiffuseColor[0] * 255, material\DiffuseColor[1] * 255, material\DiffuseColor[2] * 255
    EntityShininess entity, material\Shininess
    
    ; Handle transparency
    If material\Transparent Then
        EntityAlpha entity, 0.5  ; Example alpha value
        EntityBlend entity, material\BlendMode
    EndIf
    
    ; Handle two-sided rendering
    If material\TwoSided Then
        EntityFX entity, 16  ; Two-sided flag
    EndIf
End Function
```

---

## Particle System

### Purpose
The particle system creates environmental effects, damage visualization, and atmospheric elements that enhance the horror experience.

### Architecture

#### Particle Emitter Structure
```blitzbasic
Type ParticleEmitter
    Field EmitterID%           ; Unique emitter identifier
    Field Position#[3]         ; Emitter position
    Field Direction#[3]        ; Emission direction
    Field Spread#              ; Emission spread angle
    Field Rate#                ; Particles per second
    Field Speed#               ; Particle speed
    Field LifeTime#            ; Particle lifetime
    Field Size#                ; Particle size
    Field Color#[4]            ; RGBA color
    Field Texture%             ; Particle texture
    
    ; Variation properties
    Field SpeedVariation#      ; Speed randomness
    Field SizeVariation#       ; Size randomness
    Field LifeVariation#       ; Lifetime randomness
    Field ColorVariation#[4]   ; Color randomness
    
    ; Physics properties
    Field Gravity#             ; Gravity effect
    Field Drag#                ; Air resistance
    Field Bounce#              ; Bounce factor
    
    ; Active particles
    Field Particles.Particle[100] ; Particle array
    Field ActiveParticles%     ; Number of active particles
End Type

Type Particle
    Field Position#[3]         ; Current position
    Field Velocity#[3]         ; Current velocity
    Field Life#                ; Remaining life
    Field Size#                ; Current size
    Field Color#[4]            ; Current color
    Field Rotation#            ; Rotation angle
End Type
```

### Particle Management
```blitzbasic
Function CreateParticleEmitter(template$, x#, y#, z#)
    emitter.ParticleEmitter = New ParticleEmitter
    
    ; Load emitter properties from template
    LoadEmitterTemplate(emitter, template)
    
    ; Set position
    emitter\Position[0] = x
    emitter\Position[1] = y
    emitter\Position[2] = z
    
    ; Initialize particle array
    For i = 0 To 99
        emitter\Particles[i] = New Particle
    Next
    
    Return emitter
End Function

Function UpdateParticleEmitter(emitter.ParticleEmitter)
    ; Emit new particles
    emitCount# = emitter\Rate * (1.0 / 60.0)  ; Assuming 60 FPS
    emitCount = emitCount + emitter\EmitAccumulator
    emitCountInt% = Floor(emitCount)
    emitter\EmitAccumulator = emitCount - emitCountInt
    
    For i = 1 To emitCountInt
        EmitParticle(emitter)
    Next
    
    ; Update existing particles
    For i = 0 To 99
        If emitter\Particles[i]\Life > 0 Then
            UpdateParticle(emitter\Particles[i], emitter)
        EndIf
    Next
End Function

Function EmitParticle(emitter.ParticleEmitter)
    ; Find inactive particle
    For i = 0 To 99
        If emitter\Particles[i]\Life <= 0 Then
            particle.Particle = emitter\Particles[i]
            Exit
        EndIf
    Next
    
    If particle = Null Then Return
    
    ; Initialize particle
    For j = 0 To 2
        particle\Position[j] = emitter\Position[j]
    Next
    
    ; Set velocity with spread
    angle# = Rnd(-emitter\Spread, emitter\Spread)
    speed# = emitter\Speed * (1.0 + Rnd(-emitter\SpeedVariation, emitter\SpeedVariation))
    
    particle\Velocity[0] = Cos(angle) * speed
    particle\Velocity[1] = Sin(angle) * speed
    particle\Velocity[2] = 0
    
    ; Set other properties
    particle\Life = emitter\LifeTime * (1.0 + Rnd(-emitter\LifeVariation, emitter\LifeVariation))
    particle\Size = emitter\Size * (1.0 + Rnd(-emitter\SizeVariation, emitter\SizeVariation))
    
    For j = 0 To 3
        particle\Color[j] = emitter\Color[j] + Rnd(-emitter\ColorVariation[j], emitter\ColorVariation[j])
        particle\Color[j] = Clamp(particle\Color[j], 0, 1)
    Next
End Function

Function UpdateParticle(particle.Particle, emitter.ParticleEmitter)
    ; Update lifetime
    particle\Life = particle\Life - (1.0 / 60.0)
    
    If particle\Life <= 0 Then Return
    
    ; Apply physics
    particle\Velocity[1] = particle\Velocity[1] - emitter\Gravity * (1.0 / 60.0)
    
    For i = 0 To 2
        particle\Velocity[i] = particle\Velocity[i] * (1.0 - emitter\Drag * (1.0 / 60.0))
        particle\Position[i] = particle\Position[i] + particle\Velocity[i] * (1.0 / 60.0)
    Next
    
    ; Handle ground collision
    If particle\Position[1] < 0 Then
        particle\Position[1] = 0
        particle\Velocity[1] = -particle\Velocity[1] * emitter\Bounce
        
        ; Reduce horizontal velocity on bounce
        particle\Velocity[0] = particle\Velocity[0] * 0.8
        particle\Velocity[2] = particle\Velocity[2] * 0.8
    EndIf
    
    ; Update rotation
    particle\Rotation = particle\Rotation + 360 * (1.0 / 60.0)  ; 360 degrees per second
End Function

Function RenderParticles(emitter.ParticleEmitter)
    For i = 0 To 99
        If emitter\Particles[i]\Life > 0 Then
            particle.Particle = emitter\Particles[i]
            
            ; Set render state
            CameraProject Camera, particle\Position[0], particle\Position[1], particle\Position[2]
            
            If ProjectedZ() > 0 Then  ; In front of camera
                x# = ProjectedX()
                y# = ProjectedY()
                
                ; Draw particle
                size# = particle\Size * (GraphicsHeight() / ProjectedZ())
                
                Color particle\Color[0] * 255, particle\Color[1] * 255, particle\Color[2] * 255
                Oval x - size/2, y - size/2, size, size, True
            EndIf
        EndIf
    Next
End Function
```

### Specialized Particle Effects
```blitzbasic
Function CreateBloodParticles(x#, y#, z#, amount%)
    For i = 1 To amount
        emitter.ParticleEmitter = CreateParticleEmitter("blood_spray", x, y, z)
        
        ; Customize for blood
        emitter\Color[0] = 0.8  ; Red
        emitter\Color[1] = 0.0  ; Green
        emitter\Color[2] = 0.0  ; Blue
        emitter\Color[3] = 1.0  ; Alpha
        
        emitter\Speed = 5.0
        emitter\Gravity = 9.8
        emitter\LifeTime = 2.0
        emitter\Size = 0.05
    Next
End Function

Function CreateSanityParticles(x#, y#, z#)
    emitter.ParticleEmitter = CreateParticleEmitter("sanity_effect", x, y, z)
    
    ; Hallucination effect particles
    emitter\Color[0] = Rnd(0, 1)  ; Random colors
    emitter\Color[1] = Rnd(0, 1)
    emitter\Color[2] = Rnd(0, 1)
    emitter\Color[3] = 0.3  ; Semi-transparent
    
    emitter\Speed = 0.5
    emitter\Gravity = -1.0  ; Float upward
    emitter\LifeTime = 3.0
    emitter\Size = 0.1
    emitter\Rate = 10
End Function
```

---

## Lighting System

### Purpose
The lighting system creates dynamic horror atmosphere through carefully controlled illumination, shadows, and SCP-specific lighting effects.

### Architecture

#### Light Source Structure
```blitzbasic
Type LightSource
    Field LightID%             ; Unique light identifier
    Field LightType%           ; Type of light (point, spot, directional)
    Field Position#[3]         ; Light position
    Field Direction#[3]        ; Light direction (for spot/directional)
    Field Color#[3]            ; RGB color
    Field Intensity#           ; Light intensity
    Field Range#               ; Light range
    Field SpotAngle#           ; Spot light cone angle
    
    ; Animation properties
    Field Animated%            ; Light animation enabled
    Field FlickerPattern%      ; Flicker pattern type
    Field FlickerSpeed#        ; Flicker speed
    Field PulseMin#            ; Minimum pulse intensity
    Field PulseMax#            ; Maximum pulse intensity
    
    ; State
    Field Active%              ; Light is active
    Field Entity%              ; Blitz3D light entity
End Type

; Light types
Const LIGHT_POINT% = 1        ; Omni-directional point light
Const LIGHT_SPOT% = 2         ; Cone-shaped spotlight
Const LIGHT_DIRECTIONAL% = 3  ; Directional light (sun)
```

### Dynamic Lighting Management
```blitzbasic
Global Lights.LightSource[200] ; Light sources
Global AmbientColor#[3] = [0.1, 0.1, 0.1] ; Global ambient

Function CreateLightSource(lightType%, x#, y#, z#, range#)
    light.LightSource = New LightSource
    
    light\LightType = lightType
    light\Position[0] = x
    light\Position[1] = y
    light\Position[2] = z
    light\Range = range
    light\Active = True
    
    ; Create Blitz3D light entity
    light\Entity = CreateLight(lightType)
    PositionEntity light\Entity, x, y, z
    LightRange light\Entity, range
    
    ; Default white light
    light\Color[0] = 1.0
    light\Color[1] = 1.0
    light\Color[2] = 1.0
    light\Intensity = 1.0
    
    LightColor light\Entity, 255, 255, 255
    
    Return light
End Function

Function UpdateLighting()
    ; Update ambient lighting based on facility state
    UpdateAmbientLighting()
    
    ; Update all light sources
    For light.LightSource = Each LightSource
        If light\Active Then
            UpdateLightSource(light)
        EndIf
    Next
    
    ; Update SCP-specific lighting
    UpdateSCPLighting()
End Function

Function UpdateLightSource(light.LightSource)
    ; Handle animation
    If light\Animated Then
        Select light\FlickerPattern
            Case FLICKER_RANDOM
                intensity# = light\PulseMin + Rnd(0, 1) * (light\PulseMax - light\PulseMin)
            Case FLICKER_SINE
                intensity# = light\PulseMin + (Sin(MilliSecs() * light\FlickerSpeed) + 1) * 0.5 * (light\PulseMax - light\PulseMin)
            Case FLICKER_SQUARE
                intensity# = light\PulseMin + (MilliSecs() Mod (1000 / light\FlickerSpeed) < 500) * (light\PulseMax - light\PulseMin)
        End Select
        
        LightColor light\Entity, light\Color[0] * intensity * 255, light\Color[1] * intensity * 255, light\Color[2] * intensity * 255
    EndIf
    
    ; Update light position if attached to entity
    If light\AttachedEntity <> 0 Then
        PositionEntity light\Entity, EntityX(light\AttachedEntity), EntityY(light\AttachedEntity), EntityZ(light\AttachedEntity)
    EndIf
End Function

Function UpdateAmbientLighting()
    ; Base ambient is very dark for horror atmosphere
    AmbientColor[0] = 0.05
    AmbientColor[1] = 0.05
    AmbientColor[2] = 0.05
    
    ; Increase during power outages (red emergency lighting)
    If PowerOutageActive() Then
        AmbientColor[0] = 0.15  ; Red-tinted emergency lighting
        AmbientColor[1] = 0.05
        AmbientColor[2] = 0.05
    EndIf
    
    ; Apply ambient lighting
    AmbientLight AmbientColor[0] * 255, AmbientColor[1] * 255, AmbientColor[2] * 255
End Function
```

### SCP-Specific Lighting Effects
```blitzbasic
Function UpdateSCPLighting()
    ; SCP-173 containment chamber
    If SCP173Contained() Then
        ; Bright white light to prevent movement
        scp173Light.LightSource = GetSCPLight(173)
        scp173Light\Color[0] = 1.0
        scp173Light\Color[1] = 1.0
        scp173Light\Color[2] = 1.0
        scp173Light\Animated = False
    Else
        ; Dim red warning lights
        scp173Light\Color[0] = 0.8
        scp173Light\Color[1] = 0.1
        scp173Light\Color[2] = 0.1
        scp173Light\Animated = True
        scp173Light\FlickerPattern = FLICKER_SQUARE
    EndIf
    
    ; SCP-106 effects
    If SCP106Active() Then
        ; Create corrosive green lighting around SCP-106
        CreateDynamicLight(LIGHT_POINT, EntityX(scp106\Collider), EntityY(scp106\Collider), EntityZ(scp106\Collider), 10.0)
        light\Color[0] = 0.0
        light\Color[1] = 0.8
        light\Color[2] = 0.0
        light\Animated = True
        light\FlickerPattern = FLICKER_RANDOM
    EndIf
    
    ; Facility-wide effects
    If ContainmentBreach() Then
        ; Red alert lighting throughout facility
        For light.LightSource = Each LightSource
            If light\LightType = LIGHT_POINT Then
                light\Color[0] = 0.8
                light\Color[1] = 0.0
                light\Color[2] = 0.0
                light\Animated = True
                light\FlickerPattern = FLICKER_SINE
            EndIf
        Next
    EndIf
End Function
```

### Fog and Atmospheric Effects
```blitzbasic
Function UpdateFogEffects()
    ; Base fog for horror atmosphere
    CameraFogMode Camera, 1
    CameraFogColor Camera, 32, 32, 32  ; Dark gray fog
    CameraFogRange Camera, 5, 30       ; Near and far fog distances
    
    ; Adjust fog based on sanity
    sanityRatio# = PlayerSanity / MaxSanity
    If sanityRatio < 0.5 Then
        ; Increase fog density with low sanity
        fogDensity# = 1.0 - sanityRatio * 2.0
        CameraFogRange Camera, 5, 30 * fogDensity
    EndIf
    
    ; SCP-106 pocket dimension fog
    If InPocketDimension() Then
        CameraFogColor Camera, 0, 64, 0  ; Green fog
        CameraFogRange Camera, 1, 10      ; Very dense fog
    EndIf
End Function
```

---

## Graphics System Integration

### Render Pipeline
```blitzbasic
Function RenderGraphics()
    ; Update lighting
    UpdateLighting()
    
    ; Update fog
    UpdateFogEffects()
    
    ; Render world
    RenderWorld()
    
    ; Render particles (after world for transparency)
    For emitter.ParticleEmitter = Each ParticleEmitter
        RenderParticles(emitter)
    Next
    
    ; Render UI (after particles)
    RenderUI()
    
    ; Post-processing effects
    ApplyPostProcessing()
    
    ; Flip buffers
    Flip()
End Function

Function ApplyPostProcessing()
    ; Sanity-based visual effects
    sanityRatio# = PlayerSanity / MaxSanity
    
    If sanityRatio < 0.3 Then
        ; Heavy distortion effects
        ApplyScreenDistortion(0.8)
        ApplyColorDesaturation(0.6)
    ElseIf sanityRatio < 0.7 Then
        ; Mild effects
        ApplyScreenDistortion(0.3)
        ApplyColorDesaturation(0.2)
    EndIf
    
    ; Blink effect
    If BlinkEffect > 0 Then
        ApplyScreenFade(BlinkEffect)
    EndIf
End Function
```

### Performance Optimizations
- **LOD System**: Reduce detail for distant objects
- **Frustum Culling**: Only render visible objects
- **Batch Rendering**: Group similar objects
- **Texture Atlasing**: Combine small textures

### Integration Points
- **[Rendering System](CORE_SYSTEMS.md#rendering-system)**: Core graphics pipeline
- **[Material System](#material-system)**: Surface properties
- **[Lighting System](#lighting-system)**: Dynamic illumination
- **[Particle System](#particle-system)**: Environmental effects

---

*Graphics/rendering systems create the visual horror of SCP: Containment Breach through sophisticated lighting, particle effects, and material systems that react to game state and player sanity.*