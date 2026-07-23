# Entity Systems Documentation

## Overview

Entity systems manage all living and interactive objects in the SCP: Containment
Breach game world. These systems handle NPC behavior, SCP entity mechanics, and
human character interactions, creating the intelligent and dangerous world that
defines the survival horror experience.

## NPC AI System

### Purpose

The NPC AI system provides intelligent behavior for non-player characters,
enabling complex interactions, pathfinding, and state-based decision making that
creates realistic facility personnel and security responses.

### Architecture

#### NPC State Machine

```blitzbasic
Type NPCs
    Field obj%                  ; Primary 3D entity
    Field obj2%                 ; Secondary entity (legs/effects)
    Field Collider%             ; Physics collision entity
    Field NPCtype%              ; Entity type identifier
    Field ID%                   ; Unique instance ID
    
    ; State machine
    Field State#                ; Primary state machine
    Field State2#               ; Secondary state/timer
    Field State3#               ; Tertiary state/counter
    Field PrevState%            ; Previous state for transitions
    
    ; Movement and behavior
    Field Speed#, CurrSpeed#    ; Movement speeds
    Field Path.WayPoints[20]    ; Navigation waypoints
    Field PathStatus%           ; Current pathfinding state
    Field PathTimer#            ; Pathfinding timer
    Field PathLocation%         ; Current waypoint index
    
    ; Targeting and awareness
    Field Target.NPCs           ; Current target entity
    Field TargetID%             ; Target ID for reference
    Field EnemyX#, EnemyY#, EnemyZ# ; Last known target position
    Field Alerted%              ; Alert state flag
    Field LastSeen%, LastDist#  ; Detection tracking
    
    ; Health and status
    Field Health#               ; Current health
    Field MaxHealth#            ; Maximum health
    Field IsDead%               ; Death state
    
    ; Special properties
    Field BlinkTimer#           ; Blink timing (SCP-173 interaction)
    Field IgnorePlayer%         ; Whether to ignore player
    Field Sound%, SoundChn%, SoundTimer# ; Audio properties
End Type
```

#### State Machine States

```blitzbasic
; Universal NPC states
Const STATE_IDLE% = 0           ; Idle/standing
Const STATE_WANDER% = 1         ; Random movement
Const STATE_PATROL% = 2         ; Patrol route
Const STATE_ALERT% = 3          ; Alerted to disturbance
Const STATE_SEARCH% = 4         ; Searching for target
Const STATE_HUNT% = 5           ; Actively pursuing target
Const STATE_ATTACK% = 6         ; Attacking target
Const STATE_FLEE% = 7           ; Fleeing from threat
Const STATE_DEAD% = 8           ; Dead/inactive

; NPC-specific states (examples)
Const GUARD_PATROL% = 10        ; Guard patrol behavior
Const GUARD_COMBAT% = 11        ; Guard combat mode
Const SCIENTIST_WORK% = 12      ; Scientist work activities
Const SCIENTIST_PANIC% = 13     ; Scientist panic state
```

### Core AI Functions

#### UpdateNPCs Function

```blitzbasic
Function UpdateNPCs()
    For n.NPCs = Each NPCs
        If n\IsDead = False Then
            ; Update based on NPC type
            Select n\NPCtype
                Case NPCtype173: UpdateSCP173(n)
                Case NPCtypeOldMan: UpdateSCP106(n)
                Case NPCtype096: UpdateSCP096(n)
                Case NPCtype049: UpdateSCP049(n)
                Case NPCtypeMTF: UpdateMTFUnit(n)
                Case NPCtypeGuard: UpdateGuard(n)
                Case NPCtypeD: UpdateDClass(n)
                ; ... other NPC types
            End Select
            
            ; Update shared systems
            UpdateNPCPath(n)          ; Pathfinding
            UpdateNPCAudio(n)         ; Sound effects
            UpdateNPCAnimation(n)     ; Visual animations
        EndIf
    Next
End Function
```

#### Pathfinding Integration

```blitzbasic
Function UpdateNPCPath(n.NPCs)
    ; Update pathfinding status
    Select n\PathStatus
        Case PATH_IDLE
            ; No active path
        Case PATH_ACTIVE
            FollowCurrentPath(n)
        Case PATH_BLOCKED
            ; Path blocked, recalculate
            If MilliSecs() - n\PathTimer > 2000 Then
                FindPath(n, n\Target\obj)
            EndIf
        Case PATH_FAILED
            ; Pathfinding failed, handle accordingly
            HandlePathFailure(n)
    End Select
End Function

Function FollowCurrentPath(n.NPCs)
    If n\PathLocation < 20 And n\Path[n\PathLocation] <> Null Then
        wp.WayPoints = n\Path[n\PathLocation]
        
        ; Calculate direction to waypoint
        dx# = EntityX(wp\obj) - EntityX(n\Collider)
        dz# = EntityZ(wp\obj) - EntityZ(n\Collider)
        targetAngle# = ATan2(dx, dz)
        
        ; Rotate towards waypoint
        RotateEntity n\Collider, 0, targetAngle, 0
        
        ; Move towards waypoint
        MoveEntity n\Collider, 0, 0, n\CurrSpeed
        
        ; Check if reached waypoint
        dist# = EntityDistance(n\Collider, wp\obj)
        If dist < 0.5 Then
            n\PathLocation = n\PathLocation + 1
            If n\PathLocation >= 20 Or n\Path[n\PathLocation] = Null Then
                n\PathStatus = PATH_COMPLETE
            EndIf
        EndIf
    EndIf
End Function
```

#### Detection Systems

```blitzbasic
Function UpdateNPCDetection(n.NPCs)
    ; Line of sight check
    If EntityVisible(n\Collider, Camera) Then
        n\LastSeen = True
        n\LastDist = EntityDistance(n\Collider, Camera)
        n\EnemyX = EntityX(Camera)
        n\EnemyY = EntityY(Camera)
        n\EnemyZ = EntityZ(Camera)
    Else
        n\LastSeen = False
    EndIf
    
    ; Audio detection (simplified)
    If PlayerFootstepVolume > DETECTION_THRESHOLD Then
        If DistanceToPlayer(n) < AUDIO_RANGE Then
            n\Alerted = True
        EndIf
    EndIf
    
    ; State transitions based on detection
    If n\Alerted And n\LastSeen Then
        n\State = STATE_HUNT
        n\Target = Player  ; Set player as target
    ElseIf n\Alerted Then
        n\State = STATE_SEARCH
    EndIf
End Function
```

### Integration Points

