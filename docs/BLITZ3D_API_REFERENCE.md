# Blitz3D Runtime API Reference

Source: https://github.com/blitz-research/blitz3d (official source release)

The Blitz3D runtime is organized into subsystems. Each function is documented with its signature where:
- `%` = integer parameter/return
- `#` = float parameter/return  
- `$` = string parameter/return
- `=value` = default parameter value

## System (bbruntime.cpp)

```
End
Stop
AppTitle$title$close_prompt=""
RuntimeError$message
ExecFile$command
Delay%millisecs
%MilliSecs
$CommandLine
$SystemProperty$property
$GetEnv$env_var
SetEnv$env_var$value
%CreateTimer%hertz
%WaitTimer%timer
FreeTimer%timer
DebugLog$text
```

## Math (bbmath.cpp)

```
#Sin#degrees
#Cos#degrees
#Tan#degrees
#ASin#float
#ACos#float
#ATan#float
#ATan2#floata#floatb
#Sqr#float
#Floor#float
#Ceil#float
#Exp#float
#Log#float
#Log10#float
#Rnd#from#to=0
%Rand%from%to=1
SeedRnd%seed
%RndSeed
```

## String (bbstring.cpp)

```
$String$string%repeat
$Left$string%count
$Right$string%count
$Replace$string$from$to
%Instr$string$find%from=1
$Mid$string%start%count=-1
$Upper$string
$Lower$string
$Trim$string
$LSet$string%size
$RSet$string%size
$Chr%ascii
%Asc$string
%Len$string
$Hex%value
$Bin%value
$CurrentDate
$CurrentTime
```

## Stream I/O (bbstream.cpp)

```
%Eof%stream
%ReadAvail%stream
%ReadByte%stream
%ReadShort%stream
%ReadInt%stream
#ReadFloat%stream
$ReadString%stream
$ReadLine%stream
WriteByte%stream%byte
WriteShort%stream%short
WriteInt%stream%int
WriteFloat%stream#float
WriteString%stream$string
WriteLine%stream$string
CopyStream%src_stream%dest_stream%buffer_size=16384
```

## File System (bbfilesystem.cpp)

```
%OpenFile$filename
%ReadFile$filename
%WriteFile$filename
CloseFile%file_stream
%FilePos%file_stream
%SeekFile%file_stream%pos
%ReadDir$dirname
CloseDir%dir
$NextFile%dir
$CurrentDir
ChangeDir$dir
CreateDir$dir
DeleteDir$dir
%FileSize$file
%FileType$file
CopyFile$file$to
DeleteFile$file
```

## Bank (bbbank.cpp)

```
%CreateBank%size=0
FreeBank%bank
%BankSize%bank
ResizeBank%bank%size
CopyBank%src_bank%src_offset%dest_bank%dest_offset%count
%PeekByte%bank%offset
%PeekShort%bank%offset
%PeekInt%bank%offset
#PeekFloat%bank%offset
PokeByte%bank%offset%value
PokeShort%bank%offset%value
PokeInt%bank%offset%value
PokeFloat%bank%offset#value
%ReadBytes%bank%file%offset%count
%WriteBytes%bank%file%offset%count
%CallDLL$dll_name$func_name%in_bank=0%out_bank=0
```

## Input (bbinput.cpp)

```
%KeyDown%key
%KeyHit%key
%GetKey
%WaitKey
FlushKeys
%MouseDown%button
%MouseHit%button
%GetMouse
%WaitMouse
%MouseX
%MouseY
%MouseZ
%MouseXSpeed
%MouseYSpeed
%MouseZSpeed
FlushMouse
MoveMouse%x%y
%JoyType%port=0
%JoyDown%button%port=0
%JoyHit%button%port=0
%GetJoy%port=0
%WaitJoy%port=0
#JoyX%port=0
#JoyY%port=0
#JoyZ%port=0
#JoyU%port=0
#JoyV%port=0
#JoyPitch%port=0
#JoyYaw%port=0
#JoyRoll%port=0
%JoyHat%port=0
#JoyXDir%port=0
#JoyYDir%port=0
#JoyZDir%port=0
#JoyUDir%port=0
#JoyVDir%port=0
FlushJoy
EnableDirectInput%enable
DirectInputEnabled
```

