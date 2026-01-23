# Event/Trigger Systems Documentation

## Overview
Event and trigger systems manage the dynamic storytelling and interactive elements of SCP: Containment Breach. These systems handle SCP containment breaches, environmental changes, and player-triggered events that create the game's tense, unpredictable atmosphere.

## Event System

### Purpose
The event system manages game events that drive narrative progression, create tension, and respond to player actions, making each playthrough unique and unpredictable.

### Architecture

#### Event Data Structure
```blitzbasic
Type GameEvent
    Field EventID%             ; Unique event identifier
    Field EventType%           ; Type of event (SCP breach, security alert, etc.)
    Field Name$                ; Event name
    Field Description$         ; Event description
    Field Room.Rooms           ; Associated room (Null for global events)
    
    ; Timing
    Field TriggerTime#         ; Time until event triggers
    Field Duration#            ; How long event lasts
    Field Cooldown#            ; Time between event repeats
    
    ; Conditions
    Field Conditions$          ; Required conditions for triggering
    Field Probability#         ; Chance of triggering (0.0-1.0)
    
    ; State
    Field Active%              ; Is event currently active
    Field Triggered%           ; Has event been triggered
    Field Completed%           ; Has event completed
    
    ; Effects
    Field Effects$             ; Event effects/consequences
    Field Priority%            ; Event priority (higher = more important)
End Type

; Event types
Const EVENT_SCP_BREACH% = 1   ; SCP containment breach
Const EVENT_SECURITY_ALERT% = 2  ; Security system activation
Const EVENT_ENVIRONMENTAL% = 3   ; Environmental change
Const EVENT_NARRATIVE% = 4       ; Story progression
Const EVENT_MAINTENANCE% = 5     ; Facility maintenance
Const EVENT_EMERGENCY% = 6       ; Emergency situation
```

### Core Functions

#### Event Management
```blitzbasic
Global ActiveEvents.GameEvent[50]  ; Currently active events
Global PendingEvents.GameEvent[100] ; Events waiting to trigger

Function InitializeEventSystem()
    ; Load event templates
    LoadEventTemplates("events.dat")
    
    ; Setup initial events
    SetupInitialEvents()
End Function

Function UpdateEvents()
    ; Update active events
    For i = 0 To 49
        If ActiveEvents[i] <> Null Then
            UpdateEvent(ActiveEvents[i])
        EndIf
    Next
    
    ; Check pending events
    CheckPendingEvents()
    
    ; Trigger new events
    TriggerRandomEvents()
End Function

Function UpdateEvent(event.GameEvent)
    ; Update event timer
    If event\TriggerTime > 0 Then
        event\TriggerTime = event\TriggerTime - (1.0 / 60.0)
        
        If event\TriggerTime <= 0 Then
            ; Trigger event
            TriggerEvent(event)
        EndIf
    EndIf
    
    ; Update active event
    If event\Active Then
        ExecuteEventLogic(event)
        
        ; Check completion
        If EventCompleted(event) Then
            CompleteEvent(event)
        EndIf
    EndIf
End Function
```

