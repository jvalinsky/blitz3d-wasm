---
name: swiftwasm-javascriptkit
description: Expert guidance for Swift and WebAssembly development using JavaScriptKit for browser API interop
---

# JavaScriptKit Skill

You are an expert in Swift and WebAssembly development using JavaScriptKit. Your
goal is to help build web applications in Swift by bridging Swift code with
JavaScript/browser APIs.

## Core Capabilities

1. **JavaScript Interop** - Access browser APIs from Swift
2. **Memory Management** - Safely manage Swift closures exposed to JavaScript
3. **DOM Manipulation** - Create and manipulate HTML elements
4. **Event Handling** - Wire up browser events to Swift code
5. **Project Setup** - Initialize new SwiftWasm + JavaScriptKit projects

## Key Concepts

### Accessing JavaScript from Swift

```swift
import JavaScriptKit

// Access global objects
let document = JSObject.global.document
let console = JSObject.global.console

// Create DOM elements
let div = document.createElement("div").object!
div.textContent = .string("Hello from Swift!")
_ = document.body.appendChild(div)
```

### JSValue and Type Conversion

- **JSValue**: The universal type for JavaScript values
- **JSObject**: Callable JavaScript values (functions, objects)
- **Conversion**: Use `.string`, `.number`, `.boolean`, `.object!` to unwrap

```swift
// Property assignment requires .jsValue or explicit wrapper
element.textContent = .string("text")
element.textContent = text.jsValue

// Method calls use ! for dynamic lookup
let div = document.createElement!("div")

// Property access (no !)
let body = document.body.object!
```

### Memory Management (CRITICAL!)

JavaScript doesn't participate in Swift's ARC. You must manually manage
lifetimes:

```swift
class UIManager {
    private var clickHandler: JSClosure?  // Store as property!
    private let button: JSObject
    
    init(button: JSObject) {
        self.button = button
        
        // Must retain closure or it will be deallocated
        self.clickHandler = JSClosure { [weak self] _ in
            self?.handleClick()
            return .undefined
        }
        _ = button.addEventListener!("click", clickHandler!)
    }
    
    deinit {
        // Clean up event listeners
        if let handler = clickHandler {
            _ = button.removeEventListener!("click", handler)
        }
    }
}
```

### Application Lifetime Objects

For root-level managers, store in static property:

```swift
@main
struct MyApp {
    static nonisolated(unsafe) var ui: UIManager!
    
    static func main() {
        let ui = UIManager()
        ui.setup()
        Self.ui = ui  // Retain for application lifetime
    }
}
```

## Architecture Patterns

### Pattern 1: Pure Swift (Full-Stack)

Swift handles everything using JavaScriptKit to call DOM APIs directly.

- **Best for**: Small/medium apps, developers preferring Swift-only
- **Libraries**: Use Elementary.codes for declarative UI
- **Data flow**: Swift → JavaScript (DOM APIs)

### Pattern 2: Hybrid (Core Logic in Swift)

Modern web frameworks (React/Vue/Svelte) handle UI, Swift provides business
logic.

```swift
// Swift side: Export API to JavaScript
let api = JSObject()
api.processData = JSClosure { args in
    let input = args[0].string ?? ""
    let result = HeavyLogic.process(input)
    return .string(result)
}
JSObject.global.mySwiftApp = .object(api)
```

```javascript
// JavaScript side: Call Swift from React/Vue
const result = window.mySwiftApp.processData("input");
```

- **Best for**: Complex UIs, leveraging web components, specialized Swift tasks
- **Data flow**: JavaScript (UI) → Swift (Core Logic)

## Common Patterns

### Event Handling

```swift
// Enter key detection
let input = document.getElementById!("text-input").object!
let closure = JSClosure { [weak self] args in
    guard let event = args.first?.object,
          event.key.string == "Enter" else { return .undefined }
    self?.handleSubmit()
    return .undefined
}
_ = input.addEventListener!("keydown", closure)

// Checkbox toggle
let checkbox = document.getElementById!("toggle").object!
let closure = JSClosure { [weak self] _ in
    let isChecked = checkbox.checked.boolean ?? false
    self?.updateToggleState(isChecked)
    return .undefined
}
_ = checkbox.addEventListener!("change", closure)
```

### Accessing Web APIs

```swift
// WebGL
let canvas = document.createElement!("canvas").object!
let gl = canvas.getContext!("webgl").object!

// navigator.deviceMemory
let navigator = JSObject.global.navigator
let memoryGB = navigator.deviceMemory.number ?? 4.0

// performance.memory (Chrome only)
let performance = JSObject.global.performance
if performance.memory != .undefined {
    let used = performance.memory.usedJSHeapSize.number!
    let limit = performance.memory.jsHeapSizeLimit.number!
}
```

## Common Gotchas

1. **Property Assignment** - Must use `.jsValue` or explicit wrappers
2. **Method Calls** - Use `!` for methods, not for properties
3. **Discarding Results** - Use `_ =` to silence warnings
4. **Closure Retention** - Store as property or it will be deallocated
5. **Browser Compatibility** - Check for `.undefined` before accessing APIs

## Project Setup

### Package.swift

```swift
let package = Package(
    name: "MyWebApp",
    platforms: [.macOS(.v13), .iOS(.v16)],
    dependencies: [
        .package(url: "https://github.com/swiftwasm/JavaScriptKit.git", from: "0.37.0")
    ],
    targets: [
        .executableTarget(
            name: "MyWebApp",
            dependencies: [
                .product(name: "JavaScriptKit", package: "JavaScriptKit")
            ]
        )
    ]
)
```

### Building for WASM

```bash
# Install SwiftWasm toolchain
# Download from: https://github.com/swiftwasm/swift/releases

# Build with SwiftWasm
swift build --triple wasm32-unknown-wasi

# Or with carton (dev server)
carton dev
```

## When to Use This Skill

Load this skill when:

- Implementing browser API access from Swift
- Setting up JavaScriptKit project structure
- Debugging memory issues with closures
- Converting JavaScript patterns to Swift
- Accessing WebGL, Web Audio, or other browser APIs
- Building WASM-based web applications in Swift

## Related Skills

- `swiftwasm-bridgejs` - Type-safe Swift-JavaScript bindings
- `swiftwasm-porting` - Porting Swift code to WebAssembly

## Resources

- [JavaScriptKit GitHub](https://github.com/swiftwasm/JavaScriptKit)
- [SwiftWasm Book](https://book.swiftwasm.org/)
- [Elementary UI Library](https://elementary.codes/)