## Audio (bbaudio.cpp)

```
%LoadSound$filename
FreeSound%sound
LoopSound%sound
SoundPitch%sound%pitch
SoundVolume%sound#volume
SoundPan%sound#pan
%PlaySound%sound
%PlayMusic$midifile
%PlayCDTrack%track%mode=1
StopChannel%channel
PauseChannel%channel
ResumeChannel%channel
ChannelPitch%channel%pitch
ChannelVolume%channel#volume
ChannelPan%channel#pan
%ChannelPlaying%channel
%Load3DSound$filename
```

## Graphics 2D (bbgraphics.cpp)

```
%CountGfxDrivers
$GfxDriverName%driver
SetGfxDriver%driver
%CountGfxModes
%GfxModeExists%width%height%depth
%GfxModeWidth%mode
%GfxModeHeight%mode
%GfxModeDepth%mode
%AvailVidMem
%TotalVidMem
Graphics%width%height%depth=0%mode=0
Graphics3D%width%height%depth=0%mode=0
EndGraphics
%GraphicsLost
%FrontBuffer
%BackBuffer
%ScanLine
VWait%frames=1
Flip%vwait=1
%GraphicsWidth
%GraphicsHeight
%GraphicsDepth
SetBuffer%buffer
%GraphicsBuffer
LockBuffer%buffer=0
UnlockBuffer%buffer=0
%ReadPixel%x%y%buffer=0
WritePixel%x%y%argb%buffer=0
%ReadPixelFast%x%y%buffer=0
WritePixelFast%x%y%argb%buffer=0
%LockedPixels%buffer=0
%LockedPitch%buffer=0
%LockedFormat%buffer=0
Origin%x%y
Viewport%x%y%width%height
Color%red%green%blue
GetColor%x%y
%ColorRed
%ColorGreen
%ColorBlue
ClsColor%red%green%blue
Cls
Plot%x%y
Rect%x%y%width%height%solid=1
Oval%x%y%width%height%solid=1
Line%x%y%x2%y2
Text%x%y$text%center_x=0%center_y=0
%LoadFont$fontname%height=12%bold=0%italic=0%underline=0
FreeFont%font
SetFont%font
%FontWidth
%FontHeight
%StringWidth$string
%StringHeight$string
%LoadImage$bmpfile
%LoadAnimImage$bmpfile%cellwidth%cellheight%startcell%cellcount
%CopyImage%image
%CreateImage%width%height%frames=1
FreeImage%image
%SaveImage%image$bmpfile%frame=0
GrabImage%image%x%y%frame=0
%ImageBuffer%image%frame=0
DrawImage%image%x%y%frame=0
DrawBlock%image%x%y%frame=0
TileImage%image%x=0%y=0%frame=0
TileBlock%image%x=0%y=0%frame=0
DrawImageRect%image%x%y%rect_x%rect_y%rect_width%rect_height%frame=0
DrawBlockRect%image%x%y%rect_x%rect_y%rect_width%rect_height%frame=0
MaskImage%image%red%green%blue
HandleImage%image%x%y
MidHandle%image
AutoMidHandle%enable
%ImageWidth%image
%ImageHeight%image
%ImageXHandle%image
%ImageYHandle%image
ScaleImage%image#x_scale#y_scale
ResizeImage%image#width#height
RotateImage%image#angle
TFormImage%image#a#b#c#d
TFormFilter%enable
%ImagesOverlap%image1%x1%y1%image2%x2%y2
%ImagesCollide%image1%x1%y1%frame1%image2%x2%y2%frame2
%RectsOverlap%x1%y1%width1%height1%x2%y2%width2%height2
%ImageRectOverlap%image%x%y%rect_x%rect_y%rect_width%rect_height
%ImageRectCollide%image%x%y%frame%rect_x%rect_y%rect_width%rect_height
%CopyRect%source_x%source_y%width%height%dest_x%dest_y%source_buffer=0%dest_buffer=0
%LoadBuffer%buffer$bmpfile
%SaveBuffer%buffer$bmpfile
BufferDirty%buffer
```

