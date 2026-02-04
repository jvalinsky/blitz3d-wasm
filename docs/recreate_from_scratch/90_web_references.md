# Web References (Curated)

This page is intentionally short and curated: links we repeatedly relied on
while building the web/WASM side of the project.

## WebAssembly JS API and Memory

- MDN: `WebAssembly.Memory` reference (linear memory, grow behavior, endian notes)  
  https://developer.mozilla.org/en-US/docs/WebAssembly/Reference/JavaScript_interface/Memory
- MDN: Using the WebAssembly JavaScript API (overview + memory model)  
  https://developer.mozilla.org/en-US/docs/WebAssembly/Guides/Using_the_JavaScript_API
- WebAssembly spec (core): canonical semantics and validation rules  
  https://webassembly.github.io/spec/core/

## Workers and Messaging

- MDN: `Worker.postMessage()` (structured clone + transferables)  
  https://developer.mozilla.org/en-US/docs/Web/API/Worker/postMessage
- MDN: `DedicatedWorkerGlobalScope.postMessage()` (worker → main thread messaging)  
  https://developer.mozilla.org/en-US/docs/Web/API/DedicatedWorkerGlobalScope/postMessage

## Synchronous XHR Deprecation (Context)

- WHATWG XHR spec note on sync XHR warning/deprecation pressure (see `sync-warning`)  
  https://xhr.spec.whatwg.org/#sync-warning
- Chrome Platform Status: “Deprecate and remove: synchronous XHR in page dismissal”  
  https://chromestatus.com/feature/4664843055398912

## Swift → WASM Toolchain

- Swift.org: WebAssembly / Getting Started (Swift 6.2+ SDK flow)  
  https://www.swift.org/documentation/articles/wasm-getting-started.html
- Swift Forums: “SwiftWasm deprecated?” (community context; why Swift now has native WASI support)  
  https://forums.swift.org/t/swiftwasm-deprecated/77551
- SwiftWasm book (historical/alternate toolchain reference)  
  https://book.swiftwasm.org/

## Autoplay / Audio Context Policies

- MDN: Autoplay guide (user gesture requirements vary by browser)  
  https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay

