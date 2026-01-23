(module
  (type (;0;) (func (param i32)))
  (type (;1;) (func (param i32 i32 i32 i32)))
  (type (;2;) (func))
  (type (;3;) (func (param i32 i32 i32)))
  (type (;4;) (func (param i32 i32)))
  (type (;5;) (func (param i32 i32 i32 i32 i32)))
  (type (;6;) (func (param i32 i32 i32 i32 i32) (result i32)))
  (type (;7;) (func (param i32) (result i32)))
  (type (;8;) (func (param i32 f32 f32)))
  (type (;9;) (func (param i32 f32)))
  (type (;10;) (func (param i32 i32 i32) (result i32)))
  (type (;11;) (func (param i32 i32 i32 i32) (result i32)))
  (type (;12;) (func (param i32 i32) (result i32)))
  (type (;13;) (func (param i32 f32 f32 f32)))
  (type (;14;) (func (param f32 f32 f32 f32 f32 f32 f32 f32 f32)))
  (type (;15;) (func (result i32)))
  (type (;16;) (func (param f32 f32 f32)))
  (type (;17;) (func (param f32 f32)))
  (type (;18;) (func (param f32)))
  (type (;19;) (func (param i32 f32 f32 f32 i32)))
  (type (;20;) (func (param i32 i32) (result f32)))
  (type (;21;) (func (param i32 f32) (result i32)))
  (type (;22;) (func (param f32 f32 f32 f32 f32 f32 f32) (result i32)))
  (type (;23;) (func (result f32)))
  (type (;24;) (func (param i32 i32 f32 f32) (result i32)))
  (type (;25;) (func (param i32 f32 f32 f32 f32 f32 f32) (result i32)))
  (type (;26;) (func (param i32 i32 f32 f32 f32 f32)))
  (type (;27;) (func (param i32 i32 f32 f32 f32 i32)))
  (type (;28;) (func (param i32 i32 f32 i32 f32)))
  (type (;29;) (func (param i32 f32 i32)))
  (type (;30;) (func (param i32) (result f32)))
  (type (;31;) (func (param i32 f32 f32 f32 f32 f32 f32)))
  (type (;32;) (func (param f32) (result f32)))
  (type (;33;) (func (param f32 f32 f32) (result f32)))
  (type (;34;) (func (param f32 f32 f32 f32 f32 f32) (result f32)))
  (type (;35;) (func (param f32 f32 f32 f32) (result f32)))
  (type (;36;) (func (param f32 f32 f32 i32 i32)))
  (type (;37;) (func (param f32) (result i32)))
  (type (;38;) (func (param i32 i32 f32)))
  (type (;39;) (func (param i32 f32 f32 f32 f32 f32 f32 f32 i32 i32 i32) (result i32)))
  (type (;40;) (func (param i32 f32 f32 f32 f32 f32 f32 f32 f32 f32 f32 f32 f32 f32 f32 f32 i32 f32 f32 f32 f32 f32)))
  (type (;41;) (func (param f32 f32) (result f32)))
  (type (;42;) (func (param i32 f32 f32 f32 i32 f32 i32 i32) (result i32)))
  (type (;43;) (func (param i32 f32 f32 f32 f32 f32 f32 f32 i32) (result i32)))
  (type (;44;) (func (param i32 f32 f32 f32 f32 i32)))
  (type (;45;) (func (param i32 i32 i32 f32 f32 f32)))
  (type (;46;) (func (param i32 f32 f32 f32 i32 f32)))
  (type (;47;) (func (param i32 i32 i32 f32 f32 i32 i32 i32 i32) (result i32)))
  (type (;48;) (func (param i32 i32 i32 i32 i32 i32) (result i32)))
  (type (;49;) (func (param i32 i32 i32 i32 i32 i32 i32 i32) (result i32)))
  (type (;50;) (func (param i32 i32 i32 f32) (result f32)))
  (type (;51;) (func (param i32 i32 i32 i32 i32 i32 f32) (result i32)))
  (type (;52;) (func (param i32 i32 i32 f32) (result i32)))
  (type (;53;) (func (param i32 i32 i32 i32 i32 f32 i32) (result i32)))
  (type (;54;) (func (param i32 i32 i32 i32 i32 i32 i32 i32 i32) (result i32)))
  (type (;55;) (func (param i32 i32 i32 i32 i32 i32 i32 i32 i32 i32) (result i32)))
  (type (;56;) (func (param i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32) (result i32)))
  (type (;57;) (func (param i32 i32 i32 i32 i32 i32 i32 i32 f32 i32) (result f32)))
  (type (;58;) (func (param i32 i32) (result i32)))
  (type (;59;) (func (param i32) (result i32)))
  (type (;60;) (func (param i32 i32) (result i32)))
  (import "env" "PrintInt" (func (;0;) (type 0)))
  (import "env" "PrintString" (func (;1;) (type 0)))
  (import "env" "Graphics3D" (func (;2;) (type 1)))
  (import "env" "Cls" (func (;3;) (type 2)))
  (import "env" "Flip" (func (;4;) (type 2)))
  (import "env" "ClsColor" (func (;5;) (type 3)))
  (import "env" "Color" (func (;6;) (type 3)))
  (import "env" "GetColor" (func (;7;) (type 4)))
  (import "env" "Rect" (func (;8;) (type 5)))
  (import "env" "Oval" (func (;9;) (type 5)))
  (import "env" "Line" (func (;10;) (type 1)))
  (import "env" "Text" (func (;11;) (type 5)))
  (import "env" "LoadFont" (func (;12;) (type 6)))
  (import "env" "SetFont" (func (;13;) (type 0)))
  (import "env" "FreeFont" (func (;14;) (type 0)))
  (import "env" "LoadImage" (func (;15;) (type 7)))
  (import "env" "DrawImage" (func (;16;) (type 1)))
  (import "env" "DrawBlock" (func (;17;) (type 1)))
  (import "env" "TileImage" (func (;18;) (type 1)))
  (import "env" "ImageWidth" (func (;19;) (type 7)))
  (import "env" "ImageHeight" (func (;20;) (type 7)))
  (import "env" "HandleImage" (func (;21;) (type 3)))
  (import "env" "MidHandle" (func (;22;) (type 0)))
  (import "env" "AutoMidHandle" (func (;23;) (type 0)))
  (import "env" "MaskImage" (func (;24;) (type 1)))
  (import "env" "ScaleImage" (func (;25;) (type 8)))
  (import "env" "ResizeImage" (func (;26;) (type 3)))
  (import "env" "FreeImage" (func (;27;) (type 0)))
  (import "env" "KeyDown" (func (;28;) (type 7)))
  (import "env" "KeyHit" (func (;29;) (type 7)))
  (import "env" "PlaySound" (func (;30;) (type 7)))
  (import "env" "FreeSound" (func (;31;) (type 0)))
  (import "env" "LoadSound" (func (;32;) (type 7)))
  (import "env" "StopChannel" (func (;33;) (type 0)))
  (import "env" "ChannelVolume" (func (;34;) (type 9)))
  (import "env" "ChannelPaused" (func (;35;) (type 4)))
  (import "env" "ChannelPlaying" (func (;36;) (type 7)))
  (import "env" "FSOUND_Init" (func (;37;) (type 10)))
  (import "env" "FSOUND_Close" (func (;38;) (type 2)))
  (import "env" "FSOUND_Stream_Open" (func (;39;) (type 11)))
  (import "env" "FSOUND_Stream_Play" (func (;40;) (type 12)))
  (import "env" "FSOUND_Stream_Stop" (func (;41;) (type 0)))
  (import "env" "FSOUND_SetVolume" (func (;42;) (type 9)))
  (import "env" "FSOUND_SetPaused" (func (;43;) (type 4)))
  (import "env" "Sound3D" (func (;44;) (type 13)))
  (import "env" "SetListenerLocation" (func (;45;) (type 14)))
  (import "env" "MouseX" (func (;46;) (type 15)))
  (import "env" "MouseY" (func (;47;) (type 15)))
  (import "env" "MouseZ" (func (;48;) (type 15)))
  (import "env" "MouseDown" (func (;49;) (type 7)))
  (import "env" "MouseHit" (func (;50;) (type 7)))
  (import "env" "MouseXSpeed" (func (;51;) (type 15)))
  (import "env" "MouseYSpeed" (func (;52;) (type 15)))
  (import "env" "MoveMouse" (func (;53;) (type 4)))
  (import "env" "HidePointer" (func (;54;) (type 2)))
  (import "env" "ShowPointer" (func (;55;) (type 2)))
  (import "env" "MilliCSecs" (func (;56;) (type 15)))
  (import "env" "CreateCamera" (func (;57;) (type 7)))
  (import "env" "CreateLight" (func (;58;) (type 7)))
  (import "env" "AmbientLight" (func (;59;) (type 16)))
  (import "env" "LightColor" (func (;60;) (type 13)))
  (import "env" "LightRange" (func (;61;) (type 9)))
  (import "env" "CameraClsColor" (func (;62;) (type 13)))
  (import "env" "CameraRange" (func (;63;) (type 8)))
  (import "env" "CameraZoom" (func (;64;) (type 9)))
  (import "env" "CameraProjMode" (func (;65;) (type 4)))
  (import "env" "CameraViewport" (func (;66;) (type 5)))
  (import "env" "FogMode" (func (;67;) (type 0)))
  (import "env" "FogColor" (func (;68;) (type 16)))
  (import "env" "FogRange" (func (;69;) (type 17)))
  (import "env" "FogDensity" (func (;70;) (type 18)))
  (import "env" "CreateCube" (func (;71;) (type 7)))
  (import "env" "CreateSphere" (func (;72;) (type 7)))
  (import "env" "CreatePlane" (func (;73;) (type 7)))
  (import "env" "CreateBrush" (func (;74;) (type 15)))
  (import "env" "BrushColor" (func (;75;) (type 1)))
  (import "env" "BrushAlpha" (func (;76;) (type 4)))
  (import "env" "BrushShininess" (func (;77;) (type 9)))
  (import "env" "BrushTexture" (func (;78;) (type 1)))
  (import "env" "BrushFX" (func (;79;) (type 4)))
  (import "env" "BrushBlend" (func (;80;) (type 4)))
  (import "env" "FreeBrush" (func (;81;) (type 0)))
  (import "env" "PaintEntity" (func (;82;) (type 4)))
  (import "env" "PaintMesh" (func (;83;) (type 4)))
  (import "env" "PaintSurface" (func (;84;) (type 4)))
  (import "env" "TextureWidth" (func (;85;) (type 7)))
  (import "env" "TextureHeight" (func (;86;) (type 7)))
  (import "env" "FreeTexture" (func (;87;) (type 0)))
  (import "env" "TextureBlend" (func (;88;) (type 4)))
  (import "env" "TextureCoords" (func (;89;) (type 4)))
  (import "env" "ScaleTexture" (func (;90;) (type 8)))
  (import "env" "PositionTexture" (func (;91;) (type 8)))
  (import "env" "RotateTexture" (func (;92;) (type 9)))
  (import "env" "PositionEntity" (func (;93;) (type 19)))
  (import "env" "RotateEntity" (func (;94;) (type 19)))
  (import "env" "ScaleEntity" (func (;95;) (type 13)))
  (import "env" "MoveEntity" (func (;96;) (type 13)))
  (import "env" "TurnEntity" (func (;97;) (type 19)))
  (import "env" "EntityTexture" (func (;98;) (type 1)))
  (import "env" "CreatePivot" (func (;99;) (type 7)))
  (import "env" "FreeEntity" (func (;100;) (type 0)))
  (import "env" "EntityX" (func (;101;) (type 20)))
  (import "env" "EntityY" (func (;102;) (type 20)))
  (import "env" "EntityZ" (func (;103;) (type 20)))
  (import "env" "EntityPitch" (func (;104;) (type 20)))
  (import "env" "EntityYaw" (func (;105;) (type 20)))
  (import "env" "EntityRoll" (func (;106;) (type 20)))
  (import "env" "EntityDistance" (func (;107;) (type 20)))
  (import "env" "CountChildren" (func (;108;) (type 7)))
  (import "env" "GetChild" (func (;109;) (type 12)))
  (import "env" "FindChild" (func (;110;) (type 12)))
  (import "env" "GetParent" (func (;111;) (type 7)))
  (import "env" "CreateSprite" (func (;112;) (type 7)))
  (import "env" "ScaleSprite" (func (;113;) (type 8)))
  (import "env" "SpriteViewMode" (func (;114;) (type 4)))
  (import "env" "TranslateEntity" (func (;115;) (type 13)))
  (import "env" "EntityAlpha" (func (;116;) (type 9)))
  (import "env" "EntityColor" (func (;117;) (type 13)))
  (import "env" "EntityShininess" (func (;118;) (type 9)))
  (import "env" "EntityFX" (func (;119;) (type 4)))
  (import "env" "EntityBlend" (func (;120;) (type 4)))
  (import "env" "EntityParent" (func (;121;) (type 3)))
  (import "env" "HideEntity" (func (;122;) (type 0)))
  (import "env" "ShowEntity" (func (;123;) (type 0)))
  (import "env" "EntityVisible" (func (;124;) (type 12)))
  (import "env" "EntityInView" (func (;125;) (type 12)))
  (import "env" "EntityPick" (func (;126;) (type 21)))
  (import "env" "EntityPickMode" (func (;127;) (type 3)))
  (import "env" "EntityCollided" (func (;128;) (type 12)))
  (import "env" "CopyEntity" (func (;129;) (type 12)))
  (import "env" "NameEntity" (func (;130;) (type 4)))
  (import "env" "Kill" (func (;131;) (type 0)))
  (import "env" "LinePick" (func (;132;) (type 22)))
  (import "env" "PickedX" (func (;133;) (type 23)))
  (import "env" "PickedY" (func (;134;) (type 23)))
  (import "env" "PickedZ" (func (;135;) (type 23)))
  (import "env" "LoadMesh_Strict" (func (;136;) (type 7)))
  (import "env" "LoadAnimMesh_Strict" (func (;137;) (type 7)))
  (import "env" "LoadTexture_Strict" (func (;138;) (type 12)))
  (import "env" "LoadSound_Strict" (func (;139;) (type 7)))
  (import "env" "LoadImage_Strict" (func (;140;) (type 7)))
  (import "env" "FreeSound_Strict" (func (;141;) (type 0)))
  (import "env" "LoadTempSound" (func (;142;) (type 7)))
  (import "env" "PlaySound_Strict" (func (;143;) (type 7)))
  (import "env" "LoopSound2" (func (;144;) (type 24)))
  (import "env" "DebugLog" (func (;145;) (type 0)))
  (import "env" "RuntimeError" (func (;146;) (type 0)))
  (import "env" "CatchErrors" (func (;147;) (type 2)))
  (import "env" "MilliSecs2" (func (;148;) (type 15)))
  (import "env" "CurrentDate" (func (;149;) (type 15)))
  (import "env" "RenderWorld" (func (;150;) (type 18)))
  (import "env" "Flip" (func (;151;) (type 0)))
  (import "env" "LoadTexture" (func (;152;) (type 12)))
  (import "env" "LoadAsset" (func (;153;) (type 7)))
  (import "env" "GetAssetData" (func (;154;) (type 7)))
  (import "env" "GetAssetSize" (func (;155;) (type 7)))
  (import "env" "LoadMesh" (func (;156;) (type 12)))
  (import "env" "CreateMesh" (func (;157;) (type 7)))
  (import "env" "CreateSurface" (func (;158;) (type 12)))
  (import "env" "AddVertex" (func (;159;) (type 25)))
  (import "env" "AddTriangle" (func (;160;) (type 11)))
  (import "env" "VertexColor" (func (;161;) (type 26)))
  (import "env" "VertexTexCoords" (func (;162;) (type 27)))
  (import "env" "UpdateNormals" (func (;163;) (type 0)))
  (import "env" "CountSurfaces" (func (;164;) (type 7)))
  (import "env" "GetSurface" (func (;165;) (type 12)))
  (import "env" "LoadAnimMesh" (func (;166;) (type 12)))
  (import "env" "Animate" (func (;167;) (type 28)))
  (import "env" "SetAnimTime" (func (;168;) (type 29)))
  (import "env" "AnimTime" (func (;169;) (type 30)))
  (import "env" "AnimLength" (func (;170;) (type 7)))
  (import "env" "ExtractAnimSeq" (func (;171;) (type 10)))
  (import "env" "AddAnimSeq" (func (;172;) (type 12)))
  (import "env" "AnimSeq" (func (;173;) (type 7)))
  (import "env" "Animating" (func (;174;) (type 7)))
  (import "env" "Delay" (func (;175;) (type 0)))
  (import "env" "Collisions" (func (;176;) (type 1)))
  (import "env" "ClearCollisions" (func (;177;) (type 2)))
  (import "env" "EntityType" (func (;178;) (type 3)))
  (import "env" "EntityRadius" (func (;179;) (type 8)))
  (import "env" "EntityBox" (func (;180;) (type 31)))
  (import "env" "ResetEntity" (func (;181;) (type 0)))
  (import "env" "UpdateWorld" (func (;182;) (type 18)))
  (import "env" "CountCollisions" (func (;183;) (type 7)))
  (import "env" "CollisionX" (func (;184;) (type 20)))
  (import "env" "CollisionY" (func (;185;) (type 20)))
  (import "env" "CollisionZ" (func (;186;) (type 20)))
  (import "env" "CollisionNX" (func (;187;) (type 20)))
  (import "env" "CollisionNY" (func (;188;) (type 20)))
  (import "env" "CollisionNZ" (func (;189;) (type 20)))
  (import "env" "CollisionEntity" (func (;190;) (type 12)))
  (import "env" "CollisionSurface" (func (;191;) (type 12)))
  (import "env" "CollisionTriangle" (func (;192;) (type 12)))
  (import "env" "CollisionTime" (func (;193;) (type 20)))
  (import "env" "WrapAngle" (func (;194;) (type 32)))
  (import "env" "CurveValue" (func (;195;) (type 33)))
  (import "env" "Distance" (func (;196;) (type 34)))
  (import "env" "Point_Direction" (func (;197;) (type 35)))
  (import "env" "DebugLog" (func (;198;) (type 0)))
  (import "env" "MilliSecs" (func (;199;) (type 15)))
  (import "env" "Print" (func (;200;) (type 0)))
  (import "env" "KeyDown" (func (;201;) (type 7)))
  (import "env" "KeyHit" (func (;202;) (type 7)))
  (import "env" "TFormVector" (func (;203;) (type 36)))
  (import "env" "TFormedX" (func (;204;) (type 23)))
  (import "env" "TFormedY" (func (;205;) (type 23)))
  (import "env" "TFormedZ" (func (;206;) (type 23)))
  (import "env" "ReadFile" (func (;207;) (type 7)))
  (import "env" "WriteFile" (func (;208;) (type 7)))
  (import "env" "OpenFile" (func (;209;) (type 7)))
  (import "env" "CloseFile" (func (;210;) (type 0)))
  (import "env" "ReadInt" (func (;211;) (type 7)))
  (import "env" "ReadFloat" (func (;212;) (type 30)))
  (import "env" "ReadString" (func (;213;) (type 7)))
  (import "env" "ReadLine" (func (;214;) (type 7)))
  (import "env" "ReadByte" (func (;215;) (type 7)))
  (import "env" "Eof" (func (;216;) (type 7)))
  (import "env" "FilePos" (func (;217;) (type 7)))
  (import "env" "SeekFile" (func (;218;) (type 4)))
  (import "env" "FileSize" (func (;219;) (type 7)))
  (import "env" "FileType" (func (;220;) (type 7)))
  (import "env" "ReadShort" (func (;221;) (type 7)))
  (import "env" "WriteInt" (func (;222;) (type 4)))
  (import "env" "WriteFloat" (func (;223;) (type 9)))
  (import "env" "WriteString" (func (;224;) (type 4)))
  (import "env" "WriteByte" (func (;225;) (type 4)))
  (import "env" "WriteShort" (func (;226;) (type 4)))
  (import "env" "Eof" (func (;227;) (type 7)))
  (import "env" "SeekFile" (func (;228;) (type 4)))
  (import "env" "FilePos" (func (;229;) (type 7)))
  (import "env" "FileSize" (func (;230;) (type 7)))
  (import "env" "FileType" (func (;231;) (type 7)))
  (import "env" "ReadData" (func (;232;) (type 10)))
  (import "env" "RestoreData" (func (;233;) (type 0)))
  (import "env" "OpenTCPStream" (func (;234;) (type 12)))
  (import "env" "CloseTCPStream" (func (;235;) (type 0)))
  (import "env" "WriteLine" (func (;236;) (type 12)))
  (import "env" "ReadLine" (func (;237;) (type 7)))
  (import "env" "ReadAvail" (func (;238;) (type 7)))
  (import "env" "SendNetMsg" (func (;239;) (type 6)))
  (import "env" "StringConcat" (func (;240;) (type 12)))
  (import "env" "IntToString" (func (;241;) (type 7)))
  (import "env" "FloatToString" (func (;242;) (type 37)))
  (import "blitz3d" "CreateBank" (func (;243;) (type 7)))
  (import "blitz3d" "FreeBank" (func (;244;) (type 0)))
  (import "blitz3d" "BankSize" (func (;245;) (type 7)))
  (import "env" "ResizeBank" (func (;246;) (type 4)))
  (import "env" "CopyBank" (func (;247;) (type 5)))
  (import "blitz3d" "PeekByte" (func (;248;) (type 12)))
  (import "blitz3d" "PokeByte" (func (;249;) (type 3)))
  (import "blitz3d" "PeekInt" (func (;250;) (type 12)))
  (import "blitz3d" "PokeInt" (func (;251;) (type 3)))
  (import "blitz3d" "PeekFloat" (func (;252;) (type 20)))
  (import "blitz3d" "PokeFloat" (func (;253;) (type 38)))
  (import "blitz3d" "PeekShort" (func (;254;) (type 12)))
  (import "blitz3d" "PokeShort" (func (;255;) (type 3)))
  (import "blitz3d" "ParseB3D" (func (;256;) (type 7)))
  (import "blitz3d" "ParseRMesh" (func (;257;) (type 7)))
  (import "blitz3d" "GetMeshSurfaceCount" (func (;258;) (type 7)))
  (import "blitz3d" "GetSurfaceVertexCount" (func (;259;) (type 12)))
  (import "blitz3d" "GetSurfaceIndexCount" (func (;260;) (type 12)))
  (import "blitz3d" "GetSurfaceVerticesPtr" (func (;261;) (type 12)))
  (import "blitz3d" "GetSurfaceIndicesPtr" (func (;262;) (type 12)))
  (import "env" "AddVertexExtended" (func (;263;) (type 39)))
  (import "env" "SetSurfaceTexture" (func (;264;) (type 3)))
  (import "env" "SetSurfaceLightmap" (func (;265;) (type 4)))
  (import "env" "AddCollisionVertex" (func (;266;) (type 16)))
  (import "env" "AddCollisionTriangle" (func (;267;) (type 3)))
  (import "env" "AddEntity" (func (;268;) (type 13)))
  (import "env" "StringEqual" (func (;269;) (type 12)))
  (import "env" "ZlibWapi_Open" (func (;270;) (type 7)))
  (import "env" "ZlibWapi_Close" (func (;271;) (type 0)))
  (import "env" "ZlibWapi_GetFileCount" (func (;272;) (type 7)))
  (import "env" "ZlibWapi_GetFileName" (func (;273;) (type 12)))
  (import "env" "ZlibWapi_ExtractFile" (func (;274;) (type 10)))
  (import "env" "OpenMovie" (func (;275;) (type 7)))
  (import "env" "DrawMovie" (func (;276;) (type 5)))
  (import "env" "MoviePlaying" (func (;277;) (type 7)))
  (import "env" "FSOUND_Stream_Open" (func (;278;) (type 11)))
  (import "env" "FSOUND_Stream_Play" (func (;279;) (type 12)))
  (import "env" "FSOUND_SetVolume" (func (;280;) (type 4)))
  (import "env" "FSOUND_SetPaused" (func (;281;) (type 4)))
  (import "env" "FSOUND_Stream_Stop" (func (;282;) (type 0)))
  (import "env" "FSOUND_Close" (func (;283;) (type 2)))
  (import "al" "alInit" (func (;284;) (type 17)))
  (import "al" "alGetAvailableDeviceCount" (func (;285;) (type 15)))
  (import "al" "alGetAvailableDeviceName" (func (;286;) (type 7)))
  (import "al" "alDeviceInit" (func (;287;) (type 10)))
  (import "al" "alGetNumSources" (func (;288;) (type 15)))
  (import "al" "alDestroy" (func (;289;) (type 2)))
  (import "al" "alUpdate" (func (;290;) (type 2)))
  (import "al" "alListenerSetPosition" (func (;291;) (type 16)))
  (import "al" "alListenerSetDirection" (func (;292;) (type 16)))
  (import "al" "alListenerSetUp" (func (;293;) (type 16)))
  (import "al" "alListenerSetVelocity" (func (;294;) (type 16)))
  (import "al" "alListenerSetMasterVolume" (func (;295;) (type 18)))
  (import "al" "alCreateBuffer" (func (;296;) (type 12)))
  (import "al" "alFreeBuffer" (func (;297;) (type 0)))
  (import "al" "alCreateSource" (func (;298;) (type 10)))
  (import "al" "alCreateSource_" (func (;299;) (type 10)))
  (import "al" "alFreeSource" (func (;300;) (type 0)))
  (import "al" "alSourcePlay" (func (;301;) (type 12)))
  (import "al" "alSourcePlay_" (func (;302;) (type 12)))
  (import "al" "alSourcePlay2D" (func (;303;) (type 12)))
  (import "al" "alSourcePlay2D_" (func (;304;) (type 12)))
  (import "al" "alSourcePlay3D" (func (;305;) (type 12)))
  (import "al" "alSourcePlay3D_" (func (;306;) (type 12)))
  (import "al" "alSourcePause" (func (;307;) (type 0)))
  (import "al" "alSourceResume" (func (;308;) (type 0)))
  (import "al" "alSourceStop" (func (;309;) (type 0)))
  (import "al" "alSourceIsPlaying" (func (;310;) (type 7)))
  (import "al" "alSourceIsPaused" (func (;311;) (type 7)))
  (import "al" "alSourceIsStopped" (func (;312;) (type 7)))
  (import "al" "alSourceSetVolume" (func (;313;) (type 9)))
  (import "al" "alSourceSetPitch" (func (;314;) (type 9)))
  (import "al" "alSourceSetLoop" (func (;315;) (type 4)))
  (import "al" "alSourceSeek" (func (;316;) (type 29)))
  (import "al" "alSourceGetAudioTime" (func (;317;) (type 20)))
  (import "al" "alSourceGetLenght" (func (;318;) (type 20)))
  (import "al" "alSourceSet3DPosition" (func (;319;) (type 13)))
  (import "al" "alSourceSetRolloffFactor" (func (;320;) (type 9)))
  (import "al" "alCreateEffect" (func (;321;) (type 15)))
  (import "al" "alFreeEffect" (func (;322;) (type 0)))
  (import "al" "alEffectSetEAXReverb" (func (;323;) (type 40)))
  (import "env" "MilliSecs" (func (;324;) (type 15)))
  (import "env" "CountFPS" (func (;325;) (type 15)))
  (import "env" "PerformanceStats" (func (;326;) (type 15)))
  (import "env" "Left" (func (;327;) (type 12)))
  (import "env" "Right" (func (;328;) (type 12)))
  (import "env" "Mid" (func (;329;) (type 10)))
  (import "env" "Upper" (func (;330;) (type 7)))
  (import "env" "Lower" (func (;331;) (type 7)))
  (import "env" "Replace" (func (;332;) (type 10)))
  (import "env" "Instr" (func (;333;) (type 10)))
  (import "env" "Len" (func (;334;) (type 7)))
  (import "env" "Trim" (func (;335;) (type 7)))
  (import "env" "LTrim" (func (;336;) (type 7)))
  (import "env" "RTrim" (func (;337;) (type 7)))
  (import "env" "Asc" (func (;338;) (type 7)))
  (import "env" "Chr" (func (;339;) (type 7)))
  (import "env" "Hex" (func (;340;) (type 7)))
  (import "env" "Bin" (func (;341;) (type 7)))
  (import "env" "Sin" (func (;342;) (type 32)))
  (import "env" "Cos" (func (;343;) (type 32)))
  (import "env" "Tan" (func (;344;) (type 32)))
  (import "env" "ASin" (func (;345;) (type 32)))
  (import "env" "ACos" (func (;346;) (type 32)))
  (import "env" "ATan" (func (;347;) (type 32)))
  (import "env" "ATan2" (func (;348;) (type 41)))
  (import "env" "Exp" (func (;349;) (type 32)))
  (import "env" "Log" (func (;350;) (type 32)))
  (import "env" "Log10" (func (;351;) (type 32)))
  (import "env" "Sqr" (func (;352;) (type 32)))
  (import "env" "Rnd" (func (;353;) (type 41)))
  (import "env" "Rand" (func (;354;) (type 12)))
  (import "env" "SeedRnd" (func (;355;) (type 0)))
  (import "env" "Min" (func (;356;) (type 41)))
  (import "env" "Max" (func (;357;) (type 41)))
  (import "env" "Abs" (func (;358;) (type 32)))
  (import "env" "Sgn" (func (;359;) (type 32)))
  (import "env" "Ceil" (func (;360;) (type 32)))
  (import "env" "Floor" (func (;361;) (type 32)))
  (import "env" "Mod" (func (;362;) (type 41)))
  (import "env" "TFormVector" (func (;363;) (type 36)))
  (import "env" "TFormPoint" (func (;364;) (type 36)))
  (import "env" "TFormNormal" (func (;365;) (type 36)))
  (import "env" "TFormedX" (func (;366;) (type 23)))
  (import "env" "TFormedY" (func (;367;) (type 23)))
  (import "env" "TFormedZ" (func (;368;) (type 23)))
  (import "env" "CreateParticle" (func (;369;) (type 42)))
  (import "env" "UpdateParticles" (func (;370;) (type 2)))
  (import "env" "RemoveParticle" (func (;371;) (type 0)))
  (import "env" "ParticleTextures" (func (;372;) (type 10)))
  (import "env" "SetEmitter" (func (;373;) (type 12)))
  (import "env" "UpdateEmitters" (func (;374;) (type 0)))
  (import "env" "DeleteDevilEmitters" (func (;375;) (type 2)))
  (import "env" "UpdateDevilEmitters" (func (;376;) (type 2)))
  (import "env" "CreateDecal" (func (;377;) (type 43)))
  (import "env" "UpdateDecals" (func (;378;) (type 2)))
  (import "env" "GiveAchievement" (func (;379;) (type 0)))
  (import "env" "Update294" (func (;380;) (type 2)))
  (import "env" "UpdateItems" (func (;381;) (type 2)))
  (import "env" "PickItem" (func (;382;) (type 0)))
  (import "env" "DropItem" (func (;383;) (type 0)))
  (import "env" "AnimateNPC" (func (;384;) (type 44)))
  (import "env" "Animate2" (func (;385;) (type 45)))
  (import "env" "ChangeNPCTextureID" (func (;386;) (type 4)))
  (import "env" "CheckForNPCInFacility" (func (;387;) (type 7)))
  (import "env" "Console_SpawnNPC" (func (;388;) (type 0)))
  (import "env" "CreateConsoleMsg" (func (;389;) (type 0)))
  (import "env" "ChangeAngleValueForCorrectBoneAssigning" (func (;390;) (type 32)))
  (import "env" "AlignToVector" (func (;391;) (type 46)))
  (import "env" "CurveAngle" (func (;392;) (type 33)))
  (import "env" "CameraProject" (func (;393;) (type 13)))
  (func (;394;) (type 2)
    (local i32)
    i32.const 256
    call 140
    global.set 37
    i32.const 287
    call 140
    global.set 38
    global.get 38
    i32.const 255
    i32.const 255
    i32.const 0
    call 24
    i32.const 0
    drop
    global.get 12
    global.get 12
    call 19
    global.get 39
    i32.mul
    global.get 12
    call 20
    global.get 39
    i32.mul
    call 26
    i32.const 0
    drop
    global.get 13
    global.get 13
    call 19
    global.get 39
    i32.mul
    global.get 13
    call 20
    global.get 39
    i32.mul
    call 26
    i32.const 0
    drop
    global.get 14
    global.get 14
    call 19
    global.get 39
    i32.mul
    global.get 14
    call 20
    global.get 39
    i32.mul
    call 26
    i32.const 0
    drop
    global.get 15
    global.get 15
    call 19
    global.get 39
    i32.mul
    global.get 15
    call 20
    global.get 39
    i32.mul
    call 26
    i32.const 0
    drop
    i32.const 0
    local.set 0
    block  ;; label = @1
      loop  ;; label = @2
        local.get 0
        i32.const 3
        i32.gt_s
        br_if 1 (;@1;)
        i32.const 318
        call 140
        drop
        local.get 0
        drop
        i32.const 0
        drop
        i32.const 90
        local.get 0
        i32.mul
        drop
        i32.const 0
        drop
        local.get 0
        drop
        i32.const 0
        i32.const 0
        i32.const 0
        call 21
        i32.const 0
        drop
        local.get 0
        i32.const 1
        i32.add
        local.set 0
        br 0 (;@2;)
      end
    end
    i32.const 256
    i32.const 0
    i32.const 12
    memory.fill
    i32.const 1
    drop
    i32.const 1
    drop
    i32.const 264
    i32.const 0
    i32.const 4
    memory.fill
    i32.const 268
    i32.const 0
    i32.const 4
    memory.fill
    i32.const 272
    i32.const 0
    i32.const 4
    memory.fill
    i32.const 276
    i32.const 0
    i32.const 4
    memory.fill
    i32.const 280
    i32.const 0
    i32.const 4
    memory.fill
    i32.const 284
    i32.const 0
    i32.const 4
    memory.fill
    i32.const 0
    drop
    return)
  (func (;395;) (type 58) (param i32 i32) (result i32)
    (local i32)
    global.get 4
    local.set 2
    local.get 2
    local.get 0
    i32.add
    global.set 4
    local.get 2)
  (func (;396;) (type 59) (param i32) (result i32)
    (local i32)
    global.get 6
    local.set 1
    local.get 1
    local.get 0
    i32.const 9
    i32.add
    i32.add
    global.set 6
    local.get 1)
  (func (;397;) (type 60) (param i32 i32) (result i32)
    (local i32 i32 i32)
    local.get 0
    i32.eqz
    if  ;; label = @1
      i32.const 0
      call 396
      local.set 0
    end
    local.get 1
    i32.eqz
    if  ;; label = @1
      i32.const 0
      call 396
      local.set 1
    end
    local.get 0
    i32.load offset=4
    local.set 2
    local.get 1
    i32.load offset=4
    local.set 3
    local.get 2
    local.get 3
    i32.add
    call 396
    local.set 4
    local.get 4
    i32.const 8
    i32.add
    local.get 0
    i32.const 8
    i32.add
    local.get 2
    memory.copy
    local.get 4
    i32.const 8
    i32.add
    local.get 2
    i32.add
    local.get 1
    i32.const 8
    i32.add
    local.get 3
    memory.copy
    local.get 4
    local.get 2
    local.get 3
    i32.add
    i32.store offset=4
    local.get 4)
  (func (;398;) (type 15) (result i32)
    (local i32 i32 i32 i32 i32 i32 i32 i32 i32 f32 f32 f32 f32 i32 i32)
    i32.const 0
    i32.const 0
    i32.const 0
    call 6
    i32.const 0
    drop
    i32.const 0
    i32.const 0
    global.get 40
    global.get 41
    i32.const 1
    call 8
    i32.const 0
    drop
    call 55
    i32.const 0
    drop
    global.get 12
    i32.const 0
    i32.const 0
    i32.const 0
    call 16
    i32.const 0
    drop
    call 148
    i32.const 0
    drop
    i32.const 0
    i32.rem_s
    i32.const 0
    drop
    i32.const 0
    i32.const 0
    call 354
    i32.ge_s
    if  ;; label = @1
      global.get 14
      global.get 40
      global.get 14
      call 19
      i32.sub
      global.get 41
      global.get 14
      call 20
      i32.sub
      i32.const 0
      call 16
      i32.const 0
      drop
    end
    i32.const 300
    i32.const 0
    call 354
    i32.const 1
    i32.eq
    if  ;; label = @1
      i32.const 4000
      i32.const 8000
      call 354
      drop
      i32.const 200
      i32.const 500
      call 354
      drop
    end
    global.get 42
    drop
    i32.const 0
    drop
    i32.const 1
    drop
    i32.const 0
    global.get 43
    i32.sub
    drop
    i32.const 1
    drop
    i32.const 0
    i32.const 1
    drop
    i32.const 0
    i32.lt_s
    if  ;; label = @1
      i32.const 50
      i32.const 50
      i32.const 50
      call 6
      i32.const 0
      drop
      global.get 18
      i32.const 5
      i32.const -1
      i32.mul
      i32.const 5
      call 354
      i32.add
      drop
      global.get 19
      i32.const 5
      i32.const -1
      i32.mul
      i32.const 5
      call 354
      i32.add
      drop
      global.get 17
      drop
      i32.const 1
      drop
      i32.const 0
      drop
      i32.const 1
      drop
      i32.const 0
      i32.const 0
      i32.lt_s
      if  ;; label = @2
        i32.const 700
        i32.const 800
        call 354
        drop
        i32.const 10
        i32.const 35
        call 354
        drop
        i32.const 700
        i32.const 1000
        call 354
        global.get 39
        i32.mul
        global.set 18
        i32.const 100
        i32.const 600
        call 354
        global.get 39
        i32.mul
        global.set 19
        block  ;; label = @3
          i32.const 0
          i32.const 22
          call 354
          global.set 7
          global.get 7
          i32.const 0
          i32.eq
          global.get 7
          i32.const 2
          i32.eq
          i32.or
          global.get 7
          i32.const 3
          i32.eq
          i32.or
          if  ;; label = @4
            i32.const 345
            global.set 17
            br 1 (;@3;)
          end
          global.get 7
          i32.const 4
          i32.eq
          global.get 7
          i32.const 5
          i32.eq
          i32.or
          if  ;; label = @4
            i32.const 365
            global.set 17
            br 1 (;@3;)
          end
          global.get 7
          i32.const 6
          i32.eq
          global.get 7
          i32.const 7
          i32.eq
          i32.or
          global.get 7
          i32.const 8
          i32.eq
          i32.or
          if  ;; label = @4
            i32.const 399
            global.set 17
            br 1 (;@3;)
          end
          global.get 7
          i32.const 9
          i32.eq
          global.get 7
          i32.const 10
          i32.eq
          i32.or
          global.get 7
          i32.const 11
          i32.eq
          i32.or
          if  ;; label = @4
            i32.const 441
            global.set 17
            br 1 (;@3;)
          end
          global.get 7
          i32.const 12
          i32.eq
          global.get 7
          i32.const 19
          i32.eq
          i32.or
          if  ;; label = @4
            i32.const 493
            global.set 17
            br 1 (;@3;)
          end
          global.get 7
          i32.const 13
          i32.eq
          if  ;; label = @4
            i32.const 505
            global.set 17
            br 1 (;@3;)
          end
          global.get 7
          i32.const 14
          i32.eq
          if  ;; label = @4
            i32.const 516
            global.set 17
            br 1 (;@3;)
          end
          global.get 7
          i32.const 15
          i32.eq
          if  ;; label = @4
            i32.const 565
            global.set 17
            br 1 (;@3;)
          end
          global.get 7
          i32.const 16
          i32.eq
          if  ;; label = @4
            i32.const 593
            global.set 17
            br 1 (;@3;)
          end
          global.get 7
          i32.const 17
          i32.eq
          if  ;; label = @4
            i32.const 606
            global.set 17
            br 1 (;@3;)
          end
          global.get 7
          i32.const 18
          i32.eq
          if  ;; label = @4
            i32.const 636
            global.set 17
            br 1 (;@3;)
          end
          global.get 7
          i32.const 20
          i32.eq
          if  ;; label = @4
            i32.const 670
            global.set 17
            br 1 (;@3;)
          end
          global.get 7
          i32.const 21
          i32.eq
          if  ;; label = @4
            i32.const 707
            global.set 17
            br 1 (;@3;)
          end
          global.get 7
          i32.const 22
          i32.eq
          if  ;; label = @4
            i32.const 34
            call 339
            call 241
            i32.const 737
            call 397
            i32.const 34
            call 339
            call 241
            call 397
            global.set 17
            br 1 (;@3;)
          end
        end
      end
    end
    global.get 44
    drop
    i32.const 0
    drop
    global.get 13
    global.get 40
    i32.const 2
    i32.div_s
    global.get 13
    call 19
    i32.const 2
    i32.div_s
    i32.sub
    global.get 41
    i32.const 20
    global.get 39
    i32.mul
    i32.sub
    global.get 13
    call 20
    i32.sub
    i32.const 0
    call 16
    i32.const 0
    drop
    global.get 40
    i32.const 1240
    global.get 39
    i32.mul
    i32.gt_s
    if  ;; label = @1
      global.get 37
      i32.const 0
      i32.const 5
      i32.const 512
      f32.convert_i32_s
      i32.const 7
      global.get 39
      i32.mul
      f32.convert_i32_s
      f32.const 0x1.ec8p+9 (;=985;)
      global.get 39
      f32.convert_i32_s
      f32.mul
      i32.trunc_f32_s
      f32.const 0x1.97p+8 (;=407;)
      global.get 39
      f32.convert_i32_s
      f32.mul
      i32.trunc_f32_s
      global.get 40
      i32.const 1240
      global.get 39
      i32.mul
      i32.sub
      i32.const 300
      i32.add
      i32.const 7
      global.get 39
      i32.mul
      call 400
      drop
    end
    global.get 45
    if  ;; label = @1
      i32.const 0
      global.set 33
    end
    global.get 20
    i32.const 0
    i32.eq
    if  ;; label = @1
      i32.const 0
      local.set 5
      block  ;; label = @2
        loop  ;; label = @3
          local.get 5
          i32.const 3
          i32.gt_s
          br_if 1 (;@2;)
          i32.const 0
          local.set 4
          i32.const 159
          global.get 39
          i32.mul
          local.set 0
          i32.const 286
          i32.const 100
          global.get 46
          i32.mul
          i32.add
          global.get 39
          i32.mul
          local.set 1
          i32.const 400
          global.get 39
          i32.mul
          local.set 2
          i32.const 70
          global.get 39
          i32.mul
          local.set 3
          global.get 47
          local.get 0
          drop
          local.get 1
          drop
          local.get 2
          drop
          local.get 3
          drop
          i32.const 0
          i32.and
          local.set 4
          block  ;; label = @4
            global.get 46
            global.set 7
            global.get 7
            i32.const 0
            i32.eq
            if  ;; label = @5
              i32.const 804
              local.set 6
              i32.const 821
              global.set 16
              local.get 4
              if  ;; label = @6
                i32.const 15
                i32.const 0
                call 354
                i32.const 1
                i32.eq
                if  ;; label = @7
                  block  ;; label = @8
                    i32.const 13
                    i32.const 0
                    call 354
                    global.set 7
                    global.get 7
                    i32.const 1
                    i32.eq
                    if  ;; label = @9
                      i32.const 830
                      global.set 16
                      br 1 (;@8;)
                    end
                    global.get 7
                    i32.const 2
                    i32.eq
                    if  ;; label = @9
                      i32.const 842
                      global.set 16
                      br 1 (;@8;)
                    end
                    global.get 7
                    i32.const 3
                    i32.eq
                    if  ;; label = @9
                      i32.const 853
                      global.set 16
                      br 1 (;@8;)
                    end
                    global.get 7
                    i32.const 4
                    i32.eq
                    if  ;; label = @9
                      i32.const 867
                      global.set 16
                      br 1 (;@8;)
                    end
                    global.get 7
                    i32.const 5
                    i32.eq
                    if  ;; label = @9
                      i32.const 883
                      global.set 16
                      br 1 (;@8;)
                    end
                    global.get 7
                    i32.const 6
                    i32.eq
                    if  ;; label = @9
                      i32.const 901
                      global.set 16
                      br 1 (;@8;)
                    end
                    global.get 7
                    i32.const 7
                    i32.eq
                    if  ;; label = @9
                      i32.const 916
                      global.set 16
                      br 1 (;@8;)
                    end
                    global.get 7
                    i32.const 8
                    i32.eq
                    if  ;; label = @9
                      i32.const 928
                      global.set 16
                      br 1 (;@8;)
                    end
                    global.get 7
                    i32.const 9
                    i32.eq
                    if  ;; label = @9
                      i32.const 942
                      global.set 16
                      br 1 (;@8;)
                    end
                    global.get 7
                    i32.const 10
                    i32.eq
                    if  ;; label = @9
                      i32.const 961
                      global.set 16
                      br 1 (;@8;)
                    end
                    global.get 7
                    i32.const 11
                    i32.eq
                    if  ;; label = @9
                      i32.const 975
                      global.set 16
                      br 1 (;@8;)
                    end
                    global.get 7
                    i32.const 12
                    i32.eq
                    if  ;; label = @9
                      i32.const 989
                      global.set 16
                      br 1 (;@8;)
                    end
                    global.get 7
                    i32.const 13
                    i32.eq
                    if  ;; label = @9
                      i32.const 1008
                      global.set 16
                      br 1 (;@8;)
                    end
                  end
                else
                  i32.const 4
                  i32.const 8
                  call 354
                  global.set 48
                  i32.const 1
                  local.set 7
                  block  ;; label = @8
                    loop  ;; label = @9
                      local.get 7
                      global.get 48
                      i32.gt_s
                      br_if 1 (;@8;)
                      i32.const 3
                      i32.const 0
                      call 354
                      i32.const 1
                      i32.eq
                      if  ;; label = @10
                        global.get 16
                        i32.const 0
                        i32.const 9
                        call 354
                        i32.add
                        global.set 16
                      else
                        global.get 16
                        i32.const 97
                        i32.const 122
                        call 354
                        call 339
                        i32.add
                        global.set 16
                      end
                      local.get 7
                      i32.const 1
                      i32.add
                      local.set 7
                      br 0 (;@9;)
                    end
                  end
                end
                i32.const 1
                global.set 20
              end
              br 1 (;@4;)
            end
            global.get 7
            i32.const 1
            i32.eq
            if  ;; label = @5
              i32.const 1028
              local.set 6
              local.get 4
              if  ;; label = @6
                i32.const 0
                drop
                i32.const 2
                global.set 20
              end
              br 1 (;@4;)
            end
            global.get 7
            i32.const 2
            i32.eq
            if  ;; label = @5
              i32.const 1046
              local.set 6
              local.get 4
              if  ;; label = @6
                i32.const 3
                global.set 20
              end
              br 1 (;@4;)
            end
            global.get 7
            i32.const 3
            i32.eq
            if  ;; label = @5
              i32.const 1062
              local.set 6
              local.get 4
              if  ;; label = @6
                global.get 49
                call 282
                i32.const 0
                drop
              end
              br 1 (;@4;)
            end
          end
          local.get 0
          local.get 1
          local.get 2
          local.get 3
          local.get 6
          i32.const 1
          i32.const 0
          i32.const 1
          call 406
          drop
          local.get 5
          i32.const 1
          i32.add
          local.set 5
          br 0 (;@3;)
        end
      end
    else
      i32.const 159
      global.get 39
      i32.mul
      local.set 0
      i32.const 286
      global.get 39
      i32.mul
      local.set 1
      i32.const 400
      global.get 39
      i32.mul
      local.set 2
      i32.const 70
      global.get 39
      i32.mul
      local.set 3
      local.get 0
      local.get 1
      local.get 2
      local.get 3
      i32.const 0
      i32.const 0
      call 405
      drop
      local.get 0
      local.get 2
      i32.add
      i32.const 20
      global.get 39
      i32.mul
      i32.add
      local.get 1
      i32.const 580
      global.get 39
      i32.mul
      local.get 2
      i32.sub
      i32.const 20
      global.get 39
      i32.mul
      i32.sub
      local.get 3
      i32.const 1075
      i32.const 0
      i32.const 0
      i32.const 1
      call 406
      if  ;; label = @2
        block  ;; label = @3
          global.get 20
          global.set 7
          global.get 7
          i32.const 1
          i32.eq
          if  ;; label = @4
            global.get 50
            drop
            i32.const 1088
            drop
            i32.const 1104
            drop
            global.get 21
            drop
            f32.const 0x0p+0 (;=0;)
            drop
            i32.const 0
            global.set 20
            br 1 (;@3;)
          end
          global.get 7
          i32.const 2
          i32.eq
          if  ;; label = @4
            i32.const 0
            global.set 29
            i32.const 0
            global.set 20
            br 1 (;@3;)
          end
          global.get 7
          i32.const 3
          i32.eq
          global.get 7
          i32.const 5
          i32.eq
          i32.or
          global.get 7
          i32.const 6
          i32.eq
          i32.or
          global.get 7
          i32.const 7
          i32.eq
          i32.or
          if  ;; label = @4
            i32.const 0
            drop
            i32.const 0
            global.set 51
            i32.const 0
            global.set 52
            global.get 53
            drop
            i32.const 0
            drop
            i32.const 0
            global.set 20
            br 1 (;@3;)
          end
          global.get 7
          i32.const 4
          i32.eq
          if  ;; label = @4
            i32.const 1
            global.set 20
            i32.const 0
            global.set 29
            i32.const 0
            global.set 47
            br 1 (;@3;)
          end
          i32.const 0
          global.set 20
        end
      end
      block  ;; label = @2
        global.get 20
        global.set 7
        global.get 7
        i32.const 1
        i32.eq
        if  ;; label = @3
          i32.const 159
          global.get 39
          i32.mul
          local.set 0
          i32.const 286
          global.get 39
          i32.mul
          local.set 1
          i32.const 400
          global.get 39
          i32.mul
          local.set 2
          i32.const 70
          global.get 39
          i32.mul
          local.set 3
          i32.const 255
          i32.const 255
          i32.const 255
          call 6
          i32.const 0
          drop
          global.get 44
          drop
          i32.const 0
          drop
          local.get 0
          local.get 2
          i32.const 2
          i32.div_s
          i32.add
          drop
          local.get 1
          local.get 3
          i32.const 2
          i32.div_s
          i32.add
          drop
          i32.const 1126
          drop
          i32.const 1
          drop
          i32.const 1
          drop
          i32.const 0
          drop
          i32.const 160
          global.get 39
          i32.mul
          local.set 0
          local.get 1
          local.get 3
          i32.add
          i32.const 20
          global.get 39
          i32.mul
          i32.add
          local.set 1
          i32.const 580
          global.get 39
          i32.mul
          local.set 2
          i32.const 330
          global.get 39
          i32.mul
          local.set 3
          local.get 0
          local.get 1
          local.get 2
          local.get 3
          i32.const 0
          i32.const 0
          call 405
          drop
          global.get 42
          drop
          i32.const 0
          drop
          local.get 0
          i32.const 20
          global.get 39
          i32.mul
          i32.add
          drop
          local.get 1
          i32.const 20
          global.get 39
          i32.mul
          i32.add
          drop
          i32.const 1143
          drop
          i32.const 0
          drop
          local.get 0
          i32.const 150
          global.get 39
          i32.mul
          i32.add
          local.get 1
          i32.const 15
          global.get 39
          i32.mul
          i32.add
          i32.const 200
          global.get 39
          i32.mul
          i32.const 30
          global.get 39
          i32.mul
          global.get 25
          i32.const 1
          call 404
          global.set 25
          global.get 25
          i32.const 15
          call 327
          global.set 25
          global.get 25
          i32.const 1157
          i32.const 1167
          call 332
          global.set 25
          global.get 25
          i32.const 1176
          i32.const 1186
          call 332
          global.set 25
          global.get 25
          i32.const 1195
          i32.const 1205
          call 332
          global.set 25
          global.get 25
          i32.const 1214
          i32.const 1224
          call 332
          global.set 25
          global.get 25
          i32.const 1233
          i32.const 1243
          call 332
          global.set 25
          global.get 25
          i32.const 1252
          i32.const 1262
          call 332
          global.set 25
          global.get 25
          i32.const 1271
          i32.const 1281
          call 332
          global.set 25
          global.get 25
          i32.const 1290
          i32.const 1300
          call 332
          global.set 25
          global.get 25
          i32.const 34
          call 339
          i32.const 1309
          call 332
          global.set 25
          global.get 25
          i32.const 1318
          i32.const 1328
          call 332
          global.set 25
          i32.const 255
          i32.const 255
          i32.const 255
          call 6
          i32.const 0
          drop
          global.get 28
          i32.const 1337
          call 269
          if  ;; label = @4
            local.get 0
            i32.const 20
            global.get 39
            i32.mul
            i32.add
            drop
            local.get 1
            i32.const 60
            global.get 39
            i32.mul
            i32.add
            drop
            i32.const 1346
            drop
            i32.const 0
            drop
            local.get 0
            i32.const 150
            global.get 39
            i32.mul
            i32.add
            local.get 1
            i32.const 55
            global.get 39
            i32.mul
            i32.add
            i32.const 200
            global.get 39
            i32.mul
            i32.const 30
            global.get 39
            i32.mul
            global.get 16
            i32.const 3
            call 404
            i32.const 15
            call 327
            global.set 16
          else
            local.get 0
            i32.const 20
            global.get 39
            i32.mul
            i32.add
            drop
            local.get 1
            i32.const 60
            global.get 39
            i32.mul
            i32.add
            drop
            i32.const 1364
            drop
            i32.const 0
            drop
            i32.const 255
            i32.const 255
            i32.const 255
            call 6
            i32.const 0
            drop
            local.get 0
            i32.const 150
            global.get 39
            i32.mul
            i32.add
            local.get 1
            i32.const 55
            global.get 39
            i32.mul
            i32.add
            i32.const 200
            global.get 39
            i32.mul
            i32.const 30
            global.get 39
            i32.mul
            i32.const 0
            call 8
            i32.const 0
            drop
            i32.const 0
            i32.const 0
            i32.const 0
            call 6
            i32.const 0
            drop
            local.get 0
            i32.const 150
            global.get 39
            i32.mul
            i32.add
            i32.const 2
            i32.add
            local.get 1
            i32.const 55
            global.get 39
            i32.mul
            i32.add
            i32.const 2
            i32.add
            i32.const 200
            global.get 39
            i32.mul
            i32.const 4
            i32.sub
            i32.const 30
            global.get 39
            i32.mul
            i32.const 4
            i32.sub
            i32.const 0
            call 8
            i32.const 0
            drop
            i32.const 255
            i32.const 0
            i32.const 0
            call 6
            i32.const 0
            drop
            global.get 28
            call 334
            i32.const 15
            i32.gt_s
            if  ;; label = @5
              local.get 0
              i32.const 150
              global.get 39
              i32.mul
              i32.add
              i32.const 100
              global.get 39
              i32.mul
              i32.add
              drop
              local.get 1
              i32.const 55
              global.get 39
              i32.mul
              i32.add
              i32.const 15
              global.get 39
              i32.mul
              i32.add
              drop
              global.get 28
              i32.const 14
              call 327
              call 241
              i32.const 1386
              call 397
              drop
              i32.const 1
              drop
              i32.const 1
              drop
              i32.const 0
              drop
            else
              local.get 0
              i32.const 150
              global.get 39
              i32.mul
              i32.add
              i32.const 100
              global.get 39
              i32.mul
              i32.add
              drop
              local.get 1
              i32.const 55
              global.get 39
              i32.mul
              i32.add
              i32.const 15
              global.get 39
              i32.mul
              i32.add
              drop
              global.get 28
              drop
              i32.const 1
              drop
              i32.const 1
              drop
              i32.const 0
              drop
            end
            local.get 0
            i32.const 370
            global.get 39
            i32.mul
            i32.add
            local.get 1
            i32.const 55
            global.get 39
            i32.mul
            i32.add
            i32.const 120
            global.get 39
            i32.mul
            i32.const 30
            global.get 39
            i32.mul
            i32.const 1398
            i32.const 0
            i32.const 0
            i32.const 1
            call 406
            if  ;; label = @5
              i32.const 1415
              global.set 28
            end
          end
          local.get 0
          i32.const 20
          global.get 39
          i32.mul
          i32.add
          drop
          local.get 1
          i32.const 110
          global.get 39
          i32.mul
          i32.add
          drop
          i32.const 1424
          drop
          i32.const 0
          drop
          local.get 0
          i32.const 280
          global.get 39
          i32.mul
          i32.add
          local.get 1
          i32.const 110
          global.get 39
          i32.mul
          i32.add
          global.get 21
          i32.const 0
          call 408
          global.set 21
          local.get 0
          i32.const 20
          global.get 39
          i32.mul
          i32.add
          drop
          local.get 1
          i32.const 150
          global.get 39
          i32.mul
          i32.add
          drop
          i32.const 1455
          drop
          i32.const 0
          drop
          global.get 54
          local.set 7
          block  ;; label = @4
            loop  ;; label = @5
              local.get 7
              global.get 55
              i32.gt_s
              br_if 1 (;@4;)
              local.get 0
              i32.const 20
              global.get 39
              i32.mul
              i32.add
              local.get 1
              i32.const 180
              i32.const 30
              local.get 7
              i32.mul
              i32.add
              global.get 39
              i32.mul
              i32.add
              global.get 56
              local.get 7
              drop
              i32.const 0
              i32.eq
              i32.const 0
              call 408
              if  ;; label = @6
                local.get 7
                drop
                i32.const 0
                global.set 56
              end
              i32.const 0
              i32.const 0
              i32.const 0
              call 6
              i32.const 0
              drop
              local.get 0
              i32.const 60
              global.get 39
              i32.mul
              i32.add
              drop
              local.get 1
              i32.const 180
              i32.const 30
              local.get 7
              i32.mul
              i32.add
              global.get 39
              i32.mul
              i32.add
              drop
              i32.const 0
              drop
              i32.const 0
              drop
              local.get 7
              i32.const 1
              i32.add
              local.set 7
              br 0 (;@5;)
            end
          end
          i32.const 255
          i32.const 255
          i32.const 255
          call 6
          i32.const 0
          drop
          local.get 0
          i32.const 150
          global.get 39
          i32.mul
          i32.add
          local.get 1
          i32.const 155
          global.get 39
          i32.mul
          i32.add
          i32.const 410
          global.get 39
          i32.mul
          i32.const 150
          global.get 39
          i32.mul
          i32.const 0
          i32.const 0
          call 405
          drop
          i32.const 0
          if  ;; label = @4
            global.get 56
            drop
            local.get 0
            i32.const 160
            global.get 39
            i32.mul
            i32.add
            local.get 1
            i32.const 165
            global.get 39
            i32.mul
            i32.add
            i32.const 0
            i32.const 0
            call 408
            drop
            local.get 0
            i32.const 200
            global.get 39
            i32.mul
            i32.add
            drop
            local.get 1
            i32.const 165
            global.get 39
            i32.mul
            i32.add
            drop
            i32.const 1475
            drop
            i32.const 0
            drop
            local.get 0
            i32.const 160
            global.get 39
            i32.mul
            i32.add
            local.get 1
            i32.const 195
            global.get 39
            i32.mul
            i32.add
            i32.const 0
            global.get 57
            i32.eq
            i32.const 0
            i32.and
            i32.const 0
            call 408
            if  ;; label = @5
              global.get 56
              drop
              global.get 57
              drop
            else
              global.get 56
              drop
              global.get 58
              drop
            end
            local.get 0
            i32.const 200
            global.get 39
            i32.mul
            i32.add
            drop
            local.get 1
            i32.const 195
            global.get 39
            i32.mul
            i32.add
            drop
            i32.const 1494
            drop
            i32.const 0
            drop
            global.get 56
            drop
            local.get 0
            i32.const 160
            global.get 39
            i32.mul
            i32.add
            local.get 1
            i32.const 225
            global.get 39
            i32.mul
            i32.add
            i32.const 0
            i32.const 0
            call 408
            drop
            local.get 0
            i32.const 200
            global.get 39
            i32.mul
            i32.add
            drop
            local.get 1
            i32.const 225
            global.get 39
            i32.mul
            i32.add
            drop
            i32.const 1516
            drop
            i32.const 0
            drop
            i32.const 255
            i32.const 255
            i32.const 255
            call 6
            i32.const 0
            drop
            i32.const 1
            drop
            i32.const 0
            local.get 0
            i32.const 155
            global.get 39
            i32.mul
            i32.add
            local.get 1
            i32.const 251
            global.get 39
            i32.mul
            i32.add
            i32.const 0
            call 16
            i32.const 0
            drop
            global.get 47
            if  ;; label = @5
              i32.const 1
              drop
              i32.const 0
              drop
              local.get 0
              i32.const 155
              global.get 39
              i32.mul
              i32.add
              drop
              local.get 1
              i32.const 251
              global.get 39
              i32.mul
              i32.add
              drop
              i32.const 0
              drop
              i32.const 0
              drop
              i32.const 0
              drop
              i32.const 0
              drop
              i32.const 0
              if  ;; label = @6
                i32.const 0
                global.get 59
                i32.lt_s
                if  ;; label = @7
                  global.get 56
                  drop
                  i32.const 0
                  i32.const 1
                  i32.add
                  drop
                else
                  global.get 56
                  drop
                  global.get 60
                  drop
                end
                global.get 61
                call 143
                drop
              end
            end
            i32.const 255
            i32.const 255
            i32.const 255
            call 6
            i32.const 0
            drop
            block  ;; label = @5
              i32.const 0
              global.set 7
              global.get 7
              global.get 60
              i32.eq
              if  ;; label = @6
                local.get 0
                i32.const 200
                global.get 39
                i32.mul
                i32.add
                drop
                local.get 1
                i32.const 255
                global.get 39
                i32.mul
                i32.add
                drop
                i32.const 1540
                drop
                i32.const 0
                drop
                br 1 (;@5;)
              end
              global.get 7
              global.get 62
              i32.eq
              if  ;; label = @6
                local.get 0
                i32.const 200
                global.get 39
                i32.mul
                i32.add
                drop
                local.get 1
                i32.const 255
                global.get 39
                i32.mul
                i32.add
                drop
                i32.const 1579
                drop
                i32.const 0
                drop
                br 1 (;@5;)
              end
              global.get 7
              global.get 59
              i32.eq
              if  ;; label = @6
                local.get 0
                i32.const 200
                global.get 39
                i32.mul
                i32.add
                drop
                local.get 1
                i32.const 255
                global.get 39
                i32.mul
                i32.add
                drop
                i32.const 1620
                drop
                i32.const 0
                drop
                br 1 (;@5;)
              end
            end
          else
            i32.const 0
            local.get 0
            i32.const 160
            global.get 39
            i32.mul
            i32.add
            local.get 1
            i32.const 160
            global.get 39
            i32.mul
            i32.add
            i32.const 410
            i32.const 20
            i32.sub
            global.get 39
            i32.mul
            i32.const 200
            i32.const 0
            i32.const 1
            f32.convert_i32_s
            call 410
            drop
          end
          local.get 0
          local.get 1
          local.get 3
          i32.add
          i32.const 20
          global.get 39
          i32.mul
          i32.add
          i32.const 160
          global.get 39
          i32.mul
          i32.const 70
          global.get 39
          i32.mul
          i32.const 1659
          i32.const 0
          i32.const 0
          i32.const 1
          call 406
          if  ;; label = @4
            i32.const 4
            global.set 20
            i32.const 0
            drop
          end
          global.get 44
          drop
          i32.const 0
          drop
          local.get 0
          i32.const 420
          global.get 39
          i32.mul
          i32.add
          local.get 1
          local.get 3
          i32.add
          i32.const 20
          global.get 39
          i32.mul
          i32.add
          i32.const 160
          global.get 39
          i32.mul
          i32.const 70
          global.get 39
          i32.mul
          i32.const 1676
          i32.const 0
          i32.const 0
          i32.const 1
          call 406
          if  ;; label = @4
            global.get 25
            i32.const 1690
            call 269
            if  ;; label = @5
              i32.const 1699
              global.set 25
            end
            global.get 16
            i32.const 1716
            call 269
            if  ;; label = @5
              i32.const 0
              global.set 16
              call 324
              drop
            end
            global.get 16
            drop
            i32.const 0
            call 355
            i32.const 0
            drop
            i32.const 0
            local.set 8
            i32.const 1
            local.set 5
            block  ;; label = @5
              loop  ;; label = @6
                local.get 5
                global.get 26
                i32.gt_s
                br_if 1 (;@5;)
                local.get 7
                i32.const 1
                i32.sub
                drop
                i32.const 0
                global.get 25
                i32.eq
                if  ;; label = @7
                  local.get 8
                  i32.const 1
                  i32.add
                  local.set 8
                end
                local.get 5
                i32.const 1
                i32.add
                local.set 5
                br 0 (;@6;)
              end
            end
            local.get 8
            i32.const 0
            i32.gt_s
            if  ;; label = @5
              global.get 25
              call 241
              i32.const 1725
              call 397
              local.get 8
              i32.const 1
              i32.add
              call 241
              call 397
              i32.const 1736
              call 397
              global.set 25
            end
            i32.const 0
            drop
            i32.const 0
            drop
            i32.const 0
            drop
            i32.const 0
            global.set 63
            i32.const 0
            drop
            i32.const 0
            drop
            global.get 50
            drop
            i32.const 1746
            drop
            i32.const 1762
            drop
            global.get 21
            drop
            f32.const 0x0p+0 (;=0;)
            drop
          end
          br 1 (;@2;)
        end
        global.get 7
        i32.const 2
        i32.eq
        if  ;; label = @3
          local.get 1
          local.get 3
          i32.add
          i32.const 20
          global.get 39
          i32.mul
          i32.add
          local.set 1
          i32.const 580
          global.get 39
          i32.mul
          local.set 2
          i32.const 510
          global.get 39
          i32.mul
          local.set 3
          local.get 0
          local.get 1
          local.get 2
          local.get 3
          i32.const 0
          i32.const 0
          call 405
          drop
          i32.const 159
          global.get 39
          i32.mul
          local.set 0
          i32.const 286
          global.get 39
          i32.mul
          local.set 1
          i32.const 400
          global.get 39
          i32.mul
          local.set 2
          i32.const 70
          global.get 39
          i32.mul
          local.set 3
          i32.const 255
          i32.const 255
          i32.const 255
          call 6
          i32.const 0
          drop
          global.get 44
          drop
          i32.const 0
          drop
          local.get 0
          local.get 2
          i32.const 2
          i32.div_s
          i32.add
          drop
          local.get 1
          local.get 3
          i32.const 2
          i32.div_s
          i32.add
          drop
          i32.const 1784
          drop
          i32.const 1
          drop
          i32.const 1
          drop
          i32.const 0
          drop
          i32.const 160
          global.get 39
          i32.mul
          local.set 0
          local.get 1
          local.get 3
          i32.add
          i32.const 20
          global.get 39
          i32.mul
          i32.add
          local.set 1
          i32.const 580
          global.get 39
          i32.mul
          local.set 2
          i32.const 296
          global.get 39
          i32.mul
          local.set 3
          global.get 44
          drop
          i32.const 0
          drop
          global.get 29
          f32.convert_i32_s
          global.get 26
          f32.convert_i32_s
          f32.const 0x1.8p+2 (;=6;)
          f32.div
          call 360
          i32.const 1
          f32.convert_i32_s
          f32.sub
          f32.lt
          global.get 24
          i32.const 1802
          call 269
          i32.and
          if  ;; label = @4
            local.get 0
            i32.const 530
            global.get 39
            i32.mul
            i32.add
            local.get 1
            i32.const 510
            global.get 39
            i32.mul
            i32.add
            i32.const 50
            global.get 39
            i32.mul
            i32.const 55
            global.get 39
            i32.mul
            i32.const 1811
            i32.const 1
            i32.const 0
            i32.const 1
            call 406
            if  ;; label = @5
              global.get 29
              i32.const 1
              i32.add
              global.set 29
            end
          else
            local.get 0
            i32.const 530
            global.get 39
            i32.mul
            i32.add
            local.get 1
            i32.const 510
            global.get 39
            i32.mul
            i32.add
            i32.const 50
            global.get 39
            i32.mul
            i32.const 55
            global.get 39
            i32.mul
            i32.const 0
            i32.const 0
            call 405
            drop
            i32.const 100
            i32.const 100
            i32.const 100
            call 6
            i32.const 0
            drop
            local.get 0
            i32.const 555
            global.get 39
            i32.mul
            i32.add
            drop
            local.get 1
            f32.convert_i32_s
            f32.const 0x1.0ccp+9 (;=537.5;)
            global.get 39
            f32.convert_i32_s
            f32.mul
            f32.add
            drop
            i32.const 1821
            drop
            i32.const 1
            drop
            i32.const 1
            drop
            i32.const 0
            drop
          end
          global.get 29
          i32.const 0
          i32.gt_s
          global.get 24
          i32.const 1831
          call 269
          i32.and
          if  ;; label = @4
            local.get 0
            local.get 1
            i32.const 510
            global.get 39
            i32.mul
            i32.add
            i32.const 50
            global.get 39
            i32.mul
            i32.const 55
            global.get 39
            i32.mul
            i32.const 1840
            i32.const 1
            i32.const 0
            i32.const 1
            call 406
            if  ;; label = @5
              global.get 29
              i32.const 1
              i32.sub
              global.set 29
            end
          else
            local.get 0
            local.get 1
            i32.const 510
            global.get 39
            i32.mul
            i32.add
            i32.const 50
            global.get 39
            i32.mul
            i32.const 55
            global.get 39
            i32.mul
            i32.const 0
            i32.const 0
            call 405
            drop
            i32.const 100
            i32.const 100
            i32.const 100
            call 6
            i32.const 0
            drop
            local.get 0
            i32.const 25
            global.get 39
            i32.mul
            i32.add
            drop
            local.get 1
            f32.convert_i32_s
            f32.const 0x1.0ccp+9 (;=537.5;)
            global.get 39
            f32.convert_i32_s
            f32.mul
            f32.add
            drop
            i32.const 1850
            drop
            i32.const 1
            drop
            i32.const 1
            drop
            i32.const 0
            drop
          end
          local.get 0
          i32.const 50
          global.get 39
          i32.mul
          i32.add
          local.get 1
          i32.const 510
          global.get 39
          i32.mul
          i32.add
          local.get 2
          i32.const 100
          global.get 39
          i32.mul
          i32.sub
          i32.const 55
          global.get 39
          i32.mul
          i32.const 0
          i32.const 0
          call 405
          drop
          local.get 0
          f32.convert_i32_s
          local.get 2
          f32.convert_i32_s
          f32.const 0x1p+1 (;=2;)
          f32.div
          f32.add
          drop
          local.get 1
          i32.const 536
          global.get 39
          i32.mul
          i32.add
          drop
          i32.const 1860
          global.get 29
          i32.const 1
          i32.add
          f32.convert_i32_s
          i32.const 1
          f32.convert_i32_s
          call 357
          i32.trunc_f32_s
          call 241
          call 397
          i32.const 1874
          call 397
          global.get 26
          f32.convert_i32_s
          f32.const 0x1.8p+2 (;=6;)
          f32.div
          call 360
          i32.trunc_f32_s
          f32.convert_i32_s
          i32.const 1
          f32.convert_i32_s
          call 357
          i32.trunc_f32_s
          call 241
          call 397
          drop
          i32.const 1
          drop
          i32.const 1
          drop
          i32.const 0
          drop
          global.get 42
          drop
          i32.const 0
          drop
          global.get 29
          f32.convert_i32_s
          global.get 26
          f32.convert_i32_s
          f32.const 0x1.8p+2 (;=6;)
          f32.div
          call 360
          i32.const 1
          f32.convert_i32_s
          f32.sub
          f32.gt
          if  ;; label = @4
            global.get 29
            i32.const 1
            i32.sub
            global.set 29
          end
          global.get 26
          i32.const 0
          i32.eq
          if  ;; label = @4
            local.get 0
            i32.const 20
            global.get 39
            i32.mul
            i32.add
            drop
            local.get 1
            i32.const 20
            global.get 39
            i32.mul
            i32.add
            drop
            i32.const 1884
            drop
            i32.const 0
            drop
          else
            local.get 0
            i32.const 20
            global.get 39
            i32.mul
            i32.add
            local.set 0
            local.get 1
            i32.const 20
            global.get 39
            i32.mul
            i32.add
            local.set 1
            i32.const 1
            i32.const 6
            global.get 29
            i32.mul
            i32.add
            local.set 5
            block  ;; label = @5
              loop  ;; label = @6
                local.get 5
                i32.const 6
                i32.const 6
                global.get 29
                i32.mul
                i32.add
                i32.gt_s
                br_if 1 (;@5;)
                local.get 7
                global.get 26
                i32.le_s
                if  ;; label = @7
                  local.get 0
                  local.get 1
                  i32.const 540
                  global.get 39
                  i32.mul
                  i32.const 70
                  global.get 39
                  i32.mul
                  i32.const 0
                  i32.const 0
                  call 405
                  drop
                  local.get 7
                  i32.const 1
                  i32.sub
                  drop
                  i32.const 0
                  global.get 64
                  i32.ne
                  local.get 7
                  i32.const 1
                  i32.sub
                  drop
                  i32.const 0
                  i32.const 1908
                  call 269
                  i32.eqz
                  i32.and
                  if  ;; label = @8
                    i32.const 255
                    i32.const 0
                    i32.const 0
                    call 6
                    i32.const 0
                    drop
                  else
                    i32.const 255
                    i32.const 255
                    i32.const 255
                    call 6
                    i32.const 0
                    drop
                  end
                  local.get 0
                  i32.const 20
                  global.get 39
                  i32.mul
                  i32.add
                  drop
                  local.get 1
                  i32.const 10
                  global.get 39
                  i32.mul
                  i32.add
                  drop
                  local.get 7
                  i32.const 1
                  i32.sub
                  drop
                  i32.const 0
                  drop
                  i32.const 0
                  drop
                  local.get 0
                  i32.const 20
                  global.get 39
                  i32.mul
                  i32.add
                  drop
                  local.get 1
                  i32.const 10
                  i32.const 18
                  i32.add
                  global.get 39
                  i32.mul
                  i32.add
                  drop
                  local.get 7
                  i32.const 1
                  i32.sub
                  drop
                  i32.const 0
                  drop
                  i32.const 0
                  drop
                  local.get 0
                  i32.const 120
                  global.get 39
                  i32.mul
                  i32.add
                  drop
                  local.get 1
                  i32.const 10
                  i32.const 18
                  i32.add
                  global.get 39
                  i32.mul
                  i32.add
                  drop
                  local.get 7
                  i32.const 1
                  i32.sub
                  drop
                  i32.const 0
                  drop
                  i32.const 0
                  drop
                  local.get 0
                  i32.const 20
                  global.get 39
                  i32.mul
                  i32.add
                  drop
                  local.get 1
                  i32.const 10
                  i32.const 36
                  i32.add
                  global.get 39
                  i32.mul
                  i32.add
                  drop
                  local.get 7
                  i32.const 1
                  i32.sub
                  drop
                  i32.const 0
                  drop
                  i32.const 0
                  drop
                  global.get 24
                  i32.const 1923
                  call 269
                  if  ;; label = @8
                    local.get 7
                    i32.const 1
                    i32.sub
                    drop
                    i32.const 0
                    global.get 64
                    i32.ne
                    local.get 7
                    i32.const 1
                    i32.sub
                    drop
                    i32.const 0
                    i32.const 1932
                    call 269
                    i32.eqz
                    i32.and
                    if  ;; label = @9
                      local.get 0
                      i32.const 280
                      global.get 39
                      i32.mul
                      i32.add
                      local.get 1
                      i32.const 20
                      global.get 39
                      i32.mul
                      i32.add
                      i32.const 100
                      global.get 39
                      i32.mul
                      i32.const 30
                      global.get 39
                      i32.mul
                      i32.const 0
                      i32.const 0
                      call 405
                      drop
                      i32.const 255
                      i32.const 0
                      i32.const 0
                      call 6
                      i32.const 0
                      drop
                      local.get 0
                      i32.const 330
                      global.get 39
                      i32.mul
                      i32.add
                      drop
                      local.get 1
                      i32.const 34
                      global.get 39
                      i32.mul
                      i32.add
                      drop
                      i32.const 1947
                      drop
                      i32.const 1
                      drop
                      i32.const 1
                      drop
                      i32.const 0
                      drop
                    else
                      local.get 0
                      i32.const 280
                      global.get 39
                      i32.mul
                      i32.add
                      local.get 1
                      i32.const 20
                      global.get 39
                      i32.mul
                      i32.add
                      i32.const 100
                      global.get 39
                      i32.mul
                      i32.const 30
                      global.get 39
                      i32.mul
                      i32.const 1960
                      i32.const 0
                      i32.const 0
                      i32.const 1
                      call 406
                      if  ;; label = @10
                        i32.const 0
                        drop
                        i32.const 0
                        drop
                        global.get 23
                        local.get 7
                        i32.const 1
                        i32.sub
                        drop
                        i32.const 0
                        i32.add
                        call 241
                        i32.const 1973
                        call 397
                        drop
                        i32.const 0
                        drop
                        local.get 7
                        i32.const 1
                        i32.sub
                        drop
                        i32.const 0
                        global.set 25
                        i32.const 0
                        drop
                        i32.const 0
                        global.set 63
                      end
                    end
                    local.get 0
                    i32.const 400
                    global.get 39
                    i32.mul
                    i32.add
                    local.get 1
                    i32.const 20
                    global.get 39
                    i32.mul
                    i32.add
                    i32.const 100
                    global.get 39
                    i32.mul
                    i32.const 30
                    global.get 39
                    i32.mul
                    i32.const 1983
                    i32.const 0
                    i32.const 0
                    i32.const 1
                    call 406
                    if  ;; label = @9
                      local.get 7
                      i32.const 1
                      i32.sub
                      drop
                      i32.const 0
                      global.set 24
                      global.get 24
                      call 145
                      i32.const 0
                      drop
                      br 4 (;@5;)
                    end
                  else
                    local.get 0
                    i32.const 280
                    global.get 39
                    i32.mul
                    i32.add
                    local.get 1
                    i32.const 20
                    global.get 39
                    i32.mul
                    i32.add
                    i32.const 100
                    global.get 39
                    i32.mul
                    i32.const 30
                    global.get 39
                    i32.mul
                    i32.const 0
                    i32.const 0
                    call 405
                    drop
                    local.get 7
                    i32.const 1
                    i32.sub
                    drop
                    i32.const 0
                    global.get 64
                    i32.ne
                    local.get 7
                    i32.const 1
                    i32.sub
                    drop
                    i32.const 0
                    i32.const 1998
                    call 269
                    i32.eqz
                    i32.and
                    if  ;; label = @9
                      i32.const 255
                      i32.const 0
                      i32.const 0
                      call 6
                      i32.const 0
                      drop
                    else
                      i32.const 100
                      i32.const 100
                      i32.const 100
                      call 6
                      i32.const 0
                      drop
                    end
                    local.get 0
                    i32.const 330
                    global.get 39
                    i32.mul
                    i32.add
                    drop
                    local.get 1
                    i32.const 34
                    global.get 39
                    i32.mul
                    i32.add
                    drop
                    i32.const 2013
                    drop
                    i32.const 1
                    drop
                    i32.const 1
                    drop
                    i32.const 0
                    drop
                    local.get 0
                    i32.const 400
                    global.get 39
                    i32.mul
                    i32.add
                    local.get 1
                    i32.const 20
                    global.get 39
                    i32.mul
                    i32.add
                    i32.const 100
                    global.get 39
                    i32.mul
                    i32.const 30
                    global.get 39
                    i32.mul
                    i32.const 0
                    i32.const 0
                    call 405
                    drop
                    i32.const 100
                    i32.const 100
                    i32.const 100
                    call 6
                    i32.const 0
                    drop
                    local.get 0
                    i32.const 450
                    global.get 39
                    i32.mul
                    i32.add
                    drop
                    local.get 1
                    i32.const 34
                    global.get 39
                    i32.mul
                    i32.add
                    drop
                    i32.const 2026
                    drop
                    i32.const 1
                    drop
                    i32.const 1
                    drop
                    i32.const 0
                    drop
                  end
                  local.get 1
                  i32.const 80
                  global.get 39
                  i32.mul
                  i32.add
                  local.set 1
                else
                  br 2 (;@5;)
                end
                local.get 5
                i32.const 1
                i32.add
                local.set 5
                br 0 (;@6;)
              end
            end
            global.get 24
            i32.const 2041
            call 269
            i32.eqz
            if  ;; label = @5
              i32.const 740
              global.get 39
              i32.mul
              local.set 0
              i32.const 376
              global.get 39
              i32.mul
              local.set 1
              local.get 0
              local.get 1
              i32.const 420
              global.get 39
              i32.mul
              i32.const 200
              global.get 39
              i32.mul
              i32.const 0
              i32.const 0
              call 405
              drop
              i32.const 2050
              local.get 0
              i32.const 20
              global.get 39
              i32.mul
              i32.add
              local.get 1
              i32.const 15
              global.get 39
              i32.mul
              i32.add
              i32.const 400
              global.get 39
              i32.mul
              i32.const 200
              global.get 39
              i32.mul
              i32.const 0
              i32.const 1
              f32.convert_i32_s
              call 410
              drop
              local.get 0
              i32.const 50
              global.get 39
              i32.mul
              i32.add
              local.get 1
              i32.const 150
              global.get 39
              i32.mul
              i32.add
              i32.const 100
              global.get 39
              i32.mul
              i32.const 30
              global.get 39
              i32.mul
              i32.const 2101
              i32.const 0
              i32.const 0
              i32.const 1
              call 406
              if  ;; label = @6
                i32.const 0
                global.get 23
                i32.add
                global.get 24
                i32.add
                call 241
                i32.const 2113
                call 397
                drop
                i32.const 0
                drop
                i32.const 0
                global.get 23
                i32.add
                global.get 24
                i32.add
                drop
                i32.const 0
                drop
                i32.const 2131
                global.set 24
                i32.const 0
                drop
              end
              local.get 0
              i32.const 250
              global.get 39
              i32.mul
              i32.add
              local.get 1
              i32.const 150
              global.get 39
              i32.mul
              i32.add
              i32.const 100
              global.get 39
              i32.mul
              i32.const 30
              global.get 39
              i32.mul
              i32.const 2140
              i32.const 0
              i32.const 0
              i32.const 1
              call 406
              if  ;; label = @6
                i32.const 2151
                global.set 24
              end
            end
          end
          br 1 (;@2;)
        end
        global.get 7
        i32.const 3
        i32.eq
        global.get 7
        i32.const 5
        i32.eq
        i32.or
        global.get 7
        i32.const 6
        i32.eq
        i32.or
        global.get 7
        i32.const 7
        i32.eq
        i32.or
        if  ;; label = @3
          i32.const 159
          global.get 39
          i32.mul
          local.set 0
          i32.const 286
          global.get 39
          i32.mul
          local.set 1
          i32.const 400
          global.get 39
          i32.mul
          local.set 2
          i32.const 70
          global.get 39
          i32.mul
          local.set 3
          i32.const 255
          i32.const 255
          i32.const 255
          call 6
          i32.const 0
          drop
          global.get 44
          drop
          i32.const 0
          drop
          local.get 0
          local.get 2
          i32.const 2
          i32.div_s
          i32.add
          drop
          local.get 1
          local.get 3
          i32.const 2
          i32.div_s
          i32.add
          drop
          i32.const 2160
          drop
          i32.const 1
          drop
          i32.const 1
          drop
          i32.const 0
          drop
          i32.const 160
          global.get 39
          i32.mul
          local.set 0
          local.get 1
          local.get 3
          i32.add
          i32.const 20
          global.get 39
          i32.mul
          i32.add
          local.set 1
          i32.const 580
          global.get 39
          i32.mul
          local.set 2
          i32.const 60
          global.get 39
          i32.mul
          local.set 3
          local.get 0
          local.get 1
          local.get 2
          local.get 3
          i32.const 0
          i32.const 0
          call 405
          drop
          i32.const 0
          i32.const 255
          i32.const 0
          call 6
          i32.const 0
          drop
          global.get 20
          i32.const 3
          i32.eq
          if  ;; label = @4
            local.get 0
            i32.const 15
            global.get 39
            i32.mul
            i32.add
            local.get 1
            i32.const 10
            global.get 39
            i32.mul
            i32.add
            local.get 2
            i32.const 5
            i32.div_s
            i32.const 10
            global.get 39
            i32.mul
            i32.add
            local.get 3
            i32.const 2
            i32.div_s
            i32.const 10
            global.get 39
            i32.mul
            i32.add
            i32.const 1
            call 8
            i32.const 0
            drop
          else
            global.get 20
            i32.const 5
            i32.eq
            if  ;; label = @5
              local.get 0
              i32.const 155
              global.get 39
              i32.mul
              i32.add
              local.get 1
              i32.const 10
              global.get 39
              i32.mul
              i32.add
              local.get 2
              i32.const 5
              i32.div_s
              i32.const 10
              global.get 39
              i32.mul
              i32.add
              local.get 3
              i32.const 2
              i32.div_s
              i32.const 10
              global.get 39
              i32.mul
              i32.add
              i32.const 1
              call 8
              i32.const 0
              drop
            else
              global.get 20
              i32.const 6
              i32.eq
              if  ;; label = @6
                local.get 0
                i32.const 295
                global.get 39
                i32.mul
                i32.add
                local.get 1
                i32.const 10
                global.get 39
                i32.mul
                i32.add
                local.get 2
                i32.const 5
                i32.div_s
                i32.const 10
                global.get 39
                i32.mul
                i32.add
                local.get 3
                i32.const 2
                i32.div_s
                i32.const 10
                global.get 39
                i32.mul
                i32.add
                i32.const 1
                call 8
                i32.const 0
                drop
              else
                global.get 20
                i32.const 7
                i32.eq
                if  ;; label = @7
                  local.get 0
                  i32.const 435
                  global.get 39
                  i32.mul
                  i32.add
                  local.get 1
                  i32.const 10
                  global.get 39
                  i32.mul
                  i32.add
                  local.get 2
                  i32.const 5
                  i32.div_s
                  i32.const 10
                  global.get 39
                  i32.mul
                  i32.add
                  local.get 3
                  i32.const 2
                  i32.div_s
                  i32.const 10
                  global.get 39
                  i32.mul
                  i32.add
                  i32.const 1
                  call 8
                  i32.const 0
                  drop
                end
              end
            end
          end
          i32.const 255
          i32.const 255
          i32.const 255
          call 6
          i32.const 0
          drop
          local.get 0
          i32.const 20
          global.get 39
          i32.mul
          i32.add
          local.get 1
          i32.const 15
          global.get 39
          i32.mul
          i32.add
          local.get 2
          i32.const 5
          i32.div_s
          local.get 3
          i32.const 2
          i32.div_s
          i32.const 2176
          i32.const 0
          i32.const 0
          i32.const 1
          call 406
          if  ;; label = @4
            i32.const 3
            global.set 20
          end
          local.get 0
          i32.const 160
          global.get 39
          i32.mul
          i32.add
          local.get 1
          i32.const 15
          global.get 39
          i32.mul
          i32.add
          local.get 2
          i32.const 5
          i32.div_s
          local.get 3
          i32.const 2
          i32.div_s
          i32.const 2193
          i32.const 0
          i32.const 0
          i32.const 1
          call 406
          if  ;; label = @4
            i32.const 5
            global.set 20
          end
          local.get 0
          i32.const 300
          global.get 39
          i32.mul
          i32.add
          local.get 1
          i32.const 15
          global.get 39
          i32.mul
          i32.add
          local.get 2
          i32.const 5
          i32.div_s
          local.get 3
          i32.const 2
          i32.div_s
          i32.const 2207
          i32.const 0
          i32.const 0
          i32.const 1
          call 406
          if  ;; label = @4
            i32.const 6
            global.set 20
          end
          local.get 0
          i32.const 440
          global.get 39
          i32.mul
          i32.add
          local.get 1
          i32.const 15
          global.get 39
          i32.mul
          i32.add
          local.get 2
          i32.const 5
          i32.div_s
          local.get 3
          i32.const 2
          i32.div_s
          i32.const 2224
          i32.const 0
          i32.const 0
          i32.const 1
          call 406
          if  ;; label = @4
            i32.const 7
            global.set 20
          end
          global.get 42
          drop
          i32.const 0
          drop
          local.get 1
          i32.const 70
          global.get 39
          i32.mul
          i32.add
          local.set 1
          global.get 20
          i32.const 5
          i32.ne
          if  ;; label = @4
            i32.const 0
            global.set 51
            i32.const 0
            global.set 52
          end
          local.get 0
          local.get 2
          i32.add
          f32.convert_i32_s
          local.set 9
          local.get 1
          f32.convert_i32_s
          local.set 10
          i32.const 400
          global.get 39
          i32.mul
          f32.convert_i32_s
          local.set 11
          i32.const 150
          global.get 39
          i32.mul
          f32.convert_i32_s
          local.set 12
          global.get 20
          i32.const 3
          i32.eq
          if  ;; label = @4
            i32.const 330
            global.get 39
            i32.mul
            local.set 3
            local.get 0
            local.get 1
            local.get 2
            local.get 3
            i32.const 0
            i32.const 0
            call 405
            drop
            local.get 1
            i32.const 20
            global.get 39
            i32.mul
            i32.add
            local.set 1
            i32.const 255
            i32.const 255
            i32.const 255
            call 6
            i32.const 0
            drop
            local.get 0
            i32.const 20
            global.get 39
            i32.mul
            i32.add
            drop
            local.get 1
            drop
            i32.const 2241
            drop
            i32.const 0
            drop
            local.get 0
            i32.const 310
            global.get 39
            i32.mul
            i32.add
            local.get 1
            global.get 39
            i32.add
            global.get 65
            i32.const 0
            call 408
            global.set 65
            local.get 0
            i32.const 310
            global.get 39
            i32.mul
            i32.add
            drop
            local.get 1
            global.get 39
            i32.add
            drop
            i32.const 20
            global.get 39
            i32.mul
            drop
            i32.const 20
            global.get 39
            i32.mul
            drop
            i32.const 0
            global.get 33
            i32.const 0
            i32.eq
            i32.and
            if  ;; label = @5
              local.get 9
              i32.trunc_f32_s
              local.get 10
              i32.trunc_f32_s
              local.get 11
              i32.trunc_f32_s
              local.get 12
              i32.trunc_f32_s
              i32.const 2270
              i32.const 0
              f32.convert_i32_s
              i32.const 0
              call 417
              drop
            end
            local.get 1
            i32.const 30
            global.get 39
            i32.mul
            i32.add
            local.set 1
            i32.const 255
            i32.const 255
            i32.const 255
            call 6
            i32.const 0
            drop
            local.get 0
            i32.const 20
            global.get 39
            i32.mul
            i32.add
            drop
            local.get 1
            drop
            i32.const 2283
            drop
            i32.const 0
            drop
            local.get 0
            i32.const 310
            global.get 39
            i32.mul
            i32.add
            local.get 1
            global.get 39
            i32.add
            global.get 66
            i32.const 0
            call 408
            global.set 66
            local.get 0
            i32.const 310
            global.get 39
            i32.mul
            i32.add
            drop
            local.get 1
            global.get 39
            i32.add
            drop
            i32.const 20
            global.get 39
            i32.mul
            drop
            i32.const 20
            global.get 39
            i32.mul
            drop
            i32.const 0
            global.get 33
            i32.const 0
            i32.eq
            i32.and
            if  ;; label = @5
              local.get 9
              i32.trunc_f32_s
              local.get 10
              i32.trunc_f32_s
              local.get 11
              i32.trunc_f32_s
              local.get 12
              i32.trunc_f32_s
              i32.const 2298
              i32.const 0
              f32.convert_i32_s
              i32.const 0
              call 417
              drop
            end
            local.get 1
            i32.const 30
            global.get 39
            i32.mul
            i32.add
            local.set 1
            i32.const 255
            i32.const 255
            i32.const 255
            call 6
            i32.const 0
            drop
            local.get 0
            i32.const 20
            global.get 39
            i32.mul
            i32.add
            drop
            local.get 1
            drop
            i32.const 2312
            drop
            i32.const 0
            drop
            local.get 0
            i32.const 310
            global.get 39
            i32.mul
            i32.add
            local.get 1
            global.get 39
            i32.add
            global.get 53
            i32.const 0
            call 408
            global.set 53
            local.get 0
            i32.const 310
            global.get 39
            i32.mul
            i32.add
            drop
            local.get 1
            global.get 39
            i32.add
            drop
            i32.const 20
            global.get 39
            i32.mul
            drop
            i32.const 20
            global.get 39
            i32.mul
            drop
            i32.const 0
            global.get 33
            i32.const 0
            i32.eq
            i32.and
            if  ;; label = @5
              local.get 9
              i32.trunc_f32_s
              local.get 10
              i32.trunc_f32_s
              local.get 11
              i32.trunc_f32_s
              local.get 12
              i32.trunc_f32_s
              i32.const 2335
              i32.const 0
              f32.convert_i32_s
              i32.const 0
              call 417
              drop
            end
            local.get 1
            i32.const 30
            global.get 39
            i32.mul
            i32.add
            local.set 1
            i32.const 255
            i32.const 255
            i32.const 255
            call 6
            i32.const 0
            drop
            local.get 0
            i32.const 20
            global.get 39
            i32.mul
            i32.add
            drop
            local.get 1
            drop
            i32.const 2353
            drop
            i32.const 0
            drop
            local.get 0
            i32.const 310
            global.get 39
            i32.mul
            i32.add
            local.get 1
            global.get 39
            i32.add
            global.get 67
            i32.const 0
            call 408
            global.set 67
            local.get 0
            i32.const 310
            global.get 39
            i32.mul
            i32.add
            drop
            local.get 1
            global.get 39
            i32.add
            drop
            i32.const 20
            global.get 39
            i32.mul
            drop
            i32.const 20
            global.get 39
            i32.mul
            drop
            i32.const 0
            global.get 33
            i32.const 0
            i32.eq
            i32.and
            if  ;; label = @5
              local.get 9
              i32.trunc_f32_s
              local.get 10
              i32.trunc_f32_s
              local.get 11
              i32.trunc_f32_s
              local.get 12
              i32.trunc_f32_s
              i32.const 2381
              i32.const 0
              f32.convert_i32_s
              i32.const 0
              call 417
              drop
            end
            local.get 1
            i32.const 30
            global.get 39
            i32.mul
            i32.add
            local.set 1
            local.get 0
            i32.const 310
            global.get 39
            i32.mul
            i32.add
            local.get 1
            i32.const 6
            global.get 39
            i32.mul
            i32.add
            i32.const 150
            global.get 39
            i32.mul
            global.get 68
            f32.convert_i32_s
            f32.const 0x1.9p+5 (;=50;)
            f32.mul
            call 409
            f32.const 0x1.9p+5 (;=50;)
            f32.div
            i32.trunc_f32_s
            global.set 68
            i32.const 255
            i32.const 255
            i32.const 255
            call 6
            i32.const 0
            drop
            local.get 0
            i32.const 20
            global.get 39
            i32.mul
            i32.add
            drop
            local.get 1
            drop
            i32.const 2400
            drop
            i32.const 0
            drop
            local.get 0
            i32.const 310
            global.get 39
            i32.mul
            i32.add
            drop
            local.get 1
            i32.const 6
            global.get 39
            i32.mul
            i32.add
            drop
            i32.const 150
            global.get 39
            i32.mul
            i32.const 14
            i32.add
            drop
            i32.const 20
            drop
            i32.const 0
            global.get 33
            i32.const 0
            i32.eq
            i32.and
            if  ;; label = @5
              local.get 9
              i32.trunc_f32_s
              local.get 10
              i32.trunc_f32_s
              local.get 11
              i32.trunc_f32_s
              local.get 12
              i32.trunc_f32_s
              i32.const 2421
              global.get 68
              f32.convert_i32_s
              i32.const 0
              call 417
              drop
            end
            local.get 1
            i32.const 50
            global.get 39
            i32.mul
            i32.add
            local.set 1
            i32.const 255
            i32.const 255
            i32.const 255
            call 6
            i32.const 0
            drop
            local.get 0
            i32.const 20
            global.get 39
            i32.mul
            i32.add
            drop
            local.get 1
            drop
            i32.const 2435
            drop
            i32.const 0
            drop
            local.get 0
            i32.const 310
            global.get 39
            i32.mul
            i32.add
            local.get 1
            i32.const 6
            global.get 39
            i32.mul
            i32.add
            i32.const 150
            global.get 39
            i32.mul
            global.get 69
            i32.const 2
            i32.const 2460
            i32.const 2476
            i32.const 2492
            call 420
            global.set 69
            local.get 0
            i32.const 310
            global.get 39
            i32.mul
            i32.add
            drop
            local.get 1
            i32.const 6
            global.get 39
            i32.mul
            i32.sub
            drop
            i32.const 150
            global.get 39
            i32.mul
            i32.const 14
            i32.add
            drop
            i32.const 20
            drop
            i32.const 0
            global.get 33
            i32.const 0
            i32.eq
            i32.and
            global.get 33
            i32.const 2
            i32.eq
            i32.or
            if  ;; label = @5
              local.get 9
              i32.trunc_f32_s
              local.get 10
              i32.trunc_f32_s
              local.get 11
              i32.trunc_f32_s
              local.get 12
              i32.trunc_f32_s
              i32.const 2505
              global.get 69
              f32.convert_i32_s
              i32.const 0
              call 417
              drop
            end
            local.get 1
            i32.const 50
            global.get 39
            i32.mul
            i32.add
            local.set 1
            i32.const 255
            i32.const 255
            i32.const 255
            call 6
            i32.const 0
            drop
            local.get 0
            i32.const 20
            global.get 39
            i32.mul
            i32.add
            drop
            local.get 1
            drop
            i32.const 2528
            drop
            i32.const 0
            drop
            local.get 0
            i32.const 310
            global.get 39
            i32.mul
            i32.add
            local.get 1
            i32.const 6
            global.get 39
            i32.mul
            i32.add
            i32.const 150
            global.get 39
            i32.mul
            global.get 70
            i32.const 3
            i32.const 2554
            i32.const 2566
            i32.const 2578
            i32.const 2590
            i32.const 2603
            call 422
            global.set 70
            block  ;; label = @5
              global.get 70
              global.set 7
              global.get 7
              i32.const 0
              i32.eq
              if  ;; label = @6
                f32.const 0x1.99999ap-1 (;=0.8;)
                global.set 71
                br 1 (;@5;)
              end
              global.get 7
              i32.const 1
              i32.eq
              if  ;; label = @6
                f32.const 0x1.99999ap-2 (;=0.4;)
                global.set 71
                br 1 (;@5;)
              end
              global.get 7
              i32.const 2
              i32.eq
              if  ;; label = @6
                f32.const 0x0p+0 (;=0;)
                global.set 71
                br 1 (;@5;)
              end
              global.get 7
              i32.const 3
              i32.eq
              if  ;; label = @6
                f32.const 0x1.99999ap-2 (;=0.4;)
                f32.neg
                global.set 71
                br 1 (;@5;)
              end
              global.get 7
              i32.const 4
              i32.eq
              if  ;; label = @6
                f32.const 0x1.99999ap-1 (;=0.8;)
                f32.neg
                global.set 71
                br 1 (;@5;)
              end
            end
            global.get 71
            drop
            i32.const 0
            drop
            local.get 0
            i32.const 310
            global.get 39
            i32.mul
            i32.add
            drop
            local.get 1
            i32.const 6
            global.get 39
            i32.mul
            i32.sub
            drop
            i32.const 150
            global.get 39
            i32.mul
            i32.const 14
            i32.add
            drop
            i32.const 20
            drop
            i32.const 0
            global.get 33
            i32.const 0
            i32.eq
            i32.and
            global.get 33
            i32.const 3
            i32.eq
            i32.or
            if  ;; label = @5
              local.get 9
              i32.trunc_f32_s
              local.get 10
              i32.trunc_f32_s
              local.get 11
              i32.trunc_f32_s
              local.get 12
              i32.const 100
              global.get 39
              i32.mul
              f32.convert_i32_s
              f32.add
              i32.trunc_f32_s
              i32.const 2616
              i32.const 0
              f32.convert_i32_s
              i32.const 0
              call 417
              drop
            end
            local.get 1
            i32.const 50
            global.get 39
            i32.mul
            i32.add
            local.set 1
            i32.const 255
            i32.const 255
            i32.const 255
            call 6
            i32.const 0
            drop
            local.get 0
            i32.const 20
            global.get 39
            i32.mul
            i32.add
            drop
            local.get 1
            drop
            i32.const 2635
            drop
            i32.const 0
            drop
            local.get 0
            i32.const 310
            global.get 39
            i32.mul
            i32.add
            local.get 1
            global.get 39
            i32.add
            global.get 72
            i32.const 0
            call 408
            global.set 72
            local.get 0
            i32.const 310
            global.get 39
            i32.mul
            i32.add
            drop
            local.get 1
            global.get 39
            i32.add
            drop
            i32.const 20
            global.get 39
            i32.mul
            drop
            i32.const 20
            global.get 39
            i32.mul
            drop
            i32.const 0
            global.get 33
            i32.const 0
            i32.eq
            i32.and
            if  ;; label = @5
              local.get 9
              i32.trunc_f32_s
              local.get 10
              i32.trunc_f32_s
              local.get 11
              i32.trunc_f32_s
              local.get 12
              i32.trunc_f32_s
              i32.const 2670
              i32.const 0
              f32.convert_i32_s
              i32.const 0
              call 417
              drop
            end
          else
            global.get 20
            i32.const 5
            i32.eq
            if  ;; label = @5
              i32.const 220
              global.get 39
              i32.mul
              local.set 3
              local.get 0
              local.get 1
              local.get 2
              local.get 3
              i32.const 0
              i32.const 0
              call 405
              drop
              local.get 1
              i32.const 20
              global.get 39
              i32.mul
              i32.add
              local.set 1
              local.get 0
              i32.const 310
              global.get 39
              i32.mul
              i32.add
              local.get 1
              i32.const 4
              global.get 39
              i32.mul
              i32.sub
              i32.const 150
              global.get 39
              i32.mul
              global.get 101
              f32.convert_i32_s
              f32.const 0x1.9p+6 (;=100;)
              f32.mul
              call 409
              f32.const 0x1.9p+6 (;=100;)
              f32.div
              i32.trunc_f32_s
              global.set 101
              i32.const 255
              i32.const 255
              i32.const 255
              call 6
              i32.const 0
              drop
              local.get 0
              i32.const 20
              global.get 39
              i32.mul
              i32.add
              drop
              local.get 1
              drop
              i32.const 3625
              drop
              i32.const 0
              drop
              local.get 0
              i32.const 310
              global.get 39
              i32.mul
              i32.add
              drop
              local.get 1
              i32.const 4
              global.get 39
              i32.mul
              i32.sub
              drop
              i32.const 150
              global.get 39
              i32.mul
              i32.const 14
              i32.add
              drop
              i32.const 20
              drop
              i32.const 0
              if  ;; label = @6
                local.get 9
                i32.trunc_f32_s
                local.get 10
                i32.trunc_f32_s
                local.get 11
                i32.trunc_f32_s
                local.get 12
                i32.trunc_f32_s
                i32.const 3647
                global.get 101
                f32.convert_i32_s
                i32.const 0
                call 417
                drop
              end
              local.get 1
              i32.const 40
              global.get 39
              i32.mul
              i32.add
              local.set 1
              local.get 0
              i32.const 310
              global.get 39
              i32.mul
              i32.add
              local.get 1
              i32.const 4
              global.get 39
              i32.mul
              i32.sub
              i32.const 150
              global.get 39
              i32.mul
              global.get 102
              f32.convert_i32_s
              f32.const 0x1.9p+6 (;=100;)
              f32.mul
              call 409
              f32.const 0x1.9p+6 (;=100;)
              f32.div
              i32.trunc_f32_s
              global.set 103
              global.get 103
              global.set 102
              i32.const 255
              i32.const 255
              i32.const 255
              call 6
              i32.const 0
              drop
              local.get 0
              i32.const 20
              global.get 39
              i32.mul
              i32.add
              drop
              local.get 1
              drop
              i32.const 3664
              drop
              i32.const 0
              drop
              local.get 0
              i32.const 310
              global.get 39
              i32.mul
              i32.add
              drop
              local.get 1
              i32.const 4
              global.get 39
              i32.mul
              i32.sub
              drop
              i32.const 150
              global.get 39
              i32.mul
              i32.const 14
              i32.add
              drop
              i32.const 20
              drop
              i32.const 0
              if  ;; label = @6
                local.get 9
                i32.trunc_f32_s
                local.get 10
                i32.trunc_f32_s
                local.get 11
                i32.trunc_f32_s
                local.get 12
                i32.trunc_f32_s
                i32.const 3686
                global.get 103
                f32.convert_i32_s
                i32.const 0
                call 417
                drop
              end
              local.get 1
              i32.const 30
              global.get 39
              i32.mul
              i32.add
              local.set 1
              i32.const 255
              i32.const 255
              i32.const 255
              call 6
              i32.const 0
              drop
              local.get 0
              i32.const 20
              global.get 39
              i32.mul
              i32.add
              drop
              local.get 1
              drop
              i32.const 3703
              drop
              i32.const 0
              drop
              local.get 0
              i32.const 310
              global.get 39
              i32.mul
              i32.add
              local.get 1
              global.get 39
              i32.add
              global.get 104
              i32.const 0
              call 408
              global.set 104
              global.get 105
              global.get 104
              i32.ne
              if  ;; label = @6
                global.get 104
                if  ;; label = @7
                  i32.const 0
                  local.set 14
                  block  ;; label = @8
                    loop  ;; label = @9
                      local.get 14
                      i32.const 0
                      i32.gt_s
                      br_if 1 (;@8;)
                      i32.const 0
                      local.set 7
                      block  ;; label = @10
                        loop  ;; label = @11
                          local.get 7
                          i32.const 31
                          i32.gt_s
                          br_if 1 (;@10;)
                          i32.const 0
                          i32.const 0
                          i32.ne
                          if  ;; label = @12
                            i32.const 0
                            call 36
                            if  ;; label = @13
                              i32.const 0
                              call 33
                              i32.const 0
                              drop
                            end
                          end
                          local.get 7
                          i32.const 1
                          i32.add
                          local.set 7
                          br 0 (;@11;)
                        end
                      end
                      i32.const 0
                      i32.const 0
                      i32.ne
                      if  ;; label = @10
                        i32.const 0
                        call 31
                        i32.const 0
                        drop
                        local.get 14
                        drop
                        i32.const 0
                        drop
                      end
                      local.get 14
                      drop
                      i32.const 0
                      drop
                      local.get 14
                      i32.const 1
                      i32.add
                      local.set 14
                      br 0 (;@9;)
                    end
                  end
                else
                  i32.const 0
                  local.set 14
                  block  ;; label = @8
                    loop  ;; label = @9
                      local.get 14
                      i32.const 0
                      i32.gt_s
                      br_if 1 (;@8;)
                      i32.const 0
                      i32.const 0
                      i32.eq
                      if  ;; label = @10
                        local.get 14
                        drop
                        i32.const 0
                        call 32
                        drop
                      end
                      local.get 14
                      i32.const 1
                      i32.add
                      local.set 14
                      br 0 (;@9;)
                    end
                  end
                end
                global.get 104
                global.set 105
              end
              local.get 0
              i32.const 310
              global.get 39
              i32.mul
              i32.add
              drop
              local.get 1
              global.get 39
              i32.add
              drop
              i32.const 20
              global.get 39
              i32.mul
              drop
              i32.const 20
              global.get 39
              i32.mul
              drop
              i32.const 0
              if  ;; label = @6
                local.get 9
                i32.trunc_f32_s
                local.get 10
                i32.trunc_f32_s
                local.get 11
                i32.trunc_f32_s
                local.get 12
                i32.const 220
                global.get 39
                i32.mul
                f32.convert_i32_s
                f32.add
                i32.trunc_f32_s
                i32.const 3731
                i32.const 0
                f32.convert_i32_s
                i32.const 0
                call 417
                drop
              end
              local.get 1
              i32.const 30
              global.get 39
              i32.mul
              i32.add
              local.set 1
              i32.const 255
              i32.const 255
              i32.const 255
              call 6
              i32.const 0
              drop
              local.get 0
              i32.const 20
              global.get 39
              i32.mul
              i32.add
              drop
              local.get 1
              drop
              i32.const 3754
              drop
              i32.const 0
              drop
              local.get 0
              i32.const 310
              global.get 39
              i32.mul
              i32.add
              local.get 1
              global.get 39
              i32.add
              global.get 106
              i32.const 0
              call 408
              global.set 106
              local.get 0
              i32.const 310
              global.get 39
              i32.mul
              i32.add
              drop
              local.get 1
              global.get 39
              i32.add
              drop
              i32.const 20
              global.get 39
              i32.mul
              drop
              i32.const 20
              global.get 39
              i32.mul
              drop
              i32.const 0
              if  ;; label = @6
                local.get 9
                i32.trunc_f32_s
                local.get 10
                i32.trunc_f32_s
                local.get 11
                i32.trunc_f32_s
                local.get 12
                i32.trunc_f32_s
                i32.const 3782
                i32.const 0
                f32.convert_i32_s
                i32.const 0
                call 417
                drop
              end
              global.get 106
              if  ;; label = @6
                local.get 1
                i32.const 30
                global.get 39
                i32.mul
                i32.add
                local.set 1
                i32.const 255
                i32.const 255
                i32.const 255
                call 6
                i32.const 0
                drop
                local.get 0
                i32.const 20
                global.get 39
                i32.mul
                i32.add
                drop
                local.get 1
                drop
                i32.const 3800
                drop
                i32.const 0
                drop
                local.get 0
                i32.const 310
                global.get 39
                i32.mul
                i32.add
                local.get 1
                global.get 39
                i32.add
                global.get 107
                i32.const 0
                call 408
                global.set 107
                global.get 107
                if  ;; label = @7
                  local.get 0
                  i32.const 350
                  global.get 39
                  i32.mul
                  i32.add
                  drop
                  local.get 1
                  global.get 39
                  i32.add
                  drop
                  i32.const 3825
                  drop
                  i32.const 0
                  drop
                else
                  local.get 0
                  i32.const 350
                  global.get 39
                  i32.mul
                  i32.add
                  drop
                  local.get 1
                  global.get 39
                  i32.add
                  drop
                  i32.const 3840
                  drop
                  i32.const 0
                  drop
                end
                local.get 0
                i32.const 310
                global.get 39
                i32.mul
                i32.add
                drop
                local.get 1
                global.get 39
                i32.add
                drop
                i32.const 20
                global.get 39
                i32.mul
                drop
                i32.const 20
                global.get 39
                i32.mul
                drop
                i32.const 0
                if  ;; label = @7
                  local.get 9
                  i32.trunc_f32_s
                  local.get 10
                  i32.trunc_f32_s
                  local.get 11
                  i32.trunc_f32_s
                  local.get 12
                  i32.trunc_f32_s
                  i32.const 3855
                  i32.const 0
                  f32.convert_i32_s
                  i32.const 0
                  call 417
                  drop
                end
                local.get 0
                i32.const 20
                global.get 39
                i32.mul
                i32.add
                local.get 1
                i32.const 30
                global.get 39
                i32.mul
                i32.add
                i32.const 190
                global.get 39
                i32.mul
                i32.const 25
                global.get 39
                i32.mul
                i32.const 3877
                i32.const 0
                i32.const 0
                i32.const 1
                call 406
                if  ;; label = @7
                  i32.const 3906
                  call 145
                  i32.const 0
                  drop
                  i32.const 0
                  global.set 51
                  i32.const 0
                  global.set 52
                  i32.const 3940
                  drop
                  i32.const 0
                  global.set 108
                  block  ;; label = @8
                    loop  ;; label = @9
                      global.get 108
                      drop
                      i32.const 0
                      global.set 109
                      global.get 109
                      i32.const 3970
                      call 269
                      if  ;; label = @10
                        br 2 (;@8;)
                      end
                      i32.const 3979
                      global.get 109
                      call 397
                      call 231
                      i32.const 1
                      i32.eq
                      if  ;; label = @10
                        global.get 51
                        i32.const 1
                        i32.add
                        global.set 51
                        i32.const 4009
                        global.get 109
                        call 397
                        call 32
                        global.set 110
                        global.get 110
                        i32.const 0
                        i32.ne
                        if  ;; label = @11
                          global.get 52
                          i32.const 1
                          i32.add
                          global.set 52
                        end
                        global.get 110
                        call 31
                        i32.const 0
                        drop
                      end
                      i32.const 1
                      i32.eqz
                      br_if 0 (;@9;)
                    end
                  end
                  global.get 108
                  drop
                  i32.const 0
                  drop
                  i32.const 4039
                  call 145
                  i32.const 0
                  drop
                end
                local.get 0
                i32.const 20
                global.get 39
                i32.mul
                i32.add
                drop
                local.get 1
                i32.const 30
                global.get 39
                i32.mul
                i32.add
                drop
                i32.const 190
                global.get 39
                i32.mul
                drop
                i32.const 25
                global.get 39
                i32.mul
                drop
                i32.const 0
                if  ;; label = @7
                  local.get 9
                  i32.trunc_f32_s
                  local.get 10
                  i32.trunc_f32_s
                  local.get 11
                  i32.trunc_f32_s
                  local.get 12
                  i32.trunc_f32_s
                  i32.const 4071
                  i32.const 0
                  f32.convert_i32_s
                  i32.const 0
                  call 417
                  drop
                end
                global.get 51
                i32.const 0
                i32.gt_s
                if  ;; label = @7
                  local.get 0
                  i32.const 20
                  global.get 39
                  i32.mul
                  i32.add
                  drop
                  local.get 1
                  i32.const 100
                  global.get 39
                  i32.mul
                  i32.add
                  drop
                  i32.const 4093
                  global.get 52
                  call 241
                  call 397
                  i32.const 4121
                  call 397
                  global.get 51
                  call 241
                  call 397
                  i32.const 4131
                  call 397
                  drop
                  i32.const 0
                  drop
                end
              else
                i32.const 0
                global.set 51
              end
            else
              global.get 20
              i32.const 6
              i32.eq
              if  ;; label = @6
                i32.const 270
                global.get 39
                i32.mul
                local.set 3
                local.get 0
                local.get 1
                local.get 2
                local.get 3
                i32.const 0
                i32.const 0
                call 405
                drop
                local.get 1
                i32.const 20
                global.get 39
                i32.mul
                i32.add
                local.set 1
                local.get 0
                i32.const 310
                global.get 39
                i32.mul
                i32.add
                local.get 1
                i32.const 4
                global.get 39
                i32.mul
                i32.sub
                i32.const 150
                global.get 39
                i32.mul
                global.get 87
                f32.convert_i32_s
                f32.const 0x1p-1 (;=0.5;)
                f32.add
                f32.const 0x1.9p+6 (;=100;)
                f32.mul
                call 409
                f32.const 0x1.9p+6 (;=100;)
                f32.div
                f32.const 0x1p-1 (;=0.5;)
                f32.sub
                i32.trunc_f32_s
                global.set 87
                i32.const 255
                i32.const 255
                i32.const 255
                call 6
                i32.const 0
                drop
                local.get 0
                i32.const 20
                global.get 39
                i32.mul
                i32.add
                drop
                local.get 1
                drop
                i32.const 3218
                drop
                i32.const 0
                drop
                local.get 0
                i32.const 310
                global.get 39
                i32.mul
                i32.add
                drop
                local.get 1
                i32.const 4
                global.get 39
                i32.mul
                i32.sub
                drop
                i32.const 150
                global.get 39
                i32.mul
                i32.const 14
                i32.add
                drop
                i32.const 20
                drop
                i32.const 0
                if  ;; label = @7
                  local.get 9
                  i32.trunc_f32_s
                  local.get 10
                  i32.trunc_f32_s
                  local.get 11
                  i32.trunc_f32_s
                  local.get 12
                  i32.trunc_f32_s
                  i32.const 3245
                  global.get 87
                  f32.convert_i32_s
                  i32.const 0
                  call 417
                  drop
                end
                local.get 1
                i32.const 40
                global.get 39
                i32.mul
                i32.add
                local.set 1
                i32.const 255
                i32.const 255
                i32.const 255
                call 6
                i32.const 0
                drop
                local.get 0
                i32.const 20
                global.get 39
                i32.mul
                i32.add
                drop
                local.get 1
                drop
                i32.const 3270
                drop
                i32.const 0
                drop
                local.get 0
                i32.const 310
                global.get 39
                i32.mul
                i32.add
                local.get 1
                global.get 39
                i32.add
                global.get 88
                i32.const 0
                call 408
                global.set 88
                local.get 0
                i32.const 310
                global.get 39
                i32.mul
                i32.add
                drop
                local.get 1
                global.get 39
                i32.add
                drop
                i32.const 20
                global.get 39
                i32.mul
                drop
                i32.const 20
                global.get 39
                i32.mul
                drop
                i32.const 0
                if  ;; label = @7
                  local.get 9
                  i32.trunc_f32_s
                  local.get 10
                  i32.trunc_f32_s
                  local.get 11
                  i32.trunc_f32_s
                  local.get 12
                  i32.trunc_f32_s
                  i32.const 3299
                  i32.const 0
                  f32.convert_i32_s
                  i32.const 0
                  call 417
                  drop
                end
                local.get 1
                i32.const 40
                global.get 39
                i32.mul
                i32.add
                local.set 1
                local.get 0
                i32.const 310
                global.get 39
                i32.mul
                i32.add
                local.get 1
                i32.const 4
                global.get 39
                i32.mul
                i32.sub
                i32.const 150
                global.get 39
                i32.mul
                global.get 89
                f32.convert_i32_s
                f32.const 0x1.9p+5 (;=50;)
                f32.mul
                call 409
                f32.const 0x1.9p+5 (;=50;)
                f32.div
                i32.trunc_f32_s
                global.set 89
                i32.const 255
                i32.const 255
                i32.const 255
                call 6
                i32.const 0
                drop
                local.get 0
                i32.const 20
                global.get 39
                i32.mul
                i32.add
                drop
                local.get 1
                drop
                i32.const 3319
                drop
                i32.const 0
                drop
                local.get 0
                i32.const 310
                global.get 39
                i32.mul
                i32.add
                drop
                local.get 1
                i32.const 4
                global.get 39
                i32.mul
                i32.sub
                drop
                i32.const 150
                global.get 39
                i32.mul
                i32.const 14
                i32.add
                drop
                i32.const 20
                drop
                i32.const 0
                if  ;; label = @7
                  local.get 9
                  i32.trunc_f32_s
                  local.get 10
                  i32.trunc_f32_s
                  local.get 11
                  i32.trunc_f32_s
                  local.get 12
                  i32.trunc_f32_s
                  i32.const 3344
                  global.get 89
                  f32.convert_i32_s
                  i32.const 0
                  call 417
                  drop
                end
                i32.const 255
                i32.const 255
                i32.const 255
                call 6
                i32.const 0
                drop
                local.get 1
                i32.const 30
                global.get 39
                i32.mul
                i32.add
                local.set 1
                local.get 0
                i32.const 20
                global.get 39
                i32.mul
                i32.add
                drop
                local.get 1
                drop
                i32.const 3367
                drop
                i32.const 0
                drop
                local.get 1
                i32.const 10
                global.get 39
                i32.mul
                i32.add
                local.set 1
                local.get 0
                i32.const 20
                global.get 39
                i32.mul
                i32.add
                drop
                local.get 1
                i32.const 20
                global.get 39
                i32.mul
                i32.add
                drop
                i32.const 3398
                drop
                i32.const 0
                drop
                local.get 0
                i32.const 160
                global.get 39
                i32.mul
                i32.add
                local.get 1
                i32.const 20
                global.get 39
                i32.mul
                i32.add
                i32.const 100
                global.get 39
                i32.mul
                i32.const 20
                global.get 39
                i32.mul
                global.get 90
                f32.convert_i32_s
                i32.const 210
                f32.convert_i32_s
                call 356
                drop
                i32.const 0
                i32.const 5
                call 404
                drop
                local.get 0
                i32.const 20
                global.get 39
                i32.mul
                i32.add
                drop
                local.get 1
                i32.const 40
                global.get 39
                i32.mul
                i32.add
                drop
                i32.const 3419
                drop
                i32.const 0
                drop
                local.get 0
                i32.const 160
                global.get 39
                i32.mul
                i32.add
                local.get 1
                i32.const 40
                global.get 39
                i32.mul
                i32.add
                i32.const 100
                global.get 39
                i32.mul
                i32.const 20
                global.get 39
                i32.mul
                global.get 91
                f32.convert_i32_s
                i32.const 210
                f32.convert_i32_s
                call 356
                drop
                i32.const 0
                i32.const 3
                call 404
                drop
                local.get 0
                i32.const 20
                global.get 39
                i32.mul
                i32.add
                drop
                local.get 1
                i32.const 60
                global.get 39
                i32.mul
                i32.add
                drop
                i32.const 3439
                drop
                i32.const 0
                drop
                local.get 0
                i32.const 160
                global.get 39
                i32.mul
                i32.add
                local.get 1
                i32.const 60
                global.get 39
                i32.mul
                i32.add
                i32.const 100
                global.get 39
                i32.mul
                i32.const 20
                global.get 39
                i32.mul
                global.get 92
                f32.convert_i32_s
                i32.const 210
                f32.convert_i32_s
                call 356
                drop
                i32.const 0
                i32.const 6
                call 404
                drop
                local.get 0
                i32.const 20
                global.get 39
                i32.mul
                i32.add
                drop
                local.get 1
                i32.const 80
                global.get 39
                i32.mul
                i32.add
                drop
                i32.const 3461
                drop
                i32.const 0
                drop
                local.get 0
                i32.const 160
                global.get 39
                i32.mul
                i32.add
                local.get 1
                i32.const 80
                global.get 39
                i32.mul
                i32.add
                i32.const 100
                global.get 39
                i32.mul
                i32.const 20
                global.get 39
                i32.mul
                global.get 93
                f32.convert_i32_s
                i32.const 210
                f32.convert_i32_s
                call 356
                drop
                i32.const 0
                i32.const 4
                call 404
                drop
                local.get 0
                i32.const 20
                global.get 39
                i32.mul
                i32.add
                drop
                local.get 1
                i32.const 100
                global.get 39
                i32.mul
                i32.add
                drop
                i32.const 3482
                drop
                i32.const 0
                drop
                local.get 0
                i32.const 160
                global.get 39
                i32.mul
                i32.add
                local.get 1
                i32.const 100
                global.get 39
                i32.mul
                i32.add
                i32.const 100
                global.get 39
                i32.mul
                i32.const 20
                global.get 39
                i32.mul
                global.get 94
                f32.convert_i32_s
                i32.const 210
                f32.convert_i32_s
                call 356
                drop
                i32.const 0
                i32.const 11
                call 404
                drop
                local.get 0
                i32.const 280
                global.get 39
                i32.mul
                i32.add
                drop
                local.get 1
                i32.const 20
                global.get 39
                i32.mul
                i32.add
                drop
                i32.const 3501
                drop
                i32.const 0
                drop
                local.get 0
                i32.const 470
                global.get 39
                i32.mul
                i32.add
                local.get 1
                i32.const 20
                global.get 39
                i32.mul
                i32.add
                i32.const 100
                global.get 39
                i32.mul
                i32.const 20
                global.get 39
                i32.mul
                global.get 95
                f32.convert_i32_s
                i32.const 210
                f32.convert_i32_s
                call 356
                drop
                i32.const 0
                i32.const 7
                call 404
                drop
                local.get 0
                i32.const 280
                global.get 39
                i32.mul
                i32.add
                drop
                local.get 1
                i32.const 40
                global.get 39
                i32.mul
                i32.add
                drop
                i32.const 3522
                drop
                i32.const 0
                drop
                local.get 0
                i32.const 470
                global.get 39
                i32.mul
                i32.add
                local.get 1
                i32.const 40
                global.get 39
                i32.mul
                i32.add
                i32.const 100
                global.get 39
                i32.mul
                i32.const 20
                global.get 39
                i32.mul
                global.get 96
                f32.convert_i32_s
                i32.const 210
                f32.convert_i32_s
                call 356
                drop
                i32.const 0
                i32.const 8
                call 404
                drop
                local.get 0
                i32.const 280
                global.get 39
                i32.mul
                i32.add
                drop
                local.get 1
                i32.const 60
                global.get 39
                i32.mul
                i32.add
                drop
                i32.const 3537
                drop
                i32.const 0
                drop
                local.get 0
                i32.const 470
                global.get 39
                i32.mul
                i32.add
                local.get 1
                i32.const 60
                global.get 39
                i32.mul
                i32.add
                i32.const 100
                global.get 39
                i32.mul
                i32.const 20
                global.get 39
                i32.mul
                global.get 97
                f32.convert_i32_s
                i32.const 210
                f32.convert_i32_s
                call 356
                drop
                i32.const 0
                i32.const 9
                call 404
                drop
                local.get 0
                i32.const 280
                global.get 39
                i32.mul
                i32.add
                drop
                local.get 1
                i32.const 80
                global.get 39
                i32.mul
                i32.add
                drop
                i32.const 3566
                drop
                i32.const 0
                drop
                local.get 0
                i32.const 470
                global.get 39
                i32.mul
                i32.add
                local.get 1
                i32.const 80
                global.get 39
                i32.mul
                i32.add
                i32.const 100
                global.get 39
                i32.mul
                i32.const 20
                global.get 39
                i32.mul
                global.get 98
                f32.convert_i32_s
                i32.const 210
                f32.convert_i32_s
                call 356
                drop
                i32.const 0
                i32.const 10
                call 404
                drop
                local.get 0
                i32.const 280
                global.get 39
                i32.mul
                i32.add
                drop
                local.get 1
                i32.const 100
                global.get 39
                i32.mul
                i32.add
                drop
                i32.const 3581
                drop
                i32.const 0
                drop
                local.get 0
                i32.const 470
                global.get 39
                i32.mul
                i32.add
                local.get 1
                i32.const 100
                global.get 39
                i32.mul
                i32.add
                i32.const 100
                global.get 39
                i32.mul
                i32.const 20
                global.get 39
                i32.mul
                global.get 99
                f32.convert_i32_s
                i32.const 210
                f32.convert_i32_s
                call 356
                drop
                i32.const 0
                i32.const 12
                call 404
                drop
                local.get 0
                i32.const 20
                global.get 39
                i32.mul
                i32.add
                drop
                local.get 1
                drop
                local.get 2
                i32.const 40
                global.get 39
                i32.mul
                i32.sub
                drop
                i32.const 120
                global.get 39
                i32.mul
                drop
                i32.const 0
                if  ;; label = @7
                  local.get 9
                  i32.trunc_f32_s
                  local.get 10
                  i32.trunc_f32_s
                  local.get 11
                  i32.trunc_f32_s
                  local.get 12
                  i32.trunc_f32_s
                  i32.const 3608
                  i32.const 0
                  f32.convert_i32_s
                  i32.const 0
                  call 417
                  drop
                end
                i32.const 0
                local.set 7
                block  ;; label = @7
                  loop  ;; label = @8
                    local.get 7
                    i32.const 227
                    i32.gt_s
                    br_if 1 (;@7;)
                    local.get 7
                    call 202
                    if  ;; label = @9
                      local.get 7
                      global.set 100
                      br 2 (;@7;)
                    end
                    local.get 7
                    i32.const 1
                    i32.add
                    local.set 7
                    br 0 (;@8;)
                  end
                end
                global.get 100
                i32.const 0
                i32.ne
                if  ;; label = @7
                  block  ;; label = @8
                    global.get 22
                    global.set 7
                    global.get 7
                    i32.const 3
                    i32.eq
                    if  ;; label = @9
                      global.get 100
                      global.set 91
                      br 1 (;@8;)
                    end
                    global.get 7
                    i32.const 4
                    i32.eq
                    if  ;; label = @9
                      global.get 100
                      global.set 93
                      br 1 (;@8;)
                    end
                    global.get 7
                    i32.const 5
                    i32.eq
                    if  ;; label = @9
                      global.get 100
                      global.set 90
                      br 1 (;@8;)
                    end
                    global.get 7
                    i32.const 6
                    i32.eq
                    if  ;; label = @9
                      global.get 100
                      global.set 92
                      br 1 (;@8;)
                    end
                    global.get 7
                    i32.const 7
                    i32.eq
                    if  ;; label = @9
                      global.get 100
                      global.set 95
                      br 1 (;@8;)
                    end
                    global.get 7
                    i32.const 8
                    i32.eq
                    if  ;; label = @9
                      global.get 100
                      global.set 96
                      br 1 (;@8;)
                    end
                    global.get 7
                    i32.const 9
                    i32.eq
                    if  ;; label = @9
                      global.get 100
                      global.set 97
                      br 1 (;@8;)
                    end
                    global.get 7
                    i32.const 10
                    i32.eq
                    if  ;; label = @9
                      global.get 100
                      global.set 98
                      br 1 (;@8;)
                    end
                    global.get 7
                    i32.const 11
                    i32.eq
                    if  ;; label = @9
                      global.get 100
                      global.set 94
                      br 1 (;@8;)
                    end
                    global.get 7
                    i32.const 12
                    i32.eq
                    if  ;; label = @9
                      global.get 100
                      global.set 99
                      br 1 (;@8;)
                    end
                  end
                  i32.const 0
                  global.set 22
                end
              else
                global.get 20
                i32.const 7
                i32.eq
                if  ;; label = @7
                  i32.const 320
                  global.get 39
                  i32.mul
                  local.set 3
                  local.get 0
                  local.get 1
                  local.get 2
                  local.get 3
                  i32.const 0
                  i32.const 0
                  call 405
                  drop
                  local.get 1
                  i32.const 20
                  global.get 39
                  i32.mul
                  i32.add
                  local.set 1
                  i32.const 255
                  i32.const 255
                  i32.const 255
                  call 6
                  i32.const 0
                  drop
                  local.get 0
                  i32.const 20
                  global.get 39
                  i32.mul
                  i32.add
                  drop
                  local.get 1
                  drop
                  i32.const 2683
                  drop
                  i32.const 0
                  drop
                  local.get 0
                  i32.const 310
                  global.get 39
                  i32.mul
                  i32.add
                  local.get 1
                  global.get 39
                  i32.add
                  global.get 73
                  i32.const 0
                  call 408
                  global.set 73
                  local.get 0
                  i32.const 310
                  global.get 39
                  i32.mul
                  i32.add
                  drop
                  local.get 1
                  global.get 39
                  i32.add
                  drop
                  i32.const 20
                  global.get 39
                  i32.mul
                  drop
                  i32.const 20
                  global.get 39
                  i32.mul
                  drop
                  i32.const 0
                  if  ;; label = @8
                    local.get 9
                    i32.trunc_f32_s
                    local.get 10
                    i32.trunc_f32_s
                    local.get 11
                    i32.trunc_f32_s
                    local.get 12
                    i32.trunc_f32_s
                    i32.const 2701
                    i32.const 0
                    f32.convert_i32_s
                    i32.const 0
                    call 417
                    drop
                  end
                  local.get 1
                  i32.const 30
                  global.get 39
                  i32.mul
                  i32.add
                  local.set 1
                  i32.const 255
                  i32.const 255
                  i32.const 255
                  call 6
                  i32.const 0
                  drop
                  local.get 0
                  i32.const 20
                  global.get 39
                  i32.mul
                  i32.add
                  drop
                  local.get 1
                  drop
                  i32.const 2713
                  drop
                  i32.const 0
                  drop
                  local.get 0
                  i32.const 310
                  global.get 39
                  i32.mul
                  i32.add
                  local.get 1
                  global.get 39
                  i32.add
                  global.get 74
                  i32.const 0
                  call 408
                  global.set 74
                  local.get 0
                  i32.const 310
                  global.get 39
                  i32.mul
                  i32.add
                  drop
                  local.get 1
                  global.get 39
                  i32.add
                  drop
                  i32.const 20
                  global.get 39
                  i32.mul
                  drop
                  i32.const 20
                  global.get 39
                  i32.mul
                  drop
                  i32.const 0
                  if  ;; label = @8
                    local.get 9
                    i32.trunc_f32_s
                    local.get 10
                    i32.trunc_f32_s
                    local.get 11
                    i32.trunc_f32_s
                    local.get 12
                    i32.trunc_f32_s
                    i32.const 2737
                    i32.const 0
                    f32.convert_i32_s
                    i32.const 0
                    call 417
                    drop
                  end
                  local.get 1
                  i32.const 30
                  global.get 39
                  i32.mul
                  i32.add
                  local.set 1
                  i32.const 255
                  i32.const 255
                  i32.const 255
                  call 6
                  i32.const 0
                  drop
                  local.get 0
                  i32.const 20
                  global.get 39
                  i32.mul
                  i32.add
                  drop
                  local.get 1
                  drop
                  i32.const 2759
                  drop
                  i32.const 0
                  drop
                  local.get 0
                  i32.const 310
                  global.get 39
                  i32.mul
                  i32.add
                  local.get 1
                  global.get 39
                  i32.add
                  global.get 75
                  i32.const 0
                  call 408
                  global.set 75
                  local.get 0
                  i32.const 310
                  global.get 39
                  i32.mul
                  i32.add
                  drop
                  local.get 1
                  global.get 39
                  i32.add
                  drop
                  i32.const 20
                  global.get 39
                  i32.mul
                  drop
                  i32.const 20
                  global.get 39
                  i32.mul
                  drop
                  i32.const 0
                  if  ;; label = @8
                    local.get 9
                    i32.trunc_f32_s
                    local.get 10
                    i32.trunc_f32_s
                    local.get 11
                    i32.trunc_f32_s
                    local.get 12
                    i32.trunc_f32_s
                    i32.const 2790
                    i32.const 0
                    f32.convert_i32_s
                    i32.const 0
                    call 417
                    drop
                  end
                  local.get 1
                  i32.const 50
                  global.get 39
                  i32.mul
                  i32.add
                  local.set 1
                  i32.const 255
                  i32.const 255
                  i32.const 255
                  call 6
                  i32.const 0
                  drop
                  local.get 0
                  i32.const 20
                  global.get 39
                  i32.mul
                  i32.add
                  drop
                  local.get 1
                  drop
                  i32.const 2811
                  drop
                  i32.const 0
                  drop
                  local.get 0
                  i32.const 310
                  global.get 39
                  i32.mul
                  i32.add
                  local.get 1
                  global.get 39
                  i32.add
                  global.get 76
                  i32.const 0
                  call 408
                  global.set 76
                  local.get 0
                  i32.const 310
                  global.get 39
                  i32.mul
                  i32.add
                  drop
                  local.get 1
                  global.get 39
                  i32.add
                  drop
                  i32.const 20
                  global.get 39
                  i32.mul
                  drop
                  i32.const 20
                  global.get 39
                  i32.mul
                  drop
                  i32.const 0
                  if  ;; label = @8
                    local.get 9
                    i32.trunc_f32_s
                    local.get 10
                    i32.trunc_f32_s
                    local.get 11
                    i32.trunc_f32_s
                    local.get 12
                    i32.trunc_f32_s
                    i32.const 2839
                    i32.const 0
                    f32.convert_i32_s
                    i32.const 0
                    call 417
                    drop
                  end
                  local.get 1
                  i32.const 50
                  global.get 39
                  i32.mul
                  i32.add
                  local.set 1
                  i32.const 255
                  i32.const 255
                  i32.const 255
                  call 6
                  i32.const 0
                  drop
                  local.get 0
                  i32.const 20
                  global.get 39
                  i32.mul
                  i32.add
                  drop
                  local.get 1
                  drop
                  i32.const 2856
                  drop
                  i32.const 0
                  drop
                  local.get 0
                  i32.const 310
                  global.get 39
                  i32.mul
                  i32.add
                  local.get 1
                  global.get 39
                  i32.add
                  global.get 77
                  i32.const 0
                  call 408
                  global.set 77
                  local.get 0
                  i32.const 310
                  global.get 39
                  i32.mul
                  i32.add
                  drop
                  local.get 1
                  global.get 39
                  i32.add
                  drop
                  i32.const 20
                  global.get 39
                  i32.mul
                  drop
                  i32.const 20
                  global.get 39
                  i32.mul
                  drop
                  i32.const 0
                  if  ;; label = @8
                    local.get 9
                    i32.trunc_f32_s
                    local.get 10
                    i32.trunc_f32_s
                    local.get 11
                    i32.trunc_f32_s
                    local.get 12
                    i32.trunc_f32_s
                    i32.const 2874
                    i32.const 0
                    f32.convert_i32_s
                    i32.const 0
                    call 417
                    drop
                  end
                  local.get 1
                  i32.const 30
                  global.get 39
                  i32.mul
                  i32.add
                  local.set 1
                  i32.const 255
                  i32.const 255
                  i32.const 255
                  call 6
                  i32.const 0
                  drop
                  local.get 0
                  i32.const 20
                  global.get 39
                  i32.mul
                  i32.add
                  drop
                  local.get 1
                  drop
                  i32.const 2890
                  drop
                  i32.const 0
                  drop
                  i32.const 255
                  i32.const 255
                  i32.const 255
                  call 6
                  i32.const 0
                  drop
                  local.get 0
                  i32.const 310
                  global.get 39
                  i32.mul
                  i32.add
                  local.get 1
                  global.get 78
                  f32.convert_i32_s
                  f32.const 0x0p+0 (;=0;)
                  f32.gt
                  i32.const 0
                  call 408
                  if  ;; label = @8
                    local.get 0
                    i32.const 150
                    global.get 39
                    i32.mul
                    i32.add
                    local.get 1
                    i32.const 30
                    global.get 39
                    i32.mul
                    i32.add
                    i32.const 100
                    global.get 39
                    i32.mul
                    global.get 78
                    f32.convert_i32_s
                    f32.const 0x1.8cp+6 (;=99;)
                    f32.mul
                    call 409
                    f32.const 0x1.8cp+6 (;=99;)
                    f32.div
                    i32.trunc_f32_s
                    global.set 78
                    global.get 78
                    f32.convert_i32_s
                    f32.const 0x1.47ae14p-7 (;=0.01;)
                    call 357
                    i32.trunc_f32_s
                    global.set 78
                    i32.const 19
                    f32.convert_i32_s
                    global.get 78
                    f32.convert_i32_s
                    f32.const 0x1.9p+6 (;=100;)
                    f32.mul
                    f32.add
                    i32.trunc_f32_s
                    global.set 79
                    i32.const 255
                    i32.const 255
                    i32.const 0
                    call 6
                    i32.const 0
                    drop
                    local.get 0
                    i32.const 25
                    global.get 39
                    i32.mul
                    i32.add
                    drop
                    local.get 1
                    i32.const 25
                    global.get 39
                    i32.mul
                    i32.add
                    drop
                    global.get 79
                    call 241
                    i32.const 2910
                    call 397
                    drop
                    i32.const 0
                    drop
                  else
                    f32.const 0x0p+0 (;=0;)
                    i32.trunc_f32_s
                    global.set 78
                    i32.const 0
                    global.set 79
                  end
                  local.get 0
                  i32.const 310
                  global.get 39
                  i32.mul
                  i32.add
                  drop
                  local.get 1
                  global.get 39
                  i32.add
                  drop
                  i32.const 20
                  global.get 39
                  i32.mul
                  drop
                  i32.const 20
                  global.get 39
                  i32.mul
                  drop
                  i32.const 0
                  if  ;; label = @8
                    local.get 9
                    i32.trunc_f32_s
                    local.get 10
                    i32.trunc_f32_s
                    local.get 11
                    i32.trunc_f32_s
                    local.get 12
                    i32.trunc_f32_s
                    i32.const 2923
                    global.get 79
                    f32.convert_i32_s
                    i32.const 0
                    call 417
                    drop
                  end
                  local.get 0
                  i32.const 150
                  global.get 39
                  i32.mul
                  i32.add
                  drop
                  local.get 1
                  i32.const 30
                  global.get 39
                  i32.mul
                  i32.add
                  drop
                  i32.const 100
                  global.get 39
                  i32.mul
                  i32.const 14
                  i32.add
                  drop
                  i32.const 20
                  drop
                  i32.const 0
                  if  ;; label = @8
                    local.get 9
                    i32.trunc_f32_s
                    local.get 10
                    i32.trunc_f32_s
                    local.get 11
                    i32.trunc_f32_s
                    local.get 12
                    i32.trunc_f32_s
                    i32.const 2942
                    global.get 79
                    f32.convert_i32_s
                    i32.const 0
                    call 417
                    drop
                  end
                  local.get 1
                  i32.const 80
                  global.get 39
                  i32.mul
                  i32.add
                  local.set 1
                  i32.const 255
                  i32.const 255
                  i32.const 255
                  call 6
                  i32.const 0
                  drop
                  local.get 0
                  i32.const 20
                  global.get 39
                  i32.mul
                  i32.add
                  drop
                  local.get 1
                  drop
                  i32.const 2961
                  drop
                  i32.const 0
                  drop
                  local.get 0
                  i32.const 310
                  global.get 39
                  i32.mul
                  i32.add
                  local.get 1
                  global.get 39
                  i32.add
                  global.get 80
                  i32.const 0
                  call 408
                  global.set 80
                  global.get 81
                  global.get 80
                  i32.ne
                  if  ;; label = @8
                    i32.const 0
                    local.set 13
                    block  ;; label = @9
                      loop  ;; label = @10
                        local.get 13
                        i32.const 0
                        i32.gt_s
                        br_if 1 (;@9;)
                        i32.const 0
                        call 14
                        i32.const 0
                        drop
                        global.get 80
                        if  ;; label = @11
                          i32.const 0
                          call 87
                          i32.const 0
                          drop
                          i32.const 0
                          call 27
                          i32.const 0
                          drop
                        end
                        local.get 13
                        i32.const 1
                        i32.add
                        local.set 13
                        br 0 (;@10;)
                      end
                    end
                    global.get 80
                    if  ;; label = @9
                      global.get 82
                      call 100
                      i32.const 0
                      drop
                    end
                    i32.const 0
                    drop
                    i32.const 2987
                    drop
                    i32.const 18
                    f32.convert_i32_s
                    global.get 41
                    f32.convert_i32_s
                    f32.const 0x1p+10 (;=1024;)
                    f32.div
                    f32.mul
                    i32.trunc_f32_s
                    drop
                    i32.const 0
                    drop
                    i32.const 0
                    drop
                    i32.const 0
                    drop
                    i32.const 0
                    global.set 42
                    i32.const 3025
                    drop
                    i32.const 58
                    f32.convert_i32_s
                    global.get 41
                    f32.convert_i32_s
                    f32.const 0x1p+10 (;=1024;)
                    f32.div
                    f32.mul
                    i32.trunc_f32_s
                    drop
                    i32.const 0
                    drop
                    i32.const 0
                    drop
                    i32.const 0
                    drop
                    i32.const 0
                    global.set 44
                    i32.const 3065
                    drop
                    i32.const 22
                    f32.convert_i32_s
                    global.get 41
                    f32.convert_i32_s
                    f32.const 0x1p+10 (;=1024;)
                    f32.div
                    f32.mul
                    i32.trunc_f32_s
                    drop
                    i32.const 0
                    drop
                    i32.const 0
                    drop
                    i32.const 0
                    drop
                    i32.const 0
                    global.set 83
                    i32.const 3105
                    drop
                    i32.const 60
                    f32.convert_i32_s
                    global.get 41
                    f32.convert_i32_s
                    f32.const 0x1p+10 (;=1024;)
                    f32.div
                    f32.mul
                    i32.trunc_f32_s
                    drop
                    i32.const 0
                    drop
                    i32.const 0
                    drop
                    i32.const 0
                    drop
                    i32.const 0
                    global.set 84
                    i32.const 3145
                    drop
                    i32.const 58
                    f32.convert_i32_s
                    global.get 41
                    f32.convert_i32_s
                    f32.const 0x1p+10 (;=1024;)
                    f32.div
                    f32.mul
                    i32.trunc_f32_s
                    drop
                    i32.const 0
                    drop
                    i32.const 0
                    drop
                    i32.const 0
                    drop
                    i32.const 0
                    global.set 85
                    i32.const 3182
                    drop
                    i32.const 22
                    f32.convert_i32_s
                    global.get 41
                    f32.convert_i32_s
                    f32.const 0x1p+10 (;=1024;)
                    f32.div
                    f32.mul
                    i32.trunc_f32_s
                    drop
                    i32.const 0
                    drop
                    i32.const 0
                    drop
                    i32.const 0
                    drop
                    i32.const 1
                    drop
                    i32.const 0
                    global.set 86
                    global.get 80
                    global.set 81
                  end
                  local.get 0
                  i32.const 310
                  global.get 39
                  i32.mul
                  i32.add
                  drop
                  local.get 1
                  global.get 39
                  i32.add
                  drop
                  i32.const 20
                  global.get 39
                  i32.mul
                  drop
                  i32.const 20
                  global.get 39
                  i32.mul
                  drop
                  i32.const 0
                  if  ;; label = @8
                    local.get 9
                    i32.trunc_f32_s
                    local.get 10
                    i32.trunc_f32_s
                    local.get 11
                    i32.trunc_f32_s
                    local.get 12
                    i32.trunc_f32_s
                    i32.const 3196
                    i32.const 0
                    f32.convert_i32_s
                    i32.const 0
                    call 417
                    drop
                  end
                end
              end
            end
          end
          br 1 (;@2;)
        end
        global.get 7
        i32.const 4
        i32.eq
        if  ;; label = @3
          local.get 1
          local.get 3
          i32.add
          i32.const 20
          global.get 39
          i32.mul
          i32.add
          local.set 1
          i32.const 580
          global.get 39
          i32.mul
          local.set 2
          i32.const 510
          global.get 39
          i32.mul
          local.set 3
          local.get 0
          local.get 1
          local.get 2
          local.get 3
          i32.const 0
          i32.const 0
          call 405
          drop
          i32.const 159
          global.get 39
          i32.mul
          local.set 0
          i32.const 286
          global.get 39
          i32.mul
          local.set 1
          i32.const 400
          global.get 39
          i32.mul
          local.set 2
          i32.const 70
          global.get 39
          i32.mul
          local.set 3
          i32.const 255
          i32.const 255
          i32.const 255
          call 6
          i32.const 0
          drop
          global.get 44
          drop
          i32.const 0
          drop
          local.get 0
          local.get 2
          i32.const 2
          i32.div_s
          i32.add
          drop
          local.get 1
          local.get 3
          i32.const 2
          i32.div_s
          i32.add
          drop
          i32.const 4161
          drop
          i32.const 1
          drop
          i32.const 1
          drop
          i32.const 0
          drop
          i32.const 160
          global.get 39
          i32.mul
          local.set 0
          local.get 1
          local.get 3
          i32.add
          i32.const 20
          global.get 39
          i32.mul
          i32.add
          local.set 1
          i32.const 580
          global.get 39
          i32.mul
          local.set 2
          i32.const 350
          global.get 39
          i32.mul
          local.set 3
          global.get 44
          drop
          i32.const 0
          drop
          local.get 0
          local.get 2
          i32.add
          f32.convert_i32_s
          local.set 9
          local.get 1
          f32.convert_i32_s
          local.set 10
          i32.const 400
          global.get 39
          i32.mul
          f32.convert_i32_s
          local.set 11
          i32.const 150
          global.get 39
          i32.mul
          f32.convert_i32_s
          local.set 12
          global.get 29
          f32.convert_i32_s
          global.get 27
          f32.convert_i32_s
          f32.const 0x1.8p+2 (;=6;)
          f32.div
          call 360
          i32.const 1
          f32.convert_i32_s
          f32.sub
          f32.lt
          if  ;; label = @4
            local.get 0
            i32.const 530
            global.get 39
            i32.mul
            i32.add
            local.get 1
            i32.const 510
            global.get 39
            i32.mul
            i32.add
            i32.const 50
            global.get 39
            i32.mul
            i32.const 55
            global.get 39
            i32.mul
            i32.const 4178
            i32.const 1
            i32.const 0
            i32.const 1
            call 406
            if  ;; label = @5
              global.get 29
              i32.const 1
              i32.add
              global.set 29
            end
          else
            local.get 0
            i32.const 530
            global.get 39
            i32.mul
            i32.add
            local.get 1
            i32.const 510
            global.get 39
            i32.mul
            i32.add
            i32.const 50
            global.get 39
            i32.mul
            i32.const 55
            global.get 39
            i32.mul
            i32.const 0
            i32.const 0
            call 405
            drop
            i32.const 100
            i32.const 100
            i32.const 100
            call 6
            i32.const 0
            drop
            local.get 0
            i32.const 555
            global.get 39
            i32.mul
            i32.add
            drop
            local.get 1
            f32.convert_i32_s
            f32.const 0x1.0ccp+9 (;=537.5;)
            global.get 39
            f32.convert_i32_s
            f32.mul
            f32.add
            drop
            i32.const 4188
            drop
            i32.const 1
            drop
            i32.const 1
            drop
            i32.const 0
            drop
          end
          global.get 29
          i32.const 0
          i32.gt_s
          if  ;; label = @4
            local.get 0
            local.get 1
            i32.const 510
            global.get 39
            i32.mul
            i32.add
            i32.const 50
            global.get 39
            i32.mul
            i32.const 55
            global.get 39
            i32.mul
            i32.const 4198
            i32.const 1
            i32.const 0
            i32.const 1
            call 406
            if  ;; label = @5
              global.get 29
              i32.const 1
              i32.sub
              global.set 29
            end
          else
            local.get 0
            local.get 1
            i32.const 510
            global.get 39
            i32.mul
            i32.add
            i32.const 50
            global.get 39
            i32.mul
            i32.const 55
            global.get 39
            i32.mul
            i32.const 0
            i32.const 0
            call 405
            drop
            i32.const 100
            i32.const 100
            i32.const 100
            call 6
            i32.const 0
            drop
            local.get 0
            i32.const 25
            global.get 39
            i32.mul
            i32.add
            drop
            local.get 1
            f32.convert_i32_s
            f32.const 0x1.0ccp+9 (;=537.5;)
            global.get 39
            f32.convert_i32_s
            f32.mul
            f32.add
            drop
            i32.const 4208
            drop
            i32.const 1
            drop
            i32.const 1
            drop
            i32.const 0
            drop
          end
          local.get 0
          i32.const 50
          global.get 39
          i32.mul
          i32.add
          local.get 1
          i32.const 510
          global.get 39
          i32.mul
          i32.add
          local.get 2
          i32.const 100
          global.get 39
          i32.mul
          i32.sub
          i32.const 55
          global.get 39
          i32.mul
          i32.const 0
          i32.const 0
          call 405
          drop
          local.get 0
          f32.convert_i32_s
          local.get 2
          f32.convert_i32_s
          f32.const 0x1p+1 (;=2;)
          f32.div
          f32.add
          drop
          local.get 1
          i32.const 536
          global.get 39
          i32.mul
          i32.add
          drop
          i32.const 4218
          global.get 29
          i32.const 1
          i32.add
          f32.convert_i32_s
          i32.const 1
          f32.convert_i32_s
          call 357
          i32.trunc_f32_s
          call 241
          call 397
          i32.const 4232
          call 397
          global.get 27
          f32.convert_i32_s
          f32.const 0x1.8p+2 (;=6;)
          f32.div
          call 360
          i32.trunc_f32_s
          f32.convert_i32_s
          i32.const 1
          f32.convert_i32_s
          call 357
          i32.trunc_f32_s
          call 241
          call 397
          drop
          i32.const 1
          drop
          i32.const 1
          drop
          i32.const 0
          drop
          global.get 42
          drop
          i32.const 0
          drop
          global.get 29
          f32.convert_i32_s
          global.get 27
          f32.convert_i32_s
          f32.const 0x1.8p+2 (;=6;)
          f32.div
          call 360
          i32.const 1
          f32.convert_i32_s
          f32.sub
          f32.gt
          if  ;; label = @4
            global.get 29
            i32.const 1
            i32.sub
            global.set 29
          end
          global.get 42
          drop
          i32.const 0
          drop
          i32.const 0
          drop
          i32.const 0
          i32.const 4242
          call 269
          if  ;; label = @4
            local.get 0
            i32.const 20
            global.get 39
            i32.mul
            i32.add
            drop
            local.get 1
            i32.const 20
            global.get 39
            i32.mul
            i32.add
            drop
            i32.const 4251
            drop
            i32.const 0
            drop
          else
            local.get 0
            i32.const 20
            global.get 39
            i32.mul
            i32.add
            local.set 0
            local.get 1
            i32.const 20
            global.get 39
            i32.mul
            i32.add
            local.set 1
            i32.const 1
            i32.const 6
            global.get 29
            i32.mul
            i32.add
            local.set 7
            block  ;; label = @5
              loop  ;; label = @6
                local.get 7
                i32.const 6
                i32.const 6
                global.get 29
                i32.mul
                i32.add
                i32.gt_s
                br_if 1 (;@5;)
                local.get 7
                global.get 27
                i32.le_s
                if  ;; label = @7
                  local.get 0
                  local.get 1
                  i32.const 540
                  global.get 39
                  i32.mul
                  i32.const 70
                  global.get 39
                  i32.mul
                  i32.const 0
                  i32.const 0
                  call 405
                  drop
                  local.get 0
                  i32.const 20
                  global.get 39
                  i32.mul
                  i32.add
                  drop
                  local.get 1
                  i32.const 10
                  global.get 39
                  i32.mul
                  i32.add
                  drop
                  local.get 7
                  i32.const 1
                  i32.sub
                  drop
                  i32.const 0
                  drop
                  i32.const 0
                  drop
                  local.get 0
                  i32.const 20
                  global.get 39
                  i32.mul
                  i32.add
                  drop
                  local.get 1
                  i32.const 10
                  i32.const 27
                  i32.add
                  global.get 39
                  i32.mul
                  i32.add
                  drop
                  local.get 7
                  i32.const 1
                  i32.sub
                  drop
                  i32.const 0
                  drop
                  i32.const 0
                  drop
                  local.get 0
                  i32.const 400
                  global.get 39
                  i32.mul
                  i32.add
                  local.get 1
                  i32.const 20
                  global.get 39
                  i32.mul
                  i32.add
                  i32.const 100
                  global.get 39
                  i32.mul
                  i32.const 30
                  global.get 39
                  i32.mul
                  i32.const 4314
                  i32.const 0
                  i32.const 0
                  i32.const 1
                  call 406
                  if  ;; label = @8
                    local.get 7
                    i32.const 1
                    i32.sub
                    drop
                    i32.const 0
                    global.set 28
                    i32.const 1
                    global.set 20
                  end
                  local.get 0
                  i32.const 400
                  global.get 39
                  i32.mul
                  i32.add
                  drop
                  local.get 1
                  i32.const 20
                  global.get 39
                  i32.mul
                  i32.add
                  drop
                  i32.const 100
                  global.get 39
                  i32.mul
                  drop
                  i32.const 30
                  global.get 39
                  i32.mul
                  drop
                  i32.const 0
                  if  ;; label = @8
                    local.get 9
                    i32.trunc_f32_s
                    local.get 10
                    i32.trunc_f32_s
                    local.get 11
                    i32.trunc_f32_s
                    local.get 12
                    i32.trunc_f32_s
                    local.get 7
                    i32.const 1
                    i32.sub
                    drop
                    i32.const 0
                    call 418
                    drop
                  end
                  local.get 1
                  i32.const 80
                  global.get 39
                  i32.mul
                  i32.add
                  local.set 1
                else
                  br 2 (;@5;)
                end
                local.get 7
                i32.const 1
                i32.add
                local.set 7
                br 0 (;@6;)
              end
            end
          end
          br 1 (;@2;)
        end
      end
    end
    i32.const 255
    i32.const 255
    i32.const 255
    call 6
    i32.const 0
    drop
    global.get 86
    drop
    i32.const 0
    drop
    i32.const 20
    drop
    global.get 41
    i32.const 30
    i32.sub
    drop
    i32.const 4327
    global.get 111
    call 241
    call 397
    drop
    i32.const 0
    drop
    global.get 112
    if  ;; label = @1
      global.get 113
      i32.const 0
      i32.const 0
      i32.const 0
      call 16
      i32.const 0
      drop
    end
    global.get 42
    drop
    i32.const 0
    drop
    i32.const 0
    return)
  (func (;399;) (type 15) (result i32)
    (local i32 i32 i32 i32 i32 i32)
    i32.const 1
    global.set 39
    global.get 114
    drop
    global.get 115
    drop
    i32.const 0
    drop
    i32.const 2
    drop
    i32.const 0
    drop
    i32.const 0
    drop
    i32.const 0
    drop
    global.get 40
    global.set 116
    global.get 41
    global.set 117
    i32.const 4337
    drop
    i32.const 18
    drop
    i32.const 0
    drop
    i32.const 0
    drop
    i32.const 0
    drop
    i32.const 0
    global.set 42
    global.get 42
    call 13
    i32.const 0
    drop
    i32.const 4375
    call 140
    global.set 37
    i32.const 4406
    call 140
    global.set 38
    global.get 38
    i32.const 255
    i32.const 255
    i32.const 0
    call 24
    i32.const 0
    drop
    i32.const 4437
    call 140
    global.set 118
    i32.const 4467
    call 139
    global.set 61
    i32.const 0
    local.set 0
    block  ;; label = @1
      loop  ;; label = @2
        local.get 0
        i32.const 3
        i32.gt_s
        br_if 1 (;@1;)
        i32.const 4499
        call 140
        drop
        local.get 0
        drop
        i32.const 0
        drop
        i32.const 90
        local.get 0
        i32.mul
        drop
        i32.const 0
        drop
        local.get 0
        drop
        i32.const 0
        i32.const 0
        i32.const 0
        call 21
        i32.const 0
        drop
        local.get 0
        i32.const 1
        i32.add
        local.set 0
        br 0 (;@2;)
      end
    end
    i32.const 1
    local.set 1
    block  ;; label = @1
      loop  ;; label = @2
        local.get 1
        global.get 119
        i32.gt_s
        br_if 1 (;@1;)
        i32.const 0
        local.set 2
        i32.const 0
        local.set 3
        block  ;; label = @3
          loop  ;; label = @4
            local.get 3
            global.get 119
            i32.const 1
            i32.sub
            i32.gt_s
            br_if 1 (;@3;)
            global.get 48
            drop
            i32.const 0
            local.get 0
            drop
            i32.const 0
            i32.eq
            global.get 48
            drop
            i32.const 0
            local.get 0
            drop
            i32.const 0
            i32.eq
            i32.and
            if  ;; label = @5
              i32.const 1
              local.set 2
              br 2 (;@3;)
            end
            local.get 3
            i32.const 1
            i32.add
            local.set 3
            br 0 (;@4;)
          end
        end
        local.get 2
        i32.const 0
        i32.eq
        if  ;; label = @3
          global.get 40
          local.get 0
          drop
          i32.const 0
          i32.eq
          global.get 41
          local.get 0
          drop
          i32.const 0
          i32.eq
          i32.and
          if  ;; label = @4
            global.get 120
            global.set 121
          end
          local.get 0
          drop
          i32.const 0
          drop
          local.get 0
          drop
          i32.const 0
          drop
          global.get 120
          i32.const 1
          i32.add
          global.set 120
        end
        local.get 1
        i32.const 1
        i32.add
        local.set 1
        br 0 (;@2;)
      end
    end
    i32.const 4526
    call 140
    global.set 122
    i32.const 0
    drop
    i32.const 4553
    drop
    i32.const 0
    drop
    block  ;; label = @1
      loop  ;; label = @2
        i32.const 0
        i32.const 0
        i32.const 0
        call 6
        i32.const 0
        drop
        i32.const 0
        i32.const 0
        global.get 114
        global.get 115
        i32.const 1
        call 8
        i32.const 0
        drop
        i32.const 1
        call 50
        global.set 47
        i32.const 255
        i32.const 255
        i32.const 255
        call 6
        i32.const 0
        drop
        global.get 118
        i32.const 0
        i32.const 0
        i32.const 0
        call 16
        i32.const 0
        drop
        i32.const 20
        i32.const 240
        i32.const 65
        i32.sub
        i32.const 4595
        i32.const 0
        i32.const 0
        call 11
        i32.const 0
        drop
        i32.const 40
        local.set 4
        i32.const 270
        i32.const 65
        i32.sub
        local.set 5
        i32.const 0
        local.set 0
        block  ;; label = @3
          loop  ;; label = @4
            local.get 0
            global.get 120
            i32.const 1
            i32.sub
            i32.gt_s
            br_if 1 (;@3;)
            i32.const 0
            i32.const 0
            i32.const 0
            call 6
            i32.const 0
            drop
            global.get 121
            local.get 0
            i32.eq
            if  ;; label = @5
              local.get 4
              i32.const 1
              i32.sub
              local.get 5
              i32.const 1
              i32.sub
              i32.const 100
              i32.const 20
              i32.const 0
              call 8
              i32.const 0
              drop
            end
            local.get 4
            local.get 5
            local.get 0
            drop
            i32.const 0
            call 241
            i32.const 4616
            call 397
            local.get 0
            drop
            i32.const 0
            call 241
            call 397
            i32.const 0
            i32.const 0
            call 11
            i32.const 0
            drop
            local.get 4
            i32.const 1
            i32.sub
            drop
            local.get 5
            i32.const 1
            i32.sub
            drop
            i32.const 100
            drop
            i32.const 20
            drop
            i32.const 0
            if  ;; label = @5
              i32.const 100
              i32.const 100
              i32.const 100
              call 6
              i32.const 0
              drop
              local.get 4
              i32.const 1
              i32.sub
              local.get 5
              i32.const 1
              i32.sub
              i32.const 100
              i32.const 20
              i32.const 0
              call 8
              i32.const 0
              drop
              global.get 47
              if  ;; label = @6
                local.get 0
                global.set 121
              end
            end
            local.get 5
            i32.const 20
            i32.add
            local.tee 5
            i32.const 250
            i32.const 65
            i32.sub
            global.get 115
            i32.const 80
            i32.sub
            i32.const 260
            i32.sub
            i32.add
            i32.ge_s
            if  ;; label = @5
              i32.const 270
              i32.const 65
              i32.sub
              local.set 5
              local.get 4
              i32.const 100
              i32.add
              local.set 4
            end
            local.get 0
            i32.const 1
            i32.add
            local.set 0
            br 0 (;@4;)
          end
        end
        i32.const 255
        i32.const 255
        i32.const 255
        call 6
        i32.const 0
        drop
        i32.const 30
        local.set 4
        i32.const 369
        local.set 5
        local.get 4
        i32.const 10
        i32.sub
        local.get 5
        i32.const 340
        i32.const 95
        i32.const 0
        call 8
        i32.const 0
        drop
        local.get 4
        i32.const 10
        i32.sub
        local.get 5
        i32.const 25
        i32.sub
        i32.const 4626
        i32.const 0
        i32.const 0
        call 11
        i32.const 0
        drop
        local.get 5
        i32.const 10
        i32.add
        local.set 5
        i32.const 1
        local.set 0
        block  ;; label = @3
          loop  ;; label = @4
            local.get 0
            i32.const 0
            i32.gt_s
            br_if 1 (;@3;)
            i32.const 0
            i32.const 0
            i32.const 0
            call 6
            i32.const 0
            drop
            global.get 123
            local.get 0
            i32.eq
            if  ;; label = @5
              local.get 4
              i32.const 1
              i32.sub
              local.get 5
              i32.const 1
              i32.sub
              i32.const 290
              i32.const 20
              i32.const 0
              call 8
              i32.const 0
              drop
            end
            local.get 0
            drop
            i32.const 0
            local.get 4
            local.get 5
            i32.const 290
            i32.const 0
            call 414
            drop
            local.get 4
            i32.const 1
            i32.sub
            drop
            local.get 5
            i32.const 1
            i32.sub
            drop
            i32.const 290
            drop
            i32.const 20
            drop
            i32.const 0
            if  ;; label = @5
              i32.const 100
              i32.const 100
              i32.const 100
              call 6
              i32.const 0
              drop
              local.get 4
              i32.const 1
              i32.sub
              local.get 5
              i32.const 1
              i32.sub
              i32.const 290
              i32.const 20
              i32.const 0
              call 8
              i32.const 0
              drop
              global.get 47
              if  ;; label = @6
                local.get 0
                global.set 123
              end
            end
            local.get 5
            i32.const 20
            i32.add
            local.set 5
            local.get 0
            i32.const 1
            i32.add
            local.set 0
            br 0 (;@4;)
          end
        end
        i32.const 40
        i32.const 430
        i32.add
        i32.const 15
        i32.sub
        i32.const 260
        i32.const 55
        i32.sub
        i32.const 5
        i32.add
        i32.const 8
        i32.sub
        global.get 112
        global.get 124
        call 408
        global.set 112
        i32.const 40
        i32.const 430
        i32.add
        i32.const 15
        i32.sub
        i32.const 260
        i32.const 55
        i32.sub
        i32.const 35
        i32.add
        global.get 124
        i32.const 0
        call 408
        global.set 124
        i32.const 0
        global.set 125
        global.get 124
        global.get 112
        i32.or
        if  ;; label = @3
          i32.const 1
          global.set 125
        end
        i32.const 40
        i32.const 430
        i32.add
        i32.const 15
        i32.sub
        i32.const 260
        i32.const 55
        i32.sub
        i32.const 65
        i32.add
        i32.const 8
        i32.add
        global.get 126
        global.get 125
        call 408
        global.set 126
        i32.const 40
        i32.const 430
        i32.add
        i32.const 15
        i32.sub
        i32.const 260
        i32.const 55
        i32.sub
        i32.const 95
        i32.add
        i32.const 8
        i32.add
        global.get 127
        i32.const 0
        call 408
        global.set 127
        global.get 124
        if  ;; label = @3
          i32.const 255
          i32.const 0
          i32.const 0
          call 6
          i32.const 0
          drop
          i32.const 0
          global.set 112
        else
          i32.const 255
          i32.const 255
          i32.const 255
          call 6
          i32.const 0
          drop
        end
        i32.const 40
        i32.const 430
        i32.add
        i32.const 15
        i32.add
        i32.const 262
        i32.const 55
        i32.sub
        i32.const 5
        i32.add
        i32.const 8
        i32.sub
        i32.const 4644
        i32.const 0
        i32.const 0
        call 11
        i32.const 0
        drop
        i32.const 255
        i32.const 255
        i32.const 255
        call 6
        i32.const 0
        drop
        i32.const 40
        i32.const 430
        i32.add
        i32.const 15
        i32.add
        i32.const 262
        i32.const 55
        i32.sub
        i32.const 35
        i32.add
        i32.const 8
        i32.sub
        i32.const 4663
        i32.const 0
        i32.const 0
        call 11
        i32.const 0
        drop
        i32.const 40
        i32.const 430
        i32.add
        i32.const 15
        i32.add
        i32.const 262
        i32.const 55
        i32.sub
        i32.const 35
        i32.add
        i32.const 12
        i32.add
        i32.const 4682
        i32.const 0
        i32.const 0
        call 11
        i32.const 0
        drop
        global.get 124
        global.get 112
        i32.or
        if  ;; label = @3
          i32.const 255
          i32.const 0
          i32.const 0
          call 6
          i32.const 0
          drop
          i32.const 0
          global.set 126
        else
          i32.const 255
          i32.const 255
          i32.const 255
          call 6
          i32.const 0
          drop
        end
        i32.const 40
        i32.const 430
        i32.add
        i32.const 15
        i32.add
        i32.const 262
        i32.const 55
        i32.sub
        i32.const 65
        i32.add
        i32.const 8
        i32.add
        i32.const 4704
        i32.const 0
        i32.const 0
        call 11
        i32.const 0
        drop
        i32.const 255
        i32.const 255
        i32.const 255
        call 6
        i32.const 0
        drop
        i32.const 40
        i32.const 430
        i32.add
        i32.const 15
        i32.add
        i32.const 262
        i32.const 55
        i32.sub
        i32.const 95
        i32.add
        i32.const 8
        i32.add
        i32.const 4719
        i32.const 0
        i32.const 0
        call 11
        i32.const 0
        drop
        global.get 124
        if  ;; label = @3
          global.get 112
          if  ;; label = @4
            i32.const 40
            i32.const 260
            i32.add
            i32.const 15
            i32.add
            i32.const 262
            i32.const 55
            i32.sub
            i32.const 140
            i32.add
            i32.const 4740
            global.get 121
            drop
            i32.const 0
            call 241
            i32.const 4769
            call 397
            global.get 121
            drop
            i32.const 0
            call 241
            call 397
            i32.const 4779
            call 397
            i32.const 16
            i32.const 16
            global.get 126
            i32.mul
            i32.add
            call 241
            call 397
            call 397
            i32.const 0
            i32.const 0
            call 11
            i32.const 0
            drop
          else
            i32.const 40
            i32.const 260
            i32.add
            i32.const 15
            i32.add
            i32.const 262
            i32.const 55
            i32.sub
            i32.const 140
            i32.add
            i32.const 4789
            global.get 121
            drop
            i32.const 0
            call 241
            i32.const 4818
            call 397
            global.get 121
            drop
            i32.const 0
            call 241
            call 397
            i32.const 4828
            call 397
            call 397
            i32.const 0
            i32.const 0
            call 11
            i32.const 0
            drop
          end
        else
          i32.const 40
          i32.const 260
          i32.add
          i32.const 15
          i32.add
          i32.const 262
          i32.const 55
          i32.sub
          i32.const 140
          i32.add
          i32.const 4840
          global.get 121
          drop
          i32.const 0
          call 241
          call 397
          i32.const 4869
          call 397
          global.get 121
          drop
          i32.const 0
          call 241
          call 397
          i32.const 4879
          call 397
          i32.const 0
          i32.const 0
          call 11
          i32.const 0
          drop
          global.get 121
          drop
          i32.const 0
          global.get 128
          i32.lt_s
          if  ;; label = @4
            i32.const 40
            i32.const 260
            i32.add
            i32.const 65
            i32.add
            i32.const 262
            i32.const 55
            i32.sub
            i32.const 160
            i32.add
            i32.const 4891
            i32.const 0
            i32.const 0
            call 11
            i32.const 0
            drop
            i32.const 40
            i32.const 260
            i32.add
            i32.const 65
            i32.add
            i32.const 262
            i32.const 55
            i32.sub
            i32.const 180
            i32.add
            global.get 128
            call 241
            i32.const 4912
            call 397
            global.get 129
            call 241
            call 397
            i32.const 4922
            call 397
            i32.const 0
            i32.const 0
            call 11
            i32.const 0
            drop
          else
            global.get 121
            drop
            i32.const 0
            global.get 128
            i32.gt_s
            if  ;; label = @5
              i32.const 40
              i32.const 260
              i32.add
              i32.const 65
              i32.add
              i32.const 262
              i32.const 55
              i32.sub
              i32.const 160
              i32.add
              i32.const 4935
              i32.const 0
              i32.const 0
              call 11
              i32.const 0
              drop
              i32.const 40
              i32.const 260
              i32.add
              i32.const 65
              i32.add
              i32.const 262
              i32.const 55
              i32.sub
              i32.const 180
              i32.add
              global.get 128
              call 241
              i32.const 4958
              call 397
              global.get 129
              call 241
              call 397
              i32.const 4968
              call 397
              i32.const 0
              i32.const 0
              call 11
              i32.const 0
              drop
            end
          end
        end
        global.get 114
        i32.const 275
        i32.sub
        global.get 115
        i32.const 50
        i32.sub
        global.get 130
        i32.const 0
        call 408
        global.set 130
        i32.const 255
        i32.const 255
        i32.const 255
        call 6
        i32.const 0
        drop
        global.get 114
        i32.const 250
        i32.sub
        global.get 115
        i32.const 70
        i32.sub
        i32.const 4981
        i32.const 0
        i32.const 0
        call 11
        i32.const 0
        drop
        global.get 114
        i32.const 250
        i32.sub
        global.get 115
        i32.const 50
        i32.sub
        i32.const 4999
        i32.const 0
        i32.const 0
        call 11
        i32.const 0
        drop
        global.get 114
        i32.const 250
        i32.sub
        global.get 115
        i32.const 30
        i32.sub
        i32.const 5018
        i32.const 0
        i32.const 0
        call 11
        i32.const 0
        drop
        global.get 114
        i32.const 30
        i32.sub
        i32.const 90
        i32.sub
        global.get 115
        i32.const 50
        i32.sub
        i32.const 55
        i32.sub
        i32.const 100
        i32.const 30
        i32.const 5033
        i32.const 0
        i32.const 0
        i32.const 0
        call 406
        if  ;; label = @3
          global.get 121
          drop
          i32.const 0
          global.set 40
          global.get 121
          drop
          i32.const 0
          global.set 41
          global.get 40
          global.set 116
          global.get 41
          global.set 117
          br 2 (;@1;)
        end
        global.get 114
        i32.const 30
        i32.sub
        i32.const 90
        i32.sub
        global.get 115
        i32.const 50
        i32.sub
        i32.const 100
        i32.const 30
        i32.const 5048
        i32.const 0
        i32.const 0
        i32.const 0
        call 406
        if  ;; label = @3
        end
        i32.const 1
        i32.eqz
        br_if 0 (;@2;)
      end
    end
    global.get 50
    drop
    i32.const 5061
    drop
    i32.const 5077
    drop
    global.get 121
    drop
    i32.const 0
    drop
    f32.const 0x0p+0 (;=0;)
    drop
    global.get 50
    drop
    i32.const 5091
    drop
    i32.const 5107
    drop
    global.get 121
    drop
    i32.const 0
    drop
    f32.const 0x0p+0 (;=0;)
    drop
    global.get 112
    if  ;; label = @1
      global.get 50
      drop
      i32.const 5122
      drop
      i32.const 5138
      drop
      i32.const 5157
      drop
      f32.const 0x0p+0 (;=0;)
      drop
    else
      global.get 50
      drop
      i32.const 5170
      drop
      i32.const 5186
      drop
      i32.const 5205
      drop
      f32.const 0x0p+0 (;=0;)
      drop
    end
    global.get 127
    if  ;; label = @1
      global.get 50
      drop
      i32.const 5219
      drop
      i32.const 5236
      drop
      i32.const 5261
      drop
      f32.const 0x0p+0 (;=0;)
      drop
    else
      global.get 50
      drop
      i32.const 5274
      drop
      i32.const 5291
      drop
      i32.const 5316
      drop
      f32.const 0x0p+0 (;=0;)
      drop
    end
    global.get 124
    if  ;; label = @1
      global.get 50
      drop
      i32.const 5330
      drop
      i32.const 5346
      drop
      i32.const 5374
      drop
      f32.const 0x0p+0 (;=0;)
      drop
    else
      global.get 50
      drop
      i32.const 5387
      drop
      i32.const 5403
      drop
      i32.const 5431
      drop
      f32.const 0x0p+0 (;=0;)
      drop
    end
    global.get 126
    if  ;; label = @1
      global.get 50
      drop
      i32.const 5445
      drop
      i32.const 5461
      drop
      i32.const 5475
      drop
      f32.const 0x0p+0 (;=0;)
      drop
    else
      global.get 50
      drop
      i32.const 5488
      drop
      i32.const 5504
      drop
      i32.const 5518
      drop
      f32.const 0x0p+0 (;=0;)
      drop
    end
    global.get 50
    drop
    i32.const 5532
    drop
    i32.const 5548
    drop
    global.get 123
    drop
    f32.const 0x0p+0 (;=0;)
    drop
    global.get 130
    if  ;; label = @1
      global.get 50
      drop
      i32.const 5567
      drop
      i32.const 5583
      drop
      i32.const 5609
      drop
      f32.const 0x0p+0 (;=0;)
      drop
    else
      global.get 50
      drop
      i32.const 5622
      drop
      i32.const 5638
      drop
      i32.const 5664
      drop
      f32.const 0x0p+0 (;=0;)
      drop
    end
    i32.const 0
    return)
  (func (;400;) (type 47) (param i32 i32 i32 f32 f32 i32 i32 i32 i32) (result i32)
    (local i32 i32)
    local.get 5
    local.set 9
    block  ;; label = @1
      loop  ;; label = @2
        local.get 9
        local.get 5
        local.get 7
        i32.add
        i32.lt_s
        i32.eqz
        br_if 1 (;@1;)
        local.get 6
        local.set 10
        block  ;; label = @3
          loop  ;; label = @4
            local.get 10
            local.get 6
            local.get 8
            i32.add
            i32.lt_s
            i32.eqz
            br_if 1 (;@3;)
            local.get 9
            f32.convert_i32_s
            local.get 3
            f32.add
            local.get 5
            local.get 7
            i32.add
            f32.convert_i32_s
            f32.gt
            if  ;; label = @5
              local.get 3
              local.get 9
              f32.convert_i32_s
              local.get 3
              f32.add
              local.get 5
              local.get 7
              i32.add
              f32.convert_i32_s
              f32.sub
              i32.const 1
              f32.convert_i32_s
              call 357
              f32.sub
              local.set 3
            end
            local.get 10
            f32.convert_i32_s
            local.get 4
            f32.add
            local.get 6
            local.get 8
            i32.add
            f32.convert_i32_s
            f32.gt
            if  ;; label = @5
              local.get 4
              local.get 10
              f32.convert_i32_s
              local.get 4
              f32.add
              local.get 6
              local.get 8
              i32.add
              f32.convert_i32_s
              f32.sub
              i32.const 1
              f32.convert_i32_s
              call 357
              f32.sub
              local.set 4
            end
            local.get 0
            drop
            local.get 9
            drop
            local.get 10
            drop
            local.get 1
            drop
            local.get 2
            drop
            local.get 3
            drop
            local.get 4
            drop
            i32.const 0
            drop
            local.get 10
            f32.convert_i32_s
            local.get 4
            f32.add
            i32.trunc_f32_s
            local.set 10
            br 0 (;@4;)
          end
        end
        local.get 9
        f32.convert_i32_s
        local.get 3
        f32.add
        i32.trunc_f32_s
        local.set 9
        br 0 (;@2;)
      end
    end
    i32.const 0
    return)
  (func (;401;) (type 7) (param i32) (result i32)
    (local i32 i32 i32 i32)
    local.get 0
    call 209
    local.set 4
    block  ;; label = @1
      loop  ;; label = @2
        local.get 4
        call 227
        i32.eqz
        br_if 1 (;@1;)
        local.get 4
        call 237
        call 335
        local.tee 1
        i32.const 1
        call 327
        i32.const 5678
        call 269
        if  ;; label = @3
          local.get 1
          i32.const 2
          local.get 1
          call 334
          i32.const 2
          i32.sub
          call 329
          local.set 1
          global.get 3
          if  ;; label = @4
            global.get 3
            global.set 7
            global.get 7
            i32.load offset=4
            global.set 3
          else
            global.get 4
            global.set 7
            global.get 7
            i32.const 64
            i32.add
            global.set 4
          end
          global.get 7
          global.get 2
          i32.store
          global.get 7
          i32.const 0
          i32.store offset=4
          global.get 7
          i32.const 1
          i32.store offset=8
          global.get 2
          if  ;; label = @4
            global.get 2
            global.get 7
            i32.store offset=4
          end
          global.get 1
          i32.eqz
          if  ;; label = @4
            global.get 7
            global.set 1
          end
          global.get 7
          global.set 2
          global.get 7
          local.set 3
          global.get 131
          i32.const 1
          i32.add
          global.set 131
          local.get 3
          i32.const 20
          i32.add
          global.get 131
          i32.store
          local.get 3
          i32.const 24
          i32.add
          local.get 1
          i32.store
          local.get 3
          i32.const 12
          i32.add
          local.get 0
          drop
          local.get 1
          drop
          i32.const 5688
          drop
          i32.const 0
          i32.store
          i32.const 0
          local.set 2
          block  ;; label = @4
            loop  ;; label = @5
              local.get 2
              i32.const 4
              i32.gt_s
              br_if 1 (;@4;)
              local.get 3
              i32.const 40
              i32.add
              local.get 2
              i32.const 4
              i32.mul
              i32.add
              local.get 0
              drop
              local.get 1
              drop
              i32.const 5707
              local.get 2
              i32.const 1
              i32.add
              call 241
              call 397
              drop
              i32.const 0
              i32.store
              local.get 3
              i32.const 40
              i32.add
              local.get 2
              i32.const 4
              i32.mul
              i32.add
              i32.load
              i32.const 5720
              call 269
              i32.eqz
              if  ;; label = @6
                local.get 3
                i32.const 60
                i32.add
                local.get 3
                i32.const 60
                i32.add
                i32.load
                i32.const 1
                i32.add
                i32.store
              end
              local.get 2
              i32.const 1
              i32.add
              local.set 2
              br 0 (;@5;)
            end
          end
          local.get 3
          i32.const 36
          i32.add
          local.get 0
          drop
          local.get 1
          drop
          i32.const 5729
          drop
          i32.const 0
          i32.store
          block  ;; label = @4
            local.get 0
            drop
            local.get 1
            drop
            i32.const 5755
            drop
            i32.const 0
            call 331
            global.set 7
            global.get 7
            i32.const 5771
            i32.eq
            if  ;; label = @5
              local.get 3
              i32.const 28
              i32.add
              i32.const 1
              i32.const -1
              i32.mul
              i32.store
              br 1 (;@4;)
            end
            global.get 7
            i32.const 5784
            i32.eq
            global.get 7
            i32.const 5799
            i32.eq
            i32.or
            if  ;; label = @5
              local.get 3
              i32.const 28
              i32.add
              i32.const 0
              i32.store
              br 1 (;@4;)
            end
            global.get 7
            i32.const 5814
            i32.eq
            if  ;; label = @5
              local.get 3
              i32.const 28
              i32.add
              i32.const 1
              i32.store
              br 1 (;@4;)
            end
          end
          block  ;; label = @4
            local.get 0
            drop
            local.get 1
            drop
            i32.const 5828
            drop
            i32.const 0
            call 331
            global.set 7
            global.get 7
            i32.const 5844
            i32.eq
            global.get 7
            i32.const 5856
            i32.eq
            i32.or
            if  ;; label = @5
              local.get 3
              i32.const 32
              i32.add
              i32.const 1
              i32.const -1
              i32.mul
              i32.store
              br 1 (;@4;)
            end
            global.get 7
            i32.const 5867
            i32.eq
            global.get 7
            i32.const 5882
            i32.eq
            i32.or
            if  ;; label = @5
              local.get 3
              i32.const 32
              i32.add
              i32.const 0
              i32.store
              br 1 (;@4;)
            end
            global.get 7
            i32.const 5897
            i32.eq
            global.get 7
            i32.const 5912
            i32.eq
            i32.or
            if  ;; label = @5
              local.get 3
              i32.const 32
              i32.add
              i32.const 1
              i32.store
              br 1 (;@4;)
            end
          end
        end
        br 0 (;@2;)
      end
    end
    local.get 4
    call 210
    i32.const 0
    drop
    i32.const 0
    return)
  (func (;402;) (type 12) (param i32 i32) (result i32)
    (local i32 i32 i32 i32 i32 i32 i32)
    local.get 0
    i32.const 0
    i32.eq
    if  ;; label = @1
      i32.const 0
      global.set 132
      i32.const 1
      global.get 131
      call 354
      global.set 133
      i32.const 0
      local.set 4
      block  ;; label = @2
        loop  ;; label = @3
          local.get 4
          i32.const 0
          i32.gt_s
          br_if 1 (;@2;)
          i32.const 0
          global.get 133
          i32.eq
          if  ;; label = @4
            i32.const 0
            i32.const 0
            i32.eq
            if  ;; label = @5
              local.get 4
              drop
              i32.const 5925
              i32.const 0
              call 241
              call 397
              call 140
              drop
            end
            local.get 4
            global.set 134
            br 2 (;@2;)
          end
          local.get 4
          i32.const 1
          i32.add
          local.set 4
          br 0 (;@3;)
        end
      end
    end
    i32.const 1
    global.set 135
    block  ;; label = @1
      loop  ;; label = @2
        i32.const 0
        i32.const 0
        i32.const 0
        call 5
        i32.const 0
        drop
        local.get 0
        i32.const 20
        i32.gt_s
        if  ;; label = @3
          i32.const 0
          drop
        end
        local.get 1
        i32.const 0
        i32.eq
        if  ;; label = @3
          local.get 0
          f32.convert_i32_s
          f32.const 0x1.9p+6 (;=100;)
          i32.const 0
          f32.convert_i32_s
          f32.div
          global.get 132
          i32.const 1
          i32.add
          f32.convert_i32_s
          f32.mul
          f32.gt
          if  ;; label = @4
            global.get 132
            i32.const 1
            i32.add
            global.set 132
          end
        end
        i32.const 0
        if  ;; label = @3
          global.get 136
          global.get 40
          i32.const 2
          i32.div_s
          global.get 136
          call 19
          i32.const 2
          i32.div_s
          i32.sub
          global.get 41
          i32.const 2
          i32.div_s
          global.get 136
          call 20
          i32.const 2
          i32.div_s
          i32.sub
          i32.const 0
          call 16
          i32.const 0
          drop
        end
        i32.const 0
        i32.const 0
        i32.eq
        if  ;; label = @3
          global.get 40
          i32.const 2
          i32.div_s
          i32.const 0
          call 19
          i32.const 2
          i32.div_s
          i32.sub
          local.set 2
        else
          i32.const 0
          i32.const 1
          i32.eq
          if  ;; label = @4
            global.get 40
            i32.const 0
            call 19
            i32.sub
            local.set 2
          else
            i32.const 0
            local.set 2
          end
        end
        i32.const 0
        i32.const 0
        i32.eq
        if  ;; label = @3
          global.get 41
          i32.const 2
          i32.div_s
          i32.const 0
          call 20
          i32.const 2
          i32.div_s
          i32.sub
          local.set 3
        else
          i32.const 0
          i32.const 1
          i32.eq
          if  ;; label = @4
            global.get 41
            i32.const 0
            call 20
            i32.sub
            local.set 3
          else
            i32.const 0
            local.set 3
          end
        end
        i32.const 0
        local.get 2
        local.get 3
        i32.const 0
        call 16
        i32.const 0
        drop
        i32.const 300
        local.set 5
        i32.const 20
        local.set 6
        global.get 40
        i32.const 2
        i32.div_s
        local.get 5
        i32.const 2
        i32.div_s
        i32.sub
        local.set 2
        global.get 41
        i32.const 2
        i32.div_s
        i32.const 30
        i32.add
        i32.const 100
        i32.sub
        local.set 3
        local.get 2
        local.get 3
        local.get 5
        i32.const 4
        i32.add
        local.get 6
        i32.const 0
        call 8
        i32.const 0
        drop
        i32.const 1
        local.set 7
        block  ;; label = @3
          loop  ;; label = @4
            local.get 7
            local.get 5
            i32.const 2
            i32.sub
            f32.convert_i32_s
            local.get 0
            f32.convert_i32_s
            f32.const 0x1.9p+6 (;=100;)
            f32.div
            f32.mul
            i32.const 10
            f32.convert_i32_s
            f32.div
            i32.trunc_f32_s
            i32.gt_s
            br_if 1 (;@3;)
            global.get 122
            local.get 2
            i32.const 3
            i32.add
            i32.const 10
            global.get 46
            i32.const 1
            i32.sub
            i32.mul
            i32.add
            local.get 3
            i32.const 3
            i32.add
            i32.const 0
            call 16
            i32.const 0
            drop
            local.get 7
            i32.const 1
            i32.add
            local.set 7
            br 0 (;@4;)
          end
        end
        i32.const 0
        i32.const 5949
        call 269
        if  ;; label = @3
          local.get 1
          if  ;; label = @4
            global.get 135
            if  ;; label = @5
              local.get 0
              i32.const 0
              i32.eq
              if  ;; label = @6
                i32.const 5961
                call 142
                call 143
                drop
              else
                local.get 0
                i32.const 100
                i32.eq
                if  ;; label = @7
                  i32.const 5990
                  call 142
                  call 143
                  drop
                end
              end
            end
          end
          global.get 44
          drop
          i32.const 0
          drop
          i32.const 6019
          global.set 137
          i32.const 2
          i32.const 9
          call 354
          global.set 133
          i32.const 0
          local.set 8
          block  ;; label = @4
            loop  ;; label = @5
              local.get 8
              global.get 133
              i32.gt_s
              br_if 1 (;@4;)
              global.get 138
              i32.const 48
              i32.const 122
              call 354
              call 339
              i32.add
              global.set 137
              local.get 8
              i32.const 1
              i32.add
              local.set 8
              br 0 (;@5;)
            end
          end
          global.get 40
          i32.const 2
          i32.div_s
          drop
          global.get 41
          i32.const 2
          i32.div_s
          i32.const 80
          i32.add
          drop
          global.get 137
          drop
          i32.const 1
          drop
          i32.const 1
          drop
          i32.const 0
          drop
          local.get 0
          i32.const 0
          i32.eq
          if  ;; label = @4
            i32.const 5
            i32.const 0
            call 354
            i32.const 1
            i32.eq
            if  ;; label = @5
              block  ;; label = @6
                i32.const 2
                i32.const 0
                call 354
                global.set 7
                global.get 7
                i32.const 1
                i32.eq
                if  ;; label = @7
                  global.get 134
                  drop
                  i32.const 6028
                  call 149
                  call 241
                  call 397
                  i32.const 6055
                  call 397
                  drop
                  br 1 (;@6;)
                end
                global.get 7
                i32.const 2
                i32.eq
                if  ;; label = @7
                  global.get 134
                  drop
                  i32.const 0
                  drop
                  br 1 (;@6;)
                end
              end
            else
              block  ;; label = @6
                i32.const 13
                i32.const 0
                call 354
                global.set 7
                global.get 7
                i32.const 1
                i32.eq
                if  ;; label = @7
                  global.get 134
                  drop
                  i32.const 6065
                  drop
                  br 1 (;@6;)
                end
                global.get 7
                i32.const 2
                i32.eq
                if  ;; label = @7
                  global.get 134
                  drop
                  i32.const 6117
                  drop
                  br 1 (;@6;)
                end
                global.get 7
                i32.const 3
                i32.eq
                if  ;; label = @7
                  global.get 134
                  drop
                  i32.const 6146
                  drop
                  br 1 (;@6;)
                end
                global.get 7
                i32.const 4
                i32.eq
                if  ;; label = @7
                  global.get 134
                  drop
                  i32.const 6177
                  drop
                  br 1 (;@6;)
                end
                global.get 7
                i32.const 5
                i32.eq
                if  ;; label = @7
                  global.get 134
                  drop
                  i32.const 6205
                  drop
                  br 1 (;@6;)
                end
                global.get 7
                i32.const 6
                i32.eq
                if  ;; label = @7
                  global.get 134
                  drop
                  i32.const 6234
                  drop
                  br 1 (;@6;)
                end
                global.get 7
                i32.const 7
                i32.eq
                if  ;; label = @7
                  global.get 134
                  drop
                  i32.const 6327
                  drop
                  br 1 (;@6;)
                end
                global.get 7
                i32.const 8
                i32.eq
                global.get 7
                i32.const 9
                i32.eq
                i32.or
                if  ;; label = @7
                  global.get 134
                  drop
                  i32.const 6357
                  drop
                  br 1 (;@6;)
                end
                global.get 7
                i32.const 10
                i32.eq
                if  ;; label = @7
                  global.get 134
                  drop
                  i32.const 6395
                  drop
                  br 1 (;@6;)
                end
                global.get 7
                i32.const 11
                i32.eq
                if  ;; label = @7
                  global.get 134
                  drop
                  i32.const 6415
                  drop
                  br 1 (;@6;)
                end
                global.get 7
                i32.const 12
                i32.eq
                if  ;; label = @7
                  global.get 134
                  drop
                  i32.const 6463
                  drop
                  br 1 (;@6;)
                end
                global.get 7
                i32.const 13
                i32.eq
                if  ;; label = @7
                  global.get 134
                  drop
                  i32.const 6534
                  drop
                  br 1 (;@6;)
                end
              end
            end
          end
          i32.const 0
          global.set 137
          i32.const 0
          call 334
          i32.const 5
          i32.const 0
          call 354
          i32.sub
          global.set 133
          i32.const 0
          local.set 8
          block  ;; label = @4
            loop  ;; label = @5
              local.get 8
              i32.const 10
              i32.const 15
              call 354
              i32.gt_s
              br_if 1 (;@4;)
              i32.const 0
              i32.const 0
              i32.const 1
              global.get 137
              call 334
              i32.const 1
              i32.sub
              call 354
              i32.const 1
              call 329
              i32.const 130
              i32.const 250
              call 354
              call 339
              call 332
              global.set 137
              local.get 8
              i32.const 1
              i32.add
              local.set 8
              br 0 (;@5;)
            end
          end
          global.get 42
          drop
          i32.const 0
          drop
          global.get 137
          global.get 40
          i32.const 2
          i32.div_s
          i32.const 200
          i32.sub
          global.get 41
          i32.const 2
          i32.div_s
          i32.const 120
          i32.add
          i32.const 400
          i32.const 300
          i32.const 1
          i32.const 1
          f32.convert_i32_s
          call 410
          drop
        else
          i32.const 0
          i32.const 0
          i32.const 0
          call 6
          i32.const 0
          drop
          global.get 44
          drop
          i32.const 0
          drop
          global.get 40
          i32.const 2
          i32.div_s
          i32.const 1
          i32.add
          drop
          global.get 41
          i32.const 2
          i32.div_s
          i32.const 80
          i32.add
          i32.const 1
          i32.add
          drop
          i32.const 0
          drop
          i32.const 1
          drop
          i32.const 1
          drop
          i32.const 0
          drop
          global.get 42
          drop
          i32.const 0
          drop
          i32.const 0
          global.get 40
          i32.const 2
          i32.div_s
          i32.const 200
          i32.sub
          i32.const 1
          i32.add
          global.get 41
          i32.const 2
          i32.div_s
          i32.const 120
          i32.add
          i32.const 1
          i32.add
          i32.const 400
          i32.const 300
          i32.const 1
          i32.const 1
          f32.convert_i32_s
          call 410
          drop
          i32.const 255
          i32.const 255
          i32.const 255
          call 6
          i32.const 0
          drop
          global.get 44
          drop
          i32.const 0
          drop
          global.get 40
          i32.const 2
          i32.div_s
          drop
          global.get 41
          i32.const 2
          i32.div_s
          i32.const 80
          i32.add
          drop
          i32.const 0
          drop
          i32.const 1
          drop
          i32.const 1
          drop
          i32.const 0
          drop
          global.get 42
          drop
          i32.const 0
          drop
          i32.const 0
          global.get 40
          i32.const 2
          i32.div_s
          i32.const 200
          i32.sub
          global.get 41
          i32.const 2
          i32.div_s
          i32.const 120
          i32.add
          i32.const 400
          i32.const 300
          i32.const 1
          i32.const 1
          f32.convert_i32_s
          call 410
          drop
        end
        i32.const 0
        i32.const 0
        i32.const 0
        call 6
        i32.const 0
        drop
        global.get 40
        i32.const 2
        i32.div_s
        i32.const 1
        i32.add
        drop
        global.get 41
        i32.const 2
        i32.div_s
        i32.const 100
        i32.sub
        i32.const 1
        i32.add
        drop
        i32.const 6586
        local.get 0
        call 241
        call 397
        i32.const 6605
        call 397
        drop
        i32.const 1
        drop
        i32.const 1
        drop
        i32.const 0
        drop
        i32.const 255
        i32.const 255
        i32.const 255
        call 6
        i32.const 0
        drop
        global.get 40
        i32.const 2
        i32.div_s
        drop
        global.get 41
        i32.const 2
        i32.div_s
        i32.const 100
        i32.sub
        drop
        i32.const 6616
        local.get 0
        call 241
        call 397
        i32.const 6635
        call 397
        drop
        i32.const 1
        drop
        i32.const 1
        drop
        i32.const 0
        drop
        local.get 0
        i32.const 100
        i32.eq
        if  ;; label = @3
          global.get 135
          i32.const 0
          i32.const 6646
          call 269
          i32.eqz
          i32.and
          if  ;; label = @4
            i32.const 6658
            call 142
            call 143
            drop
          end
          global.get 40
          i32.const 2
          i32.div_s
          drop
          global.get 41
          i32.const 50
          i32.sub
          drop
          i32.const 6689
          drop
          i32.const 1
          drop
          i32.const 1
          drop
          i32.const 0
          drop
        else
          i32.const 0
          drop
          i32.const 0
          drop
        end
        global.get 124
        if  ;; label = @3
          global.get 116
          global.get 40
          i32.ne
          global.get 117
          global.get 41
          i32.ne
          i32.or
          if  ;; label = @4
            global.get 139
            drop
            i32.const 0
            drop
            i32.const 0
            drop
            i32.const 0
            i32.const 0
            i32.const 0
            call 5
            i32.const 0
            drop
            i32.const 0
            drop
            i32.const 0
            drop
            global.get 40
            drop
            global.get 41
            drop
            i32.const 1024
            global.get 40
            i32.const 2
            i32.div_s
            i32.sub
            drop
            i32.const 1024
            global.get 41
            i32.const 2
            i32.div_s
            i32.sub
            drop
            i32.const 0
            drop
            global.get 139
            drop
            i32.const 0
            drop
            i32.const 0
            drop
            i32.const 0
            drop
            i32.const 0
            drop
            i32.const 0
            i32.const 0
            i32.const 0
            call 5
            i32.const 0
            drop
            i32.const 0
            drop
            i32.const 0
            drop
            f32.const 0x1.004p+11 (;=2050;)
            global.get 40
            f32.convert_i32_s
            f32.div
            global.get 140
            f32.convert_i32_s
            f32.mul
            drop
            f32.const 0x1.004p+11 (;=2050;)
            global.get 40
            f32.convert_i32_s
            f32.div
            global.get 140
            f32.convert_i32_s
            f32.mul
            drop
            i32.const 0
            drop
          end
        end
        global.get 68
        f32.convert_i32_s
        f32.const 0x1p+0 (;=1;)
        f32.gt
        if  ;; label = @3
          i32.const 0
          drop
          i32.const 0
          drop
          global.get 116
          drop
          global.get 117
          drop
          i32.const 1024
          global.get 116
          i32.const 2
          i32.div_s
          i32.sub
          drop
          i32.const 1024
          global.get 117
          i32.const 2
          i32.div_s
          i32.sub
          drop
          i32.const 0
          drop
          global.get 139
          drop
          i32.const 0
          drop
          i32.const 0
          drop
          global.get 141
          i32.const 1
          call 120
          i32.const 0
          drop
          i32.const 0
          i32.const 0
          i32.const 0
          call 5
          i32.const 0
          drop
          f32.const 0x1p+0 (;=1;)
          f32.neg
          global.get 116
          f32.convert_i32_s
          f32.div
          drop
          f32.const 0x1p+0 (;=1;)
          global.get 116
          f32.convert_i32_s
          f32.div
          drop
          f32.const 0x1p+11 (;=2048;)
          global.get 116
          f32.convert_i32_s
          f32.div
          drop
          f32.const 0x1p+11 (;=2048;)
          global.get 116
          f32.convert_i32_s
          f32.div
          drop
          i32.const 0
          drop
          global.get 141
          i32.const 1
          i32.const 32
          i32.add
          call 119
          i32.const 0
          drop
          global.get 141
          i32.const 3
          call 120
          i32.const 0
          drop
          global.get 141
          global.get 68
          f32.convert_i32_s
          f32.const 0x1p+0 (;=1;)
          f32.sub
          call 116
          i32.const 0
          drop
          f32.const 0x1p+0 (;=1;)
          f32.neg
          global.get 116
          f32.convert_i32_s
          f32.div
          drop
          f32.const 0x1p+0 (;=1;)
          global.get 116
          f32.convert_i32_s
          f32.div
          drop
          f32.const 0x1p+11 (;=2048;)
          global.get 116
          f32.convert_i32_s
          f32.div
          drop
          f32.const 0x1p+11 (;=2048;)
          global.get 116
          f32.convert_i32_s
          f32.div
          drop
          i32.const 0
          drop
        else
          global.get 68
          f32.convert_i32_s
          f32.const 0x1p+0 (;=1;)
          f32.lt
          if  ;; label = @4
            i32.const 0
            drop
            i32.const 0
            drop
            global.get 116
            drop
            global.get 117
            drop
            i32.const 1024
            global.get 116
            i32.const 2
            i32.div_s
            i32.sub
            drop
            i32.const 1024
            global.get 117
            i32.const 2
            i32.div_s
            i32.sub
            drop
            i32.const 0
            drop
            global.get 139
            drop
            i32.const 0
            drop
            i32.const 0
            drop
            global.get 141
            i32.const 1
            call 120
            i32.const 0
            drop
            i32.const 0
            i32.const 0
            i32.const 0
            call 5
            i32.const 0
            drop
            f32.const 0x1p+0 (;=1;)
            f32.neg
            global.get 116
            f32.convert_i32_s
            f32.div
            drop
            f32.const 0x1p+0 (;=1;)
            global.get 116
            f32.convert_i32_s
            f32.div
            drop
            f32.const 0x1p+11 (;=2048;)
            global.get 116
            f32.convert_i32_s
            f32.div
            drop
            f32.const 0x1p+11 (;=2048;)
            global.get 116
            f32.convert_i32_s
            f32.div
            drop
            i32.const 0
            drop
            global.get 141
            i32.const 1
            i32.const 32
            i32.add
            call 119
            i32.const 0
            drop
            global.get 141
            i32.const 2
            call 120
            i32.const 0
            drop
            global.get 141
            f32.const 0x1p+0 (;=1;)
            call 116
            i32.const 0
            drop
            global.get 142
            drop
            i32.const 0
            drop
            i32.const 0
            drop
            i32.const 255
            global.get 68
            i32.mul
            i32.const 255
            global.get 68
            i32.mul
            i32.const 255
            global.get 68
            i32.mul
            call 5
            i32.const 0
            drop
            i32.const 0
            drop
            i32.const 0
            drop
            f32.const 0x1p+0 (;=1;)
            f32.neg
            global.get 116
            f32.convert_i32_s
            f32.div
            drop
            f32.const 0x1p+0 (;=1;)
            global.get 116
            f32.convert_i32_s
            f32.div
            drop
            f32.const 0x1p+11 (;=2048;)
            global.get 116
            f32.convert_i32_s
            f32.div
            drop
            f32.const 0x1p+11 (;=2048;)
            global.get 116
            f32.convert_i32_s
            f32.div
            drop
            i32.const 0
            drop
            global.get 142
            drop
            i32.const 0
            drop
            i32.const 0
            drop
            i32.const 0
            i32.const 0
            i32.const 0
            call 5
            i32.const 0
            drop
            i32.const 0
            drop
            i32.const 0
            drop
          end
        end
        global.get 141
        i32.const 1
        call 119
        i32.const 0
        drop
        global.get 141
        i32.const 1
        call 120
        i32.const 0
        drop
        global.get 141
        f32.const 0x1p+0 (;=1;)
        call 116
        i32.const 0
        drop
        i32.const 0
        call 151
        i32.const 0
        drop
        i32.const 0
        global.set 135
        local.get 0
        i32.const 100
        i32.ne
        if  ;; label = @3
          br 2 (;@1;)
        end
        i32.const 0
        i32.const 0
        i32.ne
        i32.const 1
        call 50
        i32.or
        i32.eqz
        br_if 0 (;@2;)
      end
    end
    i32.const 0
    return)
  (func (;403;) (type 7) (param i32) (result i32)
    (local i32 i32)
    i32.const 0
    local.set 1
    local.get 0
    call 334
    local.set 2
    local.get 1
    i32.const 8
    i32.eq
    if  ;; label = @1
      i32.const 0
      local.set 1
      local.get 2
      i32.const 0
      i32.gt_s
      if  ;; label = @2
        local.get 0
        local.get 2
        i32.const 1
        i32.sub
        call 327
        local.set 0
      end
    end
    local.get 1
    i32.const 13
    i32.eq
    local.get 1
    i32.const 0
    i32.eq
    i32.or
    if  ;; label = @1
      local.get 0
      return
    else
      local.get 1
      i32.const 0
      i32.gt_s
      local.get 1
      i32.const 7
      i32.lt_s
      i32.and
      local.get 1
      i32.const 26
      i32.gt_s
      local.get 1
      i32.const 32
      i32.lt_s
      i32.and
      i32.or
      local.get 1
      i32.const 9
      i32.eq
      i32.or
      if  ;; label = @2
        local.get 0
        return
      else
        local.get 0
        local.get 1
        call 339
        call 241
        call 397
        local.tee 0
        return
      end
    end
    i32.const 0
    return)
  (func (;404;) (type 48) (param i32 i32 i32 i32 i32 i32) (result i32)
    (local i32)
    i32.const 255
    i32.const 255
    i32.const 255
    call 6
    i32.const 0
    drop
    global.get 37
    local.get 0
    i32.const 256
    i32.rem_s
    local.get 1
    i32.const 256
    i32.rem_s
    i32.const 512
    f32.convert_i32_s
    i32.const 512
    f32.convert_i32_s
    local.get 0
    local.get 1
    local.get 2
    local.get 3
    call 400
    drop
    i32.const 0
    i32.const 0
    i32.const 0
    call 6
    i32.const 0
    drop
    i32.const 0
    local.set 6
    local.get 0
    drop
    local.get 1
    drop
    local.get 2
    drop
    local.get 3
    drop
    i32.const 0
    if  ;; label = @1
      i32.const 50
      i32.const 50
      i32.const 50
      call 6
      i32.const 0
      drop
      i32.const 1
      local.set 6
      global.get 47
      if  ;; label = @2
        local.get 5
        global.set 22
      end
    end
    local.get 0
    i32.const 2
    i32.add
    local.get 1
    i32.const 2
    i32.add
    local.get 2
    i32.const 4
    i32.sub
    local.get 3
    i32.const 4
    i32.sub
    i32.const 0
    call 8
    i32.const 0
    drop
    i32.const 255
    i32.const 255
    i32.const 255
    call 6
    i32.const 0
    drop
    local.get 6
    global.get 47
    i32.and
    global.get 22
    local.get 5
    i32.eq
    i32.and
    if  ;; label = @1
      i32.const 0
      global.set 22
    end
    global.get 22
    local.get 5
    i32.eq
    if  ;; label = @1
      local.get 4
      call 403
      local.set 4
      call 148
      i32.const 800
      i32.rem_s
      i32.const 400
      i32.lt_s
      if  ;; label = @2
        local.get 0
        local.get 2
        i32.const 2
        i32.div_s
        i32.add
        local.get 4
        drop
        i32.const 0
        i32.const 2
        i32.div_s
        i32.add
        i32.const 2
        i32.add
        local.get 1
        local.get 3
        i32.const 2
        i32.div_s
        i32.add
        i32.const 5
        i32.sub
        i32.const 2
        i32.const 12
        i32.const 0
        call 8
        i32.const 0
        drop
      end
    end
    local.get 0
    local.get 2
    i32.const 2
    i32.div_s
    i32.add
    drop
    local.get 1
    local.get 3
    i32.const 2
    i32.div_s
    i32.add
    drop
    local.get 4
    drop
    i32.const 1
    drop
    i32.const 1
    drop
    i32.const 0
    drop
    local.get 4
    return)
  (func (;405;) (type 48) (param i32 i32 i32 i32 i32 i32) (result i32)
    i32.const 255
    i32.const 255
    i32.const 255
    call 6
    i32.const 0
    drop
    global.get 37
    local.get 4
    local.get 1
    i32.const 256
    i32.rem_s
    i32.const 512
    f32.convert_i32_s
    i32.const 512
    f32.convert_i32_s
    local.get 0
    local.get 1
    local.get 2
    local.get 3
    call 400
    drop
    global.get 38
    local.get 5
    local.get 1
    i32.const 256
    i32.rem_s
    i32.const 512
    f32.convert_i32_s
    i32.const 512
    f32.convert_i32_s
    local.get 0
    i32.const 3
    global.get 39
    i32.mul
    i32.add
    local.get 1
    i32.const 3
    global.get 39
    i32.mul
    i32.add
    local.get 2
    i32.const 6
    global.get 39
    i32.mul
    i32.sub
    local.get 3
    i32.const 6
    global.get 39
    i32.mul
    i32.sub
    call 400
    drop
    i32.const 0
    return)
  (func (;406;) (type 49) (param i32 i32 i32 i32 i32 i32 i32 i32) (result i32)
    (local i32)
    i32.const 0
    local.set 8
    local.get 0
    local.get 1
    local.get 2
    local.get 3
    i32.const 0
    i32.const 0
    call 405
    drop
    local.get 0
    drop
    local.get 1
    drop
    local.get 2
    drop
    local.get 3
    drop
    i32.const 0
    if  ;; label = @1
      i32.const 30
      i32.const 30
      i32.const 30
      call 6
      i32.const 0
      drop
      global.get 47
      local.get 6
      i32.and
      global.get 143
      local.get 6
      i32.and
      i32.or
      if  ;; label = @2
        i32.const 1
        local.set 8
        global.get 61
        call 143
        drop
      end
      local.get 0
      i32.const 4
      i32.add
      local.get 1
      i32.const 4
      i32.add
      local.get 2
      i32.const 8
      i32.sub
      local.get 3
      i32.const 8
      i32.sub
      i32.const 0
      call 8
      i32.const 0
      drop
    else
      i32.const 0
      i32.const 0
      i32.const 0
      call 6
      i32.const 0
      drop
    end
    i32.const 255
    i32.const 255
    i32.const 255
    call 6
    i32.const 0
    drop
    local.get 7
    if  ;; label = @1
      local.get 5
      if  ;; label = @2
        global.get 44
        drop
        i32.const 0
        drop
      else
        global.get 42
        drop
        i32.const 0
        drop
      end
      local.get 0
      local.get 2
      i32.const 2
      i32.div_s
      i32.add
      drop
      local.get 1
      local.get 3
      i32.const 2
      i32.div_s
      i32.add
      drop
      local.get 4
      drop
      i32.const 1
      drop
      i32.const 1
      drop
      i32.const 0
      drop
    else
      local.get 5
      if  ;; label = @2
        global.get 44
        call 13
        i32.const 0
        drop
      else
        global.get 42
        call 13
        i32.const 0
        drop
      end
      local.get 0
      local.get 2
      i32.const 2
      i32.div_s
      i32.add
      local.get 1
      local.get 3
      i32.const 2
      i32.div_s
      i32.add
      local.get 4
      i32.const 1
      i32.const 1
      call 11
      i32.const 0
      drop
    end
    local.get 8
    return)
  (func (;407;) (type 48) (param i32 i32 i32 i32 i32 i32) (result i32)
    (local i32 i32)
    i32.const 0
    local.set 6
    local.get 0
    local.get 1
    local.get 2
    local.get 3
    i32.const 0
    i32.const 0
    call 405
    drop
    i32.const 1
    call 50
    local.set 7
    local.get 0
    drop
    local.get 1
    drop
    local.get 2
    drop
    local.get 3
    drop
    i32.const 0
    if  ;; label = @1
      i32.const 30
      i32.const 30
      i32.const 30
      call 6
      i32.const 0
      drop
      local.get 7
      if  ;; label = @2
        i32.const 1
        local.set 6
        global.get 61
        call 143
        drop
      end
      local.get 0
      i32.const 4
      i32.add
      local.get 1
      i32.const 4
      i32.add
      local.get 2
      i32.const 8
      i32.sub
      local.get 3
      i32.const 8
      i32.sub
      i32.const 0
      call 8
      i32.const 0
      drop
    else
      i32.const 0
      i32.const 0
      i32.const 0
      call 6
      i32.const 0
      drop
    end
    i32.const 255
    i32.const 255
    i32.const 255
    call 6
    i32.const 0
    drop
    local.get 5
    if  ;; label = @1
      global.get 44
      call 13
      i32.const 0
      drop
    else
      global.get 42
      call 13
      i32.const 0
      drop
    end
    local.get 0
    local.get 2
    i32.const 2
    i32.div_s
    i32.add
    local.get 1
    local.get 3
    i32.const 2
    i32.div_s
    i32.add
    local.get 4
    i32.const 1
    i32.const 1
    call 11
    i32.const 0
    drop
    local.get 6
    return)
  (func (;408;) (type 11) (param i32 i32 i32 i32) (result i32)
    (local i32 i32 i32)
    i32.const 20
    global.get 39
    i32.mul
    local.set 4
    i32.const 20
    global.get 39
    i32.mul
    local.set 5
    i32.const 255
    i32.const 255
    i32.const 255
    call 6
    i32.const 0
    drop
    global.get 37
    local.get 0
    i32.const 256
    i32.rem_s
    local.get 1
    i32.const 256
    i32.rem_s
    i32.const 512
    f32.convert_i32_s
    i32.const 512
    f32.convert_i32_s
    local.get 0
    local.get 1
    local.get 4
    local.get 5
    call 400
    drop
    local.get 0
    drop
    local.get 1
    drop
    local.get 4
    drop
    local.get 5
    drop
    i32.const 0
    local.get 3
    i32.and
    local.set 6
    local.get 6
    if  ;; label = @1
      i32.const 50
      i32.const 50
      i32.const 50
      call 6
      i32.const 0
      drop
      global.get 47
      if  ;; label = @2
        local.get 2
        local.set 2
        global.get 61
        call 143
        drop
      end
    else
      i32.const 0
      i32.const 0
      i32.const 0
      call 6
      i32.const 0
      drop
    end
    local.get 0
    i32.const 2
    i32.add
    local.get 1
    i32.const 2
    i32.add
    local.get 4
    i32.const 4
    i32.sub
    local.get 5
    i32.const 4
    i32.sub
    i32.const 0
    call 8
    i32.const 0
    drop
    local.get 2
    if  ;; label = @1
      local.get 6
      if  ;; label = @2
        i32.const 255
        i32.const 255
        i32.const 255
        call 6
        i32.const 0
        drop
      else
        i32.const 200
        i32.const 200
        i32.const 200
        call 6
        i32.const 0
        drop
      end
      global.get 37
      local.get 0
      i32.const 256
      i32.rem_s
      local.get 1
      i32.const 256
      i32.rem_s
      i32.const 512
      f32.convert_i32_s
      i32.const 512
      f32.convert_i32_s
      local.get 0
      i32.const 4
      i32.add
      local.get 1
      i32.const 4
      i32.add
      local.get 4
      i32.const 8
      i32.sub
      local.get 5
      i32.const 8
      i32.sub
      call 400
      drop
    end
    i32.const 255
    i32.const 255
    i32.const 255
    call 6
    i32.const 0
    drop
    local.get 2
    return)
  (func (;409;) (type 50) (param i32 i32 i32 f32) (result f32)
    global.get 45
    global.get 33
    i32.const 0
    i32.eq
    i32.and
    if  ;; label = @1
      i32.const 0
      local.get 0
      i32.ge_s
      i32.const 0
      local.get 0
      local.get 2
      i32.add
      i32.const 14
      i32.add
      i32.le_s
      i32.and
      i32.const 0
      local.get 1
      i32.ge_s
      i32.and
      i32.const 0
      local.get 1
      i32.const 20
      i32.add
      i32.le_s
      i32.and
      if  ;; label = @2
        i32.const 0
        local.get 0
        i32.sub
        i32.const 100
        i32.mul
        local.get 2
        i32.div_s
        f32.convert_i32_s
        i32.const 0
        f32.convert_i32_s
        call 357
        i32.const 100
        f32.convert_i32_s
        call 356
        local.set 3
      end
    end
    i32.const 255
    i32.const 255
    i32.const 255
    call 6
    i32.const 0
    drop
    local.get 0
    local.get 1
    local.get 2
    i32.const 14
    i32.add
    i32.const 20
    i32.const 0
    call 8
    i32.const 0
    drop
    global.get 122
    local.get 0
    f32.convert_i32_s
    local.get 2
    f32.convert_i32_s
    local.get 3
    f32.mul
    f32.const 0x1.9p+6 (;=100;)
    f32.div
    f32.add
    i32.const 3
    f32.convert_i32_s
    f32.add
    i32.trunc_f32_s
    local.get 1
    i32.const 3
    i32.add
    i32.const 0
    call 16
    i32.const 0
    drop
    i32.const 170
    i32.const 170
    i32.const 170
    call 6
    i32.const 0
    drop
    local.get 0
    i32.const 50
    global.get 39
    i32.mul
    i32.sub
    drop
    local.get 1
    i32.const 4
    global.get 39
    i32.mul
    i32.add
    drop
    i32.const 6723
    drop
    i32.const 0
    drop
    local.get 0
    local.get 2
    i32.add
    i32.const 38
    global.get 39
    i32.mul
    i32.add
    drop
    local.get 1
    i32.const 4
    global.get 39
    i32.mul
    i32.add
    drop
    i32.const 6735
    drop
    i32.const 0
    drop
    local.get 3
    return)
  (func (;410;) (type 51) (param i32 i32 i32 i32 i32 i32 f32) (result i32)
    (local i32 i32 i32 i32 i32 i32 i32)
    local.get 4
    i32.const 1
    i32.lt_s
    if  ;; label = @1
      i32.const 2048
      local.set 4
    end
    i32.const 0
    local.set 7
    local.get 0
    drop
    i32.const 0
    f32.convert_i32_s
    local.get 6
    f32.add
    i32.trunc_f32_s
    local.set 8
    block  ;; label = @1
      loop  ;; label = @2
        local.get 0
        call 334
        i32.const 0
        i32.gt_s
        i32.eqz
        br_if 1 (;@1;)
        local.get 0
        i32.const 6748
        i32.const 0
        call 333
        local.tee 10
        i32.const 0
        i32.eq
        if  ;; label = @3
          local.get 0
          call 334
          local.set 10
        end
        local.get 0
        local.get 10
        call 327
        local.tee 11
        call 335
        local.set 12
        i32.const 0
        local.set 13
        local.get 9
        local.get 11
        call 397
        drop
        i32.const 0
        local.get 3
        i32.gt_s
        local.get 9
        local.get 12
        call 397
        drop
        i32.const 0
        local.get 3
        i32.le_s
        i32.and
        if  ;; label = @3
          local.get 12
          local.set 11
          i32.const 1
          local.set 13
        end
        local.get 9
        local.get 11
        call 397
        drop
        i32.const 0
        local.get 3
        i32.gt_s
        if  ;; label = @3
          local.get 5
          if  ;; label = @4
            local.get 1
            local.get 3
            i32.const 2
            i32.div_s
            i32.add
            local.get 9
            drop
            i32.const 0
            i32.const 2
            i32.div_s
            i32.sub
            drop
            local.get 7
            local.get 8
            i32.mul
            local.get 2
            i32.add
            drop
            local.get 9
            drop
            i32.const 0
            drop
          else
            local.get 1
            drop
            local.get 7
            local.get 8
            i32.mul
            local.get 2
            i32.add
            drop
            local.get 9
            drop
            i32.const 0
            drop
          end
          local.get 7
          i32.const 1
          i32.add
          local.set 7
          i32.const 6758
          local.set 9
        else
          local.get 9
          local.get 11
          call 397
          local.set 9
          local.get 0
          local.get 0
          call 334
          local.get 11
          call 334
          local.get 13
          i32.add
          i32.sub
          call 328
          local.set 0
        end
        local.get 7
        i32.const 1
        i32.add
        local.get 8
        i32.mul
        local.get 4
        i32.gt_s
        if  ;; label = @3
          br 2 (;@1;)
        end
        br 0 (;@2;)
      end
    end
    local.get 9
    i32.const 6767
    call 269
    i32.eqz
    local.get 7
    i32.const 1
    i32.add
    local.get 4
    i32.le_s
    i32.and
    if  ;; label = @1
      local.get 5
      if  ;; label = @2
        local.get 1
        local.get 3
        i32.const 2
        i32.div_s
        i32.add
        local.get 9
        drop
        i32.const 0
        i32.const 2
        i32.div_s
        i32.sub
        drop
        local.get 7
        local.get 8
        i32.mul
        local.get 2
        i32.add
        drop
        local.get 9
        drop
        i32.const 0
        drop
      else
        local.get 1
        drop
        local.get 7
        local.get 8
        i32.mul
        local.get 2
        i32.add
        drop
        local.get 9
        drop
        i32.const 0
        drop
      end
    end
    i32.const 0
    return)
  (func (;411;) (type 51) (param i32 i32 i32 i32 i32 i32 f32) (result i32)
    (local i32 i32 i32 i32 i32 i32 i32)
    local.get 4
    i32.const 1
    i32.lt_s
    if  ;; label = @1
      i32.const 2048
      local.set 4
    end
    i32.const 0
    local.set 7
    local.get 0
    drop
    i32.const 0
    f32.convert_i32_s
    local.get 6
    f32.add
    i32.trunc_f32_s
    local.set 8
    block  ;; label = @1
      loop  ;; label = @2
        local.get 0
        call 334
        i32.const 0
        i32.gt_s
        i32.eqz
        br_if 1 (;@1;)
        local.get 0
        i32.const 6776
        i32.const 0
        call 333
        local.tee 10
        i32.const 0
        i32.eq
        if  ;; label = @3
          local.get 0
          call 334
          local.set 10
        end
        local.get 0
        local.get 10
        call 327
        local.tee 11
        call 335
        local.set 12
        i32.const 0
        local.set 13
        local.get 9
        local.get 11
        call 397
        drop
        i32.const 0
        local.get 3
        i32.gt_s
        local.get 9
        local.get 12
        call 397
        drop
        i32.const 0
        local.get 3
        i32.le_s
        i32.and
        if  ;; label = @3
          local.get 12
          local.set 11
          i32.const 1
          local.set 13
        end
        local.get 9
        local.get 11
        call 397
        drop
        i32.const 0
        local.get 3
        i32.gt_s
        if  ;; label = @3
          local.get 5
          if  ;; label = @4
            local.get 1
            local.get 3
            i32.const 2
            i32.div_s
            i32.add
            local.get 9
            drop
            i32.const 0
            i32.const 2
            i32.div_s
            i32.sub
            local.get 7
            local.get 8
            i32.mul
            local.get 2
            i32.add
            local.get 9
            i32.const 0
            i32.const 0
            call 11
            i32.const 0
            drop
          else
            local.get 1
            local.get 7
            local.get 8
            i32.mul
            local.get 2
            i32.add
            local.get 9
            i32.const 0
            i32.const 0
            call 11
            i32.const 0
            drop
          end
          local.get 7
          i32.const 1
          i32.add
          local.set 7
          i32.const 6786
          local.set 9
        else
          local.get 9
          local.get 11
          call 397
          local.set 9
          local.get 0
          local.get 0
          call 334
          local.get 11
          call 334
          local.get 13
          i32.add
          i32.sub
          call 328
          local.set 0
        end
        local.get 7
        i32.const 1
        i32.add
        local.get 8
        i32.mul
        local.get 4
        i32.gt_s
        if  ;; label = @3
          br 2 (;@1;)
        end
        br 0 (;@2;)
      end
    end
    local.get 9
    i32.const 6795
    call 269
    i32.eqz
    local.get 7
    i32.const 1
    i32.add
    local.get 4
    i32.le_s
    i32.and
    if  ;; label = @1
      local.get 5
      if  ;; label = @2
        local.get 1
        local.get 3
        i32.const 2
        i32.div_s
        i32.add
        local.get 9
        drop
        i32.const 0
        i32.const 2
        i32.div_s
        i32.sub
        local.get 7
        local.get 8
        i32.mul
        local.get 2
        i32.add
        local.get 9
        i32.const 0
        i32.const 0
        call 11
        i32.const 0
        drop
      else
        local.get 1
        local.get 7
        local.get 8
        i32.mul
        local.get 2
        i32.add
        local.get 9
        i32.const 0
        i32.const 0
        call 11
        i32.const 0
        drop
      end
    end
    i32.const 0
    return)
  (func (;412;) (type 52) (param i32 i32 i32 f32) (result i32)
    (local i32 i32 i32 i32 i32 i32 i32)
    local.get 2
    i32.const 1
    i32.lt_s
    if  ;; label = @1
      i32.const 2048
      local.set 2
    end
    i32.const 0
    local.set 4
    local.get 0
    drop
    i32.const 0
    f32.convert_i32_s
    local.get 3
    f32.add
    i32.trunc_f32_s
    local.set 5
    block  ;; label = @1
      loop  ;; label = @2
        local.get 0
        call 334
        i32.const 0
        i32.gt_s
        i32.eqz
        br_if 1 (;@1;)
        local.get 0
        i32.const 6804
        i32.const 0
        call 333
        local.tee 7
        i32.const 0
        i32.eq
        if  ;; label = @3
          local.get 0
          call 334
          local.set 7
        end
        local.get 0
        local.get 7
        call 327
        local.tee 8
        call 335
        local.set 9
        i32.const 0
        local.set 10
        local.get 6
        local.get 8
        call 397
        drop
        i32.const 0
        local.get 1
        i32.gt_s
        local.get 6
        local.get 9
        call 397
        drop
        i32.const 0
        local.get 1
        i32.le_s
        i32.and
        if  ;; label = @3
          local.get 9
          local.set 8
          i32.const 1
          local.set 10
        end
        local.get 6
        local.get 8
        call 397
        drop
        i32.const 0
        local.get 1
        i32.gt_s
        if  ;; label = @3
          local.get 4
          i32.const 1
          i32.add
          local.set 4
          i32.const 6814
          local.set 6
        else
          local.get 6
          local.get 8
          call 397
          local.set 6
          local.get 0
          local.get 0
          call 334
          local.get 8
          call 334
          local.get 10
          i32.add
          i32.sub
          call 328
          local.set 0
        end
        local.get 4
        i32.const 1
        i32.add
        local.get 5
        i32.mul
        local.get 2
        i32.gt_s
        if  ;; label = @3
          br 2 (;@1;)
        end
        br 0 (;@2;)
      end
    end
    local.get 4
    i32.const 1
    i32.add
    return)
  (func (;413;) (type 52) (param i32 i32 i32 f32) (result i32)
    (local i32 i32 i32 i32 i32 i32 i32)
    local.get 2
    i32.const 1
    i32.lt_s
    if  ;; label = @1
      i32.const 2048
      local.set 2
    end
    i32.const 0
    local.set 4
    local.get 0
    drop
    i32.const 0
    f32.convert_i32_s
    local.get 3
    f32.add
    i32.trunc_f32_s
    local.set 5
    block  ;; label = @1
      loop  ;; label = @2
        local.get 0
        call 334
        i32.const 0
        i32.gt_s
        i32.eqz
        br_if 1 (;@1;)
        local.get 0
        i32.const 6823
        i32.const 0
        call 333
        local.tee 7
        i32.const 0
        i32.eq
        if  ;; label = @3
          local.get 0
          call 334
          local.set 7
        end
        local.get 0
        local.get 7
        call 327
        local.tee 8
        call 335
        local.set 9
        i32.const 0
        local.set 10
        local.get 6
        local.get 8
        call 397
        drop
        i32.const 0
        local.get 1
        i32.gt_s
        local.get 6
        local.get 9
        call 397
        drop
        i32.const 0
        local.get 1
        i32.le_s
        i32.and
        if  ;; label = @3
          local.get 9
          local.set 8
          i32.const 1
          local.set 10
        end
        local.get 6
        local.get 8
        call 397
        drop
        i32.const 0
        local.get 1
        i32.gt_s
        if  ;; label = @3
          local.get 4
          i32.const 1
          i32.add
          local.set 4
          i32.const 6833
          local.set 6
        else
          local.get 6
          local.get 8
          call 397
          local.set 6
          local.get 0
          local.get 0
          call 334
          local.get 8
          call 334
          local.get 10
          i32.add
          i32.sub
          call 328
          local.set 0
        end
        local.get 4
        i32.const 1
        i32.add
        local.get 5
        i32.mul
        local.get 2
        i32.gt_s
        if  ;; label = @3
          br 2 (;@1;)
        end
        br 0 (;@2;)
      end
    end
    local.get 4
    i32.const 1
    i32.add
    return)
  (func (;414;) (type 6) (param i32 i32 i32 i32 i32) (result i32)
    (local i32 i32 i32)
    local.get 4
    if  ;; label = @1
      local.get 0
      i32.const 6842
      call 269
      local.get 3
      i32.const 0
      i32.eq
      i32.or
      if  ;; label = @2
        i32.const 0
        return
      end
      local.get 0
      drop
      i32.const 0
      local.tee 5
      local.get 3
      i32.sub
      local.tee 6
      i32.const 0
      i32.le_s
      if  ;; label = @2
        local.get 1
        drop
        local.get 2
        drop
        local.get 0
        drop
        i32.const 0
        drop
      else
        local.get 5
        local.get 0
        call 334
        i32.div_s
        local.set 7
        local.get 1
        drop
        local.get 2
        drop
        local.get 0
        local.get 0
        call 334
        local.get 6
        local.get 7
        i32.div_s
        i32.sub
        i32.const 4
        i32.sub
        f32.convert_i32_s
        i32.const 1
        f32.convert_i32_s
        call 357
        i32.trunc_f32_s
        call 327
        call 241
        i32.const 6851
        call 397
        drop
        i32.const 0
        drop
      end
    else
      local.get 0
      i32.const 6863
      call 269
      local.get 3
      i32.const 0
      i32.eq
      i32.or
      if  ;; label = @2
        i32.const 0
        return
      end
      local.get 0
      drop
      i32.const 0
      local.tee 5
      local.get 3
      i32.sub
      local.tee 6
      i32.const 0
      i32.le_s
      if  ;; label = @2
        local.get 1
        local.get 2
        local.get 0
        i32.const 0
        i32.const 0
        call 11
        i32.const 0
        drop
      else
        local.get 5
        local.get 0
        call 334
        i32.div_s
        local.set 7
        local.get 1
        local.get 2
        local.get 0
        local.get 0
        call 334
        local.get 6
        local.get 7
        i32.div_s
        i32.sub
        i32.const 4
        i32.sub
        f32.convert_i32_s
        i32.const 1
        f32.convert_i32_s
        call 357
        i32.trunc_f32_s
        call 327
        call 241
        i32.const 6872
        call 397
        i32.const 0
        i32.const 0
        call 11
        i32.const 0
        drop
      end
    end
    i32.const 0
    return)
  (func (;415;) (type 7) (param i32) (result i32)
    (local f32 i32)
    global.get 41
    f32.convert_i32_s
    f32.const 0x1.8p+9 (;=768;)
    f32.div
    local.set 1
    local.get 0
    drop
    i32.const 0
    i32.const 20
    global.get 39
    i32.mul
    i32.add
    local.set 2
    i32.const 25
    i32.const 25
    i32.const 25
    call 6
    i32.const 0
    drop
    i32.const 0
    i32.const 20
    i32.add
    i32.const 0
    local.get 2
    i32.const 19
    f32.convert_i32_s
    local.get 1
    f32.mul
    i32.trunc_f32_s
    i32.const 1
    call 8
    i32.const 0
    drop
    i32.const 150
    i32.const 150
    i32.const 150
    call 6
    i32.const 0
    drop
    i32.const 0
    i32.const 20
    i32.add
    i32.const 0
    local.get 2
    i32.const 19
    f32.convert_i32_s
    local.get 1
    f32.mul
    i32.trunc_f32_s
    i32.const 0
    call 8
    i32.const 0
    drop
    global.get 42
    drop
    i32.const 0
    drop
    i32.const 0
    i32.const 20
    global.get 39
    i32.mul
    i32.add
    local.get 2
    i32.const 2
    i32.div_s
    i32.add
    drop
    i32.const 0
    i32.const 12
    global.get 39
    i32.mul
    i32.add
    drop
    local.get 0
    drop
    i32.const 1
    drop
    i32.const 1
    drop
    i32.const 0
    drop
    i32.const 0
    return)
  (func (;416;) (type 15) (result i32)
    global.get 30
    i32.const 1
    i32.const -1
    i32.mul
    i32.gt_s
    if  ;; label = @1
      global.get 15
      call 22
      i32.const 0
      drop
      global.get 15
      global.get 40
      i32.const 90
      i32.sub
      global.get 41
      i32.const 150
      i32.sub
      i32.const 0
      call 16
      i32.const 0
      drop
      i32.const 255
      i32.const 255
      i32.const 255
      call 6
      i32.const 0
      drop
      global.get 42
      drop
      i32.const 0
      drop
      global.get 40
      i32.const 100
      i32.sub
      drop
      global.get 41
      i32.const 90
      i32.sub
      drop
      i32.const 6884
      global.get 30
      call 241
      call 397
      i32.const 6902
      call 397
      drop
      i32.const 1
      drop
      i32.const 0
      drop
      global.get 30
      i32.const 99
      i32.gt_s
      if  ;; label = @2
        global.get 31
        i32.const 70
        f32.convert_i32_s
        f32.lt
        if  ;; label = @3
          global.get 31
          global.get 43
          f32.convert_i32_s
          f32.add
          i32.const 70
          f32.convert_i32_s
          call 356
          global.set 31
        else
          i32.const 1
          i32.const -1
          i32.mul
          global.set 30
        end
      end
      i32.const 0
      drop
    else
      i32.const 1
      i32.const -1
      i32.mul
      global.set 30
      i32.const 0
      f32.convert_i32_s
      global.set 31
      global.get 144
      global.set 32
    end
    i32.const 0
    return)
  (func (;417;) (type 53) (param i32 i32 i32 i32 i32 f32 i32) (result i32)
    (local f32 f32 f32 f32 i32 i32 i32 i32 i32 i32 i32 i32 i32)
    local.get 0
    i32.const 6
    global.get 39
    i32.mul
    i32.add
    f32.convert_i32_s
    local.set 7
    local.get 1
    i32.const 6
    global.get 39
    i32.mul
    i32.add
    f32.convert_i32_s
    local.set 8
    local.get 2
    i32.const 12
    global.get 39
    i32.mul
    i32.sub
    f32.convert_i32_s
    local.set 9
    local.get 3
    i32.const 12
    global.get 39
    i32.mul
    i32.sub
    f32.convert_i32_s
    local.set 10
    i32.const 0
    local.set 11
    i32.const 0
    local.set 12
    i32.const 6912
    local.set 13
    i32.const 6921
    local.set 14
    i32.const 0
    local.set 15
    i32.const 0
    local.set 16
    i32.const 0
    local.set 17
    i32.const 0
    local.set 18
    i32.const 0
    local.set 19
    global.get 42
    drop
    i32.const 0
    drop
    i32.const 255
    i32.const 255
    i32.const 255
    call 6
    i32.const 0
    drop
    block  ;; label = @1
      local.get 4
      call 331
      global.set 7
      global.get 7
      i32.const 6930
      i32.eq
      if  ;; label = @2
        i32.const 34
        call 339
        call 241
        i32.const 6943
        call 397
        i32.const 34
        call 339
        call 241
        call 397
        i32.const 6964
        call 397
        local.set 13
        i32.const 7038
        local.set 14
        i32.const 255
        local.set 15
        br 1 (;@1;)
      end
      global.get 7
      i32.const 7085
      i32.eq
      if  ;; label = @2
        i32.const 34
        call 339
        call 241
        i32.const 7099
        call 397
        i32.const 34
        call 339
        call 241
        call 397
        i32.const 7121
        call 397
        local.tee 13
        call 241
        i32.const 7250
        call 397
        local.set 13
        br 1 (;@1;)
      end
      global.get 7
      i32.const 7367
      i32.eq
      if  ;; label = @2
        i32.const 34
        call 339
        call 241
        i32.const 7385
        call 397
        i32.const 34
        call 339
        call 241
        call 397
        i32.const 7407
        call 397
        local.set 13
        i32.const 7527
        local.set 14
        i32.const 255
        local.set 15
        br 1 (;@1;)
      end
      global.get 7
      i32.const 7580
      i32.eq
      if  ;; label = @2
        i32.const 7599
        local.set 13
        br 1 (;@1;)
      end
      global.get 7
      i32.const 7687
      i32.eq
      if  ;; label = @2
        i32.const 34
        call 339
        call 241
        i32.const 7701
        call 397
        i32.const 34
        call 339
        call 241
        call 397
        i32.const 7726
        call 397
        local.tee 13
        call 241
        i32.const 7863
        call 397
        local.set 13
        i32.const 255
        local.set 15
        i32.const 255
        local.set 16
        i32.const 255
        local.set 17
        i32.const 7944
        local.get 5
        i32.const 100
        f32.convert_i32_s
        f32.mul
        i32.trunc_f32_s
        call 241
        call 397
        i32.const 7968
        call 397
        local.set 14
        br 1 (;@1;)
      end
      global.get 7
      i32.const 7996
      i32.eq
      if  ;; label = @2
        i32.const 34
        call 339
        call 241
        i32.const 8015
        call 397
        i32.const 34
        call 339
        call 241
        call 397
        i32.const 8040
        call 397
        local.set 13
        br 1 (;@1;)
      end
      global.get 7
      i32.const 8186
      i32.eq
      if  ;; label = @2
        i32.const 8209
        local.set 13
        block  ;; label = @3
          local.get 5
          global.set 9
          global.get 9
          i32.const 0
          f32.convert_i32_s
          f32.eq
          if  ;; label = @4
            i32.const 255
            local.set 15
            i32.const 8283
            local.set 14
            br 1 (;@3;)
          end
          global.get 9
          i32.const 1
          f32.convert_i32_s
          f32.eq
          if  ;; label = @4
            i32.const 255
            local.set 15
            i32.const 255
            local.set 16
            i32.const 8335
            local.set 14
            br 1 (;@3;)
          end
          global.get 9
          i32.const 2
          f32.convert_i32_s
          f32.eq
          if  ;; label = @4
            i32.const 255
            local.set 16
            i32.const 8391
            local.set 14
            br 1 (;@3;)
          end
        end
        br 1 (;@1;)
      end
      global.get 7
      i32.const 8427
      i32.eq
      if  ;; label = @2
        i32.const 8440
        local.set 13
        i32.const 8575
        local.set 14
        i32.const 255
        local.set 15
        br 1 (;@1;)
      end
      global.get 7
      i32.const 8622
      i32.eq
      if  ;; label = @2
        i32.const 8639
        local.set 13
        i32.const 255
        local.set 15
        i32.const 255
        local.set 16
        i32.const 255
        local.set 17
        i32.const 8742
        local.get 5
        i32.const 100
        f32.convert_i32_s
        f32.mul
        i32.trunc_f32_s
        call 241
        call 397
        i32.const 8766
        call 397
        local.set 14
        br 1 (;@1;)
      end
      global.get 7
      i32.const 8793
      i32.eq
      if  ;; label = @2
        i32.const 8810
        local.set 13
        i32.const 255
        local.set 15
        i32.const 255
        local.set 16
        i32.const 255
        local.set 17
        i32.const 8911
        local.get 5
        i32.const 100
        f32.convert_i32_s
        f32.mul
        i32.trunc_f32_s
        call 241
        call 397
        i32.const 8935
        call 397
        local.set 14
        br 1 (;@1;)
      end
      global.get 7
      i32.const 8963
      i32.eq
      if  ;; label = @2
        i32.const 34
        call 339
        call 241
        i32.const 8986
        call 397
        i32.const 34
        call 339
        call 241
        call 397
        i32.const 9013
        call 397
        local.set 13
        i32.const 255
        local.set 15
        i32.const 9119
        local.set 14
        br 1 (;@1;)
      end
      global.get 7
      i32.const 9166
      i32.eq
      if  ;; label = @2
        i32.const 9184
        i32.const 34
        call 339
        call 241
        call 397
        i32.const 9297
        call 397
        i32.const 34
        call 339
        call 241
        call 397
        local.tee 13
        call 241
        i32.const 9327
        call 397
        i32.const 34
        call 339
        call 241
        call 397
        i32.const 9354
        call 397
        i32.const 34
        call 339
        call 241
        call 397
        i32.const 9364
        call 397
        local.set 13
        i32.const 255
        local.set 15
        i32.const 9417
        local.set 14
        br 1 (;@1;)
      end
      global.get 7
      i32.const 9464
      i32.eq
      if  ;; label = @2
        i32.const 9486
        i32.const 34
        call 339
        call 241
        call 397
        i32.const 9540
        call 397
        i32.const 34
        call 339
        call 241
        call 397
        i32.const 9555
        call 397
        i32.const 34
        call 339
        call 241
        call 397
        i32.const 9605
        call 397
        i32.const 34
        call 339
        call 241
        call 397
        i32.const 9620
        call 397
        local.tee 13
        call 241
        i32.const 9642
        call 397
        local.set 13
        i32.const 255
        local.set 15
        i32.const 255
        local.set 16
        i32.const 9672
        local.set 14
        br 1 (;@1;)
      end
      global.get 7
      i32.const 9764
      i32.eq
      if  ;; label = @2
        i32.const 9786
        local.set 13
        br 1 (;@1;)
      end
      global.get 7
      i32.const 9866
      i32.eq
      if  ;; label = @2
        i32.const 9891
        local.set 13
        i32.const 255
        local.set 15
        i32.const 255
        local.set 16
        i32.const 255
        local.set 17
        i32.const 9939
        f32.const 0x1p-1 (;=0.5;)
        local.get 5
        f32.add
        i32.const 100
        f32.convert_i32_s
        f32.mul
        i32.trunc_f32_s
        call 241
        call 397
        i32.const 9963
        call 397
        local.set 14
        br 1 (;@1;)
      end
      global.get 7
      i32.const 9990
      i32.eq
      if  ;; label = @2
        i32.const 34
        call 339
        call 241
        i32.const 10010
        call 397
        i32.const 34
        call 339
        call 241
        call 397
        i32.const 10038
        call 397
        local.set 13
        br 1 (;@1;)
      end
      global.get 7
      i32.const 10068
      i32.eq
      if  ;; label = @2
        i32.const 10091
        local.set 13
        i32.const 255
        local.set 15
        i32.const 255
        local.set 16
        i32.const 255
        local.set 17
        i32.const 10153
        local.get 5
        i32.const 100
        f32.convert_i32_s
        f32.mul
        i32.trunc_f32_s
        call 241
        call 397
        i32.const 10177
        call 397
        local.set 14
        br 1 (;@1;)
      end
      global.get 7
      i32.const 10205
      i32.eq
      if  ;; label = @2
        i32.const 10222
        local.set 13
        br 1 (;@1;)
      end
      global.get 7
      i32.const 10268
      i32.eq
      if  ;; label = @2
        i32.const 10280
        local.set 13
        br 1 (;@1;)
      end
      global.get 7
      i32.const 10326
      i32.eq
      if  ;; label = @2
        i32.const 10348
        global.get 99
        drop
        i32.const 0
        call 241
        call 397
        i32.const 10431
        call 397
        local.set 13
        br 1 (;@1;)
      end
      global.get 7
      i32.const 10441
      i32.eq
      if  ;; label = @2
        i32.const 34
        call 339
        call 241
        i32.const 10462
        call 397
        i32.const 34
        call 339
        call 241
        call 397
        i32.const 10492
        call 397
        local.set 13
        br 1 (;@1;)
      end
      global.get 7
      i32.const 10522
      i32.eq
      if  ;; label = @2
        i32.const 10539
        local.set 13
        br 1 (;@1;)
      end
      global.get 7
      i32.const 10611
      i32.eq
      if  ;; label = @2
        i32.const 10627
        local.set 13
        br 1 (;@1;)
      end
      global.get 7
      i32.const 10703
      i32.eq
      if  ;; label = @2
        i32.const 10722
        local.set 13
        local.get 5
        i32.const 0
        f32.convert_i32_s
        f32.gt
        local.get 5
        i32.const 60
        f32.convert_i32_s
        f32.lt
        i32.and
        if  ;; label = @3
          i32.const 255
          local.set 15
          i32.const 255
          local.set 16
          i32.const 10797
          local.set 14
        end
        br 1 (;@1;)
      end
      global.get 7
      i32.const 10959
      i32.eq
      if  ;; label = @2
        i32.const 34
        call 339
        call 241
        i32.const 10981
        call 397
        i32.const 34
        call 339
        call 241
        call 397
        i32.const 11006
        call 397
        local.set 13
        br 1 (;@1;)
      end
    end
    local.get 13
    local.get 9
    i32.trunc_f32_s
    local.get 10
    i32.trunc_f32_s
    i32.const 1
    f32.convert_i32_s
    call 412
    local.set 11
    local.get 18
    if  ;; label = @1
      i32.const 210
      global.get 39
      i32.mul
      local.set 19
    end
    local.get 14
    i32.const 11102
    call 269
    if  ;; label = @1
      local.get 0
      local.get 1
      local.get 2
      local.get 13
      drop
      i32.const 0
      local.get 11
      i32.mul
      i32.const 10
      local.get 11
      i32.add
      global.get 39
      i32.mul
      i32.add
      local.get 19
      i32.add
      i32.const 0
      i32.const 0
      call 405
      drop
    else
      local.get 14
      local.get 9
      i32.trunc_f32_s
      local.get 10
      i32.trunc_f32_s
      i32.const 1
      f32.convert_i32_s
      call 412
      local.set 12
      local.get 0
      local.get 1
      local.get 2
      local.get 13
      drop
      i32.const 0
      local.get 11
      i32.mul
      i32.const 10
      local.get 11
      i32.add
      global.get 39
      i32.mul
      i32.add
      local.get 14
      drop
      i32.const 0
      local.get 12
      i32.mul
      i32.add
      i32.const 10
      local.get 12
      i32.add
      global.get 39
      i32.mul
      i32.add
      local.get 19
      i32.add
      i32.const 0
      i32.const 0
      call 405
      drop
    end
    local.get 13
    local.get 7
    i32.trunc_f32_s
    local.get 8
    i32.trunc_f32_s
    local.get 9
    i32.trunc_f32_s
    local.get 10
    i32.trunc_f32_s
    i32.const 0
    i32.const 1
    f32.convert_i32_s
    call 410
    drop
    local.get 14
    i32.const 11111
    call 269
    i32.eqz
    if  ;; label = @1
      local.get 15
      local.get 16
      local.get 17
      call 6
      i32.const 0
      drop
      local.get 14
      local.get 7
      i32.trunc_f32_s
      local.get 8
      local.get 13
      drop
      i32.const 0
      local.get 11
      i32.mul
      f32.convert_i32_s
      f32.add
      i32.const 5
      local.get 11
      i32.add
      global.get 39
      i32.mul
      f32.convert_i32_s
      f32.add
      i32.trunc_f32_s
      local.get 9
      i32.trunc_f32_s
      local.get 10
      i32.trunc_f32_s
      i32.const 0
      i32.const 1
      f32.convert_i32_s
      call 410
      drop
    end
    local.get 18
    if  ;; label = @1
      global.get 145
      call 22
      i32.const 0
      drop
      local.get 14
      i32.const 11120
      call 269
      if  ;; label = @2
        global.get 145
        local.get 0
        local.get 2
        i32.const 2
        i32.div_s
        i32.add
        local.get 1
        i32.const 100
        global.get 39
        i32.mul
        i32.add
        local.get 13
        drop
        i32.const 0
        local.get 11
        i32.mul
        i32.const 10
        local.get 11
        i32.add
        global.get 39
        i32.mul
        i32.add
        i32.add
        i32.const 0
        call 16
        i32.const 0
        drop
      else
        global.get 145
        local.get 0
        local.get 2
        i32.const 2
        i32.div_s
        i32.add
        local.get 1
        i32.const 100
        global.get 39
        i32.mul
        i32.add
        local.get 13
        drop
        i32.const 0
        local.get 11
        i32.mul
        i32.const 10
        local.get 11
        i32.add
        global.get 39
        i32.mul
        i32.add
        local.get 14
        drop
        i32.const 0
        local.get 12
        i32.mul
        i32.add
        i32.const 10
        local.get 12
        i32.add
        global.get 39
        i32.mul
        i32.add
        i32.add
        i32.const 0
        call 16
        i32.const 0
        drop
      end
    end
    i32.const 0
    return)
  (func (;418;) (type 6) (param i32 i32 i32 i32 i32) (result i32)
    (local f32 f32 f32 f32 i32 i32 i32 i32 i32 i32 i32 i32)
    local.get 0
    i32.const 6
    global.get 39
    i32.mul
    i32.add
    f32.convert_i32_s
    local.set 5
    local.get 1
    i32.const 6
    global.get 39
    i32.mul
    i32.add
    f32.convert_i32_s
    local.set 6
    local.get 2
    i32.const 12
    global.get 39
    i32.mul
    i32.sub
    f32.convert_i32_s
    local.set 7
    local.get 3
    i32.const 12
    global.get 39
    i32.mul
    i32.sub
    f32.convert_i32_s
    local.set 8
    i32.const 0
    local.set 9
    global.get 42
    drop
    i32.const 0
    drop
    i32.const 255
    i32.const 255
    i32.const 255
    call 6
    i32.const 0
    drop
    local.get 4
    i32.const 6
    call 328
    i32.const 11129
    call 269
    if  ;; label = @1
      i32.const 11144
      local.get 4
      call 397
      call 209
      local.tee 11
      call 237
      local.set 12
      local.get 11
      call 237
      local.set 13
      local.get 11
      call 215
      drop
      local.get 11
      call 215
      drop
      local.get 11
      call 211
      local.set 14
      local.get 11
      call 211
      i32.const 0
      i32.gt_s
      if  ;; label = @2
        i32.const 1
        local.set 15
      else
        i32.const 0
        local.set 15
      end
      local.get 11
      call 211
      i32.const 0
      i32.gt_s
      if  ;; label = @2
        i32.const 1
        local.set 16
      else
        i32.const 0
        local.set 16
      end
      local.get 11
      call 210
      i32.const 0
      drop
    else
      i32.const 11170
      local.set 12
      i32.const 11188
      local.set 13
      i32.const 0
      local.set 14
      i32.const 0
      local.set 15
      i32.const 0
      local.set 16
    end
    local.get 14
    i32.const 0
    i32.gt_s
    if  ;; label = @1
    end
    local.get 15
    if  ;; label = @1
    end
    local.get 16
    if  ;; label = @1
    end
    i32.const 0
    local.get 7
    i32.trunc_f32_s
    local.get 8
    i32.trunc_f32_s
    i32.const 1
    f32.convert_i32_s
    call 412
    local.set 9
    local.get 0
    local.get 1
    local.get 2
    i32.const 0
    drop
    i32.const 0
    i32.const 6
    i32.mul
    i32.const 0
    drop
    i32.const 0
    local.get 9
    i32.mul
    i32.add
    i32.const 5
    global.get 39
    i32.mul
    i32.add
    i32.const 0
    i32.const 0
    call 405
    drop
    i32.const 255
    i32.const 255
    i32.const 255
    call 6
    i32.const 0
    drop
    local.get 5
    drop
    local.get 6
    drop
    i32.const 0
    drop
    i32.const 0
    drop
    local.get 5
    drop
    local.get 6
    i32.const 0
    drop
    i32.const 0
    f32.convert_i32_s
    f32.add
    drop
    i32.const 0
    drop
    i32.const 0
    drop
    i32.const 0
    local.get 5
    i32.trunc_f32_s
    local.get 6
    i32.const 0
    drop
    i32.const 0
    i32.const 2
    i32.mul
    f32.convert_i32_s
    f32.add
    i32.trunc_f32_s
    local.get 7
    i32.trunc_f32_s
    local.get 8
    i32.trunc_f32_s
    i32.const 0
    i32.const 1
    f32.convert_i32_s
    call 410
    drop
    local.get 5
    drop
    local.get 6
    i32.const 0
    drop
    i32.const 0
    i32.const 2
    i32.mul
    i32.const 0
    drop
    i32.const 0
    local.get 9
    i32.mul
    i32.add
    i32.const 5
    global.get 39
    i32.mul
    i32.add
    f32.convert_i32_s
    f32.add
    drop
    i32.const 0
    drop
    i32.const 0
    drop
    local.get 5
    drop
    local.get 6
    i32.const 0
    drop
    i32.const 0
    i32.const 3
    i32.mul
    i32.const 0
    drop
    i32.const 0
    local.get 9
    i32.mul
    i32.add
    i32.const 5
    global.get 39
    i32.mul
    i32.add
    f32.convert_i32_s
    f32.add
    drop
    i32.const 0
    drop
    i32.const 0
    drop
    local.get 5
    drop
    local.get 6
    i32.const 0
    drop
    i32.const 0
    i32.const 4
    i32.mul
    i32.const 0
    drop
    i32.const 0
    local.get 9
    i32.mul
    i32.add
    i32.const 5
    global.get 39
    i32.mul
    i32.add
    f32.convert_i32_s
    f32.add
    drop
    i32.const 0
    drop
    i32.const 0
    drop
    i32.const 0
    return)
  (func (;419;) (type 7) (param i32) (result i32)
    global.get 145
    i32.const 0
    i32.ne
    if  ;; label = @1
      global.get 145
      call 27
      i32.const 0
      drop
    end
    i32.const 2
    drop
    i32.const 2
    drop
    i32.const 257
    drop
    i32.const 0
    global.set 146
    global.get 146
    i32.const 5
    call 88
    i32.const 0
    drop
    global.get 146
    drop
    i32.const 0
    drop
    i32.const 0
    drop
    i32.const 0
    i32.const 0
    i32.const 0
    call 5
    i32.const 0
    drop
    i32.const 0
    drop
    i32.const 0
    drop
    i32.const 200
    drop
    i32.const 200
    drop
    i32.const 11452
    drop
    i32.const 0
    drop
    f32.const 0x1.8p-1 (;=0.75;)
    f32.neg
    drop
    i32.const 1
    drop
    i32.const 0
    drop
    i32.const 0
    drop
    i32.const 0
    drop
    global.get 147
    drop
    global.get 147
    drop
    global.get 147
    drop
    i32.const 1
    drop
    i32.const 0
    global.set 145
    global.get 145
    global.get 39
    f32.convert_i32_s
    global.get 39
    f32.convert_i32_s
    call 25
    i32.const 0
    drop
    global.get 145
    i32.const 255
    i32.const 0
    i32.const 255
    call 24
    i32.const 0
    drop
    global.get 146
    call 87
    i32.const 0
    drop
    i32.const 0
    global.set 146
    local.get 0
    global.set 148
    i32.const 0
    return)
  (func (;420;) (type 49) (param i32 i32 i32 i32 i32 i32 i32 i32) (result i32)
    global.get 45
    if  ;; label = @1
      i32.const 0
      local.get 0
      i32.ge_s
      i32.const 0
      local.get 0
      local.get 2
      i32.add
      i32.const 14
      i32.add
      i32.le_s
      i32.and
      i32.const 0
      local.get 1
      i32.const 8
      i32.sub
      i32.ge_s
      i32.and
      i32.const 0
      local.get 1
      i32.const 10
      i32.add
      i32.le_s
      i32.and
      if  ;; label = @2
        local.get 4
        global.set 33
      end
    end
    i32.const 200
    i32.const 200
    i32.const 200
    call 6
    i32.const 0
    drop
    local.get 0
    local.get 1
    local.get 2
    i32.const 14
    i32.add
    i32.const 10
    i32.const 1
    call 8
    i32.const 0
    drop
    local.get 0
    local.get 1
    i32.const 8
    i32.sub
    i32.const 4
    i32.const 14
    i32.const 1
    call 8
    i32.const 0
    drop
    local.get 0
    local.get 2
    i32.const 2
    i32.div_s
    i32.add
    i32.const 5
    i32.add
    local.get 1
    i32.const 8
    i32.sub
    i32.const 4
    i32.const 14
    i32.const 1
    call 8
    i32.const 0
    drop
    local.get 0
    local.get 2
    i32.add
    i32.const 10
    i32.add
    local.get 1
    i32.const 8
    i32.sub
    i32.const 4
    i32.const 14
    i32.const 1
    call 8
    i32.const 0
    drop
    local.get 4
    global.get 33
    i32.eq
    if  ;; label = @1
      i32.const 0
      local.get 0
      i32.const 8
      i32.add
      i32.le_s
      if  ;; label = @2
        i32.const 0
        local.set 3
      else
        i32.const 0
        local.get 0
        local.get 2
        i32.const 2
        i32.div_s
        i32.add
        i32.ge_s
        i32.const 0
        local.get 0
        local.get 2
        i32.const 2
        i32.div_s
        i32.add
        i32.const 8
        i32.add
        i32.le_s
        i32.and
        if  ;; label = @3
          i32.const 1
          local.set 3
        else
          i32.const 0
          local.get 0
          local.get 2
          i32.add
          i32.ge_s
          if  ;; label = @4
            i32.const 2
            local.set 3
          end
        end
      end
      i32.const 0
      i32.const 255
      i32.const 0
      call 6
      i32.const 0
      drop
      local.get 0
      local.get 1
      local.get 2
      i32.const 14
      i32.add
      i32.const 10
      i32.const 1
      call 8
      i32.const 0
      drop
    else
      i32.const 0
      local.get 0
      i32.ge_s
      i32.const 0
      local.get 0
      local.get 2
      i32.add
      i32.const 14
      i32.add
      i32.le_s
      i32.and
      i32.const 0
      local.get 1
      i32.const 8
      i32.sub
      i32.ge_s
      i32.and
      i32.const 0
      local.get 1
      i32.const 10
      i32.add
      i32.le_s
      i32.and
      if  ;; label = @2
        i32.const 0
        i32.const 200
        i32.const 0
        call 6
        i32.const 0
        drop
        local.get 0
        local.get 1
        local.get 2
        i32.const 14
        i32.add
        i32.const 10
        i32.const 0
        call 8
        i32.const 0
        drop
      end
    end
    local.get 3
    i32.const 0
    i32.eq
    if  ;; label = @1
      global.get 122
      local.get 0
      local.get 1
      i32.const 8
      i32.sub
      i32.const 0
      call 16
      i32.const 0
      drop
    else
      local.get 3
      i32.const 1
      i32.eq
      if  ;; label = @2
        global.get 122
        local.get 0
        local.get 2
        i32.const 2
        i32.div_s
        i32.add
        i32.const 3
        i32.add
        local.get 1
        i32.const 8
        i32.sub
        i32.const 0
        call 16
        i32.const 0
        drop
      else
        global.get 122
        local.get 0
        local.get 2
        i32.add
        i32.const 6
        i32.add
        local.get 1
        i32.const 8
        i32.sub
        i32.const 0
        call 16
        i32.const 0
        drop
      end
    end
    i32.const 170
    i32.const 170
    i32.const 170
    call 6
    i32.const 0
    drop
    local.get 3
    i32.const 0
    i32.eq
    if  ;; label = @1
      local.get 0
      i32.const 2
      i32.add
      drop
      local.get 1
      i32.const 10
      i32.add
      global.get 39
      i32.add
      drop
      local.get 5
      drop
      i32.const 1
      drop
      i32.const 0
      drop
    else
      local.get 3
      i32.const 1
      i32.eq
      if  ;; label = @2
        local.get 0
        local.get 2
        i32.const 2
        i32.div_s
        i32.add
        i32.const 7
        i32.add
        drop
        local.get 1
        i32.const 10
        i32.add
        global.get 39
        i32.add
        drop
        local.get 6
        drop
        i32.const 1
        drop
        i32.const 0
        drop
      else
        local.get 0
        local.get 2
        i32.add
        i32.const 12
        i32.add
        drop
        local.get 1
        i32.const 10
        i32.add
        global.get 39
        i32.add
        drop
        local.get 7
        drop
        i32.const 1
        drop
        i32.const 0
        drop
      end
    end
    local.get 3
    return)
  (func (;421;) (type 54) (param i32 i32 i32 i32 i32 i32 i32 i32 i32) (result i32)
    global.get 45
    if  ;; label = @1
      i32.const 0
      local.get 0
      i32.ge_s
      i32.const 0
      local.get 0
      local.get 2
      i32.add
      i32.const 14
      i32.add
      i32.le_s
      i32.and
      i32.const 0
      local.get 1
      i32.const 8
      i32.sub
      i32.ge_s
      i32.and
      i32.const 0
      local.get 1
      i32.const 10
      i32.add
      i32.le_s
      i32.and
      if  ;; label = @2
        local.get 4
        global.set 33
      end
    end
    i32.const 200
    i32.const 200
    i32.const 200
    call 6
    i32.const 0
    drop
    local.get 0
    local.get 1
    local.get 2
    i32.const 14
    i32.add
    i32.const 10
    i32.const 1
    call 8
    i32.const 0
    drop
    local.get 0
    local.get 1
    i32.const 8
    i32.sub
    i32.const 4
    i32.const 14
    i32.const 1
    call 8
    i32.const 0
    drop
    local.get 0
    f32.convert_i32_s
    local.get 2
    f32.convert_i32_s
    f32.const 0x1p+0 (;=1;)
    f32.const 0x1.8p+1 (;=3;)
    f32.div
    f32.mul
    f32.add
    f32.const 0x1.4p+3 (;=10;)
    f32.const 0x1.8p+1 (;=3;)
    f32.div
    f32.add
    i32.trunc_f32_s
    local.get 1
    i32.const 8
    i32.sub
    i32.const 4
    i32.const 14
    i32.const 1
    call 8
    i32.const 0
    drop
    local.get 0
    f32.convert_i32_s
    local.get 2
    f32.convert_i32_s
    f32.const 0x1p+1 (;=2;)
    f32.const 0x1.8p+1 (;=3;)
    f32.div
    f32.mul
    f32.add
    f32.const 0x1.4p+4 (;=20;)
    f32.const 0x1.8p+1 (;=3;)
    f32.div
    f32.add
    i32.trunc_f32_s
    local.get 1
    i32.const 8
    i32.sub
    i32.const 4
    i32.const 14
    i32.const 1
    call 8
    i32.const 0
    drop
    local.get 0
    local.get 2
    i32.add
    i32.const 10
    i32.add
    local.get 1
    i32.const 8
    i32.sub
    i32.const 4
    i32.const 14
    i32.const 1
    call 8
    i32.const 0
    drop
    local.get 4
    global.get 33
    i32.eq
    if  ;; label = @1
      i32.const 0
      local.get 0
      i32.const 8
      i32.add
      i32.le_s
      if  ;; label = @2
        i32.const 0
        local.set 3
      else
        i32.const 0
        f32.convert_i32_s
        local.get 0
        f32.convert_i32_s
        local.get 2
        f32.convert_i32_s
        f32.const 0x1p+0 (;=1;)
        f32.const 0x1.8p+1 (;=3;)
        f32.div
        f32.mul
        f32.add
        f32.ge
        i32.const 0
        f32.convert_i32_s
        local.get 0
        f32.convert_i32_s
        local.get 2
        f32.convert_i32_s
        f32.const 0x1p+0 (;=1;)
        f32.const 0x1.8p+1 (;=3;)
        f32.div
        f32.mul
        f32.add
        i32.const 8
        f32.convert_i32_s
        f32.add
        f32.le
        i32.and
        if  ;; label = @3
          i32.const 1
          local.set 3
        else
          i32.const 0
          f32.convert_i32_s
          local.get 0
          f32.convert_i32_s
          local.get 2
          f32.convert_i32_s
          f32.const 0x1p+1 (;=2;)
          f32.const 0x1.8p+1 (;=3;)
          f32.div
          f32.mul
          f32.add
          f32.ge
          i32.const 0
          f32.convert_i32_s
          local.get 0
          f32.convert_i32_s
          local.get 2
          f32.convert_i32_s
          f32.const 0x1p+1 (;=2;)
          f32.const 0x1.8p+1 (;=3;)
          f32.div
          f32.mul
          f32.add
          i32.const 8
          f32.convert_i32_s
          f32.add
          f32.le
          i32.and
          if  ;; label = @4
            i32.const 2
            local.set 3
          else
            i32.const 0
            local.get 0
            local.get 2
            i32.add
            i32.ge_s
            if  ;; label = @5
              i32.const 3
              local.set 3
            end
          end
        end
      end
      i32.const 0
      i32.const 255
      i32.const 0
      call 6
      i32.const 0
      drop
      local.get 0
      local.get 1
      local.get 2
      i32.const 14
      i32.add
      i32.const 10
      i32.const 1
      call 8
      i32.const 0
      drop
    else
      i32.const 0
      local.get 0
      i32.ge_s
      i32.const 0
      local.get 0
      local.get 2
      i32.add
      i32.const 14
      i32.add
      i32.le_s
      i32.and
      i32.const 0
      local.get 1
      i32.const 8
      i32.sub
      i32.ge_s
      i32.and
      i32.const 0
      local.get 1
      i32.const 10
      i32.add
      i32.le_s
      i32.and
      if  ;; label = @2
        i32.const 0
        i32.const 200
        i32.const 0
        call 6
        i32.const 0
        drop
        local.get 0
        local.get 1
        local.get 2
        i32.const 14
        i32.add
        i32.const 10
        i32.const 0
        call 8
        i32.const 0
        drop
      end
    end
    local.get 3
    i32.const 0
    i32.eq
    if  ;; label = @1
      global.get 122
      local.get 0
      local.get 1
      i32.const 8
      i32.sub
      i32.const 0
      call 16
      i32.const 0
      drop
    else
      local.get 3
      i32.const 1
      i32.eq
      if  ;; label = @2
        global.get 122
        local.get 0
        f32.convert_i32_s
        local.get 2
        f32.convert_i32_s
        f32.const 0x1p+0 (;=1;)
        f32.const 0x1.8p+1 (;=3;)
        f32.div
        f32.mul
        f32.add
        i32.const 2
        f32.convert_i32_s
        f32.add
        i32.trunc_f32_s
        local.get 1
        i32.const 8
        i32.sub
        i32.const 0
        call 16
        i32.const 0
        drop
      else
        local.get 3
        i32.const 2
        i32.eq
        if  ;; label = @3
          global.get 122
          local.get 0
          f32.convert_i32_s
          local.get 2
          f32.convert_i32_s
          f32.const 0x1p+1 (;=2;)
          f32.const 0x1.8p+1 (;=3;)
          f32.div
          f32.mul
          f32.add
          i32.const 4
          f32.convert_i32_s
          f32.add
          i32.trunc_f32_s
          local.get 1
          i32.const 8
          i32.sub
          i32.const 0
          call 16
          i32.const 0
          drop
        else
          global.get 122
          local.get 0
          local.get 2
          i32.add
          i32.const 6
          i32.add
          local.get 1
          i32.const 8
          i32.sub
          i32.const 0
          call 16
          i32.const 0
          drop
        end
      end
    end
    i32.const 170
    i32.const 170
    i32.const 170
    call 6
    i32.const 0
    drop
    local.get 3
    i32.const 0
    i32.eq
    if  ;; label = @1
      local.get 0
      i32.const 2
      i32.add
      drop
      local.get 1
      i32.const 10
      i32.add
      global.get 39
      i32.add
      drop
      local.get 5
      drop
      i32.const 1
      drop
      i32.const 0
      drop
    else
      local.get 3
      i32.const 1
      i32.eq
      if  ;; label = @2
        local.get 0
        f32.convert_i32_s
        local.get 2
        f32.convert_i32_s
        f32.const 0x1p+0 (;=1;)
        f32.const 0x1.8p+1 (;=3;)
        f32.div
        f32.mul
        f32.add
        i32.const 2
        f32.convert_i32_s
        f32.add
        f32.const 0x1.4p+3 (;=10;)
        f32.const 0x1.8p+1 (;=3;)
        f32.div
        f32.add
        drop
        local.get 1
        i32.const 10
        i32.add
        global.get 39
        i32.add
        drop
        local.get 6
        drop
        i32.const 1
        drop
        i32.const 0
        drop
      else
        local.get 3
        i32.const 2
        i32.eq
        if  ;; label = @3
          local.get 0
          f32.convert_i32_s
          local.get 2
          f32.convert_i32_s
          f32.const 0x1p+1 (;=2;)
          f32.const 0x1.8p+1 (;=3;)
          f32.div
          f32.mul
          f32.add
          i32.const 2
          f32.convert_i32_s
          f32.add
          f32.const 0x1.4p+3 (;=10;)
          f32.const 0x1.8p+1 (;=3;)
          f32.div
          i32.const 2
          f32.convert_i32_s
          f32.mul
          f32.add
          drop
          local.get 1
          i32.const 10
          i32.add
          global.get 39
          i32.add
          drop
          local.get 7
          drop
          i32.const 1
          drop
          i32.const 0
          drop
        else
          local.get 0
          local.get 2
          i32.add
          i32.const 12
          i32.add
          drop
          local.get 1
          i32.const 10
          i32.add
          global.get 39
          i32.add
          drop
          local.get 8
          drop
          i32.const 1
          drop
          i32.const 0
          drop
        end
      end
    end
    local.get 3
    return)
  (func (;422;) (type 55) (param i32 i32 i32 i32 i32 i32 i32 i32 i32 i32) (result i32)
    global.get 45
    if  ;; label = @1
      i32.const 0
      local.get 0
      i32.ge_s
      i32.const 0
      local.get 0
      local.get 2
      i32.add
      i32.const 14
      i32.add
      i32.le_s
      i32.and
      i32.const 0
      local.get 1
      i32.const 8
      i32.sub
      i32.ge_s
      i32.and
      i32.const 0
      local.get 1
      i32.const 10
      i32.add
      i32.le_s
      i32.and
      if  ;; label = @2
        local.get 4
        global.set 33
      end
    end
    i32.const 200
    i32.const 200
    i32.const 200
    call 6
    i32.const 0
    drop
    local.get 0
    local.get 1
    local.get 2
    i32.const 14
    i32.add
    i32.const 10
    i32.const 1
    call 8
    i32.const 0
    drop
    local.get 0
    local.get 1
    i32.const 8
    i32.sub
    i32.const 4
    i32.const 14
    i32.const 1
    call 8
    i32.const 0
    drop
    local.get 0
    local.get 2
    i32.const 4
    i32.div_s
    i32.add
    f32.convert_i32_s
    f32.const 0x1.4p+1 (;=2.5;)
    f32.add
    i32.trunc_f32_s
    local.get 1
    i32.const 8
    i32.sub
    i32.const 4
    i32.const 14
    i32.const 1
    call 8
    i32.const 0
    drop
    local.get 0
    local.get 2
    i32.const 2
    i32.div_s
    i32.add
    i32.const 5
    i32.add
    local.get 1
    i32.const 8
    i32.sub
    i32.const 4
    i32.const 14
    i32.const 1
    call 8
    i32.const 0
    drop
    local.get 0
    f32.convert_i32_s
    local.get 2
    f32.convert_i32_s
    f32.const 0x1.8p-1 (;=0.75;)
    f32.mul
    f32.add
    f32.const 0x1.ep+2 (;=7.5;)
    f32.add
    i32.trunc_f32_s
    local.get 1
    i32.const 8
    i32.sub
    i32.const 4
    i32.const 14
    i32.const 1
    call 8
    i32.const 0
    drop
    local.get 0
    local.get 2
    i32.add
    i32.const 10
    i32.add
    local.get 1
    i32.const 8
    i32.sub
    i32.const 4
    i32.const 14
    i32.const 1
    call 8
    i32.const 0
    drop
    local.get 4
    global.get 33
    i32.eq
    if  ;; label = @1
      i32.const 0
      local.get 0
      i32.const 8
      i32.add
      i32.le_s
      if  ;; label = @2
        i32.const 0
        local.set 3
      else
        i32.const 0
        local.get 0
        local.get 2
        i32.const 4
        i32.div_s
        i32.add
        i32.ge_s
        i32.const 0
        local.get 0
        local.get 2
        i32.const 4
        i32.div_s
        i32.add
        i32.const 8
        i32.add
        i32.le_s
        i32.and
        if  ;; label = @3
          i32.const 1
          local.set 3
        else
          i32.const 0
          local.get 0
          local.get 2
          i32.const 2
          i32.div_s
          i32.add
          i32.ge_s
          i32.const 0
          local.get 0
          local.get 2
          i32.const 2
          i32.div_s
          i32.add
          i32.const 8
          i32.add
          i32.le_s
          i32.and
          if  ;; label = @4
            i32.const 2
            local.set 3
          else
            i32.const 0
            f32.convert_i32_s
            local.get 0
            f32.convert_i32_s
            local.get 2
            f32.convert_i32_s
            f32.const 0x1.8p-1 (;=0.75;)
            f32.mul
            f32.add
            f32.ge
            i32.const 0
            f32.convert_i32_s
            local.get 0
            f32.convert_i32_s
            local.get 2
            f32.convert_i32_s
            f32.const 0x1.8p-1 (;=0.75;)
            f32.mul
            f32.add
            i32.const 8
            f32.convert_i32_s
            f32.add
            f32.le
            i32.and
            if  ;; label = @5
              i32.const 3
              local.set 3
            else
              i32.const 0
              local.get 0
              local.get 2
              i32.add
              i32.ge_s
              if  ;; label = @6
                i32.const 4
                local.set 3
              end
            end
          end
        end
      end
      i32.const 0
      i32.const 255
      i32.const 0
      call 6
      i32.const 0
      drop
      local.get 0
      local.get 1
      local.get 2
      i32.const 14
      i32.add
      i32.const 10
      i32.const 1
      call 8
      i32.const 0
      drop
    else
      i32.const 0
      local.get 0
      i32.ge_s
      i32.const 0
      local.get 0
      local.get 2
      i32.add
      i32.const 14
      i32.add
      i32.le_s
      i32.and
      i32.const 0
      local.get 1
      i32.const 8
      i32.sub
      i32.ge_s
      i32.and
      i32.const 0
      local.get 1
      i32.const 10
      i32.add
      i32.le_s
      i32.and
      if  ;; label = @2
        i32.const 0
        i32.const 200
        i32.const 0
        call 6
        i32.const 0
        drop
        local.get 0
        local.get 1
        local.get 2
        i32.const 14
        i32.add
        i32.const 10
        i32.const 0
        call 8
        i32.const 0
        drop
      end
    end
    local.get 3
    i32.const 0
    i32.eq
    if  ;; label = @1
      global.get 122
      local.get 0
      local.get 1
      i32.const 8
      i32.sub
      i32.const 0
      call 16
      i32.const 0
      drop
    else
      local.get 3
      i32.const 1
      i32.eq
      if  ;; label = @2
        global.get 122
        local.get 0
        local.get 2
        i32.const 4
        i32.div_s
        i32.add
        f32.convert_i32_s
        f32.const 0x1.8p+0 (;=1.5;)
        f32.add
        i32.trunc_f32_s
        local.get 1
        i32.const 8
        i32.sub
        i32.const 0
        call 16
        i32.const 0
        drop
      else
        local.get 3
        i32.const 2
        i32.eq
        if  ;; label = @3
          global.get 122
          local.get 0
          local.get 2
          i32.const 2
          i32.div_s
          i32.add
          i32.const 3
          i32.add
          local.get 1
          i32.const 8
          i32.sub
          i32.const 0
          call 16
          i32.const 0
          drop
        else
          local.get 3
          i32.const 3
          i32.eq
          if  ;; label = @4
            global.get 122
            local.get 0
            f32.convert_i32_s
            local.get 2
            f32.convert_i32_s
            f32.const 0x1.8p-1 (;=0.75;)
            f32.mul
            f32.add
            f32.const 0x1.2p+2 (;=4.5;)
            f32.add
            i32.trunc_f32_s
            local.get 1
            i32.const 8
            i32.sub
            i32.const 0
            call 16
            i32.const 0
            drop
          else
            global.get 122
            local.get 0
            local.get 2
            i32.add
            i32.const 6
            i32.add
            local.get 1
            i32.const 8
            i32.sub
            i32.const 0
            call 16
            i32.const 0
            drop
          end
        end
      end
    end
    i32.const 170
    i32.const 170
    i32.const 170
    call 6
    i32.const 0
    drop
    local.get 3
    i32.const 0
    i32.eq
    if  ;; label = @1
      local.get 0
      i32.const 2
      i32.add
      drop
      local.get 1
      i32.const 10
      i32.add
      global.get 39
      i32.add
      drop
      local.get 5
      drop
      i32.const 1
      drop
      i32.const 0
      drop
    else
      local.get 3
      i32.const 1
      i32.eq
      if  ;; label = @2
        local.get 0
        local.get 2
        i32.const 4
        i32.div_s
        i32.add
        f32.convert_i32_s
        f32.const 0x1.2p+2 (;=4.5;)
        f32.add
        drop
        local.get 1
        i32.const 10
        i32.add
        global.get 39
        i32.add
        drop
        local.get 6
        drop
        i32.const 1
        drop
        i32.const 0
        drop
      else
        local.get 3
        i32.const 2
        i32.eq
        if  ;; label = @3
          local.get 0
          local.get 2
          i32.const 2
          i32.div_s
          i32.add
          i32.const 7
          i32.add
          drop
          local.get 1
          i32.const 10
          i32.add
          global.get 39
          i32.add
          drop
          local.get 7
          drop
          i32.const 1
          drop
          i32.const 0
          drop
        else
          local.get 3
          i32.const 3
          i32.eq
          if  ;; label = @4
            local.get 0
            f32.convert_i32_s
            local.get 2
            f32.convert_i32_s
            f32.const 0x1.8p-1 (;=0.75;)
            f32.mul
            f32.add
            f32.const 0x1.3p+3 (;=9.5;)
            f32.add
            drop
            local.get 1
            i32.const 10
            i32.add
            global.get 39
            i32.add
            drop
            local.get 8
            drop
            i32.const 1
            drop
            i32.const 0
            drop
          else
            local.get 0
            local.get 2
            i32.add
            i32.const 12
            i32.add
            drop
            local.get 1
            i32.const 10
            i32.add
            global.get 39
            i32.add
            drop
            local.get 9
            drop
            i32.const 1
            drop
            i32.const 0
            drop
          end
        end
      end
    end
    local.get 3
    return)
  (func (;423;) (type 56) (param i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32) (result i32)
    global.get 45
    if  ;; label = @1
      i32.const 0
      local.get 0
      i32.ge_s
      i32.const 0
      local.get 0
      local.get 2
      i32.add
      i32.const 14
      i32.add
      i32.le_s
      i32.and
      i32.const 0
      local.get 1
      i32.const 8
      i32.sub
      i32.ge_s
      i32.and
      i32.const 0
      local.get 1
      i32.const 10
      i32.add
      i32.le_s
      i32.and
      if  ;; label = @2
        local.get 4
        global.set 33
      end
    end
    i32.const 200
    i32.const 200
    i32.const 200
    call 6
    i32.const 0
    drop
    local.get 0
    local.get 1
    local.get 2
    i32.const 14
    i32.add
    i32.const 10
    i32.const 1
    call 8
    i32.const 0
    drop
    local.get 0
    local.get 1
    i32.const 8
    i32.sub
    i32.const 4
    i32.const 14
    i32.const 1
    call 8
    i32.const 0
    drop
    local.get 0
    f32.convert_i32_s
    local.get 2
    f32.convert_i32_s
    f32.const 0x1p+0 (;=1;)
    f32.const 0x1.8p+2 (;=6;)
    f32.div
    f32.mul
    f32.add
    f32.const 0x1.4p+3 (;=10;)
    f32.const 0x1.8p+2 (;=6;)
    f32.div
    f32.add
    i32.trunc_f32_s
    local.get 1
    i32.const 8
    i32.sub
    i32.const 4
    i32.const 14
    i32.const 1
    call 8
    i32.const 0
    drop
    local.get 0
    f32.convert_i32_s
    local.get 2
    f32.convert_i32_s
    f32.const 0x1p+1 (;=2;)
    f32.const 0x1.8p+2 (;=6;)
    f32.div
    f32.mul
    f32.add
    f32.const 0x1.4p+4 (;=20;)
    f32.const 0x1.8p+2 (;=6;)
    f32.div
    f32.add
    i32.trunc_f32_s
    local.get 1
    i32.const 8
    i32.sub
    i32.const 4
    i32.const 14
    i32.const 1
    call 8
    i32.const 0
    drop
    local.get 0
    f32.convert_i32_s
    local.get 2
    f32.convert_i32_s
    f32.const 0x1.8p+1 (;=3;)
    f32.const 0x1.8p+2 (;=6;)
    f32.div
    f32.mul
    f32.add
    f32.const 0x1.ep+4 (;=30;)
    f32.const 0x1.8p+2 (;=6;)
    f32.div
    f32.add
    i32.trunc_f32_s
    local.get 1
    i32.const 8
    i32.sub
    i32.const 4
    i32.const 14
    i32.const 1
    call 8
    i32.const 0
    drop
    local.get 0
    f32.convert_i32_s
    local.get 2
    f32.convert_i32_s
    f32.const 0x1p+2 (;=4;)
    f32.const 0x1.8p+2 (;=6;)
    f32.div
    f32.mul
    f32.add
    f32.const 0x1.4p+5 (;=40;)
    f32.const 0x1.8p+2 (;=6;)
    f32.div
    f32.add
    i32.trunc_f32_s
    local.get 1
    i32.const 8
    i32.sub
    i32.const 4
    i32.const 14
    i32.const 1
    call 8
    i32.const 0
    drop
    local.get 0
    f32.convert_i32_s
    local.get 2
    f32.convert_i32_s
    f32.const 0x1.4p+2 (;=5;)
    f32.const 0x1.8p+2 (;=6;)
    f32.div
    f32.mul
    f32.add
    f32.const 0x1.9p+5 (;=50;)
    f32.const 0x1.8p+2 (;=6;)
    f32.div
    f32.add
    i32.trunc_f32_s
    local.get 1
    i32.const 8
    i32.sub
    i32.const 4
    i32.const 14
    i32.const 1
    call 8
    i32.const 0
    drop
    local.get 0
    local.get 2
    i32.add
    i32.const 10
    i32.add
    local.get 1
    i32.const 8
    i32.sub
    i32.const 4
    i32.const 14
    i32.const 1
    call 8
    i32.const 0
    drop
    local.get 4
    global.get 33
    i32.eq
    if  ;; label = @1
      i32.const 0
      local.get 0
      i32.const 8
      i32.add
      i32.le_s
      if  ;; label = @2
        i32.const 0
        local.set 3
      else
        i32.const 0
        f32.convert_i32_s
        local.get 0
        f32.convert_i32_s
        local.get 2
        f32.convert_i32_s
        f32.const 0x1p+0 (;=1;)
        f32.const 0x1.8p+2 (;=6;)
        f32.div
        f32.mul
        f32.add
        f32.ge
        i32.const 0
        f32.convert_i32_s
        local.get 0
        f32.convert_i32_s
        local.get 2
        f32.convert_i32_s
        f32.const 0x1p+0 (;=1;)
        f32.const 0x1.8p+2 (;=6;)
        f32.div
        f32.mul
        f32.add
        i32.const 8
        f32.convert_i32_s
        f32.add
        f32.le
        i32.and
        if  ;; label = @3
          i32.const 1
          local.set 3
        else
          i32.const 0
          f32.convert_i32_s
          local.get 0
          f32.convert_i32_s
          local.get 2
          f32.convert_i32_s
          f32.const 0x1p+1 (;=2;)
          f32.const 0x1.8p+2 (;=6;)
          f32.div
          f32.mul
          f32.add
          f32.ge
          i32.const 0
          f32.convert_i32_s
          local.get 0
          f32.convert_i32_s
          local.get 2
          f32.convert_i32_s
          f32.const 0x1p+1 (;=2;)
          f32.const 0x1.8p+2 (;=6;)
          f32.div
          f32.mul
          f32.add
          i32.const 8
          f32.convert_i32_s
          f32.add
          f32.le
          i32.and
          if  ;; label = @4
            i32.const 2
            local.set 3
          else
            i32.const 0
            f32.convert_i32_s
            local.get 0
            f32.convert_i32_s
            local.get 2
            f32.convert_i32_s
            f32.const 0x1.8p+1 (;=3;)
            f32.const 0x1.8p+2 (;=6;)
            f32.div
            f32.mul
            f32.add
            f32.ge
            i32.const 0
            f32.convert_i32_s
            local.get 0
            f32.convert_i32_s
            local.get 2
            f32.convert_i32_s
            f32.const 0x1.8p+1 (;=3;)
            f32.const 0x1.8p+2 (;=6;)
            f32.div
            f32.mul
            f32.add
            i32.const 8
            f32.convert_i32_s
            f32.add
            f32.le
            i32.and
            if  ;; label = @5
              i32.const 3
              local.set 3
            else
              i32.const 0
              f32.convert_i32_s
              local.get 0
              f32.convert_i32_s
              local.get 2
              f32.convert_i32_s
              f32.const 0x1p+2 (;=4;)
              f32.const 0x1.8p+2 (;=6;)
              f32.div
              f32.mul
              f32.add
              f32.ge
              i32.const 0
              f32.convert_i32_s
              local.get 0
              f32.convert_i32_s
              local.get 2
              f32.convert_i32_s
              f32.const 0x1p+2 (;=4;)
              f32.const 0x1.8p+2 (;=6;)
              f32.div
              f32.mul
              f32.add
              i32.const 8
              f32.convert_i32_s
              f32.add
              f32.le
              i32.and
              if  ;; label = @6
                i32.const 4
                local.set 3
              else
                i32.const 0
                f32.convert_i32_s
                local.get 0
                f32.convert_i32_s
                local.get 2
                f32.convert_i32_s
                f32.const 0x1.4p+2 (;=5;)
                f32.const 0x1.8p+2 (;=6;)
                f32.div
                f32.mul
                f32.add
                f32.ge
                i32.const 0
                f32.convert_i32_s
                local.get 0
                f32.convert_i32_s
                local.get 2
                f32.convert_i32_s
                f32.const 0x1.4p+2 (;=5;)
                f32.const 0x1.8p+2 (;=6;)
                f32.div
                f32.mul
                f32.add
                i32.const 8
                f32.convert_i32_s
                f32.add
                f32.le
                i32.and
                if  ;; label = @7
                  i32.const 5
                  local.set 3
                else
                  i32.const 0
                  local.get 0
                  local.get 2
                  i32.add
                  i32.ge_s
                  if  ;; label = @8
                    i32.const 6
                    local.set 3
                  end
                end
              end
            end
          end
        end
      end
      i32.const 0
      i32.const 255
      i32.const 0
      call 6
      i32.const 0
      drop
      local.get 0
      local.get 1
      local.get 2
      i32.const 14
      i32.add
      i32.const 10
      i32.const 1
      call 8
      i32.const 0
      drop
    else
      i32.const 0
      local.get 0
      i32.ge_s
      i32.const 0
      local.get 0
      local.get 2
      i32.add
      i32.const 14
      i32.add
      i32.le_s
      i32.and
      i32.const 0
      local.get 1
      i32.const 8
      i32.sub
      i32.ge_s
      i32.and
      i32.const 0
      local.get 1
      i32.const 10
      i32.add
      i32.le_s
      i32.and
      if  ;; label = @2
        i32.const 0
        i32.const 200
        i32.const 0
        call 6
        i32.const 0
        drop
        local.get 0
        local.get 1
        local.get 2
        i32.const 14
        i32.add
        i32.const 10
        i32.const 0
        call 8
        i32.const 0
        drop
      end
    end
    local.get 3
    i32.const 0
    i32.eq
    if  ;; label = @1
      global.get 122
      local.get 0
      local.get 1
      i32.const 8
      i32.sub
      i32.const 0
      call 16
      i32.const 0
      drop
    else
      local.get 3
      i32.const 1
      i32.eq
      if  ;; label = @2
        global.get 122
        local.get 0
        f32.convert_i32_s
        local.get 2
        f32.convert_i32_s
        f32.const 0x1p+0 (;=1;)
        f32.const 0x1.8p+2 (;=6;)
        f32.div
        f32.mul
        f32.add
        i32.const 1
        f32.convert_i32_s
        f32.add
        i32.trunc_f32_s
        local.get 1
        i32.const 8
        i32.sub
        i32.const 0
        call 16
        i32.const 0
        drop
      else
        local.get 3
        i32.const 2
        i32.eq
        if  ;; label = @3
          global.get 122
          local.get 0
          f32.convert_i32_s
          local.get 2
          f32.convert_i32_s
          f32.const 0x1p+1 (;=2;)
          f32.const 0x1.8p+2 (;=6;)
          f32.div
          f32.mul
          f32.add
          i32.const 2
          f32.convert_i32_s
          f32.add
          i32.trunc_f32_s
          local.get 1
          i32.const 8
          i32.sub
          i32.const 0
          call 16
          i32.const 0
          drop
        else
          local.get 3
          i32.const 3
          i32.eq
          if  ;; label = @4
            global.get 122
            local.get 0
            f32.convert_i32_s
            local.get 2
            f32.convert_i32_s
            f32.const 0x1.8p+1 (;=3;)
            f32.const 0x1.8p+2 (;=6;)
            f32.div
            f32.mul
            f32.add
            i32.const 3
            f32.convert_i32_s
            f32.add
            i32.trunc_f32_s
            local.get 1
            i32.const 8
            i32.sub
            i32.const 0
            call 16
            i32.const 0
            drop
          else
            local.get 3
            i32.const 4
            i32.eq
            if  ;; label = @5
              global.get 122
              local.get 0
              f32.convert_i32_s
              local.get 2
              f32.convert_i32_s
              f32.const 0x1p+2 (;=4;)
              f32.const 0x1.8p+2 (;=6;)
              f32.div
              f32.mul
              f32.add
              i32.const 4
              f32.convert_i32_s
              f32.add
              i32.trunc_f32_s
              local.get 1
              i32.const 8
              i32.sub
              i32.const 0
              call 16
              i32.const 0
              drop
            else
              local.get 3
              i32.const 5
              i32.eq
              if  ;; label = @6
                global.get 122
                local.get 0
                f32.convert_i32_s
                local.get 2
                f32.convert_i32_s
                f32.const 0x1.4p+2 (;=5;)
                f32.const 0x1.8p+2 (;=6;)
                f32.div
                f32.mul
                f32.add
                i32.const 5
                f32.convert_i32_s
                f32.add
                i32.trunc_f32_s
                local.get 1
                i32.const 8
                i32.sub
                i32.const 0
                call 16
                i32.const 0
                drop
              else
                global.get 122
                local.get 0
                local.get 2
                i32.add
                i32.const 6
                i32.add
                local.get 1
                i32.const 8
                i32.sub
                i32.const 0
                call 16
                i32.const 0
                drop
              end
            end
          end
        end
      end
    end
    i32.const 170
    i32.const 170
    i32.const 170
    call 6
    i32.const 0
    drop
    local.get 3
    i32.const 0
    i32.eq
    if  ;; label = @1
      local.get 0
      i32.const 2
      i32.add
      drop
      local.get 1
      i32.const 10
      i32.add
      global.get 39
      i32.add
      drop
      local.get 5
      drop
      i32.const 1
      drop
      i32.const 0
      drop
    else
      local.get 3
      i32.const 1
      i32.eq
      if  ;; label = @2
        local.get 0
        f32.convert_i32_s
        local.get 2
        f32.convert_i32_s
        f32.const 0x1p+0 (;=1;)
        f32.const 0x1.8p+2 (;=6;)
        f32.div
        f32.mul
        f32.add
        i32.const 2
        f32.convert_i32_s
        f32.add
        f32.const 0x1.4p+3 (;=10;)
        f32.const 0x1.8p+2 (;=6;)
        f32.div
        f32.add
        drop
        local.get 1
        i32.const 10
        i32.add
        global.get 39
        i32.add
        drop
        local.get 6
        drop
        i32.const 1
        drop
        i32.const 0
        drop
      else
        local.get 3
        i32.const 2
        i32.eq
        if  ;; label = @3
          local.get 0
          f32.convert_i32_s
          local.get 2
          f32.convert_i32_s
          f32.const 0x1p+1 (;=2;)
          f32.const 0x1.8p+2 (;=6;)
          f32.div
          f32.mul
          f32.add
          i32.const 2
          f32.convert_i32_s
          f32.add
          f32.const 0x1.4p+3 (;=10;)
          f32.const 0x1.8p+2 (;=6;)
          f32.div
          i32.const 2
          f32.convert_i32_s
          f32.mul
          f32.add
          drop
          local.get 1
          i32.const 10
          i32.add
          global.get 39
          i32.add
          drop
          local.get 7
          drop
          i32.const 1
          drop
          i32.const 0
          drop
        else
          local.get 3
          i32.const 3
          i32.eq
          if  ;; label = @4
            local.get 0
            f32.convert_i32_s
            local.get 2
            f32.convert_i32_s
            f32.const 0x1.8p+1 (;=3;)
            f32.const 0x1.8p+2 (;=6;)
            f32.div
            f32.mul
            f32.add
            i32.const 2
            f32.convert_i32_s
            f32.add
            f32.const 0x1.4p+3 (;=10;)
            f32.const 0x1.8p+2 (;=6;)
            f32.div
            i32.const 3
            f32.convert_i32_s
            f32.mul
            f32.add
            drop
            local.get 1
            i32.const 10
            i32.add
            global.get 39
            i32.add
            drop
            local.get 8
            drop
            i32.const 1
            drop
            i32.const 0
            drop
          else
            local.get 3
            i32.const 4
            i32.eq
            if  ;; label = @5
              local.get 0
              f32.convert_i32_s
              local.get 2
              f32.convert_i32_s
              f32.const 0x1p+2 (;=4;)
              f32.const 0x1.8p+2 (;=6;)
              f32.div
              f32.mul
              f32.add
              i32.const 2
              f32.convert_i32_s
              f32.add
              f32.const 0x1.4p+3 (;=10;)
              f32.const 0x1.8p+2 (;=6;)
              f32.div
              i32.const 4
              f32.convert_i32_s
              f32.mul
              f32.add
              drop
              local.get 1
              i32.const 10
              i32.add
              global.get 39
              i32.add
              drop
              local.get 9
              drop
              i32.const 1
              drop
              i32.const 0
              drop
            else
              local.get 3
              i32.const 5
              i32.eq
              if  ;; label = @6
                local.get 0
                f32.convert_i32_s
                local.get 2
                f32.convert_i32_s
                f32.const 0x1.4p+2 (;=5;)
                f32.const 0x1.8p+2 (;=6;)
                f32.div
                f32.mul
                f32.add
                i32.const 2
                f32.convert_i32_s
                f32.add
                f32.const 0x1.4p+3 (;=10;)
                f32.const 0x1.8p+2 (;=6;)
                f32.div
                i32.const 5
                f32.convert_i32_s
                f32.mul
                f32.add
                drop
                local.get 1
                i32.const 10
                i32.add
                global.get 39
                i32.add
                drop
                local.get 10
                drop
                i32.const 1
                drop
                i32.const 0
                drop
              else
                local.get 0
                local.get 2
                i32.add
                i32.const 12
                i32.add
                drop
                local.get 1
                i32.const 10
                i32.add
                global.get 39
                i32.add
                drop
                local.get 11
                drop
                i32.const 1
                drop
                i32.const 0
                drop
              end
            end
          end
        end
      end
    end
    local.get 3
    return)
  (func (;424;) (type 57) (param i32 i32 i32 i32 i32 i32 i32 i32 f32 i32) (result f32)
    (local i32 i32)
    call 51
    local.set 10
    call 52
    local.set 11
    i32.const 0
    i32.const 0
    i32.const 0
    call 6
    i32.const 0
    drop
    local.get 4
    local.get 5
    local.get 6
    local.get 7
    i32.const 11486
    i32.const 0
    call 425
    drop
    local.get 9
    i32.const 0
    i32.eq
    if  ;; label = @1
      local.get 3
      i32.const 10
      i32.gt_s
      if  ;; label = @2
        i32.const 250
        i32.const 250
        i32.const 250
        call 6
        i32.const 0
        drop
        local.get 4
        local.get 6
        i32.const 2
        i32.div_s
        i32.add
        local.get 5
        i32.const 5
        global.get 39
        i32.mul
        i32.add
        i32.const 2
        global.get 39
        i32.mul
        local.get 7
        i32.const 10
        i32.sub
        i32.const 0
        call 8
        i32.const 0
        drop
        local.get 4
        local.get 6
        i32.const 2
        i32.div_s
        i32.add
        i32.const 3
        global.get 39
        i32.mul
        i32.sub
        local.get 5
        i32.const 5
        global.get 39
        i32.mul
        i32.add
        i32.const 2
        global.get 39
        i32.mul
        local.get 7
        i32.const 10
        i32.sub
        i32.const 0
        call 8
        i32.const 0
        drop
        local.get 4
        local.get 6
        i32.const 2
        i32.div_s
        i32.add
        i32.const 3
        global.get 39
        i32.mul
        i32.add
        local.get 5
        i32.const 5
        global.get 39
        i32.mul
        i32.add
        i32.const 2
        global.get 39
        i32.mul
        local.get 7
        i32.const 10
        i32.sub
        i32.const 0
        call 8
        i32.const 0
        drop
      end
    else
      local.get 2
      i32.const 10
      i32.gt_s
      if  ;; label = @2
        i32.const 250
        i32.const 250
        i32.const 250
        call 6
        i32.const 0
        drop
        local.get 4
        i32.const 4
        global.get 39
        i32.mul
        i32.add
        local.get 5
        local.get 7
        i32.const 2
        i32.div_s
        i32.add
        local.get 6
        i32.const 10
        global.get 39
        i32.mul
        i32.sub
        i32.const 2
        global.get 39
        i32.mul
        i32.const 0
        call 8
        i32.const 0
        drop
        local.get 4
        i32.const 4
        global.get 39
        i32.mul
        i32.add
        local.get 5
        local.get 7
        i32.const 2
        i32.div_s
        i32.add
        i32.const 3
        global.get 39
        i32.mul
        i32.sub
        local.get 6
        i32.const 10
        global.get 39
        i32.mul
        i32.sub
        i32.const 2
        global.get 39
        i32.mul
        i32.const 0
        call 8
        i32.const 0
        drop
        local.get 4
        i32.const 4
        global.get 39
        i32.mul
        i32.add
        local.get 5
        local.get 7
        i32.const 2
        i32.div_s
        i32.add
        i32.const 3
        global.get 39
        i32.mul
        i32.add
        local.get 6
        i32.const 10
        global.get 39
        i32.mul
        i32.sub
        i32.const 2
        global.get 39
        i32.mul
        i32.const 0
        call 8
        i32.const 0
        drop
      end
    end
    call 46
    local.get 4
    i32.gt_s
    call 46
    local.get 4
    local.get 6
    i32.add
    i32.lt_s
    i32.and
    if  ;; label = @1
      call 47
      local.get 5
      i32.gt_s
      call 47
      local.get 5
      local.get 7
      i32.add
      i32.lt_s
      i32.and
      if  ;; label = @2
        i32.const 1
        global.set 34
      else
        global.get 45
        if  ;; label = @3
          i32.const 0
          global.set 34
        end
      end
    else
      global.get 45
      if  ;; label = @2
        i32.const 0
        global.set 34
      end
    end
    global.get 45
    if  ;; label = @1
      global.get 34
      if  ;; label = @2
        local.get 9
        i32.const 0
        i32.eq
        if  ;; label = @3
          local.get 8
          local.get 10
          f32.convert_i32_s
          local.get 2
          local.get 6
          i32.sub
          f32.convert_i32_s
          f32.div
          f32.add
          i32.const 0
          f32.convert_i32_s
          call 357
          i32.const 1
          f32.convert_i32_s
          call 356
          return
        else
          local.get 8
          local.get 11
          f32.convert_i32_s
          local.get 3
          local.get 7
          i32.sub
          f32.convert_i32_s
          f32.div
          f32.add
          i32.const 0
          f32.convert_i32_s
          call 357
          i32.const 1
          f32.convert_i32_s
          call 356
          return
        end
      end
    end
    local.get 8
    return)
  (func (;425;) (type 48) (param i32 i32 i32 i32 i32 i32) (result i32)
    (local i32)
    i32.const 0
    local.set 6
    i32.const 50
    i32.const 50
    i32.const 50
    call 6
    i32.const 0
    drop
    local.get 5
    if  ;; label = @1
      call 46
      local.get 0
      i32.gt_s
      call 46
      local.get 0
      local.get 2
      i32.add
      i32.lt_s
      i32.and
      if  ;; label = @2
        call 47
        local.get 1
        i32.gt_s
        call 47
        local.get 1
        local.get 3
        i32.add
        i32.lt_s
        i32.and
        if  ;; label = @3
          global.get 45
          if  ;; label = @4
            i32.const 1
            local.set 6
            i32.const 50
            f32.convert_i32_s
            f32.const 0x1.333334p-1 (;=0.6;)
            f32.mul
            i32.trunc_f32_s
            i32.const 50
            f32.convert_i32_s
            f32.const 0x1.333334p-1 (;=0.6;)
            f32.mul
            i32.trunc_f32_s
            i32.const 50
            f32.convert_i32_s
            f32.const 0x1.333334p-1 (;=0.6;)
            f32.mul
            i32.trunc_f32_s
            call 6
            i32.const 0
            drop
          else
            i32.const 50
            f32.convert_i32_s
            f32.const 0x1.333334p+0 (;=1.2;)
            f32.mul
            i32.const 255
            f32.convert_i32_s
            call 356
            i32.trunc_f32_s
            i32.const 50
            f32.convert_i32_s
            f32.const 0x1.333334p+0 (;=1.2;)
            f32.mul
            i32.const 255
            f32.convert_i32_s
            call 356
            i32.trunc_f32_s
            i32.const 50
            f32.convert_i32_s
            f32.const 0x1.333334p+0 (;=1.2;)
            f32.mul
            i32.const 255
            f32.convert_i32_s
            call 356
            i32.trunc_f32_s
            call 6
            i32.const 0
            drop
          end
        end
      end
    end
    local.get 6
    if  ;; label = @1
      local.get 0
      local.get 1
      local.get 2
      local.get 3
      i32.const 0
      call 8
      i32.const 0
      drop
      i32.const 133
      i32.const 130
      i32.const 125
      call 6
      i32.const 0
      drop
      local.get 0
      i32.const 1
      global.get 39
      i32.mul
      i32.add
      local.get 1
      i32.const 1
      global.get 39
      i32.mul
      i32.add
      local.get 2
      i32.const 1
      global.get 39
      i32.mul
      i32.sub
      local.get 3
      i32.const 1
      global.get 39
      i32.mul
      i32.sub
      i32.const 0
      call 8
      i32.const 0
      drop
      i32.const 10
      i32.const 10
      i32.const 10
      call 6
      i32.const 0
      drop
      local.get 0
      local.get 1
      local.get 2
      local.get 3
      i32.const 0
      call 8
      i32.const 0
      drop
      i32.const 250
      i32.const 250
      i32.const 250
      call 6
      i32.const 0
      drop
      local.get 0
      local.get 1
      local.get 3
      i32.add
      i32.const 1
      global.get 39
      i32.mul
      i32.sub
      local.get 0
      local.get 2
      i32.add
      i32.const 1
      global.get 39
      i32.mul
      i32.sub
      local.get 1
      local.get 3
      i32.add
      i32.const 1
      global.get 39
      i32.mul
      i32.sub
      call 10
      i32.const 0
      drop
      local.get 0
      local.get 2
      i32.add
      i32.const 1
      global.get 39
      i32.mul
      i32.sub
      local.get 1
      local.get 0
      local.get 2
      i32.add
      i32.const 1
      global.get 39
      i32.mul
      i32.sub
      local.get 1
      local.get 3
      i32.add
      i32.const 1
      global.get 39
      i32.mul
      i32.sub
      call 10
      i32.const 0
      drop
    else
      local.get 0
      local.get 1
      local.get 2
      local.get 3
      i32.const 0
      call 8
      i32.const 0
      drop
      i32.const 133
      i32.const 130
      i32.const 125
      call 6
      i32.const 0
      drop
      local.get 0
      local.get 1
      local.get 2
      i32.const 1
      global.get 39
      i32.mul
      i32.sub
      local.get 3
      i32.const 1
      global.get 39
      i32.mul
      i32.sub
      i32.const 0
      call 8
      i32.const 0
      drop
      i32.const 250
      i32.const 250
      i32.const 250
      call 6
      i32.const 0
      drop
      local.get 0
      local.get 1
      local.get 2
      local.get 3
      i32.const 0
      call 8
      i32.const 0
      drop
      i32.const 10
      i32.const 10
      i32.const 10
      call 6
      i32.const 0
      drop
      local.get 0
      local.get 1
      local.get 3
      i32.add
      i32.const 1
      i32.sub
      local.get 0
      local.get 2
      i32.add
      i32.const 1
      i32.sub
      local.get 1
      local.get 3
      i32.add
      i32.const 1
      i32.sub
      call 10
      i32.const 0
      drop
      local.get 0
      local.get 2
      i32.add
      i32.const 1
      i32.sub
      local.get 1
      local.get 0
      local.get 2
      i32.add
      i32.const 1
      i32.sub
      local.get 1
      local.get 3
      i32.add
      i32.const 1
      i32.sub
      call 10
      i32.const 0
      drop
    end
    i32.const 255
    i32.const 255
    i32.const 255
    call 6
    i32.const 0
    drop
    local.get 5
    if  ;; label = @1
      i32.const 70
      i32.const 70
      i32.const 70
      call 6
      i32.const 0
      drop
    end
    local.get 0
    local.get 2
    i32.const 2
    i32.div_s
    i32.add
    local.get 1
    local.get 3
    i32.const 2
    i32.div_s
    i32.add
    i32.const 1
    global.get 39
    i32.mul
    i32.sub
    local.get 4
    i32.const 1
    i32.const 1
    call 11
    i32.const 0
    drop
    i32.const 0
    i32.const 0
    i32.const 0
    call 6
    i32.const 0
    drop
    local.get 6
    global.get 47
    i32.and
    if  ;; label = @1
      global.get 61
      call 143
      drop
      i32.const 1
      return
    end
    i32.const 0
    return)
  (memory (;0;) 256 512)
  (global (;0;) (mut i32) (i32.const 256))
  (global (;1;) (mut i32) (i32.const 0))
  (global (;2;) (mut i32) (i32.const 0))
  (global (;3;) (mut i32) (i32.const 0))
  (global (;4;) (mut i32) (i32.const 65536))
  (global (;5;) (mut i32) (i32.const 131072))
  (global (;6;) (mut i32) (i32.const 262144))
  (global (;7;) (mut i32) (i32.const 0))
  (global (;8;) (mut i32) (i32.const 0))
  (global (;9;) (mut f32) (f32.const 0x0p+0 (;=0;)))
  (global (;10;) (mut f32) (f32.const 0x0p+0 (;=0;)))
  (global (;11;) (mut i32) (i32.const 65536))
  (global (;12;) (mut i32) (i32.const 0))
  (global (;13;) (mut i32) (i32.const 0))
  (global (;14;) (mut i32) (i32.const 0))
  (global (;15;) (mut i32) (i32.const 0))
  (global (;16;) (mut i32) (i32.const 0))
  (global (;17;) (mut i32) (i32.const 0))
  (global (;18;) (mut i32) (i32.const 0))
  (global (;19;) (mut i32) (i32.const 0))
  (global (;20;) (mut i32) (i32.const 0))
  (global (;21;) (mut i32) (i32.const 0))
  (global (;22;) (mut i32) (i32.const 0))
  (global (;23;) (mut i32) (i32.const 0))
  (global (;24;) (mut i32) (i32.const 0))
  (global (;25;) (mut i32) (i32.const 0))
  (global (;26;) (mut i32) (i32.const 0))
  (global (;27;) (mut i32) (i32.const 0))
  (global (;28;) (mut i32) (i32.const 0))
  (global (;29;) (mut i32) (i32.const 0))
  (global (;30;) (mut i32) (i32.const 0))
  (global (;31;) (mut f32) (f32.const 0x0p+0 (;=0;)))
  (global (;32;) (mut i32) (i32.const 0))
  (global (;33;) (mut i32) (i32.const 0))
  (global (;34;) (mut i32) (i32.const 0))
  (global (;35;) (mut f32) (f32.const 0x0p+0 (;=0;)))
  (global (;36;) (mut f32) (f32.const 0x0p+0 (;=0;)))
  (global (;37;) (mut i32) (i32.const 0))
  (global (;38;) (mut i32) (i32.const 0))
  (global (;39;) (mut i32) (i32.const 0))
  (global (;40;) (mut i32) (i32.const 0))
  (global (;41;) (mut i32) (i32.const 0))
  (global (;42;) (mut i32) (i32.const 0))
  (global (;43;) (mut i32) (i32.const 0))
  (global (;44;) (mut i32) (i32.const 0))
  (global (;45;) (mut i32) (i32.const 0))
  (global (;46;) (mut i32) (i32.const 0))
  (global (;47;) (mut i32) (i32.const 0))
  (global (;48;) (mut i32) (i32.const 0))
  (global (;49;) (mut i32) (i32.const 0))
  (global (;50;) (mut i32) (i32.const 0))
  (global (;51;) (mut i32) (i32.const 0))
  (global (;52;) (mut i32) (i32.const 0))
  (global (;53;) (mut i32) (i32.const 0))
  (global (;54;) (mut i32) (i32.const 0))
  (global (;55;) (mut i32) (i32.const 0))
  (global (;56;) (mut i32) (i32.const 0))
  (global (;57;) (mut i32) (i32.const 0))
  (global (;58;) (mut i32) (i32.const 0))
  (global (;59;) (mut i32) (i32.const 0))
  (global (;60;) (mut i32) (i32.const 0))
  (global (;61;) (mut i32) (i32.const 0))
  (global (;62;) (mut i32) (i32.const 0))
  (global (;63;) (mut i32) (i32.const 0))
  (global (;64;) (mut i32) (i32.const 0))
  (global (;65;) (mut i32) (i32.const 0))
  (global (;66;) (mut i32) (i32.const 0))
  (global (;67;) (mut i32) (i32.const 0))
  (global (;68;) (mut i32) (i32.const 0))
  (global (;69;) (mut i32) (i32.const 0))
  (global (;70;) (mut i32) (i32.const 0))
  (global (;71;) (mut f32) (f32.const 0x0p+0 (;=0;)))
  (global (;72;) (mut i32) (i32.const 0))
  (global (;73;) (mut i32) (i32.const 0))
  (global (;74;) (mut i32) (i32.const 0))
  (global (;75;) (mut i32) (i32.const 0))
  (global (;76;) (mut i32) (i32.const 0))
  (global (;77;) (mut i32) (i32.const 0))
  (global (;78;) (mut i32) (i32.const 0))
  (global (;79;) (mut i32) (i32.const 0))
  (global (;80;) (mut i32) (i32.const 0))
  (global (;81;) (mut i32) (i32.const 0))
  (global (;82;) (mut i32) (i32.const 0))
  (global (;83;) (mut i32) (i32.const 0))
  (global (;84;) (mut i32) (i32.const 0))
  (global (;85;) (mut i32) (i32.const 0))
  (global (;86;) (mut i32) (i32.const 0))
  (global (;87;) (mut i32) (i32.const 0))
  (global (;88;) (mut i32) (i32.const 0))
  (global (;89;) (mut i32) (i32.const 0))
  (global (;90;) (mut i32) (i32.const 0))
  (global (;91;) (mut i32) (i32.const 0))
  (global (;92;) (mut i32) (i32.const 0))
  (global (;93;) (mut i32) (i32.const 0))
  (global (;94;) (mut i32) (i32.const 0))
  (global (;95;) (mut i32) (i32.const 0))
  (global (;96;) (mut i32) (i32.const 0))
  (global (;97;) (mut i32) (i32.const 0))
  (global (;98;) (mut i32) (i32.const 0))
  (global (;99;) (mut i32) (i32.const 0))
  (global (;100;) (mut i32) (i32.const 0))
  (global (;101;) (mut i32) (i32.const 0))
  (global (;102;) (mut i32) (i32.const 0))
  (global (;103;) (mut i32) (i32.const 0))
  (global (;104;) (mut i32) (i32.const 0))
  (global (;105;) (mut i32) (i32.const 0))
  (global (;106;) (mut i32) (i32.const 0))
  (global (;107;) (mut i32) (i32.const 0))
  (global (;108;) (mut i32) (i32.const 0))
  (global (;109;) (mut i32) (i32.const 0))
  (global (;110;) (mut i32) (i32.const 0))
  (global (;111;) (mut i32) (i32.const 0))
  (global (;112;) (mut i32) (i32.const 0))
  (global (;113;) (mut i32) (i32.const 0))
  (global (;114;) (mut i32) (i32.const 0))
  (global (;115;) (mut i32) (i32.const 0))
  (global (;116;) (mut i32) (i32.const 0))
  (global (;117;) (mut i32) (i32.const 0))
  (global (;118;) (mut i32) (i32.const 0))
  (global (;119;) (mut i32) (i32.const 0))
  (global (;120;) (mut i32) (i32.const 0))
  (global (;121;) (mut i32) (i32.const 0))
  (global (;122;) (mut i32) (i32.const 0))
  (global (;123;) (mut i32) (i32.const 0))
  (global (;124;) (mut i32) (i32.const 0))
  (global (;125;) (mut i32) (i32.const 0))
  (global (;126;) (mut i32) (i32.const 0))
  (global (;127;) (mut i32) (i32.const 0))
  (global (;128;) (mut i32) (i32.const 0))
  (global (;129;) (mut i32) (i32.const 0))
  (global (;130;) (mut i32) (i32.const 0))
  (global (;131;) (mut i32) (i32.const 0))
  (global (;132;) (mut i32) (i32.const 0))
  (global (;133;) (mut i32) (i32.const 0))
  (global (;134;) (mut i32) (i32.const 0))
  (global (;135;) (mut i32) (i32.const 0))
  (global (;136;) (mut i32) (i32.const 0))
  (global (;137;) (mut i32) (i32.const 0))
  (global (;138;) (mut i32) (i32.const 0))
  (global (;139;) (mut i32) (i32.const 0))
  (global (;140;) (mut i32) (i32.const 0))
  (global (;141;) (mut i32) (i32.const 0))
  (global (;142;) (mut i32) (i32.const 0))
  (global (;143;) (mut i32) (i32.const 0))
  (global (;144;) (mut i32) (i32.const 0))
  (global (;145;) (mut i32) (i32.const 0))
  (global (;146;) (mut i32) (i32.const 0))
  (global (;147;) (mut f32) (f32.const 0x0p+0 (;=0;)))
  (global (;148;) (mut i32) (i32.const 0))
  (export "memory" (memory 0))
  (export "MenuBack" (global 12))
  (export "MenuText" (global 13))
  (export "Menu173" (global 14))
  (export "QuickLoadIcon" (global 15))
  (export "RandomSeed" (global 16))
  (export "MenuStr" (global 17))
  (export "MenuStrX" (global 18))
  (export "MenuStrY" (global 19))
  (export "MainMenuTab" (global 20))
  (export "IntroEnabled" (global 21))
  (export "SelectedInputBox" (global 22))
  (export "SavePath" (global 23))
  (export "SaveMSG" (global 24))
  (export "CurrSave" (global 25))
  (export "SaveGameAmount" (global 26))
  (export "SavedMapsAmount" (global 27))
  (export "SelectedMap" (global 28))
  (export "CurrLoadGamePage" (global 29))
  (export "QuickLoadPercent" (global 30))
  (export "QuickLoadPercent_DisplayTimer" (global 31))
  (export "QuickLoad_CurrEvent" (global 32))
  (export "OnSliderID" (global 33))
  (export "OnBar" (global 34))
  (export "ScrollBarY" (global 35))
  (export "ScrollMenuHeight" (global 36))
  (export "__Alloc" (func 395))
  (export "__StringAlloc" (func 396))
  (export "__StringConcat" (func 397))
  (export "readshort" (func 221))
  (export "peekbyte" (func 248))
  (export "DrawMapCreatorTooltip" (func 418))
  (export "DrawFrame" (func 405))
  (export "mousehit" (func 50))
  (export "DrawButton%" (func 406))
  (export "keydown" (func 201))
  (export "addvertex" (func 159))
  (export "giveachievement" (func 379))
  (export "atan" (func 347))
  (export "deletedevilemitters" (func 375))
  (export "flip" (func 151))
  (export "zlibwapi_open" (func 270))
  (export "algetnumsources" (func 288))
  (export "atan2" (func 348))
  (export "updatedecals" (func 378))
  (export "alsourceresume" (func 308))
  (export "line" (func 10))
  (export "pokebyte" (func 249))
  (export "mid" (func 329))
  (export "texturewidth" (func 85))
  (export "rnd" (func 353))
  (export "pokefloat" (func 253))
  (export "curveangle" (func 392))
  (export "entityroll" (func 106))
  (export "readdata" (func 232))
  (export "camerazoom" (func 64))
  (export "bin" (func 341))
  (export "fogdensity" (func 70))
  (export "readstring" (func 213))
  (export "createbrush" (func 74))
  (export "entitypitch" (func 104))
  (export "SlideBar#" (func 409))
  (export "writeint" (func 222))
  (export "freetexture" (func 87))
  (export "textureheight" (func 86))
  (export "Slider4" (func 421))
  (export "sendnetmsg" (func 239))
  (export "createmesh" (func 157))
  (export "findchild" (func 110))
  (export "rtrim" (func 337))
  (export "entityfx" (func 119))
  (export "brushfx" (func 79))
  (export "createcube" (func 71))
  (export "allistenersetdirection" (func 292))
  (export "allistenersetup" (func 293))
  (export "collisionnx" (func 187))
  (export "exp" (func 349))
  (export "alsourceispaused" (func 311))
  (export "readint" (func 211))
  (export "zlibwapi_close" (func 271))
  (export "graphics3d" (func 2))
  (export "mouseyspeed" (func 52))
  (export "allistenersetmastervolume" (func 295))
  (export "brushshininess" (func 77))
  (export "alsourceplay2d_" (func 304))
  (export "extractanimseq" (func 171))
  (export "positionentity" (func 93))
  (export "fogcolor" (func 68))
  (export "mod" (func 362))
  (export "InputBox$" (func 404))
  (export "asin" (func 345))
  (export "aleffectseteaxreverb" (func 323))
  (export "rotatetexture" (func 92))
  (export "entityz" (func 103))
  (export "mousey" (func 47))
  (export "fsound_close" (func 283))
  (export "trim" (func 335))
  (export "filepos" (func 229))
  (export "addcollisiontriangle" (func 267))
  (export "writefile" (func 208))
  (export "updateitems" (func 381))
  (export "addentity" (func 268))
  (export "updateparticles" (func 370))
  (export "DrawTick%" (func 408))
  (export "zlibwapi_extractfile" (func 274))
  (export "RowText2" (func 411))
  (export "DrawScrollBar#" (func 424))
  (export "hex" (func 340))
  (export "renderworld" (func 150))
  (export "point_direction" (func 197))
  (export "keyhit" (func 202))
  (export "alsourceisstopped" (func 312))
  (export "removeparticle" (func 371))
  (export "writestring" (func 224))
  (export "millisecs2" (func 148))
  (export "createlight" (func 58))
  (export "loopsound2" (func 144))
  (export "openmovie" (func 275))
  (export "freefont" (func 14))
  (export "changenpctextureid" (func 386))
  (export "runtimeerror" (func 146))
  (export "setfont" (func 13))
  (export "vertexcolor" (func 161))
  (export "rand" (func 354))
  (export "rotateentity" (func 94))
  (export "animseq" (func 173))
  (export "loadtexture" (func 152))
  (export "resizebank" (func 246))
  (export "pokeint" (func 251))
  (export "translateentity" (func 115))
  (export "ltrim" (func 336))
  (export "closetcpstream" (func 235))
  (export "getmeshsurfacecount" (func 258))
  (export "freesound_strict" (func 141))
  (export "setsurfacetexture" (func 264))
  (export "log" (func 350))
  (export "paintsurface" (func 84))
  (export "collisionnz" (func 189))
  (export "alsourceplay2d" (func 303))
  (export "getassetdata" (func 154))
  (export "entitytype" (func 178))
  (export "loadanimmesh" (func 166))
  (export "showpointer" (func 55))
  (export "cameraproject" (func 393))
  (export "filetype" (func 231))
  (export "debuglog" (func 145))
  (export "tformvector" (func 363))
  (export "countsurfaces" (func 164))
  (export "hideentity" (func 122))
  (export "len" (func 334))
  (export "fsound_init" (func 37))
  (export "dropitem" (func 383))
  (export "min" (func 356))
  (export "console_spawnnpc" (func 388))
  (export "DrawButton2%" (func 407))
  (export "pickitem" (func 382))
  (export "updateworld" (func 182))
  (export "animtime" (func 169))
  (export "fogmode" (func 67))
  (export "floattostring" (func 242))
  (export "writebyte" (func 225))
  (export "ChangeMenu_TestIMG" (func 419))
  (export "readavail" (func 238))
  (export "changeanglevalueforcorrectboneassigning" (func 390))
  (export "pickedy" (func 134))
  (export "createplane" (func 73))
  (export "getcolor" (func 7))
  (export "entityshininess" (func 118))
  (export "readbyte" (func 215))
  (export "moveentity" (func 96))
  (export "DrawOptionsTooltip" (func 417))
  (export "spriteviewmode" (func 114))
  (export "animating" (func 174))
  (export "showentity" (func 123))
  (export "camerarange" (func 63))
  (export "turnentity" (func 97))
  (export "clearcollisions" (func 177))
  (export "readline" (func 237))
  (export "alsourceplay3d_" (func 306))
  (export "resizeimage" (func 26))
  (export "Slider7" (func 423))
  (export "alcreatesource_" (func 299))
  (export "alsourcepause" (func 307))
  (export "alsourceseek" (func 316))
  (export "cos" (func 343))
  (export "resetentity" (func 181))
  (export "upper" (func 330))
  (export "lightrange" (func 61))
  (export "channelplaying" (func 36))
  (export "alsourcesetpitch" (func 314))
  (export "getsurfaceindexcount" (func 260))
  (export "seedrnd" (func 355))
  (export "sqr" (func 352))
  (export "text" (func 11))
  (export "clscolor" (func 5))
  (export "alfreeeffect" (func 322))
  (export "brushblend" (func 80))
  (export "copybank" (func 247))
  (export "scalesprite" (func 113))
  (export "drawmovie" (func 276))
  (export "countfps" (func 325))
  (export "performancestats" (func 326))
  (export "countcollisions" (func 183))
  (export "alinit" (func 284))
  (export "readfile" (func 207))
  (export "automidhandle" (func 23))
  (export "addtriangle" (func 160))
  (export "alsourceset3dposition" (func 319))
  (export "entitydistance" (func 107))
  (export "createcamera" (func 57))
  (export "acos" (func 346))
  (export "getsurface" (func 165))
  (export "freeentity" (func 100))
  (export "rInput$" (func 403))
  (export "entityyaw" (func 105))
  (export "RowText" (func 410))
  (export "entitybox" (func 180))
  (export "aligntovector" (func 391))
  (export "algetavailabledevicecount" (func 285))
  (export "collisionny" (func 188))
  (export "UpdateLauncher" (func 399))
  (export "loadfont" (func 12))
  (export "entityy" (func 102))
  (export "stringequal" (func 269))
  (export "linepick" (func 132))
  (export "entityparent" (func 121))
  (export "freesound" (func 31))
  (export "loadtempsound" (func 142))
  (export "alsourcestop" (func 309))
  (export "movieplaying" (func 277))
  (export "tformedz" (func 368))
  (export "replace" (func 332))
  (export "algetavailabledevicename" (func 286))
  (export "entityradius" (func 179))
  (export "aldestroy" (func 289))
  (export "tformedy" (func 367))
  (export "log10" (func 351))
  (export "printstring" (func 200))
  (export "loadimage_strict" (func 140))
  (export "peekshort" (func 254))
  (export "collisiontime" (func 193))
  (export "brushtexture" (func 78))
  (export "nameentity" (func 130))
  (export "alsourceplay_" (func 302))
  (export "tformedx" (func 366))
  (export "animate2" (func 385))
  (export "setsurfacelightmap" (func 265))
  (export "loadasset" (func 153))
  (export "alsourceplay" (func 301))
  (export "instr" (func 333))
  (export "seekfile" (func 228))
  (export "entitycolor" (func 117))
  (export "mousex" (func 46))
  (export "alcreatebuffer" (func 296))
  (export "fsound_stream_open" (func 278))
  (export "lower" (func 331))
  (export "loadtexture_strict" (func 138))
  (export "cameraclscolor" (func 62))
  (export "addanimseq" (func 172))
  (export "mousez" (func 48))
  (export "update294" (func 380))
  (export "collisionsurface" (func 191))
  (export "DrawQuickLoading" (func 416))
  (export "textureblend" (func 88))
  (export "collisiontriangle" (func 192))
  (export "sin" (func 342))
  (export "alsourcesetvolume" (func 313))
  (export "movemouse" (func 53))
  (export "readfloat" (func 212))
  (export "distance" (func 196))
  (export "pickedx" (func 133))
  (export "imagewidth" (func 19))
  (export "max" (func 357))
  (export "Button%" (func 425))
  (export "createconsolemsg" (func 389))
  (export "getassetsize" (func 155))
  (export "aldeviceinit" (func 287))
  (export "positiontexture" (func 91))
  (export "pickedz" (func 135))
  (export "brushalpha" (func 76))
  (export "mousedown" (func 49))
  (export "countchildren" (func 108))
  (export "entityalpha" (func 116))
  (export "brushcolor" (func 75))
  (export "loadimage" (func 15))
  (export "tformnormal" (func 365))
  (export "getparent" (func 111))
  (export "parsermesh" (func 257))
  (export "eof" (func 227))
  (export "loadmesh_strict" (func 136))
  (export "banksize" (func 245))
  (export "freeimage" (func 27))
  (export "curvevalue" (func 195))
  (export "addvertexextended" (func 263))
  (export "alfreesource" (func 300))
  (export "createdecal" (func 377))
  (export "drawimage" (func 16))
  (export "filesize" (func 230))
  (export "playsound_strict" (func 143))
  (export "createsprite" (func 112))
  (export "UpdateMainMenu" (func 398))
  (export "handleimage" (func 21))
  (export "Slider5" (func 422))
  (export "writefloat" (func 223))
  (export "midhandle" (func 22))
  (export "abs" (func 358))
  (export "createpivot" (func 99))
  (export "entitypick" (func 126))
  (export "animatenpc" (func 384))
  (export "DrawLoading" (func 402))
  (export "getsurfacevertexcount" (func 259))
  (export "paintmesh" (func 83))
  (export "imageheight" (func 20))
  (export "Main" (func 394))
  (export "alsourcesetrollofffactor" (func 320))
  (export "print" (func 0))
  (export "Slider3" (func 420))
  (export "vertextexcoords" (func 162))
  (export "tileimage" (func 18))
  (export "left" (func 327))
  (export "millisecs" (func 324))
  (export "checkfornpcinfacility" (func 387))
  (export "stopchannel" (func 33))
  (export "entitycollided" (func 128))
  (export "scaleimage" (func 25))
  (export "addcollisionvertex" (func 266))
  (export "loadanimmesh_strict" (func 137))
  (export "alsourcegetlenght" (func 318))
  (export "entityvisible" (func 124))
  (export "entityinview" (func 125))
  (export "setlistenerlocation" (func 45))
  (export "delay" (func 175))
  (export "LimitText%" (func 414))
  (export "oval" (func 9))
  (export "kill" (func 131))
  (export "ceil" (func 360))
  (export "getchild" (func 109))
  (export "allistenersetvelocity" (func 294))
  (export "createparticle" (func 369))
  (export "fsound_stream_play" (func 279))
  (export "sgn" (func 359))
  (export "pokeshort" (func 255))
  (export "getsurfaceverticesptr" (func 261))
  (export "opentcpstream" (func 234))
  (export "millicsecs" (func 56))
  (export "collisionz" (func 186))
  (export "alsourceisplaying" (func 310))
  (export "floor" (func 361))
  (export "zlibwapi_getfilecount" (func 272))
  (export "scaletexture" (func 90))
  (export "zlibwapi_getfilename" (func 273))
  (export "DrawTooltip" (func 415))
  (export "tformpoint" (func 364))
  (export "channelpaused" (func 35))
  (export "closefile" (func 210))
  (export "particletextures" (func 372))
  (export "writeshort" (func 226))
  (export "alsourcesetloop" (func 315))
  (export "stringconcat" (func 240))
  (export "restoredata" (func 233))
  (export "freebank" (func 244))
  (export "maskimage" (func 24))
  (export "drawblock" (func 17))
  (export "loadsound_strict" (func 139))
  (export "fsound_setvolume" (func 280))
  (export "cameraprojmode" (func 65))
  (export "createbank" (func 243))
  (export "animate" (func 167))
  (export "collisionentity" (func 190))
  (export "GetLineAmount" (func 412))
  (export "color" (func 6))
  (export "createsphere" (func 72))
  (export "updatenormals" (func 163))
  (export "ambientlight" (func 59))
  (export "hidepointer" (func 54))
  (export "cls" (func 3))
  (export "collisiony" (func 185))
  (export "animlength" (func 170))
  (export "updateemitters" (func 374))
  (export "writeline" (func 236))
  (export "copyentity" (func 129))
  (export "loadsound" (func 32))
  (export "paintentity" (func 82))
  (export "parseb3d" (func 256))
  (export "allistenersetposition" (func 291))
  (export "mousexspeed" (func 51))
  (export "cameraviewport" (func 66))
  (export "setanimtime" (func 168))
  (export "entitytexture" (func 98))
  (export "inttostring" (func 241))
  (export "entityx" (func 101))
  (export "playsound" (func 30))
  (export "getsurfaceindicesptr" (func 262))
  (export "fsound_setpaused" (func 281))
  (export "alcreatesource" (func 298))
  (export "channelvolume" (func 34))
  (export "alfreebuffer" (func 297))
  (export "entityblend" (func 120))
  (export "peekfloat" (func 252))
  (export "collisions" (func 176))
  (export "collisionx" (func 184))
  (export "asc" (func 338))
  (export "alsourcegetaudiotime" (func 317))
  (export "entitypickmode" (func 127))
  (export "texturecoords" (func 89))
  (export "alsourceplay3d" (func 305))
  (export "peekint" (func 250))
  (export "alupdate" (func 290))
  (export "chr" (func 339))
  (export "updatedevilemitters" (func 376))
  (export "loadmesh" (func 156))
  (export "fsound_stream_stop" (func 282))
  (export "DrawTiledImageRect" (func 400))
  (export "createsurface" (func 158))
  (export "scaleentity" (func 95))
  (export "sound3d" (func 44))
  (export "alcreateeffect" (func 321))
  (export "catcherrors" (func 147))
  (export "GetLineAmount2" (func 413))
  (export "setemitter" (func 373))
  (export "freebrush" (func 81))
  (export "printint" (func 0))
  (export "lightcolor" (func 60))
  (export "rect" (func 8))
  (export "openfile" (func 209))
  (export "tan" (func 344))
  (export "right" (func 328))
  (export "currentdate" (func 149))
  (export "fogrange" (func 69))
  (export "InitLoadingScreens" (func 401))
  (export "wrapangle" (func 194))
  (data (;0;) (i32.const 256) "\01\00\00\00\16\00\00\00GFX\5cmenu\5cmenuwhite.jpg\00")
  (data (;1;) (i32.const 287) "\01\00\00\00\16\00\00\00GFX\5cmenu\5cmenublack.jpg\00")
  (data (;2;) (i32.const 318) "\01\00\00\00\12\00\00\00GFX\5cmenu\5carrow.png\00")
  (data (;3;) (i32.const 345) "\01\00\00\00\0b\00\00\00DON'T BLINK\00")
  (data (;4;) (i32.const 365) "\01\00\00\00\19\00\00\00Secure. Contain. Protect.\00")
  (data (;5;) (i32.const 399) "\01\00\00\00!\00\00\00You want happy endings? Fuck you.\00")
  (data (;6;) (i32.const 441) "\01\00\00\00+\00\00\00Sometimes we would have had time to scream.\00")
  (data (;7;) (i32.const 493) "\01\00\00\00\03\00\00\00NIL\00")
  (data (;8;) (i32.const 505) "\01\00\00\00\02\00\00\00NO\00")
  (data (;9;) (i32.const 516) "\01\00\00\00(\00\00\00black white black white black white gray\00")
  (data (;10;) (i32.const 565) "\01\00\00\00\13\00\00\00Stone does not care\00")
  (data (;11;) (i32.const 593) "\01\00\00\00\04\00\00\009341\00")
  (data (;12;) (i32.const 606) "\01\00\00\00\15\00\00\00It controls the doors\00")
  (data (;13;) (i32.const 636) "\01\00\00\00\19\00\00\00e8m106]af173o+079m895w914\00")
  (data (;14;) (i32.const 670) "\01\00\00\00\1c\00\00\00It has taken over everything\00")
  (data (;15;) (i32.const 707) "\01\00\00\00\15\00\00\00The spiral is growing\00")
  (data (;16;) (i32.const 737) "\01\00\00\00:\00\00\00Some kind of gestalt effect due to massive reality damage.\00")
  (data (;17;) (i32.const 804) "\01\00\00\00\08\00\00\00NEW GAME\00")
  (data (;18;) (i32.const 821) "\01\00\00\00\00\00\00\00\00")
  (data (;19;) (i32.const 830) "\01\00\00\00\03\00\00\00NIL\00")
  (data (;20;) (i32.const 842) "\01\00\00\00\02\00\00\00NO\00")
  (data (;21;) (i32.const 853) "\01\00\00\00\05\00\00\00d9341\00")
  (data (;22;) (i32.const 867) "\01\00\00\00\07\00\00\005CP_I73\00")
  (data (;23;) (i32.const 883) "\01\00\00\00\09\00\00\00DONTBLINK\00")
  (data (;24;) (i32.const 901) "\01\00\00\00\06\00\00\00CRUNCH\00")
  (data (;25;) (i32.const 916) "\01\00\00\00\03\00\00\00die\00")
  (data (;26;) (i32.const 928) "\01\00\00\00\05\00\00\00HTAED\00")
  (data (;27;) (i32.const 942) "\01\00\00\00\0a\00\00\00rustledjim\00")
  (data (;28;) (i32.const 961) "\01\00\00\00\05\00\00\00larry\00")
  (data (;29;) (i32.const 975) "\01\00\00\00\05\00\00\00JORGE\00")
  (data (;30;) (i32.const 989) "\01\00\00\00\0a\00\00\00dirtymetal\00")
  (data (;31;) (i32.const 1008) "\01\00\00\00\0b\00\00\00whatpumpkin\00")
  (data (;32;) (i32.const 1028) "\01\00\00\00\09\00\00\00LOAD GAME\00")
  (data (;33;) (i32.const 1046) "\01\00\00\00\07\00\00\00OPTIONS\00")
  (data (;34;) (i32.const 1062) "\01\00\00\00\04\00\00\00QUIT\00")
  (data (;35;) (i32.const 1075) "\01\00\00\00\04\00\00\00BACK\00")
  (data (;36;) (i32.const 1088) "\01\00\00\00\07\00\00\00options\00")
  (data (;37;) (i32.const 1104) "\01\00\00\00\0d\00\00\00intro enabled\00")
  (data (;38;) (i32.const 1126) "\01\00\00\00\08\00\00\00NEW GAME\00")
  (data (;39;) (i32.const 1143) "\01\00\00\00\05\00\00\00Name:\00")
  (data (;40;) (i32.const 1157) "\01\00\00\00\01\00\00\00:\00")
  (data (;41;) (i32.const 1167) "\01\00\00\00\00\00\00\00\00")
  (data (;42;) (i32.const 1176) "\01\00\00\00\01\00\00\00.\00")
  (data (;43;) (i32.const 1186) "\01\00\00\00\00\00\00\00\00")
  (data (;44;) (i32.const 1195) "\01\00\00\00\01\00\00\00/\00")
  (data (;45;) (i32.const 1205) "\01\00\00\00\00\00\00\00\00")
  (data (;46;) (i32.const 1214) "\01\00\00\00\01\00\00\00\5c\00")
  (data (;47;) (i32.const 1224) "\01\00\00\00\00\00\00\00\00")
  (data (;48;) (i32.const 1233) "\01\00\00\00\01\00\00\00<\00")
  (data (;49;) (i32.const 1243) "\01\00\00\00\00\00\00\00\00")
  (data (;50;) (i32.const 1252) "\01\00\00\00\01\00\00\00>\00")
  (data (;51;) (i32.const 1262) "\01\00\00\00\00\00\00\00\00")
  (data (;52;) (i32.const 1271) "\01\00\00\00\01\00\00\00|\00")
  (data (;53;) (i32.const 1281) "\01\00\00\00\00\00\00\00\00")
  (data (;54;) (i32.const 1290) "\01\00\00\00\01\00\00\00?\00")
  (data (;55;) (i32.const 1300) "\01\00\00\00\00\00\00\00\00")
  (data (;56;) (i32.const 1309) "\01\00\00\00\00\00\00\00\00")
  (data (;57;) (i32.const 1318) "\01\00\00\00\01\00\00\00*\00")
  (data (;58;) (i32.const 1328) "\01\00\00\00\00\00\00\00\00")
  (data (;59;) (i32.const 1337) "\01\00\00\00\00\00\00\00\00")
  (data (;60;) (i32.const 1346) "\01\00\00\00\09\00\00\00Map seed:\00")
  (data (;61;) (i32.const 1364) "\01\00\00\00\0d\00\00\00Selected map:\00")
  (data (;62;) (i32.const 1386) "\01\00\00\00\03\00\00\00...\00")
  (data (;63;) (i32.const 1398) "\01\00\00\00\08\00\00\00Deselect\00")
  (data (;64;) (i32.const 1415) "\01\00\00\00\00\00\00\00\00")
  (data (;65;) (i32.const 1424) "\01\00\00\00\16\00\00\00Enable intro sequence:\00")
  (data (;66;) (i32.const 1455) "\01\00\00\00\0b\00\00\00Difficulty:\00")
  (data (;67;) (i32.const 1475) "\01\00\00\00\0a\00\00\00Permadeath\00")
  (data (;68;) (i32.const 1494) "\01\00\00\00\0d\00\00\00Save anywhere\00")
  (data (;69;) (i32.const 1516) "\01\00\00\00\0f\00\00\00Aggressive NPCs\00")
  (data (;70;) (i32.const 1540) "\01\00\00\00\1e\00\00\00Other difficulty factors: Easy\00")
  (data (;71;) (i32.const 1579) "\01\00\00\00 \00\00\00Other difficulty factors: Normal\00")
  (data (;72;) (i32.const 1620) "\01\00\00\00\1e\00\00\00Other difficulty factors: Hard\00")
  (data (;73;) (i32.const 1659) "\01\00\00\00\08\00\00\00Load map\00")
  (data (;74;) (i32.const 1676) "\01\00\00\00\05\00\00\00START\00")
  (data (;75;) (i32.const 1690) "\01\00\00\00\00\00\00\00\00")
  (data (;76;) (i32.const 1699) "\01\00\00\00\08\00\00\00untitled\00")
  (data (;77;) (i32.const 1716) "\01\00\00\00\00\00\00\00\00")
  (data (;78;) (i32.const 1725) "\01\00\00\00\02\00\00\00 (\00")
  (data (;79;) (i32.const 1736) "\01\00\00\00\01\00\00\00)\00")
  (data (;80;) (i32.const 1746) "\01\00\00\00\07\00\00\00options\00")
  (data (;81;) (i32.const 1762) "\01\00\00\00\0d\00\00\00intro enabled\00")
  (data (;82;) (i32.const 1784) "\01\00\00\00\09\00\00\00LOAD GAME\00")
  (data (;83;) (i32.const 1802) "\01\00\00\00\00\00\00\00\00")
  (data (;84;) (i32.const 1811) "\01\00\00\00\01\00\00\00>\00")
  (data (;85;) (i32.const 1821) "\01\00\00\00\01\00\00\00>\00")
  (data (;86;) (i32.const 1831) "\01\00\00\00\00\00\00\00\00")
  (data (;87;) (i32.const 1840) "\01\00\00\00\01\00\00\00<\00")
  (data (;88;) (i32.const 1850) "\01\00\00\00\01\00\00\00<\00")
  (data (;89;) (i32.const 1860) "\01\00\00\00\05\00\00\00Page \00")
  (data (;90;) (i32.const 1874) "\01\00\00\00\01\00\00\00/\00")
  (data (;91;) (i32.const 1884) "\01\00\00\00\0f\00\00\00No saved games.\00")
  (data (;92;) (i32.const 1908) "\01\00\00\00\06\00\00\001.3.10\00")
  (data (;93;) (i32.const 1923) "\01\00\00\00\00\00\00\00\00")
  (data (;94;) (i32.const 1932) "\01\00\00\00\06\00\00\001.3.10\00")
  (data (;95;) (i32.const 1947) "\01\00\00\00\04\00\00\00Load\00")
  (data (;96;) (i32.const 1960) "\01\00\00\00\04\00\00\00Load\00")
  (data (;97;) (i32.const 1973) "\01\00\00\00\01\00\00\00\5c\00")
  (data (;98;) (i32.const 1983) "\01\00\00\00\06\00\00\00Delete\00")
  (data (;99;) (i32.const 1998) "\01\00\00\00\06\00\00\001.3.10\00")
  (data (;100;) (i32.const 2013) "\01\00\00\00\04\00\00\00Load\00")
  (data (;101;) (i32.const 2026) "\01\00\00\00\06\00\00\00Delete\00")
  (data (;102;) (i32.const 2041) "\01\00\00\00\00\00\00\00\00")
  (data (;103;) (i32.const 2050) "\01\00\00\00*\00\00\00Are you sure you want to delete this save?\00")
  (data (;104;) (i32.const 2101) "\01\00\00\00\03\00\00\00Yes\00")
  (data (;105;) (i32.const 2113) "\01\00\00\00\09\00\00\00\5csave.txt\00")
  (data (;106;) (i32.const 2131) "\01\00\00\00\00\00\00\00\00")
  (data (;107;) (i32.const 2140) "\01\00\00\00\02\00\00\00No\00")
  (data (;108;) (i32.const 2151) "\01\00\00\00\00\00\00\00\00")
  (data (;109;) (i32.const 2160) "\01\00\00\00\07\00\00\00OPTIONS\00")
  (data (;110;) (i32.const 2176) "\01\00\00\00\08\00\00\00GRAPHICS\00")
  (data (;111;) (i32.const 2193) "\01\00\00\00\05\00\00\00AUDIO\00")
  (data (;112;) (i32.const 2207) "\01\00\00\00\08\00\00\00CONTROLS\00")
  (data (;113;) (i32.const 2224) "\01\00\00\00\08\00\00\00ADVANCED\00")
  (data (;114;) (i32.const 2241) "\01\00\00\00\14\00\00\00Enable bump mapping:\00")
  (data (;115;) (i32.const 2270) "\01\00\00\00\04\00\00\00bump\00")
  (data (;116;) (i32.const 2283) "\01\00\00\00\06\00\00\00VSync:\00")
  (data (;117;) (i32.const 2298) "\01\00\00\00\05\00\00\00vsync\00")
  (data (;118;) (i32.const 2312) "\01\00\00\00\0e\00\00\00Anti-aliasing:\00")
  (data (;119;) (i32.const 2335) "\01\00\00\00\09\00\00\00antialias\00")
  (data (;120;) (i32.const 2353) "\01\00\00\00\13\00\00\00Enable room lights:\00")
  (data (;121;) (i32.const 2381) "\01\00\00\00\0a\00\00\00roomlights\00")
  (data (;122;) (i32.const 2400) "\01\00\00\00\0c\00\00\00Screen gamma\00")
  (data (;123;) (i32.const 2421) "\01\00\00\00\05\00\00\00gamma\00")
  (data (;124;) (i32.const 2435) "\01\00\00\00\10\00\00\00Particle amount:\00")
  (data (;125;) (i32.const 2460) "\01\00\00\00\07\00\00\00MINIMAL\00")
  (data (;126;) (i32.const 2476) "\01\00\00\00\07\00\00\00REDUCED\00")
  (data (;127;) (i32.const 2492) "\01\00\00\00\04\00\00\00FULL\00")
  (data (;128;) (i32.const 2505) "\01\00\00\00\0e\00\00\00particleamount\00")
  (data (;129;) (i32.const 2528) "\01\00\00\00\11\00\00\00Texture LOD Bias:\00")
  (data (;130;) (i32.const 2554) "\01\00\00\00\03\00\00\000.8\00")
  (data (;131;) (i32.const 2566) "\01\00\00\00\03\00\00\000.4\00")
  (data (;132;) (i32.const 2578) "\01\00\00\00\03\00\00\000.0\00")
  (data (;133;) (i32.const 2590) "\01\00\00\00\04\00\00\00-0.4\00")
  (data (;134;) (i32.const 2603) "\01\00\00\00\04\00\00\00-0.8\00")
  (data (;135;) (i32.const 2616) "\01\00\00\00\0a\00\00\00texquality\00")
  (data (;136;) (i32.const 2635) "\01\00\00\00\1a\00\00\00Save textures in the VRAM:\00")
  (data (;137;) (i32.const 2670) "\01\00\00\00\04\00\00\00vram\00")
  (data (;138;) (i32.const 2683) "\01\00\00\00\09\00\00\00Show HUD:\00")
  (data (;139;) (i32.const 2701) "\01\00\00\00\03\00\00\00hud\00")
  (data (;140;) (i32.const 2713) "\01\00\00\00\0f\00\00\00Enable console:\00")
  (data (;141;) (i32.const 2737) "\01\00\00\00\0d\00\00\00consoleenable\00")
  (data (;142;) (i32.const 2759) "\01\00\00\00\16\00\00\00Open console on error:\00")
  (data (;143;) (i32.const 2790) "\01\00\00\00\0c\00\00\00consoleerror\00")
  (data (;144;) (i32.const 2811) "\01\00\00\00\13\00\00\00Achievement popups:\00")
  (data (;145;) (i32.const 2839) "\01\00\00\00\08\00\00\00achpopup\00")
  (data (;146;) (i32.const 2856) "\01\00\00\00\09\00\00\00Show FPS:\00")
  (data (;147;) (i32.const 2874) "\01\00\00\00\07\00\00\00showfps\00")
  (data (;148;) (i32.const 2890) "\01\00\00\00\0b\00\00\00Framelimit:\00")
  (data (;149;) (i32.const 2910) "\01\00\00\00\04\00\00\00 FPS\00")
  (data (;150;) (i32.const 2923) "\01\00\00\00\0a\00\00\00framelimit\00")
  (data (;151;) (i32.const 2942) "\01\00\00\00\0a\00\00\00framelimit\00")
  (data (;152;) (i32.const 2961) "\01\00\00\00\11\00\00\00Antialiased text:\00")
  (data (;153;) (i32.const 2987) "\01\00\00\00\1d\00\00\00GFX\5cfont\5ccour\5cCourier New.ttf\00")
  (data (;154;) (i32.const 3025) "\01\00\00\00\1f\00\00\00GFX\5cfont\5ccourbd\5cCourier New.ttf\00")
  (data (;155;) (i32.const 3065) "\01\00\00\00\1f\00\00\00GFX\5cfont\5cDS-DIGI\5cDS-Digital.ttf\00")
  (data (;156;) (i32.const 3105) "\01\00\00\00\1f\00\00\00GFX\5cfont\5cDS-DIGI\5cDS-Digital.ttf\00")
  (data (;157;) (i32.const 3145) "\01\00\00\00\1c\00\00\00GFX\5cfont\5cJournal\5cJournal.ttf\00")
  (data (;158;) (i32.const 3182) "\01\00\00\00\05\00\00\00Blitz\00")
  (data (;159;) (i32.const 3196) "\01\00\00\00\0d\00\00\00antialiastext\00")
  (data (;160;) (i32.const 3218) "\01\00\00\00\12\00\00\00Mouse sensitivity:\00")
  (data (;161;) (i32.const 3245) "\01\00\00\00\10\00\00\00mousesensitivity\00")
  (data (;162;) (i32.const 3270) "\01\00\00\00\14\00\00\00Invert mouse Y-axis:\00")
  (data (;163;) (i32.const 3299) "\01\00\00\00\0b\00\00\00mouseinvert\00")
  (data (;164;) (i32.const 3319) "\01\00\00\00\10\00\00\00Mouse smoothing:\00")
  (data (;165;) (i32.const 3344) "\01\00\00\00\0e\00\00\00mousesmoothing\00")
  (data (;166;) (i32.const 3367) "\01\00\00\00\16\00\00\00Control configuration:\00")
  (data (;167;) (i32.const 3398) "\01\00\00\00\0c\00\00\00Move Forward\00")
  (data (;168;) (i32.const 3419) "\01\00\00\00\0b\00\00\00Strafe Left\00")
  (data (;169;) (i32.const 3439) "\01\00\00\00\0d\00\00\00Move Backward\00")
  (data (;170;) (i32.const 3461) "\01\00\00\00\0c\00\00\00Strafe Right\00")
  (data (;171;) (i32.const 3482) "\01\00\00\00\0a\00\00\00Quick Save\00")
  (data (;172;) (i32.const 3501) "\01\00\00\00\0c\00\00\00Manual Blink\00")
  (data (;173;) (i32.const 3522) "\01\00\00\00\06\00\00\00Sprint\00")
  (data (;174;) (i32.const 3537) "\01\00\00\00\14\00\00\00Open/Close Inventory\00")
  (data (;175;) (i32.const 3566) "\01\00\00\00\06\00\00\00Crouch\00")
  (data (;176;) (i32.const 3581) "\01\00\00\00\12\00\00\00Open/Close Console\00")
  (data (;177;) (i32.const 3608) "\01\00\00\00\08\00\00\00controls\00")
  (data (;178;) (i32.const 3625) "\01\00\00\00\0d\00\00\00Music volume:\00")
  (data (;179;) (i32.const 3647) "\01\00\00\00\08\00\00\00musicvol\00")
  (data (;180;) (i32.const 3664) "\01\00\00\00\0d\00\00\00Sound volume:\00")
  (data (;181;) (i32.const 3686) "\01\00\00\00\08\00\00\00soundvol\00")
  (data (;182;) (i32.const 3703) "\01\00\00\00\13\00\00\00Sound auto-release:\00")
  (data (;183;) (i32.const 3731) "\01\00\00\00\0e\00\00\00sfxautorelease\00")
  (data (;184;) (i32.const 3754) "\01\00\00\00\13\00\00\00Enable user tracks:\00")
  (data (;185;) (i32.const 3782) "\01\00\00\00\09\00\00\00usertrack\00")
  (data (;186;) (i32.const 3800) "\01\00\00\00\10\00\00\00User track mode:\00")
  (data (;187;) (i32.const 3825) "\01\00\00\00\06\00\00\00Repeat\00")
  (data (;188;) (i32.const 3840) "\01\00\00\00\06\00\00\00Random\00")
  (data (;189;) (i32.const 3855) "\01\00\00\00\0d\00\00\00usertrackmode\00")
  (data (;190;) (i32.const 3877) "\01\00\00\00\14\00\00\00Scan for User Tracks\00")
  (data (;191;) (i32.const 3906) "\01\00\00\00\19\00\00\00User Tracks Check Started\00")
  (data (;192;) (i32.const 3940) "\01\00\00\00\15\00\00\00SFX\5cRadio\5cUserTracks\5c\00")
  (data (;193;) (i32.const 3970) "\01\00\00\00\00\00\00\00\00")
  (data (;194;) (i32.const 3979) "\01\00\00\00\15\00\00\00SFX\5cRadio\5cUserTracks\5c\00")
  (data (;195;) (i32.const 4009) "\01\00\00\00\15\00\00\00SFX\5cRadio\5cUserTracks\5c\00")
  (data (;196;) (i32.const 4039) "\01\00\00\00\17\00\00\00User Tracks Check Ended\00")
  (data (;197;) (i32.const 4071) "\01\00\00\00\0d\00\00\00usertrackscan\00")
  (data (;198;) (i32.const 4093) "\01\00\00\00\13\00\00\00User tracks found (\00")
  (data (;199;) (i32.const 4121) "\01\00\00\00\01\00\00\00/\00")
  (data (;200;) (i32.const 4131) "\01\00\00\00\15\00\00\00 successfully loaded)\00")
  (data (;201;) (i32.const 4161) "\01\00\00\00\08\00\00\00LOAD MAP\00")
  (data (;202;) (i32.const 4178) "\01\00\00\00\01\00\00\00>\00")
  (data (;203;) (i32.const 4188) "\01\00\00\00\01\00\00\00>\00")
  (data (;204;) (i32.const 4198) "\01\00\00\00\01\00\00\00<\00")
  (data (;205;) (i32.const 4208) "\01\00\00\00\01\00\00\00<\00")
  (data (;206;) (i32.const 4218) "\01\00\00\00\05\00\00\00Page \00")
  (data (;207;) (i32.const 4232) "\01\00\00\00\01\00\00\00/\00")
  (data (;208;) (i32.const 4242) "\01\00\00\00\00\00\00\00\00")
  (data (;209;) (i32.const 4251) "\01\00\00\006\00\00\00No saved maps. Use the Map Creator to create new maps.\00")
  (data (;210;) (i32.const 4314) "\01\00\00\00\04\00\00\00Load\00")
  (data (;211;) (i32.const 4327) "\01\00\00\00\01\00\00\00v\00")
  (data (;212;) (i32.const 4337) "\01\00\00\00\1d\00\00\00GFX\5cfont\5ccour\5cCourier New.ttf\00")
  (data (;213;) (i32.const 4375) "\01\00\00\00\16\00\00\00GFX\5cmenu\5cmenuwhite.jpg\00")
  (data (;214;) (i32.const 4406) "\01\00\00\00\16\00\00\00GFX\5cmenu\5cmenublack.jpg\00")
  (data (;215;) (i32.const 4437) "\01\00\00\00\15\00\00\00GFX\5cmenu\5clauncher.jpg\00")
  (data (;216;) (i32.const 4467) "\01\00\00\00\17\00\00\00SFX\5cInteract\5cButton.ogg\00")
  (data (;217;) (i32.const 4499) "\01\00\00\00\12\00\00\00GFX\5cmenu\5carrow.png\00")
  (data (;218;) (i32.const 4526) "\01\00\00\00\12\00\00\00GFX\5cblinkmeter.jpg\00")
  (data (;219;) (i32.const 4553) "\01\00\00\00!\00\00\00SCP - Containment Breach Launcher\00")
  (data (;220;) (i32.const 4595) "\01\00\00\00\0c\00\00\00Resolution: \00")
  (data (;221;) (i32.const 4616) "\01\00\00\00\01\00\00\00x\00")
  (data (;222;) (i32.const 4626) "\01\00\00\00\09\00\00\00Graphics:\00")
  (data (;223;) (i32.const 4644) "\01\00\00\00\0a\00\00\00Fullscreen\00")
  (data (;224;) (i32.const 4663) "\01\00\00\00\0a\00\00\00Borderless\00")
  (data (;225;) (i32.const 4682) "\01\00\00\00\0d\00\00\00windowed mode\00")
  (data (;226;) (i32.const 4704) "\01\00\00\00\06\00\00\0016 Bit\00")
  (data (;227;) (i32.const 4719) "\01\00\00\00\0c\00\00\00Use launcher\00")
  (data (;228;) (i32.const 4740) "\01\00\00\00\14\00\00\00Current Resolution: \00")
  (data (;229;) (i32.const 4769) "\01\00\00\00\01\00\00\00x\00")
  (data (;230;) (i32.const 4779) "\01\00\00\00\01\00\00\00,\00")
  (data (;231;) (i32.const 4789) "\01\00\00\00\14\00\00\00Current Resolution: \00")
  (data (;232;) (i32.const 4818) "\01\00\00\00\01\00\00\00x\00")
  (data (;233;) (i32.const 4828) "\01\00\00\00\03\00\00\00,32\00")
  (data (;234;) (i32.const 4840) "\01\00\00\00\14\00\00\00Current Resolution: \00")
  (data (;235;) (i32.const 4869) "\01\00\00\00\01\00\00\00x\00")
  (data (;236;) (i32.const 4879) "\01\00\00\00\03\00\00\00,32\00")
  (data (;237;) (i32.const 4891) "\01\00\00\00\0c\00\00\00(upscaled to\00")
  (data (;238;) (i32.const 4912) "\01\00\00\00\01\00\00\00x\00")
  (data (;239;) (i32.const 4922) "\01\00\00\00\04\00\00\00,32)\00")
  (data (;240;) (i32.const 4935) "\01\00\00\00\0e\00\00\00(downscaled to\00")
  (data (;241;) (i32.const 4958) "\01\00\00\00\01\00\00\00x\00")
  (data (;242;) (i32.const 4968) "\01\00\00\00\04\00\00\00,32)\00")
  (data (;243;) (i32.const 4981) "\01\00\00\00\09\00\00\00Check for\00")
  (data (;244;) (i32.const 4999) "\01\00\00\00\0a\00\00\00updates on\00")
  (data (;245;) (i32.const 5018) "\01\00\00\00\06\00\00\00launch\00")
  (data (;246;) (i32.const 5033) "\01\00\00\00\06\00\00\00LAUNCH\00")
  (data (;247;) (i32.const 5048) "\01\00\00\00\04\00\00\00EXIT\00")
  (data (;248;) (i32.const 5061) "\01\00\00\00\07\00\00\00options\00")
  (data (;249;) (i32.const 5077) "\01\00\00\00\05\00\00\00width\00")
  (data (;250;) (i32.const 5091) "\01\00\00\00\07\00\00\00options\00")
  (data (;251;) (i32.const 5107) "\01\00\00\00\06\00\00\00height\00")
  (data (;252;) (i32.const 5122) "\01\00\00\00\07\00\00\00options\00")
  (data (;253;) (i32.const 5138) "\01\00\00\00\0a\00\00\00fullscreen\00")
  (data (;254;) (i32.const 5157) "\01\00\00\00\04\00\00\00true\00")
  (data (;255;) (i32.const 5170) "\01\00\00\00\07\00\00\00options\00")
  (data (;256;) (i32.const 5186) "\01\00\00\00\0a\00\00\00fullscreen\00")
  (data (;257;) (i32.const 5205) "\01\00\00\00\05\00\00\00false\00")
  (data (;258;) (i32.const 5219) "\01\00\00\00\08\00\00\00launcher\00")
  (data (;259;) (i32.const 5236) "\01\00\00\00\10\00\00\00launcher enabled\00")
  (data (;260;) (i32.const 5261) "\01\00\00\00\04\00\00\00true\00")
  (data (;261;) (i32.const 5274) "\01\00\00\00\08\00\00\00launcher\00")
  (data (;262;) (i32.const 5291) "\01\00\00\00\10\00\00\00launcher enabled\00")
  (data (;263;) (i32.const 5316) "\01\00\00\00\05\00\00\00false\00")
  (data (;264;) (i32.const 5330) "\01\00\00\00\07\00\00\00options\00")
  (data (;265;) (i32.const 5346) "\01\00\00\00\13\00\00\00borderless windowed\00")
  (data (;266;) (i32.const 5374) "\01\00\00\00\04\00\00\00true\00")
  (data (;267;) (i32.const 5387) "\01\00\00\00\07\00\00\00options\00")
  (data (;268;) (i32.const 5403) "\01\00\00\00\13\00\00\00borderless windowed\00")
  (data (;269;) (i32.const 5431) "\01\00\00\00\05\00\00\00false\00")
  (data (;270;) (i32.const 5445) "\01\00\00\00\07\00\00\00options\00")
  (data (;271;) (i32.const 5461) "\01\00\00\00\05\00\00\0016bit\00")
  (data (;272;) (i32.const 5475) "\01\00\00\00\04\00\00\00true\00")
  (data (;273;) (i32.const 5488) "\01\00\00\00\07\00\00\00options\00")
  (data (;274;) (i32.const 5504) "\01\00\00\00\05\00\00\0016bit\00")
  (data (;275;) (i32.const 5518) "\01\00\00\00\05\00\00\00false\00")
  (data (;276;) (i32.const 5532) "\01\00\00\00\07\00\00\00options\00")
  (data (;277;) (i32.const 5548) "\01\00\00\00\0a\00\00\00gfx driver\00")
  (data (;278;) (i32.const 5567) "\01\00\00\00\07\00\00\00options\00")
  (data (;279;) (i32.const 5583) "\01\00\00\00\11\00\00\00check for updates\00")
  (data (;280;) (i32.const 5609) "\01\00\00\00\04\00\00\00true\00")
  (data (;281;) (i32.const 5622) "\01\00\00\00\07\00\00\00options\00")
  (data (;282;) (i32.const 5638) "\01\00\00\00\11\00\00\00check for updates\00")
  (data (;283;) (i32.const 5664) "\01\00\00\00\05\00\00\00false\00")
  (data (;284;) (i32.const 5678) "\01\00\00\00\01\00\00\00[\00")
  (data (;285;) (i32.const 5688) "\01\00\00\00\0a\00\00\00image path\00")
  (data (;286;) (i32.const 5707) "\01\00\00\00\04\00\00\00text\00")
  (data (;287;) (i32.const 5720) "\01\00\00\00\00\00\00\00\00")
  (data (;288;) (i32.const 5729) "\01\00\00\00\11\00\00\00disablebackground\00")
  (data (;289;) (i32.const 5755) "\01\00\00\00\07\00\00\00align x\00")
  (data (;290;) (i32.const 5771) "\01\00\00\00\04\00\00\00left\00")
  (data (;291;) (i32.const 5784) "\01\00\00\00\06\00\00\00middle\00")
  (data (;292;) (i32.const 5799) "\01\00\00\00\06\00\00\00center\00")
  (data (;293;) (i32.const 5814) "\01\00\00\00\05\00\00\00right\00")
  (data (;294;) (i32.const 5828) "\01\00\00\00\07\00\00\00align y\00")
  (data (;295;) (i32.const 5844) "\01\00\00\00\03\00\00\00top\00")
  (data (;296;) (i32.const 5856) "\01\00\00\00\02\00\00\00up\00")
  (data (;297;) (i32.const 5867) "\01\00\00\00\06\00\00\00middle\00")
  (data (;298;) (i32.const 5882) "\01\00\00\00\06\00\00\00center\00")
  (data (;299;) (i32.const 5897) "\01\00\00\00\06\00\00\00bottom\00")
  (data (;300;) (i32.const 5912) "\01\00\00\00\04\00\00\00down\00")
  (data (;301;) (i32.const 5925) "\01\00\00\00\0f\00\00\00Loadingscreens\5c\00")
  (data (;302;) (i32.const 5949) "\01\00\00\00\03\00\00\00CWM\00")
  (data (;303;) (i32.const 5961) "\01\00\00\00\14\00\00\00SFX\5cSCP\5c990\5ccwm1.cwm\00")
  (data (;304;) (i32.const 5990) "\01\00\00\00\14\00\00\00SFX\5cSCP\5c990\5ccwm2.cwm\00")
  (data (;305;) (i32.const 6019) "\01\00\00\00\00\00\00\00\00")
  (data (;306;) (i32.const 6028) "\01\00\00\00\12\00\00\00It will happen on \00")
  (data (;307;) (i32.const 6055) "\01\00\00\00\01\00\00\00.\00")
  (data (;308;) (i32.const 6065) "\01\00\00\00+\00\00\00A very fine radio might prove to be useful.\00")
  (data (;309;) (i32.const 6117) "\01\00\00\00\14\00\00\00ThIS PLaCE WiLL BUrN\00")
  (data (;310;) (i32.const 6146) "\01\00\00\00\16\00\00\00You cannot control it.\00")
  (data (;311;) (i32.const 6177) "\01\00\00\00\13\00\00\00eof9nsd3jue4iwe1fgj\00")
  (data (;312;) (i32.const 6205) "\01\00\00\00\14\00\00\00YOU NEED TO TRUST IT\00")
  (data (;313;) (i32.const 6234) "\01\00\00\00T\00\00\00Look my friend in the eye when you address him, isn't that the way of the gentleman?\00")
  (data (;314;) (i32.const 6327) "\01\00\00\00\15\00\00\00???____??_???__????n?\00")
  (data (;315;) (i32.const 6357) "\01\00\00\00\1d\00\00\00Jorge has been expecting you.\00")
  (data (;316;) (i32.const 6395) "\01\00\00\00\0b\00\00\00???????????\00")
  (data (;317;) (i32.const 6415) "\01\00\00\00'\00\00\00Make her a member of the midnight crew.\00")
  (data (;318;) (i32.const 6463) "\01\00\00\00>\00\00\00oncluded that coming here was a mistake. We have to turn back.\00")
  (data (;319;) (i32.const 6534) "\01\00\00\00+\00\00\00This alloy contains the essence of my life.\00")
  (data (;320;) (i32.const 6586) "\01\00\00\00\0a\00\00\00LOADING - \00")
  (data (;321;) (i32.const 6605) "\01\00\00\00\02\00\00\00 %\00")
  (data (;322;) (i32.const 6616) "\01\00\00\00\0a\00\00\00LOADING - \00")
  (data (;323;) (i32.const 6635) "\01\00\00\00\02\00\00\00 %\00")
  (data (;324;) (i32.const 6646) "\01\00\00\00\03\00\00\00CWM\00")
  (data (;325;) (i32.const 6658) "\01\00\00\00\16\00\00\00SFX\5cHorror\5cHorror8.ogg\00")
  (data (;326;) (i32.const 6689) "\01\00\00\00\19\00\00\00PRESS ANY KEY TO CONTINUE\00")
  (data (;327;) (i32.const 6723) "\01\00\00\00\03\00\00\00LOW\00")
  (data (;328;) (i32.const 6735) "\01\00\00\00\04\00\00\00HIGH\00")
  (data (;329;) (i32.const 6748) "\01\00\00\00\01\00\00\00 \00")
  (data (;330;) (i32.const 6758) "\01\00\00\00\00\00\00\00\00")
  (data (;331;) (i32.const 6767) "\01\00\00\00\00\00\00\00\00")
  (data (;332;) (i32.const 6776) "\01\00\00\00\01\00\00\00 \00")
  (data (;333;) (i32.const 6786) "\01\00\00\00\00\00\00\00\00")
  (data (;334;) (i32.const 6795) "\01\00\00\00\00\00\00\00\00")
  (data (;335;) (i32.const 6804) "\01\00\00\00\01\00\00\00 \00")
  (data (;336;) (i32.const 6814) "\01\00\00\00\00\00\00\00\00")
  (data (;337;) (i32.const 6823) "\01\00\00\00\01\00\00\00 \00")
  (data (;338;) (i32.const 6833) "\01\00\00\00\00\00\00\00\00")
  (data (;339;) (i32.const 6842) "\01\00\00\00\00\00\00\00\00")
  (data (;340;) (i32.const 6851) "\01\00\00\00\03\00\00\00...\00")
  (data (;341;) (i32.const 6863) "\01\00\00\00\00\00\00\00\00")
  (data (;342;) (i32.const 6872) "\01\00\00\00\03\00\00\00...\00")
  (data (;343;) (i32.const 6884) "\01\00\00\00\09\00\00\00LOADING: \00")
  (data (;344;) (i32.const 6902) "\01\00\00\00\01\00\00\00%\00")
  (data (;345;) (i32.const 6912) "\01\00\00\00\00\00\00\00\00")
  (data (;346;) (i32.const 6921) "\01\00\00\00\00\00\00\00\00")
  (data (;347;) (i32.const 6930) "\01\00\00\00\04\00\00\00bump\00")
  (data (;348;) (i32.const 6943) "\01\00\00\00\0c\00\00\00Bump mapping\00")
  (data (;349;) (i32.const 6964) "\01\00\00\00A\00\00\00 is used to simulate bumps and dents by distorting the lightmaps.\00")
  (data (;350;) (i32.const 7038) "\01\00\00\00&\00\00\00This option cannot be changed in-game.\00")
  (data (;351;) (i32.const 7085) "\01\00\00\00\05\00\00\00vsync\00")
  (data (;352;) (i32.const 7099) "\01\00\00\00\0d\00\00\00Vertical sync\00")
  (data (;353;) (i32.const 7121) "\01\00\00\00x\00\00\00 waits for the display to finish its current refresh cycle before calculating the next frame, preventing issues such as \00")
  (data (;354;) (i32.const 7250) "\01\00\00\00l\00\00\00screen tearing. This ties the game's frame rate to your display's refresh rate and may cause some input lag.\00")
  (data (;355;) (i32.const 7367) "\01\00\00\00\09\00\00\00antialias\00")
  (data (;356;) (i32.const 7385) "\01\00\00\00\0d\00\00\00Anti-Aliasing\00")
  (data (;357;) (i32.const 7407) "\01\00\00\00o\00\00\00 is used to smooth the rendered image before displaying in order to reduce aliasing around the edges of models.\00")
  (data (;358;) (i32.const 7527) "\01\00\00\00,\00\00\00This option only takes effect in fullscreen.\00")
  (data (;359;) (i32.const 7580) "\01\00\00\00\0a\00\00\00roomlights\00")
  (data (;360;) (i32.const 7599) "\01\00\00\00O\00\00\00Toggles the artificial lens flare effect generated over specific light sources.\00")
  (data (;361;) (i32.const 7687) "\01\00\00\00\05\00\00\00gamma\00")
  (data (;362;) (i32.const 7701) "\01\00\00\00\10\00\00\00Gamma correction\00")
  (data (;363;) (i32.const 7726) "\01\00\00\00\80\00\00\00 is used to achieve a good brightness factor to balance out your display's gamma if the game appears either too dark or bright. \00")
  (data (;364;) (i32.const 7863) "\01\00\00\00H\00\00\00Setting it too high or low can cause the graphics to look less detailed.\00")
  (data (;365;) (i32.const 7944) "\01\00\00\00\0f\00\00\00Current value: \00")
  (data (;366;) (i32.const 7968) "\01\00\00\00\13\00\00\00% (default is 100%)\00")
  (data (;367;) (i32.const 7996) "\01\00\00\00\0a\00\00\00texquality\00")
  (data (;368;) (i32.const 8015) "\01\00\00\00\10\00\00\00Texture LOD Bias\00")
  (data (;369;) (i32.const 8040) "\01\00\00\00\89\00\00\00 affects the distance at which texture detail will change to prevent aliasing. Change this option if textures flicker or look too blurry.\00")
  (data (;370;) (i32.const 8186) "\01\00\00\00\0e\00\00\00particleamount\00")
  (data (;371;) (i32.const 8209) "\01\00\00\00A\00\00\00Determines the amount of particles that can be rendered per tick.\00")
  (data (;372;) (i32.const 8283) "\01\00\00\00+\00\00\00Only smoke emitters will produce particles.\00")
  (data (;373;) (i32.const 8335) "\01\00\00\00/\00\00\00Only a few particles will be rendered per tick.\00")
  (data (;374;) (i32.const 8391) "\01\00\00\00\1b\00\00\00All particles are rendered.\00")
  (data (;375;) (i32.const 8427) "\01\00\00\00\04\00\00\00vram\00")
  (data (;376;) (i32.const 8440) "\01\00\00\00~\00\00\00Textures that are stored in the Video-RAM will load faster, but this also has negative effects on the texture quality as well.\00")
  (data (;377;) (i32.const 8575) "\01\00\00\00&\00\00\00This option cannot be changed in-game.\00")
  (data (;378;) (i32.const 8622) "\01\00\00\00\08\00\00\00musicvol\00")
  (data (;379;) (i32.const 8639) "\01\00\00\00^\00\00\00Adjusts the volume of background music. Sliding the bar fully to the left will mute all music.\00")
  (data (;380;) (i32.const 8742) "\01\00\00\00\0f\00\00\00Current value: \00")
  (data (;381;) (i32.const 8766) "\01\00\00\00\12\00\00\00% (default is 50%)\00")
  (data (;382;) (i32.const 8793) "\01\00\00\00\08\00\00\00soundvol\00")
  (data (;383;) (i32.const 8810) "\01\00\00\00\5c\00\00\00Adjusts the volume of sound effects. Sliding the bar fully to the left will mute all sounds.\00")
  (data (;384;) (i32.const 8911) "\01\00\00\00\0f\00\00\00Current value: \00")
  (data (;385;) (i32.const 8935) "\01\00\00\00\13\00\00\00% (default is 100%)\00")
  (data (;386;) (i32.const 8963) "\01\00\00\00\0e\00\00\00sfxautorelease\00")
  (data (;387;) (i32.const 8986) "\01\00\00\00\12\00\00\00Sound auto-release\00")
  (data (;388;) (i32.const 9013) "\01\00\00\00a\00\00\00 will free a sound from memory if it not used after 5 seconds. Prevents memory allocation issues.\00")
  (data (;389;) (i32.const 9119) "\01\00\00\00&\00\00\00This option cannot be changed in-game.\00")
  (data (;390;) (i32.const 9166) "\01\00\00\00\09\00\00\00usertrack\00")
  (data (;391;) (i32.const 9184) "\01\00\00\00h\00\00\00Toggles the ability to play custom tracks over channel 1 of the radio. These tracks are loaded from the \00")
  (data (;392;) (i32.const 9297) "\01\00\00\00\15\00\00\00SFX\5cRadio\5cUserTracks\5c\00")
  (data (;393;) (i32.const 9327) "\01\00\00\00\12\00\00\00 directory. Press \00")
  (data (;394;) (i32.const 9354) "\01\00\00\00\01\00\00\001\00")
  (data (;395;) (i32.const 9364) "\01\00\00\00,\00\00\00 when the radio is selected to change track.\00")
  (data (;396;) (i32.const 9417) "\01\00\00\00&\00\00\00This option cannot be changed in-game.\00")
  (data (;397;) (i32.const 9464) "\01\00\00\00\0d\00\00\00usertrackmode\00")
  (data (;398;) (i32.const 9486) "\01\00\00\00-\00\00\00Sets the playing mode for the custom tracks. \00")
  (data (;399;) (i32.const 9540) "\01\00\00\00\06\00\00\00Repeat\00")
  (data (;400;) (i32.const 9555) "\01\00\00\00)\00\00\00 plays every file in alphabetical order. \00")
  (data (;401;) (i32.const 9605) "\01\00\00\00\06\00\00\00Random\00")
  (data (;402;) (i32.const 9620) "\01\00\00\00\0d\00\00\00 chooses the \00")
  (data (;403;) (i32.const 9642) "\01\00\00\00\15\00\00\00next track at random.\00")
  (data (;404;) (i32.const 9672) "\01\00\00\00S\00\00\00Note that the random mode does not prevent previously played tracks from repeating.\00")
  (data (;405;) (i32.const 9764) "\01\00\00\00\0d\00\00\00usertrackscan\00")
  (data (;406;) (i32.const 9786) "\01\00\00\00G\00\00\00Re-checks the user tracks directory for any new or removed sound files.\00")
  (data (;407;) (i32.const 9866) "\01\00\00\00\10\00\00\00mousesensitivity\00")
  (data (;408;) (i32.const 9891) "\01\00\00\00'\00\00\00Adjusts the speed of the mouse pointer.\00")
  (data (;409;) (i32.const 9939) "\01\00\00\00\0f\00\00\00Current value: \00")
  (data (;410;) (i32.const 9963) "\01\00\00\00\12\00\00\00% (default is 50%)\00")
  (data (;411;) (i32.const 9990) "\01\00\00\00\0b\00\00\00mouseinvert\00")
  (data (;412;) (i32.const 10010) "\01\00\00\00\13\00\00\00Invert mouse Y-axis\00")
  (data (;413;) (i32.const 10038) "\01\00\00\00\15\00\00\00 is self-explanatory.\00")
  (data (;414;) (i32.const 10068) "\01\00\00\00\0e\00\00\00mousesmoothing\00")
  (data (;415;) (i32.const 10091) "\01\00\00\005\00\00\00Adjusts the amount of smoothing of the mouse pointer.\00")
  (data (;416;) (i32.const 10153) "\01\00\00\00\0f\00\00\00Current value: \00")
  (data (;417;) (i32.const 10177) "\01\00\00\00\13\00\00\00% (default is 100%)\00")
  (data (;418;) (i32.const 10205) "\01\00\00\00\08\00\00\00controls\00")
  (data (;419;) (i32.const 10222) "\01\00\00\00%\00\00\00Configure the in-game control scheme.\00")
  (data (;420;) (i32.const 10268) "\01\00\00\00\03\00\00\00hud\00")
  (data (;421;) (i32.const 10280) "\01\00\00\00%\00\00\00Display the blink and stamina meters.\00")
  (data (;422;) (i32.const 10326) "\01\00\00\00\0d\00\00\00consoleenable\00")
  (data (;423;) (i32.const 10348) "\01\00\00\00J\00\00\00Toggles the use of the developer console. Can be used in-game by pressing \00")
  (data (;424;) (i32.const 10431) "\01\00\00\00\01\00\00\00.\00")
  (data (;425;) (i32.const 10441) "\01\00\00\00\0c\00\00\00consoleerror\00")
  (data (;426;) (i32.const 10462) "\01\00\00\00\15\00\00\00Open console on error\00")
  (data (;427;) (i32.const 10492) "\01\00\00\00\15\00\00\00 is self-explanatory.\00")
  (data (;428;) (i32.const 10522) "\01\00\00\00\08\00\00\00achpopup\00")
  (data (;429;) (i32.const 10539) "\01\00\00\00?\00\00\00Displays a pop-up notification when an achievement is unlocked.\00")
  (data (;430;) (i32.const 10611) "\01\00\00\00\07\00\00\00showfps\00")
  (data (;431;) (i32.const 10627) "\01\00\00\00C\00\00\00Displays the frames per second counter at the top left-hand corner.\00")
  (data (;432;) (i32.const 10703) "\01\00\00\00\0a\00\00\00framelimit\00")
  (data (;433;) (i32.const 10722) "\01\00\00\00B\00\00\00Limits the frame rate that the game can run at to a desired value.\00")
  (data (;434;) (i32.const 10797) "\01\00\00\00\99\00\00\00Usually, 60 FPS or higher is preferred. If you are noticing excessive stuttering at this setting, try lowering it to make your framerate more consistent.\00")
  (data (;435;) (i32.const 10959) "\01\00\00\00\0d\00\00\00antialiastext\00")
  (data (;436;) (i32.const 10981) "\01\00\00\00\10\00\00\00Antialiased text\00")
  (data (;437;) (i32.const 11006) "\01\00\00\00W\00\00\00 smooths out the text before displaying. Makes text easier to read at high resolutions.\00")
  (data (;438;) (i32.const 11102) "\01\00\00\00\00\00\00\00\00")
  (data (;439;) (i32.const 11111) "\01\00\00\00\00\00\00\00\00")
  (data (;440;) (i32.const 11120) "\01\00\00\00\00\00\00\00\00")
  (data (;441;) (i32.const 11129) "\01\00\00\00\06\00\00\00cbmap2\00")
  (data (;442;) (i32.const 11144) "\01\00\00\00\11\00\00\00Map Creator\5cMaps\5c\00")
  (data (;443;) (i32.const 11170) "\01\00\00\00\09\00\00\00[Unknown]\00")
  (data (;444;) (i32.const 11188) "\01\00\00\00\10\00\00\00[No description]\00")
  (data (;445;) (i32.const 11213) "\01\00\00\00\09\00\00\00Made by: \00")
  (data (;446;) (i32.const 11231) "\01\00\00\00\0d\00\00\00Description: \00")
  (data (;447;) (i32.const 11253) "\01\00\00\00\0d\00\00\00Room amount: \00")
  (data (;448;) (i32.const 11275) "\01\00\00\00\16\00\00\00Room amount: [Unknown]\00")
  (data (;449;) (i32.const 11306) "\01\00\00\00\16\00\00\00Has custom forest: Yes\00")
  (data (;450;) (i32.const 11337) "\01\00\00\00\15\00\00\00Has custom forest: No\00")
  (data (;451;) (i32.const 11367) "\01\00\00\00\22\00\00\00Has custom maintenance tunnel: Yes\00")
  (data (;452;) (i32.const 11410) "\01\00\00\00!\00\00\00Has custom maintenance tunnel: No\00")
  (data (;453;) (i32.const 11452) "\01\00\00\00\19\00\00\00GFX\5cmap\5croom3z3_opt.rmesh\00")
  (data (;454;) (i32.const 11486) "\01\00\00\00\00\00\00\00\00"))
