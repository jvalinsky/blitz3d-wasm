# BB Deno Smoke Coverage

This folder is a **runtime+compiler smoke suite** for `Tools/bb_deno_compile_and_run.ts`.

It is **not** (yet) “100% Blitz3D language coverage”. It aims to cover the
language subset we currently support in the compiler + the small runtime import
surface implemented in the Deno runner.

## What’s covered (by file)

| File | Primary coverage |
| --- | --- |
| `01_print_literals.bb` | `Print` overloads (string/int/float), literals |
| `02_arithmetic_if.bb` | arithmetic ops, `If/Then/Else`, comparisons |
| `03_loops.bb` | `For/Next`, `While/Wend` |
| `04_functions_defaults.bb` | `Function`, default args, return value |
| `05_arrays.bb` | `Dim` (1D), indexing, expression use |
| `06_types_foreach_delete.bb` | `Type/Field`, `New`, `For Each`, `Delete` |
| `07_data_read_restore.bb` | `Data`, `Read`, `Restore`, string DATA layout |
| `08_data_restore_label.bb` | `Restore .label` |
| `09_goto.bb` | `.label`, `Goto` control flow |
| `10_string_concat_chain.bb` | chained string concatenation |
| `11_repeat_exit.bb` | `Repeat/Until`, `Repeat/Forever`, `Exit` |
| `12_select_case.bb` | `Select/Case/Default/End Select`, `Case x To y` |
| `13_gosub_return.bb` | `Gosub` + `Return` |
| `14_dim_multi.bb` | `Dim` (multi-dimensional) |
| `15_include.bb` | `Include "file.bb"` preprocessor integration |
| `16_insert_before_after.bb` | `Insert Before` linked-list reorder |
| `17_else_if.bb` | `ElseIf` chain |
| `18_delete_each.bb` | `Delete Each` (parser expansion) |
| `99_infinite_loop.bb` | watchdog timeout (hang prevention) |

## Big gaps (not covered yet)

Language constructs we support but don’t currently assert end-to-end here:
- `Insert After`
- `First/Last/Before/After` explicit iteration patterns (outside `For Each`)
- `Handle()` and `Object.TypeName(handle)` casts
- `Select` with multi-value cases (`Case A, B`) and deeper nesting
- `Goto/Gosub` from inside nested blocks (loop/if depth stress)
- More `Data/Read/Restore` shapes (floats, negatives, restore-without-label)

Runtime behaviors not asserted here:
- Any non-trivial runtime imports beyond printing + basic number↔string helpers
- File I/O, graphics, audio, input, timers, etc. (belongs in `web/` runtime tests)
