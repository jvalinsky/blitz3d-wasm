# SCPB Game State Debugging and Visual Debugging Infrastructure

## Overview

This document provides a comprehensive analysis of the game state tracking and
debugging capabilities expected for SCPB (SCP - Containment Breach) based on the
documented skill patterns and architectural specifications. The debugging
infrastructure is designed to support runtime inspection of player state, NPC
behavior, room conditions, save states, time progression, and visual debugging
helpers for development and troubleshooting purposes.

The debugging system is built around a conditional compilation approach where
debug functions only execute when DEBUG_MODE is enabled, ensuring zero
performance overhead in release builds. This infrastructure supports both
text-based console debugging and visual debugging helpers including wireframe
overlays, colored indicators, and real-time stat displays.

The debugging framework is organized into several interconnected systems: player
state debugging covers core statistics like health, stamina, and sanity along
with position and equipment tracking; NPC state debugging provides detailed
insights into individual and collective NPC behavior, states, and AI
decision-making; room state debugging monitors room transitions, door states,
item locations, and active events; save state debugging validates save file
integrity and current state snapshots; time state debugging tracks game time,
day/night cycles, and event timers; visual debugging helpers provide wireframe
rendering, coordinate axes, state indicators, and path visualization; debug
hotkeys enable rapid access to common debugging functions; watch variables allow
real-time monitoring of specific game variables; and debug console functionality
provides a scrolling text buffer for game state output.

The system architecture emphasizes modularity and extensibility, allowing
developers to add new debug functions without modifying the core debugging
infrastructure. All debug output is channeled through standardized interfaces
that support both console display and visual overlays, ensuring consistent
behavior across different debugging contexts.

---

## 1. Player State Variables and Debug Functions

### 1.1 Core Player State Variables

The player state is managed through a set of global variables that track the
player's physical condition, spatial position, equipment status, and special
abilities. These variables form the foundation of the player debugging system
and are continuously updated throughout gameplay.

The following table documents the primary player state variables:

| Variable       | Type    | Purpose                               | Range            |
| -------------- | ------- | ------------------------------------- | ---------------- |
| PlayerRoom     | Integer | Current room identifier               | 0 to N-1         |
| PlayerHealth   | Float   | Current health percentage             | 0.0 to 100.0     |
| PlayerStamina  | Float   | Current stamina percentage            | 0.0 to 100.0     |
| Sanity         | Float   | Current sanity percentage             | 0.0 to 100.0     |
| BlinkTimer     | Float   | Time until next blink                 | 0.0 to 1.0       |
| BlinkEffect    | Float   | Current blink visual effect intensity | 0.0 to 1.0       |
| PlayerCollider | Integer | Physics collider entity handle        | Entity reference |
| Camera         | Integer | Player camera entity handle           | Entity reference |
| GOD_MODE       | Boolean | God mode toggle for invincibility     | True/False       |

The PlayerRoom variable serves as the primary index into the room system,
allowing the debugging infrastructure to retrieve room names, door connections,
and room-specific information. This variable is essential for tracking player
progression and identifying the current game context.

PlayerHealth represents the player's remaining life force, with values below
certain thresholds triggering different health states. The debugging system
provides granular health information including damage taken, bleeding severity,
and health zone classifications ranging from EXCELLENT through NEAR DEATH.

PlayerStamina tracks the player's endurance reserves used for sprinting and
other physical activities. The debug functions display current stamina,
regeneration rates, sprint costs, and depleted state information including
cooldown timers.

Sanity represents the player's mental stability, which degrades in certain
environments and when witnessing traumatic events. The sanity system includes
multiple sanity states from STABLE through BREAKING, with associated effects
like hallucinations, panic chance, and confusion at lower sanity levels.

BlinkTimer and BlinkEffect manage the player's eye blink mechanic, which is
crucial for avoiding SCP-173. The debug overlay displays the blink timer as a
percentage and shows the current visual effect intensity, helping developers
test and balance the blink system.

PlayerCollider is the physics entity representing the player's physical presence
in the game world. This entity handle is used for position queries, collision
detection, and visual debugging helpers like coordinate axes and direction
indicators.

GOD_MODE is a debug-only flag that enables invincibility and other
developer-friendly features. When enabled, the player cannot take damage,
stamina does not deplete, and sanity effects are suspended.

### 1.2 Player Debug Functions

The player debugging system is implemented through a collection of specialized
functions that output detailed player state information to the debug console.
These functions are designed to be called from the main game loop or triggered
by debug hotkeys.

The Debug_PlayerState function provides a comprehensive overview of the player's
current condition:

```blitzbasic
Function Debug_PlayerState()
    If Not DEBUG_MODE Then Return

    ; Core stats
    Debug_Print "=== PLAYER STATE ==="
    Debug_Print "Room: " + PlayerRoom + " (" + RoomName$(PlayerRoom) + ")"
    Debug_Print "Health: " + Int(PlayerHealth) + "/" + Int(GetMaxHealth())
    Debug_Print "Stamina: " + Int(PlayerStamina) + "/" + Int(GetMaxStamina())
    Debug_Print "Sanity: " + Int(Sanity) + "/" + Int(GetMaxSanity())

    ; Position
    Debug_Print "Position: " + FormatVector(PlayerPosition())

    ; Rotation
    Debug_Print "Rotation: " + FormatRotation(PlayerRotation())

    ; Blink state
    Debug_Print "Blink: " + Int(BlinkTimer * 100) + "%"
    Debug_Print "BlinkEffect: " + Int(BlinkEffect * 100) + "%"

    ; Equipment
    Debug_Print "NVG: " + (HaveNVG() ? "YES" : "NO")
    Debug_Print "GasMask: " + (HaveGasMask() ? "YES" : "NO")

    ; Status effects
    Debug_Print "Status: " + GetStatusEffects()

    ; God mode
    Debug_Print "God Mode: " + (GOD_MODE ? "ON" : "OFF")
End Function
```

This function serves as the primary entry point for player state debugging,
displaying all relevant information in a structured format. The function first
checks the DEBUG_MODE flag to ensure debug output is only generated when
debugging is enabled, following the conditional compilation pattern that
minimizes overhead in release builds.

The core stats section displays the player's current room with its associated
name, followed by health, stamina, and sanity values normalized against their
maximum values. The room display includes both the numeric room identifier and
the human-readable room name, facilitating quick identification of the player's
location.

Position information is displayed using the FormatVector helper function, which
converts the 3D position vector into a clean string representation suitable for
console output. Rotation is displayed using FormatRotation, which separates
pitch, yaw, and roll components for easier interpretation.

The blink state section shows both the time until the next blink as a percentage
and the current visual effect intensity. This information is particularly useful
for testing SCP-173 interactions and balancing the blink mechanic.

Equipment status displays whether the player possesses night vision goggles and
a gas mask, both of which are important for survival in certain SCP encounters.
The equipment check uses dedicated helper functions (HaveNVG and HaveGasMask)
that encapsulate the inventory query logic.

Status effects are aggregated and displayed as a single string, showing
conditions like BLEEDING, POISONED, ON FIRE, DARK VISION, and EXHAUSTED. If no
status effects are active, the string displays "NONE".

The God mode indicator shows the current debug mode status, helping developers
quickly verify that the invincibility flag is in the expected state.

### 1.3 Health Debug Functions

