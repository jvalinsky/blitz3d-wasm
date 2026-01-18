import re
import os

required_imports = [
    "PrintInt", "PrintString", "Graphics3D", "Cls", "Flip", "ClsColor", "Color", "GetColor", "Rect", "Oval", "Line", "Text",
    "LoadImage", "DrawImage", "DrawBlock", "TileImage", "ImageWidth", "ImageHeight", "HandleImage", "MidHandle", "AutoMidHandle",
    "MaskImage", "ScaleImage", "ResizeImage", "FreeImage", "KeyDown", "KeyHit", "PlaySound", "FreeSound", "StopChannel",
    "ChannelVolume", "ChannelPaused", "ChannelPlaying", "MouseX", "MouseY", "MouseZ", "MouseDown", "MouseHit", "MouseXSpeed",
    "MouseYSpeed", "MoveMouse", "HidePointer", "ShowPointer", "MilliCSecs", "CreateCamera", "CreateLight", "AmbientLight",
    "LightColor", "LightRange", "CameraClsColor", "CameraRange", "CameraZoom", "CameraProjMode", "CameraViewport", "FogMode",
    "FogColor", "FogRange", "FogDensity", "CreateCube", "CreateSphere", "PositionEntity", "RotateEntity", "ScaleEntity",
    "MoveEntity", "TurnEntity", "EntityTexture", "LoadTexture", "LoadAsset", "GetAssetData", "GetAssetSize", "LoadMesh",
    "CreateMesh", "LoadAnimMesh", "Animate", "SetAnimTime", "AnimTime", "AnimLength", "ExtractAnimSeq", "AddAnimSeq", "AnimSeq",
    "Animating", "Delay", "WaitKey", "CreatePivot", "FreeEntity", "CopyEntity", "EntityX", "EntityY", "EntityZ", "EntityPitch",
    "EntityYaw", "EntityRoll", "EntityDistance", "EntityPick", "LinePick", "EntityVisible", "EntityInView", "EntityType",
    "EntityRadius", "Collisions", "UpdateWorld", "CountCollisions", "CollisionX", "CollisionY", "CollisionZ", "CollisionNX",
    "CollisionNY", "CollisionNZ", "CollisionEntity", "CollisionSurface", "CollisionTriangle", "ReadFile", "WriteFile", "CloseFile",
    "ReadInt", "ReadFloat", "ReadString", "ReadByte", "ReadShort", "Eof", "FileSize", "FileType", "ReadData", "RestoreData",
    "StringConcat", "IntToString", "FloatToString", "CreateBank", "FreeBank", "BankSize", "ResizeBank", "CopyBank", "PeekByte",
    "PokeByte", "PeekInt", "PokeInt", "PeekFloat", "PokeFloat", "PeekShort", "PokeShort", "ZlibWapi_Open", "ZlibWapi_Close",
    "ZlibWapi_GetFileCount", "ZlibWapi_GetFileName", "ZlibWapi_ExtractFile", "FSOUND_Init", "FSOUND_Stream_Open", "FSOUND_Stream_Play",
    "FSOUND_SetVolume", "FSOUND_SetPaused", "FSOUND_Stream_Stop", "FSOUND_Close"
]

with open("/Users/jack/Software/scp_port/blitz3d-wasm/Sources/Runtime/runtime.js", "r") as f:
    content = f.read()

implemented_keys = re.findall(r"(\w+): function", content)
missing = [k for k in required_imports if k not in implemented_keys]
print("Missing imports:", len(missing))
for k in missing:
    print(k)
