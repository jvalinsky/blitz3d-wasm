# Room/Level Management Documentation

## Overview

Room and level management systems handle the procedural generation and
organization of the SCP facility environment. These systems create the vast,
multi-room complex that players navigate while managing room states,
connections, and environmental interactions.

## Room System

### Purpose

The room system manages individual facility rooms, their connections, and state,
creating the navigable environment that houses SCP entities and provides
gameplay locations.

### Architecture

#### Room Data Structure

```blitzbasic
Type Rooms
    Field RoomID%               ; Unique room identifier
    Field Name$                 ; Room name/description
    Field Mesh%                 ; 3D room model
    Field Zone%                 ; Facility zone (Light Containment, Heavy Containment, etc.)
    
    ; Spatial properties
    Field x#, y#, z#            ; Room position
    Field Angle#                ; Room rotation
    Field RoomType%             ; Room type (office, hallway, chamber, etc.)
    
    ; Connections
    Field MaxAdjacentRooms%     ; Maximum connected rooms
    Field Adjacent[10]          ; Connected room references
    Field AdjDoor[10]           ; Door entities for connections
    
    ; State management
    Field Found%                ; Player has discovered this room
    Field Visited%              ; Player has visited this room
    Field EventState%           ; Room-specific event state
    Field HazardLevel%          ; Danger level (0-5)
    
    ; Entities
    Field Objects%              ; Static objects in room
    Field NPCs%                 ; NPCs currently in room
    Field Items%                ; Items in room
    Field Lights%               ; Lighting entities
End Type
```

#### Room Types

```blitzbasic
Const ROOMTYPE_OFFICE% = 1     ; Office/workspace
Const ROOMTYPE_HALLWAY% = 2    ; Connecting corridor
Const ROOMTYPE_CHAMBER% = 3    ; SCP containment chamber
Const ROOMTYPE_LAB% = 4        ; Research laboratory
Const ROOMTYPE_STORAGE% = 5    ; Storage facility
Const ROOMTYPE_MAINTENANCE% = 6 ; Maintenance area
Const ROOMTYPE_ELEVATOR% = 7   ; Elevator shaft
Const ROOMTYPE_STAIRS% = 8     ; Stairwell
Const ROOMTYPE_OUTSIDE% = 9    ; Exterior area
Const ROOMTYPE_SPECIAL% = 10   ; Unique/special rooms
```

### Core Functions

#### Room Generation

```blitzbasic
Function CreateRoom(roomTemplate$, x#, y#, z#, angle#)
    ; Load room template
    template.RoomTemplate = FindRoomTemplate(roomTemplate)
    
    ; Create room instance
    r.Rooms = New Rooms
    r\RoomID = GenerateRoomID()
    r\Name = template\Name
    r\Zone = template\Zone
    r\RoomType = template\RoomType
    
    ; Position room
    r\x = x
    r\y = y
    r\z = z
    r\Angle = angle
    
    ; Load and position mesh
    r\Mesh = LoadMesh(template\MeshFile)
    PositionEntity r\Mesh, x, y, z
    RotateEntity r\Mesh, 0, angle, 0
    
    ; Initialize room state
    r\Found = False
    r\Visited = False
    r\EventState = 0
    r\HazardLevel = CalculateHazardLevel(template)
    
    Return r
End Function
```

#### Room Connection System

```blitzbasic
Function ConnectRooms(room1.Rooms, room2.Rooms, doorX#, doorZ#)
    ; Find available connection slot
    slot% = -1
    For i = 0 To room1\MaxAdjacentRooms - 1
        If room1\Adjacent[i] = Null Then
            slot = i
            Exit
        EndIf
    Next
    
    If slot >= 0 Then
        ; Create connection
        room1\Adjacent[slot] = room2
        room2\Adjacent[FindAvailableSlot(room2)] = room1
        
        ; Create door entity
        door% = CreateDoor(doorX, doorZ, room1\y)
        room1\AdjDoor[slot] = door
        room2\AdjDoor[slot] = door
        
        ; Update room adjacency data
        UpdateRoomAdjacency(room1)
        UpdateRoomAdjacency(room2)
    EndIf
End Function

Function UpdateRoomAdjacency(r.Rooms)
    ; Calculate room connectivity
    r\MaxAdjacentRooms = CountConnections(r)
    
    ; Update navigation mesh
    UpdateRoomNavMesh(r)
    
    ; Recalculate waypoints
    GenerateRoomWaypoints(r)
End Function
```