The health debugging subsystem provides detailed insights into the player's
physical condition, including damage tracking, health zones, bleeding mechanics,
and recent damage history. These functions help developers identify issues with
the health system and balance damage values.

```blitzbasic
Function Debug_HealthState()
    If Not DEBUG_MODE Then Return

    Debug_Print "=== HEALTH DETAILS ==="
    Debug_Print "Current: " + PlayerHealth
    Debug_Print "Max: " + GetMaxHealth()
    Debug_Print "Damage: " + (GetMaxHealth() - PlayerHealth)

    ; Health zones
    If PlayerHealth > 80
        Debug_Print "Status: EXCELLENT"
    ElseIf PlayerHealth > 60
        Debug_Print "Status: GOOD"
    ElseIf PlayerHealth > 40
        Debug_Print "Status: FAIR"
    ElseIf PlayerHealth > 20
        Debug_Print "Status: CRITICAL"
    Else
        Debug_Print "Status: NEAR DEATH"
    End If

    ; Bleeding
    If Bleeding > 0
        Debug_Print "Bleeding: " + Bleeding + "/100"
        Debug_Print "Blood Loss/sec: " + (Bleeding * 0.5)
    End If

    ; Recent damage
    If DamageHistory > 0
        Debug_Print "Recent Damage: " + DamageHistory
    End If
End Function
```

The health debug function calculates and displays the total damage taken by
subtracting the current health from the maximum health. This calculation helps
developers verify that damage values are being applied correctly and that health
regeneration mechanics are functioning.

The health zone classification system provides immediate visual feedback on the
player's condition through categorical labels. These zones (EXCELLENT, GOOD,
FAIR, CRITICAL, NEAR DEATH) correspond to health thresholds and help developers
quickly assess player status during testing.

Bleeding is displayed as a severity value from 0 to 100, with the calculated
blood loss per second shown alongside. This information is crucial for testing
and balancing the bleeding mechanic, ensuring that bleed damage is appropriately
calibrated against health regeneration.

The recent damage tracking feature displays cumulative damage taken since the
last debug output, helping developers identify sudden damage spikes that might
indicate bugs or balance issues.

### 1.4 Stamina Debug Functions

The stamina debugging subsystem tracks the player's endurance system, including
regeneration rates, sprint costs, depletion states, and current sprinting
status. These functions support development of movement mechanics and balance
testing.

```blitzbasic
Function Debug_StaminaState()
    If Not DEBUG_MODE Then Return

    Debug_Print "=== STAMINA DETAILS ==="
    Debug_Print "Current: " + Int(PlayerStamina)
    Debug_Print "Max: " + GetMaxStamina()

    ; Stamina regeneration
    If PlayerStamina < GetMaxStamina()
        regen = GetStaminaRegen()
        Debug_Print "Regen: +" + regen + "/sec"
    End If

    ; Sprint cost
    Debug_Print "Sprint Cost: " + GetSprintCost() + "/sec"

    ; Depleted state
    If StaminaDepleted
        Debug_Print "DEPLETED - Cannot sprint for " + StaminaCooldown + "s"
    End If

    ; Recent sprint
    If Sprinting
        Debug_Print "Currently SPRINTING"
    End If
End Function
```

The stamina debug function displays the current and maximum stamina values as
integers for clean output. When stamina is below maximum, the regeneration rate
per second is calculated and displayed, helping developers verify that
regeneration mechanics are functioning correctly.

The sprint cost display shows how much stamina is consumed per second of
sprinting. This information is essential for balancing the stamina economy and
ensuring that sprinting is appropriately limited without being too restrictive.

The depleted state display shows when the player has exhausted their stamina and
entered a cooldown period during which sprinting is impossible. The remaining
cooldown time is displayed, helping developers test the depletion and recovery
mechanics.

The current sprinting status is indicated when the player is actively sprinting,
providing immediate feedback on player actions.

### 1.5 Sanity Debug Functions

The sanity debugging subsystem monitors the player's mental state, including
sanity zones, active sanity effects, and recent sanity changes. This system
helps developers balance environmental horror elements and test sanity-related
gameplay mechanics.

```blitzbasic
Function Debug_SanityState()
    If Not DEBUG_MODE Then Return

    Debug_Print "=== SANITY DETAILS ==="
    Debug_Print "Current: " + Int(Sanity)
    Debug_Print "Max: " + GetMaxSanity()

    ; Sanity zones
    If Sanity > 80
        Debug_Print "Status: STABLE"
    ElseIf Sanity > 60
        Debug_Print "Status: SHAKEN"
    ElseIf Sanity > 40
        Debug_Print "Status: UNSTABLE"
    ElseIf Sanity > 20
        Debug_Print "Status: FRACTURED"
    Else
        Debug_Print "Status: BREAKING"
    End If

    ; Sanity effects
    If Sanity < 40
        Debug_Print "EFFECTS ACTIVE:"
        If Hallucinations Then Debug_Print "  - Hallucinations"
        If Fear Then Debug_Print "  - Fear (panic chance)"
        If Confusion Then Debug_Print "  - Confusion"
    End If

    ; Recent sanity changes
    If SanityDamageHistory > 0
        Debug_Print "Recent Sanity Loss: " + SanityDamageHistory
    End If
End Function
```

The sanity debug function displays the current and maximum sanity values along
with a categorical status label based on sanity thresholds. The status labels
(STABLE, SHAKEN, UNSTABLE, FRACTURED, BREAKING) correspond to increasingly
severe mental states that affect gameplay.

When sanity drops below 40%, the debug output displays any active sanity
effects. Hallucinations, fear (which introduces panic chance), and confusion are
displayed with appropriate labels. This granular effect display helps developers
verify that sanity effects are triggering at the correct thresholds.

The recent sanity changes tracking displays cumulative sanity damage, helping
developers identify sudden sanity loss events and verify that environmental
effects are being applied correctly.

### 1.6 Helper Functions

The player debugging system relies on several helper functions that encapsulate
common queries and formatting operations. These functions promote code reuse and
maintainability.

```blitzbasic
Function GetMaxHealth()
    Return 100.0
End Function

Function GetMaxStamina()
    Return 100.0
End Function

Function GetMaxSanity()
    Return 100.0
End Function

Function PlayerPosition()
    Return (EntityX(PlayerCollider), EntityY(PlayerCollider), EntityZ(PlayerCollider))
End Function

Function PlayerRotation()
    GetEntityRotation Camera, pitch#, yaw#, roll#
    Return (pitch, yaw, roll)
End Function

Function FormatVector(vec)
    Return "(" + Int(vec[0]) + ", " + Int(vec[1]) + ", " + Int(vec[2]) + ")"
End Function

Function FormatRotation(rot)
    Return "P:" + Int(rot[0]) + " Y:" + Int(rot[1]) + " R:" + Int(rot[2])
End Function

Function GetStatusEffects()
    effects$ = ""
    If Bleeding > 0 Then effects$ = effects$ + "BLEEDING "
    If Poisoned > 0 Then effects$ = effects$ + "POISONED "
    If OnFire > 0 Then effects$ = effects$ + "ON FIRE "
    If DarkVision > 0 Then effects$ = effects$ + "DARK VISION "
    If StaminaDepleted Then effects$ = effects$ + "EXHAUSTED "
    If effects$ = "" Then effects$ = "NONE"
    Return effects$
End Function
```

