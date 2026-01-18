Print "Initializing Audio..."
success = FSOUND_Init(44100, 32, 0)
Print "Init Result: " + success

If success Then
    Print "Loading stream 'test_sound.wav'..."
    stream = FSOUND_Stream_Open("test_sound.wav", 0, 0, 0)
    
    If stream <> 0 Then
        Print "Stream Loaded! Handle: " + stream
        
        chn = FSOUND_Stream_Play(0, stream)
        Print "Playing on channel: " + chn
        
        ; Change volume
        FSOUND_SetVolume(chn, 128)
        Print "Volume set to 50%"
        
    Else
        Print "Failed to load stream"
    EndIf
Else
    Print "Failed to init audio"
EndIf
