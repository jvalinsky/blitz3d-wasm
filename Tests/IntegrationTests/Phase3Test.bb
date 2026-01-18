; Phase 3 Integration Test
; Tests Virtual File System, ZIP extraction, and Audio stubs

Print "Starting Phase 3 Test..."

; 1. Test FileType
Print "Testing FileType..."
If FileType("Assets") = 2 Then
    Print "SUCCESS: Assets is a directory"
Else
    Print "FAILED: Assets directory not found"
EndIf

; 2. Test ZIP Extraction (ZlibWapi)
Print "Testing ZlibWapi..."
zip = ZlibWapi_Open("Assets/test.zip")
If zip <> 0 Then
    Print "SUCCESS: Opened Assets/test.zip"
    count = ZlibWapi_GetFileCount(zip)
    Print "Files in ZIP: " + count
    
    If count > 0 Then
        name$ = ZlibWapi_GetFileName(zip, 0)
        Print "First file: " + name
        
        If ZlibWapi_ExtractFile(zip, 0, "Temp/extracted.txt") Then
            Print "SUCCESS: Extracted file to Temp/extracted.txt"
            
            ; 3. Test ReadFile on extracted file
            f = ReadFile("Temp/extracted.txt")
            If f <> 0 Then
                Print "SUCCESS: Read extracted file"
                CloseFile f
            Else
                Print "FAILED: Could not ReadFile extracted content"
            EndIf
        Else
            Print "FAILED: ZlibWapi_ExtractFile failed"
        EndIf
    EndIf
    ZlibWapi_Close(zip)
Else
    Print "FAILED: Could not open Assets/test.zip"
EndIf

; 4. Test FMOD stubs
Print "Testing FMOD..."
If FSOUND_Init(44100, 32, 0) Then
    Print "SUCCESS: FSOUND_Init"
    
    ; Note: Stream_Open will likely fail in verification unless we have a real mp3/wav
    stream = FSOUND_Stream_Open("Assets/test.mp3", 2, 0, 0)
    If stream <> 0 Then
        Print "SUCCESS: FSOUND_Stream_Open"
        FSOUND_Stream_Stop(stream)
    Else
        Print "INFO: FSOUND_Stream_Open failed (expected if Assets/test.mp3 missing)"
    EndIf
    
    FSOUND_Close()
Else
    Print "FAILED: FSOUND_Init failed"
EndIf

Print "Phase 3 Test Complete."
End
