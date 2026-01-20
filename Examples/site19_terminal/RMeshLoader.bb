; RMeshLoader.bb - RMesh Parser for WASM
; Designed to be called from JavaScript

; Main entry point - does nothing, as we call functions directly
End

; RMesh loading function
; Returns a Mesh Handle (ID)
Function LoadRMesh%(file$)
    PrintString "Initiating RMesh Load Sequence: " + file$
    
    Local f% = ReadFile(file$)
    If f = 0 Then
        PrintString "ERROR: File Access Denied: " + file$
        Return 0
    EndIf
    
    Local header$ = ReadString$(f)
    PrintString "Header Signature: " + header$
    
    ; Basic validation (using Len as workaround for string equality pointer issues)
    If Len(header$) = 0 Then
        PrintString "ERROR: Invalid Header Signature"
        CloseFile f
        Return 0
    EndIf
    
    Local textureCount% = ReadInt(f)
    PrintString "Texture Count: " + textureCount
    
    Local mainMesh% = CreateMesh()
    
    Local t%, v%, tri%
    ; Process each texture section
    For t = 1 To textureCount
        ; Create surface for this texture (moved up so we can assign textures to it)
        Local surf% = CreateSurface(mainMesh)
        
        ; Skip lightmap (1 byte flag + optional string)
        Local lightmapFlag% = ReadByte(f)
        Local lmPath$ = ReadString$(f)
        If lightmapFlag <> 0 Then
            SetSurfaceLightmap(surf, lmPath$)
        EndIf
        
        ; Skip texture (1 byte flag + optional string)
        Local textureFlag% = ReadByte(f)
        Local texPath$ = ReadString$(f)
        If textureFlag <> 0 Then
            PrintString "  Texture [" + t + "]: " + texPath$
            SetSurfaceTexture(surf, texPath$, textureFlag)
        EndIf
        
        ; Read vertices
        Local vertexCount% = ReadInt(f)
        ; PrintString "  Verts: " + vertexCount
        If vertexCount = 0 Then
            PrintString "  WARNING: Vertex count is 0!"
        EndIf
        
        For v = 1 To vertexCount
            Local x# = ReadFloat(f)
            Local y# = ReadFloat(f)
            Local z# = ReadFloat(f)
            Local u1# = ReadFloat(f)
            Local v1# = ReadFloat(f)
            Local u2# = ReadFloat(f)
            Local v2# = ReadFloat(f)
            Local r% = ReadByte(f)
            Local g% = ReadByte(f)
            Local b% = ReadByte(f)
            
            AddVertexExtended(surf, x, y, z, u1, v1, u2, v2, r, g, b)
        Next
        
        ; Read triangles
        Local triangleCount% = ReadInt(f)
        For tri = 1 To triangleCount
            Local v0% = ReadInt(f)
            Local v1% = ReadInt(f)
            Local v2% = ReadInt(f)
            AddTriangle(surf, v0, v1, v2)
        Next
    Next
    
    ; Parse collision meshes
    Local c%
    Local collisionCount% = ReadInt(f)
    PrintString "Collision Meshes: " + collisionCount
    
    For c = 1 To collisionCount
        Local collVertCount% = ReadInt(f)
        For v = 1 To collVertCount
            Local cx# = ReadFloat(f)
            Local cy# = ReadFloat(f)
            Local cz# = ReadFloat(f)
            AddCollisionVertex(cx, cy, cz)
        Next
        Local collTriCount% = ReadInt(f)
        For tri = 1 To collTriCount
            Local cv0% = ReadInt(f)
            Local cv1% = ReadInt(f)
            Local cv2% = ReadInt(f)
            AddCollisionTriangle(cv0, cv1, cv2)
        Next
    Next
    
    ; Skip trigger boxes if present
    ; "RoomMesh" len 8. "RoomMesh.HasTriggerBox" len 22.
    Local s%
    If Len(header$) > 10 Then
        Local triggerCount% = ReadInt(f)
        PrintString "Trigger Boxes: " + triggerCount
        For t = 1 To triggerCount
            Local surfaceCount% = ReadInt(f)
            For s = 1 To surfaceCount
                Local surfVertCount% = ReadInt(f)
                For v = 1 To surfVertCount
                    ReadFloat(f) ; x
                    ReadFloat(f) ; y
                    ReadFloat(f) ; z
                Next
                Local surfTriCount% = ReadInt(f)
                For tri = 1 To surfTriCount
                    ReadInt(f)
                    ReadInt(f)
                    ReadInt(f)
                Next
            Next
            Local triggerName$ = ReadString$(f)
        Next
    EndIf
    
    ; Parse entities
    Local e%
    Local entityCount% = ReadInt(f)
    PrintString "Entities Detected: " + entityCount
    
    For e = 1 To entityCount
        Local entityType$ = ReadString$(f)
        Local ex# = ReadFloat(f)
        Local ey# = ReadFloat(f)
        Local ez# = ReadFloat(f)
        
        AddEntity(entityType$, ex, ey, ez)
        
        ; Read entity data based on type
        If entityType$ = "screen" Then
            Local screenTex$ = ReadString$(f)
        ElseIf entityType$ = "light" Then
            ReadByte(f) ; r
            ReadByte(f) ; g
            ReadByte(f) ; b
            ReadFloat(f) ; range
        ElseIf entityType$ = "waypoint" Then
            Local nextWP$ = ReadString$(f)
        ElseIf entityType$ = "soundemitter" Then
            Local soundFile$ = ReadString$(f)
            ReadByte(f) ; loop
            ReadFloat(f) ; vol
        ElseIf entityType$ = "spotlight" Then
            ReadFloat(f) ; range
            Local color$ = ReadString$(f)
            ReadFloat(f) ; intensity
            Local angles$ = ReadString$(f)
            ReadInt(f) ; inner
            ReadInt(f) ; outer
        ElseIf entityType$ = "model" Then
            Local modelName$ = ReadString$(f)
            ReadFloat(f) ; pitch
            ReadFloat(f) ; yaw
            ReadFloat(f) ; roll
            ReadFloat(f) ; sx
            ReadFloat(f) ; sy
            ReadFloat(f) ; sz
        EndIf
    Next
    
    CloseFile f
    PrintString "RMesh Load Complete. Facility Map Initialized."
    
    Return mainMesh
End Function

; Runtime stubs
Function ReadFile%(path$)
End Function
Function ReadByte%(file%)
End Function
Function ReadInt%(file%)
End Function
Function ReadFloat#(file%)
End Function
Function ReadString$(file%)
End Function
Function CloseFile(file%)
End Function

Function SetSurfaceTexture(surf%, path$, flag%)
End Function

Function SetSurfaceLightmap(surf%, path$)
End Function

Function AddVertexExtended%(surf%, x#, y#, z#, u#, v#, u2#, v2#, r%, g%, b%)
End Function

Function AddCollisionVertex(x#, y#, z#)
End Function

Function AddCollisionTriangle(v0%, v1%, v2%)
End Function

Function AddEntity(type$, x#, y#, z#)
End Function

Function StringEqual%(s1$, s2$)
End Function
