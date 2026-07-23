/**
 * Integration tests for Blitz3D WASM Engine
 * Tests basic functionality of the compiled Swift engine
 */

import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import { isWasmSupported, loadBlitz3DEngine } from "./wasm-loader.ts";

// Path to WASM file (relative to project root when tests run)
const WASM_PATH = "./web/blitz3d-engine.wasm";

// Stub browser globals for Deno tests
if (typeof (globalThis as any).document === "undefined") {
  (globalThis as any).document = {
    getElementById: () => null,
    createElement: () => ({
      getContext: () => ({}),
      style: {},
    }),
    hasFocus: () => true,
    title: "",
  };
}
if (typeof (globalThis as any).performance === "undefined") {
  (globalThis as any).performance = {
    now: () => Date.now(),
  };
}
if (typeof (globalThis as any).HTMLCanvasElement === "undefined") {
  (globalThis as any).HTMLCanvasElement = class {};
}

Deno.test("WASM is supported", () => {
  assertEquals(isWasmSupported(), true, "WebAssembly should be supported");
});

Deno.test("WASM engine loads successfully", async () => {
  const engine = await loadBlitz3DEngine(WASM_PATH);

  assertExists(engine.instance, "WASM instance should exist");
  assertExists(engine.exports, "Exports should exist");
  assertExists(engine.strings, "String helper should exist");
  assertExists(engine.helpers, "Helpers should exist");
});

Deno.test("WASM memory exports are available", async () => {
  const engine = await loadBlitz3DEngine(WASM_PATH);

  assertExists(engine.exports.memory, "Memory should be exported");
  assertEquals(
    typeof engine.exports.malloc,
    "function",
    "malloc should be a function",
  );
  assertEquals(
    typeof engine.exports.free,
    "function",
    "free should be a function",
  );

  // Memory should be non-empty
  const memSize = engine.exports.memory.buffer.byteLength;
  assertEquals(
    memSize > 0,
    true,
    `Memory should be non-empty (got ${memSize} bytes)`,
  );
});

Deno.test("Bank operations: CreateBank and BankSize", async () => {
  const engine = await loadBlitz3DEngine(WASM_PATH);

  // Create a 1KB bank
  const handle = engine.exports.CreateBank(1024);
  assertEquals(handle > 0, true, "CreateBank should return a valid handle");

  // Verify size
  const size = engine.exports.BankSize(handle);
  assertEquals(size, 1024, "BankSize should return 1024");

  // Clean up
  engine.exports.FreeBank(handle);
});

Deno.test("Bank operations: PokeByte and PeekByte", async () => {
  const engine = await loadBlitz3DEngine(WASM_PATH);

  const handle = engine.exports.CreateBank(256);

  // Write byte
  engine.exports.PokeByte(handle, 0, 42);

  // Read byte
  const value = engine.exports.PeekByte(handle, 0);
  assertEquals(value, 42, "PeekByte should return the poked value");

  // Write at different offset
  engine.exports.PokeByte(handle, 10, 123);
  const value2 = engine.exports.PeekByte(handle, 10);
  assertEquals(value2, 123, "PeekByte at offset 10 should return 123");

  // First value should be unchanged
  const value1Again = engine.exports.PeekByte(handle, 0);
  assertEquals(value1Again, 42, "First byte should still be 42");

  engine.exports.FreeBank(handle);
});

Deno.test("Bank operations: PokeInt and PeekInt", async () => {
  const engine = await loadBlitz3DEngine(WASM_PATH);

  const handle = engine.exports.CreateBank(1024);

  // Write 32-bit integer
  engine.exports.PokeInt(handle, 0, 0x12345678);

  // Read it back
  const value = engine.exports.PeekInt(handle, 0);
  assertEquals(value, 0x12345678, "PeekInt should return the poked value");

  // Write at offset
  engine.exports.PokeInt(handle, 4, -42);
  const value2 = engine.exports.PeekInt(handle, 4);
  assertEquals(value2, -42, "PeekInt should handle negative values");

  engine.exports.FreeBank(handle);
});

Deno.test("Bank operations: PokeFloat and PeekFloat", async () => {
  const engine = await loadBlitz3DEngine(WASM_PATH);

  const handle = engine.exports.CreateBank(1024);

  // Write float
  engine.exports.PokeFloat(handle, 0, 3.14159);

  // Read it back (with small epsilon for float comparison)
  const value = engine.exports.PeekFloat(handle, 0);
  const epsilon = 0.0001;
  assertEquals(
    Math.abs(value - 3.14159) < epsilon,
    true,
    `PeekFloat should return ~3.14159 (got ${value})`,
  );

  engine.exports.FreeBank(handle);
});

