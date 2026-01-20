
const fs = require('fs');
const path = require('path');

// --- 1. MOCK BROWSER ENVIRONMENT ---
global.window = global;
global.self = global;
global.document = {
    getElementById: (id) => {
        // Return dummy canvas
        return {
            getContext: () => ({
                getExtension: () => { },
                getParameter: () => 0,
                createTexture: () => 1,
                bindTexture: () => { },
                texParameteri: () => { },
                texImage2D: () => { },
                clearColor: () => { },
                clear: () => { },
                enable: () => { },
                blendFunc: () => { },
                viewport: () => { },
                createBuffer: () => { },
                bindBuffer: () => { },
                bufferData: () => { },
                vertexAttribPointer: () => { },
                enableVertexAttribArray: () => { },
                drawArrays: () => { },
                drawElements: () => { },
                createProgram: () => { },
                createShader: () => { },
                shaderSource: () => { },
                compileShader: () => { },
                attachShader: () => { },
                linkProgram: () => { },
                useProgram: () => { },
                getUniformLocation: () => { },
                getAttribLocation: () => { },
                uniform1i: () => { },
                uniform1f: () => { },
                uniform3f: () => { },
                uniformMatrix4fv: () => { },
            }),
            width: 800,
            height: 600,
            style: {},
            parentElement: {
                appendChild: () => { }
            },
            listeners: {},
            addEventListener: (event, callback) => { },
            removeEventListener: () => { }
        };
    },
    createElement: (tag) => {
        if (tag === 'img') {
            return new (class MockImage {
                constructor() { this.src = ''; this.onload = null; this.onerror = null; }
            })();
        }
        if (tag === 'canvas') {
            return {
                style: {},
                width: 800,
                height: 600,
                getContext: () => ({
                    clearRect: () => { }
                })
            };
        }
        return { style: {} };
    },
    body: {
        appendChild: () => { }
    }
};

global.performance = {
    now: () => Date.now()
};

global.fetch = async (url) => {
    console.log(`[MockFetch] Loading: ${url}`);

    // Handle local file paths
    let filePath = url;
    // Removing any URL parameters or hashes
    filePath = filePath.split('?')[0].split('#')[0];

    // Resolve path relative to current directory if it's not absolute
    if (!path.isAbsolute(filePath)) {
        filePath = path.resolve(process.cwd(), filePath);
    }

    // Checking if file exists
    if (!fs.existsSync(filePath)) {
        return {
            ok: false,
            status: 404,
            statusText: 'Not Found',
            arrayBuffer: async () => new Uint8Array(0).buffer,
            headers: {
                get: () => null
            }
        };
    }

    const data = fs.readFileSync(filePath);
    return {
        ok: true,
        status: 200,
        arrayBuffer: async () => data.buffer,
        headers: {
            get: (name) => {
                if (name.toLowerCase() === 'content-length') return data.length;
                return null;
            }
        }
    };
};

global.HTMLImageElement = class { };
global.HTMLCanvasElement = class { };
global.HTMLElement = class { };

// Mock THREE.js if strictly needed by graphics.js (assumed for now it might be required)
// but let's try to run without it first, or mock it if runtime fails importing.
// The runtime seems to require ./graphics which might require THREE.
global.THREE = {
    Scene: class { },
    PerspectiveCamera: class { },
    WebGLRenderer: class { render() { } setSize() { } },
    AmbientLight: class { },
    DirectionalLight: class { },
    Mesh: class { },
    BoxGeometry: class { },
    MeshBasicMaterial: class { },
    TextureLoader: class { },
    LoadingManager: class { },
    Group: class { add() { } },
    Vector3: class { },
    Color: class { }
};


// --- 2. LOAD RUNTIME ---
const Blitz3D = require('./Sources/Runtime/modules/runtime.js');

// --- 3. CONFIGURE RUNTIME FOR TESTING ---

