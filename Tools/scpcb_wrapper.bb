; scpcb_wrapper.bb — Web entrypoint wrapper for SCP: Containment Breach
; 
; Provides non-blocking Web_* entrypoints for the browser web port.
; Includes SCPCB's Main.bb to pull in all game systems and mod includes.
; This file is versioned in the blitz3d-wasm repo under Tools/.
;
; Entrypoint contract (frozen at A-M0, see plan/subplans/05_scpcb_integration.md):
;   Web_InitOnce()       — one-time startup, no blocking loops
;   Web_EnterMenu()      — enter menu mode
;   Web_LeaveMenu()      — leave menu mode
;   Web_EnterGame()      — enter gameplay mode
;   Web_LeaveGame()      — leave gameplay mode
;   Web_Tick(dt#)        — single-frame update dispatch
Global WebPort% = 1
Include "Main.bb"

; ── Web Mode Constants ──────────────────────────────────────────

Const WEBMODE_BOOT    = 0
Const WEBMODE_MENU    = 1
Const WEBMODE_LOADING = 2
Const WEBMODE_GAME    = 3

; ── Web State Globals ───────────────────────────────────────────
Global WebMode% = WEBMODE_BOOT

; Transition requests: JS observes these and triggers the matching
; Web_Enter*/Web_Leave* call after preloading the required assets.
Global Web_RequestEnterGame% = 0
Global Web_RequestEnterMenu% = 0

; ── Web Entrypoints ─────────────────────────────────────────────

Function Web_InitOnce()
    ; One-time startup.  Must NOT contain blocking loops
    ; (launcher, "press any key", wait-for-file spins).
    ; SCPCB global init happens via the Include chain above;
    ; this function gates any web-unsafe paths.
    WebMode = WEBMODE_BOOT
    Return 1
End Function

Function Web_EnterMenu()
    ; Enter menu mode.  JS preloads the "menu" asset group
    ; before calling this.
    WebMode = WEBMODE_MENU
    Return 1
End Function

Function Web_LeaveMenu()
    ; Tear down menu resources.  Called before transitioning
    ; out of menu mode (e.g. into game or loading).
    Return 1
End Function

Function Web_EnterGame()
    ; Enter gameplay mode.  JS preloads the room pack before
    ; calling this.  Calls SCPCB's InitNewGame() to set up
    ; player, camera, and game state.
    InitNewGame()
    WebMode = WEBMODE_GAME
    Return 1
End Function

Function Web_LeaveGame()
    ; Tear down gameplay resources and return to menu.
    NullGame()
    WebMode = WEBMODE_MENU
    Return 1
End Function

Function Web_Tick(dt#)
    ; Single-frame update dispatch.
    ; dt# = delta time in seconds (clamped by JS before calling).
    If WebMode = WEBMODE_MENU
        UpdateMainMenu()
    ElseIf WebMode = WEBMODE_GAME
        ; Call the per-frame SCPCB update functions that drive
        ; gameplay.  TODO(A-M1/A-M2): expand to cover the full game
        ; loop including MovePlayer(), UpdateConsole(), UpdateNPCs(),
        ; and any other per-frame functions discovered during testing.
        UpdateDoors()
        UpdateMusic()
        UpdateStreamSounds()
    EndIf
    Return 1
End Function
