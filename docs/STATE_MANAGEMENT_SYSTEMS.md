# State Management Systems Documentation

## Overview
State management systems handle the persistence, loading, and synchronization of game state across all systems, ensuring consistent gameplay and save/load functionality.

## Game State Manager

### Purpose
The game state manager coordinates overall game state, manages game sessions, and handles transitions between different game modes.

### Architecture

#### Game State Structure
```blitzbasic
Type GameState
    Field CurrentMode%         ; Current game mode
    Field PreviousMode%        ; Previous game mode
    Field SessionStart%        ; Session start time
    Field TotalPlayTime#       ; Total play time
    Field LastSaveTime%        ; Last save timestamp
    Field Difficulty%          ; Current difficulty level
    
    ; Game progress
    Field CurrentRoom.Rooms    ; Current player room
    Field AreasDiscovered%     ; Number of discovered areas
    Field EventsTriggered%     ; Number of events triggered
    Field Achievements%[50]    ; Achievement flags
    
    ; Game settings
    Field MasterVolume#        ; Master audio volume
    Field SFXVolume#           ; Sound effects volume
    Field MusicVolume#         ; Music volume
    Field MouseSensitivity#    ; Mouse look sensitivity
    Field InvertMouse%         ; Mouse Y-axis inversion
End Type

; Game modes
Const MODE_MENU% = 0          ; Main menu
Const MODE_LOADING% = 1       ; Loading screen
Const MODE_GAME% = 2          ; Active gameplay
Const MODE_PAUSED% = 3        ; Game paused
Const MODE_GAME_OVER% = 4     ; Game over screen
Const MODE_CREDITS% = 5       ; Credits screen
```

### State Management Functions
```blitzbasic
Global CurrentGameState.GameState

Function InitializeGameState()
    CurrentGameState = New GameState
    
    ; Set default values
    CurrentGameState\CurrentMode = MODE_MENU
    CurrentGameState\SessionStart = MilliSecs()
    CurrentGameState\Difficulty = DIFFICULTY_NORMAL
    CurrentGameState\MasterVolume = 1.0
    CurrentGameState\SFXVolume = 1.0
    CurrentGameState\MusicVolume = 1.0
    CurrentGameState\MouseSensitivity = 0.3
    
    ; Load saved settings
    LoadGameSettings()
End Function

Function ChangeGameMode(newMode%)
    ; Validate mode transition
    If Not CanTransitionToMode(newMode) Then Return
    
    ; Execute exit actions for current mode
    ExitGameMode(CurrentGameState\CurrentMode)
    
    ; Update state
    CurrentGameState\PreviousMode = CurrentGameState\CurrentMode
    CurrentGameState\CurrentMode = newMode
    
    ; Execute enter actions for new mode
    EnterGameMode(newMode)
    
    ; Update UI and systems
    UpdateModeSystems(newMode)
End Function

Function EnterGameMode(mode%)
    Select mode
        Case MODE_GAME
            ; Initialize gameplay systems
            InitializePlayer()
            InitializeWorld()
            StartGameTimer()
            
        Case MODE_PAUSED
            ; Pause game systems
            PauseAllSystems()
            
        Case MODE_GAME_OVER
            ; Show game over screen
            ShowGameOverScreen()
            
        Case MODE_LOADING
            ; Show loading screen
            ShowLoadingScreen()
    End Select
End Function

Function ExitGameMode(mode%)
    Select mode
        Case MODE_GAME
            ; Cleanup gameplay systems
            SaveAutoSave()
            CleanupWorld()
            
        Case MODE_PAUSED
            ; Resume systems
            ResumeAllSystems()
    End Select
End Function

Function UpdateGameState()
    ; Update play time
    If CurrentGameState\CurrentMode = MODE_GAME Then
        CurrentGameState\TotalPlayTime = CurrentGameState\TotalPlayTime + (1.0 / 60.0)
    EndIf
    
    ; Check for auto-save
    If ShouldAutoSave() Then
        PerformAutoSave()
    EndIf
    
    ; Update achievements
    CheckAchievements()
    
    ; Handle system-specific state updates
    UpdateSystemStates()
End Function
```

