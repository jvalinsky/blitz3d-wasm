# Audio/Sound Systems Documentation

## Overview
The audio/sound systems in SCP: Containment Breach create the immersive horror atmosphere through sophisticated sound design, 3D positional audio, and dynamic music that responds to game events and player actions.

## Sound Effect System

### Purpose
The sound effect system manages environmental audio, player actions, NPC vocalizations, and SCP-specific sounds that create tension and immersion.

### Architecture

#### Sound Data Structure
```blitzbasic
Type SoundEffect
    Field SoundID%             ; Unique sound identifier
    Field FileName$            ; Sound file path
    Field Category%            ; Sound category (player, NPC, environment, etc.)
    Field Volume#               ; Default volume (0.0-1.0)
    Field Pitch#               ; Default pitch variation
    Field Loop%                ; Is this a looping sound
    Field Priority%            ; Playback priority (higher = more important)
    Field MaxInstances%        ; Maximum simultaneous instances
    
    ; 3D audio properties
    Field MinDistance#         ; Minimum hearing distance
    Field MaxDistance#         ; Maximum hearing distance
    Field RolloffFactor#       ; Distance attenuation factor
    
    ; Playback state
    Field Channel%             ; Current playback channel (-1 if not playing)
    Field LastPlayed#          ; Time last played (for cooldowns)
End Type

; Sound categories
Const SOUND_PLAYER% = 1       ; Player actions (footsteps, breathing)
Const SOUND_NPC% = 2          ; NPC sounds (dialogue, movement)
Const SOUND_SCP% = 3          ; SCP-specific sounds
Const SOUND_ENVIRONMENT% = 4  ; Environmental ambience
Const SOUND_INTERFACE% = 5    ; UI sounds
Const SOUND_AMBIENT% = 6      ; Background atmosphere
```

### Core Functions

#### Sound Management
```blitzbasic
Global SoundChannels%[32]     ; Audio channels (0-31)
Global ActiveSounds.SoundEffect[100] ; Currently loaded sounds

Function InitializeSoundSystem()
    ; Initialize FMOD/Web Audio
    FSOUND_Init(44100, 32, 0)
    
    ; Load sound effects
    LoadSoundEffects("sounds.dat")
    
    ; Setup 3D audio
    FSOUND_3D_SetAttributes(0, 0, 0, 0, 0, 0)  ; Listener at origin
    FSOUND_3D_SetDistanceFactor(1.0)            ; 1 unit = 1 meter
End Function

Function LoadSoundEffects(configFile$)
    file = ReadFile(configFile)
    
    While Not Eof(file)
        sound.SoundEffect = New SoundEffect
        sound\SoundID = ReadInt(file)
        sound\FileName = ReadString(file)
        sound\Category = ReadInt(file)
        sound\Volume = ReadFloat(file)
        sound\Pitch = ReadFloat(file)
        sound\Loop = ReadInt(file)
        sound\Priority = ReadInt(file)
        sound\MaxInstances = ReadInt(file)
        sound\MinDistance = ReadFloat(file)
        sound\MaxDistance = ReadFloat(file)
        sound\RolloffFactor = ReadFloat(file)
        
        ; Load actual sound data
        sound\Channel = -1
        sound\LastPlayed = 0
    Wend
    
    CloseFile(file)
End Function
```

