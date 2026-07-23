# File Format Loaders Documentation

## Overview

File format loaders handle the loading and management of all game assets
including 3D models, textures, audio files, and game data, providing the
infrastructure for content management.

## Mesh Loaders

### Purpose

Mesh loaders import 3D model data from various formats, enabling the use of
complex geometry in the game world.

### Supported Formats

#### B3D Format (Blitz3D Native)

```blitzbasic
Function LoadB3D(file$)
    file = ReadFile(file + ".b3d")
    
    ; Read B3D header
    version% = ReadInt(file)
    If version <> B3D_VERSION Then Return 0
    
    ; Read texture count
    texCount% = ReadInt(file)
    For i = 1 To texCount
        texName$ = ReadString(file)
        textures[i] = LoadTexture(texName)
    Next
    
    ; Read brush count
    brushCount% = ReadInt(file)
    For i = 1 To brushCount
        ; Read brush properties
        name$ = ReadString(file)
        colorR# = ReadFloat(file)
        colorG# = ReadFloat(file)
        colorB# = ReadFloat(file)
        alpha# = ReadFloat(file)
        shininess# = ReadFloat(file)
        blend% = ReadInt(file)
        fx% = ReadInt(file)
        
        brushes[i] = CreateBrush()
        BrushColor brushes[i], colorR * 255, colorG * 255, colorB * 255
        BrushAlpha brushes[i], alpha
        BrushShininess brushes[i], shininess
    Next
    
    ; Read node hierarchy
    rootNode% = ReadB3DNode(file)
    
    CloseFile(file)
    Return rootNode
End Function

Function ReadB3DNode(file)
    nodeType$ = ReadString(file)
    
    Select nodeType
        Case "NODE"
            node% = CreatePivot()
            
        Case "MESH"
            mesh% = CreateMesh()
            ; Read mesh data...
            
        Case "BONE"
            bone% = CreatePivot()
            ; Read bone data...
    End Select
    
    Return node
End Function
```

#### X Format (DirectX)

```blitzbasic
Function LoadX(file$)
    file = ReadFile(file + ".x")
    
    ; Parse X file format
    While Not Eof(file)
        line$ = ReadLine(file)
        line = Trim(line)
        
        If Left(line, 6) = "Mesh {" Then
            mesh% = ParseXMesh(file)
        ElseIf Left(line, 8) = "Material" Then
            material% = ParseXMaterial(file)
        ElseIf Left(line, 9) = "Animation" Then
            animation% = ParseXAnimation(file)
        EndIf
    Wend
    
    CloseFile(file)
    Return mesh
End Function
```

#### RMesh Format (Custom Room Format)

```blitzbasic
Type RMeshHeader
    Field Version%             ; File version
    Field VertexCount%         ; Number of vertices
    Field TriangleCount%       ; Number of triangles
    Field TextureCount%        ; Number of textures
End Type

Function LoadRMesh(file$)
    file = ReadFile(file + ".rmesh")
    
    ; Read header
    header.RMeshHeader = New RMeshHeader
    header\Version = ReadInt(file)
    header\VertexCount = ReadInt(file)
    header\TriangleCount = ReadInt(file)
    header\TextureCount = ReadInt(file)
    
    ; Read vertices
    For i = 1 To header\VertexCount
        x# = ReadFloat(file)
        y# = ReadFloat(file)
        z# = ReadFloat(file)
        nx# = ReadFloat(file)
        ny# = ReadFloat(file)
        nz# = ReadFloat(file)
        u# = ReadFloat(file)
        v# = ReadFloat(file)
        
        AddVertex mesh, x, y, z, u, v
        VertexNormal mesh, i-1, nx, ny, nz
    Next
    
    ; Read triangles
    For i = 1 To header\TriangleCount
        v0% = ReadInt(file)
        v1% = ReadInt(file)
        v2% = ReadInt(file)
        
        AddTriangle mesh, v0, v1, v2
    Next
    
    ; Read textures
    For i = 1 To header\TextureCount
        texName$ = ReadString(file)
        tex% = LoadTexture(texName)
        EntityTexture mesh, tex, i-1
    Next
    
    ; Read entities
    entityCount% = ReadInt(file)
    For i = 1 To entityCount
        ParseRoomEntity(file)
    Next
    
    CloseFile(file)
    Return mesh
End Function

Function ParseRoomEntity(file)
    entityType$ = ReadString(file)
    
    Select entityType
        Case "waypoint"
            nextWP$ = ReadString(file)
            CreateWaypointAt(ReadFloat(file), ReadFloat(file), ReadFloat(file))
            
        Case "light"
            CreateLightAt(ReadFloat(file), ReadFloat(file), ReadFloat(file))
            
        Case "sound"
            CreateSoundEmitterAt(ReadFloat(file), ReadFloat(file), ReadFloat(file))
            
        Case "model"
            modelName$ = ReadString(file)
            LoadModelAt(modelName, ReadFloat(file), ReadFloat(file), ReadFloat(file))
    End Select
End Function
```