#### Event Triggering
```blitzbasic
Function TriggerEvent(event.GameEvent)
    ; Check trigger conditions
    If CheckEventConditions(event) Then
        ; Find available slot
        slot% = FindAvailableEventSlot()
        
        If slot >= 0 Then
            ; Activate event
            event\Active = True
            event\Triggered = True
            ActiveEvents[slot] = event
            
            ; Execute immediate effects
            ExecuteEventEffects(event)
            
            ; Notify systems
            OnEventTriggered(event)
            
            ; Show event notification
            ShowEventMessage(event)
        EndIf
    EndIf
End Function

Function CheckEventConditions(event.GameEvent)
    Select event\EventType
        Case EVENT_SCP_BREACH
            Return CheckSCPBreachConditions(event)
        Case EVENT_SECURITY_ALERT
            Return CheckSecurityConditions(event)
        Case EVENT_ENVIRONMENTAL
            Return CheckEnvironmentalConditions(event)
        Case EVENT_NARRATIVE
            Return CheckNarrativeConditions(event)
        Default
            Return True
    End Select
End Function

Function ExecuteEventEffects(event.GameEvent)
    ; Parse and execute effects
    effects$ = event\Effects
    effectLines$ = SplitString(effects, "|")
    
    For i = 0 To effectLines.length - 1
        ExecuteEffect(effectLines[i])
    Next
End Function

Function ExecuteEffect(effect$)
    ; Parse effect command
    command$ = Trim(Left(effect, Instr(effect, " ")))
    params$ = Trim(Mid(effect, Instr(effect, " ") + 1))
    
    Select command
        Case "SPAWN_SCP"
            SpawnSCP(params)
        Case "ACTIVATE_ALARM"
            ActivateAlarm(params)
        Case "LOCK_DOORS"
            LockDoors(params)
        Case "CHANGE_LIGHTS"
            ChangeLights(params)
        Case "PLAY_SOUND"
            PlayEventSound(params)
        Case "SHOW_MESSAGE"
            ShowEventMessage(params)
    End Select
End Function
```

#### Event Completion
```blitzbasic
Function CompleteEvent(event.GameEvent)
    ; Execute completion effects
    ExecuteCompletionEffects(event)
    
    ; Mark as completed
    event\Active = False
    event\Completed = True
    
    ; Set cooldown
    event\TriggerTime = event\Cooldown
    
    ; Remove from active events
    RemoveFromActiveEvents(event)
    
    ; Trigger follow-up events
    TriggerFollowUpEvents(event)
    
    ; Update game state
    UpdateEventState(event)
End Function

Function ExecuteCompletionEffects(event.GameEvent)
    ; Parse completion effects
    If event\CompletionEffects <> "" Then
        ExecuteEffect(event\CompletionEffects)
    EndIf
End Function

Function TriggerFollowUpEvents(event.GameEvent)
    ; Find events that depend on this event
    For e.GameEvent = Each GameEvent
        If Instr(e\Conditions, "EVENT_COMPLETED:" + event\EventID) > 0 Then
            ; Increase trigger probability
            e\Probability = Min(e\Probability * 1.5, 1.0)
        EndIf
    Next
End Function
```

### Specific Event Types

#### SCP Breach Events
```blitzbasic
Function CheckSCPBreachConditions(event.GameEvent)
    ; Check containment status
    scpID% = GetEventSCP(event)
    chamber.Rooms = FindSCPChamber(scpID)
    
    If chamber <> Null Then
        ; Check if containment is compromised
        If ChamberBreached(chamber) Then
            Return True
        EndIf
        
        ; Check probability based on time
        timeFactor# = GetTimeSinceLastBreach() / 3600.0  ; Hours
        breachProbability# = event\Probability * (1 + timeFactor * 0.1)
        
        Return Rnd(0, 1) < breachProbability
    EndIf
    
    Return False
End Function

Function ExecuteSCPBreach(event.GameEvent)
    scpID% = GetEventSCP(event)
    
    ; Free SCP from containment
    FreeSCP(scpID)
    
    ; Trigger facility response
    TriggerContainmentBreachResponse(scpID)
    
    ; Update facility security
    IncreaseSecurityLevel()
    
    ; Alert player
    ShowEventMessage("CONTAINMENT BREACH DETECTED - SCP-" + scpID + " HAS ESCAPED")
End Function
```

#### Security Alert Events
```blitzbasic
Function CheckSecurityConditions(event.GameEvent)
    ; Check for security triggers
    If PlayerDetected() Then Return True
    If DoorForced() Then Return True
    If CameraDestroyed() Then Return True
    If AlarmTriggered() Then Return True
    
    Return False
End Function

Function ExecuteSecurityAlert(event.GameEvent)
    ; Activate security systems
    ActivateSecuritySystems(event\Room)
    
    ; Spawn security response
    SpawnSecurityResponse(event\Room)
    
    ; Lock down area
    LockDownArea(event\Room)
    
    ; Alert player
    PlaySound(securityAlarm)
    ShowEventMessage("SECURITY ALERT - INTRUDER DETECTED")
End Function
```

