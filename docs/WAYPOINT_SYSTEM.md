# Waypoint System Documentation
## Overview
The waypoint system in SCP: Containment Breach is a node-based navigation graph that enables NPCs to perform intelligent pathfinding through the facility's complex multi-room layout. The system combines pre-placed waypoints in room meshes with runtime A* pathfinding algorithms.

## Architecture
### Core Components

#### 1. Waypoint Storage in RMesh Files
Waypoints are embedded as entities within room mesh files (`.rmesh`):
```blitzbasic
; In RMeshLoader.bb - parsing waypoint entities
If entityType$ = "waypoint" Then
    Local nextWP$ = ReadString$(f)  ; Reads connected waypoint ID
EndIf
```

**Waypoint Entity Structure:**
- **Position**: World coordinates (x, y, z) 
- **Type**: "waypoint" identifier
- **Connection**: String ID of connected waypoint (forming graph edges)

#### 2. WayPoint Type System
```blitzbasic
Type WayPoints
    Field obj%              ; 3D entity representing waypoint
    Field x#, y#, z#        ; World coordinates
    Field room.Rooms        ; Associated room reference
    Field connected.WayPoints[10]  ; Array of connected waypoints
    Field numConnections%   ; Number of active connections
End Type
```

#### 3. NPC Path Storage
Each NPC maintains pathfinding state:
```blitzbasic
Type NPCs
    Field Path.WayPoints[20]   ; Current calculated path (max 20 waypoints)
    Field PathStatus%          ; Current pathfinding state
    Field PathTimer#           ; Timer for pathfinding operations
    Field PathLocation%        ; Current index in path array
    ; ... other fields
End Type
```

## Path Status States
```blitzbasic
Const PATH_IDLE% = 0          ; No active pathfinding
Const PATH_CALCULATING% = 1   ; Currently computing path
Const PATH_ACTIVE% = 2         ; Following calculated path
Const PATH_BLOCKED% = 3        ; Path blocked, needs recalculation
Const PATH_FAILED% = 4         ; Pathfinding failed completely
Const PATH_COMPLETE% = 5       ; Reached destination successfully
```

## System Functions

### CreateWayPoints()
Builds the navigation graph at runtime:
```blitzbasic
Function CreateWayPoints()
    ; Connect nodes within visible range using line-of-sight checks
    For w1.WayPoints = Each WayPoints
        For w2.WayPoints = Each WayPoints
            If w1 <> w2 Then
                dist# = EntityDistance(w1\obj, w2\obj)
                If dist < CONNECTION_RANGE Then
                    If EntityVisible(w1\obj, w2\obj) Then
                        ; Create bidirectional connection
                        w1\connected[w1\numConnections] = w2
                        w1\numConnections = w1\numConnections + 1
                        w2\connected[w2\numConnections] = w1
                        w2\numConnections = w2\numConnections + 1
                    EndIf
                EndIf
            EndIf
        Next
    Next
End Function
```

### FindPath()
A* pathfinding implementation:
```blitzbasic
Function FindPath%(npc.NPCs, targetX#, targetY#, targetZ#)
    ; 1. Find nearest visible waypoint to NPC
    startWP.WayPoints = FindNearestWaypoint(npc\Collider)
    If startWP = Null Then Return False
    
    ; 2. Find nearest visible waypoint to target
    endWP.WayPoints = FindNearestWaypointCoords(targetX, targetY, targetZ)
    If endWP = Null Then Return False
    
    ; 3. Run A* algorithm
    pathFound% = AStarPathfinding(startWP, endWP, npc\Path, 20)
    
    ; 4. Set path status
    If pathFound Then
        npc\PathStatus = PATH_ACTIVE
        npc\PathLocation = 0
        npc\PathTimer = 0
    Else
        npc\PathStatus = PATH_FAILED
    EndIf
    
    Return pathFound
End Function
```

### A* Algorithm Details
- **Heuristic Function**: Euclidean distance `h(n) = sqrt((x2-x1)² + (y2-y1)² + (z2-z1)²)`
- **Cost Function**: Actual distance between connected waypoints
- **Open Set**: Priority queue sorted by f(n) = g(n) + h(n)
- **Closed Set**: Explored nodes to prevent revisiting

## Path Execution

