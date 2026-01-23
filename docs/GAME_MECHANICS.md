# Game Mechanics Documentation

## Overview
Game mechanics define the core gameplay experience in SCP: Containment Breach. These systems govern player interaction with the game world, character progression, and the fundamental rules that create the survival horror experience.

## Player Control System

### Purpose
The player control system handles all player movement and interaction mechanics, creating the immersive first-person experience essential for the horror genre.

### Core Mechanics

#### Movement System
```blitzbasic
; Player movement variables
Global PlayerSpeed# = 0.05          ; Base movement speed
Global SprintSpeed# = 0.08          ; Sprinting speed
Global CrouchSpeed# = 0.025         ; Crouching speed
Global PlayerTurnSpeed# = 0.3      ; Mouse look sensitivity

; Movement state
Global PlayerCrouch% = False        ; Crouching state
Global PlayerSprint% = False        ; Sprinting state
Global PlayerInAir% = False         ; Jumping/falling state

; Update player movement
Function UpdatePlayerMovement()
    ; Get input from [Input System](CORE_SYSTEMS.md#input-system)
    moveX# = 0
    moveZ# = 0
    
    If ActionDown("forward") Then moveZ = 1
    If ActionDown("backward") Then moveZ = -1
    If ActionDown("left") Then moveX = -1
    If ActionDown("right") Then moveX = 1
    
    ; Calculate current speed based on state
    currentSpeed# = PlayerSpeed
    If PlayerCrouch Then currentSpeed = CrouchSpeed
    If PlayerSprint Then currentSpeed = SprintSpeed
    
    ; Apply movement relative to camera direction
    MoveEntity(Camera, moveX * currentSpeed, 0, moveZ * currentSpeed)
End Function
```

#### Mouse Look System
```blitzbasic
Function UpdateMouseLook()
    ; Mouse input from [Input System](CORE_SYSTEMS.md#input-system)
    mX# = MouseXSpeed() * PlayerTurnSpeed
    mY# = MouseYSpeed() * PlayerTurnSpeed
    
    ; Rotate camera horizontally
    TurnEntity(Camera, 0, -mX, 0)
    
    ; Rotate camera vertically with limits
    pitch# = EntityPitch(Camera) - mY
    pitch = Clamp(pitch, -89, 89)  ; Prevent over-rotation
    RotateEntity(Camera, pitch, 0, 0)
End Function
```

#### Stamina System
```blitzbasic
; Stamina variables
Global PlayerStamina# = 100.0      ; Current stamina
Global MaxStamina# = 100.0         ; Maximum stamina
Global StaminaDrain# = 0.5         ; Sprinting drain rate
Global StaminaRegen# = 0.2         ; Resting regen rate

Function UpdateStamina()
    If PlayerSprint And PlayerInAir = False Then
        ; Drain stamina while sprinting
        PlayerStamina = PlayerStamina - StaminaDrain
        If PlayerStamina <= 0 Then
            PlayerStamina = 0
            PlayerSprint = False    ; Force stop sprinting
        EndIf
    Else If PlayerInAir = False And PlayerCrouch = False Then
        ; Regenerate stamina when not sprinting or crouching
        PlayerStamina = PlayerStamina + StaminaRegen
        If PlayerStamina > MaxStamina Then
            PlayerStamina = MaxStamina
        EndIf
    EndIf
End Function
```

#### Health System
```blitzbasic
; Health variables
Global PlayerHealth# = 100.0       ; Current health
Global MaxHealth# = 100.0          ; Maximum health
Global HealthRegen# = 0.05         ; Passive regeneration rate

Function UpdateHealth()
    ; Slow passive regeneration
    If PlayerHealth < MaxHealth Then
        PlayerHealth = PlayerHealth + HealthRegen
        If PlayerHealth > MaxHealth Then PlayerHealth = MaxHealth
    EndIf
End Function

Function DamagePlayer(amount#, damageType$)
    PlayerHealth = PlayerHealth - amount
    If PlayerHealth < 0 Then PlayerHealth = 0
    
    ; Play damage effects
    PlayDamageEffect(damageType)
    
    ; Check for death
    If PlayerHealth <= 0 Then
        TriggerPlayerDeath()
    EndIf
End Function
```