## Entity State System

### Purpose
The entity state system manages the state of all game entities, ensuring consistent behavior and proper save/load functionality.

### Entity State Management
```blitzbasic
Type EntityState
    Field EntityID%            ; Unique entity identifier
    Field EntityType%          ; Type of entity
    Field Position#[3]         ; Current position
    Field Rotation#[3]         ; Current rotation
    Field Scale#[3]            ; Current scale
    Field Health#              ; Current health
    Field State%               ; Current state
    Field StateData$           ; Additional state data
    
    ; Entity-specific data
    Field CustomData$          ; Entity-specific state
    Field LastUpdate%          ; Last update timestamp
End Type

Function SaveEntityStates()
    ; Create state file
    file = WriteFile("entity_states.dat")
    
    ; Save all entities
    For n.NPCs = Each NPCs
        WriteEntityState(file, n)
    Next
    
    For item.Items = Each Items
        WriteEntityState(file, item)
    Next
    
    CloseFile(file)
End Function

Function WriteEntityState(file, entity)
    ; Write common entity data
    WriteInt file, entity\EntityID
    WriteInt file, entity\EntityType
    
    If entity\obj <> 0 Then
        WriteFloat file, EntityX(entity\obj)
        WriteFloat file, EntityY(entity\obj)
        WriteFloat file, EntityZ(entity\obj)
        WriteFloat file, EntityPitch(entity\obj)
        WriteFloat file, EntityYaw(entity\obj)
        WriteFloat file, EntityRoll(entity\obj)
    EndIf
    
    ; Write entity-specific data
    If entity\NPCtype <> 0 Then  ; NPC entity
        WriteFloat file, entity\Health
        WriteInt file, entity\State
        WriteString file, entity\StateData
    ElseIf entity\ItemID <> 0 Then  ; Item entity
        WriteInt file, entity\State
        WriteInt file, entity\Quantity
    EndIf
End Function

Function LoadEntityStates()
    If Not FileType("entity_states.dat") Then Return
    
    file = ReadFile("entity_states.dat")
    
    While Not Eof(file)
        entityID% = ReadInt(file)
        entityType% = ReadInt(file)
        
        ; Find corresponding entity
        entity = FindEntityByID(entityID, entityType)
        
        If entity <> Null Then
            ; Restore position/rotation
            x# = ReadFloat(file)
            y# = ReadFloat(file)
            z# = ReadFloat(file)
            pitch# = ReadFloat(file)
            yaw# = ReadFloat(file)
            roll# = ReadFloat(file)
            
            PositionEntity entity\obj, x, y, z
            RotateEntity entity\obj, pitch, yaw, roll
            
            ; Restore entity-specific data
            If entity\NPCtype <> 0 Then
                entity\Health = ReadFloat(file)
                entity\State = ReadInt(file)
                entity\StateData = ReadString(file)
            ElseIf entity\ItemID <> 0 Then
                entity\State = ReadInt(file)
                entity\Quantity = ReadInt(file)
            EndIf
        EndIf
    Wend
    
    CloseFile(file)
End Function
```

## World State System

### Purpose
The world state system manages the state of the game world, including rooms, environmental conditions, and global game state.

