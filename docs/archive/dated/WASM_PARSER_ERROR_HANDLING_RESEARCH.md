# WASM Parser Error-Handling Approaches (SOTA References)

Date: 2026-01-27

This note summarizes how widely used Wasm toolchains handle parsing errors and
progress. It is intended to guide parser-guard design decisions in blitz3d-wasm.

## wasmparser (used by Wasmtime/Cranelift)

- wasmparser provides an _incremental_ parser; `parse` consumes input and
  reports how many bytes were consumed, and callers are expected **not to
  re-feed** consumed bytes. [1]
- Callers are expected to continue parsing until `Payload::End` to complete the
  parse. [1]
- Parse errors are returned as `Err` values (fail-fast behavior). [1]
- There is an explicit `skip_section` API to skip the code section after
  `CodeSectionStart` (controlled skipping, not heuristic recovery). [1]

## WABT (wat2wasm)

- `wat2wasm` reads a Wasm text file, **checks it for errors**, and converts it
  to Wasm binary. [2]
- The tool exposes `--debug-parser`, but documentation emphasizes error checking
  rather than recovery. [2]

## Binaryen tools

- Binaryen tools handle many errors by **immediately exiting** (fatal errors).
  [3]
- A compile-time option `THROW_ON_FATAL` can be enabled so fatal errors throw
  `std::runtime_error` for embedders to catch. [3][4]

## Implications for blitz3d-wasm (inference)

Based on the above:

- Prefer _progress guarantees_ (consume input or raise an error) over fixed
  iteration caps that can truncate valid, large functions.
- If recovery is needed, use explicit, bounded skipping (analogous to
  wasmparser's `skip_section`) rather than heuristic caps.

These are design inferences derived from the behaviors documented above.

## Sources

[1] https://paritytech.github.io/try-runtime-cli/wasmparser/struct.Parser.html\
[2] https://webassembly.github.io/wabt/doc/wat2wasm.1.html\
[3]
https://github-wiki-see.page/m/WebAssembly/binaryen/wiki/Compiling-to-WebAssembly-with-Binaryen\
[4]
https://chromium.googlesource.com/external/github.com/WebAssembly/binaryen/%2Bshow/536b066a5606657adb7eea7eb4da89d3cd58306b/CHANGELOG.md