## Texture Loaders

### Purpose

Texture loaders handle image loading and processing for surface materials and UI
elements.

### Supported Formats

```blitzbasic
Function LoadTexture(file$, flags% = 1)
    ; Determine format from extension
    ext$ = Lower(Right(file, 4))
    
    Select ext
        Case ".png"
            Return LoadPNG(file, flags)
        Case ".jpg", ".jpeg"
            Return LoadJPEG(file, flags)
        Case ".dds"
            Return LoadDDS(file, flags)
        Case ".bmp"
            Return LoadBMP(file, flags)
        Default
            Return LoadPNG(file, flags)  ; Default to PNG
    End Select
End Function

Function LoadPNG(file$, flags%)
    ; Use WebGL texture loading
    texture% = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture)
    
    ; Load image asynchronously
    img = new Image()
    img.onload = function() {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
        gl.generateMipmap(gl.TEXTURE_2D)
    }
    img.src = file
    
    Return texture
End Function

Function LoadDDS(file$, flags%)
    ; DirectX DDS format loading
    file = ReadFile(file)
    
    ; Read DDS header
    magic% = ReadInt(file)  ; "DDS "
    header.DDSHeader = ReadDDSHeader(file)
    
    ; Create texture based on format
    If header\Format = DDS_DXT1 Then
        ; Compressed texture
        texture% = CreateCompressedTexture(header\Width, header\Height, gl.COMPRESSED_RGB_S3TC_DXT1_EXT)
    EndIf
    
    ; Read texture data
    dataSize% = header\PitchOrLinearSize
    textureData = CreateBank(dataSize)
    ReadBytes textureData, file, 0, dataSize
    
    ; Upload to GPU
    gl.compressedTexImage2D(gl.TEXTURE_2D, 0, format, header\Width, header\Height, 0, textureData)
    
    CloseFile(file)
    Return texture
End Function
```

## Audio Loaders

### Purpose

Audio loaders handle sound file loading and streaming for music and sound
effects.

### Supported Formats

```blitzbasic
Function LoadSound(file$)
    ; Determine format
    ext$ = Lower(Right(file, 4))
    
    Select ext
        Case ".wav"
            Return LoadWAV(file)
        Case ".ogg"
            Return LoadOGG(file)
        Case ".mp3"
            Return LoadMP3(file)
        Default
            Return LoadWAV(file)
    End Select
End Function

Function LoadWAV(file$)
    file = ReadFile(file)
    
    ; Read WAV header
    chunkID$ = ReadString(file, 4)      ; "RIFF"
    chunkSize% = ReadInt(file)
    format$ = ReadString(file, 4)       ; "WAVE"
    
    ; Read format chunk
    subchunk1ID$ = ReadString(file, 4)  ; "fmt "
    subchunk1Size% = ReadInt(file)
    audioFormat% = ReadShort(file)
    numChannels% = ReadShort(file)
    sampleRate% = ReadInt(file)
    byteRate% = ReadInt(file)
    blockAlign% = ReadShort(file)
    bitsPerSample% = ReadShort(file)
    
    ; Read data chunk
    subchunk2ID$ = ReadString(file, 4)  ; "data"
    subchunk2Size% = ReadInt(file)
    
    ; Create audio buffer
    audioBuffer = audioContext.createBuffer(numChannels, subchunk2Size / (bitsPerSample / 8), sampleRate)
    
    ; Read audio data
    For channel = 0 To numChannels - 1
        data = audioBuffer.getChannelData(channel)
        For i = 0 To data.length - 1
            If bitsPerSample = 16 Then
                data[i] = ReadShort(file) / 32768.0
            Else
                data[i] = ReadByte(file) / 128.0
            EndIf
        Next
    Next
    
    CloseFile(file)
    Return audioBuffer
End Function

Function LoadOGG(file$)
    ; Use Web Audio API for OGG decoding
    fetch(file).then(response => response.arrayBuffer()).then(arrayBuffer => {
        return audioContext.decodeAudioData(arrayBuffer)
    }).then(audioBuffer => {
        return audioBuffer
    })
End Function
```