## Graphics 3D (bbblitz3d.cpp)

### World/Rendering
```
LoaderMatrix$file_ext#xx#xy#xz#yx#yy#yz#zx#zy#zz
HWMultiTex%enable
%HWTexUnits
%GfxDriverCaps3D
WBuffer%enable
Dither%enable
AntiAlias%enable
WireFrame%enable
AmbientLight#red#green#blue
ClearCollisions
Collisions%source_type%destination_type%method%response
UpdateWorld#elapsed_time=1
CaptureWorld
RenderWorld#tween=1
ClearWorld%entities=1%brushes=1%textures=1
%ActiveTextures
%TrisRendered
#Stats3D%type
```

### Textures
```
%CreateTexture%width%height%flags=0%frames=1
%LoadTexture$file%flags=1
%LoadAnimTexture$file%flags%width%height%first%count
FreeTexture%texture
TextureBlend%texture%blend
TextureCoords%texture%coords
ScaleTexture%texture#u_scale#v_scale
RotateTexture%texture#angle
PositionTexture%texture#u_offset#v_offset
%TextureWidth%texture
%TextureHeight%texture
$TextureName%texture
SetCubeFace%texture%face
SetCubeMode%texture%mode
%TextureBuffer%texture%frame=0
ClearTextureFilters
TextureFilter$match_text%texture_flags=0
```

### Brushes
```
%CreateBrush#red=255#green=255#blue=255
%LoadBrush$file%texture_flags=1#u_scale=1#v_scale=1
FreeBrush%brush
BrushColor%brush#red#green#blue
BrushAlpha%brush#alpha
BrushShininess%brush#shininess
BrushTexture%brush%texture%frame=0%index=0
%GetBrushTexture%brush%index=0
BrushBlend%brush%blend
BrushFX%brush%fx
```

### Meshes
```
%LoadMesh$file%parent=0
%LoadAnimMesh$file%parent=0
%LoadAnimSeq%entity$file
%CreateMesh%parent=0
%CreateCube%parent=0
%CreateSphere%segments=8%parent=0
%CreateCylinder%segments=8%solid=1%parent=0
%CreateCone%segments=8%solid=1%parent=0
%CopyMesh%mesh%parent=0
ScaleMesh%mesh#x_scale#y_scale#z_scale
RotateMesh%mesh#pitch#yaw#roll
PositionMesh%mesh#x#y#z
FitMesh%mesh#x#y#z#width#height#depth%uniform=0
FlipMesh%mesh
PaintMesh%mesh%brush
AddMesh%source_mesh%dest_mesh
UpdateNormals%mesh
LightMesh%mesh#red#green#blue#range=0#x=0#y=0#z=0
#MeshWidth%mesh
#MeshHeight%mesh
#MeshDepth%mesh
%MeshesIntersect%mesh_a%mesh_b
%CountSurfaces%mesh
%GetSurface%mesh%surface_index
MeshCullBox%mesh#x#y#z#width#height#depth
```

### Surfaces
```
%CreateSurface%mesh%brush=0
%GetSurfaceBrush%surface
%GetEntityBrush%entity
%FindSurface%mesh%brush
ClearSurface%surface%clear_vertices=1%clear_triangles=1
PaintSurface%surface%brush
%AddVertex%surface#x#y#z#u=0#v=0#w=1
%AddTriangle%surface%v0%v1%v2
VertexCoords%surface%index#x#y#z
VertexNormal%surface%index#nx#ny#nz
VertexColor%surface%index#red#green#blue#alpha=1
VertexTexCoords%surface%index#u#v#w=1%coord_set=0
%CountVertices%surface
%CountTriangles%surface
#VertexX%surface%index
#VertexY%surface%index
#VertexZ%surface%index
#VertexNX%surface%index
#VertexNY%surface%index
#VertexNZ%surface%index
#VertexRed%surface%index
#VertexGreen%surface%index
#VertexBlue%surface%index
#VertexAlpha%surface%index
#VertexU%surface%index%coord_set=0
#VertexV%surface%index%coord_set=0
#VertexW%surface%index%coord_set=0
%TriangleVertex%surface%index%vertex
```