#### Environmental Events
```blitzbasic
Function CheckEnvironmentalConditions(event.GameEvent)
    ; Check environmental triggers
    room.Rooms = event\Room
    
    If room <> Null Then
        ; Check power status
        If PowerOutage(room) Then Return True
        
        ; Check temperature
        If ExtremeTemperature(room) Then Return True
        
        ; Check structural integrity
        If StructuralDamage(room) Then Return True
    EndIf
    
    Return False
End Function

Function ExecuteEnvironmentalEvent(event.GameEvent)
    room.Rooms = event\Room
    
    ; Apply environmental effects
    ApplyEnvironmentalEffect(room, event\Effects)
    
    ; Spawn environmental hazards
    If Instr(event\Effects, "FIRE") > 0 Then
        SpawnFire(room)
    EndIf
    
    If Instr(event\Effects, "FLOOD") > 0 Then
        SpawnFlood(room)
    EndIf
    
    ; Alert player
    ShowEventMessage("ENVIRONMENTAL HAZARD DETECTED IN " + room\Name)
End Function
```

---

## Trigger System

### Purpose
The trigger system manages environmental triggers that respond to player actions and create interactive elements throughout the facility.

### Architecture

#### Trigger Data Structure
```blitzbasic
Type Trigger
    Field TriggerID%           ; Unique trigger identifier
    Field TriggerType%         ; Type of trigger
    Field Name$                ; Trigger name
    
    ; Spatial properties
    Field x#, y#, z#           ; Trigger position
    Field width#, height#, depth#  ; Trigger size
    Field Room.Rooms           ; Associated room
    
    ; Trigger conditions
    Field ActivationType%      ; How trigger activates
    Field RequiredItem%        ; Item required for activation
    Field KeycardLevel%        ; Security level required
    Field OneTime%             ; Can only trigger once
    
    ; State
    Field Active%              ; Is trigger active
    Field Triggered%           ; Has been triggered
    Field Cooldown#            ; Time between activations
    
    ; Effects
    Field Effects$             ; Trigger effects
End Type

; Trigger types
Const TRIGGER_POSITION% = 1   ; Position-based trigger
Const TRIGGER_ITEM% = 2       ; Item-based trigger
Const TRIGGER_TIME% = 3       ; Time-based trigger
Const TRIGGER_STATE% = 4      ; State-based trigger
Const TRIGGER_SEQUENCE% = 5   ; Multi-step sequence
```

### Core Functions

#### Trigger Management
```blitzbasic
Global ActiveTriggers.Trigger[100]  ; Active triggers in current area

Function UpdateTriggers()
    ; Update active triggers
    For i = 0 To 99
        If ActiveTriggers[i] <> Null Then
            UpdateTrigger(ActiveTriggers[i])
        EndIf
    Next
    
    ; Load triggers for current area
    UpdateAreaTriggers()
End Function

Function UpdateTrigger(trigger.Trigger)
    ; Check cooldown
    If trigger\Cooldown > 0 Then
        trigger\Cooldown = trigger\Cooldown - (1.0 / 60.0)
        Return
    EndIf
    
    ; Check activation conditions
    If CheckTriggerConditions(trigger) Then
        ; Trigger activated
        ActivateTrigger(trigger)
    EndIf
End Function

Function CheckTriggerConditions(trigger.Trigger)
    Select trigger\TriggerType
        Case TRIGGER_POSITION
            Return CheckPositionTrigger(trigger)
        Case TRIGGER_ITEM
            Return CheckItemTrigger(trigger)
        Case TRIGGER_TIME
            Return CheckTimeTrigger(trigger)
        Case TRIGGER_STATE
            Return CheckStateTrigger(trigger)
        Case TRIGGER_SEQUENCE
            Return CheckSequenceTrigger(trigger)
    End Select
End Function
```

