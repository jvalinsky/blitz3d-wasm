/**
 * SCPCB-specific runtime functions.
 *
 * This module implements (or stubs) the game-specific functions used by
 * SCP: Containment Breach that are not part of standard Blitz3D.
 */

import { Blitz3DGraphicsInterface } from "../types.ts";

/**
 * Install SCPCB-specific WASM imports.
 *
 * These are game-specific functions that SCPCB uses for:
 * - Console messages
 * - Item/NPC management
 * - Door systems
 * - Audio (MTF, horror, intro, step sounds)
 * - Map generation
 * - UI/Gadgets
 * - And much more...
 */
export function setupSCPCB(graphics: Blitz3DGraphicsInterface, imports: any) {
    // Ensure namespace exists
    if (!imports.env) imports.env = {};
    if (!imports.blitz3d) imports.blitz3d = {};

    // ============================================================
    // CONSOLE SYSTEM
    // ============================================================

    /** Creates a console message in the in-game console */
    imports.env.CreateConsoleMsg = (msg: number, type: number = 0) => {
        const text = graphics.core?.readString?.(msg) || "";
        console.log(`[SCPCB Console ${type}] ${text}`);
        return 0;
    };

    // ============================================================
    // ITEM SYSTEM
    // ============================================================

    /** Creates an item in the game world */
    imports.env.CreateItem = (
        itemName: number,
        templateName: number,
        x: number,
        y: number,
        z: number,
    ) => {
        const name = graphics.core?.readString?.(itemName) || "unknown";
        const template = graphics.core?.readString?.(templateName) || "";
        console.log(`[SCPCB Item] Created ${name} (${template}) at ${x},${y},${z}`);
        return 0;
    };

    /** Removes an item from the game */
    imports.env.RemoveItem = (item: number) => {
        console.log(`[SCPCB Item] Removed item ${item}`);
        return 0;
    };

    /** Gets player inventory state */
    imports.env.Inventory = () => {
        return 0;
    };

    /** Creates an item template */
    imports.env.CreateItemTemplate = (
        name: number,
        tempName: number,
        displayName: number,
    ) => {
        const n = graphics.core?.readString?.(name) || "";
        const tn = graphics.core?.readString?.(tempName) || "";
        const dn = graphics.core?.readString?.(displayName) || "";
        console.log(`[SCPCB ItemTemplate] ${n} (${tn}) display: ${dn}`);
        return 0;
    };

    // ============================================================
    // NPC SYSTEM
    // ============================================================

    /** Creates an NPC */
    imports.env.CreateNPC = (npcType: number, x: number, y: number, z: number) => {
        console.log(`[SCPCB NPC] Created NPC type ${npcType} at ${x},${y},${z}`);
        return 0;
    };

    /** Removes an NPC from the game */
    imports.env.RemoveNPC = (npc: number) => {
        console.log(`[SCPCB NPC] Removed NPC ${npc}`);
        return 0;
    };

    /** Animates an NPC with specific animation */
    imports.env.AnimateNPC = (
        npc: number,
        startFrame: number,
        endFrame: number,
        speed: number,
    ) => {
        return 0;
    };

    /** Sets the animation frame for an NPC */
    imports.env.SetNPCFrame = (npc: number, frame: number) => {
        return 0;
    };

    /** Changes the texture ID for an NPC */
    imports.env.ChangeNPCTextureID = (npc: number, textureId: number) => {
        return 0;
    };

    // ============================================================
    // DOOR SYSTEM
    // ============================================================

    /** Creates a door in the facility */
    imports.env.CreateDoor = (
        x: number,
        y: number,
        z: number,
        yaw: number,
        locked: number,
    ) => {
        console.log(`[SCPCB Door] Created door at ${x},${y},${z} yaw=${yaw} locked=${locked}`);
        return 0;
    };

    /** Uses/opens a door */
    imports.env.UseDoor = (door: number, player: number) => {
        console.log(`[SCPCB Door] Door ${door} used by player ${player}`);
        return 0;
    };

    /** Plays door open sound */
    imports.env.OpenDoorSFX = (door: number, locked: number) => {
        return 0;
    };

    /** Updates door states */
    imports.env.UpdateDoors = () => {
        return 0;
    };

    /** Updates elevators */
    imports.env.UpdateElevators = () => {
        return 0;
    };

    // ============================================================
    // EVENT SYSTEM
    // ============================================================

    /** Creates a game event */
    imports.env.CreateEvent = (eventName: number, id: number, room: number) => {
        const name = graphics.core?.readString?.(eventName) || "";
        console.log(`[SCPCB Event] Created event ${name} id=${id} room=${room}`);
        return 0;
    };

    /** Gets event source */
    imports.env.EventSource = () => {
        return 0;
    };

    /** Gets map event */
    imports.env.MapEvent = () => {
        return 0;
    };

    /** Gets map event probability */
    imports.env.MapEventProb = () => {
        return 0;
    };

    // ============================================================
    // MAP SYSTEM
    // ============================================================

    /** Gets map template value */
    imports.env.MapTemp = () => {
        return 0;
    };

    /** Gets map room */
    imports.env.MapRoom = () => {
        return 0;
    };

    /** Gets map room ID */
    imports.env.MapRoomID = () => {
        return 0;
    };

    /** Gets map name */
    imports.env.MapName = () => {
        return 0;
    };

    /** Gets map angle */
    imports.env.MapAngle = () => {
        return 0;
    };

    /** Creates a room */
    imports.env.CreateRoom = (
        zone: number,
        roomTemplate: number,
        x: number,
        y: number,
        z: number,
        yaw: number,
    ) => {
        const template = graphics.core?.readString?.(roomTemplate) || "";
        console.log(`[SCPCB Room] Created room ${template} zone=${zone} at ${x},${y},${z} yaw=${yaw}`);
        return 0;
    };

    /** Sets room properties */
    imports.env.SetRoom = (room: number, property: number) => {
        return 0;
    };

    /** Updates rooms */
    imports.env.UpdateRooms = () => {
        return 0;
    };

    /** Creates a room template */
    imports.env.CreateRoomTemplate = (name: number) => {
        const n = graphics.core?.readString?.(name) || "";
        console.log(`[SCPCB RoomTemplate] ${n}`);
        return 0;
    };

    /** Forest placement for map generation */
    imports.env.ForestPlace = (room: number, x: number, z: number) => {
        return 0;
    };

    imports.env.ForestPlaceAngle = (room: number, angle: number) => {
        return 0;
    };

    /** Gets zone information */
    imports.env.GetZone = (y: number) => {
        return 0;
    };

    /** Map icons for the facility map */
    imports.env.MapIcons = () => {
        return 0;
    };

    // ============================================================
    // MTF (Mobile Task Force) SYSTEM
    // ============================================================

    /** Plays MTF sound effect */
    imports.env.PlayMTFSound = (sound: number, npc: number) => {
        return 0;
    };

    /** MTF sound effect */
    imports.env.MTFSFX = (sound: number, x: number, y: number, z: number) => {
        return 0;
    };

    /** MTF room tracking */
    imports.env.MTRoom = () => {
        return 0;
    };

    imports.env.MTRoomAngle = () => {
        return 0;
    };

    // ============================================================
    // AUDIO SYSTEM
    // ============================================================

    /** Horror sound effects */
    imports.env.HorrorSFX = (sound: number, x: number, y: number, z: number) => {
        return 0;
    };

    /** Intro sound effects */
    imports.env.IntroSFX = (sound: number) => {
        return 0;
    };

    /** Step sound effects */
    imports.env.StepSFX = (
        player: number,
        material: number,
        run: number,
        x: number,
        y: number,
        z: number,
    ) => {
        return 0;
    };

    imports.env.Step2SFX = (player: number, material: number, run: number) => {
        return 0;
    };

    /** Pick up item sound */
    imports.env.PickSFX = (item: number, player: number) => {
        return 0;
    };

    /** Old man (SCP-106) sound effects */
    imports.env.OldManSFX = (sound: number, x: number, y: number, z: number) => {
        return 0;
    };

    /** Radio state tracking */
    imports.env.RadioState = () => {
        return 0;
    };

    imports.env.RadioState4 = () => {
        return 0;
    };

    imports.env.RadioChn = () => {
        return 0;
    };

    /** Music playback */
    imports.env.Music = (track: number) => {
        const trackName = graphics.core?.readString?.(track) || "";
        console.log(`[SCPCB Music] Playing: ${trackName}`);
        return 0;
    };

    /** Ambient SFX amount */
    imports.env.AmbientSFXAmount = () => {
        return 0;
    };

    // ============================================================
    // UI/GADGET SYSTEM
    // ============================================================

    /** Draws a button on screen */
    imports.env.DrawButton = (
        x: number,
        y: number,
        width: number,
        height: number,
        text: number,
    ) => {
        // UI: Draw filled rect + text
        if (imports.env.Color) imports.env.Color(50, 50, 50); // button bg
        if (imports.env.Rect) imports.env.Rect(x, y, width, height, 1);
        if (imports.env.Color) imports.env.Color(255, 255, 255); // text color
        if (imports.env.Text) imports.env.Text(x + width / 2, y + height / 2, text, 1, 1);
        return 1;
    };

    /** Creates a button */
    imports.env.CreateButton = (x: number, y: number, width: number, height: number) => {
        return 0;
    };

    /** Draws a frame/box */
    imports.env.DrawFrame = (x: number, y: number, width: number, height: number) => {
        if (imports.env.Rect) imports.env.Rect(x, y, width, height, 0); // Hollow rect
        return 0;
    };

    /** Draws a tick/checkbox */
    imports.env.DrawTick = (x: number, y: number, checked: number) => {
        if (imports.env.Rect) imports.env.Rect(x, y, 10, 10, 1); // Simple box
        // if checked could draw internal box, but simple solid rect is good enough for verification
        return 0;
    };

    /** Creates a label */
    imports.env.CreateLabel = (text: number, x: number, y: number) => {
        return 0;
    };

    /** Gets gadget X position */
    imports.env.GadgetX = (gadget: number) => {
        return 0;
    };

    /** Gets gadget Y position */
    imports.env.GadgetY = (gadget: number) => {
        return 0;
    };

    /** Draws options tooltip */
    imports.env.DrawOptionsTooltip = (x: number, y: number, option: number) => {
        return 0;
    };

    /** Draws loading screen */
    imports.env.DrawLoading = (percent: number) => {
        return 0;
    };

    /** Input box for text entry */
    imports.env.InputBox = (title: number, prompt: number, defaultText: number) => {
        return 0;
    };

    /** Slider bar */
    imports.env.SlideBar = (x: number, y: number, width: number, value: number) => {
        return 0;
    };

    /** Mouse scaling for different resolutions */
    imports.env.ScaledMouseX = () => {
        return (graphics.core?.input as any)?.mouseX || 0;
    };

    imports.env.ScaledMouseY = () => {
        return (graphics.core?.input as any)?.mouseY || 0;
    };

    /** Checks if mouse is on a gadget */
    imports.env.MouseOn = () => {
        return 0;
    };

    /** Button state checking */
    imports.env.Button = () => {
        return 0;
    };

    // ============================================================
    // RENDERING/DECAL SYSTEM
    // ============================================================

    /** Creates a decal (blood, etc.) */
    imports.env.CreateDecal = (
        decalType: number,
        x: number,
        y: number,
        z: number,
        pitch: number,
        yaw: number,
        roll: number,
    ) => {
        return 0;
    };

    /** Creates a particle effect */
    imports.env.CreateParticle = (
        x: number,
        y: number,
        z: number,
        template: number,
        count: number,
    ) => {
        return 0;
    };

    // ============================================================
    // INI/CONFIG SYSTEM
    // ============================================================

    /** Puts a value in an INI file */
    imports.env.PutINIValue = (
        file: number,
        section: number,
        key: number,
        value: number,
    ) => {
        const f = graphics.core?.readString?.(file) || "";
        const s = graphics.core?.readString?.(section) || "";
        const k = graphics.core?.readString?.(key) || "";
        const v = graphics.core?.readString?.(value) || "";
        console.log(`[SCPCB INI] ${f}[${s}].${k} = ${v}`);
        return 0;
    };

    /** Gets a float from INI */
    imports.env.GetINIFloat = (file: number, section: number, key: number) => {
        return 0;
    };

    /** Gets a string from INI */
    imports.env.GetINIString = (file: number, section: number, key: number) => {
        return 0;
    };

    /** Gets a string from INI (variant 2) */
    imports.env.GetINIString2 = (file: number, section: number, key: number) => {
        return 0;
    };

    // ============================================================
    // ANIMATION
    // ============================================================

    /** Animate2 - alternative animation function */
    imports.env.Animate2 = (
        entity: number,
        mode: number,
        speed: number,
    ) => {
        return 0;
    };

    /** Finish walking animation */
    imports.env.FinishWalking = (entity: number, frame: number, speed: number) => {
        return 0;
    };

    // ============================================================
    // PATHFINDING
    // ============================================================

    /** Finds path for NPC navigation */
    imports.env.FindPath = (
        npc: number,
        startX: number,
        startY: number,
        startZ: number,
        endX: number,
        endY: number,
        endZ: number,
    ) => {
        return 0;
    };

    // ============================================================
    // MESH/SURFACE
    // ============================================================

    /** Creates a surface for mesh building */
    imports.env.CreateSurface = (mesh: number, brush: number) => {
        return 0;
    };

    /** Adds a vertex to a surface */
    imports.env.AddVertex = (
        surface: number,
        x: number,
        y: number,
        z: number,
        u: number,
        v: number,
    ) => {
        return 0;
    };

    /** Adds a triangle to a surface */
    imports.env.AddTriangle = (
        surface: number,
        v0: number,
        v1: number,
        v2: number,
    ) => {
        return 0;
    };

    /** Gets vertex of a triangle */
    imports.env.TriangleVertex = (surface: number, triangle: number, vertex: number) => {
        return 0;
    };

    /** Gets brush from surface */
    imports.env.GetSurfaceBrush = (surface: number) => {
        return 0;
    };

    /** Gets texture from brush */
    imports.env.GetBrushTexture = (brush: number, index: number) => {
        return 0;
    };

    // ============================================================
    // TRANSFORMATION
    // ============================================================

    /** Transforms a vector */
    imports.env.TFormVector = (x: number, y: number, z: number, source: number, dest: number) => {
        return 0;
    };

    /** Gets transformed X coordinate */
    imports.env.TFormedX = () => {
        return 0;
    };

    /** Gets transformed Y coordinate */
    imports.env.TFormedY = () => {
        return 0;
    };

    /** Gets transformed Z coordinate */
    imports.env.TFormedZ = () => {
        return 0;
    };

    // ============================================================
    // TELEPORTATION
    // ============================================================

    /** Teleports an entity to a new position */
    imports.env.TeleportEntity = (
        entity: number,
        x: number,
        y: number,
        z: number,
    ) => {
        return 0;
    };

    // ============================================================
    // KILL/DEATH SYSTEM
    // ============================================================

    /** Kills an entity/player */
    imports.env.Kill = (entity: number) => {
        console.log(`[SCPCB] Entity ${entity} killed`);
        return 0;
    };

    // ============================================================
    // DIFFICULTY/ACHIEVEMENTS
    // ============================================================

    /** Gets/sets difficulty */
    imports.env.Difficulties = (diff: number) => {
        return 0;
    };

    /** Gives an achievement */
    imports.env.GiveAchievement = (achievement: number) => {
        const ach = graphics.core?.readString?.(achievement) || "";
        console.log(`[SCPCB Achievement] Unlocked: ${ach}`);
        return 0;
    };

    // ============================================================
    // SECURITY CAMERAS
    // ============================================================

    /** Creates a security camera */
    imports.env.CreateSecurityCam = (
        x: number,
        y: number,
        z: number,
        yaw: number,
    ) => {
        console.log(`[SCPCB SecurityCam] Created at ${x},${y},${z} yaw=${yaw}`);
        return 0;
    };

    // ============================================================
    // LEVERS
    // ============================================================

    /** Updates a lever state */
    imports.env.UpdateLever = (lever: number) => {
        return 0;
    };

    // ============================================================
    // TEXTURE UTILITIES
    // ============================================================

    /** Gets texture name */
    imports.env.TextureName = (texture: number) => {
        return 0;
    };

    // ============================================================
    // STRING UTILITIES
    // ============================================================

    /** Strips path from filename */
    imports.env.StripPath = (path: number) => {
        const p = graphics.core?.readString?.(path) || "";
        const parts = p.split(/[\\/]/);
        return graphics.core?.allocString?.(parts[parts.length - 1]) || 0;
    };

    /** Float to string conversion */
    imports.env.F2S = (value: number, decimals: number) => {
        const s = value.toFixed(decimals);
        return graphics.core?.allocString?.(s) || 0;
    };

    // ============================================================
    // ENTITY UTILITIES
    // ============================================================

    /** Checks if entity is in view */
    imports.env.EntityInView = (entity: number, camera: number) => {
        return 1; // Always visible for now
    };

    // ============================================================
    // TUNNEL/OBJ SYSTEM
    // ============================================================

    /** Object tunnel system */
    imports.env.ObjTunnel = () => {
        return 0;
    };

    /** Map piece */
    imports.env.Piece = () => {
        return 0;
    };

    // ============================================================
    // ITEM USAGE
    // ============================================================

    /** Checks if item can be used */
    imports.env.CanUseItem = (item: number, player: number) => {
        return 1;
    };

    /** Uses an item */
    imports.env.UseItem = (item: number, player: number) => {
        return 0;
    };

    // ============================================================
    // KEY/INPUT
    // ============================================================

    /** Key value from input */
    imports.env.KeyValue = () => {
        return 0;
    };

    // ============================================================
    // NOT OPERATOR (Boolean)
    // ============================================================

    /** Boolean NOT operation */
    imports.env.Not = (value: number) => {
        return value ? 0 : 1;
    };

    // ============================================================
    // TEMPLATE
    // ============================================================

    /** Gets template information */
    imports.env.Template = () => {
        return 0;
    };

    // ============================================================
    // LOADING RMesh
    // ============================================================

    /** Loads an RMesh file */
    imports.env.LoadRMesh = (file: number) => {
        // Alias to standard LoadMesh
        if (imports.env.LoadMesh) return imports.env.LoadMesh(file, 0);
        return 0;
    };

    // ============================================================
    // AA Font Loading
    // ============================================================

    /** Loads anti-aliased font */
    imports.env.AALoadFont = (name: number, size: number) => {
        // Alias to standard LoadFont
        if (imports.env.LoadFont) return imports.env.LoadFont(name, size, 0, 0);
        return 0;
    };

    // ============================================================
    // UNCAUGHT (Error handling)
    // ============================================================

    /** Uncaught exception handler placeholder */
    imports.env.Uncaught = () => {
        return 0;
    };

    // ============================================================
    // ADDITIONAL SCPCB FUNCTIONS (Batch 2)
    // ============================================================

    imports.env.Map = () => 0;
    imports.env.Achievements = () => 0;
    imports.env.Arrows = () => 0;
    imports.env.ForestIcons = () => 0;
    imports.env.GetNPCManipulationValue = () => 0;
    imports.env.RadioState3 = () => 0;
    imports.env.UpdateDecals = () => 0;
    imports.env.AmbientSFX = () => 0;
    imports.env.CreateEmitter = () => 0;
    imports.env.GfxModeWidths = () => 0;
    imports.env.MapFound = () => 0;
    imports.env.NavImages = () => 0;
    imports.env.OtherNPCSeesMeNPC = () => 0;
    imports.env.CoughSFX = () => 0;
    imports.env.GetStringOfMatElement = () => 0;
    imports.env.LightSpriteTex = () => 0;
    imports.env.ScaleRender = () => 0;
    imports.env.SelectedGadgetItem = () => 0;
    imports.env.SpecialIcons = () => 0;
    imports.env.AlarmSFX = () => 0;
    imports.env.CreateWaypoint = () => 0;
    imports.env.DecalTextures = () => 0;
    imports.env.DropItem = () => 0;
    imports.env.GetINIInt2 = () => 0;
    imports.env.GfxModeHeights = () => 0;
    imports.env.ParticleTextures = () => 0;
    imports.env.PlayerInReachableRoom = () => 0;
    imports.env.RowText = (x: number, y: number, text: number) => {
        // Wrapper for FastText RowText -> Standard Text
        if (imports.env.Text) imports.env.Text(x, y, text, 0, 0);
        return 0;
    };
    imports.env.SetSaveMsg = () => 0;
    imports.env.ArrowImg = () => 0;
    imports.env.BigDoorObj = () => 0;
    imports.env.CloseDoorSFX = () => 0;
    imports.env.Corrupted = () => 0;
    imports.env.CountVertices = () => 0;
    imports.env.DecaySFX = () => 0;
    imports.env.Load_Terrain = () => 0;
    imports.env.Move_Forward = () => 0;
    imports.env.OldAIPics = () => 0;
    imports.env.SaveMap = () => 0;
    imports.env.To = () => 0;
    imports.env.VertexX = () => 0;
    imports.env.VertexZ = () => 0;
    imports.env.AngleDist = () => 0;
    imports.env.CalculateRoomExtents = () => 0;
    imports.env.DamageSFX = () => 0;
    imports.env.DrawArrowIcon = () => 0;
    imports.env.False = () => 0;
    imports.env.GetLineAmount2 = () => 0;
    imports.env.MeshCullBox = () => 0;
    imports.env.NeckSnapSFX = () => 0;
    imports.env.RadioSFX = () => 0;
    imports.env.ResizeImage2 = () => 0;
    imports.env.SliderValue = () => 0;
    imports.env.Slot = () => 0;
    imports.env.True = () => 1;
    imports.env.BreathSFX = () => 0;
    imports.env.BreathSFX = () => 0;
    // imports.env.CameraFogColor via 3d.ts
    imports.env.DrawTiledImageRect = (img: number, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number) => {
        // Adapter: Map TiledImageRect to DrawImageRect (no scaling/tiling support yet, but draws once)
        // Params: image, srcX, srcY, srcW, srcH, destX, destY, destW, destH
        // DrawImageRect: image, x, y, rectX, rectY, rectW, rectH
        if (imports.env.DrawImageRect) {
            imports.env.DrawImageRect(img, dx, dy, sx, sy, sw, sh);
        }
        return 0;
    };
    // imports.env.Readdir = () => 0; // Use core implementation
    imports.env.Room = () => 0;
    imports.env.SaveGames = () => 0;
    imports.env.SaveGameVersion = () => 0;
    imports.env.Sector = () => 0;
    imports.env.SetSliderValue = () => 0;
    imports.env.SetStatusText = (text: number) => {
        const str = graphics.core.readString?.(text) || "";
        console.log(`[Status] ${str}`);
        // Optional: Draw at bottom of screen?
        if (imports.env.Text) imports.env.Text(10, 580, text, 0, 0);
        return 0;
    };
    imports.env.SetTemplateSize = () => 0;
    imports.env.ShortLine = () => 0;
    imports.env.TFormPoint = () => 0;
    imports.env.UpdateRemoteFile = () => 0;
    imports.env.VectorYaw = () => 0;
    imports.env.AchvImg = () => 0;
    imports.env.AddTempLight = () => 0;
    imports.env.AddTextureToCache = () => 0;
    imports.env.AddTextureToCache = () => 0;
    // imports.env.CameraFogMode via 3d.ts
    imports.env.CountTriangles = () => 0;
    imports.env.CreateMenu = () => 0;
    imports.env.Data = () => 0;
    imports.env.GetStepSound = () => 0;
    imports.env.HeavyDoorObj = () => 0;
    imports.env.MeNPCSeesPlayer = () => 0;
    imports.env.MenuBlinkTimer = () => 0;
    imports.env.ResizeRemoteBank = () => 0;
    imports.env.ResumeSounds = () => 0;
    imports.env.SavedMaps = () => 0;
    imports.env.Stream = () => 0;
    imports.env.TeleportCloser = () => 0;
    imports.env.TurnCheckpointMonitorsOff = () => 0;
    imports.env.CopyImage = () => 0;
    imports.env.CreateBrush = () => 0;
    imports.env.CreateTextField = () => 0;
    imports.env.CurrentTime = () => 0;
    imports.env.GenerateSeedNumber = () => 0;
    imports.env.GetCache = () => 0;
    imports.env.GfxModeHeight = () => 0;
    imports.env.GfxModeWidth = () => 0;
    imports.env.LoadRoomTemplates = () => 1; // Return success to verify if logic proceeds
    imports.env.LSet = () => 0;
    imports.env.NullGame = () => 0;
    imports.env.ProjectedY = () => 0;
    imports.env.RemoveDoor = () => 0;
    imports.env.RoomTemplates = () => 0;
    imports.env.RowText2 = () => 0;
    imports.env.SetTemplateEmitterBlend = () => 0;
    imports.env.SetTemplateEmitterLifetime = () => 0;
    imports.env.SetTemplateInterval = () => 0;
    imports.env.SetTemplateOffset = () => 0;
    imports.env.SetTemplateParticleLifetime = () => 0;
    imports.env.SetTemplateVelocity = () => 0;
    imports.env.Shoot = () => 0;
    imports.env.UpdateStreamSoundOrigin = () => 0;
    imports.env.VertexY = () => 0;
    imports.env.AmbientLightRooms = () => 0;
    imports.env.API_SetWindowPos = () => 0;
    imports.env.Chance = () => 0;
    imports.env.CheckRoomOverlap = () => 0;
    imports.env.CreateChunk = () => 0;
    imports.env.CreatePropObj = () => 0;
    imports.env.CreateTemplate = () => 0;
    imports.env.CreateWindow = () => 0;
    imports.env.DripSFX = () => 0;
    imports.env.File_GetFilename = () => 0;
    imports.env.GetINISectionLocation = () => 0;
    imports.env.GorePics = () => 0;
    imports.env.Graphics3DExt = () => 0;
    imports.env.INI_CreateKey = () => 0;
    imports.env.INI_CreateSection = () => 0;
    imports.env.INI_FileToString = () => 0;
    imports.env.InitEvents = () => 0;
    imports.env.InitWaypoints = () => 0;
    imports.env.InsertGadgetItem = () => 0;
    imports.env.IsRoomAdjacent = () => 0;
    imports.env.LoadRoomMesh = (file: number, parent: number) => {
        // Alias to standard LoadMesh
        if (imports.env.LoadMesh) return imports.env.LoadMesh(file, parent || 0);
        return 0;
    };
    imports.env.LoadSaveGames = () => 0;
    imports.env.MyFunc = () => 0;
    imports.env.PauseSounds = () => 0;
    imports.env.Rooms = () => 0;
    imports.env.SetEmitter = () => 0;
    imports.env.SetTemplateAlphaVel = () => 0;
    imports.env.SetTemplateSizeVel = () => 0;
    imports.env.SetTemplateTexture = () => 0;
    imports.env.Sky_CreateSky = () => 0;
    imports.env.UpdateMusic = () => 0;
    imports.env.UpdateRoomLights = () => 0;
    imports.env.AchievementDescs = () => 0;
    imports.env.AchievementStrings = () => 0;
    imports.env.API_SetWindowLong = () => 0;
    // BlitzMovie_* functions are provided by core.ts -> VideoRuntime
    imports.env.ButtonState = () => 0;
    imports.env.ButtonState = () => 0;
    // imports.env.CameraFogRange via 3d.ts
    imports.env.ControlSoundVolume = () => 0;
    imports.env.DestroyForest = () => 0;
    imports.env.Download = () => 0;
    imports.env.DrawPortal = () => 0;
    imports.env.Effect = () => 0;
    imports.env.EntityScaleX = () => 0;
    imports.env.EntityScaleY = () => 0;
    imports.env.EntityScaleZ = () => 0;
    imports.env.EraseMap = () => 0;
    imports.env.EventData = () => 0;
    imports.env.File_ConvertSlashes = () => 0;
    imports.env.FillRoom = () => 0;
    imports.env.FloatArr = () => 0;
    imports.env.Found = () => 0;
    imports.env.FreeTexture = () => 0;
    imports.env.GetLineAmount = () => 0;
    imports.env.GetMeshExtents = () => 0;
    imports.env.GetTextureFromCache = () => 0;
    imports.env.H = () => 0;
    imports.env.HideChunks = () => 0;
    imports.env.LoadAnimTexture = () => 0;
    imports.env.LoadAnimTexture = () => 0;
    imports.env.LoadFont_Strict = (name: number, size: number, bold: number, italic: number, under: number) => {
        if (imports.env.LoadFont) return imports.env.LoadFont(name, size, bold, italic, under);
        return 0;
    };
    imports.env.LoadMap = () => 0;
    imports.env.LoadMaterials = () => 0;
    imports.env.LoadWorld = () => 0;
    imports.env.MakeCollBox = () => 0;
    imports.env.MenuBlinkDuration = () => 0;
    imports.env.MenuChecked = () => 0;
    imports.env.NextFile = () => 0;
    imports.env.PeekString = () => 0;
    imports.env.PickItem = () => 0;
    imports.env.PlaceRoom = () => 0;
    imports.env.ProjectedX = () => 0;
    imports.env.ReadRemoteLine = () => 0;
    imports.env.RequestFile = () => 0;
    imports.env.ResetInput = () => 0;
    imports.env.RMesh = () => 0;
    imports.env.RustleSFX = () => 0;
    imports.env.SaveGame = () => 0;
    imports.env.SaveOptionsINI = () => 0;
    imports.env.SaveRoomMesh = () => 0;
    imports.env.SetGadgetText = () => 0;
    imports.env.SetTemplateGravity = () => 0;
    imports.env.Sound = () => 0;
    imports.env.StripFilename = () => 0;
    imports.env.TextAreaText = () => 0;
    imports.env.TextFieldText = () => 0;

    console.log("[SCPCB Runtime] Initialized with 200+ game-specific functions");
}
