# Launcher System

Complete modular system for menu → WASM → game integration.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                 launcher.html                       │
│  (HTML entry point with canvases + loader UI)      │
└──────────────────┬──────────────────────────────────┘
                   │
                   ↓ imports
┌─────────────────────────────────────────────────────┐
│            launcher_main.ts                         │
│  (Unified entry - coordinates all phases)           │
├─────────────────────────────────────────────────────┤
│  • Phase management (start/menu/loading/game)       │
│  • Event wiring (START button → init)               │
│  • Progress callbacks                               │
│  • Error handling                                   │
└──────────┬──────────────────────────┬───────────────┘
           │                          │
           ↓                          ↓
┌──────────────────┐      ┌──────────────────────────┐
│   menu.ts        │      │  game_launcher.ts        │
│  (MenuSystem)    │      │  (GameLauncher)          │
├──────────────────┤      ├──────────────────────────┤
│ • Canvas render  │      │ • Load WASM              │
│ • Input handling │      │ • Load rooms             │
│ • Settings       │      │ • Load assets            │
│ • Start callback │      │ • Init world             │
└──────────────────┘      │ • Spawn player           │
                          │ • Progress tracking      │
                          └──────────────────────────┘
```

## Files

### launcher.html
**Entry point** - Loads TypeScript modules

**Contains:**
- `#startScreen` - Click to Start (autoplay policy)
- `#menuCanvas` - Menu rendering surface
- `#canvas` - Game canvas (Three.js)
- `#loader` - Loading progress UI

**Imports:** `launcher_main.ts` as ES module

### launcher_main.ts
**Coordinator** - Manages phases and wires systems together

**Responsibilities:**
- Phase management (start → menu → loading → game)
- Initialize MenuSystem
- Wire START button to GameLauncher
- Handle progress updates
- Handle errors (fallback to menu)
- Expose debug API

**Exports:** Debug object on `window.__LAUNCHER`

### menu.ts
**Menu rendering** - Canvas-based menu system

**MenuSystem class:**
- Canvas-based 2D rendering
- Mouse/keyboard input
- Asset loading (menu images)
- Settings persistence (localStorage)
- Game start callback

**Interfaces:**
- `MenuSettings` - All game settings
- `GameStartParams` - seed, difficulty, introEnabled

### game_launcher.ts
**Game initialization** - Loads WASM and initializes world

**GameLauncher class:**
- WASM module loading (TODO: wire to main.ts)
- Room template loading
- Asset streaming
- World initialization with seed
- Player spawning
- Progress callbacks

**Interfaces:**
- `LauncherCallbacks` - onProgress, onError, onReady

## Phase Flow

### 1. START Phase
**URL:** Open `launcher.html`

**Display:**
- Black screen with "CLICK TO START" button

**Actions:**
- User clicks button OR presses any key
- → showPhase('menu')

### 2. MENU Phase
**Display:**
- Menu canvas visible
- MenuSystem rendering active

**Actions:**
- User navigates menu (Main → New Game → Options)
- User selects seed + difficulty
- User clicks START button
- → MenuSystem calls startCallback
- → showPhase('loading')

### 3. LOADING Phase
**Display:**
- Loader overlay with progress bar
- Menu canvas hidden

**Actions:**
- GameLauncher.initGameWorld() runs
- Progress updates: 10% → 30% → 50% → 70% → 90% → 100%
- onProgress callback updates UI
- → showPhase('game')

