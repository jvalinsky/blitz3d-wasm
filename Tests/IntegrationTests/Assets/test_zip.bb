path = "test.zip"
zip = ZlibWapi_Open(path)
If zip <> 0 Then
    Print "Zip opened: " + path
    count = ZlibWapi_GetFileCount(zip)
    Print "Files: " + count
    For i = 0 To count - 1
        name = ZlibWapi_GetFileName(zip, i)
        Print "File " + i + ": " + name
        If name = "hello.txt" Then
            success = ZlibWapi_ExtractFile(zip, i, "extracted.txt")
            Print "Extract success: " + success
        EndIf
    Next
    ZlibWapi_Close(zip)
    
    ; Verify extraction
    file = ReadFile("extracted.txt")
    If file <> 0 Then
        content = ReadString(file)
        Print "Content: " + content
        CloseFile(file)
    Else
        Print "Failed to read extracted file"
    EndIf
Else
    Print "Failed to open zip"
EndIf
