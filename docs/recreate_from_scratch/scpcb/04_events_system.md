# Events System (Room-Assigned Scripts)

Primary sources:
- `~/Software/scpcb/Main.bb` (defines `Type Events`, creates/initializes events)
- `~/Software/scpcb/UpdateEvents.bb` (`UpdateEvents()` implementation)

## Event Data Model

`Type Events` (in `Main.bb`) includes:

- `EventName$`
- `room.Rooms` (the room the event is bound to)
- multiple numeric state slots:
  - `EventState`, `EventState2`, `EventState3`
- optional string state:
  - `EventStr$`
- optional audio fields (`Sound*`, `SoundCHN*`, stream flags)
- optional image handle (`img%`)

This is effectively a lightweight “script instance” record.

## Assignment: `CreateEvent(...)` + `InitEvents()`

`CreateEvent(eventname, roomname, id, prob)` assigns an event to a room that
matches a room template name. It supports:

- “nth match” assignment via `id`
- probabilistic assignment via `prob`

`InitEvents()` hardcodes a list of event assignments (e.g. 173/start/alarm/etc).

## Update Dispatch Model

`UpdateEvents()` loops `For e.Events = Each Events` and uses:

- `Select e\EventName`

Each case is “bespoke logic” for that scenario, frequently interacting with:

- doors in the room (`e\room\RoomDoors[...]`)
- room objects (`e\room\Objects[...]`)
- spawned NPCs (`e\room\NPC[...]`)
- global state (`PlayerRoom`, difficulty, timers, etc.)

Porting implication:
- Events are a major source of “blocking loop” risk (some cases contain tight loops).
- Events drive content and progression; once the compiler can build `UpdateEvents.bb`
  successfully, you’re close to a playable port.

