@_extern(wasm, module: "env", name: "js_LoadSound")
func js_LoadSound(_ path: Int32, _ flags: Int32) -> Int32

@_extern(wasm, module: "env", name: "js_PlaySound")
func js_PlaySound(_ sound: Int32, _ volume: Float, _ pan: Float, _ rate: Float, _ loop: Int32)
    -> Int32

@_extern(wasm, module: "env", name: "js_FreeSound")
func js_FreeSound(_ sound: Int32)

@_extern(wasm, module: "env", name: "js_StopChannel")
func js_StopChannel(_ channel: Int32)

@_extern(wasm, module: "env", name: "js_ChannelPitch")
func js_ChannelPitch(_ channel: Int32, _ pitch: Float)

@_extern(wasm, module: "env", name: "js_ChannelVolume")
func js_ChannelVolume(_ channel: Int32, _ volume: Float)

@_extern(wasm, module: "env", name: "js_ChannelPan")
func js_ChannelPan(_ channel: Int32, _ pan: Float)