Deno.test("String marshaling: JS to WASM and back", async () => {
  const engine = await loadBlitz3DEngine(WASM_PATH);

  const testString = "Hello, WebAssembly! 🎉";

  // Copy string to WASM
  const ptr = engine.strings.copyStringToWasm(testString);
  assertEquals(ptr > 0, true, "String pointer should be non-zero");

  // Read it back
  const readBack = engine.strings.readStringFromWasm(ptr);
  assertEquals(readBack, testString, "String should round-trip correctly");

  // Clean up
  engine.exports.free(ptr);
});

Deno.test("String marshaling: withString helper", async () => {
  const engine = await loadBlitz3DEngine(WASM_PATH);

  let capturedPtr = 0;
  const testString = "Test String";

  const result = engine.strings.withString(testString, (ptr) => {
    capturedPtr = ptr;
    assertEquals(ptr > 0, true, "Pointer should be valid");

    // Read it inside the callback
    const read = engine.strings.readStringFromWasm(ptr);
    assertEquals(read, testString, "String should be readable");

    return 42; // Return value
  });

  assertEquals(result, 42, "withString should return callback result");

  // Pointer should be freed now - reading should give garbage or error
  // (We can't really test this safely, but we know it's freed)
});

Deno.test("Math operations: Sin, Cos, Sqrt", async () => {
  const engine = await loadBlitz3DEngine(WASM_PATH);

  // Test Sin
  const sin90 = engine.exports.Sin(Math.PI / 2);
  const epsilon = 0.0001;
  assertEquals(
    Math.abs(sin90 - 1.0) < epsilon,
    true,
    `Sin(π/2) should be ~1.0 (got ${sin90})`,
  );

  // Test Cos
  const cos0 = engine.exports.Cos(0);
  assertEquals(
    Math.abs(cos0 - 1.0) < epsilon,
    true,
    `Cos(0) should be ~1.0 (got ${cos0})`,
  );

  // Test Sqrt
  const sqrt16 = engine.exports.Sqrt(16);
  assertEquals(sqrt16, 4, "Sqrt(16) should be 4");

  const sqrt2 = engine.exports.Sqrt(2);
  assertEquals(
    Math.abs(sqrt2 - 1.41421) < 0.001,
    true,
    `Sqrt(2) should be ~1.41421 (got ${sqrt2})`,
  );
});

Deno.test("Math operations: Abs, Floor, Ceil", async () => {
  const engine = await loadBlitz3DEngine(WASM_PATH);

  assertEquals(engine.exports.Abs(-42), 42, "Abs(-42) should be 42");
  assertEquals(engine.exports.Abs(42), 42, "Abs(42) should be 42");

  assertEquals(engine.exports.Floor(3.7), 3, "Floor(3.7) should be 3");
  assertEquals(engine.exports.Floor(-3.7), -4, "Floor(-3.7) should be -4");

  assertEquals(engine.exports.Ceil(3.2), 4, "Ceil(3.2) should be 4");
  assertEquals(engine.exports.Ceil(-3.2), -3, "Ceil(-3.2) should be -3");
});

Deno.test("Multiple banks can coexist", async () => {
  const engine = await loadBlitz3DEngine(WASM_PATH);

  // Create multiple banks
  const bank1 = engine.exports.CreateBank(128);
  const bank2 = engine.exports.CreateBank(256);
  const bank3 = engine.exports.CreateBank(512);

  // Verify they have different handles
  assertEquals(bank1 !== bank2, true, "Bank handles should be unique");
  assertEquals(bank2 !== bank3, true, "Bank handles should be unique");
  assertEquals(bank1 !== bank3, true, "Bank handles should be unique");

  // Write different values to each
  engine.exports.PokeByte(bank1, 0, 11);
  engine.exports.PokeByte(bank2, 0, 22);
  engine.exports.PokeByte(bank3, 0, 33);

  // Verify isolation
  assertEquals(engine.exports.PeekByte(bank1, 0), 11);
  assertEquals(engine.exports.PeekByte(bank2, 0), 22);
  assertEquals(engine.exports.PeekByte(bank3, 0), 33);

  // Clean up
  engine.exports.FreeBank(bank1);
  engine.exports.FreeBank(bank2);
  engine.exports.FreeBank(bank3);
});

Deno.test("Memory allocation and deallocation", async () => {
  const engine = await loadBlitz3DEngine(WASM_PATH);

  // Allocate some memory
  const ptr1 = engine.exports.malloc(1024);
  assertEquals(ptr1 > 0, true, "malloc should return non-zero pointer");

  const ptr2 = engine.exports.malloc(2048);
  assertEquals(ptr2 > 0, true, "Second malloc should succeed");
  assertEquals(ptr2 !== ptr1, true, "Pointers should be different");

  // Free them
  engine.exports.free(ptr1);
  engine.exports.free(ptr2);

  // Allocate again (might reuse freed memory)
  const ptr3 = engine.exports.malloc(512);
  assertEquals(ptr3 > 0, true, "malloc after free should work");

  engine.exports.free(ptr3);
});

console.log("✅ All WASM engine tests defined");
