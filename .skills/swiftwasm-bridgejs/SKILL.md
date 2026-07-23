---
name: swiftwasm-bridgejs
description: Type-safe Swift-to-JavaScript bindings using BridgeJS for WebAssembly projects
---

# BridgeJS Skill

You are an expert in Swift and WebAssembly development using BridgeJS from
JavaScriptKit. BridgeJS is a code generation tool that creates type-safe,
bidirectional Swift-JavaScript bindings.

## Core Capabilities

1. **Export Swift to JavaScript** - Use `@JS` macros to expose Swift APIs
2. **Import JavaScript to Swift** - Generate Swift bindings from TypeScript
   definitions
3. **Type-Safe Bindings** - Automatic `.d.ts` generation for TypeScript
4. **Testing Integration** - End-to-end testing with Vitest

## Key Concepts

### Exporting Swift APIs

Use the `@JS` macro to mark Swift declarations for JavaScript export:

```swift
import BridgeJS

// Export a Swift class to JavaScript
@JS
public class Calculator {
    @JS public func add(_ a: Int, _ b: Int) -> Int {
        return a + b
    }
    
    @JS public func multiply(_ a: Int, _ b: Int) -> Int {
        return a * b
    }
}

// Export to a namespace
@JS(namespace: "Math")
public class Statistics {
    @JS public static func mean(_ numbers: [Double]) -> Double {
        return numbers.reduce(0, +) / Double(numbers.count)
    }
}
```

**JavaScript usage:**

```javascript
import { Calculator } from "./bridge.js";
const calc = new Calculator();
console.log(calc.add(5, 3)); // 8

import { Math } from "./bridge.js";
console.log(Math.Statistics.mean([1, 2, 3, 4, 5])); // 3.0
```

### Importing JavaScript APIs

Define TypeScript declarations in `bridge-js.d.ts` to generate Swift bindings:

```typescript
// bridge-js.d.ts
declare function fetchData(url: string): Promise<string>;

declare namespace Storage {
  function set(key: string, value: string): void;
  function get(key: string): string | null;
}
```

**Generated Swift code (automatic):**

```swift
// Use in Swift
let data = try await fetchData("https://api.example.com/data")

Storage.set("key", "value")
if let value = Storage.get("key") {
    print("Got:", value)
}
```

## Supported Swift Types

### ✅ Fully Supported

- **Primitives**: `Int`, `Bool`, `String`, `Double`, `Float`
- **Collections**: `Array<T>`, `Set<T>` (where T is supported)
- **Optional**: `T?` (becomes `T | null` in JavaScript)
- **Enums**: With associated values
- **Classes**: Reference types with methods
- **Structs**: Value types (copied when passed)
- **Protocols**: Can be exported as interfaces
- **Async/Await**: `async throws` becomes `Promise<T>`

### ⚠️ Limitations

- **Error Handling**: Only `throws(JSException)` is supported, not plain
  `throws`
- **Generics**: Limited support - check current status
- **Dictionaries**: Use `[String: T]` only (JavaScript objects)
- **Tuples**: Not directly supported - use structs instead

## Error Handling

BridgeJS requires typed errors with `JSException`:

```swift
@JS
public func riskyOperation() throws(JSException) -> String {
    // Swift error must be convertible to JSException
    throw JSException(message: "Operation failed")
}
```

**JavaScript usage:**

```javascript
try {
  const result = riskyOperation();
} catch (error) {
  console.error(error.message);
}
```

## Common Patterns

### Exporting Enums

```swift
@JS
public enum Status {
    case idle
    case loading
    case success(String)
    case failure(String)
}

@JS
public class Task {
    @JS public var status: Status
    
    @JS public init() {
        self.status = .idle
    }
}
```

### Callbacks and Closures

```swift
@JS
public typealias CompletionHandler = (String) -> Void

@JS
public class AsyncTask {
    @JS public func execute(onComplete: CompletionHandler) {
        // Perform async work
        onComplete("Done!")
    }
}
```

**JavaScript:**

