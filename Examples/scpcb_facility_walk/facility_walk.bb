; SCP:CB Facility Walk Demo
; Movement and door logic running in WASM with JS shims for rendering

; Collision type constants (from SCP:CB)
Const HIT_MAP% = 1
Const HIT_PLAYER% = 2

; Movement constants
Const WALK_SPEED# = 0.018
Const SPRINT_MULTIPLIER# = 2.5
Const GRAVITY# = 0.006
Const JUMP_FORCE# = 0.08
Const MAX_FALL_SPEED# = 2.0

; Player state
Global player%
Global cam%
Global Collider%
Global lastMillis%
Global FPSfactor# = 1.0

; Movement state
Global DropSpeed# = 0.0
Global CurrSpeed# = 0.0
Global Grounded% = False
Global CanJump% = True

; Door system (simplified from SCP:CB)
Type Doors
    Field obj%          ; Door mesh entity (JS-side)
    Field obj2%         ; Second door panel (for double doors)
    Field x#, y#, z#    ; Position
    Field angle#        ; Y rotation
    Field open%         ; Is door open?
    Field openstate#    ; Animation progress 0-180
    Field locked%       ; Is door locked?
    Field dir%          ; Door type: 0=normal, 1=double
End Type

Global ClosestDoor.Doors
Global DoorInteractDist# = 1.5

