# NPC AI & Path Tracking System
## Overview
The NPC system in SCP: Containment Breach relies on a state-machine architecture combined with A* pathfinding. Each NPC type (`Type NPCs`) has a distinct update loop handling state transitions, movement, and interaction with the world.
## Common Architecture
### The NPC Struct
The `NPCs` type (in `NPCs.bb`) holds state for all entities:
- `State`, `State2`, `State3`: Generic state variables (usage varies by NPC).
- `Path[20]`: Array of `WayPoints` for the current A* path.
- `PathStatus`: 0 (No path), 1 (Path found), 2 (Path failed).
- `Target`: Reference to another NPC or the Player.
- `EnemyX/Y/Z`: Last known position of the target.
### Pathfinding
The `FindPath(npc, x, y, z)` function (in `Update.bb` or `NPCs.bb`) calculates a route using the pre-placed `WayPoints` node graph.
- **Nodes:** `WayPoints` entities placed in Room meshes (`.rmesh`).
- **Graph:** Connected at runtime based on room adjacency.
- **Algorithm:** A* (A-Star) search.
- **Output:** Fills `n\Path[]` with a sequence of Waypoints.
---
## Specific NPC AI
### 1. SCP-173 (The Statue)
*The concrete sculpture that moves only when unseen.*
*   **Logic Location:** `UpdateNPCs` -> `Case NPCtype173`
*   **Movement Condition:**
    *   `BlinkTimer` < 0 (Player blinking) OR
    *   ! `EntityInView` (Player looking away) OR
    *   Line of Sight blocked (`EntityVisible` check).
*   **Behavior:**
    *   **Idle:** Stays still if observed.
    *   **Hunt:** Moves directly towards player (`TranslateEntity`).
    *   **Teleport:** If > 6 rooms away, teleports to a random waypoint near the player to maintain pressure.
    *   **Interaction:** Opens doors if blocked.
    *   **Kill:** If `dist < 0.65`, instakills player (Neck Snap).
### 2. SCP-106 (The Old Man)
*The decaying humanoid that walks through walls.*
*   **Logic Location:** `UpdateNPCs` -> `Case NPCtypeOldMan`
*   **Movement Modes:**
    *   **Walking:** Follows path like standard NPC.
    *   **Phasing:** If `dist > 40` or in Pocket Dimension, sinks into floor/wall and moves directly to player (NoClip).
*   **State Machine:**
    *   `State > 0`: Idle / Waiting to spawn.
    *   `State <= 0`: Active / Hunting.
*   **Attack:**
    *   On hit, sends player to **Pocket Dimension**.
    *   Uses `TeleportCloser` if stuck or far away.
### 3. SCP-096 (The Shy Guy)
*The pale humanoid that enrages if its face is viewed.*
*   **Logic Location:** `UpdateNPCs` -> `Case NPCtype096`
*   **Trigger Mechanism:**
    *   Uses `CameraProject` to check if face is on screen.
    *   Checks raycast (`EntityVisible`) to confirm LOS.
*   **States:**
    *   `0`: **Sitting/Idle**. Sobbing.
    *   `1-3`: **Enraging**. Gets up, screams, plays panic animation.
    *   `4`: **Chasing**. Runs at high speed towards player or last known location. Destroys doors.
    *   `5`: **Wandering**. Post-rage cooldown.
*   **AI:**
    *   Predicts player movement.
    *   Speed increases with distance.
    *   Instakills on contact during Rage.
### 4. SCP-049 (The Plague Doctor)
*The doctor who "cures" victims.*
*   **Logic Location:** `UpdateNPCs` -> `Case NPCtype049`
*   **States:**
    *   `1`: Looking around.
    *   `2`: Active Hunting.
    *   `3`: Killing Player (Touch).
*   **Behavior:**
    *   Uses A* (`FindPath`) extensively.
    *   **Door Etiquette:** Opens doors in front, *closes* doors behind (unique behavior).
    *   **Tactics:** Teleports to adjacent rooms to cut off player ("flanking").
    *   **Effect:** Turns player into SCP-049-2 (Zombie) on death.
### 5. MTF (Mobile Task Force)
*Armed guards working in squads.*
*   **Logic Location:** `UpdateMTFUnit()`
*   **Squad AI:**
    *   **Leader:** Picks destination (`FindPath`).
    *   **Followers:** Pathfind to Leader's position.
*   **States:**
    *   `0`: **Patrol**. Wanders or moves to SCP containment chambers (e.g., 173's cage).
    *   `1`: **Combat**. Shoots at player. Uses cover (crouch).
    *   `2`: **Containment**. Spotted SCP-173. Backs away while staring.
    *   `4`: **Avoidance**. Spotted 106/049. Flees.
*   **Tactics:**
    *   Reloads weapon (`Reload` timer).
    *   Communicates via radio (plays audio cues for "Target Lost", "Contact", etc.).
    *   Can re-contain SCP-173 if they reach its chamber.
---
## Pathfinding Details
### Waypoint System
*   **Grid:** Not a tile grid, but a node graph.
*   **Placement:** Waypoints are entities in the `.rmesh` files.
*   **Connections:** Runtime script (`CreateWayPoints`) connects nodes within visible range (LOS check).
### The Algorithm (A*)
1.  **Start:** Nearest visible waypoint to NPC.
2.  **End:** Nearest visible waypoint to Target.
3.  **Heuristic:** Euclidian distance.
4.  **Result:** Populates `n\Path[]` with the sequence of nodes.
5.  **Execution:** NPC rotates towards `n\Path[0]`, moves forward. When close (`dist < 0.5`), pops node and proceeds to next.
### Teleportation System
To prevent getting stuck or falling behind:
*   **TeleportCloser(npc):** If NPC is > N rooms away, moves them to a random waypoint in an adjacent room to the player (out of sight).
*   **Elevators:** NPCs can "use" elevators by teleporting between connected elevator floors.