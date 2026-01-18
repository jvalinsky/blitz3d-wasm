; test_project/src/main.bb
; Main program

Include "utils.bb"

; Setup graphics
Graphics3D 800, 600, 32, 0

; Create camera
camera = CreateCamera()

; Print from included file
msg$ = PrintHello()
Print msg$

; Test math function
result% = AddInts(5, 3)
Print "5 + 3 = " + result%

; Main loop
While Not KeyDown(1) ; ESC key
    Cls
    Flip
Wend
