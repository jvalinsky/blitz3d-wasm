Function Test()
    Local a# = 0
    Local x = 1
    Local age = 5
    Local max_time = 10
    Local alpha# = 1.0
    
    ; This is the pattern from DevilParticleSystem line 402
    If x Then a# = (1 - Float(age) / Float(max_time)) * alpha# Else a# = alpha#
    
    Print a#
End Function

Function Float#(x)
    Return x
End Function
