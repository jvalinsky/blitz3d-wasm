; Input Test Program for Blitz3D WASM
; Tests KeyDown, KeyHit, MouseX, MouseY, MouseDown, MouseHit

Graphics3D 800, 600, 32, 0
ClsColor 0, 0, 0

Print "=== Input Function Test ==="
Print "Press ESC to exit"
Print "Press W to test KeyDown"
Print "Press Space to test KeyHit"
Print "Move mouse to test MouseX/Y"
Print "Click mouse to test MouseDown/Hit"

Local exit% = 0
Local lastMouseDown% = 0

While Not exit%
    Cls
    
    ; Test KeyDown (ESC = key 27)
    If KeyDown(27) Then
        exit% = 1
        Print "ESC pressed - exiting"
    EndIf
    
    ; Test KeyDown (W = key 87)
    If KeyDown(87) Then
        Print "KeyDown: W is pressed"
    EndIf
    
    ; Test KeyHit (Space = key 32)
    If KeyHit(32) Then
        Print "KeyHit: Space was just pressed"
    EndIf
    
    ; Test Mouse position
    Local mx% = MouseX()
    Local my% = MouseY()
    
    ; Display mouse position
    Text 10, 30, "MouseX: " + Str(mx%)
    Text 10, 50, "MouseY: " + Str(my%)
    
    ; Test MouseDown (Left button = 1)
    If MouseDown(1) Then
        Text 10, 70, "Left mouse button is HELD"
    EndIf
    
    ; Test MouseHit
    If MouseHit(1) Then
        Print "MouseHit: Left button clicked at (" + Str(mx%) + ", " + Str(my%) + ")"
    EndIf
    
    Flip
Wend

Print "Test complete - closing"
End