### World State Management
```blitzbasic
Type WorldState
    Field WorldSeed%           ; Random seed for world generation
    Field CurrentTime#         ; In-game time
    Field TimeMultiplier#      ; Time speed multiplier
    Field Weather%             ; Current weather conditions
    Field Temperature#         ; Environmental temperature
    Field Humidity#            ; Environmental humidity
    
    ; Power systems
    Field MainPower%           ; Main facility power status
    Field BackupPower%         ; Backup power status
    Field LocalPower%[20]      ; Room-specific power states
    
    ; Security systems
    Field SecurityLevel%       ; Facility security level
    Field AlarmActive%         ; Alarm system status
    Field LockdownActive%      ; Facility lockdown status
    
    ; Environmental systems
    Field Ventilation%         ; Ventilation system status
    Field Filtration%          ; Air filtration status
    Field ContainmentStatus%   ; Overall containment integrity
End Type

Function InitializeWorldState()
    GlobalWorldState = New WorldState
    
    ; Set initial conditions
    GlobalWorldState\WorldSeed = GenerateWorldSeed()
    GlobalWorldState\CurrentTime = 0.0
    GlobalWorldState\TimeMultiplier = 1.0
    GlobalWorldState\Weather = WEATHER_CLEAR
    GlobalWorldState\Temperature = 20.0
    GlobalWorldState\Humidity = 0.5
    
    ; Initialize power systems
    GlobalWorldState\MainPower = True
    GlobalWorldState\BackupPower = True
    For i = 0 To 19
        GlobalWorldState\LocalPower[i] = True
    Next
    
    ; Initialize security
    GlobalWorldState\SecurityLevel = SECURITY_LEVEL_1
    GlobalWorldState\AlarmActive = False
    GlobalWorldState\LockdownActive = False
    
    ; Initialize environmental systems
    GlobalWorldState\Ventilation = True
    GlobalWorldState\Filtration = True
    GlobalWorldState\ContainmentStatus = 100.0
End Function

Function UpdateWorldState()
    ; Update time
    GlobalWorldState\CurrentTime = GlobalWorldState\CurrentTime + (1.0 / 60.0) * GlobalWorldState\TimeMultiplier
    
    ; Update weather
    UpdateWeather()
    
    ; Update environmental conditions
    UpdateEnvironmentalSystems()
    
    ; Update power systems
    UpdatePowerSystems()
    
    ; Update security systems
    UpdateSecuritySystems()
    
    ; Check for world events
    CheckWorldEvents()
End Function

Function UpdatePowerSystems()
    ; Simulate power system failures
    If Rnd(0, 1) < POWER_FAILURE_CHANCE Then
        ; Random power failure
        system% = Rand(0, 2)  ; Main, Backup, or Local
        
        Select system
            Case 0
                If GlobalWorldState\MainPower Then
                    GlobalWorldState\MainPower = False
                    TriggerPowerFailure(POWER_MAIN)
                EndIf
            Case 1
                If GlobalWorldState\BackupPower Then
                    GlobalWorldState\BackupPower = False
                    TriggerPowerFailure(POWER_BACKUP)
                EndIf
            Case 2
                room% = Rand(0, 19)
                If GlobalWorldState\LocalPower[room] Then
                    GlobalWorldState\LocalPower[room] = False
                    TriggerPowerFailureRoom(room)
                EndIf
        End Select
    EndIf
End Function

Function UpdateSecuritySystems()
    ; Update security level based on events
    If ContainmentBreachDetected() Then
        If GlobalWorldState\SecurityLevel < SECURITY_LEVEL_5 Then
            GlobalWorldState\SecurityLevel = GlobalWorldState\SecurityLevel + 1
            UpdateSecurityMeasures()
        EndIf
    EndIf
    
    ; Handle alarms
    If ShouldActivateAlarm() And Not GlobalWorldState\AlarmActive Then
        GlobalWorldState\AlarmActive = True
        ActivateFacilityAlarm()
    ElseIf Not ShouldActivateAlarm() And GlobalWorldState\AlarmActive Then
        GlobalWorldState\AlarmActive = False
        DeactivateFacilityAlarm()
    EndIf
    
    ; Handle lockdowns
    If ShouldActivateLockdown() And Not GlobalWorldState\LockdownActive Then
        GlobalWorldState\LockdownActive = True
        ActivateFacilityLockdown()
    EndIf
End Function
```

## Save/Load System Integration