## Archive Systems

### Purpose

Archive systems provide compressed asset storage and streaming capabilities.

### ZIP Archive Support

```blitzbasic
Type ZipArchive
    Field FileName$            ; Archive file path
    Field FileCount%           ; Number of files
    Field Files.ZipFile[1000]  ; File entries
    Field CentralDirOffset%    ; Central directory offset
End Type

Type ZipFile
    Field FileName$            ; Internal file name
    Field Offset%              ; File data offset
    Field Size%                ; Uncompressed size
    Field CompressedSize%      ; Compressed size
    Field Compression%         ; Compression method
    Field CRC32%               ; Checksum
End Type

Function OpenZipArchive(file$)
    archive.ZipArchive = New ZipArchive
    archive\FileName = file
    
    zipFile = ReadFile(file)
    
    ; Find end of central directory
    fileSize% = FileSize(file)
    For i = fileSize - 22 To fileSize - 1
        SeekFile zipFile, i
        signature% = ReadInt(zipFile)
        If signature = &H06054B50 Then  ; End of central directory signature
            Exit
        EndIf
    Next
    
    ; Read central directory
    diskNumber% = ReadShort(zipFile)
    diskWithCD% = ReadShort(zipFile)
    numEntries% = ReadShort(zipFile)
    totalEntries% = ReadShort(zipFile)
    centralDirSize% = ReadInt(zipFile)
    centralDirOffset% = ReadInt(zipFile)
    
    archive\FileCount = numEntries
    
    ; Read file entries
    SeekFile zipFile, centralDirOffset
    For i = 1 To numEntries
        ; Read central directory file header
        signature% = ReadInt(zipFile)
        versionMadeBy% = ReadShort(zipFile)
        versionNeeded% = ReadShort(zipFile)
        generalPurpose% = ReadShort(zipFile)
        compression% = ReadShort(zipFile)
        lastModTime% = ReadShort(zipFile)
        lastModDate% = ReadShort(zipFile)
        crc32% = ReadInt(zipFile)
        compressedSize% = ReadInt(zipFile)
        uncompressedSize% = ReadInt(zipFile)
        fileNameLength% = ReadShort(zipFile)
        extraFieldLength% = ReadShort(zipFile)
        fileCommentLength% = ReadShort(zipFile)
        diskNumberStart% = ReadShort(zipFile)
        internalFileAttr% = ReadShort(zipFile)
        externalFileAttr% = ReadInt(zipFile)
        relativeOffset% = ReadInt(zipFile)
        
        ; Read filename
        fileName$ = ""
        For j = 1 To fileNameLength
            fileName = fileName + Chr(ReadByte(zipFile))
        Next
        
        ; Skip extra field and comment
        SeekFile zipFile, FilePos(zipFile) + extraFieldLength + fileCommentLength
        
        ; Create file entry
        fileEntry.ZipFile = New ZipFile
        fileEntry\FileName = fileName
        fileEntry\Offset = relativeOffset
        fileEntry\Size = uncompressedSize
        fileEntry\CompressedSize = compressedSize
        fileEntry\Compression = compression
        fileEntry\CRC32 = crc32
        
        archive\Files[i-1] = fileEntry
    Next
    
    CloseFile(zipFile)
    Return archive
End Function

Function ReadZipFile(archive.ZipArchive, fileName$)
    ; Find file in archive
    For fileEntry.ZipFile = Each archive\Files
        If fileEntry\FileName = fileName Then
            ; Seek to file data
            zipFile = ReadFile(archive\FileName)
            SeekFile zipFile, fileEntry\Offset
            
            ; Read local file header
            signature% = ReadInt(zipFile)
            version% = ReadShort(zipFile)
            generalPurpose% = ReadShort(zipFile)
            compression% = ReadShort(zipFile)
            lastModTime% = ReadShort(zipFile)
            lastModDate% = ReadShort(zipFile)
            crc32% = ReadInt(zipFile)
            compressedSize% = ReadInt(zipFile)
            uncompressedSize% = ReadInt(zipFile)
            fileNameLength% = ReadShort(zipFile)
            extraFieldLength% = ReadShort(zipFile)
            
            ; Skip filename and extra field
            SeekFile zipFile, FilePos(zipFile) + fileNameLength + extraFieldLength
            
            ; Read compressed data
            compressedData = CreateBank(compressedSize)
            ReadBytes compressedData, zipFile, 0, compressedSize
            
            ; Decompress if needed
            If compression = 8 Then  ; Deflate
                uncompressedData = DecompressDeflate(compressedData, uncompressedSize)
            Else
                uncompressedData = compressedData
            EndIf
            
            CloseFile(zipFile)
            Return uncompressedData
        EndIf
    Next
    
    Return Null
End Function
```

