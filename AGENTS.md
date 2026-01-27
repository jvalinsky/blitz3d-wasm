# Directory: blitz3d-wasm

**Parent**: [../](..)

**Children**:
- [Assets](./Assets)
- [Examples](./Examples)
- [Sources](./Sources)
- [Tests](./Tests)
- [Tools](./Tools)
- [docs](./docs)
- [notes](./notes)
- [plan](./plan)
- [test_project](./test_project)
- [visualization](./visualization)

## Docs

- [CODE_REVIEW.md](docs/CODE_REVIEW.md)
- [DEBUGGING_REPORT_20260118.md](docs/DEBUGGING_REPORT_20260118.md)
- [DESIGN_CHOICES.md](docs/DESIGN_CHOICES.md)
- [FIX_STATE_MACHINE_20260118.md](docs/FIX_STATE_MACHINE_20260118.md)
- [NEXT_STEPS_DETAILED_PLAN.md](docs/NEXT_STEPS_DETAILED_PLAN.md)
- [QUICK_START_NEXT_SESSION.md](docs/QUICK_START_NEXT_SESSION.md)
- [SESSION_6_COMPLETE.md](docs/SESSION_6_COMPLETE.md)
- [SESSION_6_CONTINUED.md](docs/SESSION_6_CONTINUED.md)
- [SESSION_6_FINAL_SUMMARY.md](docs/SESSION_6_FINAL_SUMMARY.md)
- [STACK_BALANCE_HEURISTICS.md](docs/STACK_BALANCE_HEURISTICS.md)
- [stack-balancing-research.md](docs/stack-balancing-research.md)

## Notes

- [00_MASTER_INDEX.md](notes/00_MASTER_INDEX.md)
- [01_codebase_structure.md](notes/01_codebase_structure.md)
- [02_npc_system.md](notes/02_npc_system.md)
- [03_save_load_system.md](notes/03_save_load_system.md)
- [04_inventory_system.md](notes/04_inventory_system.md)
- [05_scp_entities.md](notes/05_scp_entities.md)
- [06_game_state_debugging.md](notes/06_game_state_debugging.md)
- [07_scpcb_compilation_gap_analysis.md](notes/07_scpcb_compilation_gap_analysis.md)
- [compilation_error_analysis_20260119.md](notes/compilation_error_analysis_20260119.md)


## Debugging & Testing Tools

### Integration Test Harness

Located in `debug_run.sh` and `Tests/IntegrationTests/puppeteer-harness.js`.

- **Purpose**: Automates the build and testing cycle for the compiler and runtime.
- **Workflow**:
    1.  Builds the Swift compiler (`swift build`).
    2.  Compiles a test Blitz3D file (`Tests/IntegrationTests/MeshTest.bb`).
    3.  Bundles the runtime with Browserify.
    4.  Starts a local Python HTTP server.
    5.  Launches a specific Chrome instance via Puppeteer to load the page and check for console success/failure messages.
- **Key Files**:
    - `debug_run.sh`: Main entry point script.
    - `Tests/IntegrationTests/puppeteer-harness.js`: Node script controlling Chrome. **Note**: Hardcoded to use a specific Chrome for Testing path on macOS ARM64.

### Runtime Debug Overlay

Located in `Sources/Runtime/debug.js`.

- **Purpose**: Provides a visual on-screen overlay in the web runtime showing performance metrics.
- **Metrics**: FPS, Entity Count, Draw Calls, Particle Count, Memory Usage.
- **Usage**: Initialized by `DebugOverlay.init()` in the runtime. Defaults to `enabled: true`.

### IR Debug Tool

Located in `Tools/ir_debug_compact.sh`.

- **Purpose**: Advanced debugging for compiler IR (Intermediate Representation) issues.
- **Usage**: `./Tools/ir_debug_compact.sh <input.bb> [output.wasm]`
- **Features**:
    - Compiles with IR enabled (`--use-ir -g -d`).
    - Generates a `wasm-validate` error digest.
    - Produces an LLM-friendly compact summary of the analysis using `Tools/analyzer/llm-compact.js`.
- **Env overrides**:
    - `B3D_DIGEST_MAX`: Max sample errors (default: 5)
    - `B3D_DIGEST_CONTEXT`: Objdump context lines (default: 1)
    - `B3D_DIGEST_MAX_MAP_MB`: Skip source maps larger than this size in MB (default: 64)
    - `B3D_DIGEST_MAX_OBJDUMP_MB`: Skip wasm-objdump when wasm exceeds this size in MB (default: 64)
    - `B3D_LLM_FORMAT`: Output format for `llm-compact` (default: text)

### WASM Debugger Example

Located in `Examples/wasm-debugger-blitz3d/`.

- **Purpose**: A standalone example demonstrating how to debug the generated WASM in a browser environment.
- **Contents**: Basic HTML/JS setup to load and run a Blitz3D WASM module with debugging enabled.

## Deciduous (Decision Graphs)

**THIS SUBPROJECT USES DECIDUOUS FOR DECISION TRACKING.**

This subproject has its own decision graph, separate from the root project.

### Workflow

**BEFORE EVERY ACTION**, log it:
```bash
deciduous add action "Implementing IR types" -c 85
deciduous link <parent_goal_id> <action_id> -r "Implementing the type system"
```

**AFTER EVERY ACTION**, log the outcome:
```bash
deciduous add outcome "IR types implemented" -c 90
deciduous link <action_id> <outcome_id> -r "Completed type definitions"
```

**CRITICAL**: Log failed approaches with outcomes:
```bash
deciduous add outcome "Auto-import experiment FAILED" -c 100
deciduous link <action_id> <outcome_id> -r "Validation failed due to arity conflicts"
# Note: also add an 'observation' node explaining WHY it failed
```

### Session Start

```bash
/recover  # Restore context from decision graph
deciduous nodes  # See current state
deciduous edges  # Check connections
```

### Before Push

```bash
deciduous sync  # Exports graph to docs/ for GitHub Pages
git add docs/ .github/
git push
```

### Update Generated Files

After upgrading deciduous:
```bash
deciduous update
```

### Documentation

- Decision graph auto-deploys to GitHub Pages
- View at: `https://<user>.github.io/<repo>/`
- Optional: `brew install graphviz` enables `deciduous dot --png` for PNG exports
