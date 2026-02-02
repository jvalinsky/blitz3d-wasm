# Debugging Research Notes

This folder contains dated research notes and proposals related to debugging the
Blitz3D BASIC + engine environment when compiled to WebAssembly.

Naming convention:

- `YYYY-MM-DD_<topic>.md`

## 2026-02-02 learnings (reliability)

- **Infinite loops are expected** in legacy BB code (especially during init/game loops). Any “web interpreter” must run user/game WASM in a killable Worker and enforce a watchdog timeout.
- **ABI mismatches are the common failure mode**: printing and string conversions rely on the compiler’s in-memory string object layout, so runners must decode/allocate strings exactly like the runtime expects.