```javascript
const task = new AsyncTask();
task.execute((result) => {
  console.log(result); // "Done!"
});
```

### Property Observers

```swift
@JS
public class Counter {
    @JS public var count: Int {
        didSet {
            print("Count changed to \(count)")
        }
    }
    
    @JS public init() {
        self.count = 0
    }
}
```

## Project Setup

### Package.swift

```swift
let package = Package(
    name: "MyBridgeJSApp",
    platforms: [.macOS(.v13)],
    dependencies: [
        .package(url: "https://github.com/swiftwasm/JavaScriptKit.git", from: "0.37.0")
    ],
    targets: [
        .executableTarget(
            name: "MyBridgeJSApp",
            dependencies: [
                .product(name: "JavaScriptKit", package: "JavaScriptKit"),
                .product(name: "BridgeJS", package: "JavaScriptKit")
            ],
            plugins: [
                .plugin(name: "BridgeJSPlugin", package: "JavaScriptKit")
            ]
        )
    ]
)
```

### Build Configuration

BridgeJS supports two modes:

1. **Build Plugin** (recommended for development):
   - Runs automatically during `swift build`
   - Regenerates code on every build

2. **Ahead-of-Time (AOT)**:
   - Run code generation manually
   - Commit generated code to repo
   - Faster builds, but requires manual regeneration

```bash
# AOT generation
bridge-js generate Sources/MyApp

# Build with plugin (automatic)
swift build --triple wasm32-unknown-wasi
```

## Testing with Vitest

BridgeJS integrates with Vitest for end-to-end testing:

```typescript
// tests/calculator.test.ts
import { describe, expect, it } from "vitest";
import { Calculator } from "../dist/bridge.js";

describe("Calculator", () => {
  it("adds numbers correctly", () => {
    const calc = new Calculator();
    expect(calc.add(2, 3)).toBe(5);
  });

  it("multiplies numbers", () => {
    const calc = new Calculator();
    expect(calc.multiply(4, 5)).toBe(20);
  });
});
```

```json
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        globals: true
    }
});
```

## Design Guidelines

### Swift API Design for JavaScript

1. **Use clear names** - JavaScript doesn't have argument labels
   ```swift
   // Good
   @JS public func setTitle(_ title: String)

   // Avoid (external label lost in JS)
   @JS public func set(title: String)
   ```

2. **Prefer optionals over exceptions** for expected errors
   ```swift
   @JS public func parse(_ json: String) -> Data?
   ```

3. **Use enums for state** - They map well to TypeScript unions
   ```swift
   @JS public enum LoadingState {
       case loading, success, error
   }
   ```

4. **Document thoroughly** - JSDoc is generated from Swift comments
   ```swift
   /// Calculates the sum of two numbers
   /// - Parameters:
   ///   - a: First number
   ///   - b: Second number
   /// - Returns: The sum of a and b
   @JS public func add(_ a: Int, _ b: Int) -> Int
   ```

## Common Gotchas

1. **Experimental Status** - BridgeJS APIs may change
2. **Plain `throws` Not Supported** - Must use `throws(JSException)`
3. **Type Support** - Always verify current type support before implementing
4. **Namespace Collisions** - Use `@JS(namespace:)` to organize exports
5. **Memory Management** - Same JavaScriptKit rules apply for closures

## When to Use This Skill

Load this skill when:

- Creating type-safe Swift-JavaScript APIs
- Generating TypeScript definitions from Swift
- Importing JavaScript APIs into Swift
- Setting up testing infrastructure for BridgeJS projects
- Building production SwiftWasm applications
- Needing bidirectional Swift-JS interop

## Related Skills

- `swiftwasm-javascriptkit` - Lower-level JavaScript interop
- `swiftwasm-porting` - Porting Swift code to WebAssembly

## Resources

- [BridgeJS Documentation](https://github.com/swiftwasm/JavaScriptKit/tree/main/Sources/BridgeJS)
- [SwiftWasm Book](https://book.swiftwasm.org/)
- [Vitest Testing Framework](https://vitest.dev/)