#### Sound Playback
```blitzbasic
Function PlaySoundEffect(soundID%, x# = 0, y# = 0, z# = 0, volume# = 1.0)
    sound.SoundEffect = FindSound(soundID)
    
    If sound = Null Then Return -1
    
    ; Check instance limit
    If GetSoundInstances(soundID) >= sound\MaxInstances Then
        Return -1
    EndIf
    
    ; Find available channel
    channel% = FindAvailableChannel(sound\Priority)
    
    If channel >= 0 Then
        ; Load sound if not cached
        If Not SoundLoaded(sound) Then
            LoadSoundFile(sound)
        EndIf
        
        ; Set volume and pitch
        finalVolume# = sound\Volume * volume#
        finalPitch# = sound\Pitch * (0.8 + Rnd(0, 0.4))  ; ±20% variation
        
        ; Play sound
        If sound\Loop Then
            FSOUND_PlaySound(channel, sound\Handle)
            FSOUND_SetLoopMode(channel, FSOUND_LOOP_NORMAL)
        Else
            FSOUND_PlaySound(channel, sound\Handle)
        EndIf
        
        ; Set 3D position if not at origin
        If x <> 0 Or y <> 0 Or z <> 0 Then
            FSOUND_3D_SetAttributes(channel, x, y, z)
            FSOUND_3D_SetMinMaxDistance(channel, sound\MinDistance, sound\MaxDistance)
        EndIf
        
        ; Set volume and frequency
        FSOUND_SetVolume(channel, finalVolume * 255)
        FSOUND_SetFrequency(channel, finalPitch * 44100)
        
        ; Update sound state
        sound\Channel = channel
        sound\LastPlayed = MilliSecs()
        
        Return channel
    EndIf
    
    Return -1
End Function

Function FindAvailableChannel(priority%)
    ; Find lowest priority channel or available channel
    lowestPriority% = 999
    lowestChannel% = -1
    
    For i = 0 To 31
        If Not FSOUND_IsPlaying(i) Then
            Return i  ; Available channel
        Else
            ; Check channel priority
            channelPriority% = GetChannelPriority(i)
            If channelPriority < lowestPriority Then
                lowestPriority = channelPriority
                lowestChannel = i
            EndIf
        EndIf
    Next
    
    ; Use lowest priority channel if our priority is higher
    If priority > lowestPriority Then
        FSOUND_StopSound(lowestChannel)
        Return lowestChannel
    EndIf
    
    Return -1
End Function
```

### Sound Categories

#### Player Sounds
```blitzbasic
Function PlayPlayerSound(action$)
    Select action
        Case "FOOTSTEP"
            ; Different footsteps for different surfaces
            surface$ = GetPlayerSurface()
            Select surface
                Case "CONCRETE": PlaySoundEffect(SOUND_FOOTSTEP_CONCRETE)
                Case "METAL": PlaySoundEffect(SOUND_FOOTSTEP_METAL)
                Case "CARPET": PlaySoundEffect(SOUND_FOOTSTEP_CARPET)
                Case "WATER": PlaySoundEffect(SOUND_FOOTSTEP_WATER)
            End Select
            
        Case "BREATHING"
            ; Breathing based on stamina
            staminaRatio# = PlayerStamina / MaxStamina
            If staminaRatio < 0.3 Then
                PlaySoundEffect(SOUND_BREATHING_HEAVY)
            ElseIf staminaRatio < 0.7 Then
                PlaySoundEffect(SOUND_BREATHING_MEDIUM)
            Else
                PlaySoundEffect(SOUND_BREATHING_NORMAL)
            EndIf
            
        Case "INJURY"
            PlaySoundEffect(SOUND_PLAYER_INJURY)
            
        Case "DEATH"
            PlaySoundEffect(SOUND_PLAYER_DEATH)
    End Select
End Function
```

#### SCP Sounds
```blitzbasic
Function PlaySCPSound(scpID%, action$)
    Select scpID
        Case 173
            Select action
                Case "MOVE": PlaySoundEffect(SOUND_SCP173_MOVE)
                Case "KILL": PlaySoundEffect(SOUND_SCP173_KILL)
                Case "OBSERVED": PlaySoundEffect(SOUND_SCP173_OBSERVED)
            End Select
            
        Case 106
            Select action
                Case "LAUGH": PlaySoundEffect(SOUND_SCP106_LAUGH)
                Case "CORRODE": PlaySoundEffect(SOUND_SCP106_CORRODE)
                Case "ATTACK": PlaySoundEffect(SOUND_SCP106_ATTACK)
            End Select
            
        Case 096
            Select action
                Case "CRY": PlaySoundEffect(SOUND_SCP096_CRY)
                Case "RAGE": PlaySoundEffect(SOUND_SCP096_RAGE)
                Case "KILL": PlaySoundEffect(SOUND_SCP096_KILL)
            End Select
            
        Case 049
            Select action
                Case "SPEAK": PlaySoundEffect(SOUND_SCP049_SPEAK)
                Case "CURE": PlaySoundEffect(SOUND_SCP049_CURE)
            End Select
    End Select
End Function
```