### Camera
```
%CreateCamera%parent=0
CameraZoom%camera#zoom
CameraRange%camera#near#far
CameraClsColor%camera#red#green#blue
CameraClsMode%camera%cls_color%cls_zbuffer
CameraProjMode%camera%mode
CameraViewport%camera%x%y%width%height
CameraFogColor%camera#red#green#blue
CameraFogRange%camera#near#far
CameraFogMode%camera%mode
CameraProject%camera#x#y#z
#ProjectedX
#ProjectedY
#ProjectedZ
```

### Picking
```
%EntityInView%entity%camera
%EntityVisible%src_entity%dest_entity
%EntityPick%entity#range
%LinePick#x#y#z#dx#dy#dz#radius=0
%CameraPick%camera#viewport_x#viewport_y
#PickedX
#PickedY
#PickedZ
#PickedNX
#PickedNY
#PickedNZ
#PickedTime
%PickedEntity
%PickedSurface
%PickedTriangle
```

### Lights
```
%CreateLight%type=1%parent=0
LightColor%light#red#green#blue
LightRange%light#range
LightConeAngles%light#inner_angle#outer_angle
```

### Sprites
```
%CreateSprite%parent=0
%LoadSprite$file%texture_flags=1%parent=0
RotateSprite%sprite#angle
ScaleSprite%sprite#x_scale#y_scale
HandleSprite%sprite#x_handle#y_handle
SpriteViewMode%sprite%view_mode
```

### Entity Transforms
```
%CopyEntity%entity%parent=0
#EntityX%entity%global=0
#EntityY%entity%global=0
#EntityZ%entity%global=0
#EntityPitch%entity%global=0
#EntityYaw%entity%global=0
#EntityRoll%entity%global=0
#GetMatElement%entity%row%column
TFormPoint#x#y#z%source_entity%dest_entity
TFormVector#x#y#z%source_entity%dest_entity
TFormNormal#x#y#z%source_entity%dest_entity
#TFormedX
#TFormedY
#TFormedZ
#VectorYaw#x#y#z
#VectorPitch#x#y#z
#DeltaPitch%src_entity%dest_entity
#DeltaYaw%src_entity%dest_entity
MoveEntity%entity#x#y#z
TurnEntity%entity#pitch#yaw#roll%global=0
TranslateEntity%entity#x#y#z%global=0
PositionEntity%entity#x#y#z%global=0
ScaleEntity%entity#x_scale#y_scale#z_scale%global=0
RotateEntity%entity#pitch#yaw#roll%global=0
PointEntity%entity%target#roll=0
AlignToVector%entity#vector_x#vector_y#vector_z%axis#rate=1
```

### Entity Collision
```
ResetEntity%entity
EntityType%entity%collision_type%recursive=0
EntityPickMode%entity%pick_geometry%obscurer=1
%GetParent%entity
%GetEntityType%entity
EntityRadius%entity#x_radius#y_radius=0
EntityBox%entity#x#y#z#width#height#depth
#EntityDistance%source_entity%destination_entity
%EntityCollided%entity%type
%CountCollisions%entity
#CollisionX%entity%collision_index
#CollisionY%entity%collision_index
#CollisionZ%entity%collision_index
#CollisionNX%entity%collision_index
#CollisionNY%entity%collision_index
#CollisionNZ%entity%collision_index
#CollisionTime%entity%collision_index
%CollisionEntity%entity%collision_index
%CollisionSurface%entity%collision_index
%CollisionTriangle%entity%collision_index
```

