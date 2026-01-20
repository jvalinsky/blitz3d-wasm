; Walking Simulator Logic (Frame Update)
Global player
Global cam
Global vel_y# = 0
Global gravity# = -0.015
Global speed# = 0.08
Global run_speed# = 0.16
Global jump_strength# = 0.15
Global on_ground = 0

Function InitGame()
    player = CreatePivot()
    PositionEntity player, 0, 1, 0
    
    cam = CreateCamera(player)
    PositionEntity cam, 0, 0.8, 0
End Function

Function UpdateGame()
    move_x# = 0
    move_z# = 0
    
    ; W/Up
    If KeyDown(17) Or KeyDown(200) Then move_z = 1
    ; S/Down
    If KeyDown(31) Or KeyDown(208) Then move_z = -1
    ; A/Left
    If KeyDown(30) Or KeyDown(203) Then move_x = -1
    ; D/Right
    If KeyDown(32) Or KeyDown(205) Then move_x = 1
    
    current_speed# = speed
    If KeyDown(42) Or KeyDown(54) Then current_speed = run_speed ; Shift keys
    
    ; Relative movement
    MoveEntity player, move_x * current_speed, 0, move_z * current_speed
    
    ; Jump
    If KeyHit(57) And on_ground Then ; Space
        vel_y = jump_strength
        on_ground = 0
    EndIf
    
    ; Global Gravity
    vel_y = vel_y + gravity
    TranslateEntity player, 0, vel_y, 0
    
    ; Simplified ground check for BB (JS handles high-fidelity snapping)
    If EntityY(player) < 0 Then
        PositionEntity player, EntityX(player), 0, EntityZ(player)
        vel_y = 0
        on_ground = 1
    EndIf
End Function

InitGame()