### Comprehensive Save System
```blitzbasic
Function CreateCompleteSave(slot%)
    ; Create save directory
    saveDir$ = "saves/slot" + slot + "/"
    CreateDir saveDir
    
    ; Save game state
    SaveGameState(saveDir + "game_state.dat")
    
    ; Save entity states
    SaveEntityStates(saveDir + "entities.dat")
    
    ; Save world state
    SaveWorldState(saveDir + "world.dat")
    
    ; Save system-specific states
    SaveAudioState(saveDir + "audio.dat")
    SaveUIState(saveDir + "ui.dat")
    SaveEventStates(saveDir + "events.dat")
    
    ; Create save metadata
    CreateSaveMetadata(slot, saveDir + "metadata.dat")
End Function

Function LoadCompleteSave(slot%)
    saveDir$ = "saves/slot" + slot + "/"
    
    ; Load in dependency order
    LoadGameState(saveDir + "game_state.dat")
    LoadWorldState(saveDir + "world.dat")
    LoadEntityStates(saveDir + "entities.dat")
    LoadEventStates(saveDir + "events.dat")
    LoadAudioState(saveDir + "audio.dat")
    LoadUIState(saveDir + "ui.dat")
End Function

Function CreateSaveMetadata(slot%, file$)
    file = WriteFile(file)
    
    ; Write save information
    WriteString file, CurrentGameState\PlayerName
    WriteInt file, CurrentGameState\Difficulty
    WriteFloat file, CurrentGameState\TotalPlayTime
    WriteInt file, CurrentGameState\AreasDiscovered
    WriteString file, FormatTime(CurrentGameState\LastSaveTime)
    WriteString file, GetCurrentRoomName()
    
    ; Write screenshot/thumbnail (placeholder)
    WriteInt file, 0  ; Thumbnail data size
    
    CloseFile(file)
End Function
```

## State Synchronization

### Multi-System State Sync
```blitzbasic
Function SynchronizeState()
    ; Ensure all systems reflect current state
    
    ; Update rendering based on world state
    If GlobalWorldState\MainPower = False Then
        SetRenderMode(RENDER_LOW_LIGHT)
    EndIf
    
    ; Update audio based on world state
    If GlobalWorldState\AlarmActive Then
        PlayAlarmSound()
    EndIf
    
    ; Update entities based on world state
    If GlobalWorldState\LockdownActive Then
        LockAllDoors()
    EndIf
    
    ; Update UI based on game state
    UpdateUIFromGameState()
End Function

Function ValidateStateIntegrity()
    ; Check for state inconsistencies
    errors$ = ""
    
    ; Validate player state
    If PlayerHealth < 0 Or PlayerHealth > MaxHealth Then
        errors = errors + "Invalid player health|"
    EndIf
    
    ; Validate world state
    If GlobalWorldState\ContainmentStatus < 0 Or GlobalWorldState\ContainmentStatus > 100 Then
        errors = errors + "Invalid containment status|"
    EndIf
    
    ; Validate entity states
    For n.NPCs = Each NPCs
        If n\Health < 0 Then
            errors = errors + "Invalid NPC health: " + n\NPCtype + "|"
        EndIf
    Next
    
    ; Report errors
    If errors <> "" Then
        LogStateError("State validation failed: " + errors)
        AttemptStateRepair()
    EndIf
End Function
```

## Performance Considerations
- **State Compression**: Efficient save file formats
- **Incremental Saves**: Partial state updates
- **Background Saving**: Non-blocking save operations
- **State Caching**: Frequently accessed state data

### Integration Points
- **[Save/Load System](GAME_MECHANICS.md#saveload-system)**: State persistence
- **[Entity Systems](ENTITY_SYSTEMS.md)**: Entity state management
- **[Event/Trigger Systems](EVENT_TRIGGER_SYSTEMS.md)**: Event state tracking
- **[Room/Level Management](ROOM_LEVEL_MANAGEMENT.md)**: World state management

---

*State management systems ensure consistent game behavior across sessions, providing the foundation for save/load functionality and maintaining game world integrity.*