### Entity Animation
```
SetAnimTime%entity#time%anim_seq=0
Animate%entity%mode=1#speed=1%sequence=0#transition=0
SetAnimKey%entity%frame%pos_key=1%rot_key=1%scale_key=1
%AddAnimSeq%entity%length
%ExtractAnimSeq%entity%first_frame%last_frame%anim_seq=0
%AnimSeq%entity
#AnimTime%entity
%AnimLength%entity
%Animating%entity
```

### Entity Hierarchy
```
EntityParent%entity%parent%global=1
%CountChildren%entity
%GetChild%entity%index
%FindChild%entity$name
```

### Entity Appearance
```
PaintEntity%entity%brush
EntityColor%entity#red#green#blue
EntityAlpha%entity#alpha
EntityShininess%entity#shininess
EntityTexture%entity%texture%frame=0%index=0
EntityBlend%entity%blend
EntityFX%entity%fx
EntityAutoFade%entity#near#far
EntityOrder%entity%order
HideEntity%entity
ShowEntity%entity
FreeEntity%entity
NameEntity%entity$name
$EntityName%entity
$EntityClass%entity
```

### Other 3D
```
%CreatePivot%parent=0
%CreateMirror%parent=0
%CreatePlane%segments=1%parent=0
%CreateTerrain%grid_size%parent=0
%LoadTerrain$heightmap_file%parent=0
TerrainDetail%terrain%detail_level%morph=0
TerrainShading%terrain%enable
#TerrainX%terrain#world_x#world_y#world_z
#TerrainY%terrain#world_x#world_y#world_z
#TerrainZ%terrain#world_x#world_y#world_z
%TerrainSize%terrain
#TerrainHeight%terrain%terrain_x%terrain_z
ModifyTerrain%terrain%terrain_x%terrain_z#height%realtime=0
%CreateListener%parent#rolloff_factor=1#doppler_scale=1#distance_scale=1
%EmitSound%sound%entity
%LoadMD2$file%parent=0
AnimateMD2%md2%mode=1#speed=1%first_frame=0%last_frame=9999#transition=0
#MD2AnimTime%md2
%MD2AnimLength%md2
%MD2Animating%md2
%LoadBSP$file#gamma_adj=0%parent=0
BSPLighting%bsp%use_lightmaps
BSPAmbientLight%bsp#red#green#blue
```

## Sockets (bbsockets.cpp)

```
$DottedIP%IP
%CountHostIPs$host_name
%HostIP%host_index
%CreateUDPStream%port=0
CloseUDPStream%udp_stream
SendUDPMsg%udp_stream%dest_ip%dest_port=0
%RecvUDPMsg%udp_stream
%UDPStreamIP%udp_stream
%UDPStreamPort%udp_stream
%UDPMsgIP%udp_stream
%UDPMsgPort%udp_stream
UDPTimeouts%recv_timeout
%OpenTCPStream$server%server_port%local_port=0
CloseTCPStream%tcp_stream
%CreateTCPServer%port
CloseTCPServer%tcp_server
%AcceptTCPStream%tcp_server
%TCPStreamIP%tcp_stream
%TCPStreamPort%tcp_stream
TCPTimeouts%read_millis%accept_millis
```

---

## Implementation Status in blitz3d-wasm

| Subsystem | Functions | Implemented | Notes |
|-----------|-----------|-------------|-------|
| System | 15 | ~8 | MilliSecs, Delay, Print, etc. |
| Math | 17 | 17 | All implemented |
| String | 18 | ~10 | Basic string ops |
| Stream | 15 | ~8 | ReadInt, WriteInt, etc. |
| FileSystem | 17 | ~5 | Basic file ops |
| Bank | 16 | 16 | All implemented |
| Input | 35 | ~20 | Key/Mouse, partial Joy |
| Audio | 17 | ~5 | Basic sound |
| Graphics 2D | 80+ | ~20 | Basic drawing |
| Graphics 3D | 150+ | ~60 | Core 3D rendering |
| Sockets | 18 | 0 | Not needed for SCPCB |

Total: ~400+ functions in original Blitz3D runtime