### NPC Path Following Pattern
```blitzbasic
Function UpdateNPCPath(npc.NPCs)
    If npc\PathStatus = PATH_ACTIVE Then
        If npc\PathLocation < 20 And npc\Path[npc\PathLocation] <> Null Then
            currentWP.WayPoints = npc\Path[npc\PathLocation]
            
            ; Calculate direction to waypoint
            dx# = EntityX(currentWP\obj) - EntityX(npc\Collider)
            dz# = EntityZ(currentWP\obj) - EntityZ(npc\Collider)
            targetAngle# = ATan2(dx, dz)
            
            ; Rotate towards waypoint
            RotateEntity npc\Collider, 0, targetAngle, 0
            
            ; Move forward
            MoveEntity npc\Collider, 0, 0, npc\Speed
            
            ; Check if reached waypoint
            dist# = EntityDistance(npc\Collider, currentWP\obj)
            If dist < 0.5 Then
                npc\PathLocation = npc\PathLocation + 1
                If npc\PathLocation >= 20 Or npc\Path[npc\PathLocation] = Null Then
                    npc\PathStatus = PATH_COMPLETE
                EndIf
            EndIf
        Else
            npc\PathStatus = PATH_COMPLETE
        EndIf
    EndIf
End Function
```

## Special Features

### Teleportation System
Prevents NPCs from getting stuck or falling too far behind:
```blitzbasic
Function TeleportCloser(npc.NPCs)
    ; Find player's current room
    playerRoom.Rooms = GetRoom(EntityX(Collider), EntityY(Collider), EntityZ(Collider))
    
    ; Search for waypoint in adjacent room outside player's view
    For w.WayPoints = Each WayPoints
        If IsAdjacentRoom(w\room, playerRoom) Then
            If Not EntityVisible(w\obj, Collider) Then
                ; Check distance range (15-25 units from player)
                x# = Abs(EntityX(Collider) - EntityX(w\obj))
                If x < 25.0 And x > 15.0 Then
                    z# = Abs(EntityZ(Collider) - EntityZ(w\obj))
                    If z < 25 And z > 15.0 Then
                        ; Teleport NPC to waypoint
                        PositionEntity npc\Collider, EntityX(w\obj), EntityY(w\obj) + 0.25, EntityZ(w\obj)
                        ResetEntity npc\Collider
                        Exit
                    EndIf
                EndIf
            EndIf
        EndIf
    Next
End Function
```

### Elevator Navigation
NPCs can navigate between floors using elevators:
```blitzbasic
Function UseElevatorNPC(npc.NPCs, elevator.Elevators)
    ; Find connected elevator waypoint
    If elevator\floor2 <> 0 Then
        targetWP.WayPoints = FindElevatorWaypoint(elevator, elevator\floor2)
        If targetWP <> Null Then
            ; Teleport to connected floor
            PositionEntity npc\Collider, EntityX(targetWP\obj), EntityY(targetWP\obj), EntityZ(targetWP\obj)
            ResetEntity npc\Collider
        EndIf
    EndIf
End Function
```

## Integration with NPC AI

### State Machine Integration
Pathfinding integrates with NPC behavior states:

#### SCP-173 (The Statue)
```blitzbasic
Case NPCtype173
    ; Teleport if too far from player (maintain pressure)
    roomsAway = CountRoomsBetween(npc\Collider, Collider)
    If roomsAway > 6 Then
        TeleportToRandomWaypointNearPlayer(npc)
    EndIf
```

#### Standard NPCs (MTF, Guards)
```blitzbasic
Case NPCtypeMTF
    ; Recalculate path if blocked
    If npc\PathStatus = PATH_BLOCKED Then
        If MilliSecs() - npc\PathTimer > 2000 Then
            FindPath(npc, EntityX(npc\Target\Collider), EntityY(npc\Target\Collider), EntityZ(npc\Target\Collider))
        EndIf
    EndIf
```

#### SCP-049 (The Plague Doctor)
```blitzbasic
Case NPCtype049
    ; Advanced tactics - teleport to adjacent rooms to flank player
    If Rand(20) = 1 Then
        TeleportToAdjacentRoom(npc, GetRoom(EntityX(Collider), EntityY(Collider), EntityZ(Collider)))
    EndIf
    
    ; Open and close doors (unique behavior)
    If EntityDistance(npc\Collider, door\obj) < 1.0 Then
        OpenDoor(door)
        npc\PathTimer = MilliSecs() + 1000  ; Wait for door to open
    EndIf
```

