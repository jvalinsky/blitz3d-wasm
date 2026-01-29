; SCPCB leak test wrapper.
;
; Includes the real SCP:CB Main.bb from the sibling `scpcb/` repo, then adds a
; small exported function that is safe to call repeatedly in a headless harness.
;
; NOTE: This file is intended for tooling only (no gameplay changes).

Include "../../../scpcb/Main.bb"

; Returns 1 on success.
Function __LeakTestStep%()
	Local ent%
	Local tex%
	Local img%
	
	; Keep everything self-contained and safe to call repeatedly without touching
	; SCPCB init/global state.
	;
	; Use non-strict Load* to avoid SCPCB-defined strict wrappers that may call
	; RuntimeError when assets are missing.
	tex = LoadTexture("leaktest://tex", 0)
	ent = CreateCube(0)
	EntityTexture ent, tex, 0, 0
	
	; Exercise image allocation bookkeeping too.
	img = LoadImage("leaktest://img")
	
	FreeEntity ent
	FreeTexture tex
	FreeImage img
	
	Return 1
End Function
