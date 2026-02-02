#if arch(wasm32)
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
    
    @_extern(wasm, module: "env", name: "js_PauseChannel")
    func js_PauseChannel(_ channel: Int32)
    
    @_extern(wasm, module: "env", name: "js_ResumeChannel")
    func js_ResumeChannel(_ channel: Int32)
    
    @_extern(wasm, module: "env", name: "js_EmitSound")
    func js_EmitSound(_ sound: Int32, _ entityId: Int32) -> Int32
    
    @_extern(wasm, module: "env", name: "js_ChannelPosition")
    func js_ChannelPosition(_ channel: Int32, _ x: Float, _ y: Float, _ z: Float)
    
    @_extern(wasm, module: "env", name: "js_PlayMusic")
    func js_PlayMusic(_ path: Int32) -> Int32
    
    @_extern(wasm, module: "env", name: "js_StopMusic")
    func js_StopMusic()
    
    @_extern(wasm, module: "env", name: "js_MusicVolume")
    func js_MusicVolume(_ volume: Float)
#else
    func js_LoadSound(_ path: Int32, _ flags: Int32) -> Int32 { 0 }
    func js_PlaySound(_ sound: Int32, _ volume: Float, _ pan: Float, _ rate: Float, _ loop: Int32)
        -> Int32
    { 0 }
    func js_FreeSound(_ sound: Int32) {}
    func js_StopChannel(_ channel: Int32) {}
    func js_ChannelPitch(_ channel: Int32, _ pitch: Float) {}
    func js_ChannelVolume(_ channel: Int32, _ volume: Float) {}
    func js_ChannelPan(_ channel: Int32, _ pan: Float) {}
    func js_PauseChannel(_ channel: Int32) {}
    func js_ResumeChannel(_ channel: Int32) {}
    func js_EmitSound(_ sound: Int32, _ entityId: Int32) -> Int32 { 0 }
    func js_ChannelPosition(_ channel: Int32, _ x: Float, _ y: Float, _ z: Float) {}
    func js_PlayMusic(_ path: Int32) -> Int32 { 0 }
    func js_StopMusic() {}
    func js_MusicVolume(_ volume: Float) {}
#endif
