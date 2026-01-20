Function UpdateTest()
    Local e% = 1
    Local tex% = 2
    Local frame% = 3
    
    If e Then EntityTexture e, tex, frame
End Function

Function Main()
    UpdateTest()
End Function