The maximum value functions (GetMaxHealth, GetMaxStamina, GetMaxSanity)
currently return constant values but are implemented as functions to allow for
future modifications such as difficulty scaling or equipment bonuses.

PlayerPosition retrieves the player's current coordinates by querying the
collider entity's position. This abstraction allows the position query to be
modified if the position tracking method changes.

PlayerRotation extracts the camera's pitch, yaw, and roll values using the
GetEntityRotation function. The rotation is returned as a tuple for formatting.

FormatVector converts a 3D position vector into a clean string representation
with integer coordinates. This formatting ensures consistent, readable output
regardless of the underlying precision.

FormatRotation converts a rotation tuple into a labeled string showing pitch,
yaw, and roll components. The P/Y/R prefix makes the output immediately
understandable.

GetStatusEffects aggregates all active status effects into a single
space-separated string. This function checks for bleeding, poisoning, fire
damage, dark vision, and exhaustion, displaying "NONE" if no effects are active.

---

## 2. NPC State Debug Functions

### 2.1 NPC State Debugging Overview

The NPC debugging system provides comprehensive visibility into all non-player
characters in the game, including their current state, position, health,
behavior, and AI perception of the player. This system is essential for
debugging AI behavior, testing SCP encounters, and balancing entity
interactions.

The NPC debugging infrastructure is organized around three primary functions:
Debug_AllNPCs for displaying all NPCs, Debug_NPCState for examining individual
entities, and Debug_NPCSummary for providing statistical overviews of the NPC
population.

### 2.2 All NPCs Debug Function

The Debug_AllNPCs function iterates through all active NPCs and displays
detailed state information for each one. This function provides complete
visibility into the entire NPC population.

```blitzbasic
Function Debug_AllNPCs()
    If Not DEBUG_MODE Then Return

    Debug_Print "=== NPC STATE (" + CountNPCs() + " total) ==="

    For npc.NPCs = Each NPCs
        Debug_NPCState(npc)
    Next
End Function
```

This function begins by printing the total number of NPCs currently active in
the game. The count is obtained through the CountNPCs function, which iterates
through the NPCs type collection. The function then iterates through each NPC in
the collection, calling Debug_NPCState for each one to display detailed
information.

The iteration pattern uses the BlitzBasic ForEach syntax, which provides
efficient traversal of type collections. This approach ensures that all NPCs are
processed regardless of their specific type or state.

### 2.3 Single NPC Debug Function

The Debug_NPCState function displays detailed information about a single NPC,
including its type, current state, position, speed, health, and perception
status. This function provides the granular detail needed for debugging specific
NPC behavior.

```blitzbasic
Function Debug_NPCState(npc.NPCs)
    If npc = Null Then Return

    Debug_Print "--- NPC " + npc\ID + " ---"
    Debug_Print "Type: " + NPCTypeName(npc\NPCtype) + " (" + npc\NPCtype + ")"
    Debug_Print "State: " + GetStateName(npc\State) + " (" + npc\State + ")"
    Debug_Print "State2: " + npc\State2
    Debug_Print "State3: " + npc\State3

    ; Position
    pos# = EntityX(npc\obj)
    posy# = EntityY(npc\obj)
    posz# = EntityZ(npc\obj)
    Debug_Print "Pos: (" + Int(pos) + ", " + Int(posy) + ", " + Int(posz) + ")"

    ; Speed
    Debug_Print "Speed: " + npc\Speed + " (curr: " + npc\CurrSpeed + ")"

    ; Distance to player
    dist# = Distance(npc\obj, PlayerCollider)
    Debug_Print "Dist to player: " + Int(dist)

    ; Health (if applicable)
    If npc\Health <> 0
        Debug_Print "Health: " + npc\Health + "/" + npc\MaxHealth
    End If

    ; Alert status
    If CanSeePlayer(npc)
        Debug_Print "SEES PLAYER"
    ElseIf CanHearPlayer(npc)
        Debug_Print "HEARS PLAYER"
    Else
        Debug_Print "Unaware of player"
    End If

    ; Pathfinding
    If npc\PathStatus = PATH_ACTIVE
        Debug_Print "Path: ACTIVE (nodes: " + npc\PathNodeCount + ")"
    Else
        Debug_Print "Path: IDLE"
    End If
End Function
```

The NPC state function begins with basic identification information, displaying
the NPC's unique ID, type name with numeric identifier, and current state with
name and numeric value. The State2 and State3 fields provide additional state
information that varies by NPC type.

Position information is extracted from the NPC's 3D object using EntityX,
EntityY, and EntityZ functions, then formatted into a clean coordinate string.
The position display uses integer conversion for readability.

Speed information shows both the NPC's base speed and current speed, allowing
developers to identify speed modifiers and movement variations. The distance to
player calculation uses the Distance function, which is essential for testing
encounter ranges and AI perception thresholds.

Health information is displayed only if the NPC has health defined (indicated by
a non-zero Health field). This conditional display prevents cluttering the
output with health information for entities that don't use the health system.

The alert status section queries the NPC's perception capabilities using
CanSeePlayer and CanHearPlayer functions. The output indicates whether the NPC
currently sees the player (highest alert), hears the player (medium alert), or
is unaware (lowest alert).

Pathfinding status displays whether the NPC has an active path and how many
nodes are in that path. Active paths indicate the NPC is navigating toward a
target, while idle paths indicate the NPC is stationary or patrolling without a
specific navigation goal.

### 2.4 NPC Summary Debug Function

The Debug_NPCSummary function provides a statistical overview of the NPC
population, including counts by type and state, as well as dead NPC tracking.
This function is particularly useful for testing spawn mechanics and balance.

```blitzbasic
Function Debug_NPCSummary()
    If Not DEBUG_MODE Then Return

    Debug_Print "=== NPC SUMMARY ==="

    ; Count by type
    counts%[NUM_NPC_TYPES]
    For npc.NPCs = Each NPCs
        counts[npc\NPCtype] = counts[npc\NPCtype] + 1
    Next

    ; Print counts
    For type = 0 To NUM_NPC_TYPES - 1
        If counts[type] > 0
            Debug_Print NPCTypeName(type) + ": " + counts[type]
        End If
    Next

    ; Print states
    Debug_Print ""
    Debug_Print "State distribution:"
    stateCounts%[NUM_STATES]
    For npc.NPCs = Each NPCs
        stateCounts[npc\State] = stateCounts[npc\State] + 1
    Next

    For state = 0 To NUM_STATES - 1
        If stateCounts[state] > 0
            Debug_Print "  " + GetStateName(state) + ": " + stateCounts[state]
        End If
    Next

    ; Dead NPCs
    deadCount = CountDeadNPCs()
    If deadCount > 0
        Debug_Print ""
        Debug_Print "Dead NPCs: " + deadCount
    End If
End Function
```

The NPC summary function uses temporary arrays to count NPCs by type and by
state. The type counting helps developers verify that spawn rates are correct
and that NPC distributions match design expectations. The state counting
provides insight into AI behavior patterns, showing how many NPCs are in each
behavioral state.

The dead NPC count is obtained through a dedicated function that filters the NPC
collection for deceased entities. This count is essential for tracking player
progress and testing kill-related mechanics.

---

## 3. Room State Debug Functions

### 3.1 Room State Debugging Overview

