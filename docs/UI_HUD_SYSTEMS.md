# UI/HUD Systems Documentation

## Overview
UI/HUD systems manage all user interface elements in SCP: Containment Breach, from the main menu to the in-game heads-up display. These systems provide critical information to players while maintaining the game's immersive horror atmosphere.

## Main Menu System

### Purpose
The main menu system handles game startup, options configuration, and navigation between different game modes.

### Architecture

#### Menu State Management
```blitzbasic
Type MenuState
    Field CurrentScreen%        ; Current menu screen
    Field SelectedOption%       ; Currently selected menu item
    Field MouseX%, MouseY%      ; Mouse position for interaction
    Field Clicked%              ; Mouse click state
End Type

; Menu screen constants
Const MENU_MAIN% = 1           ; Main menu
Const MENU_NEW_GAME% = 2       ; New game setup
Const MENU_LOAD_GAME% = 3      ; Load game menu
Const MENU_OPTIONS% = 4        ; Settings menu
Const MENU_CREDITS% = 5        ; Credits screen
```

### Core Functions

#### Menu Rendering
```blitzbasic
Function DrawMainMenu()
    ; Draw background
    DrawImage mainMenuBG, 0, 0
    
    ; Draw title
    SetFont titleFont
    Text GraphicsWidth()/2, 100, "SCP: Containment Breach", True, True
    
    ; Draw menu options
    SetFont menuFont
    menuY% = 200
    
    For i = 0 To menuOptions.length - 1
        If i = menuState\SelectedOption Then
            Color 255, 255, 0  ; Highlight selected option
        Else
            Color 255, 255, 255  ; Normal color
        EndIf
        
        Text GraphicsWidth()/2, menuY + i * 50, menuOptions[i], True, True
    Next
    
    ; Draw version info
    SetFont smallFont
    Color 128, 128, 128
    Text GraphicsWidth() - 100, GraphicsHeight() - 30, "Version " + GAME_VERSION
End Function
```

#### Menu Interaction
```blitzbasic
Function UpdateMainMenu()
    ; Mouse interaction
    menuState\MouseX = MouseX()
    menuState\MouseY = MouseY()
    menuState\Clicked = MouseHit(1)
    
    ; Keyboard navigation
    If KeyHit(KEY_UP) Then
        menuState\SelectedOption = (menuState\SelectedOption - 1 + menuOptions.length) Mod menuOptions.length
    EndIf
    
    If KeyHit(KEY_DOWN) Then
        menuState\SelectedOption = (menuState\SelectedOption + 1) Mod menuOptions.length
    EndIf
    
    ; Selection handling
    If KeyHit(KEY_RETURN) Or menuState\Clicked Then
        HandleMenuSelection(menuState\SelectedOption)
    EndIf
End Function

Function HandleMenuSelection(option%)
    Select option
        Case 0  ; New Game
            menuState\CurrentScreen = MENU_NEW_GAME
        Case 1  ; Load Game
            menuState\CurrentScreen = MENU_LOAD_GAME
        Case 2  ; Options
            menuState\CurrentScreen = MENU_OPTIONS
        Case 3  ; Exit
            End
    End Select
End Function
```

#### Options Menu
```blitzbasic
Function DrawOptionsMenu()
    ; Graphics options
    DrawText "Resolution:", 100, 150
    DrawText "Graphics Quality:", 100, 200
    DrawText "VSync:", 100, 250
    
    ; Audio options
    DrawText "Master Volume:", 100, 300
    DrawText "SFX Volume:", 100, 350
    DrawText "Music Volume:", 100, 400
    
    ; Controls
    DrawText "Mouse Sensitivity:", 100, 450
    DrawText "Invert Mouse Y:", 100, 500
    
    ; Save/Load buttons
    If Button(100, 550, 200, 50, "Save Settings") Then
        SaveSettings()
    EndIf
    
    If Button(350, 550, 200, 50, "Load Defaults") Then
        LoadDefaultSettings()
    EndIf
End Function
```

