/**
 * Launcher Main Entry Point
 *
 * Unified entry that combines menu system + game initialization
 */

import { MenuSystem } from "./menu.ts";
import { GameLauncher } from "./game_launcher.ts";

// Phase management
type GamePhase = "start" | "menu" | "loading" | "game";
let currentPhase: GamePhase = "start";

// DOM elements
const startScreen = document.getElementById("startScreen") as HTMLDivElement;
const startButton = document.getElementById("startButton") as HTMLButtonElement;
const menuCanvas = document.getElementById("menuCanvas") as HTMLCanvasElement;
const gameCanvas = document.getElementById("canvas") as HTMLCanvasElement;
const loader = document.getElementById("loader") as HTMLDivElement;
const progressBar = document.getElementById("progressBar") as HTMLDivElement;
const progressText = document.getElementById("progressText") as HTMLDivElement;

// Initialize systems
let menuSystem: MenuSystem | null = null;
let gameLauncher: GameLauncher | null = null;

function updateProgress(percent: number, message: string) {
  if (progressBar) progressBar.style.width = `${percent}%`;
  if (progressText) progressText.textContent = message;
}

function showPhase(phase: GamePhase) {
  currentPhase = phase;
  console.log("[LauncherMain] Phase:", phase);

  // Hide all
  if (startScreen) startScreen.style.display = "none";
  if (menuCanvas) menuCanvas.style.display = "none";
  if (gameCanvas) gameCanvas.style.display = "none";
  if (loader) loader.style.display = "none";

  // Show active
  switch (phase) {
    case "start":
      if (startScreen) startScreen.style.display = "flex";
      break;
    case "menu":
      if (menuCanvas) menuCanvas.style.display = "block";
      if (menuSystem) menuSystem.start();
      break;
    case "loading":
      if (loader) loader.style.display = "flex";
      if (menuSystem) menuSystem.stop();
      break;
    case "game":
      if (gameCanvas) gameCanvas.style.display = "block";
      break;
  }
}

async function initializeMenu() {
  try {
    console.log("[LauncherMain] Initializing menu system");

    menuSystem = new MenuSystem("menuCanvas");

    // Wire START button to game initialization
    menuSystem.setStartCallback(async (params) => {
      console.log("[LauncherMain] START clicked:", params);

      showPhase("loading");

      try {
        gameLauncher = new GameLauncher({
          onProgress: (percent, message) => {
            updateProgress(percent, message);
          },
          onError: (error) => {
            console.error("[LauncherMain] Init failed:", error);
            alert(`Failed to initialize game:\\n${error.message}`);
            showPhase("menu");
          },
          onReady: () => {
            console.log("[LauncherMain] Game ready!");
            showPhase("game");

            // TODO: Start game loop
            // For now just show success
            setTimeout(() => {
              alert(
                `Game initialized!\\n\\nSeed: ${params.seed}\\nDifficulty: ${params.difficulty}\\n\\n(Full WASM integration pending)`,
              );
            }, 500);
          },
        });

        await gameLauncher.initGameWorld(params);
      } catch (error) {
        console.error("[LauncherMain] Game init error:", error);
        alert(`Error: ${(error as Error).message}`);
        showPhase("menu");
      }
    });

    console.log("[LauncherMain] Menu initialized");
  } catch (error) {
    console.error("[LauncherMain] Menu initialization failed:", error);
    alert(`Failed to initialize menu: ${(error as Error).message}`);
  }
}

function startApplication() {
  console.log("[LauncherMain] Starting application");

  // Initialize menu
  initializeMenu();

  // Show menu
  showPhase("menu");
}

// Start screen event handlers
if (startButton) {
  startButton.addEventListener("click", startApplication);
}

document.addEventListener("keydown", (e) => {
  if (currentPhase === "start") {
    startApplication();
  }
});

// Initial state
console.log("[LauncherMain] Ready. Click to start.");
showPhase("start");

// Export for debugging
(window as any).__LAUNCHER = {
  currentPhase: () => currentPhase,
  showPhase,
  menuSystem: () => menuSystem,
  gameLauncher: () => gameLauncher,
};