#### Sanity System
```blitzbasic
; Sanity variables
Global PlayerSanity# = 100.0       ; Current sanity
Global MaxSanity# = 100.0          ; Maximum sanity
Global SanityDrain# = 0.1          ; Base drain rate

Function UpdateSanity()
    ; Drain sanity in darkness or near SCP entities
    darknessFactor# = CalculateDarknessFactor()
    scpNextityFactor# = CalculateSCPProximityFactor()
    
    totalDrain# = SanityDrain * darknessFactor * scpNextityFactor
    PlayerSanity = PlayerSanity - totalDrain
    
    If PlayerSanity < 0 Then PlayerSanity = 0
    
    ; Apply sanity effects
    If PlayerSanity < 50 Then
        ApplySanityEffects(PlayerSanity / 100.0)
    EndIf
End Function
```

#### Blink System
```blitzbasic
; Blink variables (critical for SCP-173)
Global BlinkTimer# = 0.0          ; Time until next blink
Global BlinkDuration# = 0.3      ; How long blink lasts
Global BlinkInterval# = 4.0      ; Time between blinks
Global BlinkEffect# = 0.0        ; Current blink effect strength

Function UpdateBlink()
    BlinkTimer = BlinkTimer - (1.0 / 60.0)  ; Assuming 60 FPS
    
    If BlinkTimer <= 0 Then
        ; Trigger blink
        BlinkEffect = 1.0
        BlinkTimer = BlinkInterval
        
        ; Check for SCP-173 during blink
        CheckForSCP173DuringBlink()
    EndIf
    
    ; Fade blink effect
    If BlinkEffect > 0 Then
        BlinkEffect = BlinkEffect - (1.0 / 60.0)
        If BlinkEffect < 0 Then BlinkEffect = 0
    EndIf
End Function
```