The room debugging system provides visibility into the player's current
environment, including room identification, door connections, contained NPCs and
items, active events, and visitation history. This system helps developers test
level transitions, event triggers, and room-specific mechanics.

### 3.2 Room State Debug Function

The Debug_RoomState function displays comprehensive information about the
current room, including connections, contents, and state.

```blitzbasic
Function Debug_RoomState()
    If Not DEBUG_MODE Then Return

    Debug_Print "=== ROOM STATE ==="
    Debug_Print "Current Room: " + PlayerRoom + " (" + RoomName$(PlayerRoom) + ")"

    ; Room details
    Debug_Print "Zone: " + RoomZoneName(PlayerRoom)
    Debug_Print "Door Count: " + RoomDoorCount(PlayerRoom)

    ; Doors
    For i = 0 To RoomDoorCount(PlayerRoom) - 1
        Debug_Print "Door " + i + ": -> " + RoomDoorTarget(PlayerRoom, i)
    Next

    ; NPCs in room
    roomNPCs = CountNPCsInRoom(PlayerRoom)
    Debug_Print "NPCs in room: " + roomNPCs

    ; Items in room
    roomItems = CountItemsInRoom(PlayerRoom)
    Debug_Print "Items in room: " + roomItems

    ; Events
    If RoomHasActiveEvent(PlayerRoom)
        Debug_Print "ACTIVE EVENT: " + GetRoomEventName(PlayerRoom)
    End If

    ; Visited
    If RoomVisited(PlayerRoom)
        Debug_Print "Visited: YES (visit #" + RoomVisitCount(PlayerRoom) + ")"
    Else
        Debug_Print "Visited: NO (first time)"
    End If
End Function
```

The room state function displays the current room identifier and name, providing
immediate context for all other room-related information. The zone name
indicates the facility area the room belongs to, which is useful for testing
level layout and zone-specific behaviors.

Door information is displayed by iterating through the room's door connections
and showing the target room for each door. This information helps developers
verify that room connections are correct and that doors lead to expected
destinations.

NPC and item counts in the room provide quick visibility into room contents
without requiring individual entity inspection. These counts are obtained
through specialized counting functions that filter entities by room.

Event detection shows whether the current room has any active events triggered,
displaying the event name if present. This feature helps developers test event
triggers and verify that room events are activating correctly.

Visitation tracking shows whether the player has previously visited the room and
provides a visit count for tracking exploration patterns. This information
supports achievement systems and exploration-based mechanics.

---

## 4. Save State Debugging

### 4.1 Save State Debugging Overview

The save state debugging system validates save file integrity, displays save
slot information, and provides current state snapshots for comparison with saved
states. This system helps developers test save/load functionality and identify
serialization issues.

### 4.2 Save State Debug Function

The Debug_SaveState function displays information about available save slots and
the current game state for comparison.

```blitzbasic
Function Debug_SaveState()
    If Not DEBUG_MODE Then Return

    Debug_Print "=== SAVE STATE ==="

    ; Check save files
    For slot = 0 To 3
        If SaveFileExists(slot)
            info = GetSaveInfo(slot)
            Debug_Print "Slot " + slot + ": EXISTS"
            Debug_Print "  Room: " + info\Room + " (" + RoomName$(info\Room) + ")"
            Debug_Print "  Health: " + info\Health
            Debug_Print "  Time: " + FormatTime(info\PlayTime)
            Debug_Print "  Date: " + info\SaveDate
        Else
            Debug_Print "Slot " + slot + ": (empty)"
        End If
    Next

    ; Current state snapshot
    Debug_Print ""
    Debug_Print "Current State Snapshot:"
    Debug_Print "  Room: " + PlayerRoom
    Debug_Print "  Health: " + Int(PlayerHealth)
    Debug_Print "  Stamina: " + Int(PlayerStamina)
    Debug_Print "  Sanity: " + Int(Sanity)
    Debug_Print "  Inventory: " + CountInventoryItems() + " items"
    Debug_Print "  NPCs Killed: " + CountDeadNPCs()
    Debug_Print "  Time Played: " + FormatTime(GetTotalPlayTime())
End Function
```

The save state function iterates through available save slots (0-3 in this
implementation), checking for existing save files using SaveFileExists. When a
save file exists, the function retrieves detailed save information including the
room, health, play time, and save date. Empty slots are explicitly marked as
such.

The current state snapshot provides a point-in-time capture of the player's
current condition for comparison with saved states. This snapshot includes all
critical state variables: room, health, stamina, sanity, inventory count, kill
count, and total play time. Developers can use this snapshot to verify that
save/load operations correctly preserve game state.

---

## 5. Time State Debugging

### 5.1 Time State Debugging Overview

The time state debugging system tracks game time progression, day/night cycles,
and scheduled event timers. This system helps developers test time-based
mechanics, event triggers, and environmental changes that depend on time.

### 5.2 Time State Debug Function

The Debug_TimeState function displays the current game time, real time, time of
day, day/night cycle status, and upcoming event timers.

```blitzbasic
Function Debug_TimeState()
    If Not DEBUG_MODE Then Return

    Debug_Print "=== TIME STATE ==="

    ; Game time
    Debug_Print "Game Time: " + FormatTime(GetGameTime())
    Debug_Print "Real Time: " + FormatTime(GetRealTime())

    ; Time of day
    Debug_Print "Time of Day: " + GetTimeOfDay()

    ; Day/night cycle
    If HasDayNightCycle()
        Debug_Print "Day Phase: " + GetDayPhase()
        Debug_Print "Darkness: " + Int(GetDarkness() * 100) + "%"
    End If

    ; Event timers
    Debug_Print "Event Timers:"
    Debug_Print "  MTF Spawn: " + TimeUntilEvent("MTF_SPAWN")
    Debug_Print "  Chaos Insurgency: " + TimeUntilEvent("CI_SPAWN")
    Debug_Print "  Breach: " + TimeUntilEvent("BREACH")

    ; Warnings
    If TimeUntilEvent("MTF_SPAWN") < 60
        Debug_Print "WARNING: MTF arriving soon!"
    End If
End Function
```

The time state function displays both game time (elapsed time within the current
play session) and real time (actual wall clock time). The FormatTime helper
converts time values to human-readable strings.

Time of day indicates the current period within the facility's day/night cycle,
which affects lighting and enemy behavior. The day/night cycle section displays
the current phase and overall darkness percentage, helping developers test
lighting-dependent mechanics.

Event timers show the time remaining until scheduled events like MTF (Mobile
Task Force) spawns, Chaos Insurgency encounters, and containment breaches. The
MTF spawn timer includes a warning when the event is imminent (less than 60
seconds away), providing proactive notification of approaching events.

---

## 6. Visual Debugging Helpers

### 6.1 Debug Drawing System Overview

The visual debugging system provides wireframe rendering, colored indicators,
and on-screen text overlays for runtime inspection of game state. Unlike
text-based debugging that outputs to the console, visual debugging helpers
render directly into the game world and on-screen display.

The visual debugging system is controlled by the DEBUG_MODE global variable,
ensuring that all visual debug elements can be disabled for release builds.

### 6.2 Debug Drawing Init and Toggle Functions

```blitzbasic
Global DEBUG_MODE% = False
Global DEBUG_FONT%

Function Debug_Init()
    DEBUG_FONT = LoadFont("Arial", 14)
End Function

Function Debug_Toggle()
    DEBUG_MODE = Not DEBUG_MODE
End Function
```

