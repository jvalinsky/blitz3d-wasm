const fs = require("fs");

async function runWasm(path) {
  const wasmBuffer = fs.readFileSync(path);

  let instance; // Hoist instance variable

  // Mock environment with Proxy
  const envImpl = {
    PrintInt: (i) => console.log("PrintInt called with:", i),
    PrintString: (ptr) => {
      console.log("PrintString called with ptr:", ptr);
      if (!instance) return;
      const mem = new Uint8Array(instance.exports.memory.buffer);
      let str = "";
      // Read string structure: [RefCount(4)][Length(4)][Chars...][Null(1)]
      // ptr points to start of structure
      const len = mem[ptr + 4] | (mem[ptr + 5] << 8) | (mem[ptr + 6] << 16) |
        (mem[ptr + 7] << 24);
      console.log("String Length:", len);
      for (let i = 0; i < len; i++) {
        str += String.fromCharCode(mem[ptr + 8 + i]);
      }
      console.log("String Content:", str);
    },
    MilliSecs: () => Date.now(),
    Graphics3D: () => {},
    Flip: () => {},
    Cls: () => {},
    AppTitle: () => {},
    GraphicsWidth: () => 800,
    GraphicsHeight: () => 600,
    // Memory allocator support if needed
    malloc: (size) => {
      if (!instance || !instance.exports.__heap_base) return 0;
      return 0;
    },
  };

  const env = new Proxy(envImpl, {
    get: (target, prop) => {
      if (target[prop]) return target[prop];
      return () => {
        return 0;
      };
    },
  });

  // Generic proxy for any missing module
  const genericProxy = new Proxy({}, {
    get: (target, prop) => {
      if (env[prop]) return env[prop];
      return () => {
        return 0;
      };
    },
  });

  const imports = {
    env: env,
    // Mock blitz3d module for all other imports
    blitz3d: genericProxy,
    al: genericProxy,
  };

  const result = await WebAssembly.instantiate(wasmBuffer, imports);
  instance = result.instance;

  console.log("WASM Instantiated. Exports:", Object.keys(instance.exports));

  if (instance.exports.main) {
    console.log("Running main()...");
    instance.exports.main();
    console.log("Finished main().");
  } else if (instance.exports.Main) {
    console.log("Running Main()...");
    instance.exports.Main();
    console.log("Finished Main().");
  } else if (instance.exports._start) {
    console.log("Running _start()...");
    instance.exports._start();
    console.log("Finished _start().");
  } else {
    console.error("No entry point found!");
  }
}

const wasmPath = process.argv[2];
if (wasmPath) {
  runWasm(wasmPath).catch((err) => console.error(err));
} else {
  console.error("No WASM path provided");
}
