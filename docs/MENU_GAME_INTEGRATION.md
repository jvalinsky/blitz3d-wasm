# Menu → Game Integration

How the menu system connects to WASM game initialization.

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                    game.html                         │
├──────────────────────────────────────────────────────┤
│  Phase 1: START SCREEN (autoplay policy)            │
│  ├─ Click to Start button                           │
│  └─ → showMenu()                                     │
├──────────────────────────────────────────────────────┤
│  Phase 2: MENU CANVAS (menu-canvas.html)            │
│  ├─ Main Menu (New Game/Load/Options/Quit)          │
│  ├─ New Game → Seed + Difficulty + Start            │
│  └─ START button → window.startNewGame()            │
├──────────────────────────────────────────────────────┤
│  Phase 3: LOADER (progress bar)                     │
│  ├─ Loading WASM module (10%)                       │
│  ├─ Loading room templates (30%)                    │
│  ├─ Loading assets (50%)                            │
│  ├─ Initializing world (70%)                        │
│  ├─ Spawning player (90%)                           │
│  └─ Complete! (100%)                                 │
├──────────────────────────────────────────────────────┤
│  Phase 4: GAME CANVAS (Three.js + WASM)             │
│  ├─ 3D rendering active                             │
│  ├─ Player control enabled                          │
│  └─ Game loop running                               │
└──────────────────────────────────────────────────────┘
```

## File Structure

### game.html (Unified Entry Point)
**URL**: `http://localhost:8000/web/game.html`

Contains:
- `#menuCanvas` - Canvas for menu rendering
- `#canvas` - Canvas for game (Three.js)
- `#startScreen` - Click to Start (autoplay policy)
- `#loader` - Loading progress overlay

### menu-canvas.html (Standalone Menu)
**URL**: `http://localhost:8000/web/menu-canvas.html`

Can run independently for menu testing, or integrated into game.html.

## Integration Points

### 1. window.startNewGame(seed, difficulty)
Called by menu START button when game.html is loaded.

**Parameters:**
- `seed` (string) - Map seed (e.g., "CRUNCH", "9341", or random)
- `difficulty` (number) - 0=Safe, 1=Euclid, 2=Keter

**Example:**
```javascript
window.startNewGame("CRUNCH", 2);  // Keter difficulty
```

### 2. initGameWorld(seed, difficulty)
Internal function that:
1. Shows loader overlay
2. Loads WASM module
3. Calls main.ts init() function
4. Loads room templates and meshes
5. Initializes player
6. Transitions to game canvas

### 3. State Transitions

```javascript
gameState = {
    phase: 'menu',       // Current phase
    seed: '',            // Selected seed
    difficulty: 1,       // Selected difficulty
    introEnabled: true   // Play intro videos
};

// State machine
showMenu()    → phase = 'menu'
showLoader()  → phase = 'loading'
showGame()    → phase = 'game'
```

## Usage

### Standalone Menu (Testing)
```bash
open http://localhost:8000/web/menu-canvas.html
```
- Menu renders normally
- START button shows alert (no WASM)
- Good for testing menu UI

### Integrated Game
```bash
open http://localhost:8000/web/game.html
```
- Full menu → game flow
- START button triggers WASM init
- Loader shows progress
- Game canvas appears when ready

## Implementation Status

### ✅ Complete
- Menu canvas rendering
- START button detection
- Loader overlay UI
- State machine (menu/loading/game)
- Progress bar system

### 🚧 In Progress
- Inline menu code into game.html
- Wire to actual main.ts init()
- Load first room (room2 or testroom)
- Player spawning

### ⏳ TODO
- WASM module loading
- Room template loading
- Asset streaming
- Player controller initialization
- HUD rendering
- Save/load integration

## Testing

### Test Menu Integration
1. Open `game.html`
2. Click "CLICK TO START"
3. Click "NEW GAME"
4. Type seed: "CRUNCH"
5. Select difficulty: Keter
6. Click "START"
7. ✅ Loader appears with progress
8. ✅ Progress bar animates 0→100%
9. ✅ Alert shows (placeholder for real game)

### Test Standalone Menu
1. Open `menu-canvas.html`
2. Click through menus
3. Click "START"
4. ✅ Alert shows with instructions

## Next Steps

### Immediate (Phase 4B Completion)
1. **Inline menu code** - Copy menu-canvas.html <script> into game.html
2. **Wire to main.ts** - Call actual WASM init() function
3. **Load test room** - Load room2 or testroom
4. **Show game canvas** - Transition to Three.js rendering

### Soon (Phase 4C)
1. **Player spawn** - Initialize player at origin
2. **Camera setup** - First-person camera
3. **Movement** - WASD + mouse look
4. **Collision** - Player vs environment

## Code Examples

### Start New Game (from menu)
```javascript
// In menu-canvas.html START button
if (typeof window.startNewGame === 'function') {
    window.startNewGame(randomSeed, selectedDifficulty);
}
```

### Game Initialization (in game.html)
```javascript
async function initGameWorld(seed, difficulty) {
    showLoader('Loading WASM...');
    updateProgress(10);
    
    // Load WASM (TODO: call main.ts)
    await loadWASM();
    updateProgress(50);
    
    // Initialize world with seed
    await initWorld(seed, difficulty);
    updateProgress(90);
    
    // Show game
    showGame();
}
```

### Progress Updates
```javascript
updateProgress(percent, text);

// Examples:
updateProgress(10, 'Loading WASM module...');
updateProgress(30, 'Loading room templates...');
updateProgress(50, 'Loading assets...');
updateProgress(70, 'Initializing world...');
updateProgress(90, 'Spawning player...');
updateProgress(100, 'Complete!');
```

## Related Files

- `web/game.html` - Unified entry point
- `web/menu-canvas.html` - Standalone menu
- `web/src/main.ts` - WASM initialization
- `docs/MENU_GAME_INTEGRATION.md` - This file

---

*Last updated: February 1, 2026*
