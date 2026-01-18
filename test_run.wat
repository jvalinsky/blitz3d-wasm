; Test program that reads embedded data and prints to console
Function Main()
    Local message$
    Local number%
    Local price#
    
    ; Read embedded data
    Data "Hello from WASM!", 42, 3.14159
    Read message$, number%, price#
    
    ; Print to console (will appear in browser console)
    Print message$
    Print number%
    Print price#
    
    ; Also use graphics to have a visible window
    Graphics3D 640, 480, 32, 0
    
    ; Create a simple visual
    Local cube = CreateCube()
    PositionEntity cube, 0, 0, 5
    
    Print "Test complete - check console for output"
End Function