#### Room State Management

```blitzbasic
Function UpdateRoomStates()
    For r.Rooms = Each Rooms
        ; Check player proximity
        dist# = DistanceToRoom(r, Camera)
        
        ; Mark as found when player approaches
        If dist < ROOM_DISCOVERY_RANGE And r\Found = False Then
            r\Found = True
            OnRoomDiscovered(r)
        EndIf
        
        ; Mark as visited when player enters
        If PlayerInRoom(r) And r\Visited = False Then
            r\Visited = True
            OnRoomVisited(r)
        EndIf
        
        ; Update room events
        UpdateRoomEvents(r)
        
        ; Update room hazards
        UpdateRoomHazards(r)
    Next
End Function

Function PlayerInRoom(r.Rooms)
    playerX# = EntityX(Camera)
    playerZ# = EntityZ(Camera)
    
    ; Check if player coordinates are within room bounds
    Return (playerX >= r\x - r\Width/2 And playerX <= r\x + r\Width/2 And _
            playerZ >= r\z - r\Depth/2 And playerZ <= r\z + r\Depth/2)
End Function
```

### Integration Points

- **[Waypoint System](WAYPOINT_SYSTEM.md)**: Room-based waypoint generation
- **[Entity Systems](ENTITY_SYSTEMS.md)**: Room occupancy and NPC placement
- **[Event/Trigger Systems](EVENT_TRIGGER_SYSTEMS.md)**: Room-specific events
- **[State Management Systems](STATE_MANAGEMENT_SYSTEMS.md)**: Room state
  persistence

---

## Level Generation

### Purpose

Level generation creates the complete facility layout through procedural
algorithms, ensuring each playthrough offers a unique but coherent facility to
explore.

### Architecture

#### Facility Zones

```blitzbasic
Const ZONE_LIGHT_CONTAINMENT% = 1   ; Safe research areas
Const ZONE_HEAVY_CONTAINMENT% = 2   ; High-security SCP areas
Const ZONE_ENTRANCE% = 3            ; Facility entrance
Const ZONE_MEDICAL% = 4             ; Medical facilities
Const ZONE_MAINTENANCE% = 5         ; Service tunnels
Const ZONE_ADMIN% = 6               ; Administrative offices
Const ZONE_OUTSIDE% = 7             ; External areas
```

#### Generation Parameters

```blitzbasic
Type GenerationConfig
    Field Seed%                 ; Random seed for reproducible generation
    Field FacilitySize%         ; Overall facility scale (Small/Medium/Large)
    Field Difficulty%           ; Affects hazard placement and SCP distribution
    Field SCPCount%             ; Number of active SCP breaches
    Field SecurityLevel%        ; Base security presence
    Field LayoutType%           ; Facility layout style
End Type
```

### Core Generation Functions

#### Facility Layout Generation

```blitzbasic
Function GenerateFacility(config.GenerationConfig)
    ; Initialize random seed
    SeedRnd(config\Seed)
    
    ; Create entrance zone
    entrance.Rooms = CreateRoom("entrance_zone", 0, 0, 0, 0)
    facility.Entrance = entrance
    
    ; Generate main corridors
    GenerateMainCorridors(entrance, config)
    
    ; Create containment zones
    GenerateContainmentZones(config)
    
    ; Add special rooms
    GenerateSpecialRooms(config)
    
    ; Connect all zones
    ConnectFacilityZones()
    
    ; Place SCP entities
    PlaceSCPEntities(config)
    
    ; Generate navigation data
    GenerateFacilityWaypoints()
    
    Return facility
End Function

Function GenerateMainCorridors(startRoom.Rooms, config.GenerationConfig)
    currentRoom.Rooms = startRoom
    corridorCount% = config\FacilitySize * 5  ; Scale with facility size
    
    For i = 1 To corridorCount
        ; Choose random direction
        direction% = Rand(0, 3)  ; 0=North, 1=East, 2=South, 3=West
        
        ; Calculate new position
        newX# = currentRoom\x
        newZ# = currentRoom\z
        
        Select direction
            Case 0: newZ = newZ + ROOM_SPACING
            Case 1: newX = newX + ROOM_SPACING
            Case 2: newZ = newZ - ROOM_SPACING
            Case 3: newX = newX - ROOM_SPACING
        End Select
        
        ; Check if position is valid
        If Not RoomExistsAt(newX, newZ) Then
            ; Create new corridor room
            newRoom.Rooms = CreateRoom("corridor", newX, currentRoom\y, newZ, 0)
            ConnectRooms(currentRoom, newRoom, newX, newZ)
            currentRoom = newRoom
        EndIf
    Next
End Function
```

