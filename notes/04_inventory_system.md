# SCPB Inventory System Analysis

## Overview

This document provides a comprehensive analysis of the SCPB (SCP - Containment Breach) inventory system as referenced in the blitz3d-wasm repository. Based on the codebase analysis, the inventory system is documented as part of the original SCPB game architecture but the actual Items.bb source file is not included in the current compiler infrastructure repository.

## Key Findings

### Items.bb File Status

| Attribute | Value |
|-----------|-------|
| File Name | Items.bb |
| Status | NOT PRESENT in current repository |
| Referenced In | 01_codebase_structure.md as core game system |
| Expected Location | Sources/ or root directory |
| Original Purpose | Drag-drop inventory and item combination |

The Items.bb file is referenced in the existing codebase documentation as a core game system responsible for inventory management, but the file itself is not included in the current repository. This repository contains the **Blitz3D-to-WASM compiler infrastructure** rather than the full SCPB game source code.

## Inventory System Architecture

### Expected Type Definition

Based on standard SCPB inventory patterns and BlitzBasic type conventions, the Items type definition would likely follow this structure:

```blitzbasic
; Expected Type Items Definition
Type Items
    Field ID%                      ; Unique item identifier
    Field Name$                    ; Display name
    Field Description$             ; Item description
    Field Icon%                    ; Icon texture handle
    Field Mesh%                    ; 3D model handle (for pickup)
    Field State%                   ; Item state (0=ground, 1=inventory)
    Field Area%                    ; Current area/room
    Field CombineItem%             ; Item ID this can combine with
    Field ResultItem%              ; Resulting item after combination
End Type
```

### Inventory Constants Pattern

The inventory system would typically define the following constants:

```blitzbasic
; Maximum Inventory Slots
Const MAX_INVENTORY_SLOTS = 9

; Item Type Constants
Const ITEM_NONE = 0
Const ITEM_KEYCARD = 1
Const ITEM_MEDKIT = 2
Const ITEM_FLASHLIGHT = 3
Const ITEM_BATTERY = 4
Const ITEM_DOCUMENT = 5
Const ITEM_CONSUMABLE = 6
Const ITEM_EQUIPMENT = 7
Const ITEM_COMBINED = 8
```

## Item Management Functions

### Core Functions (Expected Signatures)

Based on SCPB game design patterns, the following functions would be expected in the inventory system:

#### AddItem Function
```blitzbasic
; Function AddItem(itemID%, room%)
; Adds an item to the game world or player inventory
; Parameters:
;   itemID - The type of item to add
;   room   - The room/area to place the item
; Returns: Item object reference or 0 if failed
```

#### RemoveItem Function
```blitzbasic
; Function RemoveItem(item.Items)
; Removes an item from the game world
; Parameters:
;   item - The item object to remove
; Returns: True if successful, False otherwise
```

#### UseItem Function
```blitzbasic
; Function UseItem(item.Items)
; Uses an item from inventory
; Parameters:
;   item - The item to use
; Returns: True if item was used successfully
```

### Inventory Slot Management

```blitzbasic
; Function SelectItem(slot%)
; Selects an item from a specific inventory slot
; Parameters:
;   slot - Inventory slot index (0-8)
; Returns: Selected item or Null

; Function UpdateInventory()
; Refreshes inventory display and state
; Called after any inventory modification

; Function DropItem(item.Items, position#)
; Drops an item from inventory to the ground
; Parameters:
;   item     - Item to drop
;   position - 3D position to drop at
```

## Item Combination System

### Combination Table Pattern

SCPB features a unique item combination mechanic where certain items can be combined to create new items:

```blitzbasic
; Combination Table Structure
; Format: Combine(Item1_ID, Item2_ID) = Result_Item_ID

; Example Combinations
Data 4, 5, 10    ; Battery + Adapter = Working Flashlight
Data 1, 2, 3     ; Keycard Parts + Circuit = Level 1 Keycard
Data 6, 7, 8     ; Bottle + Chemical = Acid Vial

; Combination Function
Function CanCombine(item1.Items, item2.Items)
    ; Check if two items can be combined
    ; Return result item or Null
End Function
```