#### Environmental Sounds
```blitzbasic
Function UpdateEnvironmentalSounds()
    ; Facility ambience
    If Not ChannelPlaying(ambientChannel) Then
        ambientChannel = PlaySoundEffect(SOUND_AMBIENT_FACILITY, 0, 0, 0, 0.3)
    EndIf
    
    ; Room-specific sounds
    currentRoom.Rooms = GetCurrentRoom()
    
    If currentRoom <> Null Then
        Select currentRoom\RoomType
            Case ROOMTYPE_LAB
                PlayRoomSound(currentRoom, SOUND_LAB_EQUIPMENT)
            Case ROOMTYPE_MAINTENANCE
                PlayRoomSound(currentRoom, SOUND_MAINTENANCE_HUM)
            Case ROOMTYPE_CAFETERIA
                PlayRoomSound(currentRoom, SOUND_CAFETERIA_AMBIENCE)
        End Select
    EndIf
    
    ; Dynamic sounds based on facility state
    If PowerOutage() Then
        PlaySoundEffect(SOUND_POWER_FLICKER)
    EndIf
    
    If AlarmActive() Then
        If Not ChannelPlaying(alarmChannel) Then
            alarmChannel = PlaySoundEffect(SOUND_ALARM_FACILITY)
        EndIf
    EndIf
End Function

Function PlayRoomSound(room.Rooms, soundID%)
    ; Check if sound already playing for this room
    If room\AmbientSoundChannel = -1 Or Not ChannelPlaying(room\AmbientSoundChannel) Then
        room\AmbientSoundChannel = PlaySoundEffect(soundID, room\x, room\y, room\z, 0.2)
    EndIf
End Function
```

---

## Music System

### Purpose
The music system provides dynamic atmospheric soundtrack that responds to game tension, SCP proximity, and player state.

### Architecture

#### Music Track Structure
```blitzbasic
Type MusicTrack
    Field TrackID%             ; Unique track identifier
    Field FileName$            ; Music file path
    Field TrackType%           ; Type of music (ambient, tension, chase, etc.)
    Field Intensity%           ; Intensity level (1-5)
    Field Tempo#               ; BPM for synchronization
    
    ; Playback properties
    Field Volume#               ; Default volume
    Field FadeInTime#          ; Fade in duration
    Field FadeOutTime#         ; Fade out duration
    
    ; Trigger conditions
    Field MinSanity#           ; Minimum sanity to play
    Field MaxSanity#           ; Maximum sanity to play
    Field SCPProximity#        ; SCP distance trigger
    Field TensionLevel%        ; Tension level trigger
End Type

; Music types
Const MUSIC_AMBIENT% = 1      ; Background atmosphere
Const MUSIC_TENSION% = 2      ; Building tension
Const MUSIC_CHASE% = 3        ; Pursuit/chase sequences
Const MUSIC_SCP% = 4          ; SCP-specific themes
Const MUSIC_EMERGENCY% = 5    ; Emergency situations
```