### Integration Points
- **[Input System](CORE_SYSTEMS.md#input-system)**: Provides keyboard and mouse input
- **[Physics System](CORE_SYSTEMS.md#physics-system)**: Handles collision detection for movement
- **[Entity Systems](ENTITY_SYSTEMS.md)**: Player interactions with NPCs and SCP entities
- **[Event/Trigger Systems](EVENT_TRIGGER_SYSTEMS.md)**: Player movement triggers events

---

## Inventory System

### Purpose
The inventory system manages item collection, organization, and combination mechanics, providing players with tools for survival and puzzle solving.

### Architecture

#### Item Data Structure
```blitzbasic
Type Items
    Field obj%                  ; 3D model handle
    Field ItemID%               ; Unique identifier
    Field Name$                 ; Display name
    Field Description$          ; Item description
    Field ItemType%             ; Item category (weapon, keycard, document, etc.)
    Field State%                ; 0=ground, 1=inventory, 2=equipped
    Field Quantity%             ; Stack count for stackable items
    Field Area%                 ; Current location/area
    Field Pickupable%           ; Can player pick this up
    Field Usable%               ; Can this item be used
    Field Combinable%           ; Can this be combined with other items
    Field KeycardLevel%         ; Security level for keycards
End Type
```

#### Inventory Data Structure
```blitzbasic
Type Inventory
    Field Items[9]              ; 9 inventory slots (3x3 grid)
    Field SelectedSlot%         ; Currently selected slot
    Field QuickSlot%            ; Quick access slot number
End Type

; Item types
Const ITEM_TYPE_WEAPON% = 1
Const ITEM_TYPE_KEYCARD% = 2
Const ITEM_TYPE_DOCUMENT% = 3
Const ITEM_TYPE_CONSUMABLE% = 4
Const ITEM_TYPE_EQUIPMENT% = 5
Const ITEM_TYPE_MISC% = 6
```

### Core Functions

#### Item Management
```blitzbasic
; Add item to inventory
Function AddItemToInventory(item.Items, slot% = -1)
    If slot = -1 Then
        ; Find first empty slot
        For i = 0 To 8
            If Inventory\Items[i] = Null Then
                slot = i
                Exit
            EndIf
        Next
    EndIf
    
    If slot >= 0 And slot <= 8 Then
        Inventory\Items[slot] = item
        item\State = 1  ; In inventory
        HideEntity(item\obj)  ; Hide 3D model
        Return True
    EndIf
    
    Return False
End Function

; Remove item from inventory
Function RemoveItemFromInventory(slot%)
    If slot >= 0 And slot <= 8 Then
        item.Items = Inventory\Items[slot]
        Inventory\Items[slot] = Null
        If item <> Null Then
            item\State = 0  ; On ground
            ShowEntity(item\obj)  ; Show 3D model
        EndIf
        Return item
    EndIf
    Return Null
End Function
```

#### Item Combination System
```blitzbasic
Type ItemCombination
    Field Item1ID%               ; First item ID
    Field Item2ID%               ; Second item ID
    Field ResultID%              ; Resulting item ID
    Field Description$           ; Combination description
End Type

; Check if items can be combined
Function CanCombineItems(item1ID%, item2ID%)
    For combo.ItemCombination = Each ItemCombination
        If (combo\Item1ID = item1ID And combo\Item2ID = item2ID) Or _
           (combo\Item1ID = item2ID And combo\Item2ID = item1ID) Then
            Return combo
        EndIf
    Next
    Return Null
End Function

; Combine two items
Function CombineItems(slot1%, slot2%)
    item1.Items = Inventory\Items[slot1]
    item2.Items = Inventory\Items[slot2]
    
    If item1 <> Null And item2 <> Null Then
        combo.ItemCombination = CanCombineItems(item1\ItemID, item2\ItemID)
        If combo <> Null Then
            ; Create resulting item
            resultItem.Items = CreateItem(combo\ResultID)
            
            ; Remove original items
            RemoveItemFromInventory(slot1)
            RemoveItemFromInventory(slot2)
            
            ; Add result item
            AddItemToInventory(resultItem, slot1)
            
            ; Show combination message
            ShowMessage("Combined: " + combo\Description)
            
            Return True
        EndIf
    EndIf
    
    Return False
End Function
```

#### Keycard Security System
```blitzbasic
; Keycard security levels (from lowest to highest)
Const KEYCARD_LEVEL_NONE% = 0
Const KEYCARD_LEVEL_WHITE% = 1
Const KEYCARD_LEVEL_RED% = 2
Const KEYCARD_LEVEL_ORANGE% = 3
Const KEYCARD_LEVEL_YELLOW% = 4
Const KEYCARD_LEVEL_GREEN% = 5
Const KEYCARD_LEVEL_BLUE% = 6
Const KEYCARD_LEVEL_PURPLE% = 7
Const KEYCARD_LEVEL_BLACK% = 8

; Check if keycard can access door
Function CanAccessDoor(keycard.Items, doorLevel%)
    If keycard = Null Then Return False
    If keycard\ItemType <> ITEM_TYPE_KEYCARD Then Return False
    
    Return keycard\KeycardLevel >= doorLevel
End Function
```

### Integration Points
- **[UI/HUD Systems](UI_HUD_SYSTEMS.md)**: Visual inventory management
- **[Input System](CORE_SYSTEMS.md#input-system)**: Mouse-based drag-drop operations
- **[Event/Trigger Systems](EVENT_TRIGGER_SYSTEMS.md)**: Item usage triggers events
- **[State Management Systems](STATE_MANAGEMENT_SYSTEMS.md)**: Inventory state persistence

---

## Save/Load System

### Purpose
The save/load system provides game state persistence, allowing players to save their progress and resume gameplay later.

### Architecture

#### Save Data Structure
```blitzbasic
Type SaveData
    Field Version%               ; Save file version
    Field Timestamp#             ; When save was created
    Field PlayTime#              ; Total play time
    Field Checksum$              ; File integrity check
    
    ; Player data
    Field PlayerX#, PlayerY#, PlayerZ#     ; Player position
    Field PlayerHealth#, PlayerStamina#, PlayerSanity#  ; Player stats
    Field CurrentRoom$                         ; Current location
    
    ; Inventory data
    Field InventoryItems[9]       ; Item IDs in inventory
    Field ItemQuantities[9]        ; Stack counts
    
    ; World state
    Field DoorStates%             ; Door open/closed states
    Field NPCStates%              ; NPC positions and states
    ; TriggeredEvents%           ; Completed events
    
    ; Game progress
    Field Achievements%           ; Unlocked achievements
    Field Difficulty%             ; Game difficulty setting
End Type
```

### Core Functions

#### Save Game Function
```blitzbasic
Function SaveGame(slot%)
    filename$ = "save" + slot + ".sav"
    
    ; Create save data structure
    save.SaveData = New SaveData
    save\Version = SAVE_VERSION
    save\Timestamp = MilliSecs()
    save\PlayerX = EntityX(Camera)
    save\PlayerY = EntityY(Camera)
    save\PlayerZ = EntityZ(Camera)
    save\PlayerHealth = PlayerHealth
    save\PlayerStamina = PlayerStamina
    save\PlayerSanity = PlayerSanity
    
    ; Save inventory
    For i = 0 To 8
        item.Items = Inventory\Items[i]
        If item <> Null Then
            save\InventoryItems[i] = item\ItemID
            save\ItemQuantities[i] = item\Quantity
        EndIf
    Next
    
    ; Save world state
    SaveWorldState(save)
    SaveNPCStates(save)
    SaveEventStates(save)
    
    ; Calculate checksum
    save\Checksum = CalculateSaveChecksum(save)
    
    ; Write to file
    file = WriteFile(filename)
    WriteSaveData(file, save)
    CloseFile(file)
    
    ShowMessage("Game saved to slot " + slot)
    Return True
End Function
```

#### Load Game Function
```blitzbasic
Function LoadGame(slot%)
    filename$ = "save" + slot + ".sav"
    
    If Not FileType(filename) Then
        ShowMessage("Save file not found")
        Return False
    EndIf
    
    ; Read save data
    file = ReadFile(filename)
    save.SaveData = ReadSaveData(file)
    CloseFile(file)
    
    ; Verify checksum
    If save\Checksum <> CalculateSaveChecksum(save) Then
        ShowMessage("Save file corrupted")
        Return False
    EndIf
    
    ; Restore player state
    PositionEntity(Camera, save\PlayerX, save\PlayerY, save\PlayerZ)
    PlayerHealth = save\PlayerHealth
    PlayerStamina = save\PlayerStamina
    PlayerSanity = save\PlayerSanity
    
    ; Restore inventory
    ClearInventory()
    For i = 0 To 8
        If save\InventoryItems[i] > 0 Then
            item.Items = CreateItem(save\InventoryItems[i])
            item\Quantity = save\ItemQuantities[i]
            AddItemToInventory(item, i)
        EndIf
    Next
    
    ; Restore world state
    LoadWorldState(save)
    LoadNPCStates(save)
    LoadEventStates(save)
    
    ShowMessage("Game loaded from slot " + slot)
    Return True
End Function
```

#### Auto-Save System
```blitzbasic
; Auto-save triggers
Global AutoSaveTimer# = 0
Global AutoSaveInterval# = 300000  ; 5 minutes

Function UpdateAutoSave()
    AutoSaveTimer = AutoSaveTimer + (1000 / 60)  ; Assuming 60 FPS
    
    If AutoSaveTimer >= AutoSaveInterval Then
        AutoSaveTimer = 0
        SaveGame(AUTO_SAVE_SLOT)  ; Dedicated auto-save slot
    EndIf
End Function

; Event-triggered auto-saves
Function TriggerEventAutoSave(eventName$)
    ; Save before major events
    SaveGame(EVENT_SAVE_SLOT)
    ShowMessage("Auto-saved before: " + eventName)
End Function
```

### Integration Points
- **[State Management Systems](STATE_MANAGEMENT_SYSTEMS.md)**: Provides state serialization
- **[File Format Loaders](FILE_FORMAT_LOADERS.md)**: Handles file I/O operations
- **[Entity Systems](ENTITY_SYSTEMS.md)**: Saves and restores NPC states
- **[Room/Level Management](ROOM_LEVEL_MANAGEMENT.md)**: Preserves room states

---

## Game Mechanics Integration

### Update Loop Integration
```blitzbasic
Function UpdateGameMechanics()
    ; Player systems
    UpdatePlayerMovement()
    UpdateMouseLook()
    UpdateStamina()
    UpdateHealth()
    UpdateSanity()
    UpdateBlink()
    
    ; Inventory management
    UpdateInventory()
    
    ; Auto-save
    UpdateAutoSave()
    
    ; Quick save/load
    If KeyHit(KEY_F5) Then QuickSave()
    If KeyHit(KEY_F9) Then QuickLoad()
End Function
```

### State Dependencies
```
Player Movement → Stamina Drain → Sprint Ability
Sanity Level → Visual Effects → Horror Experience
Blink Timer → SCP-173 Movement → Game Difficulty
Inventory Items → Problem Solving → Game Progress
Save States → Player Experience → Game Accessibility
```

### Performance Considerations
- **Input Buffering**: Smooth out input timing for responsive controls
- **State Caching**: Cache frequently accessed player state
- **Auto-Save Optimization**: Minimize save frequency to prevent stuttering
- **Memory Management**: Efficient inventory data structures

### Balancing Considerations
- **Movement Speed**: Balance between survival and accessibility
- **Stamina Drain**: Create tension without frustration
- **Sanity Effects**: Enhance horror without breaking gameplay
- **Item Distribution**: Ensure necessary items are reasonably accessible

---

*Game mechanics form the core interactive experience of SCP: Containment Breach, creating the tension, challenge, and immersion that define the survival horror genre.*