## Performance Optimizations

### Memory Management
- **Static Arrays**: Path arrays reused per NPC (no dynamic allocation)
- **Limited Path Length**: Maximum 20 waypoints prevents memory bloat
- **Room-based Culling**: Only consider waypoints in current or adjacent rooms

### Computational Optimizations
- **Distance-based Pruning**: Ignore waypoints beyond maximum range
- **Lazy Evaluation**: Paths calculated only when needed
- **Cached Connections**: Waypoint graph built once at level load
- **Line-of-Sight Caching**: Visibility checks cached for performance

### Query Optimization
```blitzbasic
Function FindNearestWaypoint(entity)
    nearestWP.WayPoints = Null
    nearestDist# = 999999
    
    ; Only check waypoints in current room and adjacent rooms
    currentRoom.Rooms = GetRoom(EntityX(entity), EntityY(entity), EntityZ(entity))
    
    For w.WayPoints = Each WayPoints
        If w\room = currentRoom Or IsAdjacentRoom(w\room, currentRoom) Then
            dist# = EntityDistance(entity, w\obj)
            If dist < nearestDist Then
                nearestDist = dist
                nearestWP = w
            EndIf
        EndIf
    Next
    
    Return nearestWP
End Function
```

## Debug Visualization

### Development Tools
```blitzbasic
Function DebugWaypoints()
    For w.WayPoints = Each WayPoints
        ; Draw yellow sphere at waypoint position
        Color 255, 255, 0
        Sphere EntityX(w\obj), EntityY(w\obj), EntityZ(w\obj), 0.2
        
        ; Draw lines to connected waypoints
        For i = 0 To w\numConnections - 1
            connectedWP.WayPoints = w\connected[i]
            Color 0, 255, 0
            Line EntityX(w\obj), EntityY(w\obj), EntityZ(w\obj), EntityX(connectedWP\obj), EntityY(connectedWP\obj), EntityZ(connectedWP\obj)
        Next
    Next
End Function

Function DebugNPCPaths()
    For n.NPCs = Each NPCs
        If n\PathStatus = PATH_ACTIVE Then
            ; Draw red line showing NPC's calculated path
            Color 255, 0, 0
            For i = 0 To 19
                If n\Path[i] <> Null And n\Path[i+1] <> Null Then
                    Line EntityX(n\Path[i]\obj), EntityY(n\Path[i]\obj), EntityZ(n\Path[i]\obj), EntityX(n\Path[i+1]\obj), EntityY(n\Path[i+1]\obj), EntityZ(n\Path[i+1]\obj)
                EndIf
            Next
        EndIf
    Next
End Function
```

## File Structure Integration

### RMesh Format Enhancement
The `.rmesh` format includes waypoint entities:
```
[ENTITIES]
count: 15
entity_0:
  type: "waypoint"
  position: 12.5, 0.0, 8.3
  next: "wp_001"
entity_1:
  type: "waypoint" 
  position: 15.2, 0.0, 12.1
  next: "wp_002"
```

### Loading Sequence
1. **Room Load**: RMesh file parsed for waypoint entities
2. **Waypoint Creation**: WayPoints type instances created
3. **Graph Building**: CreateWayPoints() connects visible nodes
4. **NPC Initialization**: Path arrays allocated to default values
5. **Runtime**: NPCs request paths via FindPath() as needed

## Limitations and Considerations

### System Constraints
- **Maximum Path Length**: 20 waypoints per path
- **Connection Range**: Limited by visibility checks
- **Static Graph**: Cannot be modified at runtime
- **Memory Usage**: O(n²) for connection storage

### Edge Cases
- **Disconnected Graph**: Path returns FALSE if no valid route exists
- **Dynamic Obstacles**: Doors/blocks handled by recalculation
- **Multi-floor Navigation**: Requires elevator waypoint connections
- **Large Distances**: Teleportation system prevents stuck NPCs

### Performance Trade-offs
- **Pre-computation**: Graph built at load time vs. runtime
- **Memory vs. Speed**: Cached connections increase memory usage
- **Accuracy vs. Performance**: Simplified collision for waypoint connections

This waypoint system provides the foundation for all NPC navigation in SCP: Containment Breach, enabling everything from simple patrol routes to complex SCP containment behaviors and coordinated MTF tactics.