### Dynamic Music System
```blitzbasic
Global CurrentMusic.MusicTrack ; Currently playing track
Global MusicIntensity% = 1     ; Current intensity level (1-5)
Global MusicTension# = 0.0     ; Current tension level (0.0-1.0)

Function UpdateMusicSystem()
    ; Calculate current tension
    UpdateTensionLevel()
    
    ; Determine appropriate music
    desiredTrack.MusicTrack = SelectAppropriateTrack()
    
    ; Change track if needed
    If desiredTrack <> CurrentMusic Then
        TransitionToTrack(desiredTrack)
    EndIf
    
    ; Update music intensity
    UpdateMusicIntensity()
End Function

Function UpdateTensionLevel()
    tension# = 0.0
    
    ; SCP proximity tension
    nearestSCP# = GetDistanceToNearestSCP()
    If nearestSCP < 50 Then
        tension = tension + (1.0 - nearestSCP / 50.0) * 0.4
    EndIf
    
    ; Player health tension
    healthRatio# = PlayerHealth / MaxHealth
    tension = tension + (1.0 - healthRatio) * 0.3
    
    ; Sanity tension
    sanityRatio# = PlayerSanity / MaxSanity
    tension = tension + (1.0 - sanityRatio) * 0.2
    
    ; Security alert tension
    If SecurityAlertActive() Then
        tension = tension + 0.3
    EndIf
    
    ; Blink timer tension
    If BlinkTimer < 2.0 Then
        tension = tension + (2.0 - BlinkTimer) / 2.0 * 0.2
    EndIf
    
    MusicTension = tension
End Function

Function SelectAppropriateTrack()
    bestTrack.MusicTrack = Null
    bestScore# = -1
    
    For track.MusicTrack = Each MusicTrack
        score# = CalculateTrackScore(track)
        
        If score > bestScore Then
            bestScore = score
            bestTrack = track
        EndIf
    Next
    
    Return bestTrack
End Function

Function CalculateTrackScore(track.MusicTrack)
    score# = 0.0
    
    ; Sanity match
    sanityRatio# = PlayerSanity / MaxSanity
    If sanityRatio >= track\MinSanity And sanityRatio <= track\MaxSanity Then
        score = score + 0.3
    EndIf
    
    ; SCP proximity match
    nearestSCP# = GetDistanceToNearestSCP()
    If nearestSCP <= track\SCPProximity Then
        score = score + 0.3
    EndIf
    
    ; Tension level match
    If MusicTension >= track\TensionLevel / 5.0 Then
        score = score + 0.4
    EndIf
    
    Return score
End Function
```

#### Music Transitions
```blitzbasic
Type MusicTransition
    Field FromTrack.MusicTrack  ; Track transitioning from
    Field ToTrack.MusicTrack    ; Track transitioning to
    Field StartTime#            ; When transition started
    Field Duration#             ; Transition duration
    Field FromVolume#           ; Starting volume
    Field ToVolume#             ; Target volume
End Type

Global CurrentTransition.MusicTransition

Function TransitionToTrack(newTrack.MusicTrack)
    ; Create transition
    transition.MusicTransition = New MusicTransition
    transition\FromTrack = CurrentMusic
    transition\ToTrack = newTrack
    transition\StartTime = MilliSecs() / 1000.0
    transition\Duration = 3.0  ; 3 second transition
    transition\FromVolume = 1.0
    transition\ToVolume = 0.0
    
    ; Start new track at zero volume
    If newTrack <> Null Then
        StartMusicTrack(newTrack, 0.0)
    EndIf
    
    CurrentTransition = transition
End Function

Function UpdateMusicTransitions()
    If CurrentTransition <> Null Then
        elapsed# = (MilliSecs() / 1000.0) - CurrentTransition\StartTime
        progress# = elapsed / CurrentTransition\Duration
        
        If progress >= 1.0 Then
            ; Transition complete
            If CurrentTransition\FromTrack <> Null Then
                StopMusicTrack(CurrentTransition\FromTrack)
            EndIf
            
            CurrentMusic = CurrentTransition\ToTrack
            Delete CurrentTransition
            CurrentTransition = Null
        Else
            ; Update volumes
            fromVol# = CurrentTransition\FromVolume * (1.0 - progress)
            toVol# = CurrentTransition\ToVolume * progress
            
            If CurrentTransition\FromTrack <> Null Then
                SetMusicVolume(CurrentTransition\FromTrack, fromVol)
            EndIf
            
            If CurrentTransition\ToTrack <> Null Then
                SetMusicVolume(CurrentTransition\ToTrack, toVol)
            EndIf
        EndIf
    EndIf
End Function
```

