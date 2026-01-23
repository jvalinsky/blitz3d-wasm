# SCP:CB Loading Screen Demo

Renders `DrawLoading()` from Menu.bb using real loading screen assets.

## Run

```bash
cd /Users/jack/Software/scp_port/blitz3d-wasm/Examples/scpcb_loading_demo
python3 -m http.server 8000
```

Open:

```
http://localhost:8000
```

## Notes
- `LoadingDemo.bb` includes `StrictLoads.bb` and `Menu.bb`.
- `Loading.wasm` is built from `LoadingDemo.bb`.
- Assets are stored in `assets/` and loaded by filename.