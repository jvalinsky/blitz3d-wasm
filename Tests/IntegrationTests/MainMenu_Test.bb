; Phase 7 Integration Test: SCP:CB Style Main Menu

AppTitle "SCP: Containment Breach - WASM Port"
Graphics3D 800, 600, 0, 2
SetBuffer BackBuffer()

; Load background (mock)
; bg = LoadImage("Assets/menu_bg.png")

; Menu State
selected = 0
blink# = 0

While Not KeyHit(1)
    Cls
    
    ; Draw background
    Color 20, 20, 20
    Rect 0, 0, 800, 600, 1
    
    ; Title
    Color 200, 200, 200
    Text 400, 100, "SCP - CONTAINMENT BREACH", 1, 1
    
    ; Buttons
    mx = MouseX()
    my = MouseY()
    
    ; Button 1: Start New Game
    Color 50, 50, 50
    If mx > 300 And mx < 500 And my > 250 And my < 300
        Color 100, 100, 100
        If MouseHit(1) Then selected = 1
    EndIf
    Rect 300, 250, 200, 50, 1
    Color 255, 255, 255
    Text 400, 275, "START NEW GAME", 1, 1
    
    ; Button 2: Options
    Color 50, 50, 50
    If mx > 300 And mx < 500 And my > 320 And my < 370
        Color 100, 100, 100
        If MouseHit(1) Then selected = 2
    EndIf
    Rect 300, 320, 200, 50, 1
    Color 255, 255, 255
    Text 400, 345, "OPTIONS", 1, 1
    
    ; Button 3: Quit
    Color 50, 50, 50
    If mx > 300 And mx < 500 And my > 390 And my < 440
        Color 100, 100, 100
        If MouseHit(1) Then End
    EndIf
    Rect 300, 390, 200, 50, 1
    Color 255, 255, 255
    Text 400, 415, "QUIT", 1, 1
    
    ; Selected Message
    If selected > 0
        Color 255, 255, 0
        Text 400, 500, "Selected Option: " + selected, 1, 1
    EndIf
    
    ; Cursor
    Color 255, 0, 0
    Oval mx - 5, my - 5, 10, 10, 1
    
    Flip
Wend

End
