# Runtime docs (Deno)

The web runtime is authored in TypeScript under `web/src/runtime/` and bundled
via Deno + Vite. Deno can generate API docs directly from the source using JSDoc
and TypeScript types.

## Generate docs (text)

```bash
deno task docs:runtime
```

## Generate docs (HTML)

```bash
deno task docs:runtime:html
```

Output directory:

- `docs/generated/runtime/`

## Serving note (Vite chunks)

If you rebuild and then see errors like:

- `Failed to fetch dynamically imported module: http://localhost:8082/assets/....js`

it usually means the browser cached an old `.html` that referenced hashed chunk
names from a previous build. Prefer serving `dist/` via `web/serve_dist.ts`,
which sets conservative cache headers for HTML.