### Combination Detection

```blitzbasic
; Function CheckCombination(item1%, item2%)
; Checks if two items can be combined
; Parameters:
;   item1 - First item ID
;   item2 - Second item ID
; Returns: Result item ID or 0 if no combination
```

## Keycard System

### Keycard Levels

The SCPB keycard system provides access control to different areas of the facility:

| Level | Color | Access Areas | Typical Locations |
|-------|-------|--------------|-------------------|
| 0 | White | General containment | Reception, hallways |
| 1 | Green | Research labs | SCP-173 chamber, offices |
| 2 | Blue | Security areas | Armory, surveillance |
| 3 | Red | Restricted zones | SCP-106 entrance, SCP-049 cell |
| 4 | Black | Admin/MtF areas | O5 office, helipad |

### Keycard Implementation

```blitzbasic
; Keycard Type Definition
Type TKeycard
    Field ID%
    Field Level%                  ; Security level (0-4)
    Field Name$
    Field Description$
    Field Mesh%
    Field Area%
End Type

; Keycard Access Check
Function CanAccessArea(keycard.TKeycard, area%)
    ; Check if keycard level meets area requirement
    Return keycard\Level >= GetAreaLevel(area)
End Function

; Door Interaction
Function OpenDoor(door%, playerItems%)
    ; Check player has required keycard
    For item in playerItems
        If item\ID = ITEM_KEYCARD
            If item\Level >= GetDoorLevel(door)
                Return True
            EndIf
        EndIf
    Next
    Return False
End Function
```

## Equipment System

### Equipment Slots

SCPB features an equipment system allowing players to carry and use various items:

| Slot | Item Type | Max Quantity | Example Items |
|------|-----------|--------------|---------------|
| 0-8 | General | 9 total | Keycards, documents, tools |
| 9 | Flashlight | 1 | Working flashlight, dead flashlight |
| 10 | Radio | 1 | Radio with batteries, radio without batteries |

### Equipping Mechanics

```blitzbasic
; Equipment Type
Type TEquipment
    Field Slot%                   ; Equipment slot number
    Field Item%                   ; Item ID in slot
    Field Active%                 ; Is currently equipped/active
End Type

; Equip Item
Function EquipItem(item.Items, slot%)
    ; Place item in equipment slot
    ; Update active state
End Function

; Unequip Item
Function UnequipItem(slot%)
    ; Remove item from equipment slot
    ; Return to inventory or drop
End Function

; Update Equipment
Function UpdateEquipment()
    ; Process active equipment effects
    ; Update player state based on equipped items
End Function
```

## Inventory UI Concepts

### Drag-and-Drop Interface

The SCPB inventory uses a drag-and-drop interface:

```blitzbasic
; UI Elements
Const INVENTORY_X% = 100
Const INVENTORY_Y% = 400
Const SLOT_SIZE% = 64
Const SLOT_SPACING% = 10

; Inventory Display
Function DrawInventory()
    ; Draw inventory slots
    For i = 0 To MAX_INVENTORY_SLOTS - 1
        DrawSlot(i, INVENTORY_X + i * (SLOT_SIZE + SLOT_SPACING), INVENTORY_Y)
    Next
    
    ; Draw items in slots
    For item = Each Items
        If item\State = STATE_INVENTORY
            DrawItem(item, GetSlotPosition(item\Slot))
        EndIf
    Next
    
    ; Draw selection highlight
    If SelectedItem <> Null
        DrawHighlight(GetSlotPosition(SelectedItem\Slot))
    EndIf
End Function
```

### Item Information Display

