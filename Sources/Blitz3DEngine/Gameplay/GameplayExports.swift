

@_cdecl("EngineCreateFPSController")
@MainActor
public func EngineCreateFPSController(entityId: Int32) {
    FPSController.shared.setEntity(id: entityId)
}

@_cdecl("EngineUpdateGameplay")
@MainActor
public func EngineUpdateGameplay() {
    FPSController.shared.update()
}