#### Containment Zone Generation

```blitzbasic
Function GenerateContainmentZones(config.GenerationConfig)
    ; Light containment zone
    lcZone.Zone = CreateZone(ZONE_LIGHT_CONTAINMENT, config)
    GenerateZoneLayout(lcZone)
    
    ; Heavy containment zone
    hcZone.Zone = CreateZone(ZONE_HEAVY_CONTAINMENT, config)
    GenerateZoneLayout(hcZone)
    
    ; Secure containment chambers
    For i = 1 To config\SCPCount
        scpID% = GetRandomSCP()
        chamber.Rooms = CreateSCPChamber(scpID)
        PlaceChamberInZone(chamber, hcZone)
    Next
End Function

Function GenerateZoneLayout(z.Zone)
    ; Create zone hub
    hub.Rooms = CreateRoom("zone_hub", z\CenterX, z\CenterY, z\CenterZ, 0)
    
    ; Generate rooms around hub
    roomCount% = z\Size * 8  ; Scale with zone size
    
    For i = 1 To roomCount
        ; Spiral pattern around hub
        angle# = (i / roomCount) * 360
        distance# = ROOM_SPACING * (1 + (i Mod 3))
        
        x# = z\CenterX + Cos(angle) * distance
        z# = z\CenterZ + Sin(angle) * distance
        
        ; Create room with random type
        roomType$ = ChooseRandomRoomType(z\ZoneType)
        room.Rooms = CreateRoom(roomType, x, z\CenterY, z, angle)
        
        ; Connect to nearest existing room
        nearest.Rooms = FindNearestRoom(x, z\CenterY, z)
        ConnectRooms(room, nearest, x, z)
    Next
End Function
```

#### SCP Placement Algorithm

```blitzbasic
Function PlaceSCPEntities(config.GenerationConfig)
    ; Get list of available SCPs
    scpList% = GetAvailableSCPs(config\Difficulty)
    
    ; Place each SCP in appropriate containment chamber
    For i = 0 To config\SCPCount - 1
        scpID% = scpList[i]
        
        ; Find suitable chamber
        chamber.Rooms = FindSCPChamber(scpID)
        
        If chamber <> Null Then
            ; Create SCP entity
            scp.NPCs = CreateSCP(scpID)
            
            ; Place in chamber
            PositionEntity scp\Collider, chamber\x, chamber\y, chamber\z
            
            ; Initialize SCP state
            InitializeSCPState(scp, chamber)
            
            ; Set up containment procedures
            SetupContainment(chamber, scp)
        EndIf
    Next
End Function
```

### Special Room Generation

#### Elevator Systems

```blitzbasic
Function GenerateElevators()
    ; Find vertical spaces for elevators
    For r.Rooms = Each Rooms
        If CanPlaceElevator(r) Then
            ; Create elevator shaft
            shaft.Rooms = CreateRoom("elevator_shaft", r\x, r\y, r\z, 0)
            
            ; Create elevator cars
            car1% = CreateElevatorCar(shaft, 0)    ; Ground floor
            car2% = CreateElevatorCar(shaft, -15)  ; Lower floor
            
            ; Connect floors
            ConnectElevatorFloors(car1, car2)
            
            ; Add to room connections
            ConnectRooms(r, shaft, r\x, r\z)
        EndIf
    Next
End Function
```