```blitzbasic
; Item Description Box
Function ShowItemInfo(item.Items)
    If item <> Null
        DrawText(item\Name$, x, y)
        DrawText(item\Description$, x, y + 20)
    EndIf
End Function

; Item Combination Preview
Function ShowCombinationPreview(item1%, item2%)
    result = CheckCombination(item1, item2)
    If result <> 0
        DrawText("Combine to create: " + GetItemName(result))
    EndIf
End Function
```

## Data Management

### Item Data Statements

The inventory system would use DATA statements for item definitions:

```blitzbasic
; Item Database
Data "Keycard0", "White Keycard", "General access card", ITEM_KEYCARD, 0
Data "Keycard1", "Green Keycard", "Research access card", ITEM_KEYCARD, 1
Data "Keycard2", "Blue Keycard", "Security access card", ITEM_KEYCARD, 2
Data "Keycard3", "Red Keycard", "Restricted access card", ITEM_KEYCARD, 3
Data "Keycard4", "Black Keycard", "Admin access card", ITEM_KEYCARD, 4
Data "Medkit", "First Aid Kit", "Restores health", ITEM_MEDKIT, 0
Data "Flashlight", "Flashlight", "Battery-powered light source", ITEM_FLASHLIGHT, 0
Data "Battery", "Battery", "Power source for equipment", ITEM_BATTERY, 0
Data "Radio", "Radio", "Communication device", ITEM_RADIO, 0
Data "Document", "Document", "Readable document", ITEM_DOCUMENT, 0
```

## Integration Points

### Main Game Loop Integration

```blitzbasic
; In Main.bb - Main Game Loop
Function GameLoop()
    ; ... other game logic ...
    
    ; Inventory Update
    UpdateInventory()
    
    ; Equipment Update
    UpdateEquipment()
    
    ; Input Handling
    HandleInventoryInput()
    
    ; ... other game logic ...
End Function
```

### Player Interaction

```blitzbasic
; Item Pickup
Function PickupItem(item.Items)
    ; Check if player is near item
    If Distance(player, item) < PICKUP_RANGE
        ; Add to inventory if space available
        If CountInventory() < MAX_INVENTORY_SLOTS
            item\State = STATE_INVENTORY
            item\Slot = FindFreeSlot()
            PlaySound("pickup")
            Return True
        EndIf
    EndIf
    Return False
End Function
```

## Summary

### Current Repository Status

The SCPB inventory system (Items.bb) is **not implemented** in the current blitz3d-wasm repository. This repository contains the **Blitz3D-to-WASM compiler infrastructure** that would be used to compile the original SCPB game source code, including the inventory system, to WebAssembly.

### System Components

| Component | Status | Notes |
|-----------|--------|-------|
| Items Type | Not Found | Expected in Items.bb |
| AddItem Function | Not Found | Core inventory function |
| RemoveItem Function | Not Found | Core inventory function |
| UseItem Function | Not Found | Core inventory function |
| Combination System | Not Found | Unique SCPB feature |
| Keycard System | Not Found | Access control mechanic |
| Equipment System | Not Found | Player equipment slots |
| Inventory UI | Not Found | Drag-drop interface |

### Future Implementation

To fully implement the SCPB inventory system in the WASM target:

1. **Obtain Items.bb**: Source the original SCPB Items.bb file
2. **Compile with Toolchain**: Use the blitz3d-wasm compiler to convert to WASM
3. **Test Integration**: Verify inventory functionality with runtime.js
4. **Enhance Runtime**: Add JavaScript-side inventory UI rendering

## References

- Original SCPB Source Code Reference: ~52,000 lines across 35 .bb files
- Compiler Infrastructure: blitz3d-wasm/Sources/Compiler/
- Runtime Support: blitz3d-wasm/Sources/Runtime/
- Existing Documentation: notes/01_codebase_structure.md

---

**Document Status**: Analysis Complete
**Last Updated**: January 2026
**Author**: blitz3d-wasm Analysis