---

## Voice System

### Purpose
The voice system manages NPC dialogue, SCP vocalizations, and facility announcements that create personality and immersion.

### Dialogue System
```blitzbasic
Type DialogueLine
    Field LineID%              ; Unique dialogue identifier
    Field Speaker$             ; Who is speaking
    Field Text$                ; Dialogue text
    Field AudioFile$           ; Voice audio file
    Field Emotion%             ; Emotional context
    Field Priority%            ; Playback priority
    
    ; Conditions
    Field RequiredState%       ; Required NPC state
    Field Cooldown#            ; Time between repeats
    Field Probability#         ; Chance of playing
End Type

Function PlayNPCDialogue(npc.NPCs, dialogueType$)
    ; Find appropriate dialogue
    line.DialogueLine = FindDialogueForNPC(npc, dialogueType)
    
    If line <> Null And Rnd(0, 1) < line\Probability Then
        ; Check cooldown
        If (MilliSecs() / 1000.0) - line\LastPlayed > line\Cooldown Then
            ; Play dialogue
            PlayVoiceLine(line)
            line\LastPlayed = MilliSecs() / 1000.0
        EndIf
    EndIf
End Function

Function FindDialogueForNPC(npc.NPCs, dialogueType$)
    bestLine.DialogueLine = Null
    bestPriority% = -1
    
    For line.DialogueLine = Each DialogueLine
        If line\Speaker = npc\NPCtype Then
            If Instr(line\Text, dialogueType) > 0 Then
                If line\Priority > bestPriority Then
                    bestLine = line
                    bestPriority = line\Priority
                EndIf
            EndIf
        EndIf
    Next
    
    Return bestLine
End Function
```

### Facility Announcements
```blitzbasic
Type Announcement
    Field AnnounceID%          ; Unique announcement ID
    Field Text$                ; Announcement text
    Field AudioFile$           ; Voice file
    Field Priority%            ; Urgency level
    Field Interrupt%           ; Can interrupt other audio
    
    ; Trigger conditions
    Field TriggerEvent$        ; Event that triggers announcement
    Field RepeatCount%         ; How many times to repeat
    Field Delay#               ; Delay before playing
End Type

Function TriggerAnnouncement(eventType$, eventData$)
    announcement.Announcement = FindAnnouncement(eventType)
    
    If announcement <> Null Then
        ; Check if we can interrupt current audio
        If announcement\Interrupt Or Not VoicePlaying() Then
            PlayAnnouncement(announcement, eventData)
        Else
            ; Queue announcement
            QueueAnnouncement(announcement, eventData)
        EndIf
    EndIf
End Function

Function PlayAnnouncement(announcement.Announcement, eventData$)
    ; Replace variables in text/audio
    finalText$ = ReplaceVariables(announcement\Text, eventData)
    finalAudio$ = ReplaceVariables(announcement\AudioFile, eventData)
    
    ; Play announcement
    PlayVoiceLine(finalAudio, finalText, announcement\Priority)
    
    ; Repeat if specified
    If announcement\RepeatCount > 1 Then
        For i = 2 To announcement\RepeatCount
            Delay announcement\Delay * 1000
            PlayVoiceLine(finalAudio, finalText, announcement\Priority)
        Next
    EndIf
End Function
```