### Integration Points
- **[Input System](CORE_SYSTEMS.md#input-system)**: Handles menu navigation
- **[Audio System](CORE_SYSTEMS.md#audio-system)**: Menu sound effects
- **[State Management Systems](STATE_MANAGEMENT_SYSTEMS.md)**: Settings persistence

---

## In-Game HUD

### Purpose
The in-game HUD provides essential player information while maintaining immersion in the horror environment.

### HUD Elements

#### Status Bars
```blitzbasic
Type HUDBar
    Field x%, y%               ; Position
    Field width%, height%      ; Size
    Field value#, maxValue#    ; Current/max values
    Field colorR%, colorG%, colorB%  ; Bar color
    Field bgColorR%, bgColorG%, bgColorB%  ; Background color
    Field label$               ; Display label
End Type

; HUD bars
Global HealthBar.HUDBar = CreateHUDBar(50, GraphicsHeight() - 100, 200, 20, "HEALTH")
Global StaminaBar.HUDBar = CreateHUDBar(50, GraphicsHeight() - 70, 200, 20, "STAMINA")
Global SanityBar.HUDBar = CreateHUDBar(50, GraphicsHeight() - 40, 200, 20, "SANITY")

Function DrawHUDBar(bar.HUDBar)
    ; Draw background
    Color bar\bgColorR, bar\bgColorG, bar\bgColorB
    Rect bar\x, bar\y, bar\width, bar\height, True
    
    ; Draw filled bar
    fillWidth% = (bar\value / bar\maxValue) * bar\width
    Color bar\colorR, bar\colorG, bar\colorB
    Rect bar\x, bar\y, fillWidth, bar\height, True
    
    ; Draw border
    Color 255, 255, 255
    Rect bar\x, bar\y, bar\width, bar\height, False
    
    ; Draw label and value
    Color 255, 255, 255
    Text bar\x + bar\width + 10, bar\y + bar\height/2 - 5, bar\label + ": " + Int(bar\value) + "/" + Int(bar\maxValue)
End Function

Function UpdateHUDBars()
    HealthBar\value = PlayerHealth
    StaminaBar\value = PlayerStamina
    SanityBar\value = PlayerSanity
    
    ; Update bar colors based on status
    UpdateBarColors()
End Function

Function UpdateBarColors()
    ; Health bar colors
    If HealthBar\value > 75 Then
        HealthBar\colorR = 0: HealthBar\colorG = 255: HealthBar\colorB = 0  ; Green
    ElseIf HealthBar\value > 25 Then
        HealthBar\colorR = 255: HealthBar\colorG = 255: HealthBar\colorB = 0  ; Yellow
    Else
        HealthBar\colorR = 255: HealthBar\colorG = 0: HealthBar\colorB = 0  ; Red
    EndIf
    
    ; Stamina bar colors
    StaminaBar\colorR = 0: StaminaBar\colorG = 255: StaminaBar\colorB = 255  ; Cyan
    
    ; Sanity bar colors
    If SanityBar\value > 50 Then
        SanityBar\colorR = 0: SanityBar\colorG = 255: SanityBar\colorB = 255  ; Cyan
    ElseIf SanityBar\value > 25 Then
        SanityBar\colorR = 255: SanityBar\colorG = 255: SanityBar\colorB = 0  ; Yellow
    Else
        SanityBar\colorR = 255: SanityBar\colorG = 0: SanityBar\colorB = 255  ; Magenta
    EndIf
End Function
```

#### Blink Timer
```blitzbasic
Global BlinkTimerDisplay.HUDTimer = CreateHUDTimer(50, 50, "BLINK")

Function DrawBlinkTimer()
    ; Calculate time until next blink
    timeLeft# = BlinkTimer
    If timeLeft < 0 Then timeLeft = 0
    
    ; Draw timer background
    Color 0, 0, 0
    Oval GraphicsWidth()/2 - 50, 50, 100, 100, True
    
    ; Draw timer arc
    If BlinkTimer > 0 Then
        arcAngle# = (timeLeft / BlinkInterval) * 360
        Color 255, 255, 0
        DrawArc GraphicsWidth()/2, 100, 40, arcAngle, 0
    EndIf
    
    ; Draw timer text
    Color 255, 255, 255
    Text GraphicsWidth()/2, 85, Int(timeLeft * 10) / 10.0, True, True
    
    ; Flash warning when close to blink
    If timeLeft < 1.0 Then
        If MilliSecs() Mod 200 < 100 Then
            Color 255, 0, 0
            Text GraphicsWidth()/2, 110, "BLINK!", True, True
        EndIf
    EndIf
End Function

Function DrawArc(x%, y%, radius%, angle#, startAngle#)
    ; Draw arc segments
    segments% = 32
    For i = 0 To segments
        a1# = startAngle + (angle / segments) * i
        a2# = startAngle + (angle / segments) * (i + 1)
        
        x1# = x + Cos(a1) * radius
        y1# = y + Sin(a1) * radius
        x2# = x + Cos(a2) * radius
        y2# = y + Sin(a2) * radius
        
        Line x1, y1, x2, y2
    Next
End Function
```

#### Crosshair
```blitzbasic
Function DrawCrosshair()
    centerX% = GraphicsWidth() / 2
    centerY% = GraphicsHeight() / 2
    
    ; Draw crosshair lines
    Color 255, 255, 255
    Line centerX - 10, centerY, centerX + 10, centerY
    Line centerX, centerY - 10, centerX, centerY + 10
    
    ; Draw center dot
    Oval centerX - 1, centerY - 1, 3, 3, True
End Function
```

### Notifications and Messages
```blitzbasic
Type HUDMessage
    Field text$                ; Message text
    Field x%, y%               ; Position
    Field lifeTime#            ; How long to display
    Field fadeTime#            ; Fade out duration
    Field colorR%, colorG%, colorB%  ; Text color
    Field font%                ; Font to use
End Type

Global HUDMessages.HUDMessage[10]  ; Message queue

Function ShowHUDMessage(text$, duration# = 3.0, r% = 255, g% = 255, b% = 255)
    ; Find empty slot or replace oldest
    slot% = -1
    oldestTime# = 999999
    
    For i = 0 To 9
        If HUDMessages[i] = Null Then
            slot = i
            Exit
        ElseIf HUDMessages[i]\lifeTime < oldestTime Then
            oldestTime = HUDMessages[i]\lifeTime
            slot = i
        EndIf
    Next
    
    If slot >= 0 Then
        msg.HUDMessage = New HUDMessage
        msg\text = text
        msg\x = GraphicsWidth() / 2
        msg\y = GraphicsHeight() / 2 - 100
        msg\lifeTime = duration
        msg\fadeTime = 0.5
        msg\colorR = r
        msg\colorG = g
        msg\colorB = b
        
        HUDMessages[slot] = msg
    EndIf
End Function

Function UpdateHUDMessages()
    For i = 0 To 9
        If HUDMessages[i] <> Null Then
            msg.HUDMessage = HUDMessages[i]
            
            ; Update lifetime
            msg\lifeTime = msg\lifeTime - (1.0 / 60.0)
            
            If msg\lifeTime <= 0 Then
                ; Remove message
                Delete msg
                HUDMessages[i] = Null
            EndIf
        EndIf
    Next
End Function

Function DrawHUDMessages()
    For i = 0 To 9
        If HUDMessages[i] <> Null Then
            msg.HUDMessage = HUDMessages[i]
            
            ; Calculate alpha
            alpha# = 1.0
            If msg\lifeTime < msg\fadeTime Then
                alpha = msg\lifeTime / msg\fadeTime
            EndIf
            
            ; Draw message
            Color msg\colorR * alpha, msg\colorG * alpha, msg\colorB * alpha
            Text msg\x, msg\y + i * 30, msg\text, True, True
        EndIf
    Next
End Function
```

---

## Inventory UI

### Purpose
The inventory UI provides visual management of the player's collected items, enabling drag-drop operations and item combination.

### Architecture

#### Inventory Grid
```blitzbasic
Type InventoryUI
    Field x%, y%               ; UI position
    Field slotSize%            ; Size of each inventory slot
    Field rows%, cols%         ; Grid dimensions
    Field selectedSlot%        ; Currently selected slot
    Field dragSlot%            ; Slot being dragged
    Field dragX%, dragY%       ; Drag position
    Field isDragging%          ; Drag state
End Type

Global InventoryUI.InventoryUI = CreateInventoryUI(600, 200, 50, 3, 3)

Function CreateInventoryUI(x%, y%, slotSize%, rows%, cols%)
    ui.InventoryUI = New InventoryUI
    ui\x = x
    ui\y = y
    ui\slotSize = slotSize
    ui\rows = rows
    ui\cols = cols
    ui\selectedSlot = -1
    ui\isDragging = False
    
    Return ui
End Function
```

### Core Functions

#### Inventory Rendering
```blitzbasic
Function DrawInventoryUI()
    ; Draw inventory background
    Color 64, 64, 64
    Rect InventoryUI\x - 10, InventoryUI\y - 10, _
         InventoryUI\cols * InventoryUI\slotSize + 20, _
         InventoryUI\rows * InventoryUI\slotSize + 20, True
    
    ; Draw inventory border
    Color 128, 128, 128
    Rect InventoryUI\x - 10, InventoryUI\y - 10, _
         InventoryUI\cols * InventoryUI\slotSize + 20, _
         InventoryUI\rows * InventoryUI\slotSize + 20, False
    
    ; Draw inventory slots
    For row = 0 To InventoryUI\rows - 1
        For col = 0 To InventoryUI\cols - 1
            slotIndex% = row * InventoryUI\cols + col
            
            DrawInventorySlot(InventoryUI\x + col * InventoryUI\slotSize, _
                            InventoryUI\y + row * InventoryUI\slotSize, _
                            InventoryUI\slotSize, slotIndex)
        Next
    Next
    
    ; Draw dragged item
    If InventoryUI\isDragging And InventoryUI\dragSlot >= 0 Then
        item.Items = Inventory\Items[InventoryUI\dragSlot]
        If item <> Null Then
            DrawItemIcon(item, InventoryUI\dragX, InventoryUI\dragY, InventoryUI\slotSize)
        EndIf
    EndIf
End Function

Function DrawInventorySlot(x%, y%, size%, slotIndex%)
    ; Draw slot background
    If slotIndex = InventoryUI\selectedSlot Then
        Color 255, 255, 0  ; Highlight selected slot
    Else
        Color 96, 96, 96
    EndIf
    
    Rect x, y, size, size, True
    
    ; Draw slot border
    Color 128, 128, 128
    Rect x, y, size, size, False
    
    ; Draw item if present
    item.Items = Inventory\Items[slotIndex]
    If item <> Null Then
        DrawItemIcon(item, x + 2, y + 2, size - 4)
        
        ; Draw stack count
        If item\Quantity > 1 Then
            Color 255, 255, 255
            Text x + size - 15, y + size - 15, item\Quantity
        EndIf
    EndIf
End Function

Function DrawItemIcon(item.Items, x%, y%, size%)
    ; Draw item background
    Color 192, 192, 192
    Rect x, y, size, size, True
    
    ; Draw item image (placeholder)
    Color 255, 255, 255
    Text x + size/2, y + size/2, Left(item\Name, 1), True, True
    
    ; Draw item border
    Color 255, 255, 255
    Rect x, y, size, size, False
End Function
```

#### Inventory Interaction
```blitzbasic
Function UpdateInventoryUI()
    mouseX% = MouseX()
    mouseY% = MouseY()
    
    ; Check mouse over slots
    hoveredSlot% = GetInventorySlotAt(mouseX, mouseY)
    
    ; Handle mouse clicks
    If MouseHit(1) Then
        If hoveredSlot >= 0 Then
            ; Start drag or select slot
            If InventoryUI\selectedSlot = hoveredSlot Then
                ; Start dragging
                InventoryUI\isDragging = True
                InventoryUI\dragSlot = hoveredSlot
                InventoryUI\dragX = mouseX
                InventoryUI\dragY = mouseY
            Else
                ; Select slot
                InventoryUI\selectedSlot = hoveredSlot
            EndIf
        EndIf
    EndIf
    
    ; Handle drag
    If InventoryUI\isDragging Then
        InventoryUI\dragX = mouseX
        InventoryUI\dragY = mouseY
        
        ; Check for drag release
        If Not MouseDown(1) Then
            targetSlot% = GetInventorySlotAt(mouseX, mouseY)
            
            If targetSlot >= 0 And targetSlot <> InventoryUI\dragSlot Then
                ; Attempt to move item
                MoveInventoryItem(InventoryUI\dragSlot, targetSlot)
            EndIf
            
            InventoryUI\isDragging = False
            InventoryUI\dragSlot = -1
        EndIf
    EndIf
    
    ; Handle item usage
    If KeyHit(KEY_E) And InventoryUI\selectedSlot >= 0 Then
        UseInventoryItem(InventoryUI\selectedSlot)
    EndIf
End Function

Function GetInventorySlotAt(x%, y%)
    If x >= InventoryUI\x And x < InventoryUI\x + InventoryUI\cols * InventoryUI\slotSize And _
       y >= InventoryUI\y And y < InventoryUI\y + InventoryUI\rows * InventoryUI\slotSize Then
        
        col% = (x - InventoryUI\x) / InventoryUI\slotSize
        row% = (y - InventoryUI\y) / InventoryUI\slotSize
        
        slotIndex% = row * InventoryUI\cols + col
        If slotIndex >= 0 And slotIndex < InventoryUI\rows * InventoryUI\cols Then
            Return slotIndex
        EndIf
    EndIf
    
    Return -1
End Function

Function MoveInventoryItem(fromSlot%, toSlot%)
    fromItem.Items = Inventory\Items[fromSlot]
    toItem.Items = Inventory\Items[toSlot]
    
    ; Swap items
    Inventory\Items[fromSlot] = toItem
    Inventory\Items[toSlot] = fromItem
End Function
```

### Item Combination Interface
```blitzbasic
Function DrawItemCombination()
    If InventoryUI\selectedSlot >= 0 Then
        item1.Items = Inventory\Items[InventoryUI\selectedSlot]
        
        ; Find combinable items
        For i = 0 To 8
            If i <> InventoryUI\selectedSlot Then
                item2.Items = Inventory\Items[i]
                If item1 <> Null And item2 <> Null Then
                    combo.ItemCombination = CanCombineItems(item1\ItemID, item2\ItemID)
                    If combo <> Null Then
                        ; Draw combination hint
                        Color 255, 255, 0
                        Text InventoryUI\x + InventoryUI\cols * InventoryUI\slotSize + 20, _
                             InventoryUI\y + i * 20, combo\Description
                    EndIf
                EndIf
            EndIf
        Next
    EndIf
End Function
```

### Integration Points
- **[Inventory System](GAME_MECHANICS.md#inventory-system)**: Manages item data
- **[Input System](CORE_SYSTEMS.md#input-system)**: Handles mouse interaction
- **[Rendering System](CORE_SYSTEMS.md#rendering-system)**: Draws UI elements

---

## UI System Integration

### Main UI Update Loop
```blitzbasic
Function UpdateUI()
    ; Update HUD elements
    UpdateHUDBars()
    UpdateHUDMessages()
    
    ; Update inventory UI
    UpdateInventoryUI()
    
    ; Handle UI input
    HandleUIInput()
End Function

Function DrawUI()
    ; Draw HUD
    DrawHUDBars()
    DrawBlinkTimer()
    DrawCrosshair()
    DrawHUDMessages()
    
    ; Draw inventory if open
    If InventoryOpen Then
        DrawInventoryUI()
        DrawItemCombination()
    EndIf
End Function
```

### UI State Management
```blitzbasic
Global InventoryOpen% = False

Function HandleUIInput()
    ; Toggle inventory
    If KeyHit(KEY_TAB) Then
        InventoryOpen = Not InventoryOpen
    EndIf
    
    ; Close inventory with ESC
    If KeyHit(KEY_ESCAPE) And InventoryOpen Then
        InventoryOpen = False
    EndIf
End Function
```

### Performance Considerations
- **UI Culling**: Only draw visible UI elements
- **Font Caching**: Cache rendered text
- **Texture Atlasing**: Combine UI textures
- **Update Batching**: Group UI updates

### Accessibility Considerations
- **Color Blind Support**: Multiple color schemes
- **Font Scaling**: Adjustable text sizes
- **High Contrast**: Enhanced visibility options
- **Keyboard Navigation**: Full keyboard support

---

*UI/HUD systems provide the critical interface between player and game world, delivering essential information while preserving the immersive horror atmosphere of SCP: Containment Breach.*