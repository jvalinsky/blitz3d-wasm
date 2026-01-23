# SCP: Containment Breach - Menu Demo

This example loads `Menu.wasm` and renders the SCP:CB start menu using a Canvas 2D runtime.

## Run

From this directory:

```bash
python3 -m http.server 8000
```

Open:

```
http://localhost:8000
```

## Notes

- `Menu.wasm` is compiled from `scpcb/Menu.bb`.
- Assets are in `assets/` and are loaded by filename only (paths are normalized).
- Some non-menu functions are stubbed for demo purposes.