; External JS functions for doors
Function DoorCreate%(x#, y#, z#, angle#)
End Function

Function DoorSetOpenState(id%, openstate#, open%)
End Function

Function DoorGetDistance#(id%)
End Function

; ============ INITIALIZATION ============

Function InitCollision()
    Collider = player
    EntityRadius Collider, 0.15, 0.30
    EntityType Collider, HIT_PLAYER
    Collisions HIT_PLAYER, HIT_MAP, 2, 2
End Function

Function InitGame()
    player = CreatePivot()
    cam = CreateCamera(player)
    Collider = player
    lastMillis = MilliSecs()

    InitCollision()

    Print "Game initialized"
End Function

; ============ MOVEMENT SYSTEM ============

Function UpdateFPS()
    Local now% = MilliSecs()
    Local delta% = now - lastMillis
    If delta <= 0 Then delta = 1
    If delta > 100 Then delta = 100  ; Cap delta to prevent huge jumps
    FPSfactor = Float(delta) / 16.0
    lastMillis = now
End Function

Function MovePlayer()
    Local moveX# = 0.0
    Local moveZ# = 0.0
    Local speed# = WALK_SPEED
    Local angle#
    Local temp% = False

    ; Sprint check
    If KeyDown(42) Then  ; Left Shift
        speed = WALK_SPEED * SPRINT_MULTIPLIER
    End If

    ; Direction from WASD
    If KeyDown(17) Then  ; W
        temp = True
        angle = 0
        If KeyDown(30) Then angle = 45      ; W+A
        If KeyDown(32) Then angle = -45     ; W+D
    ElseIf KeyDown(31) Then  ; S
        temp = True
        angle = 180
        If KeyDown(30) Then angle = 135     ; S+A
        If KeyDown(32) Then angle = -135    ; S+D
    Else
        If KeyDown(30) Then angle = 90 : temp = True   ; A
        If KeyDown(32) Then angle = -90 : temp = True  ; D
    End If

    ; Apply movement
    If temp Then
        angle = EntityYaw(Collider, True) + angle + 90.0
        CurrSpeed = CurveValue(speed, CurrSpeed, 20.0)
    Else
        CurrSpeed = CurveValue(0.0, CurrSpeed, 10.0)
    End If

    ; Horizontal movement with collision
    If CurrSpeed > 0.001 Then
        TranslateEntity Collider, Cos(angle) * CurrSpeed * FPSfactor, 0, Sin(angle) * CurrSpeed * FPSfactor, True
    End If

    ; Floor detection using collision system
    Local i%
    Grounded = False
    For i = 1 To CountCollisions(Collider)
        If CollisionY(Collider, i) < EntityY(Collider) - 0.25 Then
            Grounded = True
        End If
    Next

    ; Jump
    If Grounded Then
        DropSpeed = 0
        CanJump = True

        If KeyHit(57) And CanJump Then  ; Space
            DropSpeed = JUMP_FORCE
            CanJump = False
            Grounded = False
        End If
    Else
        ; Apply gravity
        DropSpeed = DropSpeed - GRAVITY * FPSfactor
        If DropSpeed < -MAX_FALL_SPEED Then DropSpeed = -MAX_FALL_SPEED
    End If

    ; Vertical movement
    TranslateEntity Collider, 0, DropSpeed * FPSfactor, 0, True

    ; Re-check floor after vertical movement
    For i = 1 To CountCollisions(Collider)
        If CollisionY(Collider, i) < EntityY(Collider) - 0.25 Then
            Grounded = True
            If DropSpeed < 0 Then DropSpeed = 0
        End If
    Next
End Function

; ============ DOOR SYSTEM ============

Function CreateDoorEntity.Doors(x#, y#, z#, angle#, doorType% = 0)
    Local d.Doors = New Doors

    d\x = x
    d\y = y
    d\z = z
    d\angle = angle
    d\open = False
    d\openstate = 0
    d\locked = False
    d\dir = doorType

    ; Create door in JS
    d\obj = DoorCreate(x, y, z, angle)

    Return d
End Function

Function UpdateDoors()
    Local d.Doors
    Local playerX# = EntityX(Collider)
    Local playerZ# = EntityZ(Collider)
    Local dist#
    Local dx#, dz#

    ClosestDoor = Null
    Local closestDist# = DoorInteractDist

    For d = Each Doors
        ; Calculate distance to door
        dx = Abs(playerX - d\x)
        dz = Abs(playerZ - d\z)
        dist = Sqr(dx * dx + dz * dz)

        ; Track closest door for interaction
        If dist < closestDist And (d\openstate <= 0 Or d\openstate >= 180) Then
            closestDist = dist
            ClosestDoor = d
        End If

        ; Animate door opening/closing
        If d\open Then
            If d\openstate < 180 Then
                If d\dir = 0 Then  ; Normal door
                    d\openstate = d\openstate + FPSfactor * 3.0
                    If d\openstate > 180 Then d\openstate = 180
                ElseIf d\dir = 1 Then  ; Double door (slower)
                    d\openstate = d\openstate + FPSfactor * 1.5
                    If d\openstate > 180 Then d\openstate = 180
                End If
            End If
        Else
            If d\openstate > 0 Then
                If d\dir = 0 Then  ; Normal door
                    d\openstate = d\openstate - FPSfactor * 3.0
                    If d\openstate < 0 Then d\openstate = 0
                ElseIf d\dir = 1 Then  ; Double door
                    d\openstate = d\openstate - FPSfactor * 1.5
                    If d\openstate < 0 Then d\openstate = 0
                End If
            End If
        End If

        ; Update JS door state
        DoorSetOpenState d\obj, d\openstate, d\open
    Next
End Function

Function UseDoor(d.Doors)
    If d = Null Then Return
    If d\locked Then
        Print "Door is locked"
        Return
    End If

    ; Toggle door state
    d\open = Not d\open

    If d\open Then
        Print "Opening door"
    Else
        Print "Closing door"
    End If
End Function

Function CheckDoorInteraction()
    ; E key to interact with nearest door
    If KeyHit(18) Then  ; E key
        If ClosestDoor <> Null Then
            UseDoor(ClosestDoor)
        End If
    End If
End Function

; ============ UTILITY FUNCTIONS ============

Function CurveValue#(newvalue#, oldvalue#, increments#)
    If increments <= 0 Then Return newvalue
    Return oldvalue + (newvalue - oldvalue) / increments
End Function

; ============ MAIN UPDATE ============

Function UpdateGame()
    UpdateFPS()
    MovePlayer()
    UpdateDoors()
    CheckDoorInteraction()
End Function

; ============ ENTRY POINT ============

InitGame()