- **[Waypoint System](WAYPOINT_SYSTEM.md)**: Provides pathfinding navigation
- **[Physics System](CORE_SYSTEMS.md#physics-system)**: Handles collision
  detection
- **[Audio System](CORE_SYSTEMS.md#audio-system)**: Manages NPC sound effects
- **[State Management Systems](STATE_MANAGEMENT_SYSTEMS.md)**: Persists NPC
  states

---

## SCP Entity System

### Purpose

SCP entity systems implement the unique behaviors and mechanics of each SCP,
creating the terrifying and unpredictable threats that define the SCP universe.

### SCP-173 (The Sculpture)

```blitzbasic
Function UpdateSCP173(n.NPCs)
    Select n\State
        Case 0  ; Idle - waiting to be observed
            ; SCP-173 only moves when not observed
            If Not EntityVisible(n\obj, Camera) Then
                If EntityDistance(n\Collider, Camera) < 10 Then
                    ; Move towards player
                    PointEntity n\Collider, Camera
                    MoveEntity n\Collider, 0, 0, 0.1
                EndIf
            EndIf
            
            ; Check for neck snap opportunity
            If EntityDistance(n\Collider, Camera) < 0.65 Then
                KillPlayer("Neck Snap")
            EndIf
            
        Case 1  ; Contained
            ; Stationary in containment chamber
    End Select
End Function
```

### SCP-106 (The Old Man)

```blitzbasic
Function UpdateSCP106(n.NPCs)
    Select n\State
        Case 0  ; Idle
            ; Wait for activation
            
        Case 1  ; Active Hunting
            If EntityDistance(n\Collider, Camera) > 40 Then
                ; Phase through walls
                NoClipMode(n\Collider, True)
                PointEntity n\Collider, Camera
                MoveEntity n\Collider, 0, 0, 0.2
                NoClipMode(n\Collider, False)
            Else
                ; Normal movement
                PointEntity n\Collider, Camera
                MoveEntity n\Collider, 0, 0, 0.15
            EndIf
            
            ; Pocket dimension attack
            If EntityDistance(n\Collider, Camera) < 1.5 Then
                SendPlayerToPocketDimension()
            EndIf
    End Select
End Function
```

### SCP-096 (The Shy Guy)

```blitzbasic
Function UpdateSCP096(n.NPCs)
    Select n\State
        Case 0  ; Sitting/Idle
            ; Sobbing animation
            If EntityVisible(n\obj, Camera) Then
                ; Face viewed - enter rage state
                n\State = 1
                PlaySound(ShyGuyRageSound)
            EndIf
            
        Case 1 To 3  ; Enraging
            ; Get up and scream
            n\State = n\State + 1
            
        Case 4  ; Hunting
            ; Unstoppable pursuit
            PointEntity n\Collider, Camera
            MoveEntity n\Collider, 0, 0, 0.25  ; Fast speed
            
            If EntityDistance(n\Collider, Camera) < 1.0 Then
                KillPlayer("Shy Guy Rage")
            EndIf
            
        Case 5  ; Cooling down
            ; Post-rage wandering
            n\State = 0  ; Return to idle
    End Select
End Function
```

### SCP-049 (The Plague Doctor)

```blitzbasic
Function UpdateSCP049(n.NPCs)
    Select n\State
        Case 1  ; Looking around
            ; Patrol behavior
            If Rand(400) = 1 Then
                ; Random movement
                RotateEntity n\Collider, 0, Rnd(-180, 180), 0
                MoveEntity n\Collider, 0, 0, 0.05
            EndIf
            
        Case 2  ; Active hunting
            ; Advanced pathfinding
            If n\PathStatus = PATH_IDLE Then
                FindPath(n, Camera)
            EndIf
            
            ; Door interactions
            If EntityDistance(n\Collider, door\obj) < 2 Then
                If door\open = False Then
                    OpenDoor(door)  ; Opens doors in front
                Else
                    CloseDoor(door) ; Closes doors behind (unique behavior)
                EndIf
            EndIf
            
        Case 3  ; Attacking
            ; Touch attack
            If EntityDistance(n\Collider, Camera) < 1.0 Then
                KillPlayer("SCP-049 Cure")
                ; Transform player to SCP-049-2
            EndIf
    End Select
End Function
```

### SCP-939 (With Many Voices)

```blitzbasic
Function UpdateSCP939(n.NPCs)
    ; Pack coordination
    If n\State = STATE_HUNT Then
        ; Voice mimicry
        If Rand(300) = 1 Then
            PlayMimicrySound()
        EndIf
        
        ; Enhanced detection
        If CanHearPlayer(n) Or CanSmellPlayer(n) Then
            AlertPack(n)
        EndIf
        
        ; Pack attack
        If PackNearby(n) Then
            CoordinateAmbush(n)
        EndIf
    EndIf
End Function

Function AlertPack(leader.NPCs)
    ; Alert nearby pack members
    For other.NPCs = Each NPCs
        If other\NPCtype = NPCtype939 Then
            If EntityDistance(leader\Collider, other\Collider) < PACK_RANGE Then
                other\State = STATE_HUNT
                other\Target = leader\Target
            EndIf
        EndIf
    Next
End Function
```

---

## Human NPC System

### Purpose

Human NPCs provide realistic facility personnel behavior, from security guards
to scientists, creating a living facility environment that reacts to containment
breaches.

### Guard NPCs

```blitzbasic
Function UpdateGuard(n.NPCs)
    Select n\State
        Case GUARD_PATROL
            ; Standard patrol route
            If n\PathStatus = PATH_IDLE Then
                ; Find next patrol waypoint
                nextWP.WayPoints = FindNextPatrolPoint(n)
                FindPath(n, nextWP\obj)
            EndIf
            
        Case GUARD_ALERT
            ; Investigate disturbance
            If EntityDistance(n\Collider, disturbanceLocation) < 2 Then
                n\State = GUARD_COMBAT
            EndIf
            
        Case GUARD_COMBAT
            ; Combat behavior
            If n\LastSeen Then
                ; Shoot at player
                FireWeapon(n)
            Else
                ; Search for player
                n\State = GUARD_SEARCH
            EndIf
            
        Case GUARD_SEARCH
            ; Search pattern
            If Rand(200) = 1 Then
                RotateEntity n\Collider, 0, Rnd(-90, 90), 0
            EndIf
            MoveEntity n\Collider, 0, 0, n\CurrSpeed
    End Select
End Function
```

### MTF (Mobile Task Force) Units

```blitzbasic
Type MTFUnit
    Field Leader.NPCs           ; Squad leader reference
    Field SquadID%              ; Squad identifier
    Field Formation%            ; Formation position
End Type

Function UpdateMTFUnit(n.NPCs)
    mtf.MTFUnit = n\MTFData
    
    If mtf\Leader <> Null Then
        ; Follow leader behavior
        If EntityDistance(n\Collider, mtf\Leader\Collider) > FORMATION_DISTANCE Then
            ; Pathfind to leader
            FindPath(n, mtf\Leader\Collider)
        EndIf
        
        ; Mirror leader's state
        n\State = mtf\Leader\State
        n\Target = mtf\Leader\Target
    Else
        ; Leader behavior
        UpdateMTFLeader(n)
    EndIf
End Function

Function UpdateMTFLeader(n.NPCs)
    Select n\State
        Case MTF_PATROL
            ; Sweep facility for SCPs
            If DetectedSCP() Then
                n\State = MTF_CONTAINMENT
            EndIf
            
        Case MTF_CONTAINMENT
            ; Move to SCP location
            FindPath(n, SCPLocation)
            
            ; Re-contain SCP-173
            If NearSCP173Chamber() Then
                RecontainSCP173()
            EndIf
            
        Case MTF_COMBAT
            ; Engage threats
            If n\LastSeen Then
                FireWeapon(n)
            EndIf
    End Select
End Function
```

### Scientist NPCs

```blitzbasic
Function UpdateScientist(n.NPCs)
    Select n\State
        Case SCIENTIST_WORK
            ; Work at computer/console
            If Rand(1000) = 1 Then
                ; Random work animation
                Animate n\obj, 1, 0.5, ANIMATION_WORK, 1
            EndIf
            
            ; React to containment breach
            If BreachDetected() Then
                n\State = SCIENTIST_PANIC
            EndIf
            
        Case SCIENTIST_PANIC
            ; Panic behavior
            If Rand(100) = 1 Then
                ; Random panic movement
                RotateEntity n\Collider, 0, Rnd(-180, 180), 0
                MoveEntity n\Collider, 0, 0, 0.1
            EndIf
            
            ; Try to escape
            If NearExit() Then
                FindPath(n, ExitLocation)
            EndIf
    End Select
End Function
```

### D-Class Personnel

```blitzbasic
Function UpdateDClass(n.NPCs)
    Select n\State
        Case DCLASS_IDLE
            ; Bored/idle behavior
            If Rand(500) = 1 Then
                ; Random movement
                MoveEntity n\Collider, Rnd(-0.1, 0.1), 0, Rnd(-0.1, 0.1)
            EndIf
            
        Case DCLASS_WORK
            ; Forced labor
            ; Follow assigned path
            
        Case DCLASS_PANIC
            ; Escape attempts
            If NearVents() Then
                ; Try to crawl through vents
                UseVentSystem(n)
            EndIf
            
        Case DCLASS_ATTACK
            ; If armed or desperate
            If HasWeapon(n) Then
                AttackGuards(n)
            EndIf
    End Select
End Function
```

---

## Entity System Integration

### Shared Update Loop

```blitzbasic
Function UpdateAllEntities()
    ; Update player systems
    UpdatePlayer()
    
    ; Update all NPCs
    UpdateNPCs()
    
    ; Update SCP entities (subset of NPCs)
    UpdateSCPEntities()
    
    ; Update entity interactions
    UpdateEntityCollisions()
    UpdateEntitySounds()
    
    ; Update entity states for save/load
    UpdateEntityStates()
End Function
```

### State Persistence

```blitzbasic
Function SaveEntityStates()
    For n.NPCs = Each NPCs
        ; Save position and state
        WriteFloat file, EntityX(n\Collider)
        WriteFloat file, EntityY(n\Collider)
        WriteFloat file, EntityZ(n\Collider)
        WriteInt file, n\State
        WriteInt file, n\Health
        WriteInt file, n\PathStatus
        ; ... other state data
    Next
End Function

Function LoadEntityStates()
    For n.NPCs = Each NPCs
        ; Restore position and state
        x# = ReadFloat(file)
        y# = ReadFloat(file)
        z# = ReadFloat(file)
        state% = ReadInt(file)
        health# = ReadFloat(file)
        
        PositionEntity n\Collider, x, y, z
        n\State = state
        n\Health = health
        ; ... restore other state data
    Next
End Function
```

### Performance Considerations

- **Entity Culling**: Only update entities near player
- **State Caching**: Cache frequently accessed entity states
- **Pathfinding Optimization**: Use pre-calculated paths for common routes
- **LOD System**: Reduce AI complexity for distant entities

### AI Balancing

- **Detection Ranges**: Balance awareness without making AI too perceptive
- **Pathfinding Frequency**: Recalculate paths only when necessary
- **State Transitions**: Smooth transitions between AI states
- **Resource Allocation**: Prioritize critical NPCs over background characters

---

_Entity systems create the intelligent and dangerous world of SCP: Containment
Breach, from the terrifying unpredictability of SCP entities to the realistic
behaviors of facility personnel._
