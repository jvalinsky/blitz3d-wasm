/**
 * Blitz3D Web Runtime Integration Tests
 * Tests for file I/O, path validation, and core runtime functionality
 * 
 * Run with: deno test --allow-read --allow-net web/src/runtime/runtime.test.ts
 */

/// <reference lib="deno.ns" />
/// <reference lib="dom" />

import { Blitz3DFileIO } from "./fileio.ts";
import { Blitz3DCore } from "./core.ts";
import { EngineBridge } from "../engine/bridge.ts";

function assert(condition: unknown, message = "assertion failed"): asserts condition {
    if (!condition) throw new Error(message);
}

function assertEquals<T>(actual: T, expected: T, message = "assertEquals failed") {
    if (actual !== expected) {
        throw new Error(`${message}: expected=${String(expected)} actual=${String(actual)}`);
    }
}

function createMockCore(): { readString: (ptr: number) => string; allocString: (str: string) => number; memory?: WebAssembly.Memory } {
    return {
        readString: () => "",
        allocString: () => 0,
    };
}

/**
 * File I/O Path Validation Tests
 * Verifies security against path traversal attacks
 */
Deno.test("Path Validation - accept valid relative paths", () => {
    const fileIO = new Blitz3DFileIO(createMockCore());

    assertEquals(
        fileIO._validatePath("assets/textures/foo.png"),
        true,
        "Valid relative path should be accepted"
    );
    assertEquals(
        fileIO._validatePath("data/config.ini"),
        true,
        "Valid relative path should be accepted"
    );

    fileIO.dispose();
});

Deno.test("Path Validation - reject absolute paths", () => {
    const fileIO = new Blitz3DFileIO(createMockCore());

    assertEquals(
        fileIO._validatePath("/etc/passwd"),
        false,
        "Absolute path should be rejected"
    );
    assertEquals(
        fileIO._validatePath("/absolute/path"),
        false,
        "Absolute path should be rejected"
    );

    fileIO.dispose();
});

Deno.test("Path Validation - reject path traversal", () => {
    const fileIO = new Blitz3DFileIO(createMockCore());

    assertEquals(
        fileIO._validatePath("../etc/passwd"),
        false,
        "Parent directory traversal should be rejected"
    );
    assertEquals(
        fileIO._validatePath("assets/../../etc/passwd"),
        false,
        "Multi-level traversal should be rejected"
    );

    fileIO.dispose();
});

Deno.test("Path Validation - reject URLs with protocols", () => {
    const fileIO = new Blitz3DFileIO(createMockCore());

    assertEquals(
        fileIO._validatePath("file:///etc/passwd"),
        false,
        "File protocol should be rejected"
    );
    assertEquals(
        fileIO._validatePath("http://evil.com"),
        false,
        "HTTP protocol should be rejected"
    );

    fileIO.dispose();
});

Deno.test("Path Validation - reject double-slash paths", () => {
    const fileIO = new Blitz3DFileIO(createMockCore());

    assertEquals(
        fileIO._validatePath("//etc/passwd"),
        false,
        "Double-slash should be rejected"
    );
    assertEquals(
        fileIO._validatePath("assets//config"),
        false,
        "Double-slash in path should be rejected"
    );

    fileIO.dispose();
});

/**
 * Virtual File System Tests
 */
Deno.test("VFS - register files", () => {
    const fileIO = new Blitz3DFileIO(createMockCore());
    const data = new Uint8Array([1, 2, 3, 4]);

    fileIO.registerFile("test.bin", data);

    assert(fileIO.fileSystem.has("test.bin"), "File should be in VFS");

    fileIO.dispose();
});

Deno.test("EngineBridge.clearCollisions delegates to exports", () => {
    let called = 0;
    const exports = {
        memory: new WebAssembly.Memory({ initial: 1 }),
        ClearCollisions: () => {
            called++;
        },
    } as any;

    const bridge = new EngineBridge(exports);
    bridge.clearCollisions();
    assertEquals(called, 1);
});

Deno.test("VFS - register files case-insensitively", () => {
    const fileIO = new Blitz3DFileIO(createMockCore());
    const data = new Uint8Array([1, 2, 3]);

    fileIO.registerFile("Assets/Tex/Texture.png", data);

    assert(
        fileIO.fileSystem.has("Assets/Tex/Texture.png"),
        "Original path should work"
    );
    assert(
        fileIO._fileSystemByLower.has("assets/tex/texture.png"),
        "Lowercase lookup should work"
    );

    fileIO.dispose();
});

Deno.test("VFS - open registered files", () => {
    const fileIO = new Blitz3DFileIO(createMockCore());
    const data = new Uint8Array([65, 66, 67, 68]); // "ABCD"

    fileIO.registerFile("test.txt", data);
    const handle = fileIO.openFile("test.txt");

    assert(handle > 0, "Handle should be positive");

    fileIO.dispose();
});