### SCP Vocalizations
```blitzbasic
Function PlaySCPVocalization(scpID%, context$)
    Select scpID
        Case 049  ; The Plague Doctor
            Select context
                Case "APPROACH"
                    PlayVoiceLine("scp049_approach.wav", "You don't belong here.", 3)
                Case "ATTACK"
                    PlayVoiceLine("scp049_attack.wav", "I'm helping you.", 4)
                Case "CONTAINED"
                    PlayVoiceLine("scp049_contained.wav", "This won't hold me.", 2)
            End Select
            
        Case 939  ; With Many Voices
            ; Voice mimicry
            victimLine$ = GetRandomVictimLine()
            PlayVoiceLine("scp939_mimic.wav", victimLine, 2)
            
        Case 106  ; The Old Man
            If Rnd(0, 1) < 0.3 Then  ; 30% chance
                PlayVoiceLine("scp106_laugh.wav", "*corrosive laughter*", 3)
            EndIf
    End Select
End Function
```

---

## Audio System Integration

### 3D Audio Updates
```blitzbasic
Function Update3DAudio()
    ; Update listener position
    listenerX# = EntityX(Camera)
    listenerY# = EntityY(Camera)
    listenerZ# = EntityZ(Camera)
    
    FSOUND_3D_Listener_SetAttributes(listenerX, listenerY, listenerZ, 0, 0, 0, 0, 1, 0)
    
    ; Update all 3D sounds
    Update3DSoundPositions()
End Function

Function Update3DSoundPositions()
    For sound.SoundEffect = Each SoundEffect
        If sound\Channel >= 0 And FSOUND_IsPlaying(sound\Channel) Then
            If sound\Positional Then
                ; Update sound position
                FSOUND_3D_SetAttributes(sound\Channel, sound\x, sound\y, sound\z)
            EndIf
        EndIf
    Next
End Function
```

### Audio State Management
```blitzbasic
Function SaveAudioState()
    ; Save music state
    WriteString file, CurrentMusic\TrackID
    WriteFloat file, MusicIntensity
    WriteFloat file, MusicTension
    
    ; Save active sounds
    activeCount% = 0
    For sound.SoundEffect = Each SoundEffect
        If sound\Channel >= 0 Then
            activeCount = activeCount + 1
        EndIf
    Next
    
    WriteInt file, activeCount
    
    For sound.SoundEffect = Each SoundEffect
        If sound\Channel >= 0 Then
            WriteInt file, sound\SoundID
            WriteInt file, sound\Channel
        EndIf
    Next
End Function

Function LoadAudioState()
    ; Restore music
    trackID% = ReadInt(file)
    CurrentMusic = FindMusicTrack(trackID)
    MusicIntensity = ReadFloat(file)
    MusicTension = ReadFloat(file)
    
    If CurrentMusic <> Null Then
        StartMusicTrack(CurrentMusic, 1.0)
    EndIf
    
    ; Restore active sounds (if possible)
    activeCount% = ReadInt(file)
    For i = 1 To activeCount
        soundID% = ReadInt(file)
        channel% = ReadInt(file)
        ; Note: Channel numbers may not persist across sessions
    Next
End Function
```

### Performance Considerations
- **Channel Pooling**: Reuse audio channels efficiently
- **Distance Culling**: Don't play distant sounds
- **Streaming**: Use for large music files
- **Compression**: Balance quality and file size

### Integration Points
- **[Entity Systems](ENTITY_SYSTEMS.md)**: NPC vocalizations and SCP sounds
- **[Event/Trigger Systems](EVENT_TRIGGER_SYSTEMS.md)**: Audio responses to events
- **[State Management Systems](STATE_MANAGEMENT_SYSTEMS.md)**: Audio state persistence
- **[Physics System](CORE_SYSTEMS.md#physics-system)**: 3D positional audio

---

*Audio/sound systems create the terrifying atmosphere of SCP: Containment Breach through immersive 3D audio, dynamic music that responds to tension, and contextual sound effects that make the facility feel alive and dangerous.*