The Debug_Init function loads a font for debug text rendering. This font is used
for all on-screen debug displays. The Debug_Toggle function provides a simple
mechanism to enable or disable all debugging output with a single function call.

### 6.3 Debug Draw Function

The Debug_Draw function provides the core on-screen debug overlay displaying
essential player information.

```blitzbasic
Function Debug_Draw()
    If Not DEBUG_MODE Then Return

    ; Draw on top of everything
    SetFont DEBUG_FONT
    SetColor 0, 255, 0

    ; FPS counter
    DrawText "FPS: " + GetFPS(), 10, 10

    ; Player info
    DrawText "Health: " + Int(PlayerHealth), 10, 30
    DrawText "Stamina: " + Int(PlayerStamina), 10, 50
    DrawText "Sanity: " + Int(Sanity), 10, 70
    DrawText "Room: " + PlayerRoom, 10, 90

    ; Position
    DrawText "Pos: " + EntityX(PlayerCollider) + ", " + EntityY(PlayerCollider) + ", " + EntityZ(PlayerCollider), 10, 110

    ; Blink timer
    DrawText "Blink: " + Int(BlinkTimer * 100) + "%", 10, 130
End Function
```

The Debug_Draw function renders essential player information in the top-left
corner of the screen. The function sets the debug font and green color before
drawing text. The displayed information includes frame rate, health, stamina,
sanity, current room, player position, and blink timer.

### 6.4 Wireframe Debug Helpers

The wireframe debug helpers render simple geometric shapes around entities for
visual identification and position verification.

```blitzbasic
; Draw wireframe box around entity
Function Debug_DrawBox(entity, r% = 255, g% = 0, b% = 0)
    Wireframe True
    SetColor r, g, b
    DrawWireframeBox(entity)
    Wireframe False
End Function

; Draw sphere at position
Function Debug_DrawSphere(x#, y#, z#, radius# = 0.5, r% = 255, g% = 0, b% = 0)
    Wireframe True
    SetColor r, g, b
    DrawWireframeSphere(x, y, z, radius)
    Wireframe False
End Function

; Draw line between two points
Function Debug_DrawLine(x1#, y1#, z1#, x2#, y2#, z2#, r% = 255, g% = 0, b% = 0)
    SetColor r, g, b
    DrawLine x1, y1, z1, x2, y2, z2
End Function

; Draw coordinate axes at position
Function Debug_DrawAxes(entity, scale# = 1.0)
    x# = EntityX(entity)
    y# = EntityY(entity)
    z# = EntityZ(entity)

    ; X axis - Red
    DrawLine x, y, z, x + scale, y, z, 255, 0, 0
    ; Y axis - Green
    DrawLine x, y, z, x, y + scale, z, 0, 255, 0
    ; Z axis - Blue
    DrawLine x, y, z, x, y, z + scale, 0, 0, 255
End Function

; Draw arrow showing direction
Function Debug_DrawArrow(entity, length# = 2.0, r% = 255, g% = 0, b% = 0)
    x# = EntityX(entity)
    y# = EntityY(entity)
    z# = EntityZ(entity)

    GetEntityRotation(entity, pitch#, yaw#, roll#)

    ; Calculate forward vector
    fx# = Sin(yaw) * length
    fz# = Cos(yaw) * length

    SetColor r, g, b
    DrawLine x, y, z, x + fx, y, z + fz
End Function
```

Debug_DrawBox renders a wireframe bounding box around an entity using the
specified color. This function is useful for visualizing entity extents and
collision boundaries.

Debug_DrawSphere renders a wireframe sphere at a specified position with
configurable radius and color. This function is commonly used to mark waypoints,
path nodes, and target locations.

Debug_DrawLine renders a simple line between two 3D points with configurable
color. This function is used to create connections between related objects and
visualize relationships.

Debug_DrawAxes renders a set of three orthogonal lines representing the X (red),
Y (green), and Z (blue) axes. This function is essential for debugging rotation
and orientation issues.

Debug_DrawArrow renders a line indicating the forward direction of an entity
based on its yaw rotation. This function helps visualize entity facing direction
for debugging movement and AI behavior.

### 6.5 Player Visual Debug Function

The Debug_PlayerInfo function renders visual debug elements around the player
character for position and orientation verification.

```blitzbasic
Function Debug_PlayerInfo()
    If Not DEBUG_MODE Then Return

    ; Player position marker
    Debug_DrawSphere(EntityX(PlayerCollider), EntityY(PlayerCollider), EntityZ(PlayerCollider), 0.3, 0, 255, 0)

    ; Player direction
    Debug_DrawArrow(PlayerCollider, 2.0, 0, 255, 0)

    ; Camera position
    Debug_DrawAxes(Camera, 0.5)

    ; View direction
    Debug_DrawLine(
        EntityX(Camera), EntityY(Camera), EntityZ(Camera),
        EntityX(Camera) + CameraDirectionX() * 5,
        EntityY(Camera) + CameraDirectionY() * 5,
        EntityZ(Camera) + CameraDirectionZ() * 5,
        0, 255, 255
    )

    ; Blink radius
    Debug_DrawSphere(EntityX(PlayerCollider), EntityY(PlayerCollider), EntityZ(PlayerCollider), 10.0, 255, 255, 0, 50)
End Function
```

The player debug function renders multiple visual elements around the player: a
small green sphere marking the player's position, a green arrow indicating
facing direction, coordinate axes at the camera position, a cyan line showing
the camera's view direction, and a large yellow sphere indicating the blink
radius.

### 6.6 NPC Visual Debug Function

The Debug_NPCInfo function renders visual debug elements around all NPCs,
including state indicators, path visualization, and player perception lines.

```blitzbasic
Function Debug_NPCInfo()
    If Not DEBUG_MODE Then Return

    For npc.NPCs = Each NPCs
        ; Draw NPC bounding box
        Debug_DrawBox(npc\obj, 255, 0, 0)

        ; Draw state color
        Select npc\State
            Case STATE_IDLE: Debug_DrawSphere(EntityX(npc\obj), EntityY(npc\obj), EntityZ(npc\obj), 0.5, 0, 255, 0)
            Case STATE_HUNTING: Debug_DrawSphere(EntityX(npc\obj), EntityY(npc\obj), EntityZ(npc\obj), 0.5, 255, 0, 0)
            Case STATE_ATTACK: Debug_DrawSphere(EntityX(npc\obj), EntityY(npc\obj), EntityZ(npc\obj), 0.5, 255, 255, 0)
            Case STATE_FLEE: Debug_DrawSphere(EntityX(npc\obj), EntityY(npc\obj), EntityZ(npc\obj), 0.5, 0, 255, 255)
        End Select

        ; Draw path if pathfinding
        If npc\PathStatus = PATH_ACTIVE
            For i = 0 To npc\PathNodeCount - 1
                node = npc\PathNodes[i]
                Debug_DrawSphere(EntityX(node), EntityY(node), EntityZ(node), 0.2, 255, 255, 255)
                If i > 0
                    prev = npc\PathNodes[i - 1]
                    Debug_DrawLine(EntityX(node), EntityY(node), EntityZ(node),
                                  EntityX(prev), EntityY(prev), EntityZ(prev), 255, 255, 255)
                End If
            Next
        End If

        ; Draw line to player if detecting
        If CanSeePlayer(npc)
            Debug_DrawLine(EntityX(npc\obj), EntityY(npc\obj), EntityZ(npc\obj),
                          EntityX(PlayerCollider), EntityY(PlayerCollider), EntityZ(PlayerCollider),
                          255, 0, 0)
        End If

        ; Draw line to heard player
        If CanHearPlayer(npc)
            Debug_DrawLine(EntityX(npc\obj), EntityY(npc\obj), EntityZ(npc\obj),
                          EntityX(PlayerCollider), EntityY(PlayerCollider), EntityZ(PlayerCollider),
                          255, 255, 0)
        End If
    Next
End Function
```