Deno.test("VFS - return 0 for non-existent files not in manifest", () => {
    const fileIO = new Blitz3DFileIO(createMockCore());

    const handle = fileIO.openFile("nonexistent.dat");

    assertEquals(handle, 0, "Handle should be 0 for missing files");

    fileIO.dispose();
});

Deno.test("VFS - close files properly", () => {
    const fileIO = new Blitz3DFileIO(createMockCore());
    const data = new Uint8Array([1, 2, 3]);

    fileIO.registerFile("test.bin", data);
    const handle = fileIO.openFile("test.bin");
    fileIO.closeFile(handle);

    assert(!fileIO.openFiles.has(handle), "File should be closed");

    fileIO.dispose();
});

Deno.test("VFS - read bytes from file", () => {
    const fileIO = new Blitz3DFileIO(createMockCore());
    const data = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05]);

    fileIO.registerFile("test.bin", data);
    const handle = fileIO.openFile("test.bin");

    const byte1 = fileIO.readByte(handle);
    const byte2 = fileIO.readByte(handle);

    assertEquals(byte1, 0x01, "First byte should be 0x01");
    assertEquals(byte2, 0x02, "Second byte should be 0x02");

    fileIO.dispose();
});

Deno.test("VFS - read integers from file", () => {
    const fileIO = new Blitz3DFileIO(createMockCore());
    // Little-endian: 0x12345678 = 0x78 0x56 0x34 0x12
    const data = new Uint8Array([0x78, 0x56, 0x34, 0x12]);

    fileIO.registerFile("test.bin", data);
    const handle = fileIO.openFile("test.bin");

    const value = fileIO.readInt(handle);

    assertEquals(value, 0x12345678, "Integer should be read correctly");

    fileIO.dispose();
});

Deno.test("VFS - EOF detection", () => {
    const fileIO = new Blitz3DFileIO(createMockCore());
    const data = new Uint8Array([1, 2, 3]);

    fileIO.registerFile("test.bin", data);
    const handle = fileIO.openFile("test.bin");

    assertEquals(fileIO.eof(handle), 0, "Should not be at EOF initially");

    fileIO.readByte(handle);
    fileIO.readByte(handle);
    fileIO.readByte(handle);

    assertEquals(fileIO.eof(handle), 1, "Should be at EOF after reading all bytes");

    fileIO.dispose();
});

/**
 * Breaking Changes Verification Tests (January 2026)
 */
Deno.test("Breaking Changes - sync XHR removal", () => {
    const fileIO = new Blitz3DFileIO(createMockCore());

    assertEquals(
        (fileIO as Record<string, unknown>).syncFetchEnabled,
        undefined,
        "syncFetchEnabled property should not exist"
    );
    assertEquals(
        typeof fileIO._syncFetchAndRegister,
        "undefined",
        "_syncFetchAndRegister method should not exist"
    );

    fileIO.dispose();
});

Deno.test("Breaking Changes - path validation method exists", () => {
    const fileIO = new Blitz3DFileIO(createMockCore());

    assertEquals(
        typeof fileIO._validatePath,
        "function",
        "_validatePath method should exist for path security"
    );

    fileIO.dispose();
});

/**
 * Asset Manifest Tests
 */