#### Security Checkpoints

```blitzbasic
Function GenerateSecurityCheckpoints()
    ; Place checkpoints at zone boundaries
    For boundary.Boundary = Each Boundaries
        If boundary\SecurityLevel > 1 Then
            ; Create checkpoint room
            checkpoint.Rooms = CreateRoom("security_checkpoint", boundary\x, boundary\y, boundary\z, boundary\angle)
            
            ; Add security equipment
            AddSecurityDoor(checkpoint)
            AddKeycardReader(checkpoint)
            
            ; Spawn security personnel
            SpawnSecurityGuards(checkpoint, boundary\SecurityLevel)
            
            ; Connect to boundary rooms
            ConnectBoundaryRooms(checkpoint, boundary)
        EndIf
    Next
End Function
```

### Navigation Data Generation

#### Waypoint Generation

```blitzbasic
Function GenerateFacilityWaypoints()
    For r.Rooms = Each Rooms
        ; Generate waypoints for room
        GenerateRoomWaypoints(r)
    Next
    
    ; Connect waypoints between rooms
    For r.Rooms = Each Rooms
        ConnectRoomWaypoints(r)
    Next
    
    ; Optimize waypoint graph
    OptimizeWaypointGraph()
End Function

Function GenerateRoomWaypoints(r.Rooms)
    ; Place waypoints at key locations
    waypointCount% = CalculateWaypointCount(r)
    
    For i = 1 To waypointCount
        ; Calculate waypoint position
        x# = r\x + Rnd(-r\Width/2 + 1, r\Width/2 - 1)
        z# = r\z + Rnd(-r\Depth/2 + 1, r\Depth/2 - 1)
        y# = r\y + 0.5  ; Slightly above floor
        
        ; Check if position is valid
        If ValidWaypointPosition(x, y, z, r) Then
            wp.WayPoints = CreateWaypoint(x, y, z)
            wp\room = r
            AddWaypointToRoom(r, wp)
        EndIf
    Next
End Function
```

---

## Level Management Integration

### Facility Update Loop

```blitzbasic
Function UpdateFacility()
    ; Update room states
    UpdateRoomStates()
    
    ; Update zone security
    UpdateZoneSecurity()
    
    ; Update facility events
    UpdateFacilityEvents()
    
    ; Update environmental systems
    UpdateFacilityEnvironment()
    
    ; Update navigation data
    UpdateFacilityNavigation()
End Function
```

### State Persistence

```blitzbasic
Function SaveFacilityState()
    ; Save room states
    For r.Rooms = Each Rooms
        WriteInt file, r\RoomID
        WriteInt file, r\Found
        WriteInt file, r\Visited
        WriteInt file, r\EventState
        WriteInt file, r\HazardLevel
    Next
    
    ; Save zone states
    For z.Zone = Each Zone
        WriteInt file, z\ZoneID
        WriteInt file, z\SecurityLevel
        WriteInt file, z\BreachStatus
    Next
End Function

Function LoadFacilityState()
    ; Restore room states
    For r.Rooms = Each Rooms
        roomID% = ReadInt(file)
        r\Found = ReadInt(file)
        r\Visited = ReadInt(file)
        r\EventState = ReadInt(file)
        r\HazardLevel = ReadInt(file)
    Next
    
    ; Restore zone states
    For z.Zone = Each Zone
        zoneID% = ReadInt(file)
        z\SecurityLevel = ReadInt(file)
        z\BreachStatus = ReadInt(file)
    Next
End Function
```

### Performance Considerations

- **Room Culling**: Only update rooms near player
- **Zone Streaming**: Load/unload zones as needed
- **Navigation Caching**: Cache pathfinding data
- **Memory Pooling**: Reuse room objects

### Balancing Considerations

- **Facility Size**: Balance exploration vs. claustrophobia
- **Room Distribution**: Ensure logical facility flow
- **Hazard Placement**: Create tension without frustration
- **SCP Distribution**: Balance threat levels across zones

---

_Room and level management systems create the vast, living facility that serves
as the backdrop for SCP: Containment Breach, providing the procedural
environment that makes each playthrough unique._