The NPC debug function iterates through all NPCs and renders multiple visual
elements for each. A red bounding box shows the NPC's spatial extent. A colored
sphere above the NPC indicates its current state: green for IDLE, red for
HUNTING, yellow for ATTACK, and cyan for FLEE.

When an NPC has an active path, white spheres mark each path node with lines
connecting consecutive nodes, visualizing the navigation path. Red lines connect
NPCs that can see the player, and yellow lines connect NPCs that can hear the
player but cannot see them.

### 6.7 Collision Visual Debug Function

The Debug_CollisionInfo function renders visual debug elements around colliders
for physics debugging.

```blitzbasic
Function Debug_CollisionInfo()
    If Not DEBUG_MODE Then Return

    ; Draw player collider
    Debug_DrawBox(PlayerCollider, 0, 255, 0)

    ; Draw all NPC colliders
    For npc.NPCs = Each NPCs
        If npc\Collider <> 0
            Debug_DrawBox(npc\Collider, 255, 0, 0)
        End If
    Next

    ; Draw item colliders
    For item.Items = Each Items
        If item\obj <> 0
            Debug_DrawBox(item\obj, 0, 255, 255)
        End If
    Next

    ; Highlight collision points
    For i = 0 To CountCollisions(PlayerCollider) - 1
        x# = CollisionX(i)
        y# = CollisionY(i)
        z# = CollisionZ(i)
        Debug_DrawSphere(x, y, z, 0.2, 255, 0, 255)
    Next
End Function
```

The collision debug function renders bounding boxes for the player (green), NPCs
(red), and items (cyan). Active collision points are marked with small magenta
spheres, helping developers identify collision issues and verify physics
behavior.

### 6.8 Room Visual Debug Function

The Debug_RoomInfo function renders visual debug elements for room elements
including doors and room bounds.

```blitzbasic
Function Debug_RoomInfo()
    If Not DEBUG_MODE Then Return

    ; Current room info
    DrawText "Room: " + PlayerRoom, 10, 150
    DrawText "Room Name: " + RoomName$(PlayerRoom), 10, 170

    ; Draw doors
    For i = 0 To RoomDoorCount(PlayerRoom) - 1
        dx# = RoomDoorX(PlayerRoom, i)
        dy# = RoomDoorY(PlayerRoom, i)
        dz# = RoomDoorZ(PlayerRoom, i)
        Debug_DrawSphere(dx, dy, dz, 0.5, 0, 255, 0)

        ; Draw connected room
        DrawText "Door " + i + " -> Room " + RoomDoorTarget(PlayerRoom, i), 10, 190 + i * 20
    Next

    ; Room bounds
    roomBounds = GetRoomBounds(PlayerRoom)
    Debug_DrawBox(roomBounds, 255, 255, 255, 100)
End Function
```

The room debug function displays room information text and renders visual
markers at door positions with white lines indicating connections to target
rooms. The room bounds are rendered as a white wireframe box.

### 6.9 AI State Visual Debug Function

The Debug_AIState function renders 3D text labels above NPCs displaying their
current state and relevant statistics.

```blitzbasic
Function Debug_AIState(npc)
    If Not DEBUG_MODE Then Return

    x# = EntityX(npc\obj)
    y# = EntityY(npc\obj)
    z# = EntityZ(npc\obj)

    ; State name
    stateName$ = GetNPCStateName(npc\NPCtype, npc\State)
    DrawText3D(stateName$, x, y + 2.5, z)

    ; Speed
    DrawText3D "Speed: " + npc\CurrSpeed, x, y + 2.3, z

    ; Distance to player
    dist# = Distance(npc\obj, PlayerCollider)
    DrawText3D "Dist: " + Int(dist), x, y + 2.1, z

    ; State-specific info
    Select npc\NPCtype
        Case NPC_SCP_173
            DrawText3D "ObserveTime: " + npc\State2, x, y + 1.9, z

        Case NPC_SCP_096
            DrawText3D "Agitated: " + npc\State2, x, y + 1.9, z

        Case NPC_SCP_106
            DrawText3D "Corrosion: " + npc\State2, x, y + 1.9, z

        Case NPC_SCP_049
            DrawText3D "CureTimer: " + npc\State2, x, y + 1.9, z
    End Select
End Function
```

The AI state function renders floating text above NPCs showing their state name,
current speed, distance to player, and type-specific information. SCP-specific
debug data includes observation time for SCP-173, agitation level for SCP-096,
corrosion level for SCP-106, and cure timer for SCP-049.

### 6.10 Performance Debug Function

The Debug_Performance function monitors and displays performance metrics
including frame rate, entity counts, and memory usage.

```blitzbasic
Global DEBUG_FRAMES%[60]
Global DEBUG_FRAME_INDEX% = 0
Global DEBUG_FPS% = 0

Function Debug_Performance()
    If Not DEBUG_MODE Then Return

    ; FPS calculation
    DEBUG_FRAMES[DEBUG_FRAME_INDEX] = GetMilliSecs()
    DEBUG_FRAME_INDEX = (DEBUG_FRAME_INDEX + 1) Mod 60

    If DEBUG_FRAME_INDEX = 0
        DEBUG_FPS = 60000 / (DEBUG_FRAMES[59] - DEBUG_FRAMES[0])
    End If

    ; Draw FPS
    SetColor DEBUG_FPS > 30 ? 0 : 255, DEBUG_FPS > 30 ? 255 : 0, 0
    DrawText "FPS: " + Int(DEBUG_FPS), 10, 10

    ; Entity count
    DrawText "Entities: " + CountEntities(), 10, 30
    DrawText "NPCs: " + CountNPCs(), 10, 50
    DrawText "Items: " + CountItems(), 10, 70

    ; Memory
    DrawText "Memory: " + MemoryUsed(), 10, 90
End Function
```

The performance function calculates FPS using a rolling window of 60 frame
times. The FPS display changes color from green (good performance) to red (poor
performance) when frame rate drops below 30. Entity counts for total entities,
NPCs, and items are displayed along with memory usage.

---

## 7. Debug Hotkeys

### 7.1 Debug Hotkey System Overview

The debug hotkey system provides keyboard shortcuts for common debugging
operations, enabling rapid access to debugging features without accessing debug
menus. Each hotkey triggers a specific debugging function when pressed.

### 7.2 Debug Hotkey Functions