#### Position Triggers
```blitzbasic
Function CheckPositionTrigger(trigger.Trigger)
    ; Check if player is within trigger bounds
    playerX# = EntityX(Camera)
    playerY# = EntityY(Camera)
    playerZ# = EntityZ(Camera)
    
    If playerX >= trigger\x - trigger\width/2 And playerX <= trigger\x + trigger\width/2 And _
       playerY >= trigger\y - trigger\height/2 And playerY <= trigger\y + trigger\height/2 And _
       playerZ >= trigger\z - trigger\depth/2 And playerZ <= trigger\z + trigger\depth/2 Then
        
        Return True
    EndIf
    
    Return False
End Function

Function ActivatePositionTrigger(trigger.Trigger)
    ; Execute position-based effects
    ExecuteTriggerEffects(trigger)
    
    ; Mark as triggered
    trigger\Triggered = True
    
    ; Set cooldown if applicable
    If Not trigger\OneTime Then
        trigger\Cooldown = 5.0  ; 5 second cooldown
    EndIf
End Function
```

#### Item Triggers
```blitzbasic
Function CheckItemTrigger(trigger.Trigger)
    ; Check if player has required item
    requiredItem% = trigger\RequiredItem
    
    For i = 0 To 8
        item.Items = Inventory\Items[i]
        If item <> Null And item\ItemID = requiredItem Then
            Return True
        EndIf
    Next
    
    Return False
End Function

Function ActivateItemTrigger(trigger.Trigger)
    ; Consume item if required
    If trigger\ConsumeItem Then
        ConsumeItem(trigger\RequiredItem)
    EndIf
    
    ; Execute item-based effects
    ExecuteTriggerEffects(trigger)
    
    ; Mark as triggered
    trigger\Triggered = True
End Function
```

#### Security Triggers
```blitzbasic
Function CheckSecurityTrigger(trigger.Trigger)
    ; Check keycard access
    requiredLevel% = trigger\KeycardLevel
    
    ; Find highest keycard level in inventory
    highestLevel% = 0
    
    For i = 0 To 8
        item.Items = Inventory\Items[i]
        If item <> Null And item\ItemType = ITEM_TYPE_KEYCARD Then
            If item\KeycardLevel > highestLevel Then
                highestLevel = item\KeycardLevel
            EndIf
        EndIf
    Next
    
    Return highestLevel >= requiredLevel
End Function

Function ActivateSecurityTrigger(trigger.Trigger)
    ; Check access level
    If CheckSecurityTrigger(trigger) Then
        ; Grant access
        ExecuteTriggerEffects(trigger)
        ShowMessage("Access Granted")
    Else
        ; Deny access
        PlaySound(accessDeniedSound)
        ShowMessage("Access Denied - Insufficient Clearance")
        
        ; Possibly trigger security alert
        If Rnd(0, 1) < 0.3 Then  ; 30% chance
            TriggerSecurityAlert(trigger\Room)
        EndIf
    EndIf
    
    ; Set cooldown
    trigger\Cooldown = 2.0
End Function
```

### Trigger Effects

#### Door Control
```blitzbasic
Function ExecuteDoorEffect(params$)
    ; Parse parameters: "DOOR:room_id,door_id,ACTION"
    roomID% = Int(Left(params, Instr(params, ",") - 1))
    params = Mid(params, Instr(params, ",") + 1)
    doorID% = Int(Left(params, Instr(params, ",") - 1))
    action$ = Mid(params, Instr(params, ",") + 1)
    
    door.Door = FindDoor(roomID, doorID)
    
    If door <> Null Then
        Select action
            Case "OPEN"
                OpenDoor(door)
            Case "CLOSE"
                CloseDoor(door)
            Case "LOCK"
                LockDoor(door)
            Case "UNLOCK"
                UnlockDoor(door)
        End Select
    EndIf
End Function
```