// Stub out specific graphics methods that might crash in Node
Blitz3D.init = function (canvasId) {
    console.log("[TestRunner] Initializing Runtime...");

    // Initialize core
    const Core = require('./Sources/Runtime/modules/core.js');
    this.core = new Core();
    this.core.init(canvasId); // Uses our mock document

    // Mock Graphics Module completely for this test?
    // Or let it try to initialize with our mock canvas.
    // Let's try to use the real graphics module but stub the heavy WebGL stuff if it fails.
    const Graphics = require('./Sources/Runtime/modules/graphics.js');
    this.graphics = new Graphics(this.core);

    // Override critical graphics methods to just log
    this.graphics.init3D = () => console.log("[Graphics] init3D implementation mocked for Node.");
    this.graphics.createMesh = () => { console.log("[Graphics] CreateMesh called"); return 1; };
    this.graphics.createSurface = (mesh) => { console.log(`[Graphics] CreateSurface for mesh ${mesh}`); return 1; };
    this.graphics.addVertex = (surf, x, y, z) => { return 1; }; // Silent for verbosity
    this.graphics.addTriangle = () => { return 1; };
    this.graphics.updateNormals = () => { };
    this.graphics.renderWorld = () => console.log("[Graphics] RenderWorld");
    this.graphics.flip = () => console.log("[Graphics] Flip");
    this.graphics.createTexture = () => 1;
    this.graphics.createBrush = () => 1;
    this.graphics.freeBrush = () => { };
    this.graphics.brushTexture = () => { };
    this.graphics.paintSurface = () => { };
    this.graphics.freeEntity = () => { };
    this.graphics.entityColor = () => { };

    // FileIO Stubs - Use Real FileIO if possible, or mock
    const FileIO = require('./Sources/Runtime/modules/fileio.js');
    this.fileIO = new FileIO(this.core);
    this.fileIO.init(process.cwd()); // Set base path to current directory

    // Hook up imports
    this.imports = {
        env: {},
        blitz3d: {},
        al: {}
    };

    // 1. Add Core Imports (PrintInt, StringConcat, etc.)
    this.core.setupCommonImports(this.imports);

    // 2. Add FileIO Imports
    Object.assign(this.imports.env, this.fileIO.createWASMImports().env);

    // 3. Add Custom/Graphics Stubs
    Object.assign(this.imports.env, {
        // Graphics Stubs
        Graphics3D: (w, h, d, m) => console.log(`[Graphics] Graphics3D ${w}x${h}`),
        SetBuffer: (b) => { },
        BackBuffer: () => 0,
        CreateCamera: (p) => { console.log("[Graphics] CreateCamera"); return 1; },
        PositionEntity: (e, x, y, z) => console.log(`[Graphics] PositionEntity ${e} at ${x},${y},${z}`),
        MoveEntity: () => { },
        TurnEntity: () => { },
        RotateEntity: () => { },
        CreateLight: () => 1,
        CameraClsColor: () => { },
        ClsColor: (r, g, b) => { },
        GetColor: (x, y) => 0,
        Color: (r, g, b) => { },
        Rect: (x, y, w, h, solid) => { },
        Oval: (x, y, w, h, solid) => { },
        Line: (x1, y1, x2, y2) => { },
        LoadImage: (ptr) => 1,
        DrawImage: (img, x, y, frame) => { },
        DrawBlock: (img, x, y, frame) => { },
        TileBlock: (img, x, y, frame) => { },
        TileImage: (img, x, y, frame) => { },
        ImageWidth: (img) => 100,
        ImageHeight: (img) => 100,
        RotateImage: (img, ang) => { },
        HandleImage: (img, x, y) => { },
        ScaleImage: (img, w, h) => { },
        ResizeImage: (img, w, h) => { },
        MaskImage: (img, r, g, b) => { },
        MidHandle: (img) => { },
        FreeImage: (img) => { },
        LoadFont: (ptr, height, bold, italic, underline) => 1,
        SetFont: (font) => { },
        FreeFont: (font) => { },
        StringWidth: (ptr) => 0,
        StringHeight: (ptr) => 0,
        FontWidth: () => 0,
        FontHeight: () => 0,
        UpdateWorld: () => { },
        RenderWorld: () => console.log("[Graphics] Rendering..."),
        Flip: () => { },
        Text: (x, y, ptr) => {
            const str = this.core.readString(ptr);
            console.log(`[TEXT OUPUT]: ${str}`);
        },
        End: () => { console.log("[Runtime] End called. Exiting."); process.exit(0); },
        RuntimeError: (ptr) => {
            const str = this.core.readString(ptr);
            console.error(`[Runtime Error] ${str}`);
            process.exit(1);
        },
        Print: (ptr) => {
            const str = this.core.readString(ptr);
            console.log(`[PRINT]: ${str}`);
        },

        // Texture stubs
        CreateTexture: () => 1,
        ScaleTexture: () => { },
        TextureBlend: () => { },
        TextureCoords: () => { },
        TextureWidth: (t) => 256,
        TextureHeight: (t) => 256,
        TextureName: (t) => 0,
        FreeTexture: (t) => { },

        // Mesh stubs handled by this.graphics overrides?
        // No, need to be in imports too
        CreateMesh: () => this.graphics.createMesh(),
        CreateCube: (p) => this.graphics.createMesh(),
        CreateSphere: (s, p) => this.graphics.createMesh(),
        CreateCylinder: (s, solid, p) => this.graphics.createMesh(),
        CreateCone: (s, solid, p) => this.graphics.createMesh(),
        CreateSprite: (p) => this.graphics.createMesh(),
        CreatePlane: (s, p) => this.graphics.createMesh(),
        CreateMirror: (p) => this.graphics.createMesh(),
        CreateSurface: (m) => this.graphics.createSurface(m),
        AddVertex: (s, x, y, z, u, v, w) => this.graphics.addVertex(s, x, y, z),
        AddTriangle: (s, v0, v1, v2) => this.graphics.addTriangle(s, v0, v1, v2),
        VertexColor: () => { },
        VertexTexCoords: () => { },
        CreateBrush: () => this.graphics.createBrush(),
        FreeBrush: (b) => this.graphics.freeBrush(b),
        BrushTexture: (b, t, f, i) => this.graphics.brushTexture(b, t, f, i),
        PaintSurface: (s, b) => this.graphics.paintSurface(s, b),
        FreeEntity: (e) => this.graphics.freeEntity(e),
        LoadTexture: (ptr) => {
            const path = this.core.readString(ptr);
            console.log(`[Graphics] LoadTexture: ${path}`);
            return 1; // Dummy handle
        },

        // Input Stubs
        KeyDown: () => 0,
        KeyHit: (k) => {
            if (k === 1) { // Escape
                // Return 1 after some frames to exit test?
                // For now return 0 to run loop
                return 0;
            }
            return 0;
        },

        // Time
        MilliSecs: () => Date.now(),
        // Camera
        CameraZoom: (cam, zoom) => { },
        CameraViewport: (cam, x, y, w, h) => { },
        CameraFogMode: (cam, mode) => { },
        CameraFogRange: (cam, near, far) => { },
        CameraProjMode: (cam, mode) => { },
        CameraRange: (cam, near, far) => { },
        CameraPick: (cam, x, y) => 0,

        // Entity
        EntityOrder: (ent, order) => { },
        EntityDistance: (e1, e2) => 0,
        EntityPitch: (e, gl) => 0,
        EntityYaw: (e, gl) => 0,
        EntityRoll: (e, gl) => 0,
        EntityX: (e, gl) => 0,
        EntityY: (e, gl) => 0,
        EntityZ: (e, gl) => 0,
        EntityAlpha: (e, a) => { },
        EntityColor: (e, r, g, b) => { },
        EntityParent: (e, p) => { },
        GetParent: (e) => 0,
        CreatePivot: (p) => 1,
        PaintMesh: (m, b) => { },
        PaintEntity: (e, b) => { },
        LightColor: (l, r, g, b) => { },
        AmbientLight: (r, g, b) => { },
        FogMode: (mode) => { },
        FogRange: (near, far) => { },
        FogColor: (r, g, b) => { },
        FogDensity: (d) => { },
        LightRange: (l, range) => { },
        LightConeAngles: (l, inner, outer) => { },
        EntityPick: (e, range) => 0,
        EntityType: (e, t, r) => { },
        EntityRadius: (e, r) => { },
        EntityFX: (e, fx) => { },
        EntityBlend: (e, b) => { },
        EntityTexture: (e, t, f, i) => { },
        ScaleEntity: (e, x, y, z) => { },
        NameEntity: (e, name) => { },
        EntityName: (e) => 0,
        CopyEntity: (e, p) => 1,
        HideEntity: (e) => { },
        ShowEntity: (e) => { },

        // Collision
        Collisions: (src, dest, method, response) => { },
        CollisionNX: (e, index) => 0,
        CollisionNY: (e, index) => 0,
        CollisionNZ: (e, index) => 0,
        CollisionTriangle: (e, index) => 0,
        CollisionEntity: (e, index) => 0,
        CollisionSurface: (e, index) => 0,
        CountCollisions: (e) => 0,

        // Texture/Image/Brush
        PositionTexture: (t, u, v) => { },
        RotateTexture: (t, ang) => { },
        ScaleTexture: (t, u, v) => { },
        BrushAlpha: (b, a) => { },
        BrushColor: (b, r, g, blu) => { },
        BrushShininess: (b, s) => { },
        BrushFX: (b, fx) => { },
        BrushBlend: (b, blend) => { },
        CreateBrush: (r, g, b) => 1,
        LoadBrush: (ptr, flags) => 1,
        AutoMidHandle: (enable) => { },
        GrabImage: (img, x, y) => { },
        SaveImage: (img, ptr, frame) => { },

        // Animation
        Animate: (e, mode, speed, seq, trans) => { },
        SetAnimTime: (e, time, seq) => { },
        AnimTime: (e) => 0,
        AnimSeq: (e) => 0,
        ExtractAnimSeq: (e, first, last, seq) => 0,

        // Input/System
        MouseHit: (btn) => 0,
        MouseDown: (btn) => 0,
        MouseX: () => 0,
        MouseY: () => 0,
        MouseZ: () => 0,
        MouseXSpeed: () => 0,
        MouseYSpeed: () => 0,
        MouseZSpeed: () => 0,
        MoveMouse: (x, y) => { },
        FlushMouse: () => { },
        FlushKeys: () => { },
        WaitKey: () => 0,
        ScanCode: () => 0,
        ShowPointer: () => { },
        HidePointer: () => { },

        // Misc
        OpenTCPStream: (server, port) => 0,
        CloseTCPStream: (stream) => { },
        ReadAvail: (stream) => 0,
        CopyBank: (src, src_p, dest, dest_p, count) => { }, // Core might implement, but stub if missing
        ResizeBank: (b, s) => { },
        BankSize: (b) => 0,

        // Time/System
        Delay: (ms) => { },

        // Audio (if not covered by core)
        Load3DSound: (ptr) => 0,
        EmitSound: (snd, e) => 0,

    });
};


// --- 4. EXECUTE ---
async function run() {
    const wasmPath = '/Users/jack/Software/scp_port/scpcb/TestLoadRMesh.wasm';

    console.log("Starting execution...");
    try {
        await Blitz3D.load(wasmPath, "dummy-canvas");

        // Ensure FileIO has memory access
        Blitz3D.fileIO.setMemory(Blitz3D.core.memory);

        console.log("WASM execution started.");
    } catch (e) {
        console.error("Execution failed:", e);
    }
}

run();