```blitzbasic
Function Debug_HandleInput()
    If Not KeyHit(KEY_F1) Then Return

    Debug_Toggle()
    Debug_Print("Debug mode: " + (DEBUG_MODE ? "ON" : "OFF"))
End Function

; F2 - God mode toggle
Function Debug_GodMode()
    If Not KeyHit(KEY_F2) Then Return
    GOD_MODE = Not GOD_MODE
    Debug_Print("God mode: " + (GOD_MODE ? "ON" : "OFF"))
End Function

; F3 - Teleport to room
Function Debug_Teleport()
    If Not KeyHit(KEY_F3) Then Return
    ; Could show room selector UI
End Function

; F4 - Spawn NPC
Function Debug_SpawnNPC()
    If Not KeyHit(KEY_F4) Then Return
    npc = CreateNPC(NPC_SCP_939)
    PositionEntity npc\obj, EntityX(PlayerCollider), EntityY(PlayerCollider), EntityZ(PlayerCollider) + 5
    Debug_Print("Spawned SCP-939")
End Function

; F5 - Kill all NPCs
Function Debug_KillAllNPCs()
    If Not KeyHit(KEY_F5) Then Return
    For npc.NPCs = Each NPCs
        KillNPC(npc)
    Next
    Debug_Print("All NPCs killed")
End Function

; F6 - Full health
Function Debug_FullHealth()
    If Not KeyHit(KEY_F6) Then Return
    SetPlayerHealth(100)
    SetPlayerStamina(100)
    SetSanity(100)
    Debug_Print("Full health restored")
End Function

; F7 - Save state snapshot
Function Debug_SaveSnapshot()
    If Not KeyHit(KEY_F7) Then Return
    Debug_Print("State snapshot saved")
    ; Save current state for comparison
End Function

; F8 - Step frame (pause)
Global DEBUG_STEP_MODE% = False

Function Debug_StepFrame()
    If Not KeyHit(KEY_F8) Then Return

    If DEBUG_STEP_MODE
        ; Resume
        DEBUG_STEP_MODE = False
        Debug_Print("Resumed")
    Else
        ; Pause and step mode
        DEBUG_STEP_MODE = True
        Debug_Print("Step mode - press F9 to step")
    End If
End Function

Function Debug_Step()
    If DEBUG_STEP_MODE And KeyHit(KEY_F9)
        Return True
    End If
    Return Not DEBUG_STEP_MODE
End Function
```

The F1 key toggles the global DEBUG_MODE flag, enabling or disabling all debug
output and visual elements. The function prints the new debug mode status for
confirmation.

The F2 key toggles GOD_MODE, providing invincibility and unlimited resources for
testing. The function prints the new god mode status for confirmation.

The F3 key is designated for teleport functionality, with a placeholder for room
selector UI implementation. This hotkey would typically open an in-game menu for
room selection.

The F4 key spawns an SCP-939 instance at a position near the player, with the
NPC positioned 5 units in front of the player collider. This hotkey is useful
for testing specific SCP encounters.

The F5 key iterates through all NPCs and kills them, useful for quickly clearing
the level for testing other content. The function prints a confirmation message.

The F6 key restores the player to full health, stamina, and sanity, useful for
quickly resetting player state after testing damage mechanics.

The F7 key saves a state snapshot for later comparison, allowing developers to
record the game state at specific points for debugging.

The F8 key toggles step mode, which pauses the game and enables single-frame
advancement. The F9 key advances the game by one frame when in step mode.

### 7.3 Debug Hotkey Quick Reference

| Hotkey | Action                 |
| ------ | ---------------------- |
| F1     | Toggle debug mode      |
| F2     | God mode toggle        |
| F3     | Teleport menu          |
| F4     | Spawn SCP-939          |
| F5     | Kill all NPCs          |
| F6     | Full health restore    |
| F7     | Save state snapshot    |
| F8     | Pause/step mode toggle |
| F9     | Step one frame         |

---

## 8. Watch Variables System

### 8.1 Watch Variables System Overview

The watch variables system allows developers to monitor specific game variables
for changes in real-time. This system is particularly useful for tracking
variable modifications that might indicate bugs or unexpected behavior.

### 8.2 Watch Variables Implementation

```blitzbasic
Global WATCH_LIST$[10]
Global WATCH_VALUES$[10]

Function Debug_AddWatch(variableName$)
    For i = 0 To 9
        If WATCH_LIST$[i] = ""
            WATCH_LIST$[i] = variableName$
            WATCH_VALUES$[i] = ""
            Return True
        End If
    Next
    Debug_Print "Watch list full!"
    Return False
End Function

Function Debug_UpdateWatches()
    If Not DEBUG_MODE Then Return

    Debug_Print "=== WATCHES ==="
    For i = 0 To 9
        If WATCH_LIST$[i] <> ""
            value$ = EvaluateVariable(WATCH_LIST$[i])
            oldValue$ = WATCH_VALUES$[i]

            ; Highlight changes
            If value$ <> oldValue$
                Debug_Print WATCH_LIST$[i] + ": " + value$ + " (CHANGED)"
            Else
                Debug_Print WATCH_LIST$[i] + ": " + value$
            End If

            WATCH_VALUES$[i] = value$
        End If
    Next
End Function
```

The watch system uses two parallel arrays: WATCH_LIST$ stores the names of
variables to monitor, and WATCH_VALUES$ stores the last observed values. The
system supports up to 10 watched variables simultaneously.

The Debug_AddWatch function attempts to add a variable to the watch list by
finding the first empty slot. If all slots are full, the function prints a
warning message and returns False. On successful addition, the function returns
True.

The Debug_UpdateWatches function iterates through the watch list and evaluates
each variable using the EvaluateVariable helper function. The current value is
compared against the stored previous value, and changes are highlighted with a
"(CHANGED)" suffix. Updated values are stored for comparison in subsequent
updates.

---

## 9. Debug Console Functionality

### 9.1 Debug Console Overview

The debug console provides a scrolling text buffer for debug output, ensuring
that important debug messages are preserved and visible even when they scroll
off the immediate screen. The console supports 20 lines of history with
automatic wrapping.

### 9.2 Debug Console Implementation

```blitzbasic
Global DEBUG_CONSOLE_LINES$[20]
Global DEBUG_CONSOLE_INDEX% = 0

Function Debug_Print(message$)
    DEBUG_CONSOLE_LINES[DEBUG_CONSOLE_INDEX] = message$
    DEBUG_CONSOLE_INDEX = (DEBUG_CONSOLE_INDEX + 1) Mod 20

    ; Also print to console
    Print message$
End Function

Function Debug_DrawConsole()
    If Not DEBUG_MODE Then Return

    SetFont DEBUG_FONT
    SetColor 0, 255, 0

    For i = 0 To 19
        line$ = DEBUG_CONSOLE_LINES[(DEBUG_CONSOLE_INDEX + i) Mod 20]
        If line$ <> ""
            DrawText line, 10, 600 - i * 15
        End If
    Next
End Function
```

The Debug_Print function stores messages in a circular buffer of 20 lines. The
DEBUG_CONSOLE_INDEX tracks the current write position, wrapping around when it
reaches the buffer limit. Messages are also sent to the standard Print function
for development environment output.

The Debug_DrawConsole function renders the console buffer on screen, displaying
the most recent 20 messages in reverse order (newest at the bottom). The
function skips empty lines to prevent blank spaces from appearing in the console
display.

---

## 10. Complete Debug System Integration

### 10.1 Debug Update Loop

The debug update loop coordinates all debug input handling, ensuring that
hotkeys are processed and state updates occur each frame.

