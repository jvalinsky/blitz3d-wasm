/**
 * Menu System Module
 *
 * Authentic canvas-based menu matching original Blitz3D rendering
 */

export interface MenuSettings {
  vsync: boolean;
  antiAlias: boolean;
  roomLights: boolean;
  screenGamma: number;
  particleAmount: number;
  textureQuality: number;
  musicVolume: number;
  soundVolume: number;
  mouseSensitivity: number;
  invertY: boolean;
}

export interface GameStartParams {
  seed: string;
  difficulty: number;
  introEnabled: boolean;
}

export class MenuSystem {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private menuScale = 1.0;

  // Mouse state
  private mouseX = 0;
  private mouseY = 0;
  private mouseHit1 = false;
  private mouseDown1 = false;
  private mouseUp1 = false;

  // Menu state
  private mainMenuTab = 0; // 0=main, 1=new game, 2=load, 3=options
  private optionsMenu = 1; // 1=graphics, 2=audio, 3=controls
  private randomSeed = "";
  private selectedDifficulty = 1;
  private introEnabled = true;
  private selectedInputBox = 0;
  private inputBoxText: Record<number, string> = {};

  // Assets
  private assets: Record<string, HTMLImageElement | null> = {
    menuBack: null,
    menu173: null,
    menuText: null,
    menuWhite: null,
    menuBlack: null,
  };

  // Settings
  private settings: MenuSettings = {
    vsync: true,
    antiAlias: true,
    roomLights: true,
    screenGamma: 1.0,
    particleAmount: 2,
    textureQuality: 2,
    musicVolume: 0.5,
    soundVolume: 0.7,
    mouseSensitivity: 0.5,
    invertY: false,
  };

  // Callbacks
  private onStartGame?: (params: GameStartParams) => void;

  // Animation
  private animationFrameId?: number;
  private menuBlinkTimer = [1, 700 + Math.random() * 100];
  private menuBlinkDuration = [0, 0];
  private menuStr = "";
  private menuStrX = 700;
  private menuStrY = 100;

  constructor(canvasId: string) {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) throw new Error(`Canvas #${canvasId} not found`);

    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get 2D context");
    this.ctx = ctx;

