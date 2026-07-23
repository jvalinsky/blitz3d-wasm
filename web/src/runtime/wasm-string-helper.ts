/**
 * Helper for marshaling strings between JavaScript and WASM linear memory
 * Handles UTF-8 (WASM) ↔ UTF-16 (JavaScript) conversion
 */
export class WasmStringHelper {
  private textEncoder = new TextEncoder();
  private textDecoder = new TextDecoder();

  constructor(
    private memory: WebAssembly.Memory,
    private malloc: (size: number) => number,
    private free: (ptr: number) => void,
  ) {}

  /**
   * Copy a JavaScript string into WASM linear memory
   * Returns pointer to null-terminated UTF-8 string
   * Caller is responsible for calling free() when done
   */
  copyStringToWasm(str: string): number {
    // Encode to UTF-8 with null terminator
    const bytes = this.textEncoder.encode(str + "\0");

    // Allocate WASM memory
    const ptr = this.malloc(bytes.length);
    if (ptr === 0) {
      throw new Error("Failed to allocate WASM memory for string");
    }

    // Copy bytes to WASM memory
    const view = new Uint8Array(this.memory.buffer, ptr, bytes.length);
    view.set(bytes);

    return ptr;
  }

  /**
   * Read a null-terminated UTF-8 string from WASM linear memory
   * Does NOT free the pointer - caller must manage lifecycle
   */
  readStringFromWasm(ptr: number): string {
    if (ptr === 0) {
      return "";
    }

    // Find null terminator
    const view = new Uint8Array(this.memory.buffer);
    let end = ptr;
    while (view[end] !== 0 && end < view.length) {
      end++;
    }

    if (end >= view.length) {
      throw new Error("String has no null terminator");
    }

    // Decode UTF-8 bytes to JavaScript string
    const bytes = view.slice(ptr, end);
    return this.textDecoder.decode(bytes);
  }

  /**
   * Copy a string to WASM, call a function with the pointer, then free it
   * Useful for passing string parameters to WASM functions
   */
  withString<T>(str: string, fn: (ptr: number) => T): T {
    const ptr = this.copyStringToWasm(str);
    try {
      return fn(ptr);
    } finally {
      this.free(ptr);
    }
  }

  /**
   * Read a string from WASM pointer and return it
   * Optionally free the pointer afterwards
   */
  takeString(ptr: number, shouldFree = false): string {
    const str = this.readStringFromWasm(ptr);
    if (shouldFree) {
      this.free(ptr);
    }
    return str;
  }

  /**
   * Allocate and copy multiple strings to WASM
   * Returns array of pointers that must be freed
   */
  copyStringsToWasm(strings: string[]): number[] {
    return strings.map((s) => this.copyStringToWasm(s));
  }

  /**
   * Free an array of string pointers
   */
  freeStrings(pointers: number[]): void {
    for (const ptr of pointers) {
      this.free(ptr);
    }
  }
}