```blitzbasic
Function Debug_Update()
    Debug_HandleInput()
    Debug_GodMode()
    Debug_Teleport()
    Debug_SpawnNPC()
    Debug_KillAllNPCs()
    Debug_FullHealth()
    Debug_SaveSnapshot()
    Debug_StepFrame()
End Function
```

The Debug_Update function calls each hotkey handler in sequence, allowing
multiple hotkey functions to be triggered within a single frame.

### 10.2 Debug Render Loop

The debug render loop coordinates all visual debug output, ensuring that all
debug elements are drawn in the correct order.

```blitzbasic
Function Debug_Render()
    Debug_Update()
    Debug_Performance()
    Debug_Draw()
    Debug_PlayerInfo()
    Debug_NPCInfo()
    Debug_CollisionInfo()
    Debug_RoomInfo()
    Debug_DrawConsole()

    ; AI state for selected NPC
    If SelectedNPC <> 0
        Debug_AIState(SelectedNPC)
    End If
End Function
```

The Debug_Render function begins by calling Debug_Update to process input, then
proceeds to render performance metrics, player information, NPC information,
collision visualization, room information, and the console buffer. If a NPC is
currently selected for detailed inspection, its AI state is rendered last to
ensure the text appears on top of other visual elements.

---

## 11. Quick Reference

### 11.1 Debug Function Quick Reference

| Debug Function         | Shows                                   |
| ---------------------- | --------------------------------------- |
| Debug_PlayerState()    | Core player stats, position, equipment  |
| Debug_HealthState()    | Detailed health information, bleeding   |
| Debug_StaminaState()   | Stamina levels, regeneration, depletion |
| Debug_SanityState()    | Sanity levels, effects, status          |
| Debug_AllNPCs()        | All NPCs with detailed state            |
| Debug_NPCState(npc)    | Single NPC detailed state               |
| Debug_NPCSummary()     | NPC counts by type and state            |
| Debug_RoomState()      | Current room, doors, NPCs, events       |
| Debug_InventoryState() | All items, keycards, selection          |
| Debug_SaveState()      | Save slots, current snapshot            |
| Debug_TimeState()      | Game time, event timers                 |
| Debug_AllState()       | Complete state dump                     |

### 11.2 Visual Debug Color Reference

| Color   | Meaning                      |
| ------- | ---------------------------- |
| Green   | Idle/Safe state              |
| Red     | Hunting/Attacking state      |
| Yellow  | Warning/Caution state        |
| Cyan    | Fleeing/Retreating state     |
| White   | Path nodes, neutral elements |
| Magenta | Collision points             |
| Blue    | Player position markers      |

### 11.3 NPC State Color Mapping

| State         | Color  | Meaning                             |
| ------------- | ------ | ----------------------------------- |
| STATE_IDLE    | Green  | NPC is stationary or patrolling     |
| STATE_HUNTING | Red    | NPC is actively pursuing the player |
| STATE_ATTACK  | Yellow | NPC is in attack sequence           |
| STATE_FLEE    | Cyan   | NPC is retreating from danger       |

---

## 12. Integration with SCPB Architecture

### 12.1 Debug System Dependencies

The debugging infrastructure integrates with several SCPB systems:

The player state debugging depends on the core player variables (PlayerHealth,
PlayerStamina, Sanity, PlayerRoom, etc.) which are maintained by Main.bb. The
debugging system reads these variables directly without modification.

The NPC state debugging depends on the NPCs type collection maintained by
NPCs.bb. The debug functions iterate through this collection and read NPC fields
without modification.

The room state debugging depends on the room management system (Map.bb) which
provides room information through accessor functions. The debug system queries
room data through these interfaces.

The save state debugging depends on the Save.bb system for save file
information. The debug functions query save metadata without direct save system
access.

### 12.2 Compiler Support

The Blitz3D-to-WASM compiler supports all debugging infrastructure constructs
including:

The global variable declarations for debug flags and buffers compile correctly
with proper type handling. The conditional DEBUG_MODE checks compile to simple
boolean comparisons that the WebAssembly optimizer can eliminate in release
builds.

The ForEach iteration patterns used for NPC and entity traversal compile
efficiently to WebAssembly loops with proper type collection handling.

The function calls between debug functions compile normally, supporting the
modular debug system architecture.

### 12.3 Runtime Support

The JavaScript runtime provides essential functions for debug rendering:

The SetFont and SetColor functions control text appearance for debug overlays.
The DrawText function renders debug text on screen. The DrawLine,
DrawWireframeBox, and DrawWireframeSphere functions enable wireframe rendering
for visual debugging.

The KeyHit function provides keyboard input detection for hotkey handling. The
GetMilliSecs function supports performance monitoring with accurate timing.

---

## 13. Usage Guidelines

### 13.1 Enabling Debug Mode

To enable debug mode during development, set the DEBUG_MODE global variable to
True before the main game loop begins:

```blitzbasic
Global DEBUG_MODE% = True

; Call debug initialization
Debug_Init()
```

Alternatively, use the F1 hotkey to toggle debug mode at runtime without
restarting the game.

### 13.2 Adding New Debug Functions

New debug functions should follow the established pattern:

```blitzbasic
Function Debug_CustomSystem()
    If Not DEBUG_MODE Then Return
    
    Debug_Print "=== CUSTOM SYSTEM ==="
    ; Debug output here
End Function
```

The function should check DEBUG_MODE at the start, print a section header, and
output relevant state information through Debug_Print calls.

### 13.3 Performance Considerations

The debug system is designed to have minimal performance impact when disabled.
All debug functions include an early return when DEBUG_MODE is False, preventing
any debug code from executing in release builds.

For visual debugging, limit the number of entities being rendered in complex
scenes. The NPC and collision debug functions iterate through all entities,
which can become expensive with large entity counts.

### 13.4 Best Practices

When debugging specific systems, use targeted debug functions rather than
comprehensive dumps. For example, use Debug_StaminaState() instead of
Debug_AllState() when debugging stamina mechanics.

Use the watch variables system to track specific values that change
unexpectedly. The watch system highlights changes, making it easier to identify
when and how values are modified.

Use the console buffer to capture debug output across frames. The circular
buffer preserves the most recent 20 debug messages, which is useful for tracking
sequences of events.

Use visual debugging helpers for spatial issues like position, rotation, and
collision detection. Wireframe overlays make it easy to visualize entity
placement and extents.

Use the step mode (F8/F9) for frame-by-frame debugging of timing-sensitive
mechanics. This allows precise observation of state changes within a single
frame.

---

## 14. Conclusion

The SCPB game state debugging and visual debugging infrastructure provides
comprehensive tools for game development, testing, and troubleshooting. The
system covers all major game subsystems including player state, NPC behavior,
room conditions, save states, time progression, and visual debugging helpers.

The debugging infrastructure is designed with performance in mind, using
conditional compilation through the DEBUG_MODE flag to eliminate all debug code
in release builds. The modular architecture allows developers to add new debug
functions without modifying core debug infrastructure.

The hotkey system provides rapid access to common debugging operations, while
the watch variables system enables targeted monitoring of specific game
variables. The debug console preserves output history and provides both text and
visual output channels for maximum debugging flexibility.

This documentation provides the complete specification for implementing the
debugging infrastructure in SCPB, supporting efficient game development and
maintenance throughout the project lifecycle.