    this.setupCanvas();
    this.setupEventListeners();
    this.loadAssets();
    this.loadSettings();
  }

  private setupCanvas() {
    const baseWidth = 1024;
    const baseHeight = 768;
    this.canvas.width = baseWidth * this.menuScale;
    this.canvas.height = baseHeight * this.menuScale;
    this.canvas.style.width = baseWidth + "px";
    this.canvas.style.height = baseHeight + "px";
  }

  private setupEventListeners() {
    this.canvas.addEventListener("mousemove", (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouseX = (e.clientX - rect.left) * this.menuScale;
      this.mouseY = (e.clientY - rect.top) * this.menuScale;
    });

    this.canvas.addEventListener("mousedown", (e) => {
      if (e.button === 0) {
        this.mouseDown1 = true;
        this.mouseHit1 = true;
      }
    });

    this.canvas.addEventListener("mouseup", (e) => {
      if (e.button === 0) {
        this.mouseDown1 = false;
        this.mouseUp1 = true;
      }
    });

    document.addEventListener("keydown", (e) => {
      if (this.selectedInputBox !== 0) {
        e.preventDefault();
        const id = this.selectedInputBox;
        let text = this.inputBoxText[id] || "";

        if (e.key === "Backspace") {
          text = text.slice(0, -1);
        } else if (e.key === "Enter") {
          this.selectedInputBox = 0;
        } else if (e.key.length === 1 && text.length < 15) {
          text += e.key;
        }

        this.inputBoxText[id] = text;
        if (id === 3) this.randomSeed = text;
      }
    });
  }

  private loadAssets() {
    const assetPaths = {
      menuBack: "./dist/assets/back.jpg",
      menu173: "./dist/assets/173back.jpg",
      menuText: "./dist/assets/scptext.jpg",
      menuWhite: "./dist/assets/menuwhite.jpg",
      menuBlack: "./dist/assets/menublack.jpg",
    };

    Object.entries(assetPaths).forEach(([name, path]) => {
      const img = new Image();
      img.onload = () => {
        this.assets[name] = img;
      };
      img.src = path;
    });
  }

  private loadSettings() {
    const saved = localStorage.getItem("scpcb_settings");
    if (saved) {
      try {
        const loaded = JSON.parse(saved);
        this.settings = { ...this.settings, ...loaded };
      } catch (e) {
        console.error("[Menu] Failed to load settings:", e);
      }
    }

    const introSetting = localStorage.getItem("introEnabled");
    if (introSetting !== null) {
      this.introEnabled = introSetting !== "false";
    }
  }

  public setStartCallback(callback: (params: GameStartParams) => void) {
    this.onStartGame = callback;
  }

  public start() {
    this.render();
  }

  public stop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  private render = () => {
    // Clear
    this.ctx.fillStyle = "black";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw background
    if (this.assets.menuBack) {
      this.ctx.drawImage(
        this.assets.menuBack,
        0,
        0,
        this.canvas.width,
        this.canvas.height,
      );
    }

    // Main menu rendering
    if (this.mainMenuTab === 0) {
      this.renderMainMenu();
    } else if (this.mainMenuTab === 1) {
      this.renderNewGame();
    } else if (this.mainMenuTab === 2) {
      this.renderLoadGame();
    } else if (this.mainMenuTab === 3) {
      this.renderOptions();
    }

    // Reset mouse state
    this.mouseHit1 = false;
    this.mouseUp1 = false;

    this.animationFrameId = requestAnimationFrame(this.render);
  };

  private renderMainMenu() {
    // TODO: Implement full menu rendering
    // For now, just draw buttons
    const x = 159 * this.menuScale;
    const y = 286 * this.menuScale;

    this.ctx.fillStyle = "white";
    this.ctx.font = "28px Courier New";
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";

    const buttons = ["NEW GAME", "LOAD GAME", "OPTIONS", "QUIT"];
    for (let i = 0; i < buttons.length; i++) {
      const btnY = y + i * 100 * this.menuScale;
      this.ctx.fillText(buttons[i], this.canvas.width / 2, btnY);

      // Simple click detection
      if (
        this.mouseHit1 &&
        this.mouseX > x && this.mouseX < x + 400 * this.menuScale &&
        this.mouseY > btnY - 35 && this.mouseY < btnY + 35
      ) {
        this.handleMainMenuClick(i);
      }
    }
  }

  private renderNewGame() {
    // Simplified - full implementation would match menu-canvas.html
    this.ctx.fillStyle = "white";
    this.ctx.font = "24px Courier New";
    this.ctx.textAlign = "center";
    this.ctx.fillText("NEW GAME", this.canvas.width / 2, 200);
    this.ctx.fillText(
      "(Full menu rendering pending)",
      this.canvas.width / 2,
      300,
    );
    this.ctx.fillText("Click to start game", this.canvas.width / 2, 400);

    if (this.mouseHit1) {
      this.startGame();
    }
  }

  private renderLoadGame() {
    this.ctx.fillStyle = "white";
    this.ctx.font = "24px Courier New";
    this.ctx.textAlign = "center";
    this.ctx.fillText("LOAD GAME", this.canvas.width / 2, 300);
    this.ctx.fillText("(Not implemented)", this.canvas.width / 2, 350);
  }

  private renderOptions() {
    this.ctx.fillStyle = "white";
    this.ctx.font = "24px Courier New";
    this.ctx.textAlign = "center";
    this.ctx.fillText("OPTIONS", this.canvas.width / 2, 300);
    this.ctx.fillText("(Simplified)", this.canvas.width / 2, 350);
  }

  private handleMainMenuClick(index: number) {
    switch (index) {
      case 0: // NEW GAME
        this.mainMenuTab = 1;
        break;
      case 1: // LOAD GAME
        this.mainMenuTab = 2;
        break;
      case 2: // OPTIONS
        this.mainMenuTab = 3;
        break;
      case 3: // QUIT
        if (confirm("Are you sure you want to quit?")) {
          window.close();
        }
        break;
    }
  }

  private startGame() {
    if (this.randomSeed === "") {
      this.randomSeed = Math.floor(Math.random() * 1000000).toString();
    }

    console.log("[Menu] Starting game:", {
      seed: this.randomSeed,
      difficulty: this.selectedDifficulty,
      introEnabled: this.introEnabled,
    });

    if (this.onStartGame) {
      this.onStartGame({
        seed: this.randomSeed,
        difficulty: this.selectedDifficulty,
        introEnabled: this.introEnabled,
      });
    }
  }
}