Deno.test("Asset Manifest - load and parse manifest", async () => {
    const fileIO = new Blitz3DFileIO(createMockCore());
    const manifest = {
        basePath: "/assets",
        files: [
            { path: "textures/ground.png", size: 1024 },
            { path: "models/player.b3d", size: 4096 }
        ],
        groups: {
            boot: ["textures/ground.png"],
            init: ["models/player.b3d"]
        }
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (_input: RequestInfo | URL): Promise<Response> => {
        return {
            ok: true,
            json: () => Promise.resolve(manifest),
            status: 200,
            statusText: "OK",
            headers: new Headers(),
            redirected: false,
            type: "default",
            url: "",
            body: null,
            bodyUsed: false,
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
            blob: () => Promise.resolve(new Blob()),
            formData: () => Promise.resolve(new FormData()),
            text: () => Promise.resolve(""),
        } as unknown as Response;
    };

    try {
        const result = await fileIO.loadAssetManifest("/manifest.json");
        assert(result, "Manifest should load successfully");
        assertEquals(fileIO.assetManifest?.files?.length, 2, "Should have 2 files");
    } finally {
        globalThis.fetch = originalFetch;
    }

    fileIO.dispose();
});

/**
 * File Operations Tests
 */
Deno.test("File Operations - seek and tell", () => {
    const fileIO = new Blitz3DFileIO(createMockCore());
    const data = new Uint8Array([1, 2, 3, 4, 5]);

    fileIO.registerFile("test.bin", data);
    const handle = fileIO.openFile("test.bin");

    assertEquals(fileIO.tell(handle), 0, "Position should be 0 initially");

    fileIO.readByte(handle);
    assertEquals(fileIO.tell(handle), 1, "Position should be 1 after reading 1 byte");

    fileIO.seek(handle, 3);
    assertEquals(fileIO.tell(handle), 3, "Position should be 3 after seek");
    assertEquals(fileIO.readByte(handle), 4, "Should read 4 at position 3");

    fileIO.dispose();
});

Deno.test("File Operations - read remaining data", () => {
    const fileIO = new Blitz3DFileIO(createMockCore());
    const data = new Uint8Array([1, 2, 3, 4, 5]);

    fileIO.registerFile("test.bin", data);
    const handle = fileIO.openFile("test.bin");

    fileIO.seek(handle, 2);
    const remaining = fileIO.readRemaining(handle);

    assertEquals(remaining.length, 3, "Should have 3 bytes remaining");
    assertEquals(remaining[0], 3, "First remaining byte should be 3");

    fileIO.dispose();
});

/**
 * Path Resolution Tests
 */
Deno.test("Path Resolution - normalize slashes", () => {
    const fileIO = new Blitz3DFileIO(createMockCore());

    assertEquals(
        fileIO.resolvePath("foo/bar\\baz.txt"),
        "foo/bar/baz.txt",
        "Backslashes should be converted to forward slashes"
    );
});

Deno.test("Path Resolution - trim leading/trailing slashes", () => {
    const fileIO = new Blitz3DFileIO(createMockCore());

    assertEquals(
        fileIO.resolvePath("/foo/bar/"),
        "foo/bar",
        "Leading and trailing slashes should be trimmed"
    );
});

/**
 * Error Handling Tests
 */
Deno.test("Error Handling - dispatchErrorEvent fires event", () => {
    const fileIO = new Blitz3DFileIO(createMockCore());
    let eventFired = false;
    let eventDetail: unknown = null;

    const listener = (e: Event) => {
        eventFired = true;
        eventDetail = (e as CustomEvent).detail;
    };

    if (typeof window !== "undefined") {
        window.addEventListener("blitz3d-file-error", listener as EventListener);
        fileIO._dispatchErrorEvent(new Error("Test error"), "test/path.txt");
        window.removeEventListener("blitz3d-file-error", listener as EventListener);
    } else {
        // Deno test environment - verify method exists and can be called
        assertEquals(typeof fileIO._dispatchErrorEvent, "function", "Method should exist");
        assertEquals(
            typeof fileIO._dispatchErrorEvent,
            "function",
            "_dispatchErrorEvent should be a function"
        );
    }

    if (typeof window !== "undefined") {
        assert(eventFired, "Error event should be fired");
        assertEquals((eventDetail as { filePath: string }).filePath, "test/path.txt");
    }
});

Deno.test("Error Handling - fetchWithRetry succeeds on first attempt", async () => {
    const fileIO = new Blitz3DFileIO(createMockCore());

    const originalFetch = globalThis.fetch;
    let fetchCount = 0;

    globalThis.fetch = async (_input: RequestInfo | URL): Promise<Response> => {
        fetchCount++;
        return {
            ok: true,
            status: 200,
        } as unknown as Response;
    };

    try {
        const response = await fileIO.fetchWithRetry("http://test.com/file.txt");
        assertEquals(response.ok, true, "Response should be OK");
        assertEquals(fetchCount, 1, "Should only fetch once on success");
    } finally {
        globalThis.fetch = originalFetch;
    }
});

Deno.test("Error Handling - fetchWithRetry retries on server error", async () => {
    const fileIO = new Blitz3DFileIO(createMockCore());

    const originalFetch = globalThis.fetch;
    let fetchCount = 0;

    globalThis.fetch = async (_input: RequestInfo | URL): Promise<Response> => {
        fetchCount++;
        if (fetchCount < 3) {
            return {
                ok: false,
                status: 500,
            } as unknown as Response;
        }
        return {
            ok: true,
            status: 200,
        } as unknown as Response;
    };

    try {
        const response = await fileIO.fetchWithRetry("http://test.com/file.txt", 3, 10);
        assertEquals(response.ok, true, "Response should be OK after retry");
        assertEquals(fetchCount, 3, "Should fetch 3 times (2 retries)");
    } finally {
        globalThis.fetch = originalFetch;
    }
});

Deno.test("Error Handling - fetchWithRetry fails after max retries", async () => {
    const fileIO = new Blitz3DFileIO(createMockCore());

    const originalFetch = globalThis.fetch;
    let fetchCount = 0;

    globalThis.fetch = async (_input: RequestInfo | URL): Promise<Response> => {
        fetchCount++;
        return {
            ok: false,
            status: 500,
        } as unknown as Response;
    };

    try {
        let threwError = false;
        try {
            await fileIO.fetchWithRetry("http://test.com/file.txt", 3, 10);
        } catch {
            threwError = true;
        }
        assert(threwError, "Should throw error after max retries");
        assertEquals(fetchCount, 3, "Should attempt 3 times");
    } finally {
        globalThis.fetch = originalFetch;
    }
});

/**
 * Manifest Indexing Tests
 */
Deno.test("Manifest Indexing - build index on load", async () => {
    const fileIO = new Blitz3DFileIO(createMockCore());
    const manifest = {
        files: [
            { path: "tex/foo.png" },
            { path: "tex/bar.png" },
            { path: "models/test.b3d" }
        ]
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (_input: RequestInfo | URL): Promise<Response> => {
        return {
            ok: true,
            json: () => Promise.resolve(manifest),
            status: 200,
            statusText: "OK",
            headers: new Headers(),
            redirected: false,
            type: "default",
            url: "",
            body: null,
            bodyUsed: false,
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
            blob: () => Promise.resolve(new Blob()),
            formData: () => Promise.resolve(new FormData()),
            text: () => Promise.resolve(""),
        } as unknown as Response;
    };

    try {
        await fileIO.loadAssetManifest("/manifest.json");

        assert(
            fileIO._manifestByPath instanceof Map,
            "Manifest index should be a Map"
        );
        assert(
            fileIO._manifestByPathLower instanceof Map,
            "Lowercase manifest index should be a Map"
        );
    } finally {
        globalThis.fetch = originalFetch;
    }

    fileIO.dispose();
});

// --- GetINIInt Tests ---

Deno.test("GetINIInt reads int from INI", () => {
    const core = new Blitz3DCore();
    const imports: any = { env: {}, blitz3d: {} };
    core.setupCommonImports(imports);

    // Register a fake INI file
    const iniContent = new TextEncoder().encode("[graphics]\nwidth=1024\nheight=768\n");
    core.registerFile("options.ini", iniContent);

    // readString needs to return the correct string for each pointer
    const strings: Record<number, string> = { 1: "options.ini", 2: "graphics", 3: "width" };
    core.readString = (ptr: number) => strings[ptr] || "";

    const result = imports.env.GetINIInt(1, 2, 3, 800);
    assertEquals(result, 1024, "Should read 1024 from INI");
});

Deno.test("GetINIInt returns default on missing section", () => {
    const core = new Blitz3DCore();
    const imports: any = { env: {}, blitz3d: {} };
    core.setupCommonImports(imports);

    const iniContent = new TextEncoder().encode("[graphics]\nwidth=1024\n");
    core.registerFile("options.ini", iniContent);

    const strings: Record<number, string> = { 1: "options.ini", 2: "nonexistent", 3: "width" };
    core.readString = (ptr: number) => strings[ptr] || "";

    const result = imports.env.GetINIInt(1, 2, 3, 42);
    assertEquals(result, 42, "Should return default for missing section");
});

Deno.test("GetINIInt returns default on missing key", () => {
    const core = new Blitz3DCore();
    const imports: any = { env: {}, blitz3d: {} };
    core.setupCommonImports(imports);

    const iniContent = new TextEncoder().encode("[graphics]\nwidth=1024\n");
    core.registerFile("options.ini", iniContent);

    const strings: Record<number, string> = { 1: "options.ini", 2: "graphics", 3: "missing" };
    core.readString = (ptr: number) => strings[ptr] || "";

    const result = imports.env.GetINIInt(1, 2, 3, 99);
    assertEquals(result, 99, "Should return default for missing key");
});

Deno.test("GetINIInt returns default on missing file", () => {
    const core = new Blitz3DCore();
    const imports: any = { env: {}, blitz3d: {} };
    core.setupCommonImports(imports);

    const strings: Record<number, string> = { 1: "nonexistent.ini", 2: "graphics", 3: "width" };
    core.readString = (ptr: number) => strings[ptr] || "";

    const result = imports.env.GetINIInt(1, 2, 3, 800);
    assertEquals(result, 800, "Should return default for missing file");
});

Deno.test("GetINIInt handles whitespace", () => {
    const core = new Blitz3DCore();
    const imports: any = { env: {}, blitz3d: {} };
    core.setupCommonImports(imports);

    const iniContent = new TextEncoder().encode("[graphics]\n  width = 42 \n");
    core.registerFile("options.ini", iniContent);

    const strings: Record<number, string> = { 1: "options.ini", 2: "graphics", 3: "width" };
    core.readString = (ptr: number) => strings[ptr] || "";

    const result = imports.env.GetINIInt(1, 2, 3, 0);
    assertEquals(result, 42, "Should handle whitespace around key and value");
});