### 4. GAME Phase
**Display:**
- Game canvas visible (#canvas)
- Three.js rendering active

**Actions:**
- Game loop running
- Player control enabled
- HUD rendering

## TypeScript Modules

### MenuSystem
```typescript
import { MenuSystem } from './menu.ts';

const menu = new MenuSystem('menuCanvas');
menu.setStartCallback((params) => {
    console.log('Starting game:', params);
    // { seed: "CRUNCH", difficulty: 2, introEnabled: true }
});
menu.start();
```

### GameLauncher
```typescript
import { GameLauncher } from './game_launcher.ts';

const launcher = new GameLauncher({
    onProgress: (percent, message) => {
        updateProgressBar(percent, message);
    },
    onReady: () => {
        showGameCanvas();
    }
});

await launcher.initGameWorld({
    seed: 'CRUNCH',
    difficulty: 2,
    introEnabled: true
});
```

### Unified Entry
```typescript
import { MenuSystem } from './menu.ts';
import { GameLauncher } from './game_launcher.ts';

const menu = new MenuSystem('menuCanvas');
menu.setStartCallback(async (params) => {
    const launcher = new GameLauncher({ ... });
    await launcher.initGameWorld(params);
});
menu.start();
```

## Debug API

Exposed on `window.__LAUNCHER`:

```javascript
// Check current phase
window.__LAUNCHER.currentPhase()  // 'menu' | 'loading' | 'game'

// Force phase change
window.__LAUNCHER.showPhase('menu')

// Access systems
window.__LAUNCHER.menuSystem()     // MenuSystem instance
window.__LAUNCHER.gameLauncher()   // GameLauncher instance
```

## Integration with main.ts

**Current status:** GameLauncher has placeholder functions

**TODO:** Wire to actual WASM loader

```typescript
// In game_launcher.ts
private async loadWASM(): Promise<void> {
    // TODO: Import main.ts init function
    // import { init } from './main.ts';
    // await init();
    
    // For now: simulated
    await this.delay(500);
}
```

**Next step:** Import and call `main.ts` init() inside GameLauncher

## Testing

### Test launcher.html
```bash
# Serve with Deno
deno task web:dev

# Open browser
open http://localhost:8000/web/launcher.html
```

**Expected flow:**
1. ✅ Start screen appears
2. ✅ Click → Menu canvas shows
3. ✅ Menu buttons clickable (simplified UI)
4. ✅ Click NEW GAME → Click anywhere to start
5. ✅ Loading screen appears
6. ✅ Progress bar animates 0% → 100%
7. ✅ Alert shows game params
8. ✅ Game canvas would appear (placeholder)

### Test menu-canvas.html (Standalone)
```bash
open http://localhost:8000/web/menu-canvas.html
```

**Full menu UI** - Authentic canvas rendering with all features

### Test game.html (Simple Bridge)
```bash
open http://localhost:8000/web/game.html
```

**Simple integration** - Basic flow without TypeScript modules

## Implementation Status

### ✅ Complete
- launcher.html entry point
- launcher_main.ts coordinator
- menu.ts MenuSystem class
- game_launcher.ts GameLauncher class
- Phase management (4 phases)
- Progress bar system
- Error handling
- Debug API

### 🚧 In Progress
- Wire GameLauncher to main.ts
- Load first room (room2)
- Player spawning
- Game loop activation

### ⏳ TODO
- Full menu UI in MenuSystem (currently simplified)
- WASM module loading (import main.ts)
- Room template loading
- Asset streaming
- Player controller
- HUD rendering

## Files Created (Phase 4B)

1. `web/src/menu.ts` (316 lines)
2. `web/src/game_launcher.ts` (124 lines)
3. `web/src/launcher_main.ts` (143 lines)
4. `web/launcher.html` (157 lines)
5. `web/game.html` (263 lines - simple bridge)
6. `docs/LAUNCHER_SYSTEM.md` (this file)

**Total:** ~1,000 lines of integration code

## Related Files

- `web/menu-canvas.html` - Standalone authentic menu (630 lines)
- `web/src/main.ts` - Existing WASM loader (~1,700 lines)
- `docs/MENU_GAME_INTEGRATION.md` - Integration guide
- `docs/scpcb/WEB_PORT_PLAN_TRACK_B.md` - Master plan (Track B)

---

*Phase 4B Status: 80% Complete (modules + HTML done, WASM wiring pending)*  
*Last updated: February 1, 2026*