## Asset Management

### Asset Caching System

```blitzbasic
Type AssetCache
    Field Assets%[1000]        ; Cached asset handles
    Field AssetNames$[1000]    ; Asset names
    Field AssetTypes%[1000]    ; Asset types
    Field LastUsed%[1000]      ; Last access time
    Field CacheSize%           ; Current cache size
End Type

Function LoadAsset(assetName$, assetType%)
    ; Check cache first
    cachedIndex% = FindInCache(assetName)
    If cachedIndex >= 0 Then
        cache\LastUsed[cachedIndex] = MilliSecs()
        Return cache\Assets[cachedIndex]
    EndIf
    
    ; Load asset based on type
    Select assetType
        Case ASSET_TEXTURE
            asset% = LoadTexture(assetName)
        Case ASSET_SOUND
            asset% = LoadSound(assetName)
        Case ASSET_MESH
            asset% = LoadMesh(assetName)
    End Select
    
    ; Add to cache
    If asset <> 0 Then
        AddToCache(assetName, asset, assetType)
    EndIf
    
    Return asset
End Function

Function ManageCache()
    ; Remove least recently used assets if cache is full
    If cache\CacheSize > MAX_CACHE_SIZE Then
        ; Find oldest asset
        oldestTime% = MilliSecs()
        oldestIndex% = -1
        
        For i = 0 To 999
            If cache\Assets[i] <> 0 And cache\LastUsed[i] < oldestTime Then
                oldestTime = cache\LastUsed[i]
                oldestIndex = i
            EndIf
        Next
        
        ; Remove oldest asset
        If oldestIndex >= 0 Then
            FreeAsset(cache\Assets[oldestIndex], cache\AssetTypes[oldestIndex])
            cache\Assets[oldestIndex] = 0
            cache\AssetNames[oldestIndex] = ""
            cache\CacheSize = cache\CacheSize - 1
        EndIf
    EndIf
End Function
```

### Streaming System

```blitzbasic
Type StreamingAsset
    Field AssetName$           ; Asset identifier
    Field AssetType%           ; Asset type
    Field Priority%            ; Loading priority
    Field Status%              ; Loading status
    Field Data                 ; Asset data when loaded
    Field Callbacks$           ; Completion callbacks
End Type

Function RequestAsset(assetName$, assetType%, priority%, callback$)
    stream.StreamingAsset = New StreamingAsset
    stream\AssetName = assetName
    stream\AssetType = assetType
    stream\Priority = priority
    stream\Status = STREAM_REQUESTED
    stream\Callbacks = callback
    
    ; Add to streaming queue
    AddToStreamingQueue(stream)
End Function

Function UpdateStreaming()
    ; Process streaming queue by priority
    For stream.StreamingAsset = Each StreamingAsset
        If stream\Status = STREAM_REQUESTED Then
            stream\Status = STREAM_LOADING
            
            ; Start async loading
            LoadAssetAsync(stream\AssetName, stream\AssetType, stream)
        EndIf
    Next
End Function
```

## Integration Points

- **[Rendering System](CORE_SYSTEMS.md#rendering-system)**: Mesh and texture
  loading
- **[Audio System](CORE_SYSTEMS.md#audio-system)**: Sound file loading
- **[State Management Systems](STATE_MANAGEMENT_SYSTEMS.md)**: Asset state
  persistence
- **[Archive Systems](#archive-systems)**: Compressed asset storage

---

_File format loaders provide the foundation for asset management in SCP:
Containment Breach, handling diverse formats and providing efficient loading and
caching systems._
