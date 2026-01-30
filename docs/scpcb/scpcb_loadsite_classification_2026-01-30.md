# SCPCB Load-Site Classification (static vs dynamic)

Created: 2026-01-30
Source: `docs/scpcb/scpcb_audit_baseline.json` (generated from `../scpcb`)

## Static string literals (convert automatically)

The audit baseline contains an `assets[]` array with every `.b3d/.x/.rmesh` string literal occurrence:

- Total literal hits: 225
- Unique by extension:
  - `.b3d`: 81
  - `.x`: 22
  - `.rmesh`: 9

These are suitable for offline conversion to `.smpk` with a straightforward “path rewrite” rule (string literal → converted `.smpk` path).

## Dynamic path construction (needs mapping rules)

The audit baseline contains a `dynamicCalls[]` array for mesh loads that are *not* direct string literals (variables/fields/params). These require either:

- an explicit mapping table (key → `.smpk` path), or
- refactoring callsites to use known identifiers rather than arbitrary paths.

Dynamic callsites (13):

| File | Line | Function | Arg | Text |
| --- | ---: | --- | --- | --- |
| `../scpcb/Map Creator/window3d.bb` | 892 | `LoadMesh` | `file` | `p\obj = LoadMesh(file)` |
| `../scpcb/Save.bb` | 671 | `LoadAnimMesh_Strict` | `n\Model` | `n\obj = LoadAnimMesh_Strict(n\Model)` |
| `../scpcb/Save.bb` | 1506 | `LoadAnimMesh_Strict` | `n\Model` | `n\obj = LoadAnimMesh_Strict(n\Model)` |
| `../scpcb/Converter.bb` | 599 | `LoadAnimMesh` | `Stri` | `mesh=LoadAnimMesh(Stri)` |
| `../scpcb/Converter.bb` | 633 | `LoadAnimMesh` | `Stri` | `mesh=LoadAnimMesh(Stri)` |
| `../scpcb/StrictLoads.bb` | 301 | `LoadMesh_Strict` | `File$` | `Function LoadMesh_Strict(File$,parent=0)` |
| `../scpcb/StrictLoads.bb` | 303 | `LoadMesh` | `File$` | `tmp = LoadMesh(File$, parent)` |
| `../scpcb/StrictLoads.bb` | 308 | `LoadAnimMesh_Strict` | `File$` | `Function LoadAnimMesh_Strict(File$,parent=0)` |
| `../scpcb/StrictLoads.bb` | 311 | `LoadAnimMesh` | `File$` | `tmp = LoadAnimMesh(File$, parent)` |
| `../scpcb/MapSystem.bb` | 55 | `LoadAnimMesh_Strict` | `file` | `Local map=LoadAnimMesh_Strict(file)` |
| `../scpcb/Items.bb` | 40 | `LoadMesh` | `objpath` | `If it\obj = 0 Then; it\obj = LoadMesh(objpath)` |
| `../scpcb/Items.bb` | 42 | `LoadAnimMesh_Strict` | `objpath` | `it\obj = LoadAnimMesh_Strict(objpath)` |
| `../scpcb/Items.bb` | 45 | `LoadMesh_Strict` | `objpath` | `it\obj = LoadMesh_Strict(objpath)` |

Notes:
- Some of these are wrappers/utility functions (`StrictLoads.bb`) and can be handled by centralizing path rewrite logic in the loader/runtime.
- Others (`Items.bb`, `Save.bb`) likely originate from configuration/serialized fields; these need explicit policy (e.g. canonical IDs instead of paths).

## Optional / unused content (can defer)

Not classified yet. Candidate approach: instrument runtime load paths during real gameplay to identify “never requested” assets.

