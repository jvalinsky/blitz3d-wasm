# Implementation Status

Last Updated: January 2026

## Summary

| Category           | Status               | Notes                               |
| ------------------ | -------------------- | ----------------------------------- |
| Compiler           | **Production Ready** | 94.7% SCPCB pass rate (54/57 files) |
| TypeScript Runtime | **Production Ready** | ~12K lines with command buffers     |
| Asset Pipeline     | **Complete**         | B3D/X/RMESH → SMPK conversion       |
| Memory Management  | **Tested**           | Zero leaks in runtime tests         |
| WASM Validation    | **100%**             | Full compliance                     |

## Language Features

### Fully Implemented ✅

- **Variables**: Local, Global, Const, Dim arrays
- **Types**: Custom types with fields and linked lists
- **Type Operations**: New, Delete, First, Last, After, Before, Each
- **Control Flow**: If/Then/Else, For/Next, While/Wend, Repeat/Until,
  Select/Case
- **Functions**: User-defined with return values and parameter defaults
- **Field Access**: Case-insensitive `object\field` syntax
- **Include Files**: Multi-file compilation
- **Data Statements**: Data/Read/Restore
- **Operators**: Arithmetic, comparison, logical, string concatenation

### Runtime Functions

The TypeScript runtime (`web/src/runtime/`) implements browser bindings for:

| Category   | File           | Lines | Status   |
| ---------- | -------------- | ----- | -------- |
| Core       | `core.ts`      | ~2066 | Complete |
| Graphics   | `graphics.ts`  | ~3695 | Complete |
| File I/O   | `fileio.ts`    | ~1010 | Complete |
| B3D Loader | `b3d.ts`       | ~880  | Complete |
| Animation  | `animation.ts` | ~144  | Complete |
| Mesh       | `mesh.ts`      | ~278  | Complete |
| SMPK       | `smpk.ts`      | ~332  | Complete |
| X Loader   | `xloader.ts`   | ~402  | Complete |

### Thin Demo Runtime

For simple demos, `Sources/Runtime/thin/runtime.js` (~500 lines) provides:

- Basic Three.js entity management
- Simple input handling
- Timer and frame management

## SCPCB Compatibility

### Compilation Status

- **54/57 files** compile successfully (94.7%)
- **3 files** use deprecated test syntax (not compiler bugs)
- **All game logic** compiles correctly

### Web Port Progress (Track B)

See `plan/00_GLOBAL_PLAN.md` for execution checklists:

- [x] Asset pipeline (B3D/X/RMESH → SMPK)
- [x] Path aliasing for legacy paths
- [x] Virtual filesystem with manifest
- [x] CI gates for no-source-model deployment
- [ ] Full room loading via SMPK
- [ ] Complete audio parity
- [ ] Rendering feature parity

## Adding New Runtime Functions

### 1. Define in Compiler

In `Sources/Compiler/CodeGen/CodeGenerator.swift`, add to `knownFunctions`:

```swift
// (name, export_name, [param_types], [return_types], module)
("MyFunction", "MyFunction", [.i32, .f32], [.i32], "env"),
```

### 2. Implement in Runtime

In `web/src/runtime/core.ts` (or appropriate module):

```typescript
export function MyFunction(param1: number, param2: number): number {
  // Implementation
  return result;
}
```

### 3. Register as Import

In the worker or main entry point, add to the imports object.

### Type Mapping

| BB Type       | WASM Type | TypeScript         |
| ------------- | --------- | ------------------ |
| `%` (Int)     | `i32`     | `number`           |
| `#` (Float)   | `f32`     | `number`           |
| `$` (String)  | `i32`     | `number` (pointer) |
| Entity/Handle | `i32`     | `number`           |

## Testing

### Compiler Tests

```bash
swift test                    # Unit tests
deno task test:swift          # Full suite
```

### Runtime Tests

```bash
deno task test:deno           # TypeScript tests
deno task test:web:build      # Build validation
deno task memleak:scan        # Static analysis
deno task memleak:run         # Runtime leak testing
```

### Integration Tests

```bash
deno task test:all            # Complete test suite
deno task memleak:scpcb:churn # SCPCB-specific validation
```

## Performance Metrics

- **Compilation Speed**: ~1000 lines/second
- **WASM Size**: 30% smaller than legacy
- **Runtime Performance**: 60fps with 1000+ entities
- **Memory Efficiency**: Sub-1MB/hour growth

## Known Issues

1. **Function Shadowing**: User functions can't share names with runtime imports
2. **For Each + Delete**: Use While loop with saved next pointer
3. **String Edge Cases**: Some string literal parsing quirks

## Next Steps

See `plan/subplans/` for detailed execution plans:

1. Complete SMPK room loading integration
2. Audio feature parity
3. Rendering optimization
4. Production deployment