#### Environmental Effects
```blitzbasic
Function ExecuteEnvironmentEffect(params$)
    ; Parse parameters: "ENV:room_id,EFFECT_TYPE,intensity"
    roomID% = Int(Left(params, Instr(params, ",") - 1))
    params = Mid(params, Instr(params, ",") + 1)
    effectType$ = Left(params, Instr(params, ",") - 1)
    intensity# = Float(Mid(params, Instr(params, ",") + 1))
    
    room.Rooms = FindRoom(roomID)
    
    If room <> Null Then
        Select effectType
            Case "LIGHTS_OFF"
                TurnOffLights(room, intensity)
            Case "LIGHTS_FLICKER"
                FlickerLights(room, intensity)
            Case "POWER_OUTAGE"
                CausePowerOutage(room)
            Case "ALARM"
                ActivateAlarm(room, intensity)
        End Select
    EndIf
End Function
```

#### Audio Effects
```blitzbasic
Function ExecuteAudioEffect(params$)
    ; Parse parameters: "AUDIO:sound_name,volume,loop"
    soundName$ = Left(params, Instr(params, ",") - 1)
    params = Mid(params, Instr(params, ",") + 1)
    volume# = Float(Left(params, Instr(params, ",") - 1))
    loop% = Int(Mid(params, Instr(params, ",") + 1))
    
    ; Play sound effect
    sound% = LoadSound(soundName)
    If sound <> Null Then
        If loop Then
            LoopSound(sound, volume)
        Else
            PlaySound(sound, volume)
        EndIf
    EndIf
End Function
```

---

## System Integration

### Event/Trigger Update Loop
```blitzbasic
Function UpdateEventTriggerSystems()
    ; Update events
    UpdateEvents()
    
    ; Update triggers
    UpdateTriggers()
    
    ; Check for event-trigger interactions
    CheckEventTriggerInteractions()
End Function

Function CheckEventTriggerInteractions()
    ; Events can create triggers
    For event.GameEvent = Each GameEvent
        If event\Active And Instr(event\Effects, "CREATE_TRIGGER") > 0 Then
            CreateEventTrigger(event)
        EndIf
    Next
    
    ; Triggers can trigger events
    For trigger.Trigger = Each Trigger
        If trigger\Triggered And Instr(trigger\Effects, "TRIGGER_EVENT") > 0 Then
            TriggerLinkedEvent(trigger)
        EndIf
    Next
End Function
```

### State Persistence
```blitzbasic
Function SaveEventTriggerState()
    ; Save active events
    For i = 0 To 49
        If ActiveEvents[i] <> Null Then
            WriteInt file, ActiveEvents[i]\EventID
            WriteFloat file, ActiveEvents[i]\TriggerTime
            WriteInt file, ActiveEvents[i]\Active
            WriteInt file, ActiveEvents[i]\Completed
        EndIf
    Next
    
    ; Save triggered triggers
    For trigger.Trigger = Each Trigger
        If trigger\Triggered Then
            WriteInt file, trigger\TriggerID
            WriteFloat file, trigger\Cooldown
        EndIf
    Next
End Function

Function LoadEventTriggerState()
    ; Load active events
    While Not Eof(file)
        eventID% = ReadInt(file)
        event.GameEvent = FindEvent(eventID)
        If event <> Null Then
            event\TriggerTime = ReadFloat(file)
            event\Active = ReadInt(file)
            event\Completed = ReadInt(file)
        EndIf
    Wend
    
    ; Load triggered triggers
    While Not Eof(file)
        triggerID% = ReadInt(file)
        trigger.Trigger = FindTrigger(triggerID)
        If trigger <> Null Then
            trigger\Triggered = True
            trigger\Cooldown = ReadFloat(file)
        EndIf
    Wend
End Function
```

### Performance Considerations
- **Event Culling**: Only process events in active areas
- **Trigger Spatial Indexing**: Use spatial partitioning for trigger queries
- **Effect Batching**: Group similar effects for efficient execution
- **Cooldown Management**: Prevent trigger spam

### Balancing Considerations
- **Event Frequency**: Balance tension without frustration
- **Trigger Visibility**: Make triggers discoverable but not obvious
- **Consequence Scaling**: Match event severity to player actions
- **Replayability**: Ensure events create varied experiences

---

*Event and trigger systems create the dynamic, unpredictable world of SCP: Containment Breach, where player actions have real consequences and the facility itself seems alive with automated responses to containment breaches and security incidents.*