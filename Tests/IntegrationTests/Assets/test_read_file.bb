; Test file that reads embedded text asset
; The runtime should provide a way to read embedded file content

Function Main()
    ; Read a text file - this will be provided by the runtime
    ; For testing, we use the Read statement with embedded data
    
    Local content$
    
    ; Test 1: Read embedded string data
    Data "Hello from embedded file!"
    Read content$
    Print content$
    
    ; Test 2: Read multiple values
    Local name$, count
    Data "TestFile.txt", 42
    Read name$, count
    Print name$
    Print count
    
    ; Exit after printing
    Print "Tests complete"
End Function
