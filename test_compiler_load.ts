// Test loading the Blitz3D compiler WASM
const bytes = await Deno.readFile("web/blitz3d-compiler.wasm");

let wasmMemory: WebAssembly.Memory | null = null;

const errno = {
  success: 0,
  badf: 8,
  noent: 44,
  nosys: 52,
};

const wasiImports = {
  args_get: () => errno.success,
  args_sizes_get: () => errno.success,
  environ_get: () => errno.success,
  environ_sizes_get: () => errno.success,
  clock_res_get: () => errno.success,
  clock_time_get: () => errno.success,
  fd_close: () => errno.success,
  fd_fdstat_get: () => errno.success,
  fd_fdstat_set_flags: () => errno.success,
  fd_filestat_get: () => errno.success,
  fd_filestat_set_size: () => errno.success,
  fd_pread: () => errno.success,
  fd_prestat_get: () => errno.badf,
  fd_prestat_dir_name: () => errno.badf,
  fd_read: () => errno.success,
  fd_readdir: () => errno.success,
  fd_seek: () => errno.success,
  fd_sync: () => errno.success,
  fd_tell: () => errno.success,
  fd_write: () => errno.success,
  path_create_directory: () => errno.nosys,
  path_filestat_get: () => errno.noent,
  path_filestat_set_times: () => errno.nosys,
  path_link: () => errno.nosys,
  path_open: () => errno.noent,
  path_readlink: () => errno.nosys,
  path_remove_directory: () => errno.nosys,
  path_rename: () => errno.nosys,
  path_symlink: () => errno.nosys,
  path_unlink_file: () => errno.nosys,
  poll_oneoff: () => errno.success,
  proc_exit: (code: number) => console.log(`Exit code: ${code}`),
  random_get: () => errno.success,
  sched_yield: () => errno.success,
};

try {
  const wasm = await WebAssembly.instantiate(bytes, {
    env: {},
    wasi_snapshot_preview1: wasiImports,
  });

  wasmMemory = wasm.instance.exports.memory as WebAssembly.Memory;

  console.log("SUCCESS: Compiler WASM loaded!");
  console.log("Exports:", Object.keys(wasm.instance.exports));
  console.log("Memory:", wasmMemory ? "available" : "not available");
} catch (error) {
  console.error("FAILED to load compiler WASM:");
  console.error(